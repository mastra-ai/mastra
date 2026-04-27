import { createApiClient, extractApiErrorDetail } from '../commands/auth/client.js';
import { getToken } from '../commands/auth/credentials.js';
import { isRetryablePollingError } from './polling.js';

type ApiClient = ReturnType<typeof createApiClient>;

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
