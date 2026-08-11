namespace WellInformation.Contracts;

public sealed record EventEnvelope<TData>(
    Guid EventId,
    string EventType,
    int EventVersion,
    string AggregateType,
    Guid AggregateId,
    long AggregateVersion,
    DateTimeOffset OccurredAtUtc,
    string CorrelationId,
    string? CausationId,
    string Producer,
    TData Data);

public sealed record ProjectCreatedV1(
    Guid ProjectId,
    string ProjectCode,
    string ProjectName,
    string WellName,
    string? OperatorName,
    string? FieldName,
    string? Basin,
    string? Location,
    string Status,
    string? Description,
    DateOnly? PlannedStartDate,
    DateOnly? PlannedEndDate,
    decimal? Latitude,
    decimal? Longitude,
    DateTimeOffset CreatedAtUtc,
    string CreatedBy);

public sealed record ProjectUpdatedV1(
    Guid ProjectId,
    string ProjectCode,
    string ProjectName,
    string WellName,
    string? OperatorName,
    string? FieldName,
    string? Basin,
    string? Location,
    string Status,
    string? Description,
    DateOnly? PlannedStartDate,
    DateOnly? PlannedEndDate,
    decimal? Latitude,
    decimal? Longitude,
    DateTimeOffset CreatedAtUtc,
    string CreatedBy,
    DateTimeOffset UpdatedAtUtc,
    string UpdatedBy);

public sealed record ProjectDeletedV1(
    Guid ProjectId,
    string ProjectCode,
    DateTimeOffset DeletedAtUtc,
    string DeletedBy);