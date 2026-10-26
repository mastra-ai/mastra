import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it } from 'vitest';

import { Observability } from './default';
import { TestExporter } from './exporters';

const textModel = () =>
  new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      content: [{ type: 'text', text: 'ok' }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: 'ok' },
        { type: 'text-end', id: 't' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });

describe('Feature: tweaked instructions stay resolvable from an experiment trace', () => {
  let observability: Observability | undefined;

  afterEach(async () => {
    await observability?.shutdown();
  });

  it('records the tweaked prompt once on the AGENT_RUN span, and only a flag in the trace metadata', async () => {
    // Given an agent with code instructions, traced by a real Observability instance
    const exporter = new TestExporter();
    observability = new Observability({
      configs: { default: { serviceName: 'experiment-agent-call-options', exporters: [exporter] } },
    });
    const agent = new Agent({ id: 'eval-agent', name: 'Eval', instructions: 'code instructions', model: textModel() });
    const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), observability, logger: false });
    const dataset = await mastra.datasets.create({ name: 'traced call options' });
    await dataset.addItem({ input: 'first' });
    await dataset.addItem({ input: 'second' });

    // When an experiment runs with tweaked instructions and sampling settings
    const summary = await dataset.startExperiment({
      targetType: 'agent',
      targetId: 'eval-agent',
      agentCallOptions: { instructions: 'tweaked instructions', modelSettings: { temperature: 0.2 } },
    });
    await observability.flush();

    // Then each item's AGENT_RUN span carries the tweaked prompt as its instructions attribute
    const agentRuns = exporter
      .getByEventType(TracingEventType.SPAN_ENDED)
      .map(event => event.exportedSpan)
      .filter(span => span.type === SpanType.AGENT_RUN);
    expect(agentRuns).toHaveLength(2);
    for (const span of agentRuns) {
      expect(span.attributes?.instructions).toBe('tweaked instructions');
      // And the trace metadata links back to the experiment and flags the tweak without copying the prompt
      expect(span.metadata).toMatchObject({
        experimentId: summary.experimentId,
        agentCallOptions: { modelSettings: { temperature: 0.2 } },
        agentInstructionsOverridden: true,
      });
      expect(JSON.stringify(span.metadata)).not.toContain('tweaked instructions');
    }
  });
});
