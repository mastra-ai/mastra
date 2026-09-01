import { DurableAgentDefaults } from '@mastra/core/agent/durable';
import { Inngest } from 'inngest';
import { describe, expect, it } from 'vitest';

import { createInngestDurableAgenticWorkflow } from './create-inngest-agentic-workflow';

/**
 * Regression coverage for #19317: the Inngest durable engine must honor
 * `toolCallConcurrency` instead of always running tool calls sequentially.
 *
 * The tool-call foreach carries a concurrency *resolver* that derives the
 * effective concurrency at execution time from the serialized iteration state
 * (options + toolsMetadata). This keeps resolution safe across Inngest step
 * memoization/replay and across runs sharing the same workflow instance —
 * unlike a shared mutable options object.
 */

function findForeachEntry(steps: any[]): any {
  for (const entry of steps ?? []) {
    if (entry.type === 'foreach') return entry;
    // Loop/foreach entries wrap their body in a `SingleStepEntry`, so a nested
    // workflow lives one level deeper (`entry.step.step`); plain `type: 'step'`
    // entries still hold the workflow directly on `entry.step`.
    const inner = entry.step?.executionGraph ? entry.step : entry.step?.step;
    if (inner?.executionGraph) {
      const nested = findForeachEntry(inner.executionGraph.steps);
      if (nested) return nested;
    }
    if (entry.steps) {
      const nested = findForeachEntry(entry.steps);
      if (nested) return nested;
    }
  }
  return undefined;
}

function findMappingEntry(steps: any[], id: string): any {
  for (const entry of steps ?? []) {
    if (entry.type === 'mapping' && entry.id === id) return entry;
    const inner = entry.step?.executionGraph ? entry.step : entry.step?.step;
    if (inner?.executionGraph) {
      const nested = findMappingEntry(inner.executionGraph.steps, id);
      if (nested) return nested;
    }
    if (entry.steps) {
      const nested = findMappingEntry(entry.steps, id);
      if (nested) return nested;
    }
  }
  return undefined;
}

describe('createInngestDurableAgenticWorkflow tool-call concurrency', () => {
  const inngest = new Inngest({ id: 'inngest-agentic-workflow-concurrency-tests' });
  const workflow = createInngestDurableAgenticWorkflow({ inngest });
  const foreachEntry = findForeachEntry((workflow as any).executionGraph.steps);

  const resolveWith = (state: unknown): number => {
    const resolver = foreachEntry.opts.concurrency;
    expect(typeof resolver).toBe('function');
    return resolver({ inputData: [], getInitData: () => state });
  };

  it('uses a concurrency resolver on the tool-call foreach (not a static value)', () => {
    expect(foreachEntry).toBeDefined();
    expect(typeof foreachEntry.opts.concurrency).toBe('function');
  });

  it('resolves the configured toolCallConcurrency from the iteration state', () => {
    expect(
      resolveWith({
        options: { toolCallConcurrency: 5 },
        toolsMetadata: [{ id: 'plain', name: 'plain', inputSchema: { type: 'object' } }],
      }),
    ).toBe(5);
  });

  it('defaults to the standard tool-call concurrency when unset', () => {
    expect(resolveWith({ options: {}, toolsMetadata: [] })).toBe(DurableAgentDefaults.TOOL_CALL_CONCURRENCY);
    // Missing init data (e.g. unexpected replay shape) must not crash — it
    // falls back to defaults.
    expect(resolveWith(undefined)).toBe(DurableAgentDefaults.TOOL_CALL_CONCURRENCY);
  });

  it('forces sequential execution when requireToolApproval is set globally', () => {
    expect(
      resolveWith({
        options: { requireToolApproval: true, toolCallConcurrency: 10 },
        toolsMetadata: [],
      }),
    ).toBe(1);
  });

  it('forces sequential execution when a tool requires approval', () => {
    expect(
      resolveWith({
        options: { toolCallConcurrency: 10 },
        toolsMetadata: [
          { id: 'plain', name: 'plain', inputSchema: { type: 'object' } },
          { id: 'gated', name: 'gated', inputSchema: { type: 'object' }, requireApproval: true },
        ],
      }),
    ).toBe(1);
  });

  it('forces sequential execution when a tool can suspend', () => {
    expect(
      resolveWith({
        options: { toolCallConcurrency: 10 },
        toolsMetadata: [
          { id: 'suspending', name: 'suspending', inputSchema: { type: 'object' }, hasSuspendSchema: true },
        ],
      }),
    ).toBe(1);
  });
});

describe('createInngestDurableAgenticWorkflow iteration state', () => {
  const inngest = new Inngest({ id: 'inngest-agentic-workflow-iteration-state-tests' });
  const workflow = createInngestDurableAgenticWorkflow({ inngest });
  const updateIterationState = findMappingEntry((workflow as any).executionGraph.steps, 'update-iteration-state');

  it('keeps large tool results in message history without duplicating them in step records', async () => {
    const largeToolResult = { value: 'x'.repeat(512 * 1024) };
    const update = await updateIterationState.mapConfig({
      inputData: {
        messageListState: { messages: [{ content: largeToolResult }] },
        messageId: 'message-1',
        stepResult: { reason: 'tool-calls', isContinued: true },
        toolResults: [largeToolResult],
        output: {
          text: '',
          toolCalls: [{ toolCallId: 'call-1', toolName: 'large-tool', args: {} }],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          steps: [],
        },
        state: {},
      },
      getInitData: () => ({
        runId: 'run-1',
        agentId: 'agent-1',
        agentName: 'Agent',
        iterationCount: 0,
        accumulatedSteps: [],
        accumulatedUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        stepIndex: 0,
      }),
    });

    expect(update.accumulatedSteps[0]).not.toHaveProperty('toolResults');
    expect(update.messageListState).toEqual({ messages: [{ content: largeToolResult }] });
    expect(JSON.stringify(update)).not.toContain('"toolResults"');
  });
});
