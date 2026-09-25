import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
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

function trackedTool(
  id: string,
  tracker: ConcurrencyTracker,
  options: { suspendable?: boolean; requireApproval?: () => Promise<boolean> } = {},
) {
  return createTool({
    id,
    description: id,
    inputSchema: z.object({ data: z.string() }),
    ...(options.suspendable
      ? { suspendSchema: z.object({ reason: z.string() }), resumeSchema: z.object({ approved: z.boolean() }) }
      : {}),
    ...(options.requireApproval ? { requireApproval: options.requireApproval } : {}),
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

  it("parallelizes calls whose function approval policy returns false under strategy 'called' (#24232)", async () => {
    const tracker: ConcurrencyTracker = { running: 0, peak: 0 };
    const tool1Policy = vi.fn(async () => false);
    const tool2Policy = vi.fn(async () => false);
    const agent = new Agent({
      id: 'repro-called-fn-policy',
      name: 'repro-called-fn-policy',
      instructions: 'x',
      model: twoParallelToolCalls(['tool-1', 'tool-2']),
      tools: {
        'tool-1': trackedTool('tool-1', tracker, { requireApproval: tool1Policy }),
        'tool-2': trackedTool('tool-2', tracker, { requireApproval: tool2Policy }),
      },
    });

    const stream = await agent.stream('go', {
      maxSteps: 1,
      toolCallConcurrency: { limit: 10, strategy: 'called' },
    });
    await drain(stream);

    expect(tracker.peak).toBe(2);
    expect(tool1Policy).toHaveBeenCalledOnce();
    expect(tool2Policy).toHaveBeenCalledOnce();
  });

  it("parallelizes calls when a run-wide function approval policy returns false under strategy 'called'", async () => {
    const tracker: ConcurrencyTracker = { running: 0, peak: 0 };
    const policy = vi.fn(() => false);
    const agent = new Agent({
      id: 'repro-called-global-fn',
      name: 'repro-called-global-fn',
      instructions: 'x',
      model: twoParallelToolCalls(['tool-1', 'tool-2']),
      tools: {
        'tool-1': trackedTool('tool-1', tracker),
        'tool-2': trackedTool('tool-2', tracker),
      },
    });

    const stream = await agent.stream('go', {
      maxSteps: 1,
      requireToolApproval: policy,
      toolCallConcurrency: { limit: 10, strategy: 'called' },
    });
    await drain(stream);

    expect(tracker.peak).toBe(2);
    expect(policy).toHaveBeenCalledTimes(2);
  });

  it('uses the scheduling verdict when a stateful approval policy changes on later calls', async () => {
    const tracker: ConcurrencyTracker = { running: 0, peak: 0 };
    const policy = vi.fn(() => policy.mock.calls.length > 2);
    const agent = new Agent({
      id: 'repro-called-stateful-policy',
      name: 'repro-called-stateful-policy',
      instructions: 'x',
      model: twoParallelToolCalls(['tool-1', 'tool-2']),
      tools: {
        'tool-1': trackedTool('tool-1', tracker),
        'tool-2': trackedTool('tool-2', tracker),
      },
    });

    const stream = await agent.stream('go', {
      maxSteps: 1,
      requireToolApproval: policy,
      toolCallConcurrency: { limit: 10, strategy: 'called' },
    });
    await drain(stream);

    expect(policy).toHaveBeenCalledTimes(2);
    expect(tracker.peak).toBe(2);
  });
});

describe("toolCallConcurrency default 'available' strategy with function approval policies (#24232)", () => {
  // Mirrors what MCPClient builds when `requireToolApproval` is a function:
  // a static `requireApproval: true` plus the real policy on `needsApprovalFn`.
  function mcpShapedTool(id: string, tracker: ConcurrencyTracker, policy: () => boolean) {
    const tool = createTool({
      id,
      description: id,
      inputSchema: z.object({ data: z.string() }),
      requireApproval: true,
      execute: async () => {
        tracker.running++;
        tracker.peak = Math.max(tracker.peak, tracker.running);
        await delay(50);
        tracker.running--;
        return { ok: true };
      },
    });
    (tool as { needsApprovalFn?: unknown }).needsApprovalFn = policy;
    return tool;
  }

  it('parallelizes MCP-style tools whose function policy returns false', async () => {
    const tracker: ConcurrencyTracker = { running: 0, peak: 0 };
    const policy = vi.fn(() => false);
    const agent = new Agent({
      id: 'available-mcp-fn',
      name: 'available-mcp-fn',
      instructions: 'x',
      model: twoParallelToolCalls(['tool-1', 'tool-2']),
      tools: {
        'tool-1': mcpShapedTool('tool-1', tracker, policy),
        'tool-2': mcpShapedTool('tool-2', tracker, policy),
      },
    });

    await drain(await agent.stream('go', { maxSteps: 1 }));

    expect(tracker.peak).toBe(2);
    expect(policy).toHaveBeenCalledTimes(2);
  });

  it('parallelizes calls when a run-wide function policy returns false', async () => {
    const tracker: ConcurrencyTracker = { running: 0, peak: 0 };
    const policy = vi.fn(() => false);
    const agent = new Agent({
      id: 'available-global-fn',
      name: 'available-global-fn',
      instructions: 'x',
      model: twoParallelToolCalls(['tool-1', 'tool-2']),
      tools: {
        'tool-1': trackedTool('tool-1', tracker),
        'tool-2': trackedTool('tool-2', tracker),
      },
    });

    await drain(await agent.stream('go', { maxSteps: 1, requireToolApproval: policy }));

    expect(tracker.peak).toBe(2);
    expect(policy).toHaveBeenCalledTimes(2);
  });
});

describe("toolCallConcurrency strategy 'called' on resume (#24581)", () => {
  // Delegation tools have no suspend schema, so a batch that calls only them runs in
  // parallel under 'called' even though a suspend tool is registered. At runtime each one
  // suspends (a child agent asking the user a question), and asks again after its first answer.
  function delegationTool(id: string, resumedWith: string[]) {
    return createTool({
      id,
      description: id,
      inputSchema: z.object({ data: z.string() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) {
          return await context?.agent?.suspend({ question: `${id}: first question` });
        }
        resumedWith.push(id);
        return await context?.agent?.suspend({ question: `${id}: follow-up question` });
      },
    });
  }

  it('continues every suspended sibling when they are resumed together without a toolCallId', async () => {
    const tracker: ConcurrencyTracker = { running: 0, peak: 0 };
    const resumedWith: string[] = [];
    const delegates = ['delegate-a', 'delegate-b', 'delegate-c'];
    const supervisor = new Agent({
      id: 'called-resume-siblings',
      name: 'called-resume-siblings',
      instructions: 'x',
      model: twoParallelToolCalls(delegates),
      defaultOptions: { maxSteps: 1, toolCallConcurrency: { limit: 10, strategy: 'called' } },
      tools: {
        ask_user: trackedTool('ask_user', tracker, { suspendable: true }),
        ...Object.fromEntries(delegates.map(id => [id, delegationTool(id, resumedWith)])),
      },
    });
    const mastra = new Mastra({
      agents: { supervisor },
      logger: false,
      storage: new InMemoryStore(),
    });
    const agent = mastra.getAgent('supervisor');

    const stream = await agent.stream('go');
    const suspended = new Set<string>();
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-suspended') {
        suspended.add((chunk.payload as { toolName: string }).toolName);
      }
    }
    expect([...suspended].sort()).toEqual(delegates);

    // No toolCallId: the answer is applied to every suspended foreach iteration.
    const resumed = await agent.resumeStream({ answer: 'yes' }, { runId: stream.runId });
    await drain(resumed);

    // Each child suspends again after its first answer. With the stale resume-time
    // concurrency of 1, the first re-suspension stopped the queue and only one child ran.
    expect(resumedWith.sort()).toEqual(delegates);
    expect(tracker.peak).toBe(0);
  }, 30000);
});
