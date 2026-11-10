import type { MastraStepResult, StepFinishPayload, StepStartPayload } from '../../stream/types';
import type { AgentFinishEventData } from '../durable/types';

/**
 * The shape of the step events a run publishes on its stream topic
 * (`agent.stream.<runId>`), built from the loop's in-process chunks.
 *
 * The in-process chunks are made for the caller: a `step-finish` holds the
 * whole prompt and every earlier step, so publishing it as-is makes each event
 * grow with the run, and the topic log (stored in full on Redis) grow with the
 * square of the step count. Readers of the topic (`observe()`, reconnecting
 * clients, DurableAgent streams) only need what is built here, which matches
 * what DurableAgent publishes. Every field is picked explicitly, so new fields
 * on the in-process chunks stay off the topic unless they are added here.
 */

type StepMetadataField = 'id' | 'timestamp' | 'modelId' | 'model' | 'modelMetadata' | 'headers' | 'providerMetadata';

/** Response metadata readers turn into `step.response`; the provider request is left out. */
const STEP_METADATA_FIELDS: readonly StepMetadataField[] = [
  'id',
  'timestamp',
  'modelId',
  'model',
  'modelMetadata',
  'headers',
  'providerMetadata',
];

/** A `step-finish` payload as published on a run's stream topic. */
export interface AgentStreamStepFinishPayload {
  id?: string;
  messageId?: string;
  providerMetadata?: StepFinishPayload['providerMetadata'];
  stepResult: StepFinishPayload['stepResult'];
  metadata: Partial<Record<StepMetadataField, unknown>>;
  /** `steps` holds only the current step's tripwire, which readers check on the last step. */
  output: {
    usage: StepFinishPayload['output']['usage'];
    steps?: [{ tripwire: NonNullable<MastraStepResult['tripwire']> }];
  };
  /** The finished step's content, which readers can't rebuild without the run's messages. */
  _durableStepContent?: MastraStepResult['content'];
  /** The run's response messages so far, reported as `step.response.messages`. */
  _durableResponseMessages?: NonNullable<StepFinishPayload['messages']>['nonUser'];
}

/** The `step-start` data to publish: everything but the provider request and prompt. */
export function toStreamStepStart(payload: StepStartPayload) {
  const { messageId, startedAt, modelId, provider, warnings, backgroundResultTaskIds, stepId } = payload;
  return {
    ...(stepId !== undefined ? { stepId: stepId as string } : {}),
    messageId,
    startedAt,
    modelId,
    provider,
    warnings,
    ...(backgroundResultTaskIds !== undefined ? { backgroundResultTaskIds } : {}),
  };
}

/**
 * The `step-finish` payload to publish. Of the steps so far, only the last
 * one's tripwire is kept: readers check it to tell a rejected step.
 *
 * @param content The finished step's content, when the publisher can read it
 * from the run's messages. Readers otherwise fall back to their own messages.
 */
export function toStreamStepFinish(
  payload: StepFinishPayload<any, any>,
  content: MastraStepResult<any>['content'] | undefined,
): AgentStreamStepFinishPayload {
  const metadata: AgentStreamStepFinishPayload['metadata'] = {};
  for (const field of STEP_METADATA_FIELDS) {
    if (payload.metadata?.[field] !== undefined) metadata[field] = payload.metadata[field];
  }
  const tripwire = payload.output?.steps?.at(-1)?.tripwire;
  return {
    ...(payload.id !== undefined ? { id: payload.id } : {}),
    ...(payload.messageId !== undefined ? { messageId: payload.messageId } : {}),
    ...(payload.providerMetadata !== undefined ? { providerMetadata: payload.providerMetadata } : {}),
    stepResult: { ...payload.stepResult },
    metadata,
    output: {
      usage: payload.output?.usage,
      ...(tripwire ? { steps: [{ tripwire }] as [{ tripwire: typeof tripwire }] } : {}),
    },
    ...(content ? { _durableStepContent: content } : {}),
    ...(payload.messages ? { _durableResponseMessages: payload.messages.nonUser } : {}),
  };
}

/** The `finish` data to publish: the run's result, with each step stripped of its prompt and messages. */
export function toStreamFinish(payload: Record<string, any>): AgentFinishEventData {
  const { output = {}, stepResult, messages, textRewritten } = payload;
  return {
    output: {
      text: output.text,
      usage: output.usage,
      steps: (output.steps ?? []).map(toStreamStep),
      ...(output.object !== undefined ? { object: output.object } : {}),
    },
    stepResult,
    ...(messages ? { messages } : {}),
    ...(textRewritten ? { textRewritten } : {}),
  } as AgentFinishEventData;
}

/**
 * A finished step without its provider request and response messages. Readers
 * take each step's response messages from its `step-finish` event instead.
 * The loop's step objects compute `text` on access, so it is copied as a value
 * to survive JSON transports. Tool calls and results stay in `content`: readers
 * take them from the run's tool chunks.
 */
function toStreamStep(step: MastraStepResult<any>) {
  if (!step || typeof step !== 'object') return step;
  const { id, timestamp, modelId, headers } = (step.response ?? {}) as Record<string, any>;
  return {
    content: step.content ?? [],
    text: step.text,
    ...(step.reasoningText !== undefined ? { reasoningText: step.reasoningText } : {}),
    finishReason: step.finishReason,
    usage: step.usage,
    warnings: step.warnings ?? [],
    request: {},
    response: { id, timestamp, modelId, ...(headers ? { headers } : {}), messages: [] },
    providerMetadata: step.providerMetadata,
    ...(step.tripwire ? { tripwire: step.tripwire } : {}),
  };
}
