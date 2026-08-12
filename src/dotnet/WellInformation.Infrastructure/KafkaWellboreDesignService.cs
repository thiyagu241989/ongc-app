using System.Text.Json;
using Confluent.Kafka;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using WellInformation.Application;
using WellInformation.Contracts;
using WellInformation.Domain;

namespace WellInformation.Infrastructure;

public sealed class KafkaWellboreDesignService(
    WellInformationDbContext dbContext,
    IProducer<string, string> producer,
    IConfiguration configuration,
    ILogger<KafkaWellboreDesignService> logger) : IWellboreDesignService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
    private readonly string kafkaTopic = configuration["Kafka:WellboreDesignTopic"]
        ?? "wellbore-designs.events.v1";

    public async Task<WellboreDesignResponse> CreateAsync(
        CreateWellboreDesignRequest request,
        string correlationId,
        CancellationToken cancellationToken)
    {
        var company = request.Company.Trim();
        var project = request.Project.Trim();
        var site = request.Site.Trim();
        var well = request.Well.Trim();
        var wellbore = request.Wellbore.Trim();
        var design = request.Design.Trim();

        if (await dbContext.WellboreDesignReadModels.IgnoreQueryFilters().AnyAsync(
            d => d.Company == company && d.Project == project && d.Site == site
                && d.Well == well && d.Wellbore == wellbore && d.Design == design
                && d.OwnerName == request.OwnerName.Trim(),
            cancellationToken))
        {
            throw new DuplicateWellboreDesignException(company, project, site, well, wellbore, design);
        }

        var now = DateTimeOffset.UtcNow;
        var id = Guid.NewGuid();
        var milestones = (request.Milestones ?? [])
            .Select(m => new MilestoneEntry(m.MilestoneType, m.OccurredAt))
            .ToList();

        var data = new WellboreDesignCreatedV1(
            id, company, project, site, well, wellbore, design,
            request.OwnerName.Trim(), request.DesignType.Trim(),
            milestones, now);

        await PublishAsync(id, 1, "WellboreDesignCreated", data, correlationId, cancellationToken);

        var milestoneTypes = milestones.Select(m => m.MilestoneType).ToList();
        var status = DesignStatuses.Derive(milestoneTypes, request.DesignType.Trim());

        return new WellboreDesignResponse(
            id, company, project, site, well, wellbore, design,
            request.OwnerName.Trim(), request.DesignType.Trim(),
            status, 1, now, now,
            milestones.Select(m => new MilestoneResponse(m.MilestoneType, m.OccurredAt)).ToList());
    }

    public async Task<WellboreDesignResponse> RecordMilestoneAsync(
        Guid wellboreDesignId,
        RecordMilestoneRequest request,
        string correlationId,
        CancellationToken cancellationToken)
    {
        var designModel = await dbContext.WellboreDesignReadModels
            .AsNoTracking()
            .SingleOrDefaultAsync(d => d.Id == wellboreDesignId, cancellationToken)
            ?? throw new WellboreDesignNotFoundException(wellboreDesignId);

        var now = DateTimeOffset.UtcNow;
        var newVersion = designModel.AggregateVersion + 1;
        var data = new MilestoneRecordedV1(
            wellboreDesignId,
            request.MilestoneType,
            request.OccurredAt,
            now);

        await PublishAsync(wellboreDesignId, newVersion, "MilestoneRecorded", data, correlationId, cancellationToken);

        var existingMilestones = await dbContext.MilestoneReadModels
            .AsNoTracking()
            .Where(m => m.WellboreDesignId == wellboreDesignId)
            .ToListAsync(cancellationToken);

        var allTypes = existingMilestones.Select(m => m.MilestoneType).Append(request.MilestoneType).Distinct().ToList();
        var status = DesignStatuses.Derive(allTypes, designModel.DesignType);

        var milestoneResponses = existingMilestones
            .Select(m => new MilestoneResponse(m.MilestoneType, m.OccurredAt))
            .Append(new MilestoneResponse(request.MilestoneType, request.OccurredAt))
            .ToList();

        return new WellboreDesignResponse(
            designModel.Id, designModel.Company, designModel.Project, designModel.Site,
            designModel.Well, designModel.Wellbore, designModel.Design,
            designModel.OwnerName, designModel.DesignType,
            status, newVersion, designModel.CreatedAt, now, milestoneResponses);
    }

    public async Task<WellboreDesignResponse?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var design = await dbContext.WellboreDesignReadModels
            .AsNoTracking()
            .SingleOrDefaultAsync(d => d.Id == id, cancellationToken);
        if (design is null) return null;

        var milestones = await dbContext.MilestoneReadModels
            .AsNoTracking()
            .Where(m => m.WellboreDesignId == id)
            .OrderBy(m => m.OccurredAt)
            .ToListAsync(cancellationToken);

        return ToResponse(design, milestones);
    }

    public async Task<IReadOnlyList<WellboreDesignResponse>> ListAsync(
        string? company,
        string? well,
        string? status,
        string? owner,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var query = dbContext.WellboreDesignReadModels.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(company))
            query = query.Where(d => d.Company == company.Trim());

        if (!string.IsNullOrWhiteSpace(well))
        {
            var pattern = $"%{well.Trim()}%";
            query = query.Where(d => EF.Functions.ILike(d.Well, pattern)
                || EF.Functions.ILike(d.Wellbore, pattern));
        }

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(d => d.Status == status.Trim());

        if (!string.IsNullOrWhiteSpace(owner))
            query = query.Where(d => d.OwnerName == owner.Trim());

        var designs = await query
            .OrderByDescending(d => d.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var designIds = designs.Select(d => d.Id).ToList();
        var milestones = await dbContext.MilestoneReadModels
            .AsNoTracking()
            .Where(m => designIds.Contains(m.WellboreDesignId))
            .OrderBy(m => m.OccurredAt)
            .ToListAsync(cancellationToken);

        var milestonesByDesign = milestones
            .GroupBy(m => m.WellboreDesignId)
            .ToDictionary(g => g.Key, g => g.ToList());

        return designs.Select(d =>
            ToResponse(d, milestonesByDesign.GetValueOrDefault(d.Id) ?? [])).ToList();
    }

    private async Task PublishAsync<TData>(
        Guid aggregateId,
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
            "WellboreDesign",
            aggregateId,
            aggregateVersion,
            DateTimeOffset.UtcNow,
            correlationId,
            null,
            "well-information-api",
            data);

        var message = new Message<string, string>
        {
            Key = aggregateId.ToString(),
            Value = JsonSerializer.Serialize(envelope, SerializerOptions)
        };

        var result = await producer.ProduceAsync(kafkaTopic, message, cancellationToken);
        logger.LogDebug("Published {EventType} to {Topic}:{Partition}@{Offset}",
            eventType, result.Topic, result.Partition.Value, result.Offset.Value);
    }

    private static WellboreDesignResponse ToResponse(
        WellboreDesignReadModel model,
        List<MilestoneReadModel> milestones)
    {
        return new WellboreDesignResponse(
            model.Id, model.Company, model.Project, model.Site,
            model.Well, model.Wellbore, model.Design,
            model.OwnerName, model.DesignType, model.Status,
            model.AggregateVersion, model.CreatedAt, model.UpdatedAt,
            milestones.Select(m => new MilestoneResponse(m.MilestoneType, m.OccurredAt)).ToList());
    }
}

public sealed class DuplicateWellboreDesignException(
    string company, string project, string site, string well, string wellbore, string design)
    : Exception($"A wellbore design already exists for Company={company}, Project={project}, Site={site}, Well={well}, Wellbore={wellbore}, Design={design}.")
{
    public string Company { get; } = company;
    public string Well { get; } = well;
}
