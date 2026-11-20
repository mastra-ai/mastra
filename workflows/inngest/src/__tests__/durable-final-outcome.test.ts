import { MessageList } from '@mastra/core/agent/message-list';
import { Mastra } from '@mastra/core/mastra';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { Inngest } from 'inngest';
import { describe, expect, it } from 'vitest';
import { Observability } from '../../../../observability/mastra/src/default';
import { TestExporter } from '../../../../observability/mastra/src/exporters';
import { createInngestDurableAgenticWorkflow } from '../durable-agent/create-inngest-agentic-workflow';

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

const endedSpans = (exporter: TestExporter) =>
  exporter.getByEventType(TracingEventType.SPAN_ENDED).map(event => event.exportedSpan);

/** Runs the final step the way a worker does: from the saved state, with spans another process started. */
async function runFinalStep(observability: Observability, state: object, requestContext = new RequestContext()) {
  const mastra = new Mastra({ observability, logger: false });
  const agentSpan = mastra.observability.getSelectedInstance({ requestContext })!.startSpan({
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
  const workflow = createInngestDurableAgenticWorkflow({
    inngest: new Inngest({ id: 'final-outcome', isDev: true }),
  }) as any;

  await workflow.steps['map-final-output'].execute({
    inputData: iterationState,
    getInitData: () => iterationState,
    mastra,
    requestContext,
    tracingContext: {},
  });
}

describe('Inngest final step on a worker with no run-registry entry', () => {
  it.each(CASES)('ends the root spans with the outcome in the saved state: $name', async ({ state, expected }) => {
    const exporter = new TestExporter();
    await runFinalStep(
      new Observability({ configs: { default: { serviceName: 'final-outcome', exporters: [exporter] } } }),
      state,
    );

    const ended = (type: SpanType) => endedSpans(exporter).filter(span => span.type === type);
    await expect.poll(() => ended(SpanType.MODEL_GENERATION).length).toBe(1);
    await expect.poll(() => ended(SpanType.AGENT_RUN).length).toBe(1);
    expect(ended(SpanType.AGENT_RUN)[0]).toMatchObject(expected);
    expect(ended(SpanType.MODEL_GENERATION)[0]).toMatchObject(expected);
  });

  it('ends the root spans on the observability config the request context selects', async () => {
    const defaultExporter = new TestExporter();
    const selectedExporter = new TestExporter();
    await runFinalStep(
      new Observability({
        configs: {
          default: { serviceName: 'final-outcome', exporters: [defaultExporter] },
          selected: { serviceName: 'final-outcome', exporters: [selectedExporter] },
        },
        configSelector: ({ requestContext }) => (requestContext?.get('obsConfig') as string | undefined) ?? 'default',
      }),
      CASES[0]!.state,
      new RequestContext([['obsConfig', 'selected']]),
    );

    const endedTypes = (exporter: TestExporter) => endedSpans(exporter).map(span => span.type);
    await expect.poll(() => endedTypes(selectedExporter)).toEqual([SpanType.MODEL_GENERATION, SpanType.AGENT_RUN]);
    expect(endedTypes(defaultExporter)).toEqual([]);
  });
});
