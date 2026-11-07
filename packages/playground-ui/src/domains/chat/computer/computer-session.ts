/** A desktop's first boot can take the platform's full ensure timeout (300 s) plus page load. */
export const IFRAME_LOAD_TIMEOUT_MS = 315_000;

export type ComputerViewMode = 'watch' | 'control';

export type ComputerSessionResult =
  | { state: 'ready'; connectUrl: string }
  | { state: 'not-running' | 'forbidden' | 'unavailable' | 'error' };

export interface RequestComputerSessionOptions {
  computerId: string;
  threadId: string;
  resourceId: string;
  mode: ComputerViewMode;
  baseUrl?: string;
  apiPrefix?: string;
  /** Studio's configured request headers, including any `Authorization` token. */
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function normalizeApiPrefix(apiPrefix: string | undefined) {
  const prefix = (apiPrefix ?? '/api').replace(/\/$/, '');
  return prefix || '/api';
}

/** Absolute URL for a server-relative path, resolved against the Mastra server. */
export function resolveServerUrl(path: string, baseUrl?: string) {
  return new URL(path, baseUrl || window.location.href).href;
}

/**
 * Mint a single-use viewer ticket for a computer attached to this thread. The
 * returned `connectUrl` is opened in an iframe; credentials never enter a URL.
 */
export async function requestComputerSession({
  computerId,
  threadId,
  resourceId,
  mode,
  baseUrl,
  apiPrefix,
  headers,
  signal,
}: RequestComputerSessionOptions): Promise<ComputerSessionResult> {
  const url = `${baseUrl ?? ''}${normalizeApiPrefix(apiPrefix)}/computers/${encodeURIComponent(computerId)}/session`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ threadId, resourceId, mode }),
      signal,
    });
    if (response.status === 403) return { state: 'forbidden' };
    if (response.status === 404) return { state: 'unavailable' };
    if (!response.ok) return { state: 'error' };
    const body = (await response.json()) as { state?: unknown; connectUrl?: unknown };
    if (body.state === 'ready' && typeof body.connectUrl === 'string' && body.connectUrl.startsWith('/computer/')) {
      return { state: 'ready', connectUrl: resolveServerUrl(body.connectUrl, baseUrl) };
    }
    if (body.state === 'not-running') return { state: 'not-running' };
    if (body.state === 'unavailable') return { state: 'unavailable' };
    return { state: 'error' };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { state: 'error' };
  }
}
