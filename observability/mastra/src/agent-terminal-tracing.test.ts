import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { ProcessOutputStreamArgs, Processor } from '@mastra/core/processors';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Observability } from './default';
import { TestExporter } from './exporters';

// Leaves a child span open on the agent run so terminal handling must sweep it.
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

  function setup({
    model,
    memory,
    outputProcessors,
  }: {
    model: MockLanguageModelV2;
    memory?: MockMemory;
    outputProcessors?: Processor[];
  }) {
    const agent = new Agent({
      id: 'terminal-tracing-agent',
      name: 'Terminal Tracing Agent',
      instructions: 'Test',
      model,
      ...(memory ? { memory } : {}),
      ...(outputProcessors ? { outputProcessors } : {}),
    });
    observability = new Observability({
      configs: {
        default: { serviceName: 'agent-terminal-tracing', exporters: [exporter] },
      },
    });
    const mastra = new Mastra({ logger: false, agents: { agent }, observability });
    return mastra.getAgent('agent');
  }

  const incompleteSpanNames = () => exporter.getIncompleteSpans().map(entry => entry.span?.name);

  const endedAgentSpan = () =>
    exporter.getByEventType(TracingEventType.SPAN_ENDED).find(event => event.exportedSpan.type === SpanType.AGENT_RUN)
      ?.exportedSpan;

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
    const agent = setup({ model, outputProcessors: [new OpenChildOutputProcessor()] });

    const output = await agent.stream('Hello', { modelSettings: { maxRetries: 0 } });
    for await (const _chunk of output.fullStream) {
      // Drain the stream so the error terminal and its tracing callbacks run.
    }
    await new Promise(resolve => setTimeout(resolve, 100));

    const startedNames = exporter.getByEventType(TracingEventType.SPAN_STARTED).map(event => event.exportedSpan.name);
    expect(startedNames).toContain('open output processor child');
    expect(incompleteSpanNames(), 'spans left open after the agent error terminal').toEqual([]);
    expect(endedAgentSpan()?.errorInfo?.message).toBe(streamError.message);
  });

  it('ends open descendant spans when an agent stream is aborted mid-stream', async () => {
    // The stream never closes on its own, so model spans are still open when
    // the abort terminal runs — including cases where the model span ends
    // first and abandons its children.
    const model = new MockLanguageModelV2({
      doGenerate: async () => {
        throw new Error('should not be called');
      },
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id' });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'partial ' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'response' });
            // Never closes; only abort terminates the run.
          },
        }),
      }),
    });
    const agent = setup({ model });

    const controller = new AbortController();
    const output = await agent.stream('Hello', { abortSignal: controller.signal });
    let sawDelta = false;
    try {
      for await (const chunk of output.fullStream) {
        if (chunk.type === 'text-delta') {
          sawDelta = true;
          controller.abort();
        }
      }
    } catch {
      // Aborting may reject the stream; the span assertions below are what matter.
    }
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(sawDelta).toBe(true);
    expect(incompleteSpanNames(), 'spans left open after the agent abort terminal').toEqual([]);
    expect(endedAgentSpan()?.output).toMatchObject({ status: 'aborted' });
    const descendantOutputs = exporter
      .getByEventType(TracingEventType.SPAN_ENDED)
      .filter(event => event.exportedSpan.type !== SpanType.AGENT_RUN)
      .map(event => event.exportedSpan.output as { status?: string } | undefined);
    expect(
      descendantOutputs.filter(output => output?.status === 'aborted'),
      'descendant spans must not inherit the terminal output',
    ).toEqual([]);
  });

  it('ends the agent span when a prepare step fails before streaming starts', async () => {
    const model = new MockLanguageModelV2({
      doGenerate: async () => {
        throw new Error('should not be called');
      },
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }]),
      }),
    });
    const memory = new MockMemory();
    memory.getThreadById = async () => {
      throw new Error('memory fetch exploded');
    };
    const agent = setup({ model, memory });

    await expect(agent.stream('Hello', { memory: { thread: 'thread-1', resource: 'resource-1' } })).rejects.toThrow(
      'memory fetch exploded',
    );
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(incompleteSpanNames(), 'spans left open after a prepare failure').toEqual([]);
    expect(endedAgentSpan()?.errorInfo?.message).toContain('memory fetch exploded');
  });
});
