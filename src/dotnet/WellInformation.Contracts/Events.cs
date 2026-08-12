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

public sealed record MilestoneEntry(
    string MilestoneType,
    DateTimeOffset OccurredAt);

public sealed record WellboreDesignCreatedV1(
    Guid WellboreDesignId,
    string Company,
    string Project,
    string Site,
    string Well,
    string Wellbore,
    string Design,
    string OwnerName,
    string DesignType,
    IReadOnlyList<MilestoneEntry> Milestones,
    DateTimeOffset CreatedAtUtc);

public sealed record MilestoneRecordedV1(
    Guid WellboreDesignId,
    string MilestoneType,
    DateTimeOffset OccurredAt,
    DateTimeOffset RecordedAtUtc);
