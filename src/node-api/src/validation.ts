import { z } from "zod";

export const milestoneTypes = [
  "GnG data received",
  "MDT conducted",
  "Design initiated",
  "Sent to DFS",
  "Received from DFS",
  "Sent to cementing team",
  "Received from cementing team",
  "Approvals initiated",
  "Approvals Level 1",
  "Approvals Level 2",
  "Approvals Level 3",
] as const;

export const designTypes = ["Standard", "Montage"] as const;

const milestoneRequestSchema = z
  .object({
    milestoneType: z.enum(milestoneTypes),
    occurredAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const createWellboreDesignSchema = z
  .object({
    company: z.string().min(1, "Company is required.").max(100, "Company must not exceed 100 characters."),
    project: z.string().min(1, "Project is required.").max(100, "Project must not exceed 100 characters."),
    site: z.string().min(1, "Site is required.").max(100, "Site must not exceed 100 characters."),
    well: z.string().min(1, "Well is required.").max(100, "Well must not exceed 100 characters."),
    wellbore: z.string().min(1, "Wellbore is required.").max(100, "Wellbore must not exceed 100 characters."),
    design: z.string().min(1, "Design is required.").max(100, "Design must not exceed 100 characters."),
    ownerName: z.string().min(1, "OwnerName is required.").max(100, "OwnerName must not exceed 100 characters."),
    designType: z.enum(designTypes, {
      message: `DesignType must be one of: ${designTypes.join(", ")}.`,
    }),
    milestones: z.array(milestoneRequestSchema).optional().default([]),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.milestones.length > 0) {
      // Validate no duplicate milestone types
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const m of data.milestones) {
        if (seen.has(m.milestoneType)) {
          duplicates.push(m.milestoneType);
        }
        seen.add(m.milestoneType);
      }
      if (duplicates.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate milestone types: ${[...new Set(duplicates)].join(", ")}.`,
          path: ["Milestones"],
        });
      }
    }
  });

export const recordMilestoneSchema = z
  .object({
    milestoneType: z.enum(milestoneTypes, {
      message: `MilestoneType must be one of: ${milestoneTypes.join(", ")}.`,
    }),
    occurredAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type CreateWellboreDesignRequest = z.infer<typeof createWellboreDesignSchema>;
export type RecordMilestoneRequest = z.infer<typeof recordMilestoneSchema>;

export function formatValidationErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "Request";
    if (!errors[key]) errors[key] = [];
    errors[key].push(issue.message);
  }
  return errors;
}

export function deriveStatus(milestoneTypes: string[], designType: string): string {
  if (milestoneTypes.length === 0) return "Not started";

  const finalApproval =
    designType === "Montage" ? "Approvals Level 2" : "Approvals Level 3";

  if (milestoneTypes.includes(finalApproval)) return "Completed";

  if (
    milestoneTypes.includes("Design initiated") ||
    milestoneTypes.includes("Approvals initiated") ||
    milestoneTypes.includes("Approvals Level 1") ||
    milestoneTypes.includes("Approvals Level 2")
  )
    return "In progress";

  return "Data received";
}
