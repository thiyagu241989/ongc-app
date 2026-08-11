using WellInformation.Application;
using WellInformation.Domain;

namespace WellInformation.Domain.Tests;

public sealed class ProjectTests
{
    [Fact]
    public void Create_InitializesVersionAndAuditFields()
    {
        var projectId = Guid.NewGuid();
        var now = DateTimeOffset.Parse("2026-08-06T10:15:30Z");

        var project = Project.Create(
            projectId,
            "ONGC-PRJ-001",
            "Western Offshore Development",
            "WO-Alpha-01",
            "ONGC",
            null,
            null,
            null,
            ProjectStatuses.Draft,
            null,
            null,
            null,
            null,
            null,
            "test-user",
            now);

        Assert.Equal(projectId, project.ProjectId);
        Assert.Equal(1, project.AggregateVersion);
        Assert.False(project.IsDeleted);
        Assert.Equal(now, project.CreatedAt);
        Assert.Equal(now, project.UpdatedAt);
        Assert.Equal("test-user", project.CreatedBy);
    }

    [Fact]
    public void Validate_RejectsInvalidCrossFieldValues()
    {
        var request = new CreateProjectRequest(
            "bad code",
            "Project",
            "Well",
            null,
            null,
            null,
            null,
            "Unknown",
            null,
            new DateOnly(2026, 9, 2),
            new DateOnly(2026, 9, 1),
            91,
            181);

        var errors = ProjectRequestValidator.Validate(request);

        Assert.Contains(nameof(request.ProjectCode), errors.Keys);
        Assert.Contains(nameof(request.Status), errors.Keys);
        Assert.Contains(nameof(request.PlannedEndDate), errors.Keys);
        Assert.Contains(nameof(request.Latitude), errors.Keys);
        Assert.Contains(nameof(request.Longitude), errors.Keys);
    }

    [Fact]
    public void Update_IncrementsVersionAndChangesMutableFields()
    {
        var createdAt = DateTimeOffset.Parse("2026-08-06T10:15:30Z");
        var updatedAt = createdAt.AddHours(1);
        var project = CreateProject(createdAt);

        project.Update(
            "ONGC-PRJ-001",
            "Updated Project",
            "WO-Alpha-01",
            "ONGC",
            null,
            null,
            null,
            ProjectStatuses.Active,
            null,
            null,
            null,
            null,
            null,
            "updater",
            updatedAt);

        Assert.Equal(2, project.AggregateVersion);
        Assert.Equal("Updated Project", project.ProjectName);
        Assert.Equal(ProjectStatuses.Active, project.Status);
        Assert.Equal(updatedAt, project.UpdatedAt);
        Assert.Equal("updater", project.UpdatedBy);
    }

    [Fact]
    public void Delete_SoftDeletesAndIncrementsVersion()
    {
        var createdAt = DateTimeOffset.Parse("2026-08-06T10:15:30Z");
        var deletedAt = createdAt.AddHours(2);
        var project = CreateProject(createdAt);

        project.Delete("deleter", deletedAt);

        Assert.True(project.IsDeleted);
        Assert.Equal(2, project.AggregateVersion);
        Assert.Equal(deletedAt, project.DeletedAt);
        Assert.Equal("deleter", project.UpdatedBy);
    }

    private static Project CreateProject(DateTimeOffset now) => Project.Create(
        Guid.NewGuid(),
        "ONGC-PRJ-001",
        "Western Offshore Development",
        "WO-Alpha-01",
        "ONGC",
        null,
        null,
        null,
        ProjectStatuses.Draft,
        null,
        null,
        null,
        null,
        null,
        "creator",
        now);
}