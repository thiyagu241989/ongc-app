using Confluent.Kafka;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using WellInformation.Application;

namespace WellInformation.Infrastructure;

public sealed class WellboreDesignReadModel
{
    public Guid Id { get; set; }
    public string Company { get; set; } = string.Empty;
    public string Project { get; set; } = string.Empty;
    public string Site { get; set; } = string.Empty;
    public string Well { get; set; } = string.Empty;
    public string Wellbore { get; set; } = string.Empty;
    public string Design { get; set; } = string.Empty;
    public string OwnerName { get; set; } = string.Empty;
    public string DesignType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public long AggregateVersion { get; set; }
    public Guid SourceEventId { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset EventOccurredAt { get; set; }
    public DateTimeOffset StoredAt { get; set; }
}

public sealed class MilestoneReadModel
{
    public Guid Id { get; set; }
    public Guid WellboreDesignId { get; set; }
    public string MilestoneType { get; set; } = string.Empty;
    public DateTimeOffset OccurredAt { get; set; }
    public Guid SourceEventId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class ProjectReadModel
{
    public Guid ProjectId { get; set; }
    public string ProjectCode { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;
    public string WellName { get; set; } = string.Empty;
    public string? OperatorName { get; set; }
    public string? FieldName { get; set; }
    public string? Basin { get; set; }
    public string? Location { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateOnly? PlannedStartDate { get; set; }
    public DateOnly? PlannedEndDate { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public long AggregateVersion { get; set; }
    public Guid SourceEventId { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public DateTimeOffset EventOccurredAt { get; set; }
    public DateTimeOffset ProjectedAt { get; set; }
}

public sealed class WellInformationDbContext(DbContextOptions<WellInformationDbContext> options)
    : DbContext(options)
{
    public DbSet<ProjectReadModel> ProjectReadModels => Set<ProjectReadModel>();
    public DbSet<WellboreDesignReadModel> WellboreDesignReadModels => Set<WellboreDesignReadModel>();
    public DbSet<MilestoneReadModel> MilestoneReadModels => Set<MilestoneReadModel>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var readModel = modelBuilder.Entity<ProjectReadModel>();
        readModel.ToTable("projects");
        readModel.HasKey(value => value.ProjectId).HasName("projects_pkey");
        readModel.Property(value => value.ProjectId).HasColumnName("project_id");
        readModel.Property(value => value.ProjectCode).HasColumnName("project_code").HasMaxLength(50);
        readModel.Property(value => value.ProjectName).HasColumnName("project_name").HasMaxLength(200);
        readModel.Property(value => value.WellName).HasColumnName("well_name").HasMaxLength(200);
        readModel.Property(value => value.OperatorName).HasColumnName("operator_name").HasMaxLength(200);
        readModel.Property(value => value.FieldName).HasColumnName("field_name").HasMaxLength(200);
        readModel.Property(value => value.Basin).HasColumnName("basin").HasMaxLength(150);
        readModel.Property(value => value.Location).HasColumnName("location").HasMaxLength(300);
        readModel.Property(value => value.Status).HasColumnName("status").HasMaxLength(30);
        readModel.Property(value => value.Description).HasColumnName("description");
        readModel.Property(value => value.PlannedStartDate).HasColumnName("planned_start_date");
        readModel.Property(value => value.PlannedEndDate).HasColumnName("planned_end_date");
        readModel.Property(value => value.Latitude).HasColumnName("latitude").HasPrecision(9, 6);
        readModel.Property(value => value.Longitude).HasColumnName("longitude").HasPrecision(9, 6);
        readModel.Property(value => value.AggregateVersion).HasColumnName("aggregate_version");
        readModel.Property(value => value.SourceEventId).HasColumnName("source_event_id");
        readModel.Property(value => value.IsDeleted).HasColumnName("is_deleted");
        readModel.Property(value => value.CreatedAt).HasColumnName("created_at");
        readModel.Property(value => value.UpdatedAt).HasColumnName("updated_at");
        readModel.Property(value => value.DeletedAt).HasColumnName("deleted_at");
        readModel.Property(value => value.EventOccurredAt).HasColumnName("event_occurred_at");
        readModel.Property(value => value.ProjectedAt).HasColumnName("stored_at");
        readModel.HasQueryFilter(value => !value.IsDeleted);

        var wdModel = modelBuilder.Entity<WellboreDesignReadModel>();
        wdModel.ToTable("wellbore_designs");
        wdModel.HasKey(d => d.Id);
        wdModel.Property(d => d.Id).HasColumnName("id");
        wdModel.Property(d => d.Company).HasColumnName("company").HasMaxLength(100);
        wdModel.Property(d => d.Project).HasColumnName("project").HasMaxLength(100);
        wdModel.Property(d => d.Site).HasColumnName("site").HasMaxLength(100);
        wdModel.Property(d => d.Well).HasColumnName("well").HasMaxLength(100);
        wdModel.Property(d => d.Wellbore).HasColumnName("wellbore").HasMaxLength(100);
        wdModel.Property(d => d.Design).HasColumnName("design").HasMaxLength(100);
        wdModel.Property(d => d.OwnerName).HasColumnName("owner_name").HasMaxLength(100);
        wdModel.Property(d => d.DesignType).HasColumnName("design_type").HasMaxLength(20);
        wdModel.Property(d => d.Status).HasColumnName("status").HasMaxLength(20);
        wdModel.Property(d => d.AggregateVersion).HasColumnName("aggregate_version");
        wdModel.Property(d => d.SourceEventId).HasColumnName("source_event_id");
        wdModel.Property(d => d.IsDeleted).HasColumnName("is_deleted");
        wdModel.Property(d => d.CreatedAt).HasColumnName("created_at");
        wdModel.Property(d => d.UpdatedAt).HasColumnName("updated_at");
        wdModel.Property(d => d.EventOccurredAt).HasColumnName("event_occurred_at");
        wdModel.Property(d => d.StoredAt).HasColumnName("stored_at");
        wdModel.HasQueryFilter(d => !d.IsDeleted);

        var msModel = modelBuilder.Entity<MilestoneReadModel>();
        msModel.ToTable("milestones");
        msModel.HasKey(m => m.Id);
        msModel.Property(m => m.Id).HasColumnName("id");
        msModel.Property(m => m.WellboreDesignId).HasColumnName("wellbore_design_id");
        msModel.Property(m => m.MilestoneType).HasColumnName("milestone_type").HasMaxLength(50);
        msModel.Property(m => m.OccurredAt).HasColumnName("occurred_at");
        msModel.Property(m => m.SourceEventId).HasColumnName("source_event_id");
        msModel.Property(m => m.CreatedAt).HasColumnName("created_at");
    }
}

public static class InfrastructureRegistration
{
    public static IServiceCollection AddWellInformationInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("WellInformationDB")
            ?? throw new InvalidOperationException("ConnectionStrings:WellInformationDB is required.");

        services.AddDbContextFactory<WellInformationDbContext>(options => options.UseNpgsql(connectionString));
        services.AddScoped(serviceProvider =>
            serviceProvider.GetRequiredService<IDbContextFactory<WellInformationDbContext>>()
                .CreateDbContext());
        services.AddSingleton<IProducer<string, string>>(_ =>
        {
            var bootstrapServers = configuration["Kafka:BootstrapServers"]
                ?? throw new InvalidOperationException("Kafka:BootstrapServers is required.");
            return new ProducerBuilder<string, string>(new ProducerConfig
            {
                BootstrapServers = bootstrapServers,
                Acks = Acks.All,
                EnableIdempotence = true,
                MessageSendMaxRetries = 5
            }).Build();
        });
        services.AddScoped<IProjectService, KafkaProjectService>();
        services.AddScoped<IWellboreDesignService, KafkaWellboreDesignService>();
        return services;
    }
}