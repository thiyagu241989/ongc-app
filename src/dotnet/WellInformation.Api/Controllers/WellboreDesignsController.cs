using Microsoft.AspNetCore.Mvc;
using Confluent.Kafka;
using WellInformation.Application;
using WellInformation.Infrastructure;

namespace WellInformation.Api.Controllers;

[ApiController]
[Route("api/v1/wellbore-designs")]
public sealed class WellboreDesignsController(IWellboreDesignService service) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType<WellboreDesignResponse>(StatusCodes.Status202Accepted)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreateWellboreDesignRequest request,
        CancellationToken cancellationToken)
    {
        var errors = WellboreDesignRequestValidator.Validate(request);
        if (errors.Count > 0)
        {
            return BadRequest(new ValidationProblemDetails(
                errors.ToDictionary(e => e.Key, e => e.Value)));
        }

        var correlationId = Request.Headers["X-Correlation-ID"].FirstOrDefault()
            ?? HttpContext.TraceIdentifier;

        try
        {
            var response = await service.CreateAsync(request, correlationId, cancellationToken);
            return AcceptedAtAction(nameof(Get), new { id = response.Id }, response);
        }
        catch (DuplicateWellboreDesignException ex)
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Wellbore design already exists",
                Detail = ex.Message
            });
        }
        catch (ProduceException<string, string> ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Status = StatusCodes.Status503ServiceUnavailable,
                Title = "Event broker unavailable",
                Detail = ex.Error.Reason
            });
        }
        catch (KafkaException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Status = StatusCodes.Status503ServiceUnavailable,
                Title = "Event broker unavailable",
                Detail = ex.Message
            });
        }
    }

    [HttpPost("{id:guid}/milestones")]
    [ProducesResponseType<WellboreDesignResponse>(StatusCodes.Status202Accepted)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RecordMilestone(
        Guid id,
        [FromBody] RecordMilestoneRequest request,
        CancellationToken cancellationToken)
    {
        var errors = WellboreDesignRequestValidator.Validate(request);
        if (errors.Count > 0)
        {
            return BadRequest(new ValidationProblemDetails(
                errors.ToDictionary(e => e.Key, e => e.Value)));
        }

        var correlationId = Request.Headers["X-Correlation-ID"].FirstOrDefault()
            ?? HttpContext.TraceIdentifier;

        try
        {
            var response = await service.RecordMilestoneAsync(id, request, correlationId, cancellationToken);
            return AcceptedAtAction(nameof(Get), new { id = response.Id }, response);
        }
        catch (WellboreDesignNotFoundException)
        {
            return NotFound();
        }
        catch (ProduceException<string, string> ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Status = StatusCodes.Status503ServiceUnavailable,
                Title = "Event broker unavailable",
                Detail = ex.Error.Reason
            });
        }
        catch (KafkaException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Status = StatusCodes.Status503ServiceUnavailable,
                Title = "Event broker unavailable",
                Detail = ex.Message
            });
        }
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType<WellboreDesignResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var response = await service.GetAsync(id, cancellationToken);
        return response is null ? NotFound() : Ok(response);
    }

    [HttpGet]
    [ProducesResponseType<IReadOnlyList<WellboreDesignResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] string? company,
        [FromQuery] string? well,
        [FromQuery] string? status,
        [FromQuery] string? owner,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 1;
        if (pageSize > 100) pageSize = 100;

        var results = await service.ListAsync(company, well, status, owner, page, pageSize, cancellationToken);
        return Ok(results);
    }
}
