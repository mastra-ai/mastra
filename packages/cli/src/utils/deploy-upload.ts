import { createApiClient, extractApiErrorDetail } from '../commands/auth/client.js';
import { getToken } from '../commands/auth/credentials.js';
import { isRetryablePollingError } from './polling.js';

type ApiClient = ReturnType<typeof createApiClient>;

const DEFAULT_UPLOAD_TIMEOUT_MS = 120_000;
const DEFAULT_UPLOAD_RETRIES = 2;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getHeader(response: Response, name: string): string | undefined {
  return response.headers.get(name) ?? undefined;
}

function requestIdFromResponse(response: Response): string | undefined {
  return (
    getHeader(response, 'x-request-id') ??
    getHeader(response, 'x-amz-request-id') ??
    getHeader(response, 'x-amz-id-2') ??
    getHeader(response, 'cf-ray')
  );
}

function causeMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const cause = (error as { cause?: unknown }).cause;
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === 'object') {
    const code = (cause as { code?: unknown }).code;
    const message = (cause as { message?: unknown }).message;
    if (typeof code === 'string' && typeof message === 'string') return `${code}: ${message}`;
    if (typeof code === 'string') return code;
    if (typeof message === 'string') return message;
  }
  return undefined;
}

function formatCause(error: unknown): string | undefined {
  if (!(error instanceof Error)) return causeMessage(error);
  const nested = causeMessage(error);
  return nested ? `${error.message} (${nested})` : error.message;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

async function readResponseBody(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    return text.trim() ? text.slice(0, 2000) : undefined;
  } catch {
    return undefined;
  }
}

export class ArtifactUploadError extends Error {
  readonly endpoint: string;
  readonly status?: number;
  readonly statusText?: string;
  readonly responseBody?: string;
  readonly requestId?: string;
  readonly timedOut: boolean;
  readonly timeoutMs: number;
  readonly attempt: number;

  constructor(opts: {
    endpoint: string;
    status?: number;
    statusText?: string;
    responseBody?: string;
    requestId?: string;
    timedOut?: boolean;
    timeoutMs: number;
    attempt: number;
    cause?: unknown;
  }) {
    const cause = formatCause(opts.cause);
    const details = [
      `endpoint=${opts.endpoint}`,
      opts.status !== undefined ? `status=${opts.status}${opts.statusText ? ` ${opts.statusText}` : ''}` : undefined,
      opts.responseBody ? `body=${opts.responseBody}` : undefined,
      opts.requestId ? `requestId=${opts.requestId}` : undefined,
      opts.timedOut ? `timeout=${opts.timeoutMs}ms` : undefined,
      cause ? `cause=${cause}` : undefined,
    ].filter(Boolean);

    super(`Artifact upload failed: ${details.join('; ')}`, { cause: opts.cause });
    this.name = 'ArtifactUploadError';
    this.endpoint = opts.endpoint;
    this.status = opts.status;
    this.statusText = opts.statusText;
    this.responseBody = opts.responseBody;
    this.requestId = opts.requestId;
    this.timedOut = Boolean(opts.timedOut);
    this.timeoutMs = opts.timeoutMs;
    this.attempt = opts.attempt;
  }
}

function isRetryableUploadError(error: ArtifactUploadError): boolean {
  if (error.timedOut) return true;
  if (error.status !== undefined) return error.status === 408 || error.status === 429 || error.status >= 500;
  return isRetryablePollingError(error) || isRetryablePollingError((error as { cause?: unknown }).cause);
}

export async function uploadArtifactWithRetry(opts: {
  uploadUrl: string;
  zipBuffer: Buffer;
  timeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? DEFAULT_UPLOAD_RETRIES;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const body = new Uint8Array(opts.zipBuffer);
  let lastError: ArtifactUploadError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const uploadResp = await fetchImpl(opts.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/zip',
          'Content-Length': String(body.byteLength),
        },
        body,
        signal: controller.signal,
      });

      if (uploadResp.ok) {
        return;
      }

      lastError = new ArtifactUploadError({
        endpoint: opts.uploadUrl,
        status: uploadResp.status,
        statusText: uploadResp.statusText,
        responseBody: await readResponseBody(uploadResp),
        requestId: requestIdFromResponse(uploadResp),
        timeoutMs,
        attempt: attempt + 1,
      });
    } catch (error) {
      lastError = new ArtifactUploadError({
        endpoint: opts.uploadUrl,
        timedOut: isAbortError(error),
        timeoutMs,
        attempt: attempt + 1,
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (attempt === maxRetries || !isRetryableUploadError(lastError)) {
      throw lastError;
    }

    const retryDelayMs = 1000 * Math.pow(2, attempt);
    console.warn(
      `${lastError.message}; retrying in ${retryDelayMs / 1000}s... (attempt ${attempt + 1}/${maxRetries})`,
    );
    await delay(retryDelayMs);
  }
}

/**
 * Best-effort cancel of a deploy. Logs warnings on failure but never throws.
 */
export async function bestEffortCancel(opts: {
  postCancel: (client: ApiClient) => Promise<{ error?: unknown; response: { status: number } }>;
  client: ApiClient;
  deployId: string;
}): Promise<void> {
  try {
    console.warn(`Cancelling deploy ${opts.deployId}...`);
    const { error, response } = await opts.postCancel(opts.client);
    if (error) {
      console.warn(
        `Warning: failed to cancel deploy ${opts.deployId} (${response.status}). It may remain in a queued state.`,
      );
    }
  } catch {
    console.warn(`Warning: failed to cancel deploy ${opts.deployId}. It may remain in a queued state.`);
  }
}

/**
 * Retry the upload-complete POST with exponential backoff.
 * On exhaustion, cancels the orphaned deploy and throws.
 *
 * Retries on: 5xx, 401 (with token refresh), and transient network errors.
 * Does NOT retry other 4xx (e.g. 404 = deploy not found).
 */
export async function confirmUploadWithRetry(opts: {
  postUploadComplete: (client: ApiClient) => Promise<{ error?: unknown; response: { status: number } }>;
  cancelDeploy: (client: ApiClient) => Promise<void>;
  client: ApiClient;
  orgId: string;
  maxRetries?: number;
  /** Override for testing — refresh the client with a new token. */
  refreshClient?: (orgId: string) => Promise<ApiClient>;
}): Promise<void> {
  const {
    postUploadComplete,
    cancelDeploy,
    orgId,
    maxRetries = 3,
    refreshClient = async (o: string) => createApiClient(await getToken(), o),
  } = opts;
  let lastError: Error | undefined;
  let currentClient = opts.client;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let completeError: unknown;
    let status: number | undefined;

    try {
      const result = await postUploadComplete(currentClient);
      if (!result.error) {
        return; // Success
      }
      completeError = result.error;
      status = result.response.status;
    } catch (networkError) {
      // Network-level failure (ECONNRESET, ETIMEDOUT, fetch failed, etc.)
      completeError = networkError;
    }

    // Determine if we should retry
    const isRetryableStatus = status !== undefined && (status >= 500 || status === 401);
    const isRetryableNetwork = isRetryablePollingError(completeError);
    const isRetryable = isRetryableStatus || isRetryableNetwork;

    if (!isRetryable || attempt === maxRetries) {
      const apiMessage = extractApiErrorDetail(completeError);
      if (apiMessage) {
        lastError = new Error(apiMessage);
      } else {
        const detail =
          status !== undefined ? `${status}` : completeError instanceof Error ? completeError.message : 'unknown error';
        lastError = new Error(`Upload confirmation failed: ${detail}`);
      }
      break;
    }

    const delay = 1000 * Math.pow(2, attempt);
    const detail = status ? `${status}` : completeError instanceof Error ? completeError.message : 'network error';
    console.warn(
      `Upload confirmation failed (${detail}), retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${maxRetries})`,
    );

    // On 401, refresh the token before retrying
    if (status === 401) {
      try {
        currentClient = await refreshClient(orgId);
      } catch (refreshError) {
        lastError = refreshError instanceof Error ? refreshError : new Error('Failed to refresh authentication token');
        break;
      }
    }

    // Exponential backoff: 1s, 2s, 4s
    await new Promise(r => setTimeout(r, delay));
  }

  // All retries exhausted — cancel the orphaned deploy and throw
  await cancelDeploy(currentClient);
  throw lastError ?? new Error('Upload confirmation failed');
}
