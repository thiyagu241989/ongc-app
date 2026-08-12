using WellInformation.Domain;

namespace WellInformation.Application;

public sealed record MilestoneRequest(
    string MilestoneType,
    DateTimeOffset OccurredAt);

public sealed record CreateWellboreDesignRequest(
    string Company,
    string Project,
    string Site,
    string Well,
    string Wellbore,
    string Design,
    string OwnerName,
    string DesignType,
    IReadOnlyList<MilestoneRequest>? Milestones);

public sealed record RecordMilestoneRequest(
    string MilestoneType,
    DateTimeOffset OccurredAt);

public sealed record MilestoneResponse(
    string MilestoneType,
    DateTimeOffset OccurredAt);

public sealed record WellboreDesignResponse(
    Guid Id,
    string Company,
    string Project,
    string Site,
    string Well,
    string Wellbore,
    string Design,
    string OwnerName,
    string DesignType,
    string Status,
    long Version,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    IReadOnlyList<MilestoneResponse> Milestones);

public interface IWellboreDesignService
{
    Task<WellboreDesignResponse> CreateAsync(
        CreateWellboreDesignRequest request,
        string correlationId,
        CancellationToken cancellationToken);

    Task<WellboreDesignResponse> RecordMilestoneAsync(
        Guid wellboreDesignId,
        RecordMilestoneRequest request,
        string correlationId,
        CancellationToken cancellationToken);

    Task<WellboreDesignResponse?> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<IReadOnlyList<WellboreDesignResponse>> ListAsync(
        string? company,
        string? well,
        string? status,
        string? owner,
        int page,
        int pageSize,
        CancellationToken cancellationToken);
}

public static class WellboreDesignRequestValidator
{
    public static IReadOnlyDictionary<string, string[]> Validate(CreateWellboreDesignRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);

        ValidateRequired(errors, nameof(request.Company), request.Company, 100);
        ValidateRequired(errors, nameof(request.Project), request.Project, 100);
        ValidateRequired(errors, nameof(request.Site), request.Site, 100);
        ValidateRequired(errors, nameof(request.Well), request.Well, 100);
        ValidateRequired(errors, nameof(request.Wellbore), request.Wellbore, 100);
        ValidateRequired(errors, nameof(request.Design), request.Design, 100);
        ValidateRequired(errors, nameof(request.OwnerName), request.OwnerName, 100);

        if (!DesignTypes.IsValid(request.DesignType ?? string.Empty))
        {
            errors[nameof(request.DesignType)] =
                [$"DesignType must be one of: {string.Join(", ", DesignTypes.All)}."];
        }

        if (request.Milestones is { Count: > 0 })
        {
            for (var i = 0; i < request.Milestones.Count; i++)
            {
                var milestone = request.Milestones[i];
                if (!MilestoneTypes.IsValid(milestone.MilestoneType ?? string.Empty))
                {
                    errors[$"Milestones[{i}].MilestoneType"] =
                        [$"MilestoneType must be one of: {string.Join(", ", MilestoneTypes.All)}."];
                }
            }

            var duplicates = request.Milestones
                .GroupBy(m => m.MilestoneType)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToList();

            if (duplicates.Count > 0)
            {
                errors["Milestones"] =
                    [$"Duplicate milestone types: {string.Join(", ", duplicates)}."];
            }
        }

        return errors;
    }

    public static IReadOnlyDictionary<string, string[]> Validate(RecordMilestoneRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);

        if (!MilestoneTypes.IsValid(request.MilestoneType ?? string.Empty))
        {
            errors[nameof(request.MilestoneType)] =
                [$"MilestoneType must be one of: {string.Join(", ", MilestoneTypes.All)}."];
        }

        return errors;
    }

    private static void ValidateRequired(
        IDictionary<string, string[]> errors,
        string name,
        string? value,
        int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors[name] = [$"{name} is required."];
        }
        else if (value.Trim().Length > maxLength)
        {
            errors[name] = [$"{name} must not exceed {maxLength} characters."];
        }
    }
}

public sealed class WellboreDesignNotFoundException(Guid id)
    : Exception($"Wellbore design '{id}' not found.")
{
    public Guid WellboreDesignId { get; } = id;
}
