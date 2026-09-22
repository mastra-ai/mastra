/**
 * Boat error translation.
 *
 * The Boat SDK rejects non-2xx responses with a `ResponseError` whose message is
 * just the HTTP status — the useful part (Boat's `code`, `message` and
 * `requestId`) is in the JSON body, which has to be read off the response. These
 * helpers pull that out and re-throw as the workspace error types so callers can
 * branch on `error.code` instead of parsing HTTP.
 */

import { ResponseError } from '@boatdev/sdk';
import { SandboxError } from '@mastra/core/workspace';

export const LOG_PREFIX = '[BoatSandbox]';

/** Shape of Boat's error envelope. Every field is optional defensively — this is parsed from the wire. */
interface BoatErrorEnvelope {
  code?: string;
  message?: string;
  requestId?: string;
  error?: { code?: string; message?: string; details?: unknown };
}

/**
 * Read Boat's structured error envelope off a failed response.
 *
 * Returns an empty object when the body is missing or not JSON: a bad gateway
 * between the caller and Boat produces an HTML error page, and that must not
 * mask the original status.
 */
async function readEnvelope(response: Response): Promise<BoatErrorEnvelope> {
  try {
    return ((await response.clone().json()) as BoatErrorEnvelope) ?? {};
  } catch {
    return {};
  }
}

/**
 * Translate a thrown Boat SDK error into a {@link SandboxError}.
 *
 * Non-`ResponseError` throws (network failures, aborts, bugs) are wrapped
 * unchanged so no error escapes the provider untyped. `operation` names what was
 * being attempted and becomes the prefix of the message.
 */
export async function toSandboxError(error: unknown, operation: string): Promise<SandboxError> {
  if (error instanceof SandboxError) return error;

  if (error instanceof ResponseError) {
    const envelope = await readEnvelope(error.response);
    const code = envelope.error?.code ?? envelope.code ?? `http_${error.response.status}`;
    const message = envelope.error?.message ?? envelope.message ?? error.response.statusText;
    return new SandboxError(`${LOG_PREFIX} ${operation} failed: ${message}`, code.toUpperCase(), {
      status: error.response.status,
      boatCode: code,
      ...(envelope.requestId ? { requestId: envelope.requestId } : {}),
    });
  }

  const message = error instanceof Error ? error.message : String(error);
  return new SandboxError(`${LOG_PREFIX} ${operation} failed: ${message}`, 'EXECUTION_FAILED', { cause: error });
}

/** Run a Boat SDK call, translating any failure into a {@link SandboxError}. */
export async function withBoatErrors<T>(operation: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw await toSandboxError(error, operation);
  }
}

/**
 * Strip the `_token` query parameter from a Boat URL.
 *
 * Hosted-port and desktop URLs carry a bearer token in the query string. They
 * are returned to callers intact — the token is what makes the link usable — but
 * anything we log goes through here first.
 */
export function redactUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has('_token')) parsed.searchParams.set('_token', 'REDACTED');
    return parsed.toString();
  } catch {
    return '[unparseable url]';
  }
}
