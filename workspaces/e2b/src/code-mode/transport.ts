/**
 * Code Mode — E2B transport
 *
 * The default {@link StdioCodeModeTransport} in `@mastra/core` writes the
 * runner/program files to the *host* tmpdir and spawns `node <hostPath>`. That
 * only works when the sandbox shares the host filesystem (e.g. `LocalSandbox`).
 * E2B runs the program in a remote micro-VM with its own filesystem, so the
 * host paths don't exist there and `node` exits immediately.
 *
 * `E2BCodeModeTransport` writes the runner/program *into* the sandbox via the
 * E2B files API and runs plain `node <runnerPath>` inside the VM. TypeScript is
 * stripped on the host with esbuild before upload, so it doesn't depend on the
 * sandbox's Node version (the core transport relies on
 * `node --experimental-strip-types`, which needs Node >= 22.6).
 *
 * The RPC frame protocol (host <-> runner) is unchanged: it reuses
 * `buildProgramModule`, `buildRunner`, and `FRAME_PREFIX` from
 * `@mastra/core/tools`.
 */

import { randomBytes } from 'node:crypto';
import { buildProgramModule, buildRunner, FRAME_PREFIX } from '@mastra/core/tools';
import type { CodeModeRunnerFrame, CodeModeToolResult, CodeModeTransport } from '@mastra/core/tools';
import type { ProcessHandle } from '@mastra/core/workspace';
import { transformSync } from 'esbuild';
import { E2BSandbox } from '../sandbox';

/** Base directory inside the E2B sandbox where Code Mode programs are written. */
const SANDBOX_TMP = '/home/user/mastra-code-mode';

/** Mirrors the external-name sanitizer used by the core Code Mode runner. */
function sanitize(id: string): string {
  const cleaned = id.replace(/[^A-Za-z0-9_$]/g, '_');
  return /^[A-Za-z_$]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

/**
 * Code Mode transport for {@link E2BSandbox}.
 *
 * Writes the generated program and runner into the sandbox filesystem, runs
 * `node` there, and bridges `external_*` RPC calls back to the host over the
 * process's stdout/stdin — the same frame protocol as the core stdio transport.
 *
 * @example
 * ```typescript
 * import { createCodeMode } from '@mastra/core/tools';
 * import { E2BSandbox, E2BCodeModeTransport } from '@mastra/e2b';
 *
 * const { tool, instructions } = createCodeMode(
 *   { tools: { getWeather, getForecast }, sandbox: new E2BSandbox() },
 *   new E2BCodeModeTransport(),
 * );
 * ```
 */
export class E2BCodeModeTransport implements CodeModeTransport {
  async run(opts: Parameters<CodeModeTransport['run']>[0]): Promise<CodeModeToolResult> {
    const { sandbox, program, toolIds, dispatch, timeout, abortSignal, onExternalCall, onExternalResult } = opts;

    if (!(sandbox instanceof E2BSandbox)) {
      throw new Error('E2BCodeModeTransport requires an E2BSandbox');
    }
    if (!sandbox.processes) {
      throw new Error('Sandbox has no process manager');
    }

    // Auto-start the sandbox so callers don't have to pre-start it. `start()`
    // is a no-op when already running.
    if (sandbox.status !== 'running') {
      await sandbox.start();
    }

    const e2b = sandbox.e2b;
    const externals = toolIds.map(toolId => ({ toolId, externalName: sanitize(toolId) }));
    const allowList = new Set(toolIds);

    const suffix = randomBytes(4).toString('hex');
    const dir = `${SANDBOX_TMP}/${suffix}`;
    const programPath = `${dir}/program-${suffix}.mjs`;
    const runnerPath = `${dir}/runner-${suffix}.mjs`;

    // Strip TypeScript on the host so the sandbox runs plain JS with no
    // experimental flag and no Node-version dependency.
    const programSource = transformSync(buildProgramModule(program), { loader: 'ts', target: 'es2022' }).code;
    const runnerSource = buildRunner({ programModule: `file://${programPath}`, externals });

    const logs: string[] = [];
    let stderr = '';
    let done: CodeModeToolResult | undefined;
    let stdoutBuffer = '';

    let resolveDone!: () => void;
    const donePromise = new Promise<void>(resolve => {
      resolveDone = resolve;
    });

    // Observer hooks are caller-supplied and best-effort: a throwing hook must
    // never prevent `respond()` from running, or the matching in-sandbox promise
    // would hang until the timeout.
    const notifyCall = (tool: string, args: unknown): void => {
      try {
        onExternalCall?.(tool, args);
      } catch {
        /* observer errors are non-fatal */
      }
    };
    const notifyResult = (tool: string, durationMs: number, error?: Error): void => {
      try {
        onExternalResult?.(tool, durationMs, error);
      } catch {
        /* observer errors are non-fatal */
      }
    };

    try {
      await e2b.files.makeDir(dir);
      await e2b.files.write(programPath, programSource);
      await e2b.files.write(runnerPath, runnerSource);

      let handle: ProcessHandle;

      const respond = async (
        id: number,
        ok: boolean,
        result?: unknown,
        error?: { message: string; name?: string },
      ): Promise<void> => {
        await handle.sendStdin(JSON.stringify({ type: 'rpc-result', id, ok, result, error }) + '\n');
      };

      const serveRpc = async (id: number, tool: string, args: unknown): Promise<void> => {
        const started = Date.now();
        notifyCall(tool, args);
        // Allow-list enforcement: never invoke a tool that wasn't exposed.
        if (!allowList.has(tool)) {
          notifyResult(tool, Date.now() - started, new Error('not allowed'));
          await respond(id, false, undefined, {
            message: `Tool "${tool}" is not available in Code Mode`,
            name: 'NotAllowedError',
          });
          return;
        }
        try {
          const result = await dispatch(tool, args);
          notifyResult(tool, Date.now() - started);
          await respond(id, true, result);
        } catch (error) {
          const err = error as { message?: string; name?: string };
          notifyResult(tool, Date.now() - started, error instanceof Error ? error : new Error(String(error)));
          await respond(id, false, undefined, {
            message: err?.message ?? String(error),
            name: err?.name,
          });
        }
      };

      const handleFrame = (frame: CodeModeRunnerFrame): void => {
        switch (frame.type) {
          case 'log':
            logs.push(frame.message);
            return;
          case 'done':
            done = frame.ok
              ? { success: true, result: frame.result, logs }
              : { success: false, error: frame.error, logs };
            resolveDone();
            return;
          case 'rpc':
            // `serveRpc` awaits `respond`, which writes to the child's stdin and
            // can reject if the process already exited/was killed. Swallow that
            // so it never surfaces as an unhandled rejection.
            void serveRpc(frame.id, frame.tool, frame.args).catch(() => {});
            return;
        }
      };

      handle = await sandbox.processes.spawn(`node ${runnerPath}`, {
        cwd: dir,
        abortSignal,
        // E2B failures are otherwise silent, which makes them painful to debug.
        // Capture stderr and surface it in Timeout/NoResult errors below.
        onStderr: (chunk: string) => {
          stderr += chunk;
        },
        onStdout: (chunk: string) => {
          stdoutBuffer += chunk;
          let idx: number;
          while ((idx = stdoutBuffer.indexOf('\n')) >= 0) {
            const line = stdoutBuffer.slice(0, idx);
            stdoutBuffer = stdoutBuffer.slice(idx + 1);
            if (!line.startsWith(FRAME_PREFIX)) continue;
            let frame: CodeModeRunnerFrame;
            try {
              frame = JSON.parse(line.slice(FRAME_PREFIX.length));
            } catch {
              continue;
            }
            handleFrame(frame);
          }
        },
      });

      // Race completion against process exit and the timeout. Including process
      // exit means a runner that dies without emitting `done` resolves
      // immediately instead of waiting out the full timeout.
      let timer: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<'timeout'>(resolve => {
        timer = setTimeout(() => resolve('timeout'), timeout);
      });
      const exitPromise = handle.wait().then(() => 'exited' as const);

      const outcome = await Promise.race([
        donePromise.then(() => 'done' as const),
        exitPromise.catch(() => 'exited' as const),
        timeoutPromise,
      ]);
      if (timer) clearTimeout(timer);

      if (outcome === 'timeout') {
        await handle.kill().catch(() => {});
        return {
          success: false,
          logs,
          error: {
            message: `Code Mode execution timed out after ${timeout}ms${stderr ? `\nstderr: ${stderr}` : ''}`,
            name: 'TimeoutError',
          },
        };
      }

      // Either `done` arrived or the process exited. If we raced ahead of a
      // `done` frame still in flight, give it a brief beat to land.
      if (!done) {
        await exitPromise.catch(() => {});
      }

      return (
        done ?? {
          success: false,
          logs,
          error: {
            message: `Program exited without returning a result${stderr ? `\nstderr: ${stderr}` : ''}`,
            name: 'NoResultError',
          },
        }
      );
    } finally {
      await e2b.files.remove(dir).catch(() => {});
    }
  }
}
