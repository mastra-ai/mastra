/**
 * Code Mode — stdio JSON-RPC transport (v1)
 *
 * Runs the harness inside the sandbox via `sandbox.processes.spawn`, parses
 * protocol frames off stdout, dispatches `external_*` calls back to the host,
 * and writes results to the harness stdin. Abstracted behind
 * {@link CodeModeTransport} so socket/file-queue transports can be added for
 * remote sandboxes later.
 */

import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { SandboxFeatureNotSupportedError } from '../../workspace/errors';
import { buildHarness, buildProgramModule, FRAME_PREFIX } from './harness';
import type { CodeModeHarnessFrame, CodeModeToolResult, CodeModeTransport } from './types';

/**
 * Default transport: writes the harness to a temp dir, spawns
 * `node <harness>`, and bridges RPC over stdio.
 */
export class StdioCodeModeTransport implements CodeModeTransport {
  async run(opts: Parameters<CodeModeTransport['run']>[0]): Promise<CodeModeToolResult> {
    const { sandbox, program, toolIds, dispatch, timeout, abortSignal, onExternalCall, onExternalResult } = opts;

    if (!sandbox.processes) {
      throw new SandboxFeatureNotSupportedError('processes');
    }

    const externals = toolIds.map(toolId => ({ toolId, externalName: sanitize(toolId) }));
    const allowList = new Set(toolIds);

    const dir = await mkdtemp(join(tmpdir(), 'mastra-code-mode-'));
    const suffix = randomBytes(4).toString('hex');
    // The model's TypeScript program is written to its own .ts module; node
    // strips the type annotations when the harness imports it (see the
    // --experimental-strip-types flag on the spawn below).
    const programPath = join(dir, `program-${suffix}.ts`);
    await writeFile(programPath, buildProgramModule(program), 'utf8');
    const harnessSource = buildHarness({ programModule: pathToFileURL(programPath).href, externals });
    const harnessPath = join(dir, `harness-${suffix}.mjs`);
    await writeFile(harnessPath, harnessSource, 'utf8');

    const logs: string[] = [];
    let done: CodeModeToolResult | undefined;
    let stdoutBuffer = '';

    // Resolved once a terminal `done` frame arrives.
    let resolveDone!: () => void;
    const donePromise = new Promise<void>(resolve => {
      resolveDone = resolve;
    });

    try {
      // `--experimental-strip-types` lets node import the program's `.ts`
      // module on Node 22.6–22.17 (where type-stripping is still flagged). On
      // Node 22.18+/24, where stripping is the default, the flag is accepted as
      // a harmless no-op, so this works across the versions CI and users run.
      const handle = await sandbox.processes.spawn(`node --experimental-strip-types ${harnessPath}`, {
        cwd: dir,
        abortSignal,
        onStdout: (chunk: string) => {
          stdoutBuffer += chunk;
          let idx: number;
          while ((idx = stdoutBuffer.indexOf('\n')) >= 0) {
            const line = stdoutBuffer.slice(0, idx);
            stdoutBuffer = stdoutBuffer.slice(idx + 1);
            if (!line.startsWith(FRAME_PREFIX)) continue;
            let frame: CodeModeHarnessFrame;
            try {
              frame = JSON.parse(line.slice(FRAME_PREFIX.length));
            } catch {
              continue;
            }
            handleFrame(frame);
          }
        },
      });

      function handleFrame(frame: CodeModeHarnessFrame): void {
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
            void serveRpc(frame.id, frame.tool, frame.args);
            return;
        }
      }

      async function serveRpc(id: number, tool: string, args: unknown): Promise<void> {
        const started = Date.now();
        onExternalCall?.(tool, args);
        // Allow-list enforcement: never invoke a tool that wasn't exposed.
        if (!allowList.has(tool)) {
          onExternalResult?.(tool, Date.now() - started, new Error('not allowed'));
          await respond(id, false, undefined, {
            message: `Tool "${tool}" is not available in Code Mode`,
            name: 'NotAllowedError',
          });
          return;
        }
        try {
          const result = await dispatch(tool, args);
          onExternalResult?.(tool, Date.now() - started);
          await respond(id, true, result);
        } catch (error: any) {
          onExternalResult?.(tool, Date.now() - started, error);
          await respond(id, false, undefined, {
            message: error?.message ?? String(error),
            name: error?.name,
          });
        }
      }

      async function respond(
        id: number,
        ok: boolean,
        result?: unknown,
        error?: { message: string; name?: string },
      ): Promise<void> {
        await handle.sendStdin(JSON.stringify({ type: 'rpc-result', id, ok, result, error }) + '\n');
      }

      // Race completion against the timeout.
      let timer: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<'timeout'>(resolve => {
        timer = setTimeout(() => resolve('timeout'), timeout);
      });

      const outcome = await Promise.race([donePromise.then(() => 'done' as const), timeoutPromise]);
      if (timer) clearTimeout(timer);

      if (outcome === 'timeout') {
        await handle.kill().catch(() => {});
        return {
          success: false,
          logs,
          error: { message: `Code Mode execution timed out after ${timeout}ms`, name: 'TimeoutError' },
        };
      }

      await handle.wait().catch(() => {});

      return (
        done ?? {
          success: false,
          logs,
          error: { message: 'Program exited without returning a result', name: 'NoResultError' },
        }
      );
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

function sanitize(id: string): string {
  const cleaned = id.replace(/[^A-Za-z0-9_$]/g, '_');
  return /^[A-Za-z_$]/.test(cleaned) ? cleaned : `_${cleaned}`;
}
