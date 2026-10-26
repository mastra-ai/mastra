import { serializeError } from '../../events/codec/error';
import type { PubSub } from '../../events/pubsub';
import type { IMastraLogger } from '../../logger';
import type { ChunkType } from '../../stream/types';
import type { AgentSuspendedEventData } from '../durable/types';
import { subscribeToAbortRequests } from './abort-transport';
import { AGENT_STREAM_TOPIC } from './constants';
import { emitChunkEvent, emitErrorEvent, emitFinishEvent, emitStepStartEvent, emitSuspendedEvent } from './events';

/**
 * Publishes a run's chunks on its stream topic as the loop produces them, so
 * readers other than the caller (`Agent.observe()`, a reconnecting client) can
 * follow the run. Publishing never blocks or fails the run: events are queued
 * in order and publish errors are logged.
 */
export interface AgentStreamPublisher {
  readonly runId: string;
  /**
   * Aborts when the caller's signal does, or when an abort request for this
   * run arrives on its control topic (from `observe().abort()` or
   * `abortRunStream()` in any process sharing the bus). Pass it to the loop.
   */
  readonly abortSignal: AbortSignal;
  /** Abort the run in this process. */
  abort(reason?: unknown): void;
  /** Queue a chunk the loop emitted to its caller. */
  publish(chunk: ChunkType<any>): void;
  /**
   * The loop closed its stream. Publishes the terminal event readers wait for
   * when the loop didn't end with `finish`: `suspended` when the run paused,
   * otherwise `error`.
   */
  close(): Promise<void>;
  /** The loop's stream errored before it could close. */
  fail(reason: unknown): Promise<void>;
}

export interface CreateAgentStreamPublisherOptions {
  pubsub: PubSub;
  runId: string;
  /** Grace period before a finished run's topic is cleared (0 = never). */
  cleanupTimeoutMs: number;
  logger?: IMastraLogger;
  /** The caller's own abort signal, folded into {@link AgentStreamPublisher.abortSignal}. */
  abortSignal?: AbortSignal;
}

/**
 * Map the default loop's chunks onto the agent stream events DurableAgent
 * publishes, so one reader handles runs from either engine.
 *
 * - `step-start` → `step-start`
 * - `finish` → `finish` (readers rebuild the `abort` chunk from its reason, so
 *   the loop's own `abort` chunk is not published)
 * - `tool-call-approval` / `tool-call-suspended` → `chunk`, then `suspended`
 *   once the run's snapshot is persisted (when the loop closes)
 * - anything else → `chunk`, with errors serialized so they survive JSON transports
 */
export function createAgentStreamPublisher({
  pubsub,
  runId,
  cleanupTimeoutMs,
  logger,
  abortSignal: callerSignal,
}: CreateAgentStreamPublisherOptions): AgentStreamPublisher {
  const controller = new AbortController();
  const abort = (reason?: unknown) => {
    if (!controller.signal.aborted) controller.abort(reason ?? new Error('Aborted'));
  };
  const onCallerAbort = () => abort(callerSignal?.reason);
  if (callerSignal?.aborted) onCallerAbort();
  else callerSignal?.addEventListener('abort', onCallerAbort, { once: true });

  // Listen for abort requests until the run ends. Subscribing is async; a
  // request published before the subscription lands is missed, like one sent
  // to a run that already finished.
  let stopListening: (() => Promise<void>) | undefined;
  let listening: Promise<void> | undefined = subscribeToAbortRequests(pubsub, runId, () => abort())
    .then(unsubscribe => {
      stopListening = unsubscribe;
    })
    .catch(error => {
      logger?.warn?.('[AgentStream:' + runId + '] failed to listen for abort requests', { error });
    });
  const stopAbortListener = async () => {
    callerSignal?.removeEventListener('abort', onCallerAbort);
    const pending = listening;
    listening = undefined;
    await pending;
    await stopListening?.().catch(() => {});
    stopListening = undefined;
  };

  let queue: Promise<void> = Promise.resolve();
  let finished = false;
  let ended = false;
  let suspended: AgentSuspendedEventData | undefined;
  let lastError: unknown;

  const enqueue = (task: () => Promise<void>) => {
    queue = queue.then(task).catch(error => {
      logger?.warn?.(`[AgentStream:${runId}] failed to publish stream event`, { error });
    });
    return queue;
  };

  const scheduleCleanup = () => {
    if (cleanupTimeoutMs === 0) return;
    const timer = setTimeout(() => {
      void pubsub.clearTopic(AGENT_STREAM_TOPIC(runId)).catch(() => {});
    }, cleanupTimeoutMs);
    timer.unref?.();
  };

  const end = async (fallbackError: () => unknown) => {
    if (ended) return queue;
    ended = true;
    void stopAbortListener();
    if (!finished) {
      if (suspended) {
        const data = suspended;
        await enqueue(() => emitSuspendedEvent(pubsub, runId, data));
        // The run resumes on the same topic; keep its history.
        return queue;
      }
      const error = toError(lastError ?? fallbackError());
      await enqueue(() => emitErrorEvent(pubsub, runId, error));
    }
    await queue;
    scheduleCleanup();
  };

  return {
    runId,
    abortSignal: controller.signal,
    abort,
    publish(chunk) {
      if (ended) return;
      switch (chunk.type) {
        case 'abort':
          return;
        case 'step-start': {
          const payload = chunk.payload;
          void enqueue(() => emitStepStartEvent(pubsub, runId, payload));
          return;
        }
        case 'finish': {
          finished = true;
          const { output, stepResult, messages } = chunk.payload as any;
          void enqueue(() => emitFinishEvent(pubsub, runId, { output, stepResult, ...(messages ? { messages } : {}) }));
          return;
        }
        case 'tool-call-approval':
        case 'tool-call-suspended': {
          const { toolCallId, toolName, args, resumeSchema, suspendPayload } = chunk.payload as any;
          suspended =
            chunk.type === 'tool-call-approval'
              ? { type: 'approval', toolCallId, toolName, args, resumeSchema }
              : { type: 'suspension', toolCallId, toolName, args, resumeSchema, suspendPayload };
          break;
        }
        case 'error': {
          lastError = chunk.payload.error;
          const serialized = {
            ...chunk,
            payload: { ...chunk.payload, error: serializeIfError(chunk.payload.error) },
          } as ChunkType<any>;
          void enqueue(() => emitChunkEvent(pubsub, runId, serialized));
          return;
        }
      }
      void enqueue(() => emitChunkEvent(pubsub, runId, chunk));
    },
    close() {
      return end(() => new Error('Agent stream ended without a finish event'));
    },
    fail(reason) {
      lastError ??= reason;
      suspended = undefined;
      return end(() => reason);
    },
  };
}

function serializeIfError(error: unknown) {
  return error instanceof Error ? serializeError(error) : error;
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return Object.assign(new Error(String((error as { message: unknown }).message)), error);
  }
  return new Error(typeof error === 'string' ? error : 'Agent stream failed');
}
