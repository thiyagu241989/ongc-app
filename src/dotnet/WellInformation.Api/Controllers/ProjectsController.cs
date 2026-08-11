using Microsoft.AspNetCore.Mvc;
using Confluent.Kafka;
using WellInformation.Application;

namespace WellInformation.Api.Controllers;

[ApiController]
[Route("api/v1/projects")]
public sealed class ProjectsController(IProjectService projectService) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType<ProjectResponse>(StatusCodes.Status202Accepted)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreateProjectRequest request,
        CancellationToken cancellationToken)
    {
        var errors = ProjectRequestValidator.Validate(request);
        if (errors.Count > 0)
        {
            return BadRequest(new ValidationProblemDetails(
                errors.ToDictionary(error => error.Key, error => error.Value)));
        }

        var correlationId = Request.Headers["X-Correlation-ID"].FirstOrDefault()
            ?? HttpContext.TraceIdentifier;
        var actor = User.Identity?.Name ?? "anonymous";

        try
        {
            var project = await projectService.CreateAsync(
                request,
                actor,
                correlationId,
                cancellationToken);
            Response.Headers.ETag = $"\"{project.Version}\"";
            return AcceptedAtAction(nameof(Get), new { projectId = project.ProjectId }, project);
        }
        catch (DuplicateProjectCodeException exception)
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Project code already exists",
                Detail = exception.Message
            });
        }
        catch (ProduceException<string, string> exception)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Status = StatusCodes.Status503ServiceUnavailable,
                Title = "Event broker unavailable",
                Detail = exception.Error.Reason
            });
        }
        catch (KafkaException exception)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Status = StatusCodes.Status503ServiceUnavailable,
                Title = "Event broker unavailable",
                Detail = exception.Message
            });
        }
    }

    [HttpGet("{projectId:guid}")]
    [ProducesResponseType<ProjectResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid projectId, CancellationToken cancellationToken)
    {
        var project = await projectService.GetAsync(projectId, cancellationToken);
        if (project is null)
        {
            return NotFound();
        }

        Response.Headers.ETag = $"\"{project.Version}\"";
        return Ok(project);
    }

    [HttpPut("{projectId:guid}")]
    [ProducesResponseType<ProjectResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status412PreconditionFailed)]
    [ProducesResponseType(StatusCodes.Status428PreconditionRequired)]
    public async Task<IActionResult> Update(
        Guid projectId,
        [FromBody] CreateProjectRequest request,
        CancellationToken cancellationToken)
    {
        var errors = ProjectRequestValidator.Validate(request);
        if (errors.Count > 0)
        {
            return BadRequest(new ValidationProblemDetails(
                errors.ToDictionary(error => error.Key, error => error.Value)));
        }

        if (!TryGetExpectedVersion(out var expectedVersion))
        {
            return StatusCode(StatusCodes.Status428PreconditionRequired, new ProblemDetails
            {
                Status = StatusCodes.Status428PreconditionRequired,
                Title = "A valid If-Match version is required"
            });
        }

        try
        {
            var project = await projectService.UpdateAsync(
                projectId,
                expectedVersion,
                request,
                GetActor(),
                GetCorrelationId(),
                cancellationToken);
            Response.Headers.ETag = $"\"{project.Version}\"";
            return Ok(project);
        }
        catch (ProjectNotFoundException)
        {
            return NotFound();
        }
        catch (ProjectVersionConflictException exception)
        {
            return StatusCode(StatusCodes.Status412PreconditionFailed, new ProblemDetails
            {
                Status = StatusCodes.Status412PreconditionFailed,
                Title = "Project version conflict",
                Detail = exception.Message
            });
        }
        catch (DuplicateProjectCodeException exception)
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Project code already exists",
                Detail = exception.Message
            });
        }
        catch (ProduceException<string, string> exception)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Status = StatusCodes.Status503ServiceUnavailable,
                Title = "Event broker unavailable",
                Detail = exception.Error.Reason
            });
        }
        catch (KafkaException exception)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Status = StatusCodes.Status503ServiceUnavailable,
                Title = "Event broker unavailable",
                Detail = exception.Message
            });
        }
    }

    [HttpDelete("{projectId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status412PreconditionFailed)]
    [ProducesResponseType(StatusCodes.Status428PreconditionRequired)]
    public async Task<IActionResult> Delete(Guid projectId, CancellationToken cancellationToken)
    {
        if (!TryGetExpectedVersion(out var expectedVersion))
        {
            return StatusCode(StatusCodes.Status428PreconditionRequired, new ProblemDetails
            {
                Status = StatusCodes.Status428PreconditionRequired,
                Title = "A valid If-Match version is required"
            });
        }

        try
        {
            await projectService.DeleteAsync(
                projectId,
                expectedVersion,
                GetActor(),
                GetCorrelationId(),
                cancellationToken);
            return NoContent();
        }
        catch (ProjectNotFoundException)
        {
            return NotFound();
        }
        catch (ProjectVersionConflictException exception)
        {
            return StatusCode(StatusCodes.Status412PreconditionFailed, new ProblemDetails
            {
                Status = StatusCodes.Status412PreconditionFailed,
                Title = "Project version conflict",
                Detail = exception.Message
            });
        }
        catch (ProduceException<string, string> exception)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Status = StatusCodes.Status503ServiceUnavailable,
                Title = "Event broker unavailable",
                Detail = exception.Error.Reason
            });
        }
        catch (KafkaException exception)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Status = StatusCodes.Status503ServiceUnavailable,
                Title = "Event broker unavailable",
                Detail = exception.Message
            });
        }
    }

    [HttpGet]
    [ProducesResponseType<IReadOnlyList<ProjectResponse>>(StatusCodes.Status200OK)]
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

        var projects = await projectService.ListAsync(
            search,
            status,
            page,
            pageSize,
            cancellationToken);
        return Ok(projects);
    }

    private string GetCorrelationId() =>
        Request.Headers["X-Correlation-ID"].FirstOrDefault() ?? HttpContext.TraceIdentifier;

    private string GetActor() => User.Identity?.Name ?? "anonymous";

    private bool TryGetExpectedVersion(out long expectedVersion)
    {
        var value = Request.Headers.IfMatch.FirstOrDefault()?.Trim().Trim('"');
        return long.TryParse(value, out expectedVersion) && expectedVersion >= 1;
    }
}