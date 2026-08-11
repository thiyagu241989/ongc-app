param(
    [string]$ApiBaseUrl = "http://localhost:5080",
    [string]$KafkaContainer = "ongc-kafka",
    [string]$PostgresContainer = "ongc-postgres",
    [string]$DatabaseName = "WellInformationDB"
)

$ErrorActionPreference = "Stop"

function Wait-Until {
    param(
        [scriptblock]$Condition,
        [string]$FailureMessage,
        [int]$TimeoutSeconds = 20
    )

    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
    while ([DateTimeOffset]::UtcNow -lt $deadline) {
        if (& $Condition) {
            return
        }
        [System.Threading.Thread]::Yield() | Out-Null
    }
    throw $FailureMessage
}

function Get-KafkaOffsets {
    param([string]$Topic)

    $offsets = @{}
    $lines = docker exec $KafkaContainer kafka-get-offsets `
        --bootstrap-server localhost:29092 --topic $Topic
    foreach ($line in $lines) {
        $parts = $line.Split(":")
        $offsets[[int]$parts[1]] = [long]$parts[2]
    }
    return $offsets
}

function Test-ConsumerCaughtUp {
    $lines = docker exec $KafkaContainer kafka-consumer-groups `
        --bootstrap-server localhost:29092 --describe `
        --group well-information-projector-v1
    $numericLags = foreach ($line in $lines) {
        $parts = $line.Trim() -split "\s+"
        if ($parts.Count -ge 6 -and $parts[0] -eq "well-information-projector-v1" `
            -and $parts[5] -match "^\d+$") {
            [long]$parts[5]
        }
    }
    return $numericLags.Count -gt 0 -and (($numericLags | Measure-Object -Sum).Sum -eq 0)
}

$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$projectCode = "ONGC-E2E-$suffix"
$unexpectedTables = docker exec $PostgresContainer psql -U postgres -d $DatabaseName -Atc `
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name NOT IN ('projects', 'kafka_consumer_logs');"
if ([int]$unexpectedTables -ne 0) {
    throw "Fresh database contains unexpected application tables: $unexpectedTables"
}
$topicOffsetsBefore = Get-KafkaOffsets -Topic "projects.events.v1"
$createBody = @{
    projectCode = $projectCode
    projectName = "End-to-End Project"
    wellName = "E2E-WELL-01"
    operatorName = "ONGC"
    fieldName = "Western Offshore"
    basin = "Mumbai Offshore"
    location = "Arabian Sea"
    status = "Draft"
    description = "Automated full workflow verification"
    plannedStartDate = "2026-09-01"
    plannedEndDate = "2027-03-31"
    latitude = 19.076
    longitude = 72.8777
} | ConvertTo-Json

$created = Invoke-RestMethod -Method Post -Uri "$ApiBaseUrl/api/v1/projects" `
    -ContentType "application/json" -Body $createBody
if ($created.version -ne 1) { throw "Create did not return version 1." }

Wait-Until -FailureMessage "Created project was not stored by Node.js." -Condition {
    try {
        $projection = Invoke-RestMethod "$ApiBaseUrl/api/v1/dashboard/projects/$($created.projectId)"
        return $projection.version -eq 1
    } catch { return $false }
}

$update = $createBody | ConvertFrom-Json
$update.projectName = "Updated End-to-End Project"
$update.status = "Active"
$updated = Invoke-RestMethod -Method Put -Uri "$ApiBaseUrl/api/v1/projects/$($created.projectId)" `
    -ContentType "application/json" -Headers @{ "If-Match" = '"1"' } `
    -Body ($update | ConvertTo-Json)
if ($updated.version -ne 2 -or $updated.status -ne "Active") {
    throw "Update did not return version 2 and Active status."
}

Wait-Until -FailureMessage "Updated project was not stored by Node.js." -Condition {
    try {
        $projection = Invoke-RestMethod "$ApiBaseUrl/api/v1/dashboard/projects/$($created.projectId)"
        return $projection.version -eq 2 -and $projection.status -eq "Active"
    } catch { return $false }
}

try {
    Invoke-WebRequest -UseBasicParsing -Method Put -Uri "$ApiBaseUrl/api/v1/projects/$($created.projectId)" `
        -ContentType "application/json" -Headers @{ "If-Match" = '"1"' } `
        -Body ($update | ConvertTo-Json) | Out-Null
    throw "Stale update unexpectedly succeeded."
} catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 412) { throw }
}

Invoke-WebRequest -UseBasicParsing -Method Delete -Uri "$ApiBaseUrl/api/v1/projects/$($created.projectId)" `
    -Headers @{ "If-Match" = '"2"' } | Out-Null

Wait-Until -FailureMessage "Deleted project remains visible in dashboard projection." -Condition {
    try {
        Invoke-WebRequest -UseBasicParsing "$ApiBaseUrl/api/v1/dashboard/projects/$($created.projectId)" | Out-Null
        return $false
    } catch {
        return $_.Exception.Response.StatusCode.value__ -eq 404
    }
}

$topicOffsetsAfter = Get-KafkaOffsets -Topic "projects.events.v1"
$changedPartition = $topicOffsetsAfter.Keys.Where({ $topicOffsetsAfter[$_] -gt $topicOffsetsBefore[$_] })[0]
$messageCount = $topicOffsetsAfter[$changedPartition] - $topicOffsetsBefore[$changedPartition]
$previousErrorPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$publishedMessages = docker exec $KafkaContainer kafka-console-consumer `
    --bootstrap-server localhost:29092 --topic projects.events.v1 `
    --partition $changedPartition --offset $topicOffsetsBefore[$changedPartition] `
    --max-messages $messageCount 2>$null
$ErrorActionPreference = $previousErrorPreference
$projectEvents = @($publishedMessages).Where({
    try {
        $event = $_ | ConvertFrom-Json
        return $event.aggregateId -eq $created.projectId
    } catch { return $false }
})
$eventTypes = @($projectEvents | ForEach-Object { ($_ | ConvertFrom-Json).eventType }) -join ","
if ($eventTypes -ne "ProjectCreated,ProjectUpdated,ProjectDeleted") {
    throw "Unexpected direct Kafka event sequence: $eventTypes"
}
$duplicatePayload = $projectEvents.Where({ ($_ | ConvertFrom-Json).eventType -eq "ProjectDeleted" }) `
    | Select-Object -First 1
if ([string]::IsNullOrWhiteSpace($duplicatePayload)) {
    throw "Could not retrieve the directly published ProjectDeleted event from Kafka."
}
$duplicatePayload | docker exec -i $KafkaContainer kafka-console-producer `
    --bootstrap-server localhost:29092 --topic projects.events.v1
Wait-Until -FailureMessage "Consumer did not acknowledge the duplicate event." `
    -Condition { Test-ConsumerCaughtUp }
$consumerLogCount = docker exec $PostgresContainer psql -U postgres -d $DatabaseName -Atc `
    "SELECT count(*) FROM kafka_consumer_logs WHERE aggregate_id = '$($created.projectId)';"
if ([int]$consumerLogCount -ne 3) {
    throw "Duplicate event created an extra consumer log: $consumerLogCount"
}
$nodeProjectRows = docker exec $PostgresContainer psql -U postgres -d $DatabaseName -Atc `
    "SELECT count(*) FROM projects WHERE project_id = '$($created.projectId)';"
if ([int]$nodeProjectRows -ne 1) {
    throw "Node.js did not store exactly one project row: $nodeProjectRows"
}

$marker = "invalid-$suffix"
$offsetsBefore = Get-KafkaOffsets -Topic "projects.events.v1.dlq"
"{`"marker`":`"$marker`"}" | docker exec -i $KafkaContainer kafka-console-producer `
    --bootstrap-server localhost:29092 --topic projects.events.v1

Wait-Until -FailureMessage "Malformed message was not routed to the DLQ." -Condition {
    $script:offsetsAfter = Get-KafkaOffsets -Topic "projects.events.v1.dlq"
    return $offsetsAfter.Keys.Where({ $offsetsAfter[$_] -gt $offsetsBefore[$_] }).Count -gt 0
}

$changedPartition = $offsetsAfter.Keys.Where({ $offsetsAfter[$_] -gt $offsetsBefore[$_] })[0]
$dlqMessage = docker exec $KafkaContainer kafka-console-consumer `
    --bootstrap-server localhost:29092 --topic projects.events.v1.dlq `
    --partition $changedPartition --offset $offsetsBefore[$changedPartition] --max-messages 1
if (-not ($dlqMessage -join "`n").Contains($marker)) {
    throw "The new DLQ message did not contain marker $marker."
}

[pscustomobject]@{
    ProjectId = $created.projectId
    ProjectCode = $projectCode
    FinalVersion = 3
    CSharpDatabaseWrites = 0
    DirectKafkaEvents = $eventTypes
    NodeProjectRows = $nodeProjectRows
    ConsumerLogs = $consumerLogCount
    DuplicateReplay = "Ignored"
    DlqMarker = $marker
    Result = "Passed"
}