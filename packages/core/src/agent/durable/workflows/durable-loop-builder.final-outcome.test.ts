import { describe, expect, it } from 'vitest';
import { captureOutcomeEvents } from '../../../loop/test-utils/aimock/outcome-test-utils';
import { Mastra } from '../../../mastra';
import { SpanType } from '../../../observability';
import { RequestContext } from '../../../request-context';
import { MessageList } from '../../message-list';
import { createDurableAgenticWorkflow } from './create-durable-agentic-workflow';
import { MAP_FINAL_OUTPUT_STEP_ID } from './durable-loop-builder';

const observerFailure = {
  outcome: 'interrupted',
  stopReason: 'observer_failed',
  stopReasonContext: { observerSpanId: 'observer-span' },
};

const CASES = [
  {
    name: 'normal completion',
    state: { tracingStopCause: 'model_finished', lastStepResult: { reason: 'stop' } },
    expected: { outcome: 'success', stopReason: null },
  },
  {
    name: 'step limit',
    state: { tracingStopCause: 'max_steps', lastStepResult: { reason: 'tool-calls' }, options: { maxSteps: 1 } },
    expected: { outcome: 'limit', stopReason: 'max_steps', stopReasonContext: { maxSteps: 1 } },
  },
  {
    name: 'failed delegation',
    state: {
      tracingStopCause: 'delegation',
      tracingDelegationFailure: { outcome: 'error', stopReason: 'model_error' },
      lastStepResult: { reason: 'tool-calls' },
    },
    expected: {
      outcome: 'interrupted',
      stopReason: 'delegation_bail',
      stopReasonContext: { causeOutcome: 'error', causeStopReason: 'model_error' },
    },
  },
  {
    name: 'observer failure',
    state: { tracingTermination: observerFailure, lastStepResult: { reason: 'tripwire' } },
    expected: observerFailure,
  },
  {
    name: 'older snapshot without the facts',
    state: { lastStepResult: { reason: 'stop' } },
    expected: { outcome: 'unknown' },
  },
];

describe('durable final step on a worker with no run-registry entry', () => {
  it.each(CASES)('ends the root spans with the outcome in the saved state: $name', async ({ state, expected }) => {
    const { observability, ended } = captureOutcomeEvents();
    const mastra = new Mastra({ observability, logger: false });
    const agentSpan = mastra.observability.getDefaultInstance()!.startSpan({
      type: SpanType.AGENT_RUN,
      name: 'agent run',
    });
    const modelSpan = agentSpan.createChildSpan({ type: SpanType.MODEL_GENERATION, name: 'model generation' });
    const iterationState = {
      runId: 'run-from-another-worker',
      agentId: 'agent',
      messageId: 'message',
      messageListState: new MessageList().serialize(),
      accumulatedSteps: [],
      accumulatedUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      agentSpanData: agentSpan.exportSpan(),
      modelSpanData: modelSpan.exportSpan(),
      options: {},
      state: {},
      ...state,
    };
    const finalStep = (createDurableAgenticWorkflow() as any).steps[MAP_FINAL_OUTPUT_STEP_ID];

    await finalStep.execute({
      inputData: iterationState,
      getInitData: () => iterationState,
      state: {},
      mastra,
      requestContext: new RequestContext(),
      tracingContext: {},
    });

    await expect.poll(() => ended(SpanType.MODEL_GENERATION).length).toBe(1);
    await expect.poll(() => ended(SpanType.AGENT_RUN).length).toBe(1);
    expect(ended(SpanType.AGENT_RUN)[0]).toMatchObject(expected);
    expect(ended(SpanType.MODEL_GENERATION)[0]).toMatchObject(expected);
  });
});
