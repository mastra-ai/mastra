/**
 * Code Mode — tool factory
 *
 * `createCodeMode(config)` returns the `execute_typescript` tool plus the
 * generated `instructions`. The tool transpiles the model's TypeScript to JS,
 * runs it in a WorkspaceSandbox via the transport, and bridges each
 * `external_*` call back to the real Mastra tool on the host.
 */

import { z } from 'zod/v4';
import { RequestContext } from '../../request-context';
import type { WorkspaceSandbox } from '../../workspace/sandbox/sandbox';
import { createTool } from '../tool';
import type { Tool } from '../tool';
import { isValidationError } from '../validation';
import { createCodeModeLogCollector } from './log-collector';
import { createCodeModeInstructions } from './stub-generator';
import { StdioCodeModeTransport } from './transport';
import { CodeModeLimitError } from './types';
import type { CodeModeConfig, CodeModeToolDispatcher, CodeModeToolResult, CodeModeTransport } from './types';

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_TOOL_NAME = 'execute_typescript';

/**
 * Validate an optional numeric limit, throwing an actionable error before any
 * guest code runs. Counts and concurrency require at least 1; byte/line caps
 * accept 0 to mean "capture nothing".
 */
function assertLimit(value: number | undefined, name: string, minimum: number): void {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < minimum) {
    const requirement = minimum === 0 ? 'a non-negative integer' : 'a positive integer';
    throw new RangeError(`Code Mode option "${name}" must be ${requirement}; received ${String(value)}`);
  }
}

const utf8Encoder = new TextEncoder();

/**
 * UTF-8 byte size of a nested tool result's JSON representation. Returns 0 for
 * values JSON cannot serialize (undefined, functions, circular references),
 * preserving the transport's existing non-serializable-result behavior.
 */
function codeModeResultBytes(result: unknown): number {
  let json: string | undefined;
  try {
    json = JSON.stringify(result);
  } catch {
    return 0;
  }
  return json === undefined ? 0 : utf8Encoder.encode(json).length;
}

interface CodeModeSemaphoreWaiter {
  resolve: () => void;
  reject: (error: unknown) => void;
}

/**
 * Abort-aware FIFO semaphore. At most `limit` tasks run at once; excess callers
 * wait in arrival order. Every slot is released in `finally`, and waiters reject
 * on abort without running their task.
 *
 * Both ends are O(1) amortized and do no work proportional to the queue size:
 * the run's signal carries a single listener (per-waiter listeners make
 * `addEventListener`/`removeEventListener` quadratic once thousands of calls are
 * queued), and the queue is drained by advancing a head index. Guest code
 * controls how many calls it queues, so a large backlog must stay cheap.
 */
function createCallSemaphore(limit: number, signal: AbortSignal) {
  const abortReason = () => signal.reason ?? new Error('Code Mode execution aborted');
  let active = 0;
  let waiters: CodeModeSemaphoreWaiter[] = [];
  let head = 0;

  // One listener for the whole run: on abort, reject every queued waiter at once.
  signal.addEventListener(
    'abort',
    () => {
      const pending = waiters.slice(head);
      waiters = [];
      head = 0;
      for (const waiter of pending) waiter.reject(abortReason());
    },
    { once: true },
  );

  const release = () => {
    active -= 1;
    while (head < waiters.length) {
      const next = waiters[head++];
      if (next) {
        active += 1;
        next.resolve();
        return;
      }
    }
    // Queue drained; drop the consumed entries so they are not retained.
    waiters = [];
    head = 0;
  };

  const acquire = (): Promise<void> => {
    if (signal.aborted) return Promise.reject(abortReason());
    if (active < limit) {
      active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      waiters.push({ resolve, reject });
    });
  };

  return {
    async run<T>(task: () => Promise<T>): Promise<T> {
      await acquire();
      try {
        return await task();
      } finally {
        release();
      }
    },
  };
}

const codeModeInputSchema = z.object({
  code: z
    .string()
    .describe(
      'A TypeScript program that orchestrates the available external_* tools and returns a final value. ' +
        'Use Promise.all to batch calls; do arithmetic in JS. End with `return <value>`.',
    ),
});

const codeModeOutputSchema = z.object({
  success: z.boolean(),
  result: z.unknown().optional(),
  logs: z.array(z.string()).optional(),
  error: z
    .object({
      message: z.string(),
      name: z.string().optional(),
      line: z.number().optional(),
    })
    .optional(),
});

/** Result of {@link createCodeMode}: the tool plus its generated instructions. */
export interface CodeModeResult {
  tool: Tool<any, any>;
  instructions: string;
}

/** Resolve the tool key -> tool map keyed by the tool's effective id. */
function indexToolsById(config: CodeModeConfig): Map<string, { execute?: (args: any, ctx: any) => Promise<any> }> {
  const map = new Map();
  for (const [key, tool] of Object.entries(config.tools)) {
    const id = (tool as { id?: string }).id ?? key;
    map.set(id, tool);
  }
  return map;
}

/**
 * Create only the `execute_typescript` tool. Most callers want
 * {@link createCodeMode}, which also returns the matching instructions.
 */
export function createCodeModeTool(
  config: CodeModeConfig,
  transport: CodeModeTransport = new StdioCodeModeTransport(),
) {
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;
  const id = config.id ?? DEFAULT_TOOL_NAME;
  const toolsById = indexToolsById(config);
  const toolIds = [...toolsById.keys()];

  // Validate limits up front so a misconfiguration fails before any guest code
  // runs. Counts and concurrency require at least 1; byte/line caps accept 0.
  const { maxCalls, maxConcurrentCalls, maxResultBytes, maxLogBytes, maxLogLines } = config;
  assertLimit(maxCalls, 'maxCalls', 1);
  assertLimit(maxConcurrentCalls, 'maxConcurrentCalls', 1);
  assertLimit(maxResultBytes, 'maxResultBytes', 0);
  assertLimit(maxLogBytes, 'maxLogBytes', 0);
  assertLimit(maxLogLines, 'maxLogLines', 0);

  /**
   * Replay returned logs through the shared collector so a custom transport
   * that ignored the caps still yields bounded output. With no cap configured
   * the same array is returned by identity, leaving transport output untouched.
   */
  const boundLogs = (lines: string[] | undefined): string[] | undefined => {
    if (!lines || (maxLogBytes === undefined && maxLogLines === undefined)) return lines;
    const collector = createCodeModeLogCollector({ maxLogBytes, maxLogLines });
    for (const line of lines) collector.push(line);
    return collector.logs();
  };

  return createTool({
    id,
    description:
      'Execute a TypeScript program that orchestrates the available tools in a sandbox. ' +
      'Prefer this over calling tools one at a time when a task needs multiple tool calls, ' +
      'batching, aggregation, or arithmetic.',
    inputSchema: codeModeInputSchema,
    outputSchema: codeModeOutputSchema,
    execute: async ({ code }, ctx): Promise<CodeModeToolResult> => {
      // Resolve sandbox: explicit config -> workspace from context. There is no
      // implicit fallback: Code Mode runs model-authored code, so the execution
      // boundary must be chosen deliberately. To run locally (host privileges),
      // pass `sandbox: new LocalSandbox()` explicitly. Transports that provide
      // their own execution boundary (e.g. in-process V8 isolates) declare
      // `requiresSandbox: false` and run without one.
      let sandbox: WorkspaceSandbox | undefined = config.sandbox;
      if (!sandbox && transport.requiresSandbox !== false) {
        const requestContext = ctx?.requestContext ?? new RequestContext();
        sandbox = await ctx?.workspace?.resolveSandbox({ requestContext });
        if (!sandbox) {
          throw new Error(
            'Code Mode requires a sandbox to run model-authored code, but none was configured. ' +
              'Pass one to createCodeMode({ tools, sandbox }), or run the agent in a workspace that provides a sandbox. ' +
              'To execute on the host (host privileges — only for trusted/local use), pass `sandbox: new LocalSandbox()`.',
          );
        }
      }

      // Run-scoped cancellation: one controller per execute invocation. The
      // outer signal's reason is forwarded to it, its signal reaches both the
      // transport and every nested tool, and it is aborted when the transport
      // finishes for any reason so leftover nested work stops too.
      const outerSignal = ctx?.abortSignal;
      const runController = new AbortController();
      const forwardAbort = () => runController.abort(outerSignal?.reason);
      if (outerSignal) {
        if (outerSignal.aborted) forwardAbort();
        else outerSignal.addEventListener('abort', forwardAbort, { once: true });
      }

      // Sticky limit failure: the first call/result limit that trips fails the
      // whole run, even if the guest catches the individual rejection.
      let limitError: CodeModeLimitError | undefined;
      let callCount = 0;
      const semaphore =
        maxConcurrentCalls !== undefined ? createCallSemaphore(maxConcurrentCalls, runController.signal) : undefined;

      // Each external_* call re-enters the real Mastra tool pipeline (validation,
      // request-context checks, tracing) on the host, with the outer tool's context.
      const abortReason = () => runController.signal.reason ?? new Error('Code Mode run aborted');

      const dispatch: CodeModeToolDispatcher = async (toolId, args) => {
        // A run that is already aborted — the caller cancelled, or a limit
        // tripped — must not start new nested work, and the abort that came
        // first stays the run's terminal failure.
        if (runController.signal.aborted) throw abortReason();

        // Count every dispatch attempt before doing any work, so a guest cannot
        // exceed the budget by targeting an unavailable tool.
        if (maxCalls !== undefined && ++callCount > maxCalls) {
          const error = new CodeModeLimitError('maxCalls', maxCalls, 'more external tool calls were attempted');
          limitError ??= error;
          runController.abort(error);
          throw limitError;
        }

        const tool = toolsById.get(toolId);
        if (!tool?.execute) {
          throw new Error(`Tool "${toolId}" is not available in Code Mode`);
        }
        // Capture so the narrowing survives into the async closure below. Bind it
        // so a plain ToolAction whose `execute` reads `this` keeps its receiver.
        const execute = tool.execute.bind(tool);

        const invoke = async () => {
          // Covers a call whose slot was granted just before the run aborted.
          if (runController.signal.aborted) throw abortReason();
          const result = await execute(args, {
            mastra: ctx?.mastra,
            requestContext: ctx?.requestContext,
            abortSignal: runController.signal,
            workspace: ctx?.workspace,
          });
          if (isValidationError(result)) {
            throw new Error(result.message ?? `Invalid input for tool "${toolId}"`);
          }
          if (maxResultBytes !== undefined) {
            const size = codeModeResultBytes(result);
            if (size > maxResultBytes) {
              const error = new CodeModeLimitError(
                'maxResultBytes',
                maxResultBytes,
                `a nested tool result was ${size} bytes for tool "${toolId}"`,
              );
              // If the caller aborted while this call was pending, the guest
              // still sees the limit error but the abort stays terminal.
              if (runController.signal.aborted) throw error;
              limitError ??= error;
              runController.abort(error);
              throw limitError;
            }
          }
          return result;
        };

        return semaphore ? semaphore.run(invoke) : invoke();
      };

      // The TypeScript program is written to a .ts module by the transport;
      // the sandbox's node strips the type annotations natively at import.
      const outcome = await (async () => {
        try {
          const value = await ctx.observe.span(`code-mode:${id}`, () =>
            transport.run({
              sandbox,
              program: code,
              toolIds,
              dispatch,
              timeout,
              abortSignal: runController.signal,
              onExternalCall: (tool, args) => ctx.observe.log('info', 'code-mode external call', { tool, args }),
              onExternalResult: (tool, durationMs, error) =>
                ctx.observe.log(error ? 'error' : 'info', 'code-mode external result', { tool, durationMs }),
              maxLogBytes,
              maxLogLines,
            }),
          );
          return { ok: true as const, value };
        } catch (error) {
          return { ok: false as const, error };
        } finally {
          outerSignal?.removeEventListener('abort', forwardAbort);
          // Terminate any in-flight nested tool work once the transport is done.
          if (!runController.signal.aborted) runController.abort();
        }
      })();

      // A named execution limit outranks whatever the transport reported, so a
      // guest that caught the rejection still fails the run.
      if (limitError) {
        return {
          success: false,
          logs: outcome.ok ? boundLogs(outcome.value.logs) : undefined,
          error: { message: limitError.message, name: limitError.name },
        };
      }
      if (!outcome.ok) throw outcome.error;

      // Compatibility guard: a third-party transport may ignore the log caps,
      // so replay its lines through the same collector. Our transports already
      // truncate, and replay is idempotent because the marker is a plain line.
      const bounded = boundLogs(outcome.value.logs);
      return bounded === outcome.value.logs ? outcome.value : { ...outcome.value, logs: bounded };
    },
  }) as unknown as Tool<any, any>;
}

/**
 * Create Code Mode: the `execute_typescript` tool plus generated instructions.
 *
 * @example
 * ```ts
 * const { tool, instructions } = createCodeMode({ tools: { getTopProducts, getProductRatings } });
 * const agent = new Agent({ instructions: ['You are helpful.', instructions], tools: { [tool.id]: tool } });
 * ```
 */
export function createCodeMode(config: CodeModeConfig, transport?: CodeModeTransport): CodeModeResult {
  return {
    tool: createCodeModeTool(config, transport),
    instructions: createCodeModeInstructions(config),
  };
}
