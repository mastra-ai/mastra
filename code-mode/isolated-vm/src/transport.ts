/**
 * Code Mode — isolated-vm transport
 *
 * Runs the model's TypeScript program inside an in-process V8 isolate
 * (via `isolated-vm`) instead of a WorkspaceSandbox. The isolate is a real
 * security boundary: the guest has no filesystem, network, process, or module
 * access — the only capabilities are the injected `external_*` functions,
 * which call back into the host dispatcher (allow-list enforced host-side).
 *
 * Unlike the stdio/E2B transports there is no process boundary, so the frame
 * protocol (`FRAME_PREFIX`, stdout parsing, stdin writes) is not used. Host
 * calls cross the isolate boundary as JSON strings in both directions, so no
 * host object references are ever exposed to guest code.
 *
 * TypeScript is stripped on the host with esbuild before evaluation (isolates
 * run plain JavaScript).
 *
 * Requirements:
 * - `isolated-vm` is a native addon (prebuilt binaries for common platforms,
 *   compiled from source elsewhere).
 * - On Node 20+ the host process must be started with `--no-node-snapshot`
 *   (e.g. `node --no-node-snapshot server.js` or
 *   `NODE_OPTIONS=--no-node-snapshot`). The constructor fails fast with an
 *   actionable error when the flag is missing.
 */

import { sanitizeToolId } from '@mastra/core/tools';
import type { CodeModeToolResult, CodeModeTransport } from '@mastra/core/tools';
import { transformSync } from 'esbuild';
import ivm from 'isolated-vm';

/** Default isolate heap limit, in MiB. */
const DEFAULT_MEMORY_LIMIT_MB = 128;

export interface IsolatedVmCodeModeTransportOptions {
  /**
   * V8 isolate heap limit in MiB. Exceeding it terminates the program.
   * Default: 128.
   */
  memoryLimitMb?: number;
}

/**
 * On Node 20+, isolated-vm cannot create isolates unless the host process was
 * started with `--no-node-snapshot` — without it, isolate creation crashes the
 * whole process. Detect the documented mechanisms and fail fast instead.
 */
function assertNoNodeSnapshot(): void {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) return;
  if (process.execArgv.includes('--no-node-snapshot')) return;
  if ((process.env.NODE_OPTIONS ?? '').includes('--no-node-snapshot')) return;
  throw new Error(
    'IsolatedVmCodeModeTransport requires the --no-node-snapshot flag on Node 20+. ' +
      'Start your process with `node --no-node-snapshot ...` or set NODE_OPTIONS="--no-node-snapshot". ' +
      'Without it, creating a V8 isolate crashes the Node process.',
  );
}

/** Envelope returned by the guest program eval (as a JSON string). */
interface GuestResultEnvelope {
  ok: boolean;
  value?: unknown;
  error?: { message: string; name?: string };
}

/** Envelope returned by the host RPC handler (as a JSON string). */
interface HostRpcEnvelope {
  ok: boolean;
  result?: unknown;
  error?: { message: string; name?: string };
}

/**
 * Code Mode transport that executes programs in an in-process V8 isolate.
 *
 * No sandbox is required — the isolate is the execution boundary
 * (`requiresSandbox: false`).
 *
 * @example
 * ```typescript
 * import { createCodeMode } from '@mastra/core/tools';
 * import { IsolatedVmCodeModeTransport } from '@mastra/isolated-vm';
 *
 * const { tool, instructions } = createCodeMode(
 *   { tools: { getWeather, getForecast } },
 *   new IsolatedVmCodeModeTransport({ memoryLimitMb: 128 }),
 * );
 * ```
 */
export class IsolatedVmCodeModeTransport implements CodeModeTransport {
  readonly requiresSandbox = false;

  readonly #memoryLimitMb: number;

  constructor(options: IsolatedVmCodeModeTransportOptions = {}) {
    assertNoNodeSnapshot();
    this.#memoryLimitMb = options.memoryLimitMb ?? DEFAULT_MEMORY_LIMIT_MB;
  }

  async run(opts: Parameters<CodeModeTransport['run']>[0]): Promise<CodeModeToolResult> {
    const { program, toolIds, dispatch, timeout, abortSignal, onExternalCall, onExternalResult } = opts;

    const externals = toolIds.map(toolId => ({ toolId, externalName: sanitizeToolId(toolId) }));
    const allowList = new Set(toolIds);
    const logs: string[] = [];

    // Observer hooks are caller-supplied and best-effort: a throwing hook must
    // never prevent the RPC from responding, or the matching in-isolate promise
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

    // Strip TypeScript on the host; the isolate runs plain JavaScript. Wrapping
    // in an async arrow makes top-level `return`/`await`/`const` legal, same as
    // the core runner's program module.
    let strippedProgram: string;
    try {
      strippedProgram = transformSync(`(async () => {\n${program}\n})`, { loader: 'ts', target: 'es2022' }).code;
    } catch (error) {
      const err = error as { message?: string };
      return {
        success: false,
        logs,
        error: { message: err?.message ?? String(error), name: 'SyntaxError' },
      };
    }

    // Host-side RPC handler. Crosses the boundary as JSON strings in both
    // directions so no host references or non-JSON values ever leak into the
    // guest. Errors are returned in the envelope (never thrown) so the guest
    // can rebuild them with the original error name.
    const rpcHost = async (tool: string, argsJson: string): Promise<string> => {
      const started = Date.now();
      let args: unknown;
      try {
        args = JSON.parse(argsJson);
      } catch {
        args = undefined;
      }
      notifyCall(tool, args);
      // Allow-list enforcement: never invoke a tool that wasn't exposed.
      if (!allowList.has(tool)) {
        notifyResult(tool, Date.now() - started, new Error('not allowed'));
        return JSON.stringify({
          ok: false,
          error: { message: `Tool "${tool}" is not available in Code Mode`, name: 'NotAllowedError' },
        } satisfies HostRpcEnvelope);
      }
      try {
        const result = await dispatch(tool, args);
        // Serialize before reporting success so a non-serializable result
        // (circular reference, BigInt) falls through to the error path without
        // emitting a success event first.
        const json = JSON.stringify({ ok: true, result } satisfies HostRpcEnvelope);
        notifyResult(tool, Date.now() - started);
        return json;
      } catch (error) {
        const err = error as { message?: string; name?: string };
        notifyResult(tool, Date.now() - started, error instanceof Error ? error : new Error(String(error)));
        return JSON.stringify({
          ok: false,
          error: { message: err?.message ?? String(error), name: err?.name },
        } satisfies HostRpcEnvelope);
      }
    };

    const logHost = (message: string): void => {
      logs.push(message);
    };

    const isolate = new ivm.Isolate({ memoryLimit: this.#memoryLimitMb });
    let disposed = false;
    const disposeIsolate = (): void => {
      if (disposed) return;
      disposed = true;
      try {
        isolate.dispose();
      } catch {
        /* already disposed */
      }
    };

    let timedOut = false;
    let timer: NodeJS.Timeout | undefined;
    const onAbort = (): void => disposeIsolate();
    abortSignal?.addEventListener('abort', onAbort, { once: true });

    try {
      if (abortSignal?.aborted) {
        return { success: false, logs, error: { message: 'Code Mode execution aborted', name: 'AbortError' } };
      }

      const context = await isolate.createContext();

      // Bootstrap: console capture, the RPC bridge, and the `external_*`
      // globals. `$0`/`$1` are References to the host functions; they stay in
      // this closure's scope and are never attached to guest-reachable
      // objects — guest code only sees plain functions that close over them.
      await context.evalClosure(
        `
        const __rpc = (tool, args) => {
          let argsJson;
          try { argsJson = JSON.stringify(args === undefined ? null : args); } catch (e) {
            return Promise.reject(new Error('Arguments passed to an external_* function must be JSON-serializable'));
          }
          return $0
            .apply(undefined, [String(tool), argsJson], { result: { promise: true, copy: true } })
            .then((json) => {
              const res = JSON.parse(json);
              if (res.ok) return res.result;
              const err = new Error((res.error && res.error.message) || 'external tool failed');
              if (res.error && res.error.name) err.name = res.error.name;
              throw err;
            });
        };
        const __safeStringify = (value) => {
          try { return JSON.stringify(value); } catch { return String(value); }
        };
        const __log = (level, args) => {
          const message = args.map((a) => (typeof a === 'string' ? a : __safeStringify(a))).join(' ');
          $1.applyIgnored(undefined, [message]);
        };
        globalThis.console = Object.freeze({
          log: (...args) => __log('log', args),
          info: (...args) => __log('info', args),
          warn: (...args) => __log('warn', args),
          error: (...args) => __log('error', args),
        });
        for (const { externalName, toolId } of ${JSON.stringify(externals)}) {
          globalThis['external_' + externalName] = (input) => __rpc(toolId, input);
        }
        `,
        [rpcHost, logHost],
        { arguments: { reference: true } },
      );

      // The guest returns a JSON envelope string so results and errors cross
      // the boundary as data, mirroring the frame protocol's JSON semantics.
      const evalSource = `
        (async () => {
          const __user = ${strippedProgram}
          try {
            const __result = await __user();
            try {
              const json = JSON.stringify({ ok: true, value: __result });
              return json === undefined ? '{"ok":true}' : json;
            } catch {
              return JSON.stringify({
                ok: false,
                error: { message: 'Code Mode result is not JSON-serializable', name: 'TypeError' },
              });
            }
          } catch (e) {
            return JSON.stringify({
              ok: false,
              error: { message: (e && e.message) || String(e), name: e && e.name },
            });
          }
        })()
      `;

      // Two timeout layers: the eval `timeout` interrupts runaway synchronous
      // code; the host timer covers time spent awaiting (RPC round trips,
      // guest promises) by disposing the isolate, which rejects the eval.
      const timeoutPromise = new Promise<'timeout'>(resolve => {
        timer = setTimeout(() => {
          timedOut = true;
          resolve('timeout');
          disposeIsolate();
        }, timeout);
      });

      // isolated-vm types this as a nested promise; `await` flattens it and
      // `copy: true` guarantees the resolved value is the guest's JSON string.
      const evalPromise = context.eval(evalSource, {
        promise: true,
        copy: true,
        timeout,
      }) as unknown as Promise<string>;

      const outcome = await Promise.race([
        evalPromise.then(
          json => ({ kind: 'done' as const, json, error: undefined }),
          error => ({ kind: 'error' as const, json: undefined, error }),
        ),
        timeoutPromise.then(() => ({ kind: 'timeout' as const, json: undefined, error: undefined })),
      ]);

      if (outcome.kind === 'timeout' || timedOut) {
        return {
          success: false,
          logs,
          error: { message: `Code Mode execution timed out after ${timeout}ms`, name: 'TimeoutError' },
        };
      }

      if (outcome.kind === 'error') {
        const err = outcome.error as { message?: string; name?: string };
        if (abortSignal?.aborted) {
          return { success: false, logs, error: { message: 'Code Mode execution aborted', name: 'AbortError' } };
        }
        // The eval `timeout` option rejects with "Script execution timed out".
        if (/timed out/i.test(err?.message ?? '')) {
          return {
            success: false,
            logs,
            error: { message: `Code Mode execution timed out after ${timeout}ms`, name: 'TimeoutError' },
          };
        }
        return {
          success: false,
          logs,
          error: { message: err?.message ?? String(outcome.error), name: err?.name },
        };
      }

      const envelope = JSON.parse(outcome.json) as GuestResultEnvelope;
      return envelope.ok
        ? { success: true, result: envelope.value, logs }
        : { success: false, error: envelope.error, logs };
    } finally {
      if (timer) clearTimeout(timer);
      abortSignal?.removeEventListener('abort', onAbort);
      disposeIsolate();
    }
  }
}
