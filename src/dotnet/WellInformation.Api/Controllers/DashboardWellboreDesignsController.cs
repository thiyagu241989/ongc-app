using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WellInformation.Domain;
using WellInformation.Infrastructure;

namespace WellInformation.Api.Controllers;

[ApiController]
[Route("api/v1/dashboard/insight")]
public sealed class DashboardWellboreDesignsController(WellInformationDbContext dbContext) : ControllerBase
{
    [HttpGet("progress-timeline")]
    public async Task<IActionResult> ProgressTimeline(
        [FromQuery] string? company,
        [FromQuery] string? well,
        [FromQuery] string? status,
        [FromQuery] string? owner,
        [FromQuery] string? sort,
        [FromQuery] int limit = 10,
        CancellationToken cancellationToken = default)
    {
        var designs = await QueryDesigns(company, well, status, owner, cancellationToken);
        var designIds = designs.Select(d => d.Id).ToList();

        var milestones = await dbContext.MilestoneReadModels
            .AsNoTracking()
            .Where(m => designIds.Contains(m.WellboreDesignId))
            .ToListAsync(cancellationToken);

        var milestonesByDesign = milestones
            .GroupBy(m => m.WellboreDesignId)
            .ToDictionary(g => g.Key, g => g.OrderBy(m => m.OccurredAt).ToList());

        var results = designs.Select(d =>
        {
            var ms = milestonesByDesign.GetValueOrDefault(d.Id) ?? [];
            var firstDate = ms.FirstOrDefault()?.OccurredAt;
            var lastDate = ms.LastOrDefault()?.OccurredAt;
            var totalDays = firstDate.HasValue && lastDate.HasValue
                ? (lastDate.Value - firstDate.Value).TotalDays : 0;

            var segments = new List<object>();
            for (var i = 1; i < ms.Count; i++)
            {
                segments.Add(new
                {
                    from = ms[i - 1].MilestoneType,
                    to = ms[i].MilestoneType,
                    days = Math.Round((ms[i].OccurredAt - ms[i - 1].OccurredAt).TotalDays, 2)
                });
            }

            return new
            {
                d.Id,
                d.Well,
                d.Wellbore,
                d.Design,
                d.OwnerName,
                d.Status,
                totalDays = Math.Round(totalDays, 2),
                milestoneCount = ms.Count,
                segments
            };
        }).ToList();

        results = sort?.ToLowerInvariant() switch
        {
            "alpha" => results.OrderBy(r => r.Well).ThenBy(r => r.Wellbore).ToList(),
            "recent" => results.OrderByDescending(r => r.totalDays == 0 ? DateTimeOffset.MinValue :
                milestonesByDesign.GetValueOrDefault(r.Id)?.LastOrDefault()?.OccurredAt ?? DateTimeOffset.MinValue).ToList(),
            _ => results.OrderByDescending(r => r.totalDays).ToList()
        };

        return Ok(new
        {
            total = results.Count,
            items = limit > 0 ? results.Take(limit).ToList() : results
        });
    }

    [HttpGet("well-register")]
    public async Task<IActionResult> WellRegister(
        [FromQuery] string? company,
        [FromQuery] string? well,
        [FromQuery] string? status,
        [FromQuery] string? owner,
        [FromQuery] string? sort,
        CancellationToken cancellationToken = default)
    {
        var designs = await QueryDesigns(company, well, status, owner, cancellationToken);
        var designIds = designs.Select(d => d.Id).ToList();

        var milestones = await dbContext.MilestoneReadModels
            .AsNoTracking()
            .Where(m => designIds.Contains(m.WellboreDesignId))
            .ToListAsync(cancellationToken);

        var milestonesByDesign = milestones
            .GroupBy(m => m.WellboreDesignId)
            .ToDictionary(g => g.Key, g => g.OrderBy(m => m.OccurredAt).ToList());

        var results = designs.Select(d =>
        {
            var ms = milestonesByDesign.GetValueOrDefault(d.Id) ?? [];
            var currentMs = ms.LastOrDefault();
            var firstDate = ms.FirstOrDefault()?.OccurredAt;
            var lastDate = currentMs?.OccurredAt;
            var totalDays = firstDate.HasValue && lastDate.HasValue
                ? Math.Round((lastDate.Value - firstDate.Value).TotalDays, 0) : 0;

            var totalRequired = d.DesignType == DesignTypes.Montage ? 10 : 11;
            var percentComplete = totalRequired > 0
                ? Math.Round((double)ms.Count / totalRequired * 100, 0) : 0;

            var approvalLevel = ms.Any(m => m.MilestoneType == MilestoneTypes.ApprovalsLevel3) ? "Completed"
                : ms.Any(m => m.MilestoneType == MilestoneTypes.ApprovalsLevel2) ? "Level 2"
                : ms.Any(m => m.MilestoneType == MilestoneTypes.ApprovalsLevel1) ? "Level 1"
                : ms.Any(m => m.MilestoneType == MilestoneTypes.ApprovalsInitiated) ? "Initiated"
                : "Not started";

            return new
            {
                asset = d.Site,
                wellWellbore = $"{d.Well}/{d.Wellbore}",
                user = d.OwnerName,
                currentMilestone = currentMs?.MilestoneType ?? "Not started",
                dateTime = currentMs?.OccurredAt,
                approvalLevel,
                status = d.Status,
                days = totalDays,
                percentComplete
            };
        }).ToList();

        results = sort?.ToLowerInvariant() switch
        {
            "alpha" => results.OrderBy(r => r.wellWellbore).ToList(),
            "recent" => results.OrderByDescending(r => r.dateTime ?? DateTimeOffset.MinValue).ToList(),
            _ => results.OrderByDescending(r => r.days).ToList()
        };

        return Ok(results);
    }

    [HttpGet("approval-tracking")]
    public async Task<IActionResult> ApprovalTracking(
        [FromQuery] string? company,
        [FromQuery] string? well,
        [FromQuery] string? status,
        [FromQuery] string? owner,
        CancellationToken cancellationToken = default)
    {
        var designs = await QueryDesigns(company, well, status, owner, cancellationToken);
        var designIds = designs.Select(d => d.Id).ToList();

        var milestones = await dbContext.MilestoneReadModels
            .AsNoTracking()
            .Where(m => designIds.Contains(m.WellboreDesignId))
            .ToListAsync(cancellationToken);

        var milestonesByDesign = milestones
            .GroupBy(m => m.WellboreDesignId)
            .ToDictionary(g => g.Key, g => g.ToDictionary(m => m.MilestoneType, m => m.OccurredAt));

        var results = designs
            .Where(d => milestonesByDesign.ContainsKey(d.Id))
            .Select(d =>
            {
                var ms = milestonesByDesign[d.Id];
                ms.TryGetValue(MilestoneTypes.ApprovalsInitiated, out var initiated);
                ms.TryGetValue(MilestoneTypes.ApprovalsLevel1, out var l1);
                ms.TryGetValue(MilestoneTypes.ApprovalsLevel2, out var l2);
                ms.TryGetValue(MilestoneTypes.ApprovalsLevel3, out var l3);

                return new
                {
                    wellWellbore = $"{d.Well}/{d.Wellbore}",
                    d.OwnerName,
                    d.Status,
                    initiatedAt = initiated,
                    daysLevel1 = initiated.HasValue() && l1.HasValue()
                        ? Math.Round((l1 - initiated).TotalDays, 2) : (double?)null,
                    daysLevel2 = l1.HasValue() && l2.HasValue()
                        ? Math.Round((l2 - l1).TotalDays, 2) : (double?)null,
                    daysLevel3 = l2.HasValue() && l3.HasValue()
                        ? Math.Round((l3 - l2).TotalDays, 2) : (double?)null,
                    totalApprovalDays = initiated.HasValue()
                        ? Math.Round(((l3.HasValue() ? l3 : l2.HasValue() ? l2 : l1.HasValue() ? l1 : initiated) - initiated).TotalDays, 2)
                        : (double?)null
                };
            })
            .OrderByDescending(r => r.totalApprovalDays)
            .ToList();

        return Ok(results);
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary(
        [FromQuery] string? company,
        [FromQuery] string? well,
        [FromQuery] string? status,
        [FromQuery] string? owner,
        CancellationToken cancellationToken = default)
    {
        var designs = await QueryDesigns(company, well, status, owner, cancellationToken);
        var designIds = designs.Select(d => d.Id).ToList();

        var milestones = await dbContext.MilestoneReadModels
            .AsNoTracking()
            .Where(m => designIds.Contains(m.WellboreDesignId))
            .ToListAsync(cancellationToken);

        var milestonesByDesign = milestones
            .GroupBy(m => m.WellboreDesignId)
            .ToDictionary(g => g.Key, g => g.OrderBy(m => m.OccurredAt).ToList());

        var completedDesigns = designs.Where(d => d.Status == DesignStatuses.Completed).ToList();
        var completedDays = completedDesigns.Select(d =>
        {
            var ms = milestonesByDesign.GetValueOrDefault(d.Id) ?? [];
            if (ms.Count < 2) return 0.0;
            return (ms.Last().OccurredAt - ms.First().OccurredAt).TotalDays;
        }).Where(d => d > 0).ToList();

        return Ok(new
        {
            totalDesigns = designs.Count,
            completed = designs.Count(d => d.Status == DesignStatuses.Completed),
            inProgress = designs.Count(d => d.Status == DesignStatuses.InProgress),
            dataReceived = designs.Count(d => d.Status == DesignStatuses.DataReceived),
            notStarted = designs.Count(d => d.Status == DesignStatuses.NotStarted),
            avgDaysToComplete = completedDays.Count > 0 ? Math.Round(completedDays.Average(), 1) : 0,
            minDaysToComplete = completedDays.Count > 0 ? Math.Round(completedDays.Min(), 1) : 0,
            maxDaysToComplete = completedDays.Count > 0 ? Math.Round(completedDays.Max(), 1) : 0
        });
    }

    private async Task<List<WellboreDesignReadModel>> QueryDesigns(
        string? company, string? well, string? status, string? owner,
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

        return await query.OrderByDescending(d => d.UpdatedAt).ToListAsync(cancellationToken);
    }
}

file static class DateTimeOffsetExtensions
{
    public static bool HasValue(this DateTimeOffset value) => value != default;
}
