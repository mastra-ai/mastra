import { MASTRA_ERROR_CODES } from './codes';
import type { MastraErrorCode } from './codes';
import type { ProblemDetails } from './problem';

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
    title: code ? MASTRA_ERROR_CODES[code].title : (STATUS_TITLES[status] ?? 'Error'),
    status,
  };

  if (code) problem.code = code;
  if (detail !== undefined && status < 500) problem.detail = detail;
  if (instance !== undefined) problem.instance = instance;
  if (issues !== undefined) problem.issues = issues;

  return problem;
}
