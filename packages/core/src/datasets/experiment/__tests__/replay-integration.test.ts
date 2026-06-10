import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../agent';
import type { Mastra } from '../../../mastra';
import { Mastra as MastraClass } from '../../../mastra';
import { SpanType, EntityType } from '../../../observability';
import type { MastraCompositeStore, StorageDomains } from '../../../storage/base';
import { DatasetsInMemory } from '../../../storage/domains/datasets/inmemory';
import { ExperimentsInMemory } from '../../../storage/domains/experiments/inmemory';
import { InMemoryDB } from '../../../storage/domains/inmemory-db';
import { ObservabilityInMemory } from '../../../storage/domains/observability/inmemory';
import { createTool } from '../../../tools';
import { runExperiment } from '../index';
import type { ToolReplayReport } from '../replay';

/**
 * Integration tests for tool replay in dataset experiments (issue #17466).
 *
 * The first test documents the baseline behavior the issue reports: for
 * `targetType: 'agent'`, experiments execute the agent's tools LIVE — external
 * side effects fire on every run. The remaining tests exercise `toolReplay`.
 */

/** Model that issues two calls to the same tool across two steps, then answers. */
function createTwoToolCallModel() {
  let callCount = 0;
  const toolCallStep = (id: string, input: string) => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [] as never[],
    finishReason: 'tool-calls' as const,
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [
      {
        type: 'tool-call' as const,
        toolCallType: 'function' as const,
        toolCallId: `call-${id}`,
        toolName: 'lookup',
        input,
      },
    ],
  });

  return new MockLanguageModelV2({
    doGenerate: async () => {
      callCount++;
      if (callCount === 1) return toolCallStep('id-0', '{"key":"first"}');
      if (callCount === 2) return toolCallStep('id-1', '{"key":"second"}');
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text' as const, text: 'Done with lookups.' }],
      };
    },
  });
}

describe('tool replay integration', () => {
  let db: InMemoryDB;
  let datasetsStorage: DatasetsInMemory;
  let experimentsStorage: ExperimentsInMemory;
  let observabilityStorage: ObservabilityInMemory;
  let mockStorage: MastraCompositeStore;
  let liveExecute: ReturnType<typeof vi.fn>;
  let agent: Agent;
  let mastra: Mastra;

  beforeEach(() => {
    db = new InMemoryDB();
    datasetsStorage = new DatasetsInMemory({ db });
    experimentsStorage = new ExperimentsInMemory({ db });
    observabilityStorage = new ObservabilityInMemory({ db });

    mockStorage = {
      id: 'test-storage',
      stores: {
        datasets: datasetsStorage,
        experiments: experimentsStorage,
        observability: observabilityStorage,
      } as unknown as StorageDomains,
      getStore: vi.fn().mockImplementation(async (name: keyof StorageDomains) => {
        if (name === 'datasets') return datasetsStorage;
        if (name === 'experiments') return experimentsStorage;
        if (name === 'observability') return observabilityStorage;
        return undefined;
      }),
    } as unknown as MastraCompositeStore;

    // Live tool with an observable side effect (the issue's "real side effects" case)
    liveExecute = vi.fn().mockImplementation(async ({ key }: { key: string }) => ({ value: `live:${key}` }));
    const lookupTool = createTool({
      id: 'lookup',
      description: 'Look up a record in an external system',
      inputSchema: z.object({ key: z.string() }),
      execute: liveExecute,
    });

    agent = new Agent({
      id: 'replay-test-agent',
      name: 'Replay Test Agent',
      instructions: 'Use the lookup tool.',
      model: createTwoToolCallModel(),
      tools: { lookup: lookupTool },
    });

    // Real Mastra registers the agent (logger wiring etc.); runExperiment gets a
    // facade that resolves the real agent but uses in-memory storage.
    const realMastra = new MastraClass({ agents: { 'replay-test-agent': agent }, logger: false });

    mastra = {
      getStorage: vi.fn().mockReturnValue(mockStorage),
      getAgent: vi.fn().mockReturnValue(realMastra.getAgent('replay-test-agent')),
      getAgentById: vi.fn().mockReturnValue(realMastra.getAgent('replay-test-agent')),
      getScorerById: vi.fn(),
      getWorkflowById: vi.fn(),
      getWorkflow: vi.fn(),
      getLogger: vi.fn().mockReturnValue(undefined),
    } as unknown as Mastra;
  });

  /** Seed the observability store with a recorded trace of `lookup` tool calls. */
  async function seedRecordedTrace(traceId: string, calls: { input: unknown; output?: unknown; error?: unknown }[]) {
    const base = Date.parse('2026-01-01T00:00:00Z');
    await observabilityStorage.batchCreateSpans({
      records: [
        {
          traceId,
          spanId: `${traceId}-root`,
          name: "agent run: 'replay-test-agent'",
          spanType: SpanType.AGENT_RUN,
          isEvent: false,
          entityType: EntityType.AGENT,
          entityId: 'replay-test-agent',
          entityName: 'Replay Test Agent',
          startedAt: new Date(base),
          endedAt: new Date(base + 10_000),
        },
        ...calls.map((call, i) => ({
          traceId,
          spanId: `${traceId}-tool-${i}`,
          parentSpanId: `${traceId}-root`,
          name: "tool: 'lookup'",
          spanType: SpanType.TOOL_CALL,
          isEvent: false,
          entityType: EntityType.TOOL,
          entityId: 'lookup',
          entityName: 'lookup',
          input: call.input,
          output: call.output,
          error: call.error,
          startedAt: new Date(base + 1000 * (i + 1)),
          endedAt: new Date(base + 1000 * (i + 1) + 500),
        })),
      ],
    });
  }

  it('baseline (#17466): agent experiments execute tools live with real side effects', async () => {
    const summary = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Look up first and second' }],
      targetType: 'agent',
      targetId: 'replay-test-agent',
    });

    expect(summary.succeededCount).toBe(1);
    // Both tool calls hit the live tool — this is the problem the issue reports.
    expect(liveExecute).toHaveBeenCalledTimes(2);
  });

  it('replays recorded tool outputs from a per-item replayTraceId without touching live tools', async () => {
    await seedRecordedTrace('rec-trace-1', [
      { input: { key: 'first' }, output: { value: 'recorded:first' } },
      { input: { key: 'second' }, output: { value: 'recorded:second' } },
    ]);

    const summary = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Look up first and second', replayTraceId: 'rec-trace-1' }],
      targetType: 'agent',
      targetId: 'replay-test-agent',
      toolReplay: {},
    });

    expect(summary.results[0]?.error).toBeNull();
    expect(summary.succeededCount).toBe(1);
    // No live execution — the external world stayed frozen.
    expect(liveExecute).not.toHaveBeenCalled();

    const report = summary.results[0]?.toolReplay;
    expect(report).toMatchObject({
      sourceTraceId: 'rec-trace-1',
      totalRecorded: 2,
      replayedCount: 2,
      misses: [],
      unconsumed: [],
      argMismatches: [],
    });

    // The recorded outputs reached the model — they appear in the run's tool results.
    const output = summary.results[0]?.output as { text?: string; toolResults?: unknown[]; toolReplay?: unknown };
    expect(output.text).toBe('Done with lookups.');
    expect(JSON.stringify(output.toolResults)).toContain('recorded:first');
    // The in-memory output stays CLEAN of replay metadata — scorers receive
    // this object, and replay runs must score identically to baselines.
    expect(output.toolReplay).toBeUndefined();

    // The report persists through the experiment-result output column
    // (merged after scoring, for API consumers).
    const persisted = await experimentsStorage.listExperimentResults({
      experimentId: summary.experimentId,
      pagination: { page: 0, perPage: false },
    });
    expect((persisted.results[0]?.output as { toolReplay?: ToolReplayReport }).toolReplay?.replayedCount).toBe(2);
  });

  it('resolves the source trace per item from a prior experiment (fromExperimentId)', async () => {
    await seedRecordedTrace('rec-trace-2', [
      { input: { key: 'first' }, output: { value: 'recorded:first' } },
      { input: { key: 'second' }, output: { value: 'recorded:second' } },
    ]);

    // Prior experiment whose result links item-1 to the recorded trace
    await experimentsStorage.createExperiment({
      id: 'prior-exp',
      datasetId: null,
      datasetVersion: null,
      targetType: 'agent',
      targetId: 'replay-test-agent',
      totalItems: 1,
    });
    await experimentsStorage.addExperimentResult({
      experimentId: 'prior-exp',
      itemId: 'item-1',
      itemDatasetVersion: null,
      input: 'Look up first and second',
      output: { text: 'Done with lookups.' },
      groundTruth: null,
      error: null,
      startedAt: new Date(),
      completedAt: new Date(),
      retryCount: 0,
      traceId: 'rec-trace-2',
    });

    const summary = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Look up first and second' }],
      targetType: 'agent',
      targetId: 'replay-test-agent',
      toolReplay: { fromExperimentId: 'prior-exp' },
    });

    expect(summary.succeededCount).toBe(1);
    expect(liveExecute).not.toHaveBeenCalled();
    expect(summary.results[0]?.toolReplay?.sourceTraceId).toBe('rec-trace-2');
    expect(summary.results[0]?.toolReplay?.replayedCount).toBe(2);
  });

  it("onMiss: 'error' fails the item without retries when the recording runs dry", async () => {
    // Only ONE recorded call — the agent's second lookup is a miss
    await seedRecordedTrace('rec-trace-3', [{ input: { key: 'first' }, output: { value: 'recorded:first' } }]);

    const summary = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Look up first and second', replayTraceId: 'rec-trace-3' }],
      targetType: 'agent',
      targetId: 'replay-test-agent',
      toolReplay: {},
      maxRetries: 2,
    });

    expect(summary.failedCount).toBe(1);
    const result = summary.results[0]!;
    expect(result.error?.code).toBe('TOOL_REPLAY_MISS');
    expect(result.error?.message).toContain("Tool replay miss for 'lookup'");
    // Failure contract: failed executions have output: null (scorers run against output)
    expect(result.output).toBeNull();
    // Deterministic failure — the retry loop must not re-run it.
    expect(result.retryCount).toBe(0);
    expect(liveExecute).not.toHaveBeenCalled();
    expect(result.toolReplay?.misses).toEqual([{ toolName: 'lookup', action: 'error', input: { key: 'second' } }]);
  });

  it("onMiss: 'passthrough' executes unmatched calls live and records the miss", async () => {
    await seedRecordedTrace('rec-trace-4', [{ input: { key: 'first' }, output: { value: 'recorded:first' } }]);

    const summary = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Look up first and second', replayTraceId: 'rec-trace-4' }],
      targetType: 'agent',
      targetId: 'replay-test-agent',
      toolReplay: { onMiss: 'passthrough' },
    });

    expect(summary.succeededCount).toBe(1);
    // Exactly the second (unmatched) call hit the live tool
    expect(liveExecute).toHaveBeenCalledTimes(1);
    const report = summary.results[0]?.toolReplay;
    expect(report?.replayedCount).toBe(1);
    expect(report?.misses).toEqual([{ toolName: 'lookup', action: 'passthrough', input: { key: 'second' } }]);
  });

  it('reports every call as a miss when the item has no recording', async () => {
    const summary = await runExperiment(mastra, {
      data: [{ id: 'item-without-recording', input: 'Look up first and second' }],
      targetType: 'agent',
      targetId: 'replay-test-agent',
      toolReplay: { onMiss: 'passthrough' },
    });

    expect(summary.succeededCount).toBe(1);
    expect(liveExecute).toHaveBeenCalledTimes(2);
    expect(summary.results[0]?.toolReplay).toMatchObject({
      sourceTraceId: null,
      totalRecorded: 0,
      replayedCount: 0,
    });
    expect(summary.results[0]?.toolReplay?.misses).toHaveLength(2);
  });

  it('fails only the affected item when its trace cannot be loaded', async () => {
    await seedRecordedTrace('rec-trace-ok', [
      { input: { key: 'first' }, output: { value: 'recorded:first' } },
      { input: { key: 'second' }, output: { value: 'recorded:second' } },
    ]);
    const realGetTrace = observabilityStorage.getTrace.bind(observabilityStorage);
    vi.spyOn(observabilityStorage, 'getTrace').mockImplementation(async args => {
      if (args.traceId === 'rec-trace-broken') throw new Error('storage unavailable');
      return realGetTrace(args);
    });

    const summary = await runExperiment(mastra, {
      data: [
        { id: 'item-broken', input: 'Look up first and second', replayTraceId: 'rec-trace-broken' },
        { id: 'item-ok', input: 'Look up first and second', replayTraceId: 'rec-trace-ok' },
      ],
      targetType: 'agent',
      targetId: 'replay-test-agent',
      toolReplay: {},
    });

    expect(summary.failedCount).toBe(1);
    expect(summary.succeededCount).toBe(1);
    const broken = summary.results.find(r => r.itemId === 'item-broken')!;
    expect(broken.error?.code).toBe('TOOL_REPLAY_LOAD_FAILED');
    expect(broken.error?.message).toContain('storage unavailable');
    const ok = summary.results.find(r => r.itemId === 'item-ok')!;
    expect(ok.error).toBeNull();
    expect(ok.toolReplay?.replayedCount).toBe(2);
  });

  it('resolves the source trace from metadata.replayTraceId on storage-backed dataset items', async () => {
    await seedRecordedTrace('rec-trace-meta', [
      { input: { key: 'first' }, output: { value: 'recorded:first' } },
      { input: { key: 'second' }, output: { value: 'recorded:second' } },
    ]);

    const dataset = await datasetsStorage.createDataset({ name: 'Replay Dataset' });
    await datasetsStorage.addItem({
      datasetId: dataset.id,
      input: 'Look up first and second',
      metadata: { replayTraceId: 'rec-trace-meta' },
    });

    const summary = await runExperiment(mastra, {
      datasetId: dataset.id,
      targetType: 'agent',
      targetId: 'replay-test-agent',
      toolReplay: {},
    });

    expect(summary.succeededCount).toBe(1);
    expect(liveExecute).not.toHaveBeenCalled();
    expect(summary.results[0]?.toolReplay?.sourceTraceId).toBe('rec-trace-meta');
    expect(summary.results[0]?.toolReplay?.replayedCount).toBe(2);
  });

  it('re-throws a recorded tool error through the agent loop without running the live tool', async () => {
    await seedRecordedTrace('rec-trace-err', [
      { input: { key: 'first' }, error: { name: 'TimeoutError', message: 'upstream timed out' } },
      { input: { key: 'second' }, output: { value: 'recorded:second' } },
    ]);

    const summary = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Look up first and second', replayTraceId: 'rec-trace-err' }],
      targetType: 'agent',
      targetId: 'replay-test-agent',
      toolReplay: {},
    });

    // The agent saw the recorded failure as a tool-error result and kept going
    expect(summary.succeededCount).toBe(1);
    expect(liveExecute).not.toHaveBeenCalled();
    const report = summary.results[0]?.toolReplay;
    expect(report?.replayedCount).toBe(2);
    expect(report?.misses).toEqual([]);
    // Errored calls don't appear in toolResults — only the successful second call does
    const output = summary.results[0]?.output as { toolResults?: unknown[] };
    const serialized = JSON.stringify(output.toolResults);
    expect(serialized).toContain('recorded:second');
    expect(serialized).not.toContain('recorded:first');
  });

  it('rejects toolReplay for non-agent targets at setup', async () => {
    await expect(
      runExperiment(mastra, {
        data: [{ id: 'item-1', input: {} }],
        targetType: 'workflow',
        targetId: 'some-workflow',
        toolReplay: {},
      }),
    ).rejects.toThrowError(/toolReplay is only supported for agent targets/);
  });

  it('rejects toolReplay for inline task functions at setup', async () => {
    await expect(
      runExperiment(mastra, {
        data: [{ id: 'item-1', input: {} }],
        task: async ({ input }) => input,
        toolReplay: {},
      }),
    ).rejects.toThrowError(/toolReplay is only supported for agent targets/);
  });
});
