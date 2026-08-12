namespace WellInformation.Infrastructure;

public sealed class WellboreDesignReadModel
{
    public Guid Id { get; set; }
    public string Company { get; set; } = string.Empty;
    public string Project { get; set; } = string.Empty;
    public string Site { get; set; } = string.Empty;
    public string Well { get; set; } = string.Empty;
    public string Wellbore { get; set; } = string.Empty;
    public string Design { get; set; } = string.Empty;
    public string OwnerName { get; set; } = string.Empty;
    public string DesignType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public long AggregateVersion { get; set; }
    public Guid SourceEventId { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset EventOccurredAt { get; set; }
    public DateTimeOffset StoredAt { get; set; }
}

public sealed class MilestoneReadModel
{
    public Guid Id { get; set; }
    public Guid WellboreDesignId { get; set; }
    public string MilestoneType { get; set; } = string.Empty;
    public DateTimeOffset OccurredAt { get; set; }
    public Guid SourceEventId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
