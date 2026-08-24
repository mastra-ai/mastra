import { isModelNotAllowedError as isModelNotAllowedResponse } from '../services/is-model-not-allowed';

/**
 * Permissive UI-side detector for "model not allowed" errors surfaced by the
 * agent-builder save/autosave flows.
 *
 * Recognizes the server's HTTP 422 + `body.error.code` envelope (via
 * `domains/agent-builder/services/is-model-not-allowed`, which is what
 * `MastraClientError` actually carries) and, as a fallback, any error object
 * carrying a bare top-level `code: 'MODEL_NOT_ALLOWED'`.
 */
export function isModelNotAllowedError(error: unknown) {
  const fromResponse = isModelNotAllowedResponse(error);
  if (fromResponse) {
    return { message: fromResponse.message };
  }

  if (error && typeof error === 'object' && 'code' in error && error.code === 'MODEL_NOT_ALLOWED') {
    return { message: error instanceof Error ? error.message : 'Model is not allowed' };
  }

  return null;
}
