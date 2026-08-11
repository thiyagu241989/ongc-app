using System.Text.RegularExpressions;
using WellInformation.Domain;

namespace WellInformation.Application;

public sealed record CreateProjectRequest(
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
    decimal? Longitude);

public sealed record ProjectResponse(
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
    long Version,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

public interface IProjectService
{
    Task<ProjectResponse> CreateAsync(
        CreateProjectRequest request,
        string actor,
        string correlationId,
        CancellationToken cancellationToken);

    Task<ProjectResponse?> GetAsync(Guid projectId, CancellationToken cancellationToken);

    Task<ProjectResponse> UpdateAsync(
        Guid projectId,
        long expectedVersion,
        CreateProjectRequest request,
        string actor,
        string correlationId,
        CancellationToken cancellationToken);

    Task DeleteAsync(
        Guid projectId,
        long expectedVersion,
        string actor,
        string correlationId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<ProjectResponse>> ListAsync(
        string? search,
        string? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken);
}

public static partial class ProjectRequestValidator
{
    public static IReadOnlyDictionary<string, string[]> Validate(CreateProjectRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        AddRequiredAndLengthError(errors, nameof(request.ProjectCode), request.ProjectCode, 50);
        AddRequiredAndLengthError(errors, nameof(request.ProjectName), request.ProjectName, 200);
        AddRequiredAndLengthError(errors, nameof(request.WellName), request.WellName, 200);

        var normalizedCode = request.ProjectCode?.Trim().ToUpperInvariant() ?? string.Empty;
        if (normalizedCode.Length > 0 && !ProjectCodePattern().IsMatch(normalizedCode))
        {
            errors[nameof(request.ProjectCode)] = ["Project code must use uppercase letters, numbers, underscores, or hyphens and contain 3 to 50 characters."];
        }

        if (!ProjectStatuses.All.Contains(request.Status?.Trim() ?? string.Empty))
        {
            errors[nameof(request.Status)] = [$"Status must be one of: {string.Join(", ", ProjectStatuses.All)}."];
        }

        if (request.PlannedStartDate.HasValue && request.PlannedEndDate < request.PlannedStartDate)
        {
            errors[nameof(request.PlannedEndDate)] = ["Planned end date cannot be before planned start date."];
        }

        if (request.Latitude is < -90 or > 90)
        {
            errors[nameof(request.Latitude)] = ["Latitude must be between -90 and 90."];
        }

        if (request.Longitude is < -180 or > 180)
        {
            errors[nameof(request.Longitude)] = ["Longitude must be between -180 and 180."];
        }

        AddOptionalLengthError(errors, nameof(request.OperatorName), request.OperatorName, 200);
        AddOptionalLengthError(errors, nameof(request.FieldName), request.FieldName, 200);
        AddOptionalLengthError(errors, nameof(request.Basin), request.Basin, 150);
        AddOptionalLengthError(errors, nameof(request.Location), request.Location, 300);
        return errors;
    }

    private static void AddRequiredAndLengthError(
        IDictionary<string, string[]> errors,
        string name,
        string? value,
        int maximumLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors[name] = ["The field is required."];
        }
        else if (value.Trim().Length > maximumLength)
        {
            errors[name] = [$"The field cannot exceed {maximumLength} characters."];
        }
    }

    private static void AddOptionalLengthError(
        IDictionary<string, string[]> errors,
        string name,
        string? value,
        int maximumLength)
    {
        if (value?.Trim().Length > maximumLength)
        {
            errors[name] = [$"The field cannot exceed {maximumLength} characters."];
        }
    }

    [GeneratedRegex("^[A-Z0-9][A-Z0-9_-]{2,49}$", RegexOptions.CultureInvariant)]
    private static partial Regex ProjectCodePattern();
}

public sealed class DuplicateProjectCodeException(string projectCode)
    : Exception($"A project with code '{projectCode}' already exists.");

public sealed class ProjectNotFoundException(Guid projectId)
    : Exception($"Project '{projectId}' was not found.");

public sealed class ProjectVersionConflictException(Guid projectId, long expectedVersion)
    : Exception($"Project '{projectId}' no longer has expected version {expectedVersion}.");