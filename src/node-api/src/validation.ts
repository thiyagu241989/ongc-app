import { z } from "zod";

const PROJECT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,49}$/;
const VALID_STATUSES = new Set(["Draft", "Active", "OnHold", "Completed", "Cancelled"]);

const projectRequestSchema = z
  .object({
    projectCode: z.string(),
    projectName: z.string(),
    wellName: z.string(),
    operatorName: z.string().nullable().optional(),
    fieldName: z.string().nullable().optional(),
    basin: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    status: z.string(),
    description: z.string().nullable().optional(),
    plannedStartDate: z.string().nullable().optional(),
    plannedEndDate: z.string().nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional()
  })
  .strict();

export interface ProjectRequest {
  projectCode: string;
  projectName: string;
  wellName: string;
  operatorName: string | null;
  fieldName: string | null;
  basin: string | null;
  location: string | null;
  status: string;
  description: string | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  latitude: number | null;
  longitude: number | null;
}

export type ValidationErrors = Record<string, string[]>;

export function parseAndValidateProjectRequest(
  body: unknown
): { valid: true; value: ProjectRequest } | { valid: false; errors: ValidationErrors } {
  const parsed = projectRequestSchema.safeParse(body);
  if (!parsed.success) {
    const errors: ValidationErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "$";
      errors[key] = [issue.message];
    }
    return { valid: false, errors };
  }

  const raw = parsed.data;
  const errors: ValidationErrors = {};

  addRequiredAndLengthError(errors, "ProjectCode", raw.projectCode, 50);
  addRequiredAndLengthError(errors, "ProjectName", raw.projectName, 200);
  addRequiredAndLengthError(errors, "WellName", raw.wellName, 200);

  const normalizedCode = (raw.projectCode ?? "").trim().toUpperCase();
  if (normalizedCode.length > 0 && !PROJECT_CODE_PATTERN.test(normalizedCode)) {
    errors["ProjectCode"] = [
      "Project code must use uppercase letters, numbers, underscores, or hyphens and contain 3 to 50 characters."
    ];
  }

  if (!VALID_STATUSES.has((raw.status ?? "").trim())) {
    errors["Status"] = [
      `Status must be one of: ${[...VALID_STATUSES].join(", ")}.`
    ];
  }

  if (raw.plannedStartDate && raw.plannedEndDate && raw.plannedEndDate < raw.plannedStartDate) {
    errors["PlannedEndDate"] = ["Planned end date cannot be before planned start date."];
  }

  if (raw.latitude != null && (raw.latitude < -90 || raw.latitude > 90)) {
    errors["Latitude"] = ["Latitude must be between -90 and 90."];
  }

  if (raw.longitude != null && (raw.longitude < -180 || raw.longitude > 180)) {
    errors["Longitude"] = ["Longitude must be between -180 and 180."];
  }

  addOptionalLengthError(errors, "OperatorName", raw.operatorName, 200);
  addOptionalLengthError(errors, "FieldName", raw.fieldName, 200);
  addOptionalLengthError(errors, "Basin", raw.basin, 150);
  addOptionalLengthError(errors, "Location", raw.location, 300);

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    value: {
      projectCode: raw.projectCode,
      projectName: raw.projectName,
      wellName: raw.wellName,
      operatorName: raw.operatorName ?? null,
      fieldName: raw.fieldName ?? null,
      basin: raw.basin ?? null,
      location: raw.location ?? null,
      status: raw.status,
      description: raw.description ?? null,
      plannedStartDate: raw.plannedStartDate ?? null,
      plannedEndDate: raw.plannedEndDate ?? null,
      latitude: raw.latitude ?? null,
      longitude: raw.longitude ?? null
    }
  };
}

function addRequiredAndLengthError(
  errors: ValidationErrors,
  name: string,
  value: string | undefined | null,
  maximumLength: number
): void {
  if (!value || value.trim().length === 0) {
    errors[name] = ["The field is required."];
  } else if (value.trim().length > maximumLength) {
    errors[name] = [`The field cannot exceed ${maximumLength} characters.`];
  }
}

function addOptionalLengthError(
  errors: ValidationErrors,
  name: string,
  value: string | undefined | null,
  maximumLength: number
): void {
  if (value != null && value.trim().length > maximumLength) {
    errors[name] = [`The field cannot exceed ${maximumLength} characters.`];
  }
}
