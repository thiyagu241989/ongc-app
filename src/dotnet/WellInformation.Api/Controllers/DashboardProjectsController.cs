using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WellInformation.Infrastructure;

namespace WellInformation.Api.Controllers;

[ApiController]
[Route("api/v1/dashboard/projects")]
public sealed class DashboardProjectsController(WellInformationDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        if (page < 1 || pageSize is < 1 or > 100)
        {
            return BadRequest(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                [nameof(page)] = ["Page must be at least 1."],
                [nameof(pageSize)] = ["Page size must be between 1 and 100."]
            }));
        }

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
            .Select(value => new
            {
                value.ProjectId,
                value.ProjectCode,
                value.ProjectName,
                value.WellName,
                value.OperatorName,
                value.FieldName,
                value.Basin,
                value.Location,
                value.Status,
                value.Description,
                value.PlannedStartDate,
                value.PlannedEndDate,
                value.Latitude,
                value.Longitude,
                Version = value.AggregateVersion,
                value.SourceEventId,
                value.CreatedAt,
                value.UpdatedAt,
                value.EventOccurredAt,
                StoredAt = value.ProjectedAt
            })
            .ToListAsync(cancellationToken);
        return Ok(projects);
    }

    [HttpGet("{projectId:guid}")]
    public async Task<IActionResult> Get(Guid projectId, CancellationToken cancellationToken)
    {
        var project = await dbContext.ProjectReadModels
            .AsNoTracking()
            .Where(value => value.ProjectId == projectId)
            .Select(value => new
            {
                value.ProjectId,
                value.ProjectCode,
                value.ProjectName,
                value.WellName,
                value.OperatorName,
                value.FieldName,
                value.Basin,
                value.Location,
                value.Status,
                value.Description,
                value.PlannedStartDate,
                value.PlannedEndDate,
                value.Latitude,
                value.Longitude,
                Version = value.AggregateVersion,
                value.SourceEventId,
                value.CreatedAt,
                value.UpdatedAt,
                value.EventOccurredAt,
                StoredAt = value.ProjectedAt
            })
            .SingleOrDefaultAsync(cancellationToken);

        return project is null ? NotFound() : Ok(project);
    }
}