/**
 * The wire-level error code the server emits on a 422 when a model is blocked
 * by the admin's builder policy. Kept as a local literal so the browser bundle
 * never imports server-only agent-builder EE code.
 */
const MODEL_NOT_ALLOWED_CODE = 'MODEL_NOT_ALLOWED';

export interface ModelNotAllowedDetails {
  message: string;
  attempted?: { provider?: string; modelId?: string };
  offendingLabel?: string;
}

/**
 * Detects HTTP 422 + MODEL_NOT_ALLOWED responses thrown by `MastraClientError`
 * (or any error carrying `status` + `body.error.code`). Returns the parsed
 * details when matched, or `null` otherwise.
 */
export function isModelNotAllowedError(err: unknown): ModelNotAllowedDetails | null {
  if (!err || typeof err !== 'object') return null;
  const candidate = err as { status?: number; body?: unknown; message?: string };
  if (candidate.status !== 422) return null;
  const body = candidate.body as { error?: { code?: unknown } } | undefined;
  const code = body?.error?.code;
  if (code !== MODEL_NOT_ALLOWED_CODE) return null;
  const errorBody = body!.error as {
    message?: string;
    attempted?: { provider?: string; modelId?: string };
    offendingLabel?: string;
  };
  return {
    message: errorBody.message || candidate.message || 'Model not allowed by admin policy',
    attempted: errorBody.attempted,
    offendingLabel: errorBody.offendingLabel,
  };
}
