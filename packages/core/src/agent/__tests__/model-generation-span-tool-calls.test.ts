import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createTool } from '../../tools';
import { Agent } from '../agent';

/**
 * Regression test for #24291.
 *
 * The agent loop ends its MODEL_GENERATION span without `toolCalls` in the
 * output, so exporters that read `output.toolCalls` (e.g. PostHog's
 * `$ai_output_choices`) never see tool calls on streamed generations.
 * The loop must surface them in the same flat `{ toolCallId, toolName, args }`
 * shape as the non-loop path.
 */

const endGenerationCalls: any[] = [];

function createMockSpan(name: string, parentSpan?: any) {
  const span: Record<string, any> = {
    id: `mock-${name}-id`,
    traceId: 'trace-1',
    name,
    type: name,
    startTime: new Date(),
    isInternal: false,
    isEvent: false,
    isValid: true,
    isRootSpan: !parentSpan,
    parent: parentSpan,

    end: vi.fn(),
    error: vi.fn(),
    update: vi.fn(),
    exportSpan: vi.fn(),
    getParentSpanId: vi.fn(() => parentSpan?.id),
    findParent: vi.fn(),
    executeInContext: vi.fn(async (fn: () => Promise<any>) => fn()),
    executeInContextSync: vi.fn((fn: () => any) => fn()),
    get externalTraceId() {
      return 'trace-1';
    },

    createTracker: vi.fn(() => ({
      getTracingContext: vi.fn(() => ({ currentSpan: span })),
      reportGenerationError: vi.fn(),
      endGeneration: vi.fn((args: any) => {
        endGenerationCalls.push(args);
      }),
      updateGeneration: vi.fn(),
      wrapStream: vi.fn(<T>(stream: T) => stream),
      startStep: vi.fn(),
      updateStep: vi.fn(),
    })),
    createChildSpan: vi.fn((opts: any) => createMockSpan(opts?.type ?? 'child', span)),
    createEventSpan: vi.fn((opts: any) => createMockSpan(opts?.type ?? 'event', span)),
    getCorrelationContext: vi.fn(),
    observabilityInstance: {} as any,
  };

  return span;
}

async function mockTracedSpans() {
  const mod = await import('../../observability/utils');
  return vi.spyOn(mod, 'getOrCreateSpan').mockImplementation((opts: any) => {
    return createMockSpan(opts.type ?? opts.name ?? 'unknown') as any;
  });
}

const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

function createToolCallingModel() {
  let step = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      step++;
      const chunks =
        step === 1
          ? [
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'tool-call', toolCallId: 'call_1', toolName: 'get_weather', input: '{"city":"Paris"}' },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]
          : [
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'It is sunny in Paris.' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage },
            ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(chunks as any),
      };
    },
  });
}

function createTextOnlyModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hello' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage },
      ]),
    }),
  });
}

const getWeather = createTool({
  id: 'get_weather',
  description: 'Get the weather',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => ({ city, forecast: 'sunny' }),
});

describe('MODEL_GENERATION span output tool calls (#24291)', () => {
  it('includes flattened toolCalls in the span output when the model calls tools', async () => {
    endGenerationCalls.length = 0;
    const spy = await mockTracedSpans();

    try {
      const agent = new Agent({
        id: 'tool-span-agent',
        name: 'Tool Span Agent',
        instructions: 'test',
        model: createToolCallingModel(),
        tools: { get_weather: getWeather },
      });

      const res = await agent.stream('weather in Paris?');
      await res.consumeStream();

      expect(endGenerationCalls).toHaveLength(1);
      expect(endGenerationCalls[0].output.toolCalls).toEqual([
        { toolCallId: 'call_1', toolName: 'get_weather', args: { city: 'Paris' } },
      ]);
      expect(endGenerationCalls[0].output.text).toBe('It is sunny in Paris.');
    } finally {
      spy.mockRestore();
    }
  });

  it('omits toolCalls from the span output when no tools were called', async () => {
    endGenerationCalls.length = 0;
    const spy = await mockTracedSpans();

    try {
      const agent = new Agent({
        id: 'text-span-agent',
        name: 'Text Span Agent',
        instructions: 'test',
        model: createTextOnlyModel(),
      });

      const res = await agent.stream('hi');
      await res.consumeStream();

      expect(endGenerationCalls).toHaveLength(1);
      expect(endGenerationCalls[0].output.toolCalls).toBeUndefined();
      expect(endGenerationCalls[0].output.text).toBe('Hello');
    } finally {
      spy.mockRestore();
    }
  });
});
