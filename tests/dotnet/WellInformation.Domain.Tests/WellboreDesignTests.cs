using WellInformation.Domain;

namespace WellInformation.Domain.Tests;

public sealed class WellboreDesignTests
{
    [Fact]
    public void Derive_returns_NotStarted_when_no_milestones()
    {
        var result = DesignStatuses.Derive([], DesignTypes.Standard);
        Assert.Equal(DesignStatuses.NotStarted, result);
    }

    [Fact]
    public void Derive_returns_DataReceived_for_early_milestones()
    {
        var milestones = new[] { MilestoneTypes.GnGDataReceived, MilestoneTypes.MdtConducted };
        var result = DesignStatuses.Derive(milestones, DesignTypes.Standard);
        Assert.Equal(DesignStatuses.DataReceived, result);
    }

    [Fact]
    public void Derive_returns_InProgress_when_design_initiated()
    {
        var milestones = new[] { MilestoneTypes.GnGDataReceived, MilestoneTypes.DesignInitiated };
        var result = DesignStatuses.Derive(milestones, DesignTypes.Standard);
        Assert.Equal(DesignStatuses.InProgress, result);
    }

    [Fact]
    public void Derive_returns_Completed_for_standard_at_level3()
    {
        var milestones = new[] { MilestoneTypes.GnGDataReceived, MilestoneTypes.ApprovalsLevel3 };
        var result = DesignStatuses.Derive(milestones, DesignTypes.Standard);
        Assert.Equal(DesignStatuses.Completed, result);
    }

    [Fact]
    public void Derive_returns_Completed_for_montage_at_level2()
    {
        var milestones = new[] { MilestoneTypes.GnGDataReceived, MilestoneTypes.ApprovalsLevel2 };
        var result = DesignStatuses.Derive(milestones, DesignTypes.Montage);
        Assert.Equal(DesignStatuses.Completed, result);
    }

    [Fact]
    public void MilestoneTypes_All_contains_11_entries()
    {
        Assert.Equal(11, MilestoneTypes.All.Count);
    }
}
