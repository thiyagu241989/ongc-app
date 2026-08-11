import { describe, expect, it } from "vitest";
import { parseProjectEvent } from "../src/contracts.js";

const validEvent = {
  eventId: "6a570199-88d8-4e67-a13c-8f37cb0802e8",
  eventType: "ProjectCreated",
  eventVersion: 1,
  aggregateType: "Project",
  aggregateId: "9ec0abe3-fc91-4c6f-af22-35ead35db215",
  aggregateVersion: 1,
  occurredAtUtc: "2026-08-06T10:15:30.123Z",
  correlationId: "135a15cc-1308-4428-84da-ad862a0e2d53",
  causationId: null,
  producer: "well-information-api",
  data: {
    projectId: "9ec0abe3-fc91-4c6f-af22-35ead35db215",
    projectCode: "ONGC-PRJ-001",
    projectName: "Western Offshore Development",
    wellName: "WO-Alpha-01",
    operatorName: "ONGC",
    fieldName: "Western Offshore",
    basin: "Mumbai Offshore",
    location: "Arabian Sea",
    status: "Draft",
    description: null,
    plannedStartDate: "2026-09-01",
    plannedEndDate: "2027-03-31",
    latitude: 19.076,
    longitude: 72.8777,
    createdAtUtc: "2026-08-06T10:15:30.123Z",
    createdBy: "test-user"
  }
};

describe("parseProjectEvent", () => {
  it("accepts a valid ProjectCreated event", () => {
    expect(parseProjectEvent(JSON.stringify(validEvent))).toEqual(validEvent);
  });

  it("accepts a valid ProjectUpdated event", () => {
    const updatedEvent = {
      ...validEvent,
      eventType: "ProjectUpdated",
      aggregateVersion: 2,
      data: {
        ...validEvent.data,
        status: "Active",
        updatedAtUtc: "2026-08-06T11:15:30.123Z",
        updatedBy: "test-user"
      }
    };
    expect(parseProjectEvent(JSON.stringify(updatedEvent))).toEqual(updatedEvent);
  });

  it("accepts a valid ProjectDeleted event", () => {
    const deletedEvent = {
      ...validEvent,
      eventType: "ProjectDeleted",
      aggregateVersion: 3,
      data: {
        projectId: validEvent.data.projectId,
        projectCode: validEvent.data.projectCode,
        deletedAtUtc: "2026-08-06T12:15:30.123Z",
        deletedBy: "test-user"
      }
    };
    expect(parseProjectEvent(JSON.stringify(deletedEvent))).toEqual(deletedEvent);
  });

  it("rejects a mismatched aggregate ID", () => {
    const invalidEvent = {
      ...validEvent,
      aggregateId: "3b06e075-21b0-45f2-bd8f-bb5d6ea03b79"
    };
    expect(() => parseProjectEvent(JSON.stringify(invalidEvent))).toThrow(
      "aggregateId must equal data.projectId"
    );
  });

  it("rejects unknown fields", () => {
    const invalidEvent = { ...validEvent, unexpected: true };
    expect(() => parseProjectEvent(JSON.stringify(invalidEvent))).toThrow();
  });
});