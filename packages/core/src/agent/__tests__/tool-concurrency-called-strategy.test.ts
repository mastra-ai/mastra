import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { delay } from '../../utils';
import { Agent } from '../agent';

type ConcurrencyTracker = { running: number; peak: number };

function twoParallelToolCalls(toolNames: string[]) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id', modelId: 'm', timestamp: new Date() },
        ...toolNames.map((toolName, i) => ({
          type: 'tool-call' as const,
          toolCallType: 'function' as const,
          toolCallId: `call-${i}`,
          toolName,
          input: JSON.stringify({ data: `d${i}` }),
        })),
        { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ] as any),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

function trackedTool(id: string, tracker: ConcurrencyTracker, options: { suspendable?: boolean } = {}) {
  return createTool({
    id,
    description: id,
    inputSchema: z.object({ data: z.string() }),
    ...(options.suspendable
      ? { suspendSchema: z.object({ reason: z.string() }), resumeSchema: z.object({ approved: z.boolean() }) }
      : {}),
    execute: async () => {
      tracker.running++;
      tracker.peak = Math.max(tracker.peak, tracker.running);
      await delay(50);
      tracker.running--;
      return { ok: true };
    },
  });
}

function approvalTool() {
  return createTool({
    id: 'request_approval',
    description: 'approve',
    inputSchema: z.object({ data: z.string() }),
    requireApproval: true,
    execute: async () => ({ ok: true }),
  });
}

async function drain(stream: { fullStream: AsyncIterable<unknown> }) {
  for await (const _ of stream.fullStream) {
    /* drain */
  }
}

describe("toolCallConcurrency strategy: 'called'", () => {
  it('serializes safe parallel calls by default when an approval tool is merely registered', async () => {
    const tracker: ConcurrencyTracker = { running: 0, peak: 0 };
    const agent = new Agent({
      id: 'repro-available',
      name: 'repro-available',
      instructions: 'x',
      model: twoParallelToolCalls(['tool-1', 'tool-2']),
      tools: {
        'tool-1': trackedTool('tool-1', tracker),
        'tool-2': trackedTool('tool-2', tracker),
        request_approval: approvalTool(),
      },
    });

    const stream = await agent.stream('go', { maxSteps: 1, toolCallConcurrency: 10 });
    await drain(stream);

    // Default 'available' strategy: registered approval tool forces sequential.
    expect(tracker.peak).toBe(1);
  });

  it("parallelizes a pure-safe batch under strategy 'called' even with an approval tool registered", async () => {
    const tracker: ConcurrencyTracker = { running: 0, peak: 0 };
    const agent = new Agent({
      id: 'repro-called',
      name: 'repro-called',
      instructions: 'x',
      model: twoParallelToolCalls(['tool-1', 'tool-2']),
      tools: {
        'tool-1': trackedTool('tool-1', tracker),
        'tool-2': trackedTool('tool-2', tracker),
        request_approval: approvalTool(),
      },
    });

    const stream = await agent.stream('go', {
      maxSteps: 1,
      toolCallConcurrency: { limit: 10, strategy: 'called' },
    });
    await drain(stream);

    // The batch never calls request_approval, so it cannot suspend this step.
    expect(tracker.peak).toBe(2);
  });

  it("still serializes a batch that actually calls a suspend tool under strategy 'called'", async () => {
    const tracker: ConcurrencyTracker = { running: 0, peak: 0 };
    const agent = new Agent({
      id: 'repro-called-suspend',
      name: 'repro-called-suspend',
      instructions: 'x',
      model: twoParallelToolCalls(['tool-1', 'suspending-tool']),
      tools: {
        'tool-1': trackedTool('tool-1', tracker),
        'suspending-tool': trackedTool('suspending-tool', tracker, { suspendable: true }),
      },
    });

    const stream = await agent.stream('go', {
      maxSteps: 1,
      toolCallConcurrency: { limit: 10, strategy: 'called' },
    });
    await drain(stream);

    // A batch that calls a statically-suspendable tool still runs sequentially.
    expect(tracker.peak).toBe(1);
  });
});
