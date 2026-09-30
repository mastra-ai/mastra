import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createTool } from '../../tools';
import { Agent } from '../agent';

/**
 * Regression test for #25302.
 *
 * The MODEL_GENERATION `tools` attribute must reflect the tool set actually
 * offered to the provider after `processInputStep` ran (per-step `activeTools`
 * narrowing / `tools` additions), not the run-level registry.
 */

const updateGenerationCalls: any[] = [];

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
      endGeneration: vi.fn(),
      updateGeneration: vi.fn((args: any) => {
        updateGenerationCalls.push(args);
      }),
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

/** Step 1 calls tool `a`, step 2 answers with text. Records the tool names the provider received per call. */
function createModel(providerTools: string[][]) {
  let step = 0;
  return new MockLanguageModelV2({
    doStream: async options => {
      step++;
      providerTools.push((options.tools ?? []).map(t => t.name));
      const chunks =
        step === 1
          ? [
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'tool-call', toolCallId: 'call_1', toolName: 'a', input: '{}' },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]
          : [
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'done' },
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

const tool = (id: string) =>
  createTool({ id, description: `tool ${id}`, inputSchema: z.object({}), execute: async () => id });

const toolNames = (call: any) => call.attributes.tools.map((t: any) => t.name);

describe('MODEL_GENERATION span offered tools (#25302)', () => {
  it('reflects per-step activeTools narrowing from processInputStep', async () => {
    updateGenerationCalls.length = 0;
    const providerTools: string[][] = [];
    const spy = await mockTracedSpans();
    try {
      const agent = new Agent({
        id: 'narrow-agent',
        name: 'Narrow Agent',
        instructions: 'test',
        model: createModel(providerTools),
        tools: { a: tool('a'), b: tool('b'), hidden: tool('hidden') },
        inputProcessors: [{ id: 'narrow', processInputStep: async () => ({ activeTools: ['a', 'b'] }) }],
      });

      const res = await agent.stream('go');
      await res.consumeStream();

      expect(providerTools).toEqual([
        ['a', 'b'],
        ['a', 'b'],
      ]);
      const toolUpdates = updateGenerationCalls.filter(c => c.attributes?.tools);
      expect(toolUpdates).toHaveLength(2);
      expect(toolNames(toolUpdates.at(-1))).toEqual(['a', 'b']);
      expect(toolUpdates.at(-1).attributes.tools[0]).toMatchObject({
        type: 'function',
        name: 'a',
        description: 'tool a',
        parameters: expect.objectContaining({ type: 'object' }),
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('keeps tools from earlier steps when a later step offers a different set', async () => {
    updateGenerationCalls.length = 0;
    const providerTools: string[][] = [];
    const spy = await mockTracedSpans();
    try {
      const agent = new Agent({
        id: 'switch-agent',
        name: 'Switch Agent',
        instructions: 'test',
        model: createModel(providerTools),
        tools: { a: tool('a'), b: tool('b'), hidden: tool('hidden') },
        inputProcessors: [
          {
            id: 'switch',
            processInputStep: async ({ steps }) => ({
              activeTools: steps.length === 0 ? ['a', 'b'] : ['hidden'],
            }),
          },
        ],
      });

      const res = await agent.stream('go');
      await res.consumeStream();

      expect(providerTools).toEqual([['a', 'b'], ['hidden']]);
      const toolUpdates = updateGenerationCalls.filter(c => c.attributes?.tools);
      expect(toolNames(toolUpdates[0])).toEqual(['a', 'b']);
      expect(toolNames(toolUpdates.at(-1))).toEqual(['a', 'b', 'hidden']);
    } finally {
      spy.mockRestore();
    }
  });

  it('does not set tools when no tools are offered', async () => {
    updateGenerationCalls.length = 0;
    const spy = await mockTracedSpans();
    try {
      const agent = new Agent({
        id: 'no-tools-agent',
        name: 'No Tools Agent',
        instructions: 'test',
        model: new MockLanguageModelV2({
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'hi' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage },
            ] as any),
          }),
        }),
      });

      const res = await agent.stream('hi');
      await res.consumeStream();

      expect(updateGenerationCalls.filter(c => c.attributes?.tools)).toHaveLength(0);
    } finally {
      spy.mockRestore();
    }
  });
});
