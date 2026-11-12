/**
 * The session's background work on the Factory server: commands an agent left running in the
 * session's sandbox, and background tasks. Only people who can read the session reach it.
 */
import type {
  BackgroundTaskResponse,
  KillSandboxProcessResponse,
  SandboxProcess,
  SandboxProcessOutputResponse,
} from '@mastra/client-js';

import { readJsonOrThrow } from '../../workspaces/services/http';

export type BackgroundProcess = SandboxProcess;
export type BackgroundProcessOutput = SandboxProcessOutputResponse;

function backgroundUrl(baseUrl: string, sessionId: string, path: string): string {
  return `${baseUrl}/web/user-sessions/${encodeURIComponent(sessionId)}/background/${path}`;
}

/** The thread's background commands that are still running, or exited with unread output. */
export async function listBackgroundProcesses(
  baseUrl: string,
  sessionId: string,
  threadId: string | undefined,
): Promise<BackgroundProcess[]> {
  const query = threadId ? `?threadId=${encodeURIComponent(threadId)}` : '';
  const res = await fetch(`${backgroundUrl(baseUrl, sessionId, 'processes')}${query}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  // Chats with no session row behind them (a supervisor) have no sandbox to list.
  if (res.status === 404) return [];
  const body = await readJsonOrThrow<{ processes: BackgroundProcess[] }>(res, 'Failed to list background commands');
  return body.processes;
}

export async function getBackgroundProcessOutput(
  baseUrl: string,
  sessionId: string,
  pid: string,
  tail: number,
): Promise<BackgroundProcessOutput> {
  const res = await fetch(`${backgroundUrl(baseUrl, sessionId, `processes/${encodeURIComponent(pid)}`)}?tail=${tail}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return readJsonOrThrow<BackgroundProcessOutput>(res, 'Failed to read the command output');
}

export async function killBackgroundProcess(
  baseUrl: string,
  sessionId: string,
  pid: string,
): Promise<KillSandboxProcessResponse> {
  const res = await fetch(backgroundUrl(baseUrl, sessionId, `processes/${encodeURIComponent(pid)}/kill`), {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return readJsonOrThrow<KillSandboxProcessResponse>(res, 'Failed to stop the command');
}

export async function cancelBackgroundTask(
  baseUrl: string,
  sessionId: string,
  taskId: string,
): Promise<BackgroundTaskResponse> {
  const res = await fetch(backgroundUrl(baseUrl, sessionId, `tasks/${encodeURIComponent(taskId)}/cancel`), {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return readJsonOrThrow<BackgroundTaskResponse>(res, 'Failed to cancel the task');
}
