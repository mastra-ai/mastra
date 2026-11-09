import type { Computer } from '@mastra/client-js';

/** A desktop's first boot can take the platform's full ensure timeout (300 s) plus the RFB handshake. */
export const CONNECT_TIMEOUT_MS = 315_000;

export type ComputerViewMode = 'watch' | 'control';

export type ComputerSessionResult =
  | { state: 'ready'; socketUrl: string }
  | { state: 'not-running' | 'forbidden' | 'unavailable' | 'error' };

export interface RequestComputerSessionOptions {
  computer: Computer;
  threadId: string;
  resourceId: string;
  mode: ComputerViewMode;
  baseUrl?: string;
  signal?: AbortSignal;
}

/** Absolute `ws:`/`wss:` URL for a server-relative socket path, resolved against the Mastra server. */
export function resolveSocketUrl(path: string, baseUrl?: string) {
  const server = new URL(baseUrl || window.location.href);
  const url = new URL(path, server);
  if (url.origin !== server.origin || !url.pathname.startsWith('/computer/')) throw new Error('invalid computer relay URL');
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}

function statusOf(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
    ? error.status
    : undefined;
}

/** Mint a single-use ticket through the typed client-js Computer resource. */
export async function requestComputerSession({
  computer,
  threadId,
  resourceId,
  mode,
  baseUrl,
  signal,
}: RequestComputerSessionOptions): Promise<ComputerSessionResult> {
  try {
    const body = await computer.createSession({ threadId, resourceId, mode }, { signal, retries: 0 });
    if (body.state === 'ready') return { state: 'ready', socketUrl: resolveSocketUrl(body.socketUrl, baseUrl) };
    if (body.state === 'not-running') return { state: 'not-running' };
    return { state: 'error' };
  } catch (error) {
    if (signal?.aborted) throw error;
    const status = statusOf(error);
    if (status === 403) return { state: 'forbidden' };
    if (status === 404) return { state: 'unavailable' };
    return { state: 'error' };
  }
}

export type ComputerHolder = 'agent' | 'human';

export type ComputerControlResult =
  | { state: 'ok'; holder: ComputerHolder; revision: number; enforced?: boolean; notified?: boolean; reason?: string }
  | { state: 'missing' | 'forbidden' | 'error' };

export interface ComputerControlRequestOptions {
  computer: Computer;
  threadId: string;
  resourceId: string;
  signal?: AbortSignal;
}

function controlError(error: unknown): ComputerControlResult {
  const status = statusOf(error);
  if (status === 404) return { state: 'missing' };
  if (status === 403) return { state: 'forbidden' };
  return { state: 'error' };
}

/** Who holds the computer's input right now. */
export async function getComputerControl(options: ComputerControlRequestOptions): Promise<ComputerControlResult> {
  try {
    const body = await options.computer.getControl(
      { threadId: options.threadId, resourceId: options.resourceId },
      { signal: options.signal, retries: 0 },
    );
    return { state: 'ok', ...body };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return controlError(error);
  }
}

/** Take control from the agent, or hand it back (waking the agent). */
export async function postComputerControl(
  options: ComputerControlRequestOptions & { action: 'take' | 'release'; note?: string },
): Promise<ComputerControlResult> {
  try {
    const body = await options.computer.changeControl(
      {
        threadId: options.threadId,
        resourceId: options.resourceId,
        action: options.action,
        ...(options.note && { note: options.note }),
      },
      { signal: options.signal, retries: 0 },
    );
    return { state: 'ok', ...body };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return controlError(error);
  }
}
