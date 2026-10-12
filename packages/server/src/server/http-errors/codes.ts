/**
 * Business error codes exposed on the `problem.code` member of error responses.
 *
 * The HTTP status already conveys the generic category (404, 409, ...), so codes
 * here only exist when they add business meaning ("which thing was not found",
 * "why was it a conflict"). `status` is the default HTTP status for the code.
 */
export const MASTRA_ERROR_CODES = {
  // Agents
  AGENT_NOT_FOUND: { status: 404, title: 'Agent not found' },
  MODEL_NOT_ALLOWED: { status: 422, title: 'Model not allowed' },
  NO_MODEL_SELECTED: { status: 400, title: 'No model selected' },

  // Workflows
  WORKFLOW_NOT_FOUND: { status: 404, title: 'Workflow not found' },
  WORKFLOW_RUN_NOT_FOUND: { status: 404, title: 'Workflow run not found' },
  WORKFLOW_RUN_ACCESS_DENIED: { status: 403, title: 'Workflow run access denied' },
  WORKFLOW_SCHEMA_VALIDATION_FAILED: { status: 400, title: 'Workflow schema validation failed' },
  WORKFLOW_RESUME_ALREADY_CLAIMED: { status: 409, title: 'Workflow resume already claimed' },

  // Runs (shared)
  RUN_ID_REQUIRED: { status: 400, title: 'Run id required' },

  // Durable agent runs
  DURABLE_RUN_ACTIVE: { status: 409, title: 'Durable run already active' },
  DURABLE_RUN_RECOVERY_IN_PROGRESS: { status: 409, title: 'Durable run recovery in progress' },
  DURABLE_RUN_SUSPENDED: { status: 409, title: 'Durable run suspended' },
  DURABLE_RUN_EXECUTION_CONFLICT: { status: 409, title: 'Durable run execution conflict' },
  DURABLE_RUN_ACCESS_DENIED: { status: 403, title: 'Durable run access denied' },

  // Memory
  THREAD_NOT_FOUND: { status: 404, title: 'Thread not found' },
  THREAD_ACCESS_DENIED: { status: 403, title: 'Thread access denied' },

  // Other resources
  TOOL_NOT_FOUND: { status: 404, title: 'Tool not found' },
  PROCESSOR_NOT_FOUND: { status: 404, title: 'Processor not found' },
  WORKSPACE_NOT_FOUND: { status: 404, title: 'Workspace not found' },
  SCHEDULE_NOT_FOUND: { status: 404, title: 'Schedule not found' },
  BACKGROUND_TASK_NOT_FOUND: { status: 404, title: 'Background task not found' },
  PLAN_CAPABILITY_NOT_FOUND: { status: 404, title: 'Plan capability not found' },

  // Storage
  STORAGE_NOT_CONFIGURED: { status: 500, title: 'Storage not configured' },
  STORAGE_DOMAIN_UNAVAILABLE: { status: 500, title: 'Storage domain unavailable' },

  // Observability
  OBSERVABILITY_FEATURE_NOT_IMPLEMENTED: { status: 501, title: 'Observability feature not implemented' },
  FEEDBACK_REVIEW_STATUS_CONFLICT: { status: 409, title: 'Feedback review status conflict' },

  // Request validation
  INVALID_REQUEST_BODY: { status: 400, title: 'Invalid request body' },
  INVALID_QUERY_PARAMS: { status: 400, title: 'Invalid query parameters' },
  INVALID_PATH_PARAMS: { status: 400, title: 'Invalid path parameters' },
} as const satisfies Record<string, { status: number; title: string }>;

export type MastraErrorCode = keyof typeof MASTRA_ERROR_CODES;

export function isMastraErrorCode(value: unknown): value is MastraErrorCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MASTRA_ERROR_CODES, value);
}
