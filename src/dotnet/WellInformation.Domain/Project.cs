namespace WellInformation.Domain;

public sealed class Project
{
    private Project()
    {
    }

    private Project(
        Guid projectId,
        string projectCode,
        string projectName,
        string wellName,
        string? operatorName,
        string? fieldName,
        string? basin,
        string? location,
        string status,
        string? description,
        DateOnly? plannedStartDate,
        DateOnly? plannedEndDate,
        decimal? latitude,
        decimal? longitude,
        string createdBy,
        DateTimeOffset now)
    {
        ProjectId = projectId;
        ProjectCode = projectCode;
        ProjectName = projectName;
        WellName = wellName;
        OperatorName = operatorName;
        FieldName = fieldName;
        Basin = basin;
        Location = location;
        Status = status;
        Description = description;
        PlannedStartDate = plannedStartDate;
        PlannedEndDate = plannedEndDate;
        Latitude = latitude;
        Longitude = longitude;
        AggregateVersion = 1;
        CreatedAt = now;
        CreatedBy = createdBy;
        UpdatedAt = now;
        UpdatedBy = createdBy;
    }

    public Guid ProjectId { get; private set; }
    public string ProjectCode { get; private set; } = string.Empty;
    public string ProjectName { get; private set; } = string.Empty;
    public string WellName { get; private set; } = string.Empty;
    public string? OperatorName { get; private set; }
    public string? FieldName { get; private set; }
    public string? Basin { get; private set; }
    public string? Location { get; private set; }
    public string Status { get; private set; } = ProjectStatuses.Draft;
    public string? Description { get; private set; }
    public DateOnly? PlannedStartDate { get; private set; }
    public DateOnly? PlannedEndDate { get; private set; }
    public decimal? Latitude { get; private set; }
    public decimal? Longitude { get; private set; }
    public long AggregateVersion { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public string CreatedBy { get; private set; } = string.Empty;
    public DateTimeOffset UpdatedAt { get; private set; }
    public string UpdatedBy { get; private set; } = string.Empty;
    public DateTimeOffset? DeletedAt { get; private set; }

    public static Project Create(
        Guid projectId,
        string projectCode,
        string projectName,
        string wellName,
        string? operatorName,
        string? fieldName,
        string? basin,
        string? location,
        string status,
        string? description,
        DateOnly? plannedStartDate,
        DateOnly? plannedEndDate,
        decimal? latitude,
        decimal? longitude,
        string createdBy,
        DateTimeOffset now)
    {
        return new Project(
            projectId,
            projectCode,
            projectName,
            wellName,
            operatorName,
            fieldName,
            basin,
            location,
            status,
            description,
            plannedStartDate,
            plannedEndDate,
            latitude,
            longitude,
            createdBy,
            now);
    }

    public void Update(
        string projectCode,
        string projectName,
        string wellName,
        string? operatorName,
        string? fieldName,
        string? basin,
        string? location,
        string status,
        string? description,
        DateOnly? plannedStartDate,
        DateOnly? plannedEndDate,
        decimal? latitude,
        decimal? longitude,
        string updatedBy,
        DateTimeOffset now)
    {
        ProjectCode = projectCode;
        ProjectName = projectName;
        WellName = wellName;
        OperatorName = operatorName;
        FieldName = fieldName;
        Basin = basin;
        Location = location;
        Status = status;
        Description = description;
        PlannedStartDate = plannedStartDate;
        PlannedEndDate = plannedEndDate;
        Latitude = latitude;
        Longitude = longitude;
        AggregateVersion++;
        UpdatedAt = now;
        UpdatedBy = updatedBy;
    }

    public void Delete(string deletedBy, DateTimeOffset now)
    {
        IsDeleted = true;
        DeletedAt = now;
        AggregateVersion++;
        UpdatedAt = now;
        UpdatedBy = deletedBy;
    }
}

public static class ProjectStatuses
{
    public const string Draft = "Draft";
    public const string Active = "Active";
    public const string OnHold = "OnHold";
    public const string Completed = "Completed";
    public const string Cancelled = "Cancelled";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        Draft,
        Active,
        OnHold,
        Completed,
        Cancelled
    };
}