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
  "Approvals Level 3"
] as const;

export const milestoneTypeSchema = z.enum(milestoneTypes);

export const designTypeSchema = z.enum(["Standard", "Montage"]);

const milestoneEntrySchema = z
  .object({
    milestoneType: milestoneTypeSchema,
    occurredAt: z.iso.datetime({ offset: true })
  })
  .strict();

const wellboreDesignCreatedDataSchema = z
  .object({
    wellboreDesignId: z.uuid(),
    company: z.string().min(1).max(100),
    project: z.string().min(1).max(100),
    site: z.string().min(1).max(100),
    well: z.string().min(1).max(100),
    wellbore: z.string().min(1).max(100),
    design: z.string().min(1).max(100),
    ownerName: z.string().min(1).max(100),
    designType: designTypeSchema,
    milestones: z.array(milestoneEntrySchema),
    createdAtUtc: z.iso.datetime({ offset: true })
  })
  .strict();

const milestoneRecordedDataSchema = z
  .object({
    wellboreDesignId: z.uuid(),
    milestoneType: milestoneTypeSchema,
    occurredAt: z.iso.datetime({ offset: true }),
    recordedAtUtc: z.iso.datetime({ offset: true })
  })
  .strict();

export const wellboreDesignCreatedEnvelopeSchema = z
  .object({
    eventId: z.uuid(),
    eventType: z.literal("WellboreDesignCreated"),
    eventVersion: z.literal(1),
    aggregateType: z.literal("WellboreDesign"),
    aggregateId: z.uuid(),
    aggregateVersion: z.number().int().positive(),
    occurredAtUtc: z.iso.datetime({ offset: true }),
    correlationId: z.string().min(1),
    causationId: z.string().nullable(),
    producer: z.literal("well-information-api"),
    data: wellboreDesignCreatedDataSchema
  })
  .strict()
  .superRefine((event, context) => {
    if (event.aggregateId !== event.data.wellboreDesignId) {
      context.addIssue({
        code: "custom",
        message: "aggregateId must equal data.wellboreDesignId",
        path: ["aggregateId"]
      });
    }
  });

export const milestoneRecordedEnvelopeSchema = z
  .object({
    eventId: z.uuid(),
    eventType: z.literal("MilestoneRecorded"),
    eventVersion: z.literal(1),
    aggregateType: z.literal("WellboreDesign"),
    aggregateId: z.uuid(),
    aggregateVersion: z.number().int().positive(),
    occurredAtUtc: z.iso.datetime({ offset: true }),
    correlationId: z.string().min(1),
    causationId: z.string().nullable(),
    producer: z.literal("well-information-api"),
    data: milestoneRecordedDataSchema
  })
  .strict()
  .superRefine((event, context) => {
    if (event.aggregateId !== event.data.wellboreDesignId) {
      context.addIssue({
        code: "custom",
        message: "aggregateId must equal data.wellboreDesignId",
        path: ["aggregateId"]
      });
    }
  });

const wellboreDesignEventSchema = z.union([
  wellboreDesignCreatedEnvelopeSchema,
  milestoneRecordedEnvelopeSchema
]);

export type WellboreDesignEventEnvelope = z.infer<typeof wellboreDesignEventSchema>;
export type WellboreDesignCreatedEnvelope = z.infer<typeof wellboreDesignCreatedEnvelopeSchema>;
export type MilestoneRecordedEnvelope = z.infer<typeof milestoneRecordedEnvelopeSchema>;

export function parseWellboreDesignEvent(payload: string): WellboreDesignEventEnvelope {
  const parsed: unknown = JSON.parse(payload);
  return wellboreDesignEventSchema.parse(parsed);
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
