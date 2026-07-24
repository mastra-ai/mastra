import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { delay } from '../../utils';
import { Agent } from '../agent';

type ConcurrencyTracker = {
  running: number;
  peak: number;
  completed: string[];
};

function createMockModel(toolNames = ['tool-1', 'tool-2']) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'test-id', modelId: 'test-model', timestamp: new Date() },
        ...toolNames.map((toolName, index) => ({
          type: 'tool-call' as const,
          toolCallType: 'function' as const,
          toolCallId: `call-${index + 1}`,
          toolName,
          input: JSON.stringify({ data: `test${index + 1}` }),
        })),
        {
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ] as any),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

function createTrackedTool(id: string, tracker: ConcurrencyTracker, options: { suspendable?: boolean } = {}) {
  return createTool({
    id,
    description: `Tracked ${id}`,
    inputSchema: z.object({ data: z.string() }),
    ...(options.suspendable
      ? {
          suspendSchema: z.object({ reason: z.string() }),
          resumeSchema: z.object({ approved: z.boolean() }),
        }
      : {}),
    execute: async () => {
      tracker.running++;
      tracker.peak = Math.max(tracker.peak, tracker.running);
      await delay(50);
      tracker.running--;
      tracker.completed.push(id);
      return { result: `${id} done` };
    },
  });
}

function createApprovalTool() {
  return createTool({
    id: 'approval-tool',
    description: 'Approval tool',
    inputSchema: z.object({ data: z.string() }),
    requireApproval: true,
    execute: async () => ({ result: 'approval done' }),
  });
}

function createSuspendingTool() {
  return createTool({
    id: 'suspending-tool',
    description: 'Suspending tool',
    inputSchema: z.object({ data: z.string() }),
    suspendSchema: z.object({ reason: z.string() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async () => ({ result: 'suspending done' }),
  });
}

async function runAgent({
  tools,
  activeTools,
  prepareStep,
  toolCallConcurrency,
  requireToolApproval,
  toolNames,
}: {
  tools: Record<string, unknown>;
  activeTools?: string[];
  prepareStep?: (args: { tools?: Record<string, unknown> }) => unknown;
  toolCallConcurrency?: number | { limit?: number; strategy?: 'available' | 'called' };
  requireToolApproval?: boolean;
  toolNames?: string[];
}) {
  const agent = new Agent({
    id: `active-tools-concurrency-${crypto.randomUUID()}`,
    name: 'Active Tools Concurrency Agent',
    instructions: 'Use both tools.',
    model: createMockModel(toolNames ?? activeTools ?? Object.keys(tools)),
    tools,
  });

  const stream = await agent.stream('Use both tools', {
    maxSteps: 1,
    activeTools,
    prepareStep,
    toolCallConcurrency,
    requireToolApproval,
  });

  for await (const _chunk of stream.fullStream) {
    // Drain the stream so tool execution completes.
  }
}

describe('active tool concurrency', () => {
  it('runs active safe tools concurrently when an approval tool is registered but inactive', async () => {
    const tracker: ConcurrencyTracker = { running: 0, peak: 0, completed: [] };

    await runAgent({
      tools: {
        'tool-1': createTrackedTool('tool-1', tracker),
        'tool-2': createTrackedTool('tool-2', tracker),
        'approval-tool': createApprovalTool(),
      },
      activeTools: ['tool-1', 'tool-2'],
    });

    expect(tracker.peak).toBe(2);
    expect(tracker.completed).toEqual(expect.arrayContaining(['tool-1', 'tool-2']));
  });

  it('runs active safe tools concurrently when a suspending tool is registered but inactive', async () => {
    const tracker: ConcurrencyTracker = { running: 0, peak: 0, completed: [] };

    await runAgent({
      tools: {
        'tool-1': createTrackedTool('tool-1', tracker),
        'tool-2': createTrackedTool('tool-2', tracker),
        'suspending-tool': createSuspendingTool(),
      },
      activeTools: ['tool-1', 'tool-2'],
    });

    expect(tracker.peak).toBe(2);
    expect(tracker.completed).toEqual(expect.arrayContaining(['tool-1', 'tool-2']));
  });

  it('uses processor-replaced tools when resolving concurrency', async () => {
    const tracker: ConcurrencyTracker = { running: 0, peak: 0, completed: [] };
    const stepTools = {
      'tool-1': createTrackedTool('tool-1', tracker),
      'tool-2': createTrackedTool('tool-2', tracker),
    };

    await runAgent({
      tools: {
        'approval-tool': createApprovalTool(),
      },
      prepareStep: () => ({
        tools: stepTools,
        activeTools: undefined,
      }),
      toolNames: Object.keys(stepTools),
    });

    expect(tracker.peak).toBe(2);
    expect(tracker.completed).toEqual(expect.arrayContaining(['tool-1', 'tool-2']));
  });

  it('does not leak concurrency decisions across concurrent runs', async () => {
    const safeTracker: ConcurrencyTracker = { running: 0, peak: 0, completed: [] };
    const sequentialTracker: ConcurrencyTracker = { running: 0, peak: 0, completed: [] };

    await Promise.all([
      runAgent({
        tools: {
          'tool-1': createTrackedTool('tool-1', safeTracker),
          'tool-2': createTrackedTool('tool-2', safeTracker),
          'approval-tool': createApprovalTool(),
        },
        activeTools: ['tool-1', 'tool-2'],
      }),
      runAgent({
        tools: {
          'tool-1': createTrackedTool('tool-1', sequentialTracker),
          'suspending-tool': createTrackedTool('suspending-tool', sequentialTracker, { suspendable: true }),
        },
        toolNames: ['tool-1', 'suspending-tool'],
      }),
    ]);

    expect(safeTracker.peak).toBe(2);
    expect(sequentialTracker.peak).toBe(1);
  });

  describe("'called' strategy", () => {
    it('runs safe calls concurrently when an approval tool is available but not called this step', async () => {
      const tracker: ConcurrencyTracker = { running: 0, peak: 0, completed: [] };

      await runAgent({
        tools: {
          'tool-1': createTrackedTool('tool-1', tracker),
          'tool-2': createTrackedTool('tool-2', tracker),
          'approval-tool': createApprovalTool(),
        },
        // No activeTools: approval-tool is available (would force sequential under the
        // default 'available' strategy), but the batch only calls the safe tools.
        toolCallConcurrency: { strategy: 'called', limit: 8 },
        toolNames: ['tool-1', 'tool-2'],
      });

      expect(tracker.peak).toBe(2);
      expect(tracker.completed).toEqual(expect.arrayContaining(['tool-1', 'tool-2']));
    });

    it('serializes when the batch actually calls a suspending tool', async () => {
      const tracker: ConcurrencyTracker = { running: 0, peak: 0, completed: [] };

      await runAgent({
        tools: {
          'tool-1': createTrackedTool('tool-1', tracker),
          'suspending-tool': createTrackedTool('suspending-tool', tracker, { suspendable: true }),
        },
        toolCallConcurrency: { strategy: 'called', limit: 8 },
        toolNames: ['tool-1', 'suspending-tool'],
      });

      expect(tracker.peak).toBe(1);
    });
  });
});
