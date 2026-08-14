/**
 * Code Mode — QuickJS (WebAssembly) transport
 *
 * Runs the model's TypeScript program inside an in-process QuickJS interpreter
 * compiled to WebAssembly, instead of a WorkspaceSandbox. The interpreter is a
 * real security boundary: QuickJS starts with a bare global object, so the
 * guest has no filesystem, network, process, timer, or module access — the only
 * capabilities are the injected `external_*` functions, which call back into the
 * host dispatcher (allow-list enforced host-side).
 *
 * This is the sibling of `@mastra/isolated-vm`, and the two are interchangeable.
 * The difference is deployment cost:
 *
 * - `isolated-vm` is a native addon and, on Node 20+, requires the host process
 *   to be started with `--no-node-snapshot`. Neither is available on most
 *   serverless platforms.
 * - QuickJS is WebAssembly. No native binary, no install step, no Node flags,
 *   and it also runs in the browser. The tradeoff is speed: an interpreter in
 *   WASM is materially slower than V8, which is an acceptable trade for the
 *   tool-orchestration workloads Code Mode targets.
 *
 * Host calls cross the WASM boundary as JSON strings in both directions, so no
 * host object references are ever exposed to guest code.
 *
 * TypeScript is stripped on the host with `ts-blank-space` — a pure-JavaScript
 * type eraser, deliberately chosen over esbuild, which is itself a native binary
 * and would reintroduce the very dependency this package exists to avoid.
 *
 * ## Concurrency
 *
 * `quickjs-emscripten` ships an "asyncify" build whose host functions may be
 * `async`, which looks like the natural fit. It is not usable here: an asyncified
 * module can only suspend for one async call at a time, and re-entering a
 * suspended module crashes it. Code Mode's whole value is batching tool calls
 * with `Promise.all`.
 *
 * So this transport uses the regular synchronous build. Each `external_*` call
 * hands the guest a deferred promise and returns control to the host
 * immediately, without suspending. The host settles the deferred whenever the
 * real dispatch finishes and pumps the guest's microtask queue. Any number of
 * calls can therefore be in flight at once.
 */

import { sanitizeToolId } from '@mastra/core/tools';
import type { CodeModeToolResult, CodeModeTransport } from '@mastra/core/tools';
import { getQuickJS } from 'quickjs-emscripten';
import type { QuickJSDeferredPromise, QuickJSHandle, QuickJSWASMModule } from 'quickjs-emscripten';
import tsBlankSpace from 'ts-blank-space';

/** Default interpreter heap limit, in MiB. */
const DEFAULT_MEMORY_LIMIT_MB = 128;

/** Default interpreter stack limit, in bytes. Guards runaway recursion. */
const DEFAULT_MAX_STACK_SIZE_BYTES = 1024 * 1024;

/** How long the guest's leftover job queue may run while being drained. */
const DRAIN_BUDGET_MS = 50;

/** Upper bound on drain passes, so a job queue that refills cannot spin forever. */
const MAX_DRAIN_PASSES = 10;

export interface QuickJsCodeModeTransportOptions {
  /**
   * QuickJS heap limit in MiB. Exceeding it terminates the program.
   * Default: 128.
   */
  memoryLimitMb?: number;

  /**
   * QuickJS stack limit in bytes. Exceeding it terminates the program.
   * Default: 1 MiB.
   */
  maxStackSizeBytes?: number;

  /**
   * A pre-loaded QuickJS WebAssembly module.
   *
   * Defaults to the shared release build resolved by `getQuickJS()`, which is
   * what most callers want. Supply your own to pin a specific variant — for
   * example a single-file variant that suits your bundler, or the debug build
   * with its leak sanitizer during testing.
   */
  module?: QuickJSWASMModule;
}

/** The success and failure handles of a QuickJS call result, either of which must be freed. */
interface VmResultHandles {
  value?: QuickJSHandle;
  error?: QuickJSHandle;
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
 * Code Mode transport that executes programs in an in-process QuickJS
 * interpreter compiled to WebAssembly.
 *
 * No sandbox is required — the interpreter is the execution boundary
 * (`requiresSandbox: false`).
 *
 * @example
 * ```typescript
 * import { createCodeMode } from '@mastra/core/tools';
 * import { QuickJsCodeModeTransport } from '@mastra/quickjs';
 *
 * const { tool, instructions } = createCodeMode(
 *   { tools: { getWeather, getForecast } },
 *   new QuickJsCodeModeTransport({ memoryLimitMb: 128 }),
 * );
 * ```
 */
export class QuickJsCodeModeTransport implements CodeModeTransport {
  readonly requiresSandbox = false;

  readonly #memoryLimitMb: number;
  readonly #maxStackSizeBytes: number;
  readonly #module: QuickJSWASMModule | undefined;

  constructor(options: QuickJsCodeModeTransportOptions = {}) {
    this.#memoryLimitMb = options.memoryLimitMb ?? DEFAULT_MEMORY_LIMIT_MB;
    this.#maxStackSizeBytes = options.maxStackSizeBytes ?? DEFAULT_MAX_STACK_SIZE_BYTES;
    this.#module = options.module;
  }

  async run(opts: Parameters<CodeModeTransport['run']>[0]): Promise<CodeModeToolResult> {
    const { program, toolIds, dispatch, timeout, abortSignal, onExternalCall, onExternalResult } = opts;

    const externals = toolIds.map(toolId => ({ toolId, externalName: sanitizeToolId(toolId) }));
    const allowList = new Set(toolIds);
    const logs: string[] = [];

    // Observer hooks are caller-supplied and best-effort: a throwing hook must
    // never prevent the RPC from responding, or the matching in-guest promise
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

    // Strip TypeScript on the host; QuickJS runs plain JavaScript. Wrapping in
    // an async arrow makes top-level `return`/`await`/`const` legal, same as the
    // core runner's program module. ts-blank-space only erases types, so it
    // leaves genuine syntax errors alone — those surface from `evalCode` below
    // as a real SyntaxError, with QuickJS's own diagnostics.
    let strippedProgram: string;
    try {
      strippedProgram = tsBlankSpace(`(async () => {\n${program}\n})`);
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
    // guest. Errors are returned in the envelope (never thrown) so the guest can
    // rebuild them with the original error name.
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

    const wasm = this.#module ?? (await getQuickJS());

    if (abortSignal?.aborted) {
      return { success: false, logs, error: { message: 'Code Mode execution aborted', name: 'AbortError' } };
    }

    const runtime = wasm.newRuntime();
    runtime.setMemoryLimit(this.#memoryLimitMb * 1024 * 1024);
    runtime.setMaxStackSize(this.#maxStackSizeBytes);
    const context = runtime.newContext();

    // Every QuickJS handle must be disposed by hand, and an undisposed one
    // aborts the whole WASM module when the runtime is freed. All disposal
    // therefore happens here, once, covering deferreds that are still unsettled
    // because the run timed out or was aborted while a dispatch was in flight.
    const pendingDeferreds = new Set<QuickJSDeferredPromise>();
    let abandonedGuestResult: VmResultHandles | undefined;
    let finished = false;

    // A run that ends early — timed out, aborted, or interrupted mid-job — leaves
    // guest work sitting in the job queue, and those jobs still reference guest
    // objects. QuickJS asserts that no objects survive when a runtime is freed,
    // so the queue has to be drained first. The drain gets its own short
    // deadline, since the very work being drained may be the runaway code that
    // ended the run.
    const drainJobs = (): void => {
      const drainDeadline = Date.now() + DRAIN_BUDGET_MS;
      runtime.setInterruptHandler(() => Date.now() >= drainDeadline);
      for (let pass = 0; pass < MAX_DRAIN_PASSES && Date.now() < drainDeadline; pass++) {
        const jobs = runtime.executePendingJobs();
        jobs.error?.dispose();
        if (!jobs.error && jobs.value === 0) break;
      }
      runtime.removeInterruptHandler();
    };

    const cleanup = (): void => {
      if (finished) return;
      finished = true;
      for (const deferred of pendingDeferreds) deferred.dispose();
      pendingDeferreds.clear();
      abandonedGuestResult?.value?.dispose();
      abandonedGuestResult?.error?.dispose();
      abandonedGuestResult = undefined;

      drainJobs();
      context.dispose();
      runtime.dispose();
    };

    // Draining the guest's microtask queue can itself fail — most importantly
    // when the interrupt handler unwinds a job that ran away. That failure comes
    // back as a handle which, left undisposed, aborts the WASM module when the
    // runtime is freed.
    const pumpJobs = (): void => {
      if (finished) return;
      const jobs = runtime.executePendingJobs();
      jobs.error?.dispose();
    };

    const deadline = Date.now() + timeout;
    let interrupted: 'timeout' | 'abort' | undefined;
    // The only way to stop a runaway synchronous program: QuickJS calls this
    // between operations, and a truthy return unwinds the evaluation. It cannot
    // help while the guest is merely awaiting a host call — no guest code is
    // running then — which is what the host-side races below are for.
    runtime.setInterruptHandler(() => {
      if (abortSignal?.aborted) {
        interrupted = 'abort';
        return true;
      }
      if (Date.now() >= deadline) {
        interrupted = 'timeout';
        return true;
      }
      return false;
    });

    const timedOutResult = (): CodeModeToolResult => ({
      success: false,
      logs,
      error: { message: `Code Mode execution timed out after ${timeout}ms`, name: 'TimeoutError' },
    });
    const abortedResult = (): CodeModeToolResult => ({
      success: false,
      logs,
      error: { message: 'Code Mode execution aborted', name: 'AbortError' },
    });

    let timer: NodeJS.Timeout | undefined;
    let onAbort: (() => void) | undefined;

    try {
      // Host bridge for `external_*`. Returns a deferred promise to the guest
      // and returns immediately without suspending the module, so any number of
      // dispatches can be in flight at once and `Promise.all` behaves normally.
      const hostCall = context.newFunction('__hostCall', (toolHandle, argsHandle) => {
        const tool = context.getString(toolHandle);
        const argsJson = context.getString(argsHandle);
        const deferred = context.newPromise();
        pendingDeferreds.add(deferred);

        void rpcHost(tool, argsJson).then(json => {
          // The run may already be over (timeout/abort) and the context freed;
          // touching it here would crash the WASM module.
          if (finished) return;
          const resultHandle = context.newString(json);
          deferred.resolve(resultHandle);
          resultHandle.dispose();
          pendingDeferreds.delete(deferred);
          deferred.dispose();
        });

        // Settling a promise only queues the guest's continuation; QuickJS runs
        // it when jobs are pumped.
        void deferred.settled.then(pumpJobs);

        return deferred.handle;
      });
      context.setProp(context.global, '__hostCall', hostCall);
      hostCall.dispose();

      const hostLog = context.newFunction('__hostLog', messageHandle => {
        logs.push(context.getString(messageHandle));
      });
      context.setProp(context.global, '__hostLog', hostLog);
      hostLog.dispose();

      // Bootstrap: console capture and the `external_*` globals. The guest only
      // ever sees plain functions closing over the two host bridges.
      const bootstrap = context.evalCode(`
        (() => {
          const __hostCall = globalThis.__hostCall;
          const __hostLog = globalThis.__hostLog;
          delete globalThis.__hostCall;
          delete globalThis.__hostLog;

          const __rpc = (tool, args) => {
            let argsJson;
            try {
              argsJson = JSON.stringify(args === undefined ? null : args);
            } catch (e) {
              return Promise.reject(
                new Error('Arguments passed to an external_* function must be JSON-serializable'),
              );
            }
            return __hostCall(String(tool), argsJson).then((json) => {
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
          const __log = (args) => {
            __hostLog(args.map((a) => (typeof a === 'string' ? a : __safeStringify(a))).join(' '));
          };
          globalThis.console = Object.freeze({
            log: (...args) => __log(args),
            info: (...args) => __log(args),
            warn: (...args) => __log(args),
            error: (...args) => __log(args),
          });

          for (const { externalName, toolId } of ${JSON.stringify(externals)}) {
            globalThis['external_' + externalName] = (input) => __rpc(toolId, input);
          }
        })()
      `);
      if (bootstrap.error) {
        const err = context.dump(bootstrap.error) as { message?: string };
        bootstrap.error.dispose();
        return { success: false, logs, error: { message: err?.message ?? 'Code Mode bootstrap failed' } };
      }
      bootstrap.value.dispose();

      // The guest returns a JSON envelope string so results and errors cross the
      // boundary as data, mirroring the frame protocol's JSON semantics.
      const evalResult = context.evalCode(`
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
      `);

      if (evalResult.error) {
        const err = context.dump(evalResult.error) as { message?: string; name?: string };
        evalResult.error.dispose();
        if (interrupted === 'abort' || abortSignal?.aborted) return abortedResult();
        if (interrupted === 'timeout') return timedOutResult();
        return {
          success: false,
          logs,
          error: { message: err?.message ?? 'Code Mode evaluation failed', name: err?.name },
        };
      }

      const guestPromise = context.resolvePromise(evalResult.value);
      evalResult.value.dispose();

      // The guest can settle and still lose the race below — an abort or timeout
      // that lands in the same turn wins, and the result is discarded. Its handle
      // is real either way, so record it for disposal rather than stranding it.
      void guestPromise.then(result => {
        // Once the context is gone there is nothing left to free, and touching a
        // handle from it would crash the module.
        if (finished) return;
        abandonedGuestResult = result as VmResultHandles;
      });

      pumpJobs();

      // Covers time the guest spends awaiting rather than executing, where the
      // interrupt handler cannot reach: a dispatch that never resolves, or an
      // abort that lands between guest turns.
      const timeoutPromise = new Promise<'timeout'>(resolve => {
        timer = setTimeout(() => resolve('timeout'), Math.max(0, deadline - Date.now()));
      });
      const abortPromise = new Promise<'abort'>(resolve => {
        if (!abortSignal) return;
        // The signal can already have fired: pumping the job queue above runs
        // guest code, which can reach a dispatch that aborts synchronously, and
        // an `abort` listener added afterwards would never be called.
        if (abortSignal.aborted) return resolve('abort');
        onAbort = () => resolve('abort');
        abortSignal.addEventListener('abort', onAbort, { once: true });
      });

      const outcome = await Promise.race([
        guestPromise.then(result => ({ kind: 'settled' as const, result })),
        timeoutPromise.then(() => ({ kind: 'timeout' as const, result: undefined })),
        abortPromise.then(() => ({ kind: 'abort' as const, result: undefined })),
      ]);

      if (outcome.kind !== 'settled') {
        // The guest may be one job away from producing a result nobody will read.
        // Let it land while the context is still alive, so its handle is recorded
        // and freed rather than stranded.
        drainJobs();
        await Promise.resolve();
        return outcome.kind === 'abort' ? abortedResult() : timedOutResult();
      }

      const settled = outcome.result;
      abandonedGuestResult = undefined;
      if (settled.error) {
        const err = context.dump(settled.error) as { message?: string; name?: string };
        settled.error.dispose();
        if (interrupted === 'abort' || abortSignal?.aborted) return abortedResult();
        if (interrupted === 'timeout') return timedOutResult();
        return {
          success: false,
          logs,
          error: { message: err?.message ?? 'Code Mode evaluation failed', name: err?.name },
        };
      }

      const json = context.getString(settled.value);
      settled.value.dispose();
      const envelope = JSON.parse(json) as GuestResultEnvelope;
      return envelope.ok
        ? { success: true, result: envelope.value, logs }
        : { success: false, error: envelope.error, logs };
    } finally {
      if (timer) clearTimeout(timer);
      if (onAbort) abortSignal?.removeEventListener('abort', onAbort);
      runtime.removeInterruptHandler();
      cleanup();
    }
  }
}
