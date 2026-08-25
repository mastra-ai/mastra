import { DurableAgentDefaults } from '@mastra/core/agent/durable';
import { Inngest } from 'inngest';
import { describe, expect, it, vi } from 'vitest';

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

function findEntry(steps: any[], predicate: (entry: any) => boolean): any {
  for (const entry of steps ?? []) {
    if (predicate(entry)) return entry;
    const inner = entry.step?.executionGraph ? entry.step : entry.step?.step;
    if (inner?.executionGraph) {
      const nested = findEntry(inner.executionGraph.steps, predicate);
      if (nested) return nested;
    }
    if (entry.steps) {
      const nested = findEntry(entry.steps, predicate);
      if (nested) return nested;
    }
  }
  return undefined;
}

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

/**
 * Regression coverage for #19842: durable tool execution on the Inngest engine
 * must run with a tracing context.
 *
 * 1. `extract-tool-calls` forwards the LLM step's exported MODEL_STEP span
 *    (`stepSpanData`) onto every tool-call input, so `createDurableToolCallStep`
 *    can rebuild it into the tool's `tracingContext` (live TOOL_CALL span +
 *    execution-time children such as workspace_action spans).
 * 2. `collect-tool-results` no longer creates retroactive TOOL_CALL spans (they
 *    would duplicate the live ones) — it only bundles results for the shared
 *    llmMappingStep, which ends the step span and emits tool-result chunks.
 */
describe('createInngestDurableAgenticWorkflow tool-call tracing (#19842)', () => {
  const inngest = new Inngest({ id: 'inngest-agentic-workflow-tracing-tests' });
  const workflow = createInngestDurableAgenticWorkflow({ inngest });
  const steps = (workflow as any).executionGraph.steps;

  const findMapping = (id: string) => findEntry(steps, entry => entry.type === 'mapping' && entry.id === id);

  it('extract-tool-calls forwards stepSpanData onto every tool-call input', async () => {
    const entry = findMapping('extract-tool-calls');
    expect(entry).toBeDefined();
    expect(typeof entry.mapConfig).toBe('function');

    const stepSpanData = { spanId: 'step-span-1', traceId: 'trace-1' };
    const result = await entry.mapConfig({
      inputData: {
        toolCalls: [
          { toolCallId: 'call-1', toolName: 'writeFile', args: { path: 'a.txt' } },
          { toolCallId: 'call-2', toolName: 'readFile', args: { path: 'b.txt' } },
        ],
        stepSpanData,
      },
    });

    expect(result).toHaveLength(2);
    for (const toolCall of result) {
      expect(toolCall.stepSpanData).toEqual(stepSpanData);
    }
    expect(result[0]).toMatchObject({ toolCallId: 'call-1', toolName: 'writeFile' });
  });

  it('collect-tool-results does not create retroactive spans and bundles results for mapping', async () => {
    const entry = findMapping('collect-tool-results');
    expect(entry).toBeDefined();
    expect(typeof entry.mapConfig).toBe('function');

    const rebuildSpan = vi.fn();
    const getSelectedInstance = vi.fn(() => ({ rebuildSpan }));
    const llmOutput = {
      toolCalls: [{ toolCallId: 'call-1', toolName: 'writeFile', args: {} }],
      stepSpanData: { spanId: 'step-span-1' },
      state: { s: 1 },
    };
    const toolResults = [{ toolCallId: 'call-1', toolName: 'writeFile', result: 'ok' }];

    const result = await entry.mapConfig({
      inputData: toolResults,
      getStepResult: () => llmOutput,
      getInitData: () => ({
        runId: 'run-1',
        agentId: 'agent-1',
        messageId: 'msg-1',
        agentSpanData: { spanId: 'agent-span-1' },
        state: { s: 0 },
      }),
      mastra: { observability: { getSelectedInstance } },
    });

    // No retroactive span creation — the live TOOL_CALL span is created by the
    // tool-call step, and llmMappingStep owns step-span end + tool-result chunks.
    expect(getSelectedInstance).not.toHaveBeenCalled();
    expect(rebuildSpan).not.toHaveBeenCalled();

    expect(result).toEqual({
      llmOutput,
      toolResults,
      runId: 'run-1',
      agentId: 'agent-1',
      messageId: 'msg-1',
      state: { s: 1 },
    });
  });
});
