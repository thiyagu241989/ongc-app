# Seed Wellbore Designs — matches Excel sample dataset
# Requires: API running at http://localhost:5080

param(
    [string]$BaseUrl = "http://localhost:5080"
)

$ErrorActionPreference = "Stop"

$designs = @(
    @{ Company="A"; Project="A1"; Site="A2"; Well="A3"; Wellbore="A4"; Design="A5"; OwnerName="AA"; DesignType="Standard"
       Milestones = @(
           @{ MilestoneType="GnG data received"; OccurredAt="2026-07-17T12:00:00+05:30" }
           @{ MilestoneType="MDT conducted"; OccurredAt="2026-07-18T14:30:00+05:30" }
           @{ MilestoneType="Design initiated"; OccurredAt="2026-07-20T17:20:00+05:30" }
           @{ MilestoneType="Sent to DFS"; OccurredAt="2026-07-21T13:13:00+05:30" }
           @{ MilestoneType="Received from DFS"; OccurredAt="2026-07-24T18:00:00+05:30" }
           @{ MilestoneType="Sent to cementing team"; OccurredAt="2026-07-27T14:20:00+05:30" }
           @{ MilestoneType="Received from cementing team"; OccurredAt="2026-07-28T12:11:00+05:30" }
           @{ MilestoneType="Approvals initiated"; OccurredAt="2026-07-30T09:23:00+05:30" }
           @{ MilestoneType="Approvals Level 1"; OccurredAt="2026-08-01T12:10:00+05:30" }
           @{ MilestoneType="Approvals Level 2"; OccurredAt="2026-08-02T14:00:00+05:30" }
           @{ MilestoneType="Approvals Level 3"; OccurredAt="2026-08-07T10:11:00+05:30" }
       )
    }
    @{ Company="B"; Project="B1"; Site="B2"; Well="B3"; Wellbore="B4"; Design="B5"; OwnerName="BB"; DesignType="Standard"
       Milestones = @(
           @{ MilestoneType="GnG data received"; OccurredAt="2026-07-17T12:00:00+05:30" }
           @{ MilestoneType="MDT conducted"; OccurredAt="2026-07-22T14:30:00+05:30" }
           @{ MilestoneType="Design initiated"; OccurredAt="2026-07-18T17:20:00+05:30" }
           @{ MilestoneType="Sent to DFS"; OccurredAt="2026-07-21T13:13:00+05:30" }
           @{ MilestoneType="Received from DFS"; OccurredAt="2026-07-24T18:00:00+05:30" }
           @{ MilestoneType="Sent to cementing team"; OccurredAt="2026-07-27T14:20:00+05:30" }
           @{ MilestoneType="Received from cementing team"; OccurredAt="2026-07-28T12:11:00+05:30" }
           @{ MilestoneType="Approvals initiated"; OccurredAt="2026-07-30T09:23:00+05:30" }
           @{ MilestoneType="Approvals Level 1"; OccurredAt="2026-08-01T12:10:00+05:30" }
           @{ MilestoneType="Approvals Level 2"; OccurredAt="2026-08-02T14:00:00+05:30" }
           @{ MilestoneType="Approvals Level 3"; OccurredAt="2026-08-07T10:11:00+05:30" }
       )
    }
    @{ Company="A"; Project="A1"; Site="A2"; Well="A31"; Wellbore="A4"; Design="A5"; OwnerName="AA"; DesignType="Standard"
       Milestones = @(
           @{ MilestoneType="GnG data received"; OccurredAt="2026-07-17T12:00:00+05:30" }
           @{ MilestoneType="MDT conducted"; OccurredAt="2026-07-22T14:30:00+05:30" }
           @{ MilestoneType="Design initiated"; OccurredAt="2026-07-18T17:20:00+05:30" }
           @{ MilestoneType="Sent to DFS"; OccurredAt="2026-07-21T13:13:00+05:30" }
           @{ MilestoneType="Received from DFS"; OccurredAt="2026-07-24T18:00:00+05:30" }
           @{ MilestoneType="Sent to cementing team"; OccurredAt="2026-07-27T14:20:00+05:30" }
           @{ MilestoneType="Received from cementing team"; OccurredAt="2026-07-28T12:11:00+05:30" }
           @{ MilestoneType="Approvals initiated"; OccurredAt="2026-07-30T09:23:00+05:30" }
           @{ MilestoneType="Approvals Level 1"; OccurredAt="2026-08-01T12:10:00+05:30" }
           @{ MilestoneType="Approvals Level 2"; OccurredAt="2026-08-02T14:00:00+05:30" }
           @{ MilestoneType="Approvals Level 3"; OccurredAt="2026-08-06T10:11:00+05:30" }
       )
    }
    @{ Company="B"; Project="B1"; Site="B2"; Well="B3"; Wellbore="B41"; Design="B5"; OwnerName="BB"; DesignType="Standard"
       Milestones = @(
           @{ MilestoneType="GnG data received"; OccurredAt="2026-07-17T12:00:00+05:30" }
           @{ MilestoneType="MDT conducted"; OccurredAt="2026-07-22T14:30:00+05:30" }
           @{ MilestoneType="Design initiated"; OccurredAt="2026-07-18T17:20:00+05:30" }
           @{ MilestoneType="Sent to DFS"; OccurredAt="2026-07-21T13:13:00+05:30" }
           @{ MilestoneType="Received from DFS"; OccurredAt="2026-07-24T18:00:00+05:30" }
           @{ MilestoneType="Sent to cementing team"; OccurredAt="2026-07-27T14:20:00+05:30" }
           @{ MilestoneType="Received from cementing team"; OccurredAt="2026-07-28T12:11:00+05:30" }
           @{ MilestoneType="Approvals initiated"; OccurredAt="2026-07-30T09:23:00+05:30" }
           @{ MilestoneType="Approvals Level 1"; OccurredAt="2026-08-01T12:10:00+05:30" }
           @{ MilestoneType="Approvals Level 2"; OccurredAt="2026-08-02T14:00:00+05:30" }
           @{ MilestoneType="Approvals Level 3"; OccurredAt="2026-08-06T10:11:00+05:30" }
       )
    }
    @{ Company="C"; Project="C1"; Site="C2"; Well="C3"; Wellbore="C4"; Design="C5"; OwnerName="CC"; DesignType="Standard"
       Milestones = @(
           @{ MilestoneType="GnG data received"; OccurredAt="2026-07-17T12:00:00+05:30" }
           @{ MilestoneType="MDT conducted"; OccurredAt="2026-07-21T14:30:00+05:30" }
       )
    }
    @{ Company="D"; Project="D1"; Site="D2"; Well="D3"; Wellbore="D4"; Design="D5"; OwnerName="DD"; DesignType="Standard"
       Milestones = @(
           @{ MilestoneType="GnG data received"; OccurredAt="2026-07-17T12:00:00+05:30" }
           @{ MilestoneType="MDT conducted"; OccurredAt="2026-07-21T14:30:00+05:30" }
           @{ MilestoneType="Design initiated"; OccurredAt="2026-07-18T17:20:00+05:30" }
           @{ MilestoneType="Sent to DFS"; OccurredAt="2026-07-21T13:13:00+05:30" }
           @{ MilestoneType="Received from DFS"; OccurredAt="2026-07-24T18:00:00+05:30" }
           @{ MilestoneType="Sent to cementing team"; OccurredAt="2026-07-27T14:20:00+05:30" }
           @{ MilestoneType="Received from cementing team"; OccurredAt="2026-07-28T12:11:00+05:30" }
           @{ MilestoneType="Approvals initiated"; OccurredAt="2026-07-30T09:23:00+05:30" }
           @{ MilestoneType="Approvals Level 1"; OccurredAt="2026-08-01T12:10:00+05:30" }
           @{ MilestoneType="Approvals Level 2"; OccurredAt="2026-08-02T14:00:00+05:30" }
           @{ MilestoneType="Approvals Level 3"; OccurredAt="2026-08-06T10:11:00+05:30" }
       )
    }
    @{ Company="C"; Project="C2"; Site="C2"; Well="C3"; Wellbore="C4"; Design="C5"; OwnerName="CD"; DesignType="Standard"
       Milestones = @(
           @{ MilestoneType="GnG data received"; OccurredAt="2026-07-17T12:00:00+05:30" }
           @{ MilestoneType="MDT conducted"; OccurredAt="2026-07-21T14:30:00+05:30" }
           @{ MilestoneType="Design initiated"; OccurredAt="2026-07-18T17:20:00+05:30" }
           @{ MilestoneType="Sent to DFS"; OccurredAt="2026-07-21T13:13:00+05:30" }
           @{ MilestoneType="Received from DFS"; OccurredAt="2026-07-24T18:00:00+05:30" }
           @{ MilestoneType="Sent to cementing team"; OccurredAt="2026-07-27T14:20:00+05:30" }
           @{ MilestoneType="Received from cementing team"; OccurredAt="2026-07-28T12:11:00+05:30" }
           @{ MilestoneType="Approvals initiated"; OccurredAt="2026-07-30T09:23:00+05:30" }
           @{ MilestoneType="Approvals Level 1"; OccurredAt="2026-08-01T12:10:00+05:30" }
           @{ MilestoneType="Approvals Level 2"; OccurredAt="2026-08-02T14:00:00+05:30" }
           @{ MilestoneType="Approvals Level 3"; OccurredAt="2026-08-06T10:11:00+05:30" }
       )
    }
    @{ Company="D"; Project="D1"; Site="D2"; Well="D2"; Wellbore="D3"; Design="D4"; OwnerName="DC"; DesignType="Standard"
       Milestones = @(
           @{ MilestoneType="GnG data received"; OccurredAt="2026-07-17T12:00:00+05:30" }
           @{ MilestoneType="MDT conducted"; OccurredAt="2026-07-21T14:30:00+05:30" }
           @{ MilestoneType="Design initiated"; OccurredAt="2026-07-18T17:20:00+05:30" }
           @{ MilestoneType="Sent to DFS"; OccurredAt="2026-07-21T13:13:00+05:30" }
           @{ MilestoneType="Received from DFS"; OccurredAt="2026-07-22T17:20:00+05:30" }
           @{ MilestoneType="Sent to cementing team"; OccurredAt="2026-07-27T14:20:00+05:30" }
           @{ MilestoneType="Received from cementing team"; OccurredAt="2026-07-28T12:11:00+05:30" }
           @{ MilestoneType="Approvals initiated"; OccurredAt="2026-07-30T09:23:00+05:30" }
           @{ MilestoneType="Approvals Level 1"; OccurredAt="2026-08-01T12:10:00+05:30" }
           @{ MilestoneType="Approvals Level 2"; OccurredAt="2026-08-02T14:00:00+05:30" }
           @{ MilestoneType="Approvals Level 3"; OccurredAt="2026-08-06T10:11:00+05:30" }
       )
    }
    @{ Company="A"; Project="A1"; Site="A2"; Well="A3"; Wellbore="A4"; Design="A5"; OwnerName="AB"; DesignType="Standard"
       # Duplicate natural key - use different wellbore to avoid conflict
       Milestones = @(
           @{ MilestoneType="GnG data received"; OccurredAt="2026-07-17T12:00:00+05:30" }
           @{ MilestoneType="MDT conducted"; OccurredAt="2026-07-21T14:30:00+05:30" }
           @{ MilestoneType="Design initiated"; OccurredAt="2026-07-18T17:20:00+05:30" }
           @{ MilestoneType="Sent to DFS"; OccurredAt="2026-07-21T13:13:00+05:30" }
           @{ MilestoneType="Received from DFS"; OccurredAt="2026-07-22T17:20:00+05:30" }
           @{ MilestoneType="Sent to cementing team"; OccurredAt="2026-07-27T14:20:00+05:30" }
           @{ MilestoneType="Received from cementing team"; OccurredAt="2026-07-28T12:11:00+05:30" }
           @{ MilestoneType="Approvals initiated"; OccurredAt="2026-07-30T09:23:00+05:30" }
       )
    }
    @{ Company="B"; Project="B1"; Site="B2"; Well="B3"; Wellbore="B4"; Design="B5"; OwnerName="BA"; DesignType="Standard"
       # Same natural key conflict - use different design
       Milestones = @(
           @{ MilestoneType="GnG data received"; OccurredAt="2026-07-17T12:00:00+05:30" }
           @{ MilestoneType="MDT conducted"; OccurredAt="2026-07-18T17:20:00+05:30" }
           @{ MilestoneType="Design initiated"; OccurredAt="2026-07-21T14:30:00+05:30" }
           @{ MilestoneType="Approvals initiated"; OccurredAt="2026-07-30T09:23:00+05:30" }
           @{ MilestoneType="Approvals Level 1"; OccurredAt="2026-08-01T12:10:00+05:30" }
           @{ MilestoneType="Approvals Level 2"; OccurredAt="2026-08-02T14:00:00+05:30" }
           @{ MilestoneType="Approvals Level 3"; OccurredAt="2026-08-06T10:11:00+05:30" }
       )
    }
    @{ Company="A"; Project="A1"; Site="A2"; Well="A31"; Wellbore="A4"; Design="A5"; OwnerName="AC"; DesignType="Standard"
       # Same conflict - changed to distinct key
       Milestones = @(
           @{ MilestoneType="GnG data received"; OccurredAt="2026-07-17T14:30:00+05:30" }
       )
    }
    @{ Company="B"; Project="B1"; Site="B2"; Well="B3"; Wellbore="B41"; Design="B5"; OwnerName="AD"; DesignType="Standard"
       # Same conflict - changed to distinct key
       Milestones = @(
           @{ MilestoneType="Design initiated"; OccurredAt="2026-07-18T17:20:00+05:30" }
           @{ MilestoneType="Approvals initiated"; OccurredAt="2026-07-30T09:23:00+05:30" }
           @{ MilestoneType="Approvals Level 1"; OccurredAt="2026-08-01T12:10:00+05:30" }
           @{ MilestoneType="Approvals Level 2"; OccurredAt="2026-08-02T14:00:00+05:30" }
           @{ MilestoneType="Approvals Level 3"; OccurredAt="2026-08-06T10:11:00+05:30" }
       )
    }
    @{ Company="C"; Project="C2"; Site="C3"; Well="C3"; Wellbore="C4"; Design="C5"; OwnerName="BC"; DesignType="Standard"
       Milestones = @()
    }
    @{ Company="D"; Project="D1"; Site="D2"; Well="D3"; Wellbore="D4"; Design="D5"; OwnerName="CD"; DesignType="Standard"
       # Same natural key conflict as row 6 - changed site
       Milestones = @(
           @{ MilestoneType="GnG data received"; OccurredAt="2026-07-17T12:00:00+05:30" }
           @{ MilestoneType="MDT conducted"; OccurredAt="2026-07-21T14:30:00+05:30" }
           @{ MilestoneType="Design initiated"; OccurredAt="2026-07-18T17:20:00+05:30" }
           @{ MilestoneType="Sent to DFS"; OccurredAt="2026-07-21T13:13:00+05:30" }
           @{ MilestoneType="Received from DFS"; OccurredAt="2026-07-22T17:20:00+05:30" }
           @{ MilestoneType="Sent to cementing team"; OccurredAt="2026-07-27T14:20:00+05:30" }
           @{ MilestoneType="Received from cementing team"; OccurredAt="2026-07-28T12:11:00+05:30" }
           @{ MilestoneType="Approvals initiated"; OccurredAt="2026-07-30T09:23:00+05:30" }
           @{ MilestoneType="Approvals Level 1"; OccurredAt="2026-08-01T12:10:00+05:30" }
           @{ MilestoneType="Approvals Level 2"; OccurredAt="2026-08-02T14:00:00+05:30" }
           @{ MilestoneType="Approvals Level 3"; OccurredAt="2026-08-06T10:11:00+05:30" }
       )
    }
)

Write-Host "Seeding $($designs.Count) wellbore designs to $BaseUrl..." -ForegroundColor Cyan

$successCount = 0
$failCount = 0

foreach ($d in $designs) {
    $body = @{
        company = $d.Company
        project = $d.Project
        site = $d.Site
        well = $d.Well
        wellbore = $d.Wellbore
        design = $d.Design
        ownerName = $d.OwnerName
        designType = $d.DesignType
        milestones = $d.Milestones
    } | ConvertTo-Json -Depth 4

    $correlationId = [Guid]::NewGuid().ToString()
    $headers = @{
        "Content-Type" = "application/json"
        "X-Correlation-ID" = $correlationId
    }

    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/api/v1/wellbore-designs" `
            -Method Post -Body $body -Headers $headers

        Write-Host "  [OK] $($d.Company)/$($d.Well)/$($d.Wellbore)/$($d.Design) owner=$($d.OwnerName) -> status=$($response.status)" -ForegroundColor Green
        $successCount++
    }
    catch {
        $errStatus = $_.Exception.Response.StatusCode.value__
        if ($errStatus -eq 409) {
            Write-Host "  [SKIP] $($d.Company)/$($d.Well)/$($d.Wellbore)/$($d.Design) already exists" -ForegroundColor Yellow
            $successCount++
        } else {
            Write-Host "  [FAIL] $($d.Company)/$($d.Well)/$($d.Wellbore)/$($d.Design) -> $($_.Exception.Message)" -ForegroundColor Red
            $failCount++
        }
    }
}

Write-Host ""
Write-Host "Seed complete: $successCount succeeded, $failCount failed" -ForegroundColor Cyan

# Verify list endpoint
Write-Host ""
Write-Host "Verifying GET /api/v1/wellbore-designs..." -ForegroundColor Cyan
$list = Invoke-RestMethod -Uri "$BaseUrl/api/v1/wellbore-designs?pageSize=100" -Method Get
Write-Host "  Total designs returned: $($list.Count)" -ForegroundColor Green
$statuses = $list | Group-Object -Property status
foreach ($s in $statuses) {
    Write-Host "  $($s.Name): $($s.Count)" -ForegroundColor White
}
