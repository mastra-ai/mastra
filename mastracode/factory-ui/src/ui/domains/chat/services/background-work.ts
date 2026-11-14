/**
 * The session's background commands on the Factory server: commands an agent left running in the
 * session's sandbox. Only people who can read the session reach them.
 */
import type { KillSandboxProcessResponse, SandboxProcess, SandboxProcessOutputResponse } from '@mastra/client-js';

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

/** The output of the command `toolCallId` started, so a reused PID never shows another command's output. */
export async function getBackgroundProcessOutput(
  baseUrl: string,
  sessionId: string,
  pid: string,
  toolCallId: string,
  tail: number,
): Promise<BackgroundProcessOutput> {
  const query = `?tail=${tail}&toolCallId=${encodeURIComponent(toolCallId)}`;
  const res = await fetch(`${backgroundUrl(baseUrl, sessionId, `processes/${encodeURIComponent(pid)}`)}${query}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return readJsonOrThrow<BackgroundProcessOutput>(res, 'Failed to read the command output');
}

/** Stops the command `toolCallId` started; a PID alone could name a later command that reused it. */
export async function killBackgroundProcess(
  baseUrl: string,
  sessionId: string,
  pid: string,
  toolCallId: string,
): Promise<KillSandboxProcessResponse> {
  const path = `processes/${encodeURIComponent(pid)}/kill?toolCallId=${encodeURIComponent(toolCallId)}`;
  const res = await fetch(backgroundUrl(baseUrl, sessionId, path), {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return readJsonOrThrow<KillSandboxProcessResponse>(res, 'Failed to stop the command');
}
