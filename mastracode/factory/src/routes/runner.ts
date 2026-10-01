/**
 * Command runner for the embedded editor: discover package scripts, start a
 * command in the session sandbox, and poll its output while it runs.
 *
 * Commands run detached inside the sandbox with output redirected to a log
 * file under /tmp, so polling streams incremental output instead of waiting
 * for completion. An exit marker appended by the wrapper carries the exit
 * code back through the log.
 *
 *   - GET  /web/workspace/runner/scripts?workspacePath=  → package.json scripts
 *   - POST /web/workspace/runner/start?workspacePath=    → { command } → { runId }
 *   - GET  /web/workspace/runner/poll?workspacePath=&runId= → { running, exitCode, output }
 *   - GET  /web/workspace/runner/stream?workspacePath=&runId= → SSE `runner` frames
 *   - POST /web/workspace/runner/stop?workspacePath=     → { runId } → { ok }
 */

import { randomBytes } from 'node:crypto';

import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';

import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { resolveAuthorizedSession, sessionSandbox } from './editor.js';
import type { EditorSessionDeps, SessionSandboxHandle } from './editor.js';

export interface RunnerScript {
  name: string;
  command: string;
}

export interface RunnerScripts {
  workspacePath: string;
  available: boolean;
  scripts: RunnerScript[];
}

export interface RunnerStartResult {
  workspacePath: string;
  runId: string;
  command: string;
}

export interface RunnerPollResult {
  workspacePath: string;
  runId: string;
  command: string;
  running: boolean;
  /** Present once the command finished and its exit marker was seen. */
  exitCode?: number;
  /** The last chunk of combined stdout+stderr (tail-capped). */
  output: string;
}

const MAX_COMMAND_LENGTH = 2000;
const MAX_OUTPUT_TAIL_BYTES = 64_000;
/** Server-side poll cadence behind the SSE stream (the log lives in the sandbox). */
const STREAM_POLL_MS = 400;
const MAX_RUNS_PER_SESSION = 5;
const RUN_IDLE_MS = 30 * 60_000;
const EXIT_MARKER = '::mastra-runner-exit:';
const ALIVE_MARKER = '::mastra-runner-alive:';

interface RunnerRun {
  runId: string;
  command: string;
  pid: string;
  log: string;
  startedAt: number;
  lastPoll: number;
}

/** sessionId → runId → run. In-process only, like collab rooms. */
const runsBySession = new Map<string, Map<string, RunnerRun>>();

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function sessionRuns(sessionId: string): Map<string, RunnerRun> {
  let runs = runsBySession.get(sessionId);
  if (!runs) {
    runs = new Map();
    runsBySession.set(sessionId, runs);
  }
  const now = Date.now();
  for (const [runId, run] of runs) {
    if (now - run.lastPoll > RUN_IDLE_MS) runs.delete(runId);
  }
  return runs;
}

async function requireHandle(session: SourceControlSession): Promise<SessionSandboxHandle> {
  const handle = await sessionSandbox(session);
  if (!handle) throw new Error('The session sandbox is not available');
  return handle;
}

export async function listRunnerScripts(session: SourceControlSession): Promise<RunnerScripts> {
  const empty: RunnerScripts = { workspacePath: session.sessionId, available: false, scripts: [] };
  const handle = await sessionSandbox(session);
  if (!handle) return empty;
  let scripts: RunnerScript[] = [];
  try {
    const raw = await handle.filesystem.readFile('package.json');
    const text = typeof raw === 'string' ? raw : raw.toString('utf8');
    const parsed = JSON.parse(text) as { scripts?: Record<string, unknown> };
    scripts = Object.entries(parsed.scripts ?? {})
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([name, command]) => ({ name, command }));
  } catch {
    // No package.json (or unparsable) — arbitrary commands still work.
  }
  return { workspacePath: session.sessionId, available: true, scripts };
}

export async function startRunnerCommand(session: SourceControlSession, command: string): Promise<RunnerStartResult> {
  const trimmed = command?.trim();
  if (!trimmed) throw new Error('command is required');
  if (trimmed.length > MAX_COMMAND_LENGTH) throw new Error('command too large');
  const handle = await requireHandle(session);

  const runs = sessionRuns(session.sessionId);
  if (runs.size >= MAX_RUNS_PER_SESSION) {
    // Evict the oldest finished-or-stale run slot.
    const oldest = [...runs.values()].sort((a, b) => a.startedAt - b.startedAt)[0];
    if (oldest) runs.delete(oldest.runId);
  }

  const runId = randomBytes(8).toString('hex');
  const log = `/tmp/mastra-runner-${runId}.log`;
  // Detach the command with its output captured to the log; the wrapper
  // appends an exit marker so the poller can report the exit code. `echo $!`
  // hands the wrapper subshell's pid back for aliveness checks and stop.
  //
  // Run under a pseudo-TTY via `script` when available: programs block-buffer
  // stdout when it's a plain file redirect (output appears in 4–8KB bursts or
  // only at exit), but line-buffer — and emit colors — when they see a TTY.
  // The typescript file goes to /dev/null because `script` writes a "Script
  // started on …" header into it even with -q; we capture script's stdout
  // relay instead, which is raw unbuffered writes of the pty output.
  //
  // Flag dialects differ: util-linux (Linux) takes `-qefc CMD FILE`, BSD
  // (macOS) takes `-qeF FILE CMD...` — only util-linux answers --version,
  // which is the detector. Both propagate the child's exit code via -e.
  const runCmd = shellQuote(trimmed);
  const quotedLog = shellQuote(log);
  const wrapper =
    `if command -v script >/dev/null 2>&1; then ` +
    `if script --version >/dev/null 2>&1; then script -qefc ${runCmd} /dev/null >> ${quotedLog} 2>&1; ` +
    `else script -qeF /dev/null sh -c ${runCmd} >> ${quotedLog} 2>&1; fi; ` +
    `else sh -c ${runCmd} >> ${quotedLog} 2>&1; fi`;
  const script = `cd ${shellQuote(handle.workdir)} && : > ${quotedLog} && ( ${wrapper}; echo "${EXIT_MARKER}$?" >> ${quotedLog} ) </dev/null >/dev/null 2>&1 & echo $!`;
  const result = await handle.sandbox.executeCommand('sh', ['-c', script], { timeout: 15_000 });
  const pid = result.stdout.trim().split('\n').pop()?.trim() ?? '';
  if (result.exitCode !== 0 || !/^\d+$/.test(pid)) {
    throw new Error(`Could not start command: ${result.stderr || result.stdout || 'unknown error'}`);
  }

  const now = Date.now();
  runs.set(runId, { runId, command: trimmed, pid, log, startedAt: now, lastPoll: now });
  return { workspacePath: session.sessionId, runId, command: trimmed };
}

/**
 * Emulate in-place terminal rewrites in captured PTY output: progress bars
 * repaint lines with bare \r (keep only the final repaint), and BSD `script`
 * echoes the stdin EOF as a literal `^D` followed by two backspaces that rub
 * it out (apply \b erasure). Expects \r\n already normalized to \n.
 */
export function normalizePtyArtifacts(output: string): string {
  return output
    .split('\n')
    .map(line => {
      const repaint = line.slice(line.lastIndexOf('\r') + 1);
      if (!repaint.includes('\b')) return repaint;
      let built = '';
      for (const char of repaint) {
        if (char === '\b') built = built.slice(0, -1);
        else built += char;
      }
      return built;
    })
    .join('\n');
}

export async function pollRunnerCommand(session: SourceControlSession, runId: string): Promise<RunnerPollResult> {
  const runs = sessionRuns(session.sessionId);
  const run = runs.get(runId);
  if (!run) throw new Error('run not found');
  run.lastPoll = Date.now();
  const handle = await requireHandle(session);

  const script = `( kill -0 ${run.pid} 2>/dev/null && echo '${ALIVE_MARKER}1' || echo '${ALIVE_MARKER}0' ); tail -c ${MAX_OUTPUT_TAIL_BYTES} ${shellQuote(run.log)} 2>/dev/null`;
  const result = await handle.sandbox.executeCommand('sh', ['-c', script], { timeout: 15_000 });

  let alive = false;
  let output = result.stdout;
  const aliveIndex = output.indexOf(ALIVE_MARKER);
  if (aliveIndex !== -1) {
    const lineEnd = output.indexOf('\n', aliveIndex);
    alive = output.slice(aliveIndex + ALIVE_MARKER.length, lineEnd === -1 ? undefined : lineEnd).trim() === '1';
    output = lineEnd === -1 ? '' : output.slice(lineEnd + 1);
  }

  // PTY output uses \r\n line endings — normalize before marker parsing so
  // the slice around the exit marker doesn't leave a stray trailing \r.
  output = output.replace(/\r\n/g, '\n');

  let exitCode: number | undefined;
  const markerIndex = output.lastIndexOf(EXIT_MARKER);
  if (markerIndex !== -1) {
    const parsed = Number.parseInt(output.slice(markerIndex + EXIT_MARKER.length), 10);
    if (Number.isFinite(parsed)) exitCode = parsed;
    output = output.slice(0, markerIndex).replace(/\n$/, '');
  }

  output = normalizePtyArtifacts(output);

  return {
    workspacePath: session.sessionId,
    runId,
    command: run.command,
    running: alive && exitCode === undefined,
    ...(exitCode !== undefined ? { exitCode } : {}),
    output,
  };
}

export async function stopRunnerCommand(
  session: SourceControlSession,
  runId: string,
): Promise<{ workspacePath: string; runId: string; ok: boolean }> {
  const runs = sessionRuns(session.sessionId);
  const run = runs.get(runId);
  if (!run) throw new Error('run not found');
  const handle = await requireHandle(session);
  // Kill the wrapper's children first (test runners, dev servers…), then the
  // wrapper itself; escalate to -9 for anything that ignored TERM.
  const script = `pkill -P ${run.pid} 2>/dev/null; kill ${run.pid} 2>/dev/null; sleep 0.3; pkill -9 -P ${run.pid} 2>/dev/null; kill -9 ${run.pid} 2>/dev/null; true`;
  const result = await handle.sandbox.executeCommand('sh', ['-c', script], { timeout: 10_000 });
  return { workspacePath: session.sessionId, runId, ok: result.exitCode === 0 };
}

function errorStatus(message: string): 400 | 403 | 404 | 500 {
  if (message.includes('not available') || message.includes('current user')) return 403;
  if (message.includes('not found')) return 404;
  if (message.includes('required') || message.includes('too large') || message.includes('Could not start')) return 400;
  return 500;
}

/** Register the `/web/workspace/runner/*` routes. */
export function buildRunnerRoutes(deps: EditorSessionDeps): ApiRoute[] {
  const respond = async (c: Context, run: (session: SourceControlSession) => Promise<unknown>) => {
    const workspacePath = c.req.query('workspacePath');
    if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
    try {
      const session = await resolveAuthorizedSession(c, deps, workspacePath);
      return c.json(await run(session));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, errorStatus(message));
    }
  };

  return [
    registerApiRoute('/web/workspace/runner/scripts', {
      method: 'GET',
      requiresAuth: false,
      handler: c => respond(c, session => listRunnerScripts(session)),
    }),
    registerApiRoute('/web/workspace/runner/start', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const body = (await c.req.json().catch(() => null)) as { command?: string } | null;
        if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
        return respond(c, session => startRunnerCommand(session, body.command ?? ''));
      },
    }),
    registerApiRoute('/web/workspace/runner/poll', {
      method: 'GET',
      requiresAuth: false,
      handler: c => {
        const runId = c.req.query('runId');
        if (!runId) return c.json({ error: 'Missing required query param: runId' }, 400);
        return respond(c, session => pollRunnerCommand(session, runId));
      },
    }),
    registerApiRoute('/web/workspace/runner/stream', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const workspacePath = c.req.query('workspacePath');
        if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
        const runId = c.req.query('runId');
        if (!runId) return c.json({ error: 'Missing required query param: runId' }, 400);
        let session: SourceControlSession;
        try {
          session = await resolveAuthorizedSession(c, deps, workspacePath);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return c.json({ error: message }, errorStatus(message));
        }
        // SSE push to the browser; the sandbox log is still tailed server-side
        // on a tight cadence because the log file lives inside the sandbox and
        // only `executeCommand` can read it. One HTTP connection per run
        // instead of one request per tick, and frames only go out on change.
        return streamSSE(c, async stream => {
          let aborted = false;
          stream.onAbort(() => {
            aborted = true;
          });
          let lastKey = '';
          while (!aborted && !stream.aborted) {
            let result: RunnerPollResult;
            try {
              result = await pollRunnerCommand(session, runId);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              await stream
                .writeSSE({ event: 'runner-error', data: JSON.stringify({ error: message }) })
                .catch(() => {});
              return;
            }
            // Output is tail-capped, so length alone can miss same-size
            // rewrites — key on the tail too.
            const key = `${result.running}:${result.exitCode ?? ''}:${result.output.length}:${result.output.slice(-64)}`;
            if (key !== lastKey) {
              lastKey = key;
              try {
                await stream.writeSSE({ event: 'runner', data: JSON.stringify(result) });
              } catch {
                return; // Half-closed socket — the client is gone.
              }
            }
            if (!result.running) return;
            await new Promise(resolve => setTimeout(resolve, STREAM_POLL_MS));
          }
        });
      },
    }),
    registerApiRoute('/web/workspace/runner/stop', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const body = (await c.req.json().catch(() => null)) as { runId?: string } | null;
        if (!body?.runId) return c.json({ error: 'Missing required body field: runId' }, 400);
        return respond(c, session => stopRunnerCommand(session, body.runId!));
      },
    }),
  ];
}
