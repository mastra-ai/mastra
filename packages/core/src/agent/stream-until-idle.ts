/**
 * Implementation of `Agent.streamUntilIdle`. Extracted from `agent.ts` to
 * keep that file focused on the public Agent surface. `Agent.streamUntilIdle`
 * is a thin delegate that forwards to `runStreamUntilIdle(this, ..., deps)`.
 *
 * High-level flow:
 * 1. Resolve memory / thread / resource scope (early-return to `agent.stream`
 *    if no memory backend exists — continuations require memory).
 * 2. Register this call as the active wrapper for `(threadId, resourceId)`,
 *    aborting any prior wrapper for the same scope (prevents duplicate
 *    bg-task event fan-out across concurrent calls).
 * 3. Run the initial turn via `agent.stream(...)` and pipe its `fullStream`
 *    into our own combined outer stream.
 * 4. Subscribe to `BackgroundTaskManager.stream(...)` for this scope; when a
 *    terminal bg event arrives, queue it and (when the outer is idle between
 *    turns) re-invoke the agent with a directive listing the just-completed
 *    tool-call IDs. Dedup set guards against at-least-once pubsub delivery.
 * 5. `maxIdleMs` only runs while the wrapper is between turns (not during an
 *    active inner stream) so slow first-tokens don't close the stream.
 */
import type { BackgroundTaskManager } from '../background-tasks/manager';
import { runIdleLoop } from '../loop/shared/stream-until-idle-helpers';
import type { MastraModelOutput } from '../stream/base/output';
import type { Agent } from './agent';
import type { MessageListInput } from './message-list';

/**
 * Dependencies the extracted function needs access to that it can't reach
 * through the public `Agent` surface (e.g. private fields).
 */
export interface StreamUntilIdleDeps {
  /**
   * Map tracking the active `streamUntilIdle` wrapper per scope on the
   * calling Agent. The extracted function reads/writes this map directly so
   * a new call for the same scope can abort any prior still-open wrapper.
   * Lives as `#activeStreamUntilIdle` on the Agent instance.
   */
  activeStreams: Map<string, () => void>;
  /**
   * Optional background task manager resolved from Mastra. When absent,
   * `runStreamUntilIdle` falls through to a plain `agent.stream` call.
   */
  bgManager: BackgroundTaskManager | undefined;
}

/**
 * Run `agent.streamUntilIdle`. See the module doc above for the high-level
 * flow. Returns a `MastraModelOutput` whose `fullStream` spans the initial
 * turn PLUS any continuations triggered by background task completions.
 *
 * Aggregate properties (`text`, `toolCalls`, `toolResults`, `finishReason`,
 * `messageList`, `getFullOutput()`) still resolve against the first turn's
 * internal buffer. Consumers who need an aggregated view should read
 * `fullStream` and accumulate, or follow up with `agent.generate(...)`.
 */
export async function runStreamUntilIdle<OUTPUT>(
  agent: Agent<any, any, any, any>,
  messages: MessageListInput,
  streamOptions: (Record<string, any> & { maxIdleMs?: number }) | undefined,
  deps: StreamUntilIdleDeps,
): Promise<MastraModelOutput<OUTPUT>> {
  return runIdleLoop<typeof agent, MastraModelOutput<OUTPUT>, MastraModelOutput<OUTPUT>>(
    agent,
    streamOptions,
    deps,
    opts => agent.stream(messages, opts as any) as Promise<MastraModelOutput<OUTPUT>>,
    opts => (agent.stream as any)([], opts) as Promise<{ fullStream: ReadableStream<any> }>,
    (first, ctx) => {
      // No ctx means no bgManager / no memory — fall through without wrapping.
      if (!ctx) return first;

      // Wrap the first turn's MastraModelOutput so `fullStream` returns our
      // combined stream (initial + continuations) while `text`, `finishReason`,
      // `toolCalls`, etc. still work — they resolve against the first turn's
      // internal event buffer, which gets populated as we consume its fullStream.
      return new Proxy(first, {
        get(target, prop) {
          if (prop === 'fullStream') return ctx.combinedStream;
          // Read target's own property with `this === target` so any internal
          // getters (e.g. `#getDelayedPromise`) don't recurse through the proxy
          // and hit our overridden fullStream.
          const value = Reflect.get(target, prop, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      }) as MastraModelOutput<OUTPUT>;
    },
  );
}

/**
 * Run `agent.resumeStreamUntilIdle`. Same idle-loop semantics as
 * `runStreamUntilIdle` — initial turn calls `agent.resumeStream(resumeData,
 * ...)` against the existing run snapshot identified by `streamOptions.runId`,
 * and any subsequent continuations triggered by background-task completions
 * use `agent.stream([], continuationOpts)` (a normal multi-turn agent stream)
 * since the resume completes and we're back in regular conversation flow.
 *
 * `streamOptions` should include `runId` (required by `resumeStream` to load
 * the snapshot) and may include `toolCallId` if the resume is targeting a
 * specific suspended tool call. `maxIdleMs` works the same way as in
 * `streamUntilIdle`.
 */
export async function runResumeStreamUntilIdle<OUTPUT>(
  agent: Agent<any, any, any, any>,
  resumeData: any,
  streamOptions: (Record<string, any> & { maxIdleMs?: number; runId?: string; toolCallId?: string }) | undefined,
  deps: StreamUntilIdleDeps,
): Promise<MastraModelOutput<OUTPUT>> {
  return runIdleLoop<typeof agent, MastraModelOutput<OUTPUT>, MastraModelOutput<OUTPUT>>(
    agent,
    streamOptions,
    deps,
    opts => agent.resumeStream(resumeData, opts as any) as Promise<MastraModelOutput<OUTPUT>>,
    opts => (agent.stream as any)([], opts) as Promise<{ fullStream: ReadableStream<any> }>,
    (first, ctx) => {
      if (!ctx) return first;
      return new Proxy(first, {
        get(target, prop) {
          if (prop === 'fullStream') return ctx.combinedStream;
          const value = Reflect.get(target, prop, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      }) as MastraModelOutput<OUTPUT>;
    },
  );
}
