import { z } from "zod";

const projectStatusSchema = z.enum(["Draft", "Active", "OnHold", "Completed", "Cancelled"]);

const projectSnapshotDataSchema = z
  .object({
    projectId: z.uuid(),
    projectCode: z.string().min(3).max(50),
    projectName: z.string().min(1).max(200),
    wellName: z.string().min(1).max(200),
    operatorName: z.string().max(200).nullable(),
    fieldName: z.string().max(200).nullable(),
    basin: z.string().max(150).nullable(),
    location: z.string().max(300).nullable(),
    status: projectStatusSchema,
    description: z.string().nullable(),
    plannedStartDate: z.iso.date().nullable(),
    plannedEndDate: z.iso.date().nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    createdAtUtc: z.iso.datetime({ offset: true }),
    createdBy: z.string().min(1).max(100)
  })
  .strict();

const projectUpdatedDataSchema = projectSnapshotDataSchema.extend({
  updatedAtUtc: z.iso.datetime({ offset: true }),
  updatedBy: z.string().min(1).max(100)
});

export const projectCreatedEnvelopeSchema = z
  .object({
    eventId: z.uuid(),
    eventType: z.literal("ProjectCreated"),
    eventVersion: z.literal(1),
    aggregateType: z.literal("Project"),
    aggregateId: z.uuid(),
    aggregateVersion: z.number().int().positive(),
    occurredAtUtc: z.iso.datetime({ offset: true }),
    correlationId: z.string().min(1),
    causationId: z.string().nullable(),
    producer: z.literal("well-information-api"),
    data: projectSnapshotDataSchema
  })
  .strict()
  .superRefine((event, context) => {
    if (event.aggregateId !== event.data.projectId) {
      context.addIssue({
        code: "custom",
        message: "aggregateId must equal data.projectId",
        path: ["aggregateId"]
      });
    }
  });

export const projectUpdatedEnvelopeSchema = z
  .object({
    eventId: z.uuid(),
    eventType: z.literal("ProjectUpdated"),
    eventVersion: z.literal(1),
    aggregateType: z.literal("Project"),
    aggregateId: z.uuid(),
    aggregateVersion: z.number().int().positive(),
    occurredAtUtc: z.iso.datetime({ offset: true }),
    correlationId: z.string().min(1),
    causationId: z.string().nullable(),
    producer: z.literal("well-information-api"),
    data: projectUpdatedDataSchema
  })
  .strict()
  .superRefine((event, context) => {
    if (event.aggregateId !== event.data.projectId) {
      context.addIssue({
        code: "custom",
        message: "aggregateId must equal data.projectId",
        path: ["aggregateId"]
      });
    }
  });

export const projectDeletedEnvelopeSchema = z
  .object({
    eventId: z.uuid(),
    eventType: z.literal("ProjectDeleted"),
    eventVersion: z.literal(1),
    aggregateType: z.literal("Project"),
    aggregateId: z.uuid(),
    aggregateVersion: z.number().int().positive(),
    occurredAtUtc: z.iso.datetime({ offset: true }),
    correlationId: z.string().min(1),
    causationId: z.string().nullable(),
    producer: z.literal("well-information-api"),
    data: z
      .object({
        projectId: z.uuid(),
        projectCode: z.string().min(3).max(50),
        deletedAtUtc: z.iso.datetime({ offset: true }),
        deletedBy: z.string().min(1).max(100)
      })
      .strict()
  })
  .strict()
  .superRefine((event, context) => {
    if (event.aggregateId !== event.data.projectId) {
      context.addIssue({
        code: "custom",
        message: "aggregateId must equal data.projectId",
        path: ["aggregateId"]
      });
    }
  });

const projectEventSchema = z.union([
  projectCreatedEnvelopeSchema,
  projectUpdatedEnvelopeSchema,
  projectDeletedEnvelopeSchema
]);

export type ProjectEventEnvelope = z.infer<typeof projectEventSchema>;
export type ProjectUpsertEnvelope = Exclude<ProjectEventEnvelope, { eventType: "ProjectDeleted" }>;
export type ProjectDeletedEnvelope = Extract<ProjectEventEnvelope, { eventType: "ProjectDeleted" }>;

export function parseProjectEvent(payload: string): ProjectEventEnvelope {
  const parsed: unknown = JSON.parse(payload);
  return projectEventSchema.parse(parsed);
}