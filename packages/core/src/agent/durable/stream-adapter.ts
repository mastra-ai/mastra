import { ReadableStream } from 'node:stream/web';
import type { PubSub } from '../../events/pubsub';
import type { Event } from '../../events/types';
import type { IMastraLogger } from '../../logger';
import type { TracingContext } from '../../observability';
import type { OutputProcessorOrWorkflow } from '../../processors';
import type { RequestContext } from '../../request-context';
import { safeClose, safeEnqueue } from '../../stream/base';
import { MastraModelOutput } from '../../stream/base/output';
import { ChunkFrom } from '../../stream/types';
import type {
  ChunkType,
  MastraOnFinishCallback,
  MastraOnStepFinishCallback,
  MastraStreamTransformOptions,
  LanguageModelUsage,
  StepStartPayload,
} from '../../stream/types';
import { MessageList } from '../message-list';
import type { StructuredOutputOptions } from '../types';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from './constants';
import type {
  AgentStreamEvent,
  AgentChunkEventData,
  AgentStepFinishEventData,
  AgentFinishEventData,
  AgentErrorEventData,
  AgentSuspendedEventData,
  AgentAbortEventData,
  AgentIterationCompleteEventData,
} from './types';

/**
 * Map workflow usage (which may use legacy promptTokens/completionTokens) to
 * the canonical LanguageModelUsage shape (inputTokens/outputTokens).
 */
function normalizeUsage(raw?: Record<string, unknown>): LanguageModelUsage {
  if (!raw) {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  }
  const inputTokens = (raw.inputTokens as number) ?? (raw.promptTokens as number) ?? 0;
  const outputTokens = (raw.outputTokens as number) ?? (raw.completionTokens as number) ?? 0;
  const totalTokens = (raw.totalTokens as number) ?? inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
}

/**
 * Options for creating a durable agent stream
 */
export interface DurableAgentStreamOptions<OUTPUT = undefined> {
  /** Pubsub instance to subscribe to */
  pubsub: PubSub;
  /** Run identifier */
  runId: string;
  /** Message ID for this execution */
  messageId: string;
  /** Model information for the output */
  model: {
    modelId: string | undefined;
    provider: string | undefined;
    version: 'v2' | 'v3' | 'v4';
  };
  /** Thread ID for memory */
  threadId?: string;
  /** Resource ID for memory */
  resourceId?: string;
  /**
   * Start replay from this index (0-based).
   * If undefined, uses full replay (subscribeWithReplay).
   * If specified, uses efficient indexed replay (subscribeFromOffset).
   */
  offset?: number;
  /**
   * If set, terminate the stream when no pubsub event arrives for this many ms
   * AND the run is not alive (see `isAlive`). A durable run whose driving process
   * crashed stops emitting but never publishes a terminal event, so `observe()`
   * would otherwise hang forever on a producerless topic. Absent ⇒ no idle bound
   * (current behavior).
   */
  idleTimeoutMs?: number;
  /**
   * Optional liveness probe consulted when the idle timeout fires. Returns true
   * while some process is still driving the run (e.g. a fresh run-liveness
   * heartbeat), in which case the stream keeps waiting; false ⇒ terminate. When
   * omitted, a bare `idleTimeoutMs` terminates on pure silence. A transient throw
   * is treated as alive (keep waiting), so a momentary dependency blip never ends
   * a live stream.
   */
  isAlive?: () => boolean | Promise<boolean>;
  /** Callback when chunk is received */
  onChunk?: (chunk: ChunkType<OUTPUT>) => void | Promise<void>;
  /** Callback when step finishes */
  onStepFinish?: (result: AgentStepFinishEventData) => void | Promise<void>;
  /** Callback when execution finishes — routed through MastraModelOutput for rich step data */
  onFinish?: MastraOnFinishCallback<OUTPUT>;
  /** Lifecycle hook called after the FINISH event closes the stream (for cleanup scheduling) */
  onStreamFinished?: () => void | Promise<void>;
  /** Callback on error */
  onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
  /** Callback when workflow suspends */
  onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
  /** Callback when execution is aborted via abortSignal */
  onAbort?: (data: AgentAbortEventData) => void | Promise<void>;
  /** Callback fired after each agentic-loop iteration */
  onIterationComplete?: (data: AgentIterationCompleteEventData) => void | Promise<void>;
  /** Optional logger for structured logging */
  logger?: IMastraLogger;
  /**
   * If true, close the underlying ReadableStream when a SUSPENDED event is
   * received. Used by `generate()` / `resumeGenerate()` so that
   * `getFullOutput()` resolves on suspend instead of hanging. Streaming
   * callers leave this `false` so the stream stays open for a later resume.
   */
  closeOnSuspend?: boolean;
  /**
   * Structured output configuration with live schema. When provided,
   * `MastraModelOutput` pipes LLM text through `createObjectStreamTransformer`
   * to produce `object-result` chunks.
   */
  structuredOutput?: StructuredOutputOptions<OUTPUT>;
  /** Output processors to run in MastraModelOutput's stream pipeline */
  outputProcessors?: OutputProcessorOrWorkflow[];
  /** Run context passed to output processors for every streamed chunk. */
  requestContext?: RequestContext;
  /** Tracing context whose current span is the run's AGENT_RUN span; parents per-chunk processor spans. */
  tracingContext?: TracingContext;
  /** Experimental transforms applied whenever the returned full stream is consumed. */
  experimentalTransform?: MastraStreamTransformOptions<OUTPUT>;
  /**
   * Optional external MessageList to use instead of creating a fresh empty one.
   * When provided (e.g. the registry's live MessageList), MastraModelOutput can
   * resolve step content from messages added during the workflow execution.
   */
  messageList?: MessageList;
}

/**
 * Result from creating a durable agent stream
 */
export interface DurableAgentStreamResult<OUTPUT = undefined> {
  /** The MastraModelOutput that streams from pubsub events */
  output: MastraModelOutput<OUTPUT>;
  /** Cleanup function to unsubscribe from pubsub */
  cleanup: () => void;
  /** Promise that resolves when subscription is established */
  ready: Promise<void>;
}

/**
 * Create a MastraModelOutput that streams from pubsub events.
 *
 * This adapter subscribes to the agent stream pubsub channel and converts
 * pubsub events into a ReadableStream that MastraModelOutput can consume.
 * Callbacks are invoked as events arrive.
 */
export function createDurableAgentStream<OUTPUT = undefined>(
  options: DurableAgentStreamOptions<OUTPUT>,
): DurableAgentStreamResult<OUTPUT> {
  const {
    pubsub,
    runId,
    messageId,
    model,
    threadId,
    resourceId,
    offset,
    idleTimeoutMs,
    isAlive,
    onChunk,
    onStepFinish,
    onFinish,
    onStreamFinished,
    onError,
    onSuspended,
    onAbort,
    onIterationComplete,
    logger,
    closeOnSuspend = false,
    structuredOutput,
    outputProcessors,
    requestContext,
    tracingContext,
    experimentalTransform,
    messageList: externalMessageList,
  } = options;

  // Helper to log errors (uses logger if available, falls back to console)
  const logError = (message: string, error: unknown) => {
    if (logger) {
      logger.error(message, error);
    } else {
      console.error(message, error);
    }
  };

  // Use an external MessageList if provided (e.g. the live registry one that
  // llm-execution.ts keeps in sync), otherwise create a fresh empty one.
  // This lets MastraModelOutput resolve step content from the real assistant
  // messages added during the workflow execution.
  const messageList =
    externalMessageList ??
    new MessageList({
      threadId,
      resourceId,
    });

  // Track subscription state
  let isSubscribed = false;
  let cancelled = false;
  // Set once the stream reaches ANY terminal state (FINISH/ERROR/ABORT, a
  // closeOnSuspend suspend, idle termination, or cleanup). `cancelled` alone is
  // insufficient: `safeClose()` leaves `controller` set and only `cleanup()`
  // flips `cancelled`, so without this flag the watchdog would re-arm on an
  // already-closed stream — observing a finished run (replayed FINISH) or a
  // late/stale event would start a self-renewing timer. Checked by armIdleTimer.
  let terminated = false;
  let controller: ReadableStreamDefaultController<ChunkType<OUTPUT>> | null = null;

  // Promise that resolves when subscription is established
  let resolveReady: () => void;
  let rejectReady: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  // Handler for pubsub events.
  //
  // All `controller.enqueue` / `controller.close` / `controller.error` calls
  // are wrapped in safe* helpers because pubsub events can arrive AFTER the
  // stream has already been closed (e.g. a stale background-task lifecycle
  // event published after the agent's FINISH chunk closed the controller).
  // Without the guards, those late events surface as
  // `TypeError: Invalid state: Controller is already closed` from the
  // controller, which the outer try/catch logs but which floods the
  // console and (in test runs) causes timeouts as event handlers retry.
  // Track the last error message seen in an 'error' chunk, so we can
  // surface it in onError when the FINISH event arrives with reason 'error'.
  let lastErrorMessage: string | undefined;
  let lastErrorStack: string | undefined;
  let lastErrorName: string | undefined;
  let lastErrorCause: unknown;

  // Idle/liveness watchdog. A durable run whose driving process crashed stops
  // emitting chunks but never publishes a terminal FINISH/ERROR/ABORT event, so
  // a producerless topic would otherwise leave the stream open forever. When
  // `idleTimeoutMs` is set we arm a timer that terminates the stream after that
  // much silence — unless `isAlive` confirms a producer is still driving the run
  // (e.g. a long tool call or a suspended HITL gate), in which case we re-arm and
  // keep waiting.
  //
  // Declared BEFORE `handleEvent` (which re-arms on every event) so a synchronous
  // replay delivered during `pubsub.subscribe*` in the ReadableStream `start()`
  // can't reference these consts in their temporal dead zone. `onIdleTimeout`
  // references `cleanup` (defined later) but only ever runs from a timer, long
  // after `cleanup` is initialized.
  //
  // `idleGeneration` guards an async `isAlive()` race: a probe that resolves
  // after a fresh event re-armed the timer (or after a terminal event) would
  // otherwise close an active/finished stream. Every clear/re-arm bumps the
  // generation; the probe captures it and bails if it no longer matches.
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let idleGeneration = 0;
  const clearIdleTimer = () => {
    idleGeneration += 1;
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = undefined;
    }
  };
  // Mark the stream terminal and stop the watchdog. Call at every terminal close
  // so armIdleTimer() can never re-arm afterwards.
  const markTerminated = () => {
    terminated = true;
    clearIdleTimer();
  };
  const onIdleTimeout = async (generation: number) => {
    idleTimer = undefined;
    if (cancelled || !controller || generation !== idleGeneration) return;
    if (isAlive) {
      let alive = true;
      try {
        alive = await isAlive();
      } catch {
        alive = true; // transient blip ⇒ assume alive
      }
      // A chunk (re-arm) or terminal event during the await bumps the generation —
      // abandon this stale probe so it can't close a now-active or finished stream.
      if (cancelled || !controller || generation !== idleGeneration) return;
      if (alive) {
        armIdleTimer(); // still driving ⇒ keep waiting
        return;
      }
    }
    // No probe (bare timeout) or provably dead ⇒ terminate with an error chunk,
    // mirroring the ERROR-event path (enqueue error chunk + safeClose, NOT
    // controller.error which MastraModelOutput swallows). Fire onError — for
    // observe() that schedules registry + pubsub-topic cleanup, so an
    // idle-terminated run doesn't retain state — then unsubscribe in finally.
    const error = new Error(`Durable agent stream idle for ${idleTimeoutMs}ms with no live producer`);
    safeEnqueue(controller, {
      type: 'error',
      payload: { error },
    } as ChunkType<OUTPUT>);
    safeClose(controller);
    markTerminated(); // block any re-arm while we await onError below
    try {
      await onError?.({ error });
    } catch (callbackError) {
      logError(`[DurableAgentStream] onError callback error:`, callbackError);
    } finally {
      cleanup();
    }
  };
  const armIdleTimer = () => {
    // `!isSubscribed`: a synchronously-delivering PubSub can invoke handleEvent
    // (which re-arms) DURING replay, before the subscribe promise resolves and
    // sets isSubscribed — arming (and possibly expiring) the timer before the
    // subscription exists. The post-subscribe `.then()` arms it once ready.
    if (idleTimeoutMs === undefined || idleTimeoutMs <= 0 || cancelled || terminated || !isSubscribed || !controller) {
      return;
    }
    clearIdleTimer();
    const generation = idleGeneration;
    idleTimer = setTimeout(() => {
      void onIdleTimeout(generation);
    }, idleTimeoutMs);
  };

  const handleEvent = async (event: Event) => {
    if (!controller) return;

    // Any event proves the producer is alive — restart the idle countdown.
    armIdleTimer();

    // Parse the event data as AgentStreamEvent
    const streamEvent = event as unknown as AgentStreamEvent;

    try {
      switch (streamEvent.type) {
        case AgentStreamEventTypes.CHUNK: {
          const chunk = streamEvent.data as AgentChunkEventData;
          // Track error chunks for onError callback
          if ((chunk as any).type === 'error') {
            const errPayload = (chunk as any).payload;
            lastErrorMessage = errPayload?.error?.message || errPayload?.message || 'LLM execution error';
            lastErrorStack = typeof errPayload?.error?.stack === 'string' ? errPayload.error.stack : undefined;
            lastErrorName = typeof errPayload?.error?.name === 'string' ? errPayload.error.name : undefined;
            lastErrorCause = errPayload?.error ?? errPayload;
          }
          safeEnqueue(controller, chunk as ChunkType<OUTPUT>);
          await onChunk?.(chunk as ChunkType<OUTPUT>);
          break;
        }

        case AgentStreamEventTypes.STEP_START: {
          // Step start - enqueue if it's a chunk type
          const chunk = streamEvent.data as ChunkType<OUTPUT>;
          if (chunk && 'type' in chunk) {
            safeEnqueue(controller, chunk);
          }
          break;
        }

        case AgentStreamEventTypes.STEP_FINISH: {
          const data = streamEvent.data as AgentStepFinishEventData;
          await onStepFinish?.(data);
          break;
        }

        case AgentStreamEventTypes.FINISH: {
          const data = streamEvent.data as AgentFinishEventData;
          // Enqueue finish chunk and close stream even if callback throws
          const finishChunk = {
            type: 'finish' as const,
            payload: {
              output: data.output,
              stepResult: data.stepResult,
            },
          } as ChunkType<OUTPUT>;
          safeEnqueue(controller, finishChunk);
          safeClose(controller);
          markTerminated();

          // Build rich onFinish payload from finish event data.
          // The pubsub FINISH event carries output.text, output.steps, and
          // stepResult — enough to reconstruct the fields scenario tests expect
          // (text, steps, toolResults, finishReason, usage).
          if (onFinish) {
            try {
              const steps = (data.output?.steps ?? []) as any[];
              const allToolResults = steps.flatMap((s: any) => s?.toolResults ?? []);
              const allToolCalls = steps.flatMap((s: any) => s?.toolCalls ?? []);
              await onFinish({
                text: data.output?.text ?? '',
                steps,
                toolResults: allToolResults,
                toolCalls: allToolCalls,
                dynamicToolCalls: [],
                dynamicToolResults: [],
                staticToolCalls: [],
                staticToolResults: [],
                files: [],
                sources: [],
                reasoning: [],
                content: [],
                finishReason: data.stepResult?.reason ?? 'stop',
                usage: normalizeUsage(data.output?.usage),
                totalUsage: normalizeUsage(data.output?.usage),
                warnings: data.stepResult?.warnings ?? [],
                request: { body: undefined },
                response: {},
                reasoningText: undefined,
                providerMetadata: undefined,
              });
            } catch (callbackError) {
              logError(`[DurableAgentStream] onFinish callback error:`, callbackError);
            }
          }

          // When the finish reason is 'abort', also fire onAbort so
          // consumers see it — the abort was handled gracefully (clean
          // return from llm-execution) rather than crashing the workflow,
          // so the separate ABORT event never fires.
          if (onAbort && (data.stepResult?.reason as string) === 'abort') {
            try {
              await onAbort({
                steps: (data.output?.steps ?? []) as unknown[],
                text: (data.output?.text ?? '') as string,
              });
            } catch (callbackError) {
              logError(`[DurableAgentStream] onAbort (from FINISH) callback error:`, callbackError);
            }
          }

          // When the finish reason is 'error', also fire onError so
          // consumers see it — the error was handled gracefully (bail
          // response) rather than crashing the workflow, so the ERROR
          // event never fires.
          if (onError && data.stepResult?.reason === 'error') {
            try {
              const error = new Error(lastErrorMessage || 'LLM execution error', { cause: lastErrorCause });
              // Preserve the producer's stack and name so the failure stays attributable and classifiable.
              if (lastErrorStack) error.stack = lastErrorStack;
              if (lastErrorName) error.name = lastErrorName;
              await onError({ error });
            } catch (callbackError) {
              logError(`[DurableAgentStream] onError (from FINISH) callback error:`, callbackError);
            }
          }

          try {
            await onStreamFinished?.();
          } catch (callbackError) {
            logError(`[DurableAgentStream] onStreamFinished callback error:`, callbackError);
          }
          break;
        }

        case AgentStreamEventTypes.ERROR: {
          const data = streamEvent.data as AgentErrorEventData;
          const error = new Error(data.error.message);
          error.name = data.error.name;
          if (data.error.stack) {
            error.stack = data.error.stack;
          }
          // Enqueue an error chunk and close the stream normally (mirrors the
          // regular agent's deferred-error-chunk pattern). Using
          // controller.error() would error the base ReadableStream, which
          // MastraModelOutput.consumeStream swallows — leaving fullStream
          // hanging because no 'finish' event fires on the internal emitter.
          safeEnqueue(controller, {
            type: 'error',
            payload: { error },
          } as ChunkType<OUTPUT>);
          safeClose(controller);
          markTerminated();
          try {
            await onError?.({ error });
          } catch (callbackError) {
            logError(`[DurableAgentStream] onError callback error:`, callbackError);
          }
          break;
        }

        case AgentStreamEventTypes.SUSPENDED: {
          const data = streamEvent.data as AgentSuspendedEventData;
          // By default we leave the stream open on suspend so a later resume can
          // keep streaming chunks (the watchdog stays armed; a suspended-but-live
          // run reads as attachable via isAlive). `generate()`/`resumeGenerate()`
          // opt into closing so `getFullOutput()` can resolve.
          if (closeOnSuspend) {
            // Mark terminal BEFORE awaiting onSuspended: handleEvent re-armed the
            // watchdog at the top, and a slow callback (> idleTimeoutMs) would
            // otherwise let it fire and emit a spurious idle error on an
            // already-closing run. safeClose in `finally` so a throwing callback
            // can't skip closure.
            markTerminated();
            try {
              await onSuspended?.(data);
            } finally {
              safeClose(controller);
            }
          } else {
            await onSuspended?.(data);
          }
          break;
        }

        case AgentStreamEventTypes.ABORT: {
          const data = streamEvent.data as AgentAbortEventData;
          // Mark terminal BEFORE awaiting onAbort, for the same reason as the
          // closeOnSuspend path above — a slow callback must not let the re-armed
          // watchdog fire against an already-aborted run.
          markTerminated();
          try {
            await onAbort?.(data);
          } catch (callbackError) {
            logError(`[DurableAgentStream] onAbort callback error:`, callbackError);
          }
          // Abort closes the stream — the run will not continue.
          safeClose(controller);
          break;
        }

        case AgentStreamEventTypes.ITERATION_COMPLETE: {
          const data = streamEvent.data as AgentIterationCompleteEventData;
          try {
            await onIterationComplete?.(data);
          } catch (callbackError) {
            logError(`[DurableAgentStream] onIterationComplete callback error:`, callbackError);
          }
          break;
        }

        default:
          // Unknown event type - ignore
          break;
      }
    } catch (error) {
      // Intentional catch-and-continue: callback errors (onChunk, onStepFinish,
      // onSuspended) must not kill the stream. onFinish/onError have their own
      // inner try/catch and close/error the stream before invoking callbacks,
      // so they are not affected by this outer handler.
      logError(`[DurableAgentStream] Error handling event ${streamEvent.type}:`, error);
    }
  };

  // Create the readable stream
  const stream = new ReadableStream<ChunkType<OUTPUT>>({
    start(ctrl) {
      controller = ctrl;

      // Subscribe to pubsub with replay support for resumable streams.
      // Use indexed replay when supported. Transports without numeric offsets
      // must live-tail so resume/recovery does not replay pre-resume events.
      const topic = AGENT_STREAM_TOPIC(runId);
      const subscribePromise =
        offset === undefined
          ? pubsub.subscribeWithReplay(topic, handleEvent)
          : pubsub.supportsOffsets
            ? pubsub.subscribeFromOffset(topic, offset, handleEvent)
            : pubsub.subscribe(topic, handleEvent, { startFrom: 'latest' });

      subscribePromise
        .then(() => {
          if (cancelled) {
            // cleanup() was called before subscribe resolved — unsubscribe now
            void pubsub.unsubscribe(topic, handleEvent).catch(error => {
              logError(`[DurableAgentStream] Failed to unsubscribe from ${topic}:`, error);
            });
            resolveReady();
            return;
          }
          isSubscribed = true;
          // Start the idle countdown only once subscribed.
          armIdleTimer();
          resolveReady();
        })
        .catch(error => {
          logError(`[DurableAgentStream] Failed to subscribe to ${topic}:`, error);
          rejectReady(error);
          ctrl.error(error);
        });
    },
    cancel() {
      cleanup();
    },
  });

  // Cleanup function - intentionally fire-and-forget for unsubscribe.
  // Sets cancelled=true so the subscribe .then() handler will unsubscribe
  // if cleanup runs before the subscription promise resolves.
  const cleanup = () => {
    markTerminated();
    cancelled = true;
    if (isSubscribed) {
      isSubscribed = false;
      const topic = AGENT_STREAM_TOPIC(runId);
      void pubsub.unsubscribe(topic, handleEvent).catch(error => {
        logError(`[DurableAgentStream] Failed to unsubscribe from ${topic}:`, error);
      });
    }
    controller = null;
  };

  // Create the MastraModelOutput.
  // onStepFinish is passed to MastraModelOutput so it fires during stream
  // consumption (the harness and user code iterate fullStream, which drives
  // consumeStream internally). The pubsub STEP_FINISH event is not emitted
  // by the durable workflow, so the pubsub handler alone is not sufficient.
  //
  // onFinish is called from the pubsub FINISH handler (above) with a
  // payload built from the event data. This ensures it fires even when
  // nobody iterates the stream (e.g. resume flows with delay-only waits).
  const output = new MastraModelOutput<OUTPUT>({
    model,
    stream,
    messageList,
    messageId,
    options: {
      runId,
      onStepFinish: onStepFinish as MastraOnStepFinishCallback<OUTPUT> | undefined,
      // For durable agents there is only one MastraModelOutput for the whole run.
      // isLLMExecutionStep must be true so output processors run per-chunk
      // (processOutputStream / processPart path) rather than the batch
      // runOutputProcessors path which only fires at finish.  It also gates
      // createObjectStreamTransformer for structured output.
      // resolveFinalPromises forces text/finishReason promise resolution at
      // step-finish despite isLLMExecutionStep being true — durable agents have
      // no outer MastraModelOutput to resolve them.
      structuredOutput: structuredOutput as any,
      isLLMExecutionStep: true,
      resolveFinalPromises: true,
      outputProcessors,
      requestContext,
      tracingContext,
      experimentalTransform,
    },
  });

  return {
    output,
    cleanup,
    ready,
  };
}

/**
 * Helper to emit a chunk event to pubsub
 */
export async function emitChunkEvent<OUTPUT = undefined>(
  pubsub: PubSub,
  runId: string,
  chunk: ChunkType<OUTPUT>,
): Promise<void> {
  const topic = AGENT_STREAM_TOPIC(runId);
  await pubsub.publish(topic, {
    type: AgentStreamEventTypes.CHUNK,
    runId,
    data: chunk,
  });
}

/**
 * Helper to emit a step start event to pubsub.
 * The stream-adapter consumer enqueues this event's `data` verbatim as a
 * stream chunk, so it must match the canonical `step-start` `ChunkType` the
 * regular (non-durable) engine emits — `{ type, runId, from, payload }`.
 * Chunk consumers destructure `chunk.payload` (e.g. the `@mastra/ai-sdk`
 * chunk converter), so emitting the fields flat at the top level instead
 * crashes every durable `stream()`/`observe()` consumer with
 * "Cannot destructure property 'messageId' of 'chunk.payload'".
 */
export async function emitStepStartEvent(
  pubsub: PubSub,
  runId: string,
  data: {
    stepId?: string;
    messageId?: string;
    request?: StepStartPayload['request'];
    warnings?: StepStartPayload['warnings'];
  },
): Promise<void> {
  const chunk: Extract<ChunkType, { type: 'step-start' }> = {
    type: 'step-start',
    runId,
    from: ChunkFrom.AGENT,
    payload: {
      ...data,
      // Mirror the regular engine's defaults (`request: request || {}`,
      // `warnings: warnings || []` in the agentic-execution llm step).
      request: data.request ?? {},
      warnings: data.warnings ?? [],
    },
  };
  await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
    type: AgentStreamEventTypes.STEP_START,
    runId,
    data: chunk,
  });
}

/**
 * Helper to emit a step finish event to pubsub
 */
export async function emitStepFinishEvent(
  pubsub: PubSub,
  runId: string,
  data: AgentStepFinishEventData,
): Promise<void> {
  await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
    type: AgentStreamEventTypes.STEP_FINISH,
    runId,
    data,
  });
}

/**
 * Helper to emit a finish event to pubsub
 */
export async function emitFinishEvent(pubsub: PubSub, runId: string, data: AgentFinishEventData): Promise<void> {
  await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
    type: AgentStreamEventTypes.FINISH,
    runId,
    data,
  });
}

/**
 * Helper to emit an error event to pubsub
 */
export async function emitErrorEvent(pubsub: PubSub, runId: string, error: Error): Promise<void> {
  await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
    type: AgentStreamEventTypes.ERROR,
    runId,
    data: {
      error: {
        name: error.name,
        message: error.message,
        // stack intentionally omitted — avoid leaking internals through external pubsub
      },
    },
  });
}

/**
 * Helper to emit a suspended event to pubsub
 */
export async function emitSuspendedEvent(pubsub: PubSub, runId: string, data: AgentSuspendedEventData): Promise<void> {
  await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
    type: AgentStreamEventTypes.SUSPENDED,
    runId,
    data,
  });
}

/**
 * Helper to emit an abort event to pubsub
 */
export async function emitAbortEvent(pubsub: PubSub, runId: string, data: AgentAbortEventData): Promise<void> {
  await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
    type: AgentStreamEventTypes.ABORT,
    runId,
    data,
  });
}

/**
 * Helper to emit an iteration-complete event to pubsub
 */
export async function emitIterationCompleteEvent(
  pubsub: PubSub,
  runId: string,
  data: AgentIterationCompleteEventData,
): Promise<void> {
  await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
    type: AgentStreamEventTypes.ITERATION_COMPLETE,
    runId,
    data,
  });
}
