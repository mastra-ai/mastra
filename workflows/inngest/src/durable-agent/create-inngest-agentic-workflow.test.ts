import { DurableAgentDefaults } from '@mastra/core/agent/durable';

import { MessageList } from '@mastra/core/agent/message-list';
import { Mastra } from '@mastra/core/mastra';
import type { AnyExportedSpan, ObservabilityExporter, TracingEvent } from '@mastra/core/observability';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { MockStore } from '@mastra/core/storage';
import { PUBSUB_SYMBOL } from '@mastra/core/workflows/_constants';
import { Observability } from '@mastra/observability';
import { Inngest } from 'inngest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InngestExecutionEngine } from '../execution-engine';

import { createInngestDurableAgenticWorkflow, InngestDurableStepIds } from './create-inngest-agentic-workflow';

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe('createInngestDurableAgenticWorkflow step-finish emission', () => {
  const conditionFor = (maxSteps: number) => {
    const workflow = createInngestDurableAgenticWorkflow({
      inngest: new Inngest({ id: `inngest-step-finish-${maxSteps}` }),
      maxSteps,
    });
    const loop = findEntry((workflow as any).executionGraph.steps, entry => entry.type === 'loop');
    expect(loop).toBeDefined();
    return loop.condition;
  };

  const runCondition = async (
    condition: any,
    state: any,
    stepRun: (_id: string, fn: () => Promise<boolean>) => Promise<boolean> = async (_id, fn) => fn(),
  ) => {
    const published: any[] = [];
    const pubsub = { publish: vi.fn(async (_topic: string, event: any) => void published.push(event)) };
    const result = await condition({
      inputData: state,
      engine: { step: { run: stepRun } },
      [PUBSUB_SYMBOL]: pubsub,
    });
    return { result, chunks: published.map(event => event.data) };
  };

  it('emits a terminating step-finish after maxSteps resolves continuation', async () => {
    const deferredStepFinishChunk = {
      type: 'step-finish',
      runId: 'run-max-steps',
      payload: { stepResult: { reason: 'tool-calls', isContinued: true } },
    };
    const state = {
      runId: 'run-max-steps',
      iterationCount: 1,
      options: {},
      accumulatedSteps: [
        {
          text: '',
          toolCalls: [{ toolCallId: 'call-1', toolName: 'step', args: {} }],
          toolResults: [{ toolCallId: 'call-1', toolName: 'step', result: { done: true } }],
        },
      ],
      lastStepResult: { reason: 'tool-calls', isContinued: true, warnings: [] },
      deferredStepFinishChunk,
    };
    const { result, chunks } = await runCondition(conditionFor(1), state);

    expect(result).toBe(false);
    expect(state.deferredStepFinishChunk).toBeUndefined();
    expect(chunks).toEqual([
      {
        ...deferredStepFinishChunk,
        payload: {
          stepResult: { reason: 'tool-calls', isContinued: false },
          _durableStepContent: [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'step', args: {} },
            { type: 'tool-result', toolCallId: 'call-1', toolName: 'step', result: { done: true } },
          ],
        },
      },
    ]);
  });

  it('emits a continuing step-finish when the loop continues', async () => {
    const deferredStepFinishChunk = {
      type: 'step-finish',
      runId: 'run-continue',
      payload: { stepResult: { reason: 'tool-calls', isContinued: true } },
    };
    const { result, chunks } = await runCondition(conditionFor(3), {
      runId: 'run-continue',
      iterationCount: 1,
      options: {},
      accumulatedSteps: [{ text: '', toolCalls: [], toolResults: [] }],
      lastStepResult: { reason: 'tool-calls', isContinued: true, warnings: [] },
      deferredStepFinishChunk,
    });

    expect(result).toBe(true);
    expect(chunks[0]).toMatchObject({
      type: 'step-finish',
      payload: { stepResult: { reason: 'tool-calls', isContinued: true } },
    });
  });

  it('emits the completed step-finish before a stopWhen decision error propagates', async () => {
    const condition = conditionFor(3);
    const published: any[] = [];
    const policyError = new Error('stopWhen failed');

    await expect(
      condition({
        inputData: {
          runId: 'run-stop-when-error',
          iterationCount: 1,
          options: {},
          accumulatedSteps: [{ text: '', toolCalls: [], toolResults: [] }],
          lastStepResult: { reason: 'tool-calls', isContinued: true, warnings: [] },
          deferredStepFinishChunk: {
            type: 'step-finish',
            runId: 'run-stop-when-error',
            payload: { stepResult: { reason: 'tool-calls', isContinued: true } },
          },
        },
        engine: {
          step: {
            run: vi.fn(async (id: string, fn: () => Promise<boolean>) => {
              if (id.startsWith('stop-when-')) throw policyError;
              return fn();
            }),
          },
        },
        [PUBSUB_SYMBOL]: { publish: vi.fn(async (_topic: string, event: any) => void published.push(event)) },
      }),
    ).rejects.toBe(policyError);

    expect(published.map(event => event.data)).toMatchObject([
      {
        type: 'step-finish',
        payload: { stepResult: { reason: 'tool-calls', isContinued: true } },
      },
    ]);
  });
});

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

/**
 * `map-final-output` calls `runDurableFinishSideEffects` directly (no step tooling — the
 * mapping already runs inside the engine's durable boundary). These tests only care about
 * how spans are ended, so they pass an empty serialized MessageList; with no registry
 * entry the helper's side-effect blocks (processors, persistence, title) are no-ops.
 */
const emptyMessageListState = () => new MessageList().serialize();

describe('createInngestDurableAgenticWorkflow final span ends', () => {
  it('ends the model span with usage on attributes and the agent span with text only', async () => {
    const inngest = new Inngest({ id: 'inngest-agentic-workflow-final-span-tests' });
    const workflow = createInngestDurableAgenticWorkflow({ inngest });
    const entry = findEntry(
      (workflow as any).executionGraph.steps,
      entry => entry.type === 'mapping' && entry.id === 'map-final-output',
    );
    expect(entry).toBeDefined();

    const ended: AnyExportedSpan[] = [];
    const observability = new Observability({
      configs: {
        default: {
          serviceName: 'inngest-final-span-test',
          exporters: [
            {
              name: 'capture',
              async exportTracingEvent(event: TracingEvent) {
                if (event.type === TracingEventType.SPAN_ENDED) ended.push(event.exportedSpan);
              },
              async shutdown() {},
            } satisfies ObservabilityExporter,
          ],
        },
      },
    });
    const instance = observability.getSelectedInstance({})!;
    expect(instance).toBeDefined();

    // Real spans, exported the way InngestAgent.stream() hands them to the workflow.
    const agentSpan = instance.startSpan({ type: SpanType.AGENT_RUN, name: "agent run: 'a'" });
    const modelSpan = agentSpan.createChildSpan({ type: SpanType.MODEL_GENERATION, name: "llm: 'm'" });
    const usage = { inputTokens: 3, outputTokens: 5, totalTokens: 8 };
    const accumulatedSteps = [{ text: 'final answer' }];

    await entry.mapConfig({
      inputData: {
        runId: 'run-1',
        accumulatedSteps,
        accumulatedUsage: usage,
        lastStepResult: { reason: 'stop', isContinued: false, warnings: [] },
        modelSpanData: modelSpan.exportSpan(),
        agentSpanData: agentSpan.exportSpan(),
        messageListState: emptyMessageListState(),
        state: {},
      },
      getInitData: () => ({ runId: 'run-1', agentId: 'agent-1' }),
      mastra: { observability, getLogger: () => undefined },
    });

    const endedModel = ended.find(span => span.type === SpanType.MODEL_GENERATION);
    const endedAgent = ended.find(span => span.type === SpanType.AGENT_RUN);
    expect(endedModel).toBeDefined();
    expect(endedAgent).toBeDefined();

    // Usage belongs on the attributes, normalized to UsageStats the way every other
    // model span records it, rather than raw in the output.
    expect(endedModel!.output).toEqual({ text: 'final answer' });
    expect(endedModel!.output).not.toHaveProperty('toolCalls');
    expect(endedModel!.attributes).toMatchObject({
      finishReason: 'stop',
      usage: { inputTokens: 3, outputTokens: 5, inputDetails: { text: 3 }, outputDetails: { text: 5 } },
    });
    expect(endedModel!.output).not.toHaveProperty('usage');

    // The agent span records the text only; usage and steps stay on the workflow result.
    expect(endedAgent!.output).toEqual({ text: 'final answer' });
    expect(endedAgent!.output).not.toHaveProperty('usage');
    expect(endedAgent!.output).not.toHaveProperty('steps');
  });

  it('records tool calls from every step on the model span output (#25807)', async () => {
    const inngest = new Inngest({ id: 'inngest-agentic-workflow-final-span-tool-calls-tests' });
    const workflow = createInngestDurableAgenticWorkflow({ inngest });
    const entry = findEntry(
      (workflow as any).executionGraph.steps,
      entry => entry.type === 'mapping' && entry.id === 'map-final-output',
    );

    const ended: AnyExportedSpan[] = [];
    const observability = new Observability({
      configs: {
        default: {
          serviceName: 'inngest-final-span-tool-calls-test',
          exporters: [
            {
              name: 'capture',
              async exportTracingEvent(event: TracingEvent) {
                if (event.type === TracingEventType.SPAN_ENDED) ended.push(event.exportedSpan);
              },
              async shutdown() {},
            } satisfies ObservabilityExporter,
          ],
        },
      },
    });
    const instance = observability.getSelectedInstance({})!;
    const agentSpan = instance.startSpan({ type: SpanType.AGENT_RUN, name: "agent run: 'a'" });
    const modelSpan = agentSpan.createChildSpan({ type: SpanType.MODEL_GENERATION, name: "llm: 'm'" });

    await entry.mapConfig({
      inputData: {
        runId: 'run-1',
        accumulatedSteps: [
          { text: '', toolCalls: [{ toolCallId: 'c1', toolName: 'echo', args: { text: 'a' }, stepSpanData: {} }] },
          { text: '', toolCalls: [{ toolCallId: 'c2', toolName: 'echo', args: { text: 'b' } }] },
          { text: 'final answer' },
        ],
        accumulatedUsage: { inputTokens: 3, outputTokens: 5, totalTokens: 8 },
        lastStepResult: { reason: 'stop', isContinued: false, warnings: [] },
        modelSpanData: modelSpan.exportSpan(),
        agentSpanData: agentSpan.exportSpan(),
        messageListState: emptyMessageListState(),
        state: {},
      },
      getInitData: () => ({ runId: 'run-1', agentId: 'agent-1' }),
      mastra: { observability, getLogger: () => undefined },
    });

    const endedModel = ended.find(span => span.type === SpanType.MODEL_GENERATION);
    expect(endedModel!.output).toEqual({
      text: 'final answer',
      toolCalls: [
        { toolCallId: 'c1', toolName: 'echo', args: { text: 'a' } },
        { toolCallId: 'c2', toolName: 'echo', args: { text: 'b' } },
      ],
    });
  });

  it('keeps usage and steps on the workflow result', async () => {
    const inngest = new Inngest({ id: 'inngest-agentic-workflow-final-output-tests' });
    const workflow = createInngestDurableAgenticWorkflow({ inngest });
    const entry = findEntry(
      (workflow as any).executionGraph.steps,
      entry => entry.type === 'mapping' && entry.id === 'map-final-output',
    );

    const usage = { inputTokens: 3, outputTokens: 5, totalTokens: 8 };
    const accumulatedSteps = [{ text: 'final answer' }];

    const result = await entry.mapConfig({
      inputData: {
        runId: 'run-1',
        accumulatedSteps,
        accumulatedUsage: usage,
        lastStepResult: { reason: 'stop', isContinued: false, warnings: [] },
        messageListState: emptyMessageListState(),
        state: {},
      },
      getInitData: () => ({ runId: 'run-1', agentId: 'agent-1' }),
      mastra: { getLogger: () => undefined },
    });

    expect(result.output).toEqual({ text: 'final answer', usage, steps: accumulatedSteps });
  });
});

describe('createInngestDurableAgenticWorkflow bookkeeping (#24731)', () => {
  it('configures both workflows to skip no-op durable bookkeeping', () => {
    const inngest = new Inngest({ id: 'inngest-agentic-workflow-events-tests' });
    const workflow = createInngestDurableAgenticWorkflow({ inngest }) as any;
    const iterationWorkflow = workflow.steps[InngestDurableStepIds.AGENTIC_EXECUTION];

    expect(workflow.options.emitStepEvents).toBe(false);
    expect(iterationWorkflow.options.emitStepEvents).toBe(false);
    expect(workflow.options.evaluatePersistencePredicateBeforeDurableOperation).toBe(true);
    expect(iterationWorkflow.options.evaluatePersistencePredicateBeforeDurableOperation).toBe(true);
  });
});

describe('createInngestDurableAgenticWorkflow snapshot policy (#24796)', () => {
  it('persists suspended and terminal snapshots so finished runs are not resumable', () => {
    const inngest = new Inngest({ id: 'inngest-agentic-workflow-snapshot-tests' });
    const workflow = createInngestDurableAgenticWorkflow({ inngest }) as any;
    const iterationWorkflow = workflow.steps[InngestDurableStepIds.AGENTIC_EXECUTION];

    for (const wf of [workflow, iterationWorkflow]) {
      const persist = (workflowStatus: string) => wf.options.shouldPersistSnapshot({ workflowStatus, stepResults: {} });
      for (const status of ['suspended', 'success', 'failed', 'canceled', 'bailed', 'tripwire']) {
        expect(persist(status)).toBe(true);
      }
      for (const status of ['running', 'waiting', 'pending']) {
        expect(persist(status)).toBe(false);
      }
    }
  });

  it.each(['suspended', 'success'] as const)(
    'prunes agent instructions from the persisted %s snapshot (#25977)',
    async status => {
      const inngest = new Inngest({ id: 'inngest-agentic-workflow-prune-tests' });
      let handler: any;
      vi.spyOn(inngest, 'createFunction').mockImplementation(((config: any, fn: any) => {
        handler = fn;
        return { id: config.id } as any;
      }) as any);
      const workflow = createInngestDurableAgenticWorkflow({ inngest }) as any;
      const mastra = new Mastra({ logger: false, storage: new MockStore(), workflows: { [workflow.id]: workflow } });
      workflow.__registerMastra(mastra);
      workflow.getFunction();

      const instructions = 'SECRET SYSTEM PROMPT';
      const state = () => ({ agentSpanData: { attributes: { instructions } } });
      const execute = vi.spyOn(InngestExecutionEngine.prototype, 'execute').mockResolvedValue({
        status,
        result: status === 'success' ? {} : undefined,
        steps: {
          input: state(),
          'init-iteration-state': { status: 'success', payload: state(), output: state() },
          [InngestDurableStepIds.AGENTIC_EXECUTION]: {
            status,
            payload: state(),
            ...(status === 'success' ? { output: state() } : { suspendPayload: {} }),
          },
          ...(status === 'success' ? { 'map-final-output': { status: 'success', payload: state(), output: {} } } : {}),
        },
      } as any);

      const runId = `prune-${status}`;
      await handler({
        event: { data: { inputData: state(), runId } },
        step: { run: vi.fn(async (_id: string, cb: () => Promise<unknown>) => cb()) },
        attempt: 0,
      });
      expect(execute).toHaveBeenCalled();

      const store = await mastra.getStorage()!.getStore('workflows');
      const snapshot = (await store!.loadWorkflowSnapshot({ workflowName: workflow.id, runId }))!;
      expect(snapshot.status).toBe(status);
      const { input, ...stepResults } = snapshot.context as any;
      expect(input.agentSpanData.attributes.instructions).toBe(instructions);
      expect(stepResults[InngestDurableStepIds.AGENTIC_EXECUTION]).toBeDefined();
      expect(JSON.stringify(stepResults)).not.toContain(instructions);
    },
  );
});

describe('Inngest per-step processor history (#25193)', () => {
  it('forwards accumulated steps to the LLM execution step on later iterations', async () => {
    const inngest = new Inngest({ id: 'inngest-processor-history-tests' });
    const workflow = createInngestDurableAgenticWorkflow({ inngest });
    const entry = findEntry(
      (workflow as any).executionGraph.steps,
      candidate => candidate.type === 'mapping' && candidate.id === 'map-to-llm-input',
    );
    expect(entry).toBeDefined();

    const priorStep = { text: 'read_context completed', toolCalls: [{ toolName: 'read_context' }] };
    const inputData = {
      runId: 'run-1',
      agentId: 'agent-1',
      messageId: 'msg-1',
      messageListState: emptyMessageListState(),
      toolsMetadata: [],
      modelConfig: {},
      options: {},
      state: {},
      stepIndex: 1,
      accumulatedSteps: [priorStep],
    };
    const mapped = await entry.mapConfig({ inputData });
    expect(mapped.stepIndex).toBe(1);
    expect(mapped.accumulatedSteps).toEqual([priorStep]);
  });
});
