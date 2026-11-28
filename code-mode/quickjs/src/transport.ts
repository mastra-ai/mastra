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
 * `ts-blank-space` wraps `typescript`, whose module initialisation touches
 * CommonJS globals such as `__filename` that hosted runtimes like workerd do not
 * provide, so it is imported lazily — merely importing this package no longer
 * evaluates it, and a caller that injects its own `stripTypes` avoids it
 * entirely. A caller that does not, on such a host, gets an error naming the fix
 * rather than the `ReferenceError` from inside `typescript`.
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

import { createCodeModeLogCollector, sanitizeToolId } from '@mastra/core/tools';
import type { CodeModeToolResult, CodeModeTransport } from '@mastra/core/tools';
import { getQuickJS } from 'quickjs-emscripten';
import type { QuickJSDeferredPromise, QuickJSHandle, QuickJSWASMModule } from 'quickjs-emscripten';

/** Default interpreter heap limit, in MiB. */
const DEFAULT_MEMORY_LIMIT_MB = 128;

/**
 * Default interpreter stack limit, in bytes. Guards runaway recursion. Kept low
 * enough that QuickJS's own guard trips before the host's native stack (smallest
 * on arm64), so deep recursion is a catchable guest error, not a host crash.
 */
const DEFAULT_MAX_STACK_SIZE_BYTES = 256 * 1024;

/** How long the guest's leftover job queue may run while being drained. */
const DRAIN_BUDGET_MS = 50;

/** Upper bound on drain passes, so a job queue that refills cannot spin forever. */
const MAX_DRAIN_PASSES = 10;

/**
 * Strips TypeScript type syntax, returning equivalent JavaScript.
 *
 * The function receives the whole program the guest will run, wrapped in an
 * async arrow function expression, and must return the JavaScript to evaluate.
 */
export type QuickJsStripTypes = (code: string) => string;

/**
 * Resolves the default TypeScript stripper (`ts-blank-space`) on first use.
 *
 * The import is deliberately dynamic: `ts-blank-space` is a thin wrapper around
 * `typescript`, whose module initialisation reads CommonJS globals such as
 * `__filename`. A *static* import would therefore turn merely importing this
 * package into a startup crash on hosted runtimes that do not provide them.
 * Deferring it means the dependency is only ever evaluated by a run that
 * actually needs it — never for a caller that injects its own `stripTypes`.
 */
let defaultStripTypesPromise: Promise<QuickJsStripTypes> | undefined;

/**
 * Picks the callable stripper out of a module namespace. The ESM build exposes
 * it as the default export, but a bundler's CommonJS interop can wrap it once or
 * twice, so unwrap until a function falls out.
 */
function resolveStripper(module: unknown): QuickJsStripTypes {
  let candidate: unknown = module;
  for (let depth = 0; depth < 4; depth++) {
    if (typeof candidate === 'function') return candidate as QuickJsStripTypes;
    if (candidate !== null && typeof candidate === 'object' && 'default' in candidate) {
      candidate = (candidate as { default: unknown }).default;
      continue;
    }
    break;
  }
  throw new Error('ts-blank-space did not expose a callable default export');
}

async function loadTsBlankSpace(): Promise<QuickJsStripTypes> {
  try {
    return resolveStripper(await import('ts-blank-space'));
  } catch (error) {
    // Do not cache a failure: a later run should be able to try again.
    defaultStripTypesPromise = undefined;
    throw error;
  }
}

function loadDefaultStripTypes(): Promise<QuickJsStripTypes> {
  defaultStripTypesPromise ??= loadTsBlankSpace();
  return defaultStripTypesPromise;
}

export interface QuickJsCodeModeTransportOptions {
  /**
   * QuickJS heap limit in MiB. Exceeding it terminates the program.
   * Default: 128.
   */
  memoryLimitMb?: number;

  /**
   * QuickJS stack limit in bytes. Exceeding it terminates the program.
   * Default: 256 KiB. Raising it can let deep recursion overflow the host's
   * native stack and crash the process, notably on arm64.
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

  /**
   * Erases TypeScript type syntax before the program is evaluated. Defaults to
   * `ts-blank-space`, loaded lazily on the first run that needs it.
   *
   * Supply your own when the default cannot run in your environment — for
   * example a hosted runtime where `ts-blank-space`'s dependency on `typescript`
   * cannot be initialised. The function receives the program wrapped in an async
   * arrow function expression and must return the JavaScript to evaluate; pass an
   * identity function only for programs that are already plain JavaScript.
   */
  stripTypes?: QuickJsStripTypes;

  /**
   * Maximum number of QuickJS interrupt-handler checks a single run may consume
   * before it is interrupted and fails with an `ExecutionLimitError`. Optional,
   * with no default budget: when omitted, only the wall-clock `timeout` and the
   * `abortSignal` can stop runaway guest code.
   *
   * A tick is one interrupt-handler check, not a millisecond and not a portable
   * opcode count, so treat the budget as a coarse guard against guest code that
   * spins — it is the only guard that still works when the host clock is frozen
   * or unreliable, as it is on some hosted runtimes.
   */
  maxInterruptTicks?: number;

  /**
   * Called on every interrupt-handler check, after the wall-clock and
   * `maxInterruptTicks` guards. Returning `true` interrupts the run, which fails
   * with an `InterruptError`. A predicate that throws is treated as an
   * interruption rather than being allowed to crash the host.
   */
  shouldInterrupt?: () => boolean;
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
  readonly #stripTypes: QuickJsStripTypes | undefined;
  readonly #maxInterruptTicks: number | undefined;
  readonly #shouldInterrupt: (() => boolean) | undefined;

  constructor(options: QuickJsCodeModeTransportOptions = {}) {
    this.#memoryLimitMb = options.memoryLimitMb ?? DEFAULT_MEMORY_LIMIT_MB;
    this.#maxStackSizeBytes = options.maxStackSizeBytes ?? DEFAULT_MAX_STACK_SIZE_BYTES;
    this.#module = options.module;
    this.#stripTypes = options.stripTypes;
    if (
      options.maxInterruptTicks !== undefined &&
      (!Number.isInteger(options.maxInterruptTicks) || options.maxInterruptTicks < 1)
    ) {
      throw new RangeError('maxInterruptTicks must be a finite positive integer');
    }
    this.#maxInterruptTicks = options.maxInterruptTicks;
    this.#shouldInterrupt = options.shouldInterrupt;
  }

  async run(opts: Parameters<CodeModeTransport['run']>[0]): Promise<CodeModeToolResult> {
    const {
      program,
      toolIds,
      dispatch,
      timeout,
      abortSignal,
      onExternalCall,
      onExternalResult,
      maxLogBytes,
      maxLogLines,
    } = opts;
    const maxInterruptTicks = this.#maxInterruptTicks;
    const shouldInterrupt = this.#shouldInterrupt;

    const externals = toolIds.map(toolId => ({ toolId, externalName: sanitizeToolId(toolId) }));
    const allowList = new Set(toolIds);
    // Bounded capture: an unbounded `console.log` loop in guest code cannot grow
    // this buffer for the lifetime of the run.
    const logs = createCodeModeLogCollector({ maxLogBytes, maxLogLines });

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
    // core runner's program module. The default stripper only erases types, so it
    // leaves genuine syntax errors alone — those surface from `evalCode` below
    // as a real SyntaxError, with QuickJS's own diagnostics.
    //
    // An injected stripper is used as-is and skips the default entirely, so a
    // host that cannot initialise `ts-blank-space` pays nothing for it. A caller
    // that omits `stripTypes` on such a host would otherwise see the raw
    // `ReferenceError` raised from inside `typescript`; name the fix instead.
    let strip: QuickJsStripTypes;
    if (this.#stripTypes) {
      strip = this.#stripTypes;
    } else {
      try {
        strip = await loadDefaultStripTypes();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `The default TypeScript stripper could not be loaded (${message}). A runtime without Node.js globals, such as Cloudflare Workers, cannot load it at all, so pass a stripTypes function: for a program that is already plain JavaScript, stripTypes: (code) => code is enough.`,
          { cause: error },
        );
      }
    }
    let strippedProgram: string;
    try {
      strippedProgram = strip(`(async () => {\n${program}\n})`);
    } catch (error) {
      const err = error as { message?: string };
      return {
        success: false,
        logs: logs.logs(),
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
      return {
        success: false,
        logs: logs.logs(),
        error: { message: 'Code Mode execution aborted', name: 'AbortError' },
      };
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
    const deadline = Date.now() + timeout;

    // One interrupt policy governs every period of guest execution — the
    // bootstrap, the main evaluation and the microtask pumping around it. The
    // final drain opts out of it and runs under its own deadline (see below).
    // QuickJS calls the handler between operations, and a truthy return unwinds
    // whatever guest code is running. It cannot help while the guest is merely
    // awaiting a host call — no guest code is running then — which is what the
    // host-side races below are for.
    //
    // Order matters: outer cancellation and the wall clock keep their existing
    // precedence, and only then do the new, clock-independent budgets apply.
    let interruptTicks = 0;
    let drainDeadline = 0;
    let draining = false;
    let interrupted: 'timeout' | 'abort' | 'limit' | 'predicate' | undefined;

    const interruptHandler = (): boolean => {
      // The drain is exempt from the policy below. It exists to unwind guest
      // jobs left over by a run that already ended, so the conditions that ended
      // that run — an abort signal still aborted, a tick budget already spent, a
      // predicate that already returned true — must not be re-applied to it. It
      // runs under its own short deadline instead.
      if (draining) return Date.now() >= drainDeadline;
      if (abortSignal?.aborted) {
        interrupted = 'abort';
        return true;
      }
      // Wall clock. The drain returns above on its own deadline, so this is the
      // run deadline proper.
      if (Date.now() >= deadline) {
        interrupted = 'timeout';
        return true;
      }
      // A tick is one interrupt-handler check, not a millisecond and not a
      // portable opcode count, so this is a coarse but clock-independent guard
      // against guest code that spins. `>=` is deliberate: the limit is the
      // number of ticks the run may consume before it is interrupted.
      interruptTicks += 1;
      if (maxInterruptTicks !== undefined && interruptTicks >= maxInterruptTicks) {
        interrupted = 'limit';
        return true;
      }
      if (shouldInterrupt) {
        // A predicate that throws must fail closed as an ordinary result, never
        // as a host crash.
        let stop: boolean;
        try {
          stop = shouldInterrupt();
        } catch {
          stop = true;
        }
        if (stop) {
          interrupted = 'predicate';
          return true;
        }
      }
      return false;
    };

    const drainJobs = (): void => {
      drainDeadline = Date.now() + DRAIN_BUDGET_MS;
      draining = true;
      runtime.setInterruptHandler(interruptHandler);
      try {
        for (let pass = 0; pass < MAX_DRAIN_PASSES && Date.now() < drainDeadline; pass++) {
          const jobs = runtime.executePendingJobs();
          jobs.error?.dispose();
          if (!jobs.error && jobs.value === 0) break;
        }
      } finally {
        draining = false;
        runtime.removeInterruptHandler();
      }
    };

    const cleanup = (): void => {
      if (finished) return;
      finished = true;
      for (const deferred of pendingDeferreds) deferred.dispose();
      pendingDeferreds.clear();
      abandonedGuestResult?.value?.dispose();
      abandonedGuestResult?.error?.dispose();
      abandonedGuestResult = undefined;

      // Guest jobs still run here, so keep them under the heap limit.
      drainJobs();
      // Freeing the runtime can itself need to allocate. If it is still pinned
      // at its heap limit (the OOM case), those allocations fail, objects
      // survive, and JS_FreeRuntime aborts the whole WASM module. No guest code
      // runs past this point, so lifting the limit is safe.
      runtime.setMemoryLimit(-1);
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

    runtime.setInterruptHandler(interruptHandler);

    const timedOutResult = (): CodeModeToolResult => ({
      success: false,
      logs: logs.logs(),
      error: { message: `Code Mode execution timed out after ${timeout}ms`, name: 'TimeoutError' },
    });
    const abortedResult = (): CodeModeToolResult => ({
      success: false,
      logs: logs.logs(),
      error: { message: 'Code Mode execution aborted', name: 'AbortError' },
    });

    // Outer cancellation keeps its existing precedence; the clock-independent
    // budgets are only consulted when the run was neither aborted nor timed out.
    // Returns undefined for an ordinary guest failure, so the caller can report
    // the guest's own error.
    const interruptedResult = (): CodeModeToolResult | undefined => {
      if (interrupted === 'abort' || abortSignal?.aborted) return abortedResult();
      if (interrupted === 'timeout') return timedOutResult();
      if (interrupted === 'limit') {
        return {
          success: false,
          logs: logs.logs(),
          error: {
            message: `Code Mode execution interrupted after ${maxInterruptTicks} interrupt ticks (maxInterruptTicks)`,
            name: 'ExecutionLimitError',
          },
        };
      }
      if (interrupted === 'predicate') {
        return {
          success: false,
          logs: logs.logs(),
          error: { message: 'Code Mode execution interrupted by shouldInterrupt', name: 'InterruptError' },
        };
      }
      return undefined;
    };

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
        // The interrupt guards also cover the bootstrap, so an interruption here
        // (for example a predicate that stops the run before the program starts)
        // must surface as the matching error, not a generic bootstrap failure.
        const mapped = interruptedResult();
        if (mapped) return mapped;
        return { success: false, logs: logs.logs(), error: { message: err?.message ?? 'Code Mode bootstrap failed' } };
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
        const mapped = interruptedResult();
        if (mapped) return mapped;
        return {
          success: false,
          logs: logs.logs(),
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
        const mapped = interruptedResult();
        if (mapped) return mapped;
        return {
          success: false,
          logs: logs.logs(),
          error: { message: err?.message ?? 'Code Mode evaluation failed', name: err?.name },
        };
      }

      const json = context.getString(settled.value);
      settled.value.dispose();
      const envelope = JSON.parse(json) as GuestResultEnvelope;
      return envelope.ok
        ? { success: true, result: envelope.value, logs: logs.logs() }
        : { success: false, error: envelope.error, logs: logs.logs() };
    } finally {
      if (timer) clearTimeout(timer);
      if (onAbort) abortSignal?.removeEventListener('abort', onAbort);
      runtime.removeInterruptHandler();
      cleanup();
    }
  }
}
