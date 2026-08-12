namespace WellInformation.Domain;

public static class MilestoneTypes
{
    public const string GnGDataReceived = "GnG data received";
    public const string MdtConducted = "MDT conducted";
    public const string DesignInitiated = "Design initiated";
    public const string SentToDfs = "Sent to DFS";
    public const string ReceivedFromDfs = "Received from DFS";
    public const string SentToCementingTeam = "Sent to cementing team";
    public const string ReceivedFromCementingTeam = "Received from cementing team";
    public const string ApprovalsInitiated = "Approvals initiated";
    public const string ApprovalsLevel1 = "Approvals Level 1";
    public const string ApprovalsLevel2 = "Approvals Level 2";
    public const string ApprovalsLevel3 = "Approvals Level 3";

    public static readonly IReadOnlyList<string> All =
    [
        GnGDataReceived,
        MdtConducted,
        DesignInitiated,
        SentToDfs,
        ReceivedFromDfs,
        SentToCementingTeam,
        ReceivedFromCementingTeam,
        ApprovalsInitiated,
        ApprovalsLevel1,
        ApprovalsLevel2,
        ApprovalsLevel3
    ];

    public static bool IsValid(string type) => All.Contains(type);
}

public static class DesignTypes
{
    public const string Standard = "Standard";
    public const string Montage = "Montage";

    public static readonly IReadOnlyList<string> All = [Standard, Montage];

    public static bool IsValid(string type) => All.Contains(type);
}

public static class DesignStatuses
{
    public const string NotStarted = "Not started";
    public const string DataReceived = "Data received";
    public const string InProgress = "In progress";
    public const string Completed = "Completed";

    public static readonly IReadOnlyList<string> All = [NotStarted, DataReceived, InProgress, Completed];

    /// <summary>Derives status from the set of recorded milestone types.</summary>
    public static string Derive(IReadOnlyCollection<string> milestoneTypes, string designType)
    {
        if (milestoneTypes.Count == 0)
            return NotStarted;

        var finalApproval = designType == DesignTypes.Montage
            ? MilestoneTypes.ApprovalsLevel2
            : MilestoneTypes.ApprovalsLevel3;

        if (milestoneTypes.Contains(finalApproval))
            return Completed;

        if (milestoneTypes.Contains(MilestoneTypes.DesignInitiated)
            || milestoneTypes.Contains(MilestoneTypes.ApprovalsInitiated)
            || milestoneTypes.Contains(MilestoneTypes.ApprovalsLevel1)
            || milestoneTypes.Contains(MilestoneTypes.ApprovalsLevel2))
            return InProgress;

        return DataReceived;
    }
}

public sealed class WellboreDesign
{
    public Guid Id { get; init; }
    public string Company { get; init; } = string.Empty;
    public string Project { get; init; } = string.Empty;
    public string Site { get; init; } = string.Empty;
    public string Well { get; init; } = string.Empty;
    public string Wellbore { get; init; } = string.Empty;
    public string Design { get; init; } = string.Empty;
    public string OwnerName { get; init; } = string.Empty;
    public string DesignType { get; init; } = DesignTypes.Standard;
    public string Status { get; private set; } = DesignStatuses.NotStarted;
    public long AggregateVersion { get; init; }

    public static WellboreDesign Create(
        Guid id,
        string company,
        string project,
        string site,
        string well,
        string wellbore,
        string design,
        string ownerName,
        string designType,
        IReadOnlyCollection<string> milestoneTypes)
    {
        return new WellboreDesign
        {
            Id = id,
            Company = company,
            Project = project,
            Site = site,
            Well = well,
            Wellbore = wellbore,
            Design = design,
            OwnerName = ownerName,
            DesignType = designType,
            Status = DesignStatuses.Derive(milestoneTypes, designType),
            AggregateVersion = 1
        };
    }
}
