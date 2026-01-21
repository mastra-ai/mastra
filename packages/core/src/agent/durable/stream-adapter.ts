import { ReadableStream } from 'node:stream/web';
import type { PubSub } from '../../events/pubsub';
import type { Event } from '../../events/types';
import { MastraModelOutput } from '../../stream/base/output';
import { MessageList } from '../message-list';
import type { ChunkType } from '../../stream/types';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from './constants';
import type {
  AgentStreamEvent,
  AgentChunkEventData,
  AgentStepFinishEventData,
  AgentFinishEventData,
  AgentErrorEventData,
  AgentSuspendedEventData,
} from './types';

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
    version: 'v2' | 'v3';
  };
  /** Thread ID for memory */
  threadId?: string;
  /** Resource ID for memory */
  resourceId?: string;
  /** Callback when chunk is received */
  onChunk?: (chunk: ChunkType<OUTPUT>) => void | Promise<void>;
  /** Callback when step finishes */
  onStepFinish?: (result: AgentStepFinishEventData) => void | Promise<void>;
  /** Callback when execution finishes */
  onFinish?: (result: AgentFinishEventData) => void | Promise<void>;
  /** Callback on error */
  onError?: (error: Error) => void | Promise<void>;
  /** Callback when workflow suspends */
  onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
}

/**
 * Result from creating a durable agent stream
 */
export interface DurableAgentStreamResult<OUTPUT = undefined> {
  /** The MastraModelOutput that streams from pubsub events */
  output: MastraModelOutput<OUTPUT>;
  /** Cleanup function to unsubscribe from pubsub */
  cleanup: () => void;
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
    onChunk,
    onStepFinish,
    onFinish,
    onError,
    onSuspended,
  } = options;

  // Create a message list for the output
  const messageList = new MessageList({
    threadId,
    resourceId,
  });

  // Track subscription state
  let isSubscribed = false;
  let controller: ReadableStreamDefaultController<ChunkType<OUTPUT>> | null = null;

  // Handler for pubsub events
  const handleEvent = async (event: Event) => {
    if (!controller) return;

    // Parse the event data as AgentStreamEvent
    const streamEvent = event as unknown as AgentStreamEvent;

    try {
      switch (streamEvent.type) {
        case AgentStreamEventTypes.CHUNK: {
          const chunk = streamEvent.data as AgentChunkEventData;
          controller.enqueue(chunk as ChunkType<OUTPUT>);
          await onChunk?.(chunk as ChunkType<OUTPUT>);
          break;
        }

        case AgentStreamEventTypes.STEP_START: {
          // Step start - enqueue if it's a chunk type
          const chunk = streamEvent.data as ChunkType<OUTPUT>;
          if (chunk && 'type' in chunk) {
            controller.enqueue(chunk);
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
          await onFinish?.(data);
          controller.close();
          break;
        }

        case AgentStreamEventTypes.ERROR: {
          const data = streamEvent.data as AgentErrorEventData;
          const error = new Error(data.error.message);
          error.name = data.error.name;
          if (data.error.stack) {
            error.stack = data.error.stack;
          }
          await onError?.(error);
          controller.error(error);
          break;
        }

        case AgentStreamEventTypes.SUSPENDED: {
          const data = streamEvent.data as AgentSuspendedEventData;
          await onSuspended?.(data);
          // Don't close the stream on suspend - it can be resumed
          break;
        }

        default:
          // Unknown event type - ignore
          break;
      }
    } catch (error) {
      console.error(`[DurableAgentStream] Error handling event ${streamEvent.type}:`, error);
    }
  };

  // Create the readable stream
  const stream = new ReadableStream<ChunkType<OUTPUT>>({
    start(ctrl) {
      controller = ctrl;

      // Subscribe to pubsub
      const topic = AGENT_STREAM_TOPIC(runId);
      pubsub
        .subscribe(topic, handleEvent)
        .then(() => {
          isSubscribed = true;
        })
        .catch(error => {
          console.error(`[DurableAgentStream] Failed to subscribe to ${topic}:`, error);
          ctrl.error(error);
        });
    },
    cancel() {
      cleanup();
    },
  });

  // Cleanup function
  const cleanup = () => {
    if (isSubscribed) {
      const topic = AGENT_STREAM_TOPIC(runId);
      pubsub.unsubscribe(topic, handleEvent).catch(error => {
        console.error(`[DurableAgentStream] Failed to unsubscribe from ${topic}:`, error);
      });
      isSubscribed = false;
    }
    controller = null;
  };

  // Create the MastraModelOutput
  const output = new MastraModelOutput<OUTPUT>({
    model,
    stream,
    messageList,
    messageId,
    options: {
      runId,
    },
  });

  return {
    output,
    cleanup,
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
  await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
    type: AgentStreamEventTypes.CHUNK,
    runId,
    data: chunk,
  });
}

/**
 * Helper to emit a step start event to pubsub
 */
export async function emitStepStartEvent(
  pubsub: PubSub,
  runId: string,
  data: { stepId?: string; request?: unknown; warnings?: unknown[] },
): Promise<void> {
  await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
    type: AgentStreamEventTypes.STEP_START,
    runId,
    data,
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
        stack: error.stack,
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
