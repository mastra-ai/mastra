import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { ProcessOutputStreamArgs, Processor } from '@mastra/core/processors';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Observability } from './default';
import { TestExporter } from './exporters';

class OpenChildOutputProcessor implements Processor {
  readonly id = 'open-child-output-processor';
  private childCreated = false;

  async processOutputStream({ part, tracingContext }: ProcessOutputStreamArgs) {
    if (!this.childCreated && tracingContext?.currentSpan) {
      this.childCreated = true;
      tracingContext.currentSpan.createChildSpan({
        type: SpanType.GENERIC,
        name: 'open output processor child',
      });
    }
    return part;
  }
}

describe('agent terminal tracing', () => {
  let exporter: TestExporter;
  let observability: Observability;

  beforeEach(() => {
    exporter = new TestExporter();
  });

  afterEach(async () => {
    await observability?.shutdown();
  });

  it('ends open descendant spans when an agent stream terminates with an error', async () => {
    const streamError = new Error('LLM mid-stream error');
    const model = new MockLanguageModelV2({
      doGenerate: async () => {
        throw streamError;
      },
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'partial response' },
          { type: 'text-end', id: 'text-1' },
          { type: 'error' as const, error: streamError },
        ]),
      }),
    });
    const agent = new Agent({
      id: 'terminal-error-agent',
      name: 'Terminal Error Agent',
      instructions: 'Test',
      model,
      outputProcessors: [new OpenChildOutputProcessor()],
    });
    observability = new Observability({
      configs: {
        default: { serviceName: 'agent-terminal-tracing', exporters: [exporter] },
      },
    });
    const mastra = new Mastra({
      logger: false,
      agents: { agent },
      observability,
    });

    const output = await mastra.getAgent('agent').stream('Hello', { modelSettings: { maxRetries: 0 } });
    for await (const _chunk of output.fullStream) {
      // Drain the stream so the error terminal and its tracing callbacks run.
    }
    await new Promise(resolve => setTimeout(resolve, 100));

    const startedNames = exporter.getByEventType(TracingEventType.SPAN_STARTED).map(event => event.exportedSpan.name);
    expect(startedNames).toContain('open output processor child');
    expect(
      exporter.getIncompleteSpans().map(entry => entry.span?.name),
      'spans left open after the agent error terminal',
    ).toEqual([]);
    const endedAgentSpan = exporter
      .getByEventType(TracingEventType.SPAN_ENDED)
      .find(event => event.exportedSpan.type === SpanType.AGENT_RUN)?.exportedSpan;
    expect(endedAgentSpan?.errorInfo?.message).toBe(streamError.message);
  });
});
