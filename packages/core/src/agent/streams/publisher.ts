import { serializeError } from '../../events/codec/error';
import type { PubSub } from '../../events/pubsub';
import type { IMastraLogger } from '../../logger';
import { getChunkProducedAt, stampChunkProducedAt } from '../../stream/base/produced-at';
import { slimNestedAgentChunks } from '../../stream/strip-model-snapshots';
import type { ChunkType } from '../../stream/types';
import { createRunAbortController } from '../durable/run-abort';
import type { AgentSuspendedEventData } from '../durable/types';
import type { MessageList } from '../message-list';
import { whenRunStepsSettle } from '../run-lease-fence';
import { abortAckTopic, subscribeToAbortRequests } from './abort-transport';
import { scheduleStreamCleanup } from './bus';
import { AGENT_CONTROL_TOPIC, AGENT_STREAM_TOPIC } from './constants';
import { emitChunkEvent, emitErrorEvent, emitFinishEvent, emitStepStartEvent, emitSuspendedEvent } from './events';
import { diffResponseMessages } from './response-messages';
import type { ResponseMessagesCursor, ResponseMessagesDiff } from './response-messages';
import type { AgentRunRecordTarget } from './run-records';
import { deleteAgentRunRecord, readAgentRunRecord, writeAgentRunRecord } from './run-records';
import { toStreamFinish, toStreamStepFinish, toStreamStepStart } from './wire';

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
  /**
   * Queue a chunk the loop emitted to its caller. `messageList` is the run's
   * message list, which a `step-finish` event takes the step's content from.
   */
  publish(chunk: ChunkType<any>, messageList?: MessageList): void;
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
 * - `step-start` → `step-start`, `step-finish` → `chunk`, and `finish` →
 *   `finish`, each reduced to what readers need (see `wire.ts`); readers
 *   rebuild the `abort` chunk from the finish reason, so the loop's own
 *   `abort` chunk is not published
 * - `tool-output` / `workflow-step-output` → `chunk`, with a delegated agent's
 *   nested chunks stripped of their prompts and steps
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
  let listening: Promise<void> | undefined = subscribeToAbortRequests(pubsub, runId, () => {
    // A request that lands while the subscription is being released has
    // nothing left to stop; leave it unconfirmed.
    if (ended) return false;
    abort();
    return true;
  })
    .then(unsubscribe => {
      stopListening = unsubscribe;
    })
    .catch(error => {
      logger?.warn?.('[AgentStream:' + runId + '] failed to listen for abort requests', { error });
    });
  const stopAbortListener = async () => {
    // A segment that ends on a suspension can leave a sibling tool call of the same step running. Keep forwarding the
    // caller's abort until it settles, so aborting the run (e.g. at shutdown) still reaches that tool.
    whenRunStepsSettle(callerSignal, detach);
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
  /** Tool calls of the step in progress, which the run's messages need to tell its content apart. */
  let stepToolCallIds: string[] = [];
  /**
   * The response messages published so far. Each step-finish sends only what changed; a run
   * resumed in a new publisher starts over with the full list.
   */
  let responseMessagesCursor: ResponseMessagesCursor | { producer: string } = { producer: publisherId };
  /** The next diff holds the whole list; its `seq` still follows on, so readers don't take it for a late copy. */
  const forgetSentResponseMessages = () => {
    if ('fingerprints' in responseMessagesCursor)
      responseMessagesCursor = { ...responseMessagesCursor, fingerprints: [] };
  };
  /** A reader that attaches mid-run on a bus that keeps no history can only place whole lists. */
  const sendWholeLists = !pubsub.__replaysTopic(AGENT_STREAM_TOPIC(runId));
  const diffStepResponseMessages = (messages: ResponseMessagesDiff['messages'] | undefined) => {
    if (!messages) return undefined;
    if (sendWholeLists) forgetSentResponseMessages();
    try {
      const { diff, cursor } = diffResponseMessages(responseMessagesCursor, messages);
      responseMessagesCursor = cursor;
      return diff;
    } catch (error) {
      // Readers report no messages for this step; publishing must not fail the run.
      logger?.warn?.(`[AgentStream:${runId}] failed to diff response messages`, { error });
      forgetSentResponseMessages();
      return undefined;
    }
  };
  const readStepContent = (messageList: MessageList | undefined, toolCallIds: string[]) => {
    try {
      return messageList?.get.response.aiV5.modelContent(-1, toolCallIds);
    } catch (error) {
      // Readers fall back to their own messages; publishing must not fail the run.
      logger?.warn?.(`[AgentStream:${runId}] failed to read step content`, { error });
      return undefined;
    }
  };
  let suspended: AgentSuspendedEventData | undefined;
  let lastError: unknown;

  const enqueue = (task: () => Promise<void>) => {
    queue = queue.then(task).catch(error => {
      logger?.warn?.(`[AgentStream:${runId}] failed to publish stream event`, { error });
    });
    return queue;
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
    publish(chunk, messageList) {
      if (ended) return;
      switch (chunk.type) {
        case 'abort':
          return;
        case 'step-start': {
          const data = toStreamStepStart(chunk.payload);
          void enqueue(() => emitStepStartEvent(pubsub, runId, data));
          return;
        }
        case 'tool-call':
          stepToolCallIds.push(chunk.payload.toolCallId);
          break;
        case 'step-finish': {
          // The same content the caller's output reports for this step, read now, while the
          // run's messages still end with it. A retried attempt was rolled back, and readers
          // report no content for it.
          const content =
            (chunk.payload?.stepResult?.reason as string) === 'retry'
              ? undefined
              : readStepContent(messageList, stepToolCallIds);
          stepToolCallIds = [];
          const responseMessages = diffStepResponseMessages(chunk.payload?.messages?.nonUser);
          const published = withPayload(chunk, toStreamStepFinish(chunk.payload, content, responseMessages));
          void enqueue(async () => {
            try {
              await emitChunkEvent(pubsub, runId, published);
            } catch (error) {
              // Readers that missed this diff can't place the next ones: resend the whole list.
              if (responseMessages) forgetSentResponseMessages();
              throw error;
            }
          });
          return;
        }
        case 'tool-output':
        case 'workflow-step-output': {
          // A delegated agent's chunks arrive wrapped here, with their own prompts and steps.
          const published = keepProducedAt(chunk, slimNestedAgentChunks(chunk));
          void enqueue(() => emitChunkEvent(pubsub, runId, published));
          return;
        }
        case 'finish': {
          finished = true;
          const data = toStreamFinish(chunk.payload);
          void enqueue(() => emitFinishEvent(pubsub, runId, data));
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
          const serialized = withPayload(chunk, { ...chunk.payload, error: serializeIfError(chunk.payload.error) });
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

/** A copy of `chunk` with another payload, keeping when the chunk was produced. */
function withPayload(chunk: ChunkType<any>, payload: unknown): ChunkType<any> {
  return keepProducedAt(chunk, { ...chunk, payload } as ChunkType<any>);
}

/** `copy`, stamped with when `chunk` was produced; publishing would otherwise stamp the copy when it's sent. */
function keepProducedAt(chunk: ChunkType<any>, copy: ChunkType<any>): ChunkType<any> {
  const producedAt = getChunkProducedAt(chunk);
  if (copy !== chunk && producedAt !== undefined) stampChunkProducedAt(copy, producedAt);
  return copy;
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
