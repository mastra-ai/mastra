/** A desktop's first boot can take the platform's full ensure timeout (300 s) plus the RFB handshake. */
export const CONNECT_TIMEOUT_MS = 315_000;

export type ComputerViewMode = 'watch' | 'control';

export type ComputerSessionResult =
  { state: 'ready'; socketUrl: string } | { state: 'not-running' | 'forbidden' | 'unavailable' | 'error' };

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

/** Absolute `ws:`/`wss:` URL for a server-relative socket path, resolved against the Mastra server. */
export function resolveSocketUrl(path: string, baseUrl?: string) {
  const url = new URL(path, baseUrl || window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}

/**
 * Mint a single-use, ~30 s ticket for this computer's desktop stream. The
 * returned `socketUrl` is handed straight to the RFB client; the ticket is the
 * only credential in it and the server consumes it on the first upgrade.
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
    const body = (await response.json()) as { state?: unknown; socketUrl?: unknown };
    if (body.state === 'ready' && typeof body.socketUrl === 'string' && body.socketUrl.startsWith('/computer/')) {
      return { state: 'ready', socketUrl: resolveSocketUrl(body.socketUrl, baseUrl) };
    }
    if (body.state === 'not-running') return { state: 'not-running' };
    if (body.state === 'unavailable') return { state: 'unavailable' };
    return { state: 'error' };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { state: 'error' };
  }
}

export type ComputerHolder = 'agent' | 'human';

/** The control lease as the server reports it; `missing` when the computer isn't attached or control isn't served. */
export type ComputerControlResult =
  | { state: 'ok'; holder: ComputerHolder; notified?: boolean; reason?: string }
  | { state: 'missing' | 'forbidden' | 'error' };

export interface ComputerControlRequestOptions {
  computerId: string;
  threadId: string;
  resourceId: string;
  baseUrl?: string;
  apiPrefix?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function controlUrl({ baseUrl, apiPrefix, computerId }: ComputerControlRequestOptions) {
  return `${baseUrl ?? ''}${normalizeApiPrefix(apiPrefix)}/computers/${encodeURIComponent(computerId)}/control`;
}

async function readControl(response: Response): Promise<ComputerControlResult> {
  if (response.status === 404) return { state: 'missing' };
  if (response.status === 403) return { state: 'forbidden' };
  if (!response.ok) return { state: 'error' };
  const body = (await response.json()) as { holder?: unknown; notified?: unknown; reason?: unknown };
  if (body.holder !== 'agent' && body.holder !== 'human') return { state: 'error' };
  return {
    state: 'ok',
    holder: body.holder,
    ...(typeof body.notified === 'boolean' && { notified: body.notified }),
    ...(typeof body.reason === 'string' && { reason: body.reason }),
  };
}

/** Who holds the computer's input right now. */
export async function getComputerControl(options: ComputerControlRequestOptions): Promise<ComputerControlResult> {
  const query = new URLSearchParams({ threadId: options.threadId, resourceId: options.resourceId });
  try {
    const response = await fetch(`${controlUrl(options)}?${query}`, {
      credentials: 'include',
      headers: { ...options.headers },
      signal: options.signal,
    });
    return await readControl(response);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return { state: 'error' };
  }
}

/** Take control from the agent, or hand it back (waking the agent). */
export async function postComputerControl(
  options: ComputerControlRequestOptions & { action: 'take' | 'release'; note?: string },
): Promise<ComputerControlResult> {
  try {
    const response = await fetch(controlUrl(options), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: JSON.stringify({
        threadId: options.threadId,
        resourceId: options.resourceId,
        action: options.action,
        ...(options.note && { note: options.note }),
      }),
      signal: options.signal,
    });
    return await readControl(response);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return { state: 'error' };
  }
}
