/**
 * Permissive UI-side detector for "model not allowed" errors surfaced by the
 * agent-builder save/autosave flows. Matches any error object carrying
 * `code: 'MODEL_NOT_ALLOWED'`, regardless of HTTP envelope. Use the stricter
 * `domains/agent-builder/services/is-model-not-allowed` when you specifically need to
 * recognize the server's HTTP 422 + body shape.
 */
export function isModelNotAllowedError(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'MODEL_NOT_ALLOWED') {
    return { message: error instanceof Error ? error.message : 'Model is not allowed' };
  }

  return null;
}
