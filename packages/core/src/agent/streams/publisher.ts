import { decode, encode } from '../../events/codec';
import { serializeError } from '../../events/codec/error';
import type { PubSub } from '../../events/pubsub';
import type { IMastraLogger } from '../../logger';
import { getChunkProducedAt, stampChunkProducedAt } from '../../stream/base/produced-at';
import type { ChunkType } from '../../stream/types';
import { createRunAbortController } from '../durable/run-abort';
import type { AgentSuspendedEventData } from '../durable/types';
import { abortAckTopic, subscribeToAbortRequests } from './abort-transport';
import { scheduleStreamCleanup } from './bus';
import { AGENT_CONTROL_TOPIC, AGENT_STREAM_TOPIC } from './constants';
import { emitChunkEvent, emitErrorEvent, emitFinishEvent, emitStepStartEvent, emitSuspendedEvent } from './events';
import type { AgentRunRecordTarget } from './run-records';
import { deleteAgentRunRecord, readAgentRunRecord, writeAgentRunRecord } from './run-records';

/**
 * Publishes a run's chunks on its stream topic as the loop produces them, so
 * readers other than the caller (`Agent.observe()`, a reconnecting client) can
 * follow the run. Publishing never blocks or fails the run: events are queued
 * in order and publish errors are logged. Each event is a snapshot taken when
 * the chunk is published, not a reference to the loop's objects.
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
  /** Called once when the run stops publishing (finished, failed, or suspended). */
  onEnd?: () => void;
  /**
   * Where to keep the run's shared ownership record (see `run-records.ts`).
   * It is written before the first event, marked `suspended` or `finished`
   * after the run's last event, and deleted with the topic.
   */
  record?: AgentRunRecordTarget;
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
  onEnd,
  record,
}: CreateAgentStreamPublisherOptions): AgentStreamPublisher {
  const { controller, detach } = createRunAbortController(callerSignal);
  const abort = (reason?: unknown) => {
    if (!controller.signal.aborted) controller.abort(reason ?? new Error('Aborted'));
  };

  let ended = false;

  // Listen for abort requests until the run ends. Subscribing is async; a
  // request published before the subscription lands is missed, like one sent
  // to a run that already finished.
  let stopListening: (() => Promise<void>) | undefined;
  let listening: Promise<void> | undefined = subscribeToAbortRequests(pubsub, runId, reason => {
    // A request that lands while the subscription is being released has
    // nothing left to stop; leave it unconfirmed.
    if (ended) return false;
    abort(reason);
    return true;
  })
    .then(unsubscribe => {
      stopListening = unsubscribe;
    })
    .catch(error => {
      logger?.warn?.('[AgentStream:' + runId + '] failed to listen for abort requests', { error });
    });
  const stopAbortListener = async () => {
    detach();
    const pending = listening;
    listening = undefined;
    await pending;
    await stopListening?.().catch(() => {});
    stopListening = undefined;
  };

  let runningRetryTimer: ReturnType<typeof setTimeout> | undefined;
  /** Stamped on every record this publisher writes, so cleanup can tell its own run from a later one. */
  const publisherId = globalThis.crypto.randomUUID();
  const writeRecord = (status: 'running' | 'suspended' | 'finished') => async () => {
    if (!record) return;
    const { cache, ...owner } = record;
    await writeAgentRunRecord(cache, { ...owner, runId, status, updatedAt: Date.now(), publisherId }).catch(error => {
      logger?.warn?.(`[AgentStream:${runId}] failed to write run record`, { error });
      if (status === 'running' && !ended && !runningRetryTimer) {
        runningRetryTimer = setTimeout(() => {
          runningRetryTimer = undefined;
          void enqueue(async () => {
            if (!ended) await writeRecord('running')();
          });
        }, 1000);
        runningRetryTimer.unref?.();
      }
    });
  };

  // The record goes first, so a reader that sees any event can authorize.
  let queue: Promise<void> = writeRecord('running')();
  let finished = false;
  let suspended: AgentSuspendedEventData | undefined;
  let lastError: unknown;

  const enqueue = (task: () => Promise<void>) => {
    queue = queue.then(task).catch(error => {
      logger?.warn?.(`[AgentStream:${runId}] failed to publish stream event`, { error });
    });
    return queue;
  };

  /**
   * Copies a payload when it is published. The loop keeps mutating objects it
   * has already emitted (a resumed run pushes onto the same `steps` array), and
   * events wait in the queue and in caches that keep references, so replay
   * would otherwise show later state. Uses the pubsub codec, the same
   * round-trip cross-process transports apply: Date, Error, Map, Set, BigInt,
   * undefined and registered classes survive; functions and symbols are
   * dropped, cycles and non-finite numbers become null, and unregistered
   * classes and typed arrays become plain data. A value the codec can't encode
   * is published by reference with a warning rather than dropped.
   */
  const snapshot = <T>(value: T): T => {
    try {
      return decode(encode(value)) as T;
    } catch (error) {
      logger?.warn?.(`[AgentStream:${runId}] failed to snapshot stream event; publishing it by reference`, { error });
      return value;
    }
  };
  const snapshotChunk = (chunk: ChunkType<any>): ChunkType<any> => {
    const copy = snapshot(chunk);
    if (copy !== chunk) {
      const producedAt = getChunkProducedAt(chunk);
      if (producedAt !== undefined) stampChunkProducedAt(copy, producedAt);
    }
    return copy;
  };

  const scheduleCleanup = () => {
    const timer = scheduleStreamCleanup(cleanupTimeoutMs, () => {
      void (async () => {
        // A finished run's id can be claimed again before this fires, and the topic and
        // record then belong to that run. Only clear state this publisher wrote.
        if (record) {
          let current;
          try {
            current = await readAgentRunRecord(record.cache, record.agentId, runId);
          } catch {
            // The cache is unreadable, so there is no way to tell whose run this is. Leave
            // the state to its TTL rather than risk deleting a live run's record.
            return;
          }
          if (current && current.publisherId !== publisherId) return;
        }
        // The run's control and ack topics end with it too; a transport that keeps
        // streams (Redis Streams) would otherwise hold them until its idle TTL.
        for (const topic of [AGENT_STREAM_TOPIC(runId), AGENT_CONTROL_TOPIC(runId), abortAckTopic(runId)]) {
          void pubsub.clearTopic(topic).catch(() => {});
        }
        if (record) void deleteAgentRunRecord(record.cache, record.agentId, runId).catch(() => {});
      })();
    });
    timer?.unref?.();
  };

  const end = async (fallbackError: () => unknown) => {
    if (ended) return queue;
    ended = true;
    if (runningRetryTimer) clearTimeout(runningRetryTimer);
    runningRetryTimer = undefined;
    void stopAbortListener();
    onEnd?.();
    if (!finished) {
      if (suspended) {
        const data = suspended;
        await enqueue(() => emitSuspendedEvent(pubsub, runId, data));
        await enqueue(writeRecord('suspended'));
        // The run resumes on the same topic; keep its history. Its record
        // and log expire with their TTL if it is never resumed.
        return queue;
      }
      const error = toError(lastError ?? fallbackError());
      await enqueue(() => emitErrorEvent(pubsub, runId, error));
    }
    await enqueue(writeRecord('finished'));
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
          const payload = snapshot(chunk.payload);
          void enqueue(() => emitStepStartEvent(pubsub, runId, payload));
          return;
        }
        case 'finish': {
          finished = true;
          const { output, stepResult, messages } = chunk.payload as any;
          const data = snapshot({ output, stepResult, ...(messages ? { messages } : {}) });
          void enqueue(() => emitFinishEvent(pubsub, runId, data));
          return;
        }
        case 'tool-call-approval':
        case 'tool-call-suspended': {
          const { toolCallId, toolName, args, resumeSchema, suspendPayload } = chunk.payload as any;
          suspended = snapshot<AgentSuspendedEventData>(
            chunk.type === 'tool-call-approval'
              ? { type: 'approval', toolCallId, toolName, args, resumeSchema }
              : { type: 'suspension', toolCallId, toolName, args, resumeSchema, suspendPayload },
          );
          break;
        }
        case 'error': {
          lastError = chunk.payload.error;
          const serialized = snapshotChunk({
            ...chunk,
            payload: { ...chunk.payload, error: serializeIfError(chunk.payload.error) },
          } as ChunkType<any>);
          void enqueue(() => emitChunkEvent(pubsub, runId, serialized));
          return;
        }
      }
      const published = snapshotChunk(chunk);
      void enqueue(() => emitChunkEvent(pubsub, runId, published));
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
