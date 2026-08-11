using System.Text;
using System.Text.Json;
using Confluent.Kafka;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using WellInformation.Application;
using WellInformation.Contracts;

namespace WellInformation.Infrastructure;

public sealed class KafkaProjectService(
    WellInformationDbContext dbContext,
    IProducer<string, string> producer,
    IConfiguration configuration,
    ILogger<KafkaProjectService> logger) : IProjectService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
    private readonly string kafkaTopic = configuration["Kafka:Topic"]
        ?? throw new InvalidOperationException("Kafka:Topic is required.");

    public async Task<ProjectResponse> CreateAsync(
        CreateProjectRequest request,
        string actor,
        string correlationId,
        CancellationToken cancellationToken)
    {
        var projectCode = request.ProjectCode.Trim().ToUpperInvariant();
        if (await dbContext.ProjectReadModels.IgnoreQueryFilters().AnyAsync(
            value => value.ProjectCode == projectCode,
            cancellationToken))
        {
            throw new DuplicateProjectCodeException(projectCode);
        }

        var now = DateTimeOffset.UtcNow;
        var projectId = Guid.NewGuid();
        var data = new ProjectCreatedV1(
            projectId,
            projectCode,
            request.ProjectName.Trim(),
            request.WellName.Trim(),
            Normalize(request.OperatorName),
            Normalize(request.FieldName),
            Normalize(request.Basin),
            Normalize(request.Location),
            request.Status.Trim(),
            Normalize(request.Description),
            request.PlannedStartDate,
            request.PlannedEndDate,
            request.Latitude,
            request.Longitude,
            now,
            actor);
        await PublishAsync(projectId, 1, "ProjectCreated", data, correlationId, cancellationToken);
        return ToResponse(data, 1, now);
    }

    public async Task<ProjectResponse?> GetAsync(Guid projectId, CancellationToken cancellationToken)
    {
        var project = await dbContext.ProjectReadModels
            .AsNoTracking()
            .SingleOrDefaultAsync(value => value.ProjectId == projectId, cancellationToken);
        return project is null ? null : ToResponse(project);
    }

    public async Task<ProjectResponse> UpdateAsync(
        Guid projectId,
        long expectedVersion,
        CreateProjectRequest request,
        string actor,
        string correlationId,
        CancellationToken cancellationToken)
    {
        var project = await GetRequiredProjectAsync(projectId, cancellationToken);
        EnsureVersion(project, expectedVersion);

        var projectCode = request.ProjectCode.Trim().ToUpperInvariant();
        if (await dbContext.ProjectReadModels.IgnoreQueryFilters().AnyAsync(
            value => value.ProjectCode == projectCode && value.ProjectId != projectId,
            cancellationToken))
        {
            throw new DuplicateProjectCodeException(projectCode);
        }

        var now = DateTimeOffset.UtcNow;
        var version = expectedVersion + 1;
        var data = new ProjectUpdatedV1(
            projectId,
            projectCode,
            request.ProjectName.Trim(),
            request.WellName.Trim(),
            Normalize(request.OperatorName),
            Normalize(request.FieldName),
            Normalize(request.Basin),
            Normalize(request.Location),
            request.Status.Trim(),
            Normalize(request.Description),
            request.PlannedStartDate,
            request.PlannedEndDate,
            request.Latitude,
            request.Longitude,
            project.CreatedAt,
            "node-consumer",
            now,
            actor);
        await PublishAsync(projectId, version, "ProjectUpdated", data, correlationId, cancellationToken);
        return ToResponse(data, version);
    }

    public async Task DeleteAsync(
        Guid projectId,
        long expectedVersion,
        string actor,
        string correlationId,
        CancellationToken cancellationToken)
    {
        var project = await GetRequiredProjectAsync(projectId, cancellationToken);
        EnsureVersion(project, expectedVersion);
        var now = DateTimeOffset.UtcNow;
        var data = new ProjectDeletedV1(projectId, project.ProjectCode, now, actor);
        await PublishAsync(
            projectId,
            expectedVersion + 1,
            "ProjectDeleted",
            data,
            correlationId,
            cancellationToken);
    }

    public async Task<IReadOnlyList<ProjectResponse>> ListAsync(
        string? search,
        string? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var query = dbContext.ProjectReadModels.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(value =>
                EF.Functions.ILike(value.ProjectCode, pattern)
                || EF.Functions.ILike(value.ProjectName, pattern)
                || EF.Functions.ILike(value.WellName, pattern));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(value => value.Status == status.Trim());
        }

        var projects = await query
            .OrderByDescending(value => value.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return projects.Select(ToResponse).ToList();
    }

    private async Task<ProjectReadModel> GetRequiredProjectAsync(
        Guid projectId,
        CancellationToken cancellationToken) =>
        await dbContext.ProjectReadModels
            .AsNoTracking()
            .SingleOrDefaultAsync(value => value.ProjectId == projectId, cancellationToken)
        ?? throw new ProjectNotFoundException(projectId);

    private static void EnsureVersion(ProjectReadModel project, long expectedVersion)
    {
        if (project.AggregateVersion != expectedVersion)
        {
            throw new ProjectVersionConflictException(project.ProjectId, expectedVersion);
        }
    }

    private async Task PublishAsync<TData>(
        Guid projectId,
        long aggregateVersion,
        string eventType,
        TData data,
        string correlationId,
        CancellationToken cancellationToken)
    {
        var envelope = new EventEnvelope<TData>(
            Guid.NewGuid(),
            eventType,
            1,
            "Project",
            projectId,
            aggregateVersion,
            DateTimeOffset.UtcNow,
            correlationId,
            null,
            "well-information-api",
            data);
        var message = new Message<string, string>
        {
            Key = projectId.ToString(),
            Value = JsonSerializer.Serialize(envelope, SerializerOptions),
            Headers = new Headers
            {
                { "content-type", Encoding.UTF8.GetBytes("application/json") },
                { "event-type", Encoding.UTF8.GetBytes(eventType) },
                { "event-version", Encoding.UTF8.GetBytes("1") },
                { "correlation-id", Encoding.UTF8.GetBytes(correlationId) }
            }
        };
        try
        {
            await producer.ProduceAsync(kafkaTopic, message, cancellationToken);
        }
        catch (ProduceException<string, string> exception)
        {
            logger.LogError(
                exception,
                "Kafka publish failed for project {ProjectId} at version {AggregateVersion}",
                projectId,
                aggregateVersion);
            throw;
        }
        catch (KafkaException exception)
        {
            logger.LogError(
                exception,
                "Kafka client failure while publishing project {ProjectId} at version {AggregateVersion}",
                projectId,
                aggregateVersion);
            throw;
        }
    }

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static ProjectResponse ToResponse(ProjectCreatedV1 value, long version, DateTimeOffset updatedAt) => new(
        value.ProjectId, value.ProjectCode, value.ProjectName, value.WellName, value.OperatorName,
        value.FieldName, value.Basin, value.Location, value.Status, value.Description,
        value.PlannedStartDate, value.PlannedEndDate, value.Latitude, value.Longitude,
        version, value.CreatedAtUtc, updatedAt);

    private static ProjectResponse ToResponse(ProjectUpdatedV1 value, long version) => new(
        value.ProjectId, value.ProjectCode, value.ProjectName, value.WellName, value.OperatorName,
        value.FieldName, value.Basin, value.Location, value.Status, value.Description,
        value.PlannedStartDate, value.PlannedEndDate, value.Latitude, value.Longitude,
        version, value.CreatedAtUtc, value.UpdatedAtUtc);

    private static ProjectResponse ToResponse(ProjectReadModel value) => new(
        value.ProjectId, value.ProjectCode, value.ProjectName, value.WellName, value.OperatorName,
        value.FieldName, value.Basin, value.Location, value.Status, value.Description,
        value.PlannedStartDate, value.PlannedEndDate, value.Latitude, value.Longitude,
        value.AggregateVersion, value.CreatedAt, value.UpdatedAt);
}