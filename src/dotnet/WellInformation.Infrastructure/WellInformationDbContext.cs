using Microsoft.EntityFrameworkCore;

namespace WellInformation.Infrastructure;

public sealed class WellInformationDbContext(DbContextOptions<WellInformationDbContext> options)
    : DbContext(options)
{
    public DbSet<WellboreDesignReadModel> WellboreDesignReadModels => Set<WellboreDesignReadModel>();
    public DbSet<MilestoneReadModel> MilestoneReadModels => Set<MilestoneReadModel>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var design = modelBuilder.Entity<WellboreDesignReadModel>();
        design.ToTable("wellbore_designs");
        design.HasKey(d => d.Id);
        design.Property(d => d.Id).HasColumnName("id");
        design.Property(d => d.Company).HasColumnName("company").HasMaxLength(100);
        design.Property(d => d.Project).HasColumnName("project").HasMaxLength(100);
        design.Property(d => d.Site).HasColumnName("site").HasMaxLength(100);
        design.Property(d => d.Well).HasColumnName("well").HasMaxLength(100);
        design.Property(d => d.Wellbore).HasColumnName("wellbore").HasMaxLength(100);
        design.Property(d => d.Design).HasColumnName("design").HasMaxLength(100);
        design.Property(d => d.OwnerName).HasColumnName("owner_name").HasMaxLength(100);
        design.Property(d => d.DesignType).HasColumnName("design_type").HasMaxLength(20);
        design.Property(d => d.Status).HasColumnName("status").HasMaxLength(20);
        design.Property(d => d.AggregateVersion).HasColumnName("aggregate_version");
        design.Property(d => d.SourceEventId).HasColumnName("source_event_id");
        design.Property(d => d.IsDeleted).HasColumnName("is_deleted");
        design.Property(d => d.CreatedAt).HasColumnName("created_at");
        design.Property(d => d.UpdatedAt).HasColumnName("updated_at");
        design.Property(d => d.EventOccurredAt).HasColumnName("event_occurred_at");
        design.Property(d => d.StoredAt).HasColumnName("stored_at");
        design.HasQueryFilter(d => !d.IsDeleted);

        var milestone = modelBuilder.Entity<MilestoneReadModel>();
        milestone.ToTable("milestones");
        milestone.HasKey(m => m.Id);
        milestone.Property(m => m.Id).HasColumnName("id");
        milestone.Property(m => m.WellboreDesignId).HasColumnName("wellbore_design_id");
        milestone.Property(m => m.MilestoneType).HasColumnName("milestone_type").HasMaxLength(50);
        milestone.Property(m => m.OccurredAt).HasColumnName("occurred_at");
        milestone.Property(m => m.SourceEventId).HasColumnName("source_event_id");
        milestone.Property(m => m.CreatedAt).HasColumnName("created_at");
    }
}
