import type { MastraErrorCode } from './codes';
import type { ProblemDetails } from './problem';

const CODE_TITLES: Record<MastraErrorCode, string> = {
  AGENT_NOT_FOUND: 'Agent not found',
  MODEL_NOT_ALLOWED: 'Model not allowed',
  NO_MODEL_SELECTED: 'No model selected',
  WORKFLOW_NOT_FOUND: 'Workflow not found',
  WORKFLOW_RUN_NOT_FOUND: 'Workflow run not found',
  WORKFLOW_RUN_ACCESS_DENIED: 'Workflow run access denied',
  WORKFLOW_SCHEMA_VALIDATION_FAILED: 'Workflow schema validation failed',
  WORKFLOW_RESUME_ALREADY_CLAIMED: 'Workflow resume already claimed',
  RUN_ID_REQUIRED: 'Run id required',
  DURABLE_RUN_ACTIVE: 'Durable run already active',
  DURABLE_RUN_RECOVERY_IN_PROGRESS: 'Durable run recovery in progress',
  DURABLE_RUN_SUSPENDED: 'Durable run suspended',
  DURABLE_RUN_EXECUTION_CONFLICT: 'Durable run execution conflict',
  DURABLE_RUN_ACCESS_DENIED: 'Durable run access denied',
  THREAD_NOT_FOUND: 'Thread not found',
  THREAD_ACCESS_DENIED: 'Thread access denied',
  TOOL_NOT_FOUND: 'Tool not found',
  PROCESSOR_NOT_FOUND: 'Processor not found',
  WORKSPACE_NOT_FOUND: 'Workspace not found',
  SCHEDULE_NOT_FOUND: 'Schedule not found',
  BACKGROUND_TASK_NOT_FOUND: 'Background task not found',
  PLAN_CAPABILITY_NOT_FOUND: 'Plan capability not found',
  STORAGE_NOT_CONFIGURED: 'Storage not configured',
  STORAGE_DOMAIN_UNAVAILABLE: 'Storage domain unavailable',
  OBSERVABILITY_FEATURE_NOT_IMPLEMENTED: 'Observability feature not implemented',
  FEEDBACK_REVIEW_STATUS_CONFLICT: 'Feedback review status conflict',
  INVALID_REQUEST_BODY: 'Invalid request body',
  INVALID_QUERY_PARAMS: 'Invalid query parameters',
  INVALID_PATH_PARAMS: 'Invalid path parameters',
};

const STATUS_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  418: "I'm a teapot",
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export interface BuildProblemInput {
  status: number;
  code?: MastraErrorCode;
  detail?: string;
  instance?: string;
  issues?: Array<{ field: string; message: string }>;
}

/**
 * Builds an RFC 9457 problem object. `detail` is dropped for 5xx responses so
 * internal messages never leak; `code` is omitted when not provided.
 */
export function buildProblem({ status, code, detail, instance, issues }: BuildProblemInput): ProblemDetails {
  const problem: ProblemDetails = {
    type: code ? `urn:mastra:error:${code}` : 'about:blank',
    title: code ? CODE_TITLES[code] : (STATUS_TITLES[status] ?? 'Error'),
    status,
  };

  if (code) problem.code = code;
  if (detail !== undefined && status < 500) problem.detail = detail;
  if (instance !== undefined) problem.instance = instance;
  if (issues !== undefined) problem.issues = issues;

  return problem;
}
