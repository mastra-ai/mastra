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
import { getToolReplayMarker } from '../replay';
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

    // The report persists in its own column — and the stored output stays as
    // clean as the in-memory one (no replay metadata smuggled inside).
    const persisted = await experimentsStorage.listExperimentResults({
      experimentId: summary.experimentId,
      pagination: { page: 0, perPage: false },
    });
    expect(persisted.results[0]?.toolReplay?.replayedCount).toBe(2);
    expect((persisted.results[0]?.output as { toolReplay?: ToolReplayReport }).toolReplay).toBeUndefined();
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

  it('fails the item when no recording resolves — never runs silently live', async () => {
    // Even with onMiss: 'passthrough', a missing recording must not silently
    // execute the whole run live while reporting success. If live execution
    // is wanted, run without toolReplay.
    const summary = await runExperiment(mastra, {
      data: [{ id: 'item-without-recording', input: 'Look up first and second' }],
      targetType: 'agent',
      targetId: 'replay-test-agent',
      toolReplay: { onMiss: 'passthrough' },
    });

    expect(summary.failedCount).toBe(1);
    expect(liveExecute).not.toHaveBeenCalled();
    const result = summary.results[0]!;
    expect(result.error?.code).toBe('TOOL_REPLAY_NO_RECORDING');
    expect(result.error?.message).toContain('explicit ids');
  });

  it('fails the item when the source trace was purged or never flushed', async () => {
    const summary = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Look up first and second', replayTraceId: 'purged-trace' }],
      targetType: 'agent',
      targetId: 'replay-test-agent',
      toolReplay: {},
    });

    expect(summary.failedCount).toBe(1);
    expect(liveExecute).not.toHaveBeenCalled();
    const result = summary.results[0]!;
    expect(result.error?.code).toBe('TOOL_REPLAY_NO_RECORDING');
    expect(result.error?.message).toContain('purged-trace');
  });

  it('stamps replay experiments with a toolReplay metadata marker', async () => {
    await seedRecordedTrace('rec-trace-marker', [
      { input: { key: 'first' }, output: { value: 'recorded:first' } },
      { input: { key: 'second' }, output: { value: 'recorded:second' } },
    ]);

    const summary = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Look up first and second', replayTraceId: 'rec-trace-marker' }],
      targetType: 'agent',
      targetId: 'replay-test-agent',
      metadata: { team: 'evals' },
      toolReplay: { onMiss: 'passthrough' },
    });

    const experiment = await experimentsStorage.getExperimentById({ id: summary.experimentId });
    // Stored runs must be distinguishable from live runs — and user metadata survives
    expect(experiment?.metadata).toMatchObject({
      team: 'evals',
      toolReplay: { onMiss: 'passthrough' },
    });
  });

  it('persists the divergence report for failed items too', async () => {
    // One recorded call, agent makes two → deterministic TOOL_REPLAY_MISS.
    await seedRecordedTrace('rec-trace-failed-report', [{ input: { key: 'first' }, output: { value: 'one' } }]);

    const summary = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Look up first and second', replayTraceId: 'rec-trace-failed-report' }],
      targetType: 'agent',
      targetId: 'replay-test-agent',
      toolReplay: {},
    });

    expect(summary.failedCount).toBe(1);
    const persisted = await experimentsStorage.listExperimentResults({
      experimentId: summary.experimentId,
      pagination: { page: 0, perPage: false },
    });
    // Failures are when the report matters most — it must survive persistence
    expect(persisted.results[0]?.toolReplay?.replayedCount).toBe(1);
    expect(persisted.results[0]?.toolReplay?.misses).toHaveLength(1);
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

  it('flags stale recordings when the item was edited after the recording', async () => {
    await seedRecordedTrace('rec-trace-stale', [
      { input: { key: 'first' }, output: { value: 'recorded:first' } },
      { input: { key: 'second' }, output: { value: 'recorded:second' } },
    ]);

    const dataset = await datasetsStorage.createDataset({ name: 'Stale Dataset' });
    const item = await datasetsStorage.addItem({ datasetId: dataset.id, input: 'Look up first and second' });

    // Prior experiment recorded against a DIFFERENT version of this item
    await experimentsStorage.createExperiment({
      id: 'stale-prior',
      datasetId: dataset.id,
      datasetVersion: 999,
      targetType: 'agent',
      targetId: 'replay-test-agent',
      totalItems: 1,
    });
    await experimentsStorage.addExperimentResult({
      experimentId: 'stale-prior',
      itemId: item.id,
      itemDatasetVersion: 999,
      input: 'old input',
      output: {},
      groundTruth: null,
      error: null,
      startedAt: new Date(),
      completedAt: new Date(),
      retryCount: 0,
      traceId: 'rec-trace-stale',
    });

    const summary = await runExperiment(mastra, {
      datasetId: dataset.id,
      targetType: 'agent',
      targetId: 'replay-test-agent',
      toolReplay: { fromExperimentId: 'stale-prior' },
    });

    expect(summary.succeededCount).toBe(1);
    expect(summary.results[0]?.toolReplay?.staleRecording).toBe(true);
  });

  it('does not retry TOOL_REPLAY_NO_RECORDING failures — the resolution is memoized and cannot change', async () => {
    const summary = await runExperiment(mastra, {
      data: [{ id: 'item-without-recording', input: 'Look up first and second' }],
      targetType: 'agent',
      targetId: 'replay-test-agent',
      toolReplay: {},
      maxRetries: 2,
    });

    expect(summary.failedCount).toBe(1);
    const result = summary.results[0]!;
    expect(result.error?.code).toBe('TOOL_REPLAY_NO_RECORDING');
    // Deterministic failure — retrying would only burn exponential backoff.
    expect(result.retryCount).toBe(0);
    expect(liveExecute).not.toHaveBeenCalled();
  });

  it('rejects fromExperimentId pointing at an experiment that does not exist', async () => {
    await expect(
      runExperiment(mastra, {
        data: [{ id: 'item-1', input: 'Look up first and second' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        toolReplay: { fromExperimentId: 'no-such-experiment' },
      }),
    ).rejects.toThrowError(/does not match any experiment/);
  });

  it('rejects fromExperimentId pointing at a replay experiment — recordings must come from live runs', async () => {
    // A replay run's trace contains only synthetic tool spans (which
    // extraction skips), so chaining it would make every item miss (onMiss
    // 'error') or run fully live (onMiss 'passthrough').
    await experimentsStorage.createExperiment({
      id: 'replay-exp',
      datasetId: null,
      datasetVersion: null,
      targetType: 'agent',
      targetId: 'replay-test-agent',
      totalItems: 1,
      metadata: { toolReplay: { onMiss: 'error' } },
    });

    await expect(
      runExperiment(mastra, {
        data: [{ id: 'item-1', input: 'Look up first and second' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        toolReplay: { fromExperimentId: 'replay-exp' },
      }),
    ).rejects.toThrowError(/itself a tool replay run/);
  });

  it('never replays a trace made of synthetic spans — a replay run trace pointed at via replayTraceId all-misses', async () => {
    // Replay/mock runs record synthetic TOOL_CALL spans for short-circuited
    // calls (flagged metadata.toolReplay.synthetic, exactly as the agent's
    // hook wrapper emits them). Pointing a second replay directly at such a
    // trace must find zero replayable events: the trace exists, so resolution
    // succeeds, but every call misses — the synthetic outputs are never served
    // as recordings.
    const base = Date.parse('2026-01-02T00:00:00Z');
    await observabilityStorage.batchCreateSpans({
      records: [
        {
          traceId: 'replay-run-trace',
          spanId: 'replay-run-root',
          name: "agent run: 'replay-test-agent'",
          spanType: SpanType.AGENT_RUN,
          isEvent: false,
          entityType: EntityType.AGENT,
          entityId: 'replay-test-agent',
          entityName: 'Replay Test Agent',
          startedAt: new Date(base),
          endedAt: new Date(base + 10_000),
        },
        ...[0, 1].map(i => ({
          traceId: 'replay-run-trace',
          spanId: `replay-run-tool-${i}`,
          parentSpanId: 'replay-run-root',
          name: "tool: 'lookup'",
          spanType: SpanType.TOOL_CALL,
          isEvent: false,
          entityType: EntityType.TOOL,
          entityId: 'lookup',
          entityName: 'lookup',
          input: { key: i === 0 ? 'first' : 'second' },
          output: { value: `served-from-recording:${i}` },
          metadata: { toolReplay: { synthetic: true, outcome: 'replayed', sequence: i } },
          startedAt: new Date(base + 1000 * (i + 1)),
          endedAt: new Date(base + 1000 * (i + 1) + 500),
        })),
      ],
    });

    const summary = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Look up first and second', replayTraceId: 'replay-run-trace' }],
      targetType: 'agent',
      targetId: 'replay-test-agent',
      toolReplay: {},
    });

    expect(summary.failedCount).toBe(1);
    const result = summary.results[0]!;
    expect(result.error?.code).toBe('TOOL_REPLAY_MISS');
    expect(liveExecute).not.toHaveBeenCalled();
    // Zero events extracted: nothing recorded, nothing replayed, first call missed.
    expect(result.toolReplay?.totalRecorded).toBe(0);
    expect(result.toolReplay?.replayedCount).toBe(0);
    expect(result.toolReplay?.misses.length).toBeGreaterThan(0);
    // The synthetic outputs never reached the agent.
    expect(JSON.stringify(result.toolReplay)).not.toContain('served-from-recording');
  });

  it('accepts a live source experiment whose user metadata happens to contain a toolReplay key', async () => {
    // Experiment metadata is user-writable. Only the exact marker shape this
    // feature stamps (an object with onMiss) disqualifies a source — an
    // unrelated user key must not reject a valid live recording.
    await seedRecordedTrace('rec-trace-collision', [
      { input: { key: 'first' }, output: { value: 'recorded:first' } },
      { input: { key: 'second' }, output: { value: 'recorded:second' } },
    ]);
    await experimentsStorage.createExperiment({
      id: 'live-with-junk-metadata',
      datasetId: null,
      datasetVersion: null,
      targetType: 'agent',
      targetId: 'replay-test-agent',
      totalItems: 1,
      metadata: { toolReplay: 'user-owned junk' },
    });
    await experimentsStorage.addExperimentResult({
      experimentId: 'live-with-junk-metadata',
      itemId: 'item-1',
      itemDatasetVersion: null,
      input: 'Look up first and second',
      output: { text: 'Done with lookups.' },
      groundTruth: null,
      error: null,
      startedAt: new Date(),
      completedAt: new Date(),
      retryCount: 0,
      traceId: 'rec-trace-collision',
    });

    const summary = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Look up first and second' }],
      targetType: 'agent',
      targetId: 'replay-test-agent',
      toolReplay: { fromExperimentId: 'live-with-junk-metadata' },
    });

    expect(summary.succeededCount).toBe(1);
    expect(liveExecute).not.toHaveBeenCalled();
    expect(summary.results[0]?.toolReplay?.replayedCount).toBe(2);
  });

  it('keeps the divergence report when the run fails after replaying began (non-miss failure)', async () => {
    await seedRecordedTrace('rec-trace-late-fail', [
      { input: { key: 'first' }, output: { value: 'recorded:first' } },
      { input: { key: 'second' }, output: { value: 'recorded:second' } },
    ]);

    // Model issues one tool call, then the provider blows up mid-run.
    let calls = 0;
    const failingModel = new MockLanguageModelV2({
      doGenerate: async () => {
        calls++;
        if (calls === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            finishReason: 'tool-calls' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [
              {
                type: 'tool-call' as const,
                toolCallType: 'function' as const,
                toolCallId: 'call-late-fail',
                toolName: 'lookup',
                input: '{"key":"first"}',
              },
            ],
          };
        }
        throw new Error('provider exploded');
      },
    });
    const failingAgent = new Agent({
      id: 'late-fail-agent',
      name: 'Late Fail Agent',
      instructions: 'Use the lookup tool.',
      model: failingModel,
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'Look up a record in an external system',
          inputSchema: z.object({ key: z.string() }),
          execute: liveExecute,
        }),
      },
    });
    const failingMastra = new MastraClass({ agents: { 'late-fail-agent': failingAgent }, logger: false });
    (mastra.getAgentById as ReturnType<typeof vi.fn>).mockReturnValue(failingMastra.getAgent('late-fail-agent'));
    (mastra.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(failingMastra.getAgent('late-fail-agent'));

    const summary = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Look up first and second', replayTraceId: 'rec-trace-late-fail' }],
      targetType: 'agent',
      targetId: 'late-fail-agent',
      toolReplay: {},
    });

    expect(summary.failedCount).toBe(1);
    const result = summary.results[0]!;
    expect(result.error?.message).toContain('provider exploded');
    expect(result.output).toBeNull();
    // The partial divergence evidence survives the failure — one call was
    // replayed before the provider died, one recorded event went unconsumed.
    expect(result.toolReplay?.replayedCount).toBe(1);
    expect(result.toolReplay?.unconsumed).toEqual([{ toolName: 'lookup', count: 1 }]);
    expect(liveExecute).not.toHaveBeenCalled();

    const persisted = await experimentsStorage.listExperimentResults({
      experimentId: summary.experimentId,
      pagination: { page: 0, perPage: false },
    });
    expect(persisted.results[0]?.toolReplay?.replayedCount).toBe(1);
  });

  it('reports the first miss when parallel calls miss in the same step', async () => {
    // Recording exists (found) but covers a different tool, so both parallel
    // calls in the model's single step are misses.
    await seedRecordedTrace('rec-trace-two-miss', [{ input: { key: 'first' }, output: { value: 'one' } }]);

    const twoCallModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        finishReason: 'tool-calls' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [
          {
            type: 'tool-call' as const,
            toolCallType: 'function' as const,
            toolCallId: 'call-alpha',
            toolName: 'alpha',
            input: '{}',
          },
          {
            type: 'tool-call' as const,
            toolCallType: 'function' as const,
            toolCallId: 'call-beta',
            toolName: 'beta',
            input: '{}',
          },
        ],
      }),
    });
    const noop = vi.fn().mockResolvedValue({ ok: true });
    const twoToolAgent = new Agent({
      id: 'two-miss-agent',
      name: 'Two Miss Agent',
      instructions: 'Use alpha and beta.',
      model: twoCallModel,
      tools: {
        alpha: createTool({ id: 'alpha', description: 'a', inputSchema: z.object({}), execute: noop }),
        beta: createTool({ id: 'beta', description: 'b', inputSchema: z.object({}), execute: noop }),
      },
    });
    const twoMissMastra = new MastraClass({ agents: { 'two-miss-agent': twoToolAgent }, logger: false });
    (mastra.getAgentById as ReturnType<typeof vi.fn>).mockReturnValue(twoMissMastra.getAgent('two-miss-agent'));
    (mastra.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(twoMissMastra.getAgent('two-miss-agent'));

    const summary = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Run both tools', replayTraceId: 'rec-trace-two-miss' }],
      targetType: 'agent',
      targetId: 'two-miss-agent',
      toolReplay: {},
    });

    expect(summary.failedCount).toBe(1);
    const result = summary.results[0]!;
    expect(result.error?.code).toBe('TOOL_REPLAY_MISS');
    // The reported error must name the FIRST miss (it is also the abort
    // reason); later misses from the same step appear in the report only.
    const misses = result.toolReplay?.misses ?? [];
    expect(misses.length).toBeGreaterThanOrEqual(1);
    expect(result.error?.message).toContain(`'${misses[0]!.toolName}'`);
    expect(noop).not.toHaveBeenCalled();
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

  describe('tool mocks (runner integration)', () => {
    it('mock-only runs stub the mocked tool, run others live, and stamp mockedTools', async () => {
      const summary = await runExperiment(mastra, {
        data: [{ id: 'item-1', input: 'Look up first and second' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        toolMocks: { lookup: { output: { value: 'mocked!' } } },
      });

      expect(summary.succeededCount).toBe(1);
      // The stub answered both calls — the live tool never executed.
      expect(liveExecute).not.toHaveBeenCalled();
      const output = summary.results[0]?.output as { toolResults?: unknown[] };
      expect(JSON.stringify(output.toolResults)).toContain('mocked!');

      const report = summary.results[0]?.toolReplay;
      expect(report?.mocks).toEqual([{ toolName: 'lookup', calls: 2, kind: 'output' }]);
      expect(report?.sourceTraceId).toBeNull();
      expect(report?.totalRecorded).toBe(0);

      const experiment = await experimentsStorage.getExperimentById({ id: summary.experimentId });
      expect(experiment?.metadata).toMatchObject({ toolReplay: { mockedTools: ['lookup'] } });
    });

    it('an unsatisfied expectation fails the item without retries', async () => {
      const summary = await runExperiment(mastra, {
        data: [{ id: 'item-1', input: 'Look up first and second' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        maxRetries: 2,
        toolMocks: {
          lookup: { output: { value: 'ok' } },
          // The model never calls this tool — the assertion must fail the item.
          neverCalled: { output: { ok: true }, expect: { calledTimes: 1 } },
        },
      });

      expect(summary.failedCount).toBe(1);
      const result = summary.results[0]!;
      expect(result.error?.code).toBe('TOOL_MOCK_EXPECTATION_FAILED');
      expect(result.error?.message).toContain('neverCalled');
      // Deterministic — the retry loop must not have re-run the item.
      expect(result.retryCount).toBe(0);
      expect(result.toolReplay?.expectations).toEqual([
        {
          toolName: 'neverCalled',
          satisfied: false,
          calledTimes: 0,
          reason: 'expected 1 call(s), got 0',
        },
      ]);
      expect(result.toolReplay?.mocks).toEqual([
        { toolName: 'lookup', calls: 2, kind: 'output' },
        { toolName: 'neverCalled', calls: 0, kind: 'output' },
      ]);
    });

    it('strict matching through the runner: rephrased args fail instead of re-pairing', async () => {
      await seedRecordedTrace('rec-trace-strict', [
        { input: { key: 'COMPLETELY-DIFFERENT' }, output: { value: 'recorded' } },
      ]);

      const summary = await runExperiment(mastra, {
        data: [{ id: 'item-1', input: 'Look up first and second', replayTraceId: 'rec-trace-strict' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        toolReplay: { matching: 'strict' },
      });

      expect(summary.failedCount).toBe(1);
      expect(summary.results[0]?.error?.code).toBe('TOOL_REPLAY_MISS');
      const report = summary.results[0]?.toolReplay;
      expect(report?.argMismatches).toEqual([]);
      expect(report?.misses.length).toBeGreaterThan(0);

      const experiment = await experimentsStorage.getExperimentById({ id: summary.experimentId });
      expect(experiment?.metadata).toMatchObject({ toolReplay: { matching: 'strict' } });
    });

    it('rejects a mock-marked experiment as a replay source', async () => {
      const mockRun = await runExperiment(mastra, {
        data: [{ id: 'item-1', input: 'Look up first and second' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        toolMocks: { lookup: { output: { value: 'mocked' } } },
      });

      await expect(
        runExperiment(mastra, {
          data: [{ id: 'item-1', input: 'Look up first and second' }],
          targetType: 'agent',
          targetId: 'replay-test-agent',
          toolReplay: { fromExperimentId: mockRun.experimentId },
        }),
      ).rejects.toThrowError(/itself a tool replay run/);
    });

    it('rejects toolMocks for non-agent targets at setup', async () => {
      await expect(
        runExperiment(mastra, {
          data: [{ id: 'item-1', input: 'hello' }],
          targetType: 'workflow',
          targetId: 'some-workflow',
          toolMocks: { lookup: { output: 1 } },
        }),
      ).rejects.toThrowError(/toolMocks is only supported for agent targets/);
    });
  });

  describe('cases mocks (runner integration)', () => {
    // The model calls lookup twice: { key: 'first' } then { key: 'second' }.
    const bothCases = [
      { args: { key: 'first' }, output: { value: 'case:first' } },
      { args: { key: 'second' }, output: { value: 'case:second' } },
    ];

    it('serves args-conditional outputs per call and reports kind and caseIndex', async () => {
      const summary = await runExperiment(mastra, {
        data: [{ id: 'item-1', input: 'Look up first and second' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        toolMocks: { lookup: { cases: bothCases } },
      });

      expect(summary.results[0]?.error).toBeNull();
      expect(summary.succeededCount).toBe(1);
      expect(liveExecute).not.toHaveBeenCalled();
      // Each call got ITS answer — not a shared static stub.
      const output = summary.results[0]?.output as { toolResults?: unknown[] };
      const serialized = JSON.stringify(output.toolResults);
      expect(serialized).toContain('case:first');
      expect(serialized).toContain('case:second');

      const report = summary.results[0]?.toolReplay;
      expect(report?.mocks).toEqual([{ toolName: 'lookup', calls: 2, kind: 'cases' }]);
      expect(report?.calls).toEqual([
        { order: 0, toolName: 'lookup', outcome: 'mocked', caseIndex: 0 },
        { order: 1, toolName: 'lookup', outcome: 'mocked', caseIndex: 1 },
      ]);
    });

    it("onNoMatch 'error' (default) fails the item deterministically with TOOL_MOCK_ARGS_MISMATCH", async () => {
      const summary = await runExperiment(mastra, {
        data: [{ id: 'item-1', input: 'Look up first and second' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        maxRetries: 2,
        // Only the first call has a case — the second call misses the table.
        toolMocks: { lookup: { cases: [bothCases[0]!] } },
      });

      expect(summary.failedCount).toBe(1);
      const result = summary.results[0]!;
      expect(result.error?.code).toBe('TOOL_MOCK_ARGS_MISMATCH');
      expect(result.error?.message).toContain("Tool mock case miss for 'lookup'");
      expect(result.output).toBeNull();
      // Deterministic — the case table cannot change within a run.
      expect(result.retryCount).toBe(0);
      expect(liveExecute).not.toHaveBeenCalled();
      expect(result.toolReplay?.calls?.map(call => call.outcome)).toEqual(['mocked', 'case-miss-error']);
    });

    it("onNoMatch 'passthrough' executes unmatched calls live and still counts them", async () => {
      const summary = await runExperiment(mastra, {
        data: [{ id: 'item-1', input: 'Look up first and second' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        toolMocks: { lookup: { cases: [bothCases[0]!], onNoMatch: 'passthrough' } },
      });

      expect(summary.results[0]?.error).toBeNull();
      expect(summary.succeededCount).toBe(1);
      // Exactly the unmatched second call hit the live tool.
      expect(liveExecute).toHaveBeenCalledTimes(1);
      const report = summary.results[0]?.toolReplay;
      expect(report?.mocks).toEqual([{ toolName: 'lookup', calls: 2, kind: 'cases' }]);
      expect(report?.calls?.map(call => call.outcome)).toEqual(['mocked', 'case-miss-passthrough']);
    });

    it('combines with expect — every call counts, matched or case-missed', async () => {
      const summary = await runExperiment(mastra, {
        data: [{ id: 'item-1', input: 'Look up first and second' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        toolMocks: {
          lookup: { cases: [bothCases[0]!], onNoMatch: 'passthrough', expect: { calledTimes: 2 } },
        },
      });

      expect(summary.succeededCount).toBe(1);
      expect(summary.results[0]?.toolReplay?.expectations).toEqual([
        { toolName: 'lookup', satisfied: true, calledTimes: 2 },
      ]);
    });

    it('a cases mock on a strict-replayed tool wins and keeps the unconsumed exemption', async () => {
      await seedRecordedTrace('rec-trace-strict-cases', [
        { input: { key: 'first' }, output: { value: 'recorded:first' } },
        { input: { key: 'second' }, output: { value: 'recorded:second' } },
      ]);

      const summary = await runExperiment(mastra, {
        data: [{ id: 'item-1', input: 'Look up first and second', replayTraceId: 'rec-trace-strict-cases' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        toolReplay: { matching: 'strict' },
        toolMocks: { lookup: { cases: bothCases } },
      });

      expect(summary.results[0]?.error).toBeNull();
      expect(summary.succeededCount).toBe(1);
      const report = summary.results[0]?.toolReplay;
      // The mock answered both calls; the recording stays visibly unconsumed
      // without breaching the strict contract.
      expect(report?.replayedCount).toBe(0);
      expect(report?.unconsumed).toEqual([{ toolName: 'lookup', count: 2 }]);
      expect(report?.mocks).toEqual([{ toolName: 'lookup', calls: 2, kind: 'cases' }]);
    });

    it('rejects misconfigured cases at setup, before any item runs', async () => {
      await expect(
        runExperiment(mastra, {
          data: [{ id: 'item-1', input: 'Look up first and second' }],
          targetType: 'agent',
          targetId: 'replay-test-agent',
          toolMocks: { lookup: { output: { value: 'static' }, cases: bothCases } },
        }),
      ).rejects.toThrowError(/either static or conditional/);
      expect(liveExecute).not.toHaveBeenCalled();
    });
  });

  describe('persisted mock configs (marker round-trip)', () => {
    it('stamps data mocks verbatim and function mocks as placeholders, parseable via getToolReplayMarker', async () => {
      const summary = await runExperiment(mastra, {
        data: [{ id: 'item-1', input: 'Look up first and second' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        toolMocks: {
          lookup: {
            cases: [
              { args: { key: 'first' }, output: { value: 'case:first' } },
              { args: { key: 'second' }, output: { value: 'case:second' } },
            ],
            onNoMatch: 'passthrough',
            expect: { calledTimes: 2 },
          },
          searchDocs: async () => ({ hits: [] }),
        },
      });

      expect(summary.succeededCount).toBe(1);
      const experiment = await experimentsStorage.getExperimentById({ id: summary.experimentId });
      const marker = getToolReplayMarker(experiment?.metadata as Record<string, unknown>);
      // mockedTools stays the cheap display field…
      expect(marker?.mockedTools).toEqual(['lookup', 'searchDocs']);
      // …and the config itself persists, so the run is auditable and re-runnable.
      expect(marker?.mockConfigs).toEqual({
        lookup: {
          cases: [
            { args: { key: 'first' }, output: { value: 'case:first' } },
            { args: { key: 'second' }, output: { value: 'case:second' } },
          ],
          onNoMatch: 'passthrough',
          expect: { calledTimes: 2 },
        },
        searchDocs: { function: true },
      });
    });

    it('stamps mockConfigs on the async path (pre-created experiment record)', async () => {
      await experimentsStorage.createExperiment({
        id: 'pre-created-config-run',
        datasetId: null,
        datasetVersion: null,
        targetType: 'agent',
        targetId: 'replay-test-agent',
        totalItems: 0,
      });

      const summary = await runExperiment(mastra, {
        experimentId: 'pre-created-config-run',
        data: [{ id: 'item-1', input: 'Look up first and second' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        toolMocks: { lookup: { output: { value: 'mocked' } } },
      });

      expect(summary.succeededCount).toBe(1);
      const experiment = await experimentsStorage.getExperimentById({ id: 'pre-created-config-run' });
      expect(getToolReplayMarker(experiment?.metadata as Record<string, unknown>)?.mockConfigs).toEqual({
        lookup: { output: { value: 'mocked' } },
      });
    });
  });

  describe('itemIds filter', () => {
    it('runs only the selected items — single-item replay re-runs', async () => {
      await observabilityStorage.batchCreateSpans({ records: [] }).catch(() => {});
      const summary = await runExperiment(mastra, {
        data: [
          { id: 'item-1', input: 'Look up first and second' },
          { id: 'item-2', input: 'Look up first and second' },
          { id: 'item-3', input: 'Look up first and second' },
        ],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        itemIds: ['item-2'],
      });

      expect(summary.totalItems).toBe(1);
      expect(summary.results.map(r => r.itemId)).toEqual(['item-2']);
    });

    it('fails at setup when no item matches', async () => {
      await expect(
        runExperiment(mastra, {
          data: [{ id: 'item-1', input: 'hello' }],
          targetType: 'agent',
          targetId: 'replay-test-agent',
          itemIds: ['nope'],
        }),
      ).rejects.toThrowError(/No items match itemIds/);
    });
  });

  describe('review regressions (Codex + adversarial)', () => {
    it('stamps mockedTools on the async path (pre-created experiment record)', async () => {
      // startExperimentAsync pre-creates the record, then runExperiment receives
      // its id — the marker must be stamped in the running-status update.
      await experimentsStorage.createExperiment({
        id: 'pre-created-mock-run',
        datasetId: null,
        datasetVersion: null,
        targetType: 'agent',
        targetId: 'replay-test-agent',
        totalItems: 0,
      });

      const summary = await runExperiment(mastra, {
        experimentId: 'pre-created-mock-run',
        data: [{ id: 'item-1', input: 'Look up first and second' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        toolMocks: { lookup: { output: { value: 'mocked' } } },
      });

      expect(summary.succeededCount).toBe(1);
      const experiment = await experimentsStorage.getExperimentById({ id: 'pre-created-mock-run' });
      expect(experiment?.metadata).toMatchObject({ toolReplay: { mockedTools: ['lookup'] } });
    });

    it('TOOL_REPLAY_MISS wins over a failed expectation when both happen in one run', async () => {
      // One recorded call, agent makes two: second call is a fatal miss. The
      // expect-only mock on a never-called tool is also unsatisfied — the miss
      // aborted the run, so its code wins; the report still carries both.
      await seedRecordedTrace('rec-trace-precedence', [{ input: { key: 'first' }, output: { value: 'recorded' } }]);

      const summary = await runExperiment(mastra, {
        data: [{ id: 'item-1', input: 'Look up first and second', replayTraceId: 'rec-trace-precedence' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        toolReplay: {},
        toolMocks: { neverCalled: { expect: { calledTimes: 1 } } },
      });

      expect(summary.failedCount).toBe(1);
      const result = summary.results[0]!;
      expect(result.error?.code).toBe('TOOL_REPLAY_MISS');
      expect(result.toolReplay?.misses.length).toBeGreaterThan(0);
      expect(result.toolReplay?.expectations).toEqual([
        { toolName: 'neverCalled', satisfied: false, calledTimes: 0, reason: 'expected 1 call(s), got 0' },
      ]);
    });

    it('strict matching fails the item when recorded calls stay unconsumed — the tape is a contract', async () => {
      await seedRecordedTrace('rec-trace-extra', [
        { input: { key: 'first' }, output: { value: 'recorded:first' } },
        { input: { key: 'second' }, output: { value: 'recorded:second' } },
        { input: { key: 'third' }, output: { value: 'recorded:third' } },
      ]);

      const summary = await runExperiment(mastra, {
        data: [{ id: 'item-1', input: 'Look up first and second', replayTraceId: 'rec-trace-extra' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        maxRetries: 2,
        toolReplay: { matching: 'strict' },
      });

      expect(summary.failedCount).toBe(1);
      const result = summary.results[0]!;
      expect(result.error?.code).toBe('TOOL_REPLAY_UNCONSUMED');
      expect(result.error?.message).toContain('lookup (1)');
      // Deterministic — never retried.
      expect(result.retryCount).toBe(0);
      // Both made calls replayed fine; the failure is the third recorded call.
      expect(result.toolReplay?.replayedCount).toBe(2);
      expect(result.toolReplay?.unconsumed).toEqual([{ toolName: 'lookup', count: 1 }]);
    });

    it('fifo tolerates the same leftover tape: unconsumed is reported, the item succeeds', async () => {
      await seedRecordedTrace('rec-trace-extra-fifo', [
        { input: { key: 'first' }, output: { value: 'recorded:first' } },
        { input: { key: 'second' }, output: { value: 'recorded:second' } },
        { input: { key: 'third' }, output: { value: 'recorded:third' } },
      ]);

      const summary = await runExperiment(mastra, {
        data: [{ id: 'item-1', input: 'Look up first and second', replayTraceId: 'rec-trace-extra-fifo' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        toolReplay: {},
      });

      expect(summary.succeededCount).toBe(1);
      expect(summary.results[0]?.toolReplay?.unconsumed).toEqual([{ toolName: 'lookup', count: 1 }]);
    });

    it('expect-only mock runs execute live, are not stamped, and stay eligible as replay sources', async () => {
      const observeRun = await runExperiment(mastra, {
        data: [{ id: 'item-1', input: 'Look up first and second' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        toolMocks: { lookup: { expect: { calledTimes: 2 } } },
      });

      expect(observeRun.succeededCount).toBe(1);
      // Observed, not stubbed — the live tool executed and its spans are real.
      expect(liveExecute).toHaveBeenCalledTimes(2);
      expect(observeRun.results[0]?.toolReplay?.expectations).toEqual([
        { toolName: 'lookup', satisfied: true, calledTimes: 2 },
      ]);

      const experiment = await experimentsStorage.getExperimentById({ id: observeRun.experimentId });
      expect(experiment?.metadata ?? {}).not.toHaveProperty('toolReplay');

      // Not mock-marked, so pointing a replay at it passes the source guard.
      await expect(
        runExperiment(mastra, {
          data: [{ id: 'item-1', input: 'Look up first and second' }],
          targetType: 'agent',
          targetId: 'replay-test-agent',
          toolReplay: { fromExperimentId: observeRun.experimentId },
        }),
      ).resolves.toBeDefined();
    });

    it('rejects colliding mock keys at setup — before any item runs', async () => {
      await expect(
        runExperiment(mastra, {
          data: [{ id: 'item-1', input: 'Look up first and second' }],
          targetType: 'agent',
          targetId: 'replay-test-agent',
          toolMocks: { 'look.up': { output: 1 }, look_up: { output: 2 } },
        }),
      ).rejects.toThrowError(/both normalize to tool name 'look_up'/);
    });
  });

  describe('strict matching + mocks: the per-tool escape hatch', () => {
    it('a suppressing mock on a recorded tool does not breach the strict contract', async () => {
      // The documented recipe: strict everywhere, mock the one tool whose args
      // drift. The mock answers every call, so the tool's recorded events can
      // never be consumed — that must not fail the item.
      await seedRecordedTrace('rec-trace-strict-mock', [
        { input: { key: 'first' }, output: { value: 'recorded:first' } },
        { input: { key: 'second' }, output: { value: 'recorded:second' } },
      ]);

      const summary = await runExperiment(mastra, {
        data: [{ id: 'item-1', input: 'Look up first and second', replayTraceId: 'rec-trace-strict-mock' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        toolReplay: { matching: 'strict' },
        toolMocks: { lookup: { output: { value: 'mocked' } } },
      });

      expect(summary.results[0]?.error).toBeNull();
      expect(summary.succeededCount).toBe(1);
      const report = summary.results[0]?.toolReplay;
      // The evidence stays honest: the events are still reported unconsumed.
      expect(report?.unconsumed).toEqual([{ toolName: 'lookup', count: 2 }]);
      expect(report?.mocks).toEqual([{ toolName: 'lookup', calls: 2, kind: 'output' }]);
    });

    it('an expect-only mock stays inside the strict contract — leftovers still fail', async () => {
      // Expect-only entries observe and fall through to the queue; a leftover
      // recorded call is a genuine breach, not an exemption.
      await seedRecordedTrace('rec-trace-strict-observe', [
        { input: { key: 'first' }, output: { value: 'recorded:first' } },
        { input: { key: 'second' }, output: { value: 'recorded:second' } },
        { input: { key: 'third' }, output: { value: 'recorded:third' } },
      ]);

      const summary = await runExperiment(mastra, {
        data: [{ id: 'item-1', input: 'Look up first and second', replayTraceId: 'rec-trace-strict-observe' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        toolReplay: { matching: 'strict' },
        toolMocks: { lookup: { expect: { calledTimes: 2 } } },
      });

      expect(summary.failedCount).toBe(1);
      expect(summary.results[0]?.error?.code).toBe('TOOL_REPLAY_UNCONSUMED');
    });
  });

  describe('async setup failures', () => {
    it('persists the failure reason on the pre-created experiment record', async () => {
      await experimentsStorage.createExperiment({
        id: 'pre-created-bad-source',
        datasetId: null,
        datasetVersion: null,
        targetType: 'agent',
        targetId: 'replay-test-agent',
        totalItems: 0,
      });

      await expect(
        runExperiment(mastra, {
          experimentId: 'pre-created-bad-source',
          data: [{ id: 'item-1', input: 'Look up first and second' }],
          targetType: 'agent',
          targetId: 'replay-test-agent',
          toolReplay: { fromExperimentId: 'does-not-exist' },
        }),
      ).rejects.toThrowError();

      const experiment = await experimentsStorage.getExperimentById({ id: 'pre-created-bad-source' });
      expect(experiment?.status).toBe('failed');
      // The async HTTP caller reads WHY from the record, not from server logs.
      expect(experiment?.metadata).toMatchObject({
        failureReason: { id: 'EXPERIMENT_TOOL_REPLAY_SOURCE_NOT_FOUND' },
      });
      expect((experiment?.metadata as { failureReason?: { message?: string } }).failureReason?.message).toContain(
        'does-not-exist',
      );
    });
  });

  describe('report survival under outer aborts', () => {
    it('keeps the divergence report when the item timeout wins the race', async () => {
      // One recorded event; the second call misses into a slow live
      // passthrough, so the item timeout deterministically wins mid-run.
      await seedRecordedTrace('rec-trace-timeout', [{ input: { key: 'first' }, output: { value: 'recorded:first' } }]);
      liveExecute.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ value: 'slow' }), 300)));

      const summary = await runExperiment(mastra, {
        data: [{ id: 'item-1', input: 'Look up first and second', replayTraceId: 'rec-trace-timeout' }],
        targetType: 'agent',
        targetId: 'replay-test-agent',
        itemTimeout: 50,
        toolReplay: { onMiss: 'passthrough' },
      });

      expect(summary.failedCount).toBe(1);
      const result = summary.results[0]!;
      expect(result.error?.message).toMatch(/timeout|abort/i);
      // The evidence survives the loss: the report reflects what happened
      // before the abort instead of disappearing with it.
      expect(result.toolReplay).toBeDefined();
      expect(result.toolReplay?.replayedCount).toBe(1);
      expect(result.toolReplay?.misses).toEqual([
        { toolName: 'lookup', action: 'passthrough', input: { key: 'second' } },
      ]);
    });
  });
});
