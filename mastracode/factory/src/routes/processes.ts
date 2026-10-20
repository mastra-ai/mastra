import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import type { ProcessHandle, SandboxProcessManager } from '@mastra/core/workspace';
import type { Context } from 'hono';

import { peekSessionSandbox, sessionLayout } from '../sandbox/session-sandbox.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { resolveAuthorizedSession } from './fs.js';
import type { SessionFsDeps } from './fs.js';

/** Bytes of each stream a process read returns: the end, where new output lands. */
export const MAX_PROCESS_OUTPUT_BYTES = 64 * 1024;

export interface WorkspaceProcessSummary {
  pid: string;
  command?: string;
  running: boolean;
  exitCode?: number;
}

export interface WorkspaceProcessListing {
  workspacePath: string;
  /** False when the session's sandbox isn't running in this server process. */
  available: boolean;
  /** False when the sandbox has no process manager; the sidebar hides Processes. */
  supported: boolean;
  processes: WorkspaceProcessSummary[];
}

export interface WorkspaceProcessOutput extends WorkspaceProcessSummary {
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  /** Attached to a process it didn't start: output from before attaching isn't there. */
  attached: boolean;
}

const loose = (c: unknown) => c as Context;

/**
 * The session's process manager, without starting anything. Process calls
 * run `ensureRunning()` first, so a sandbox that isn't running reports
 * `available: false` instead of being started by a sidebar poll.
 */
function sessionProcesses(session: SourceControlSession): {
  available: boolean;
  processes?: SandboxProcessManager;
} {
  const entry = peekSessionSandbox(session.id);
  if (!entry || !sessionLayout(entry)) return { available: false };
  const sandbox = entry.sandbox as typeof entry.sandbox & { status?: string };
  if (sandbox.status !== undefined && sandbox.status !== 'running') return { available: false };
  return { available: true, processes: sandbox.processes };
}

export async function listSessionProcesses(session: SourceControlSession): Promise<WorkspaceProcessListing> {
  const { available, processes } = sessionProcesses(session);
  const listing = { workspacePath: session.sessionId, available, supported: !available || Boolean(processes) };
  if (!processes) return { ...listing, processes: [] };
  const infos = await processes.list();
  return {
    ...listing,
    processes: infos.map(({ pid, command, running, exitCode }) => ({
      pid,
      ...(command !== undefined && { command }),
      running,
      ...(exitCode !== undefined && { exitCode }),
    })),
  };
}

/**
 * Read without releasing: an exited process stays tracked, so the agent's
 * own `get_process_output` still finds it after the sidebar showed it.
 */
async function sessionProcess(session: SourceControlSession, pid: string): Promise<ProcessHandle> {
  const { processes } = sessionProcesses(session);
  if (!processes) throw new Error('Session processes are not available');
  const handle = await processes.get(pid, { release: false });
  if (!handle) throw new Error(`Process ${pid} not found`);
  return handle;
}

function tail(output: string): { text: string; cut: boolean } {
  const bytes = Buffer.from(output);
  if (bytes.length <= MAX_PROCESS_OUTPUT_BYTES) return { text: output, cut: false };
  // Drop a character the cut split in two.
  const text = bytes
    .subarray(bytes.length - MAX_PROCESS_OUTPUT_BYTES)
    .toString('utf8')
    .replace(/^\uFFFD/, '');
  return { text, cut: true };
}

export async function readSessionProcess(session: SourceControlSession, pid: string): Promise<WorkspaceProcessOutput> {
  const handle = await sessionProcess(session, pid);
  const stdout = tail(handle.stdout);
  const stderr = tail(handle.stderr);
  const exitCode = handle.exitCode;
  return {
    pid: handle.pid,
    ...(handle.command !== undefined && { command: handle.command }),
    running: exitCode === undefined,
    ...(exitCode !== undefined && { exitCode }),
    stdout: stdout.text,
    stderr: stderr.text,
    stdoutTruncated: stdout.cut || handle.stdoutTruncated,
    stderrTruncated: stderr.cut || handle.stderrTruncated,
    // A spawned handle carries the command it ran; one attached by pid doesn't.
    attached: handle.command === undefined,
  };
}

/** Stop through the handle, not `processes.kill()`, which would release it and hide its output from the agent. */
export async function killSessionProcess(session: SourceControlSession, pid: string): Promise<{ killed: boolean }> {
  const handle = await sessionProcess(session, pid);
  return { killed: await handle.kill() };
}

function errorStatus(message: string): 403 | 404 | 500 {
  if (message.includes('not available')) return 403;
  if (message.includes('not found')) return 404;
  return 500;
}

/**
 * Process routes for a Factory session's sandbox, for the workspace sidebar.
 * Owner only, like the other `/web/workspace/*` session routes, and they never
 * start a sandbox.
 *   - `GET /web/workspace/processes?workspacePath=`
 *   - `GET /web/workspace/process?workspacePath=&pid=` — last 64 KiB per stream
 *   - `POST /web/workspace/process/kill` `{ workspacePath, pid }`
 */
export function buildProcessRoutes(options: { sessionFs?: SessionFsDeps }): ApiRoute[] {
  const sessionFs = options.sessionFs;
  const authorized = async (c: Context, workspacePath: string) => {
    const session = await resolveAuthorizedSession(c, sessionFs, workspacePath);
    if (!session) throw new Error('Session workspace is not available');
    return session;
  };
  const fail = (c: Context, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message }, errorStatus(message));
  };

  return [
    registerApiRoute('/web/workspace/processes', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const workspacePath = c.req.query('workspacePath');
        if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
        try {
          return c.json(await listSessionProcesses(await authorized(loose(c), workspacePath)));
        } catch (error) {
          return fail(loose(c), error);
        }
      },
    }),
    registerApiRoute('/web/workspace/process', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const workspacePath = c.req.query('workspacePath');
        const pid = c.req.query('pid');
        if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
        if (!pid) return c.json({ error: 'Missing required query param: pid' }, 400);
        try {
          return c.json(await readSessionProcess(await authorized(loose(c), workspacePath), pid));
        } catch (error) {
          return fail(loose(c), error);
        }
      },
    }),
    registerApiRoute('/web/workspace/process/kill', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const body = (await c.req.json().catch(() => ({}))) as { workspacePath?: unknown; pid?: unknown };
        if (typeof body.workspacePath !== 'string' || !body.workspacePath) {
          return c.json({ error: 'Missing required field: workspacePath' }, 400);
        }
        if (typeof body.pid !== 'string' || !body.pid) return c.json({ error: 'Missing required field: pid' }, 400);
        try {
          return c.json(await killSessionProcess(await authorized(loose(c), body.workspacePath), body.pid));
        } catch (error) {
          return fail(loose(c), error);
        }
      },
    }),
  ];
}
