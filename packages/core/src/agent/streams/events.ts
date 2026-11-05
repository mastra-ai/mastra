import { MastraError } from '../../error';
import type { PubSub } from '../../events/pubsub';
import { currentRunGeneration } from '../../storage/run-fencing';
import { getChunkProducedAt } from '../../stream/base/produced-at';
import { ChunkFrom } from '../../stream/types';
import type { ChunkType, DataChunkType, StepStartPayload } from '../../stream/types';
// TODO: move these event payload types into streams/types once their durable
// step-result dependencies move with them.
import type {
  AgentAbortEventData,
  AgentErrorEventData,
  AgentFinishEventData,
  AgentIterationCompleteEventData,
  AgentStepFinishEventData,
  AgentSuspendedEventData,
} from '../durable/types';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from './constants';

/**
 * Tags a run's stream event with the claim generation of the execution
 * publishing it, read from the run fence scope unless the caller passes it.
 */
function generationTag(runId: string, generation?: number): { generation?: number } {
  const tagged = generation ?? currentRunGeneration(runId);
  return tagged === undefined ? {} : { generation: tagged };
}

/**
 * Helper to emit a chunk event to pubsub
 */
export async function emitChunkEvent<OUTPUT = undefined>(
  pubsub: PubSub,
  runId: string,
  chunk: ChunkType<OUTPUT> | DataChunkType,
  outputProcessed?: boolean,
): Promise<void> {
  const topic = AGENT_STREAM_TOPIC(runId);
  await pubsub.publish(topic, {
    type: AgentStreamEventTypes.CHUNK,
    runId,
    data: chunk,
    // The chunk crosses the pubsub as JSON; keep when it was produced.
    producedAt: getChunkProducedAt(chunk) ?? Date.now(),
    ...(outputProcessed ? { outputProcessed } : {}),
    ...generationTag(runId),
  });
}

/**
 * Announce that the execution with `generation` claimed the run, so the run's
 * stream consumers drop what older executions still publish from here on.
 *
 * Readers only learn a generation from events they see. Without this marker,
 * a reader's floor would rise only at the new execution's first event, which
 * comes after rehydration and the first model call. Until then, an execution
 * that stalled past its claim and resumed keeps publishing: it only learns it
 * was superseded at its next heartbeat or step check, so `fencePubSub` doesn't
 * stop it yet. Its chunks would reach readers, and its `finish` would end their
 * streams before the new execution's answer arrives.
 *
 * Published on the run's stream topic, not a separate one, so it is ordered
 * against the chunks around it and replayed to readers that reconnect from an
 * offset. Readers swallow it and never forward it as a chunk. Readers that
 * reconnect past it read the claim's generation from storage instead.
 */
export async function emitOwnershipClaimedEvent(pubsub: PubSub, runId: string, generation: number): Promise<void> {
  await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
    type: AgentStreamEventTypes.OWNERSHIP_CLAIMED,
    runId,
    data: {},
    generation,
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
    startedAt?: StepStartPayload['startedAt'];
    modelId?: StepStartPayload['modelId'];
    provider?: StepStartPayload['provider'];
    request?: StepStartPayload['request'];
    warnings?: StepStartPayload['warnings'];
  },
  outputProcessed?: boolean,
): Promise<void> {
  await publishStepStartChunk(pubsub, runId, createStepStartChunk(runId, data), outputProcessed);
}

/**
 * Build the `step-start` chunk `emitStepStartEvent` publishes, so a producer
 * can run it through output processors before publishing it.
 */
export function createStepStartChunk(
  runId: string,
  data: Parameters<typeof emitStepStartEvent>[2],
): Extract<ChunkType, { type: 'step-start' }> {
  return {
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
}

/**
 * Publish a `step-start` chunk. `outputProcessed` marks a chunk the producer
 * already ran through output processors, so consumers don't run them again.
 */
export async function publishStepStartChunk(
  pubsub: PubSub,
  runId: string,
  chunk: ChunkType,
  outputProcessed?: boolean,
): Promise<void> {
  await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
    type: AgentStreamEventTypes.STEP_START,
    runId,
    data: chunk,
    ...(outputProcessed ? { outputProcessed } : {}),
    ...generationTag(runId),
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
    ...generationTag(runId),
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
    ...generationTag(runId),
  });
}

/**
 * Helper to emit an error event to pubsub
 */
export async function emitErrorEvent(
  pubsub: PubSub,
  runId: string,
  error: Error,
  generation?: number,
  delivery?: AgentErrorEventData['delivery'],
): Promise<void> {
  await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
    type: AgentStreamEventTypes.ERROR,
    runId,
    data: {
      error: {
        ...(error instanceof MastraError ? { id: error.id } : {}),
        name: error.name,
        message: error.message,
        // stack intentionally omitted — avoid leaking internals through external pubsub
      },
      ...(delivery ? { delivery } : {}),
    },
    ...generationTag(runId, generation),
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
    ...generationTag(runId),
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
    ...generationTag(runId),
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
    ...generationTag(runId),
  });
}
