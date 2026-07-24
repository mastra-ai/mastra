import { ReadableStream } from 'node:stream/web';
import type { PubSub } from '../../events/pubsub';
import type { Event } from '../../events/types';
import type { IMastraLogger } from '../../logger';
import type { OutputProcessorOrWorkflow } from '../../processors';
import { safeClose, safeEnqueue } from '../../stream/base';
import { MastraModelOutput } from '../../stream/base/output';
import type {
  ChunkType,
  MastraOnFinishCallback,
  MastraOnStepFinishCallback,
  MastraStreamTransformOptions,
  LanguageModelUsage,
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

  const handleEvent = async (event: Event) => {
    if (!controller) return;

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
              await onAbort({ steps: (data.output?.steps ?? []) as unknown[] });
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
              await onError({ error: new Error(lastErrorMessage || 'LLM execution error') });
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
          try {
            await onError?.({ error });
          } catch (callbackError) {
            logError(`[DurableAgentStream] onError callback error:`, callbackError);
          }
          break;
        }

        case AgentStreamEventTypes.SUSPENDED: {
          const data = streamEvent.data as AgentSuspendedEventData;
          await onSuspended?.(data);
          // By default we leave the stream open on suspend so a later resume
          // can keep streaming chunks. `generate()`/`resumeGenerate()` opt
          // into closing here so `getFullOutput()` can resolve.
          if (closeOnSuspend) {
            safeClose(controller);
          }
          break;
        }

        case AgentStreamEventTypes.ABORT: {
          const data = streamEvent.data as AgentAbortEventData;
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

      // Subscribe to pubsub with replay support for resumable streams
      // If offset is specified, use indexed replay for efficiency
      // Otherwise use full replay
      const topic = AGENT_STREAM_TOPIC(runId);
      const subscribePromise =
        offset !== undefined
          ? pubsub.subscribeFromOffset(topic, offset, handleEvent)
          : pubsub.subscribeWithReplay(topic, handleEvent);

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
 * The `data` payload must include `type: 'step-start'` so the stream-adapter
 * consumer recognises it as a `ChunkType` and enqueues it onto the client stream.
 */
export async function emitStepStartEvent(
  pubsub: PubSub,
  runId: string,
  data: { stepId?: string; request?: unknown; warnings?: unknown[] },
): Promise<void> {
  await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
    type: AgentStreamEventTypes.STEP_START,
    runId,
    data: { type: 'step-start', ...data },
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
