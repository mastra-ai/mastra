import { safeStringify } from '../../../utils/safe-stringify';

/**
 * Tool-invocation state for a tool-result chunk. A result flagged `isError`
 * (e.g. Anthropic `tool_search_tool_result_error`) is stored as `output-error`,
 * keeping the structured error in `result` so prompt conversion can send it
 * back as `error-json` rather than as a successful `json` output.
 */
export function getToolResultInvocationState(payload: {
  result: unknown;
  isError?: boolean;
}): { state: 'result'; result: unknown } | { state: 'output-error'; result: unknown; errorText: string } {
  if (payload.isError === true) {
    return {
      state: 'output-error',
      result: payload.result,
      errorText: typeof payload.result === 'string' ? payload.result : safeStringify(payload.result),
    };
  }
  return { state: 'result', result: payload.result };
}
