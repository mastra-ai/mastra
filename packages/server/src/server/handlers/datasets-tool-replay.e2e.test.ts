import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { getToolReplayMarker } from '@mastra/core/datasets';
import { Mastra } from '@mastra/core/mastra';
import { SpanType, EntityType } from '@mastra/core/observability';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import { TRIGGER_EXPERIMENT_ROUTE, GET_EXPERIMENT_ROUTE, LIST_EXPERIMENT_RESULTS_ROUTE } from './datasets';
import { createTestServerContext } from './test-utils';

/**
 * Route-level end-to-end tests for tool replay over the experiment trigger API.
 *
 * The unit tests in datasets.test.ts prove the handler forwards `toolReplay`;
 * these tests prove the forwarded config actually DRIVES replay through the
 * fire-and-forget lifecycle the API exposes:
 *
 *   POST trigger (pending) → background runExperiment with replay hooks
 *     → GET experiment until terminal status
 *     → GET results: divergence report / error codes survive the route's
 *       response serialization (the report persists in the dedicated
 *       `toolReplay` column on each result — never inside `output`)
 *
 * Edge cases covered: recording runs dry over the API (deterministic failure,
 * no retries), nonexistent fromExperimentId (async trigger reports pending,
 * then the experiment fails at setup with zero items run and the reason
 * surfaced in metadata.failureReason), onMiss: 'passthrough' mixing exactly
 * the unmatched call live, and a mock-only run (no recording) suppressing
 * live execution and stamping the experiment's replay marker.
 */

/**
 * Model that issues two same-tool calls then answers — modulo-based so every
 * run behaves identically. Exposes the call counter as an execution-side
 * signal independent of the persisted report: model-step counts distinguish
 * "replayed once, then ran dry" (the model was asked again after a replayed
 * result) from "never had a recording" (the agent never ran at all).
 */
function createTwoToolCallModel() {
  const counter = { modelCalls: 0 };
  const model = new MockLanguageModelV2({
    doGenerate: async () => {
      counter.modelCalls++;
      const step = ((counter.modelCalls - 1) % 3) + 1;
      if (step < 3) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: 'tool-call' as const,
              toolCallType: 'function' as const,
              toolCallId: `call-${counter.modelCalls}`,
              toolName: 'lookup',
              input: step === 1 ? '{"recordId":"first"}' : '{"recordId":"second"}',
            },
          ],
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text' as const, text: 'Done with lookups.' }],
      };
    },
  });
  return { model, counter };
}

describe('tool replay over the experiment trigger API (e2e)', () => {
  let storage: InMemoryStore;
  let mastra: Mastra;
  let liveCalls: number;
  let modelCounter: { modelCalls: number };
  let datasetId: string;
  let itemId: string;

  beforeEach(async () => {
    storage = new InMemoryStore();
    await storage.init();
    liveCalls = 0;

    const lookupTool = createTool({
      id: 'lookup',
      description: 'Look up a record in an external system',
      inputSchema: z.object({ recordId: z.string() }),
      execute: async ({ recordId }) => {
        liveCalls++;
        return { value: `live:${recordId}:${liveCalls}` };
      },
    });

    const { model, counter } = createTwoToolCallModel();
    modelCounter = counter;
    const agent = new Agent({
      id: 'replay-api-agent',
      name: 'Replay API Agent',
      instructions: 'Use the lookup tool.',
      model,
      tools: { lookup: lookupTool },
    });

    mastra = new Mastra({
      logger: false,
      storage,
      agents: { 'replay-api-agent': agent },
    });

    const ds = await mastra.datasets.create({ name: 'Replay API Dataset' });
    datasetId = ds.id;
    const item = await ds.addItem({ input: 'Look up first and second' });
    itemId = item.id;
  });

  /** Seed a prior experiment whose result links this dataset's item to a recorded trace. */
  async function seedRecording(traceId: string, calls: { input: unknown; output: unknown }[]) {
    const experimentsStore = await storage.getStore('experiments');
    await experimentsStore!.createExperiment({
      id: `prior-for-${traceId}`,
      datasetId,
      datasetVersion: 1,
      targetType: 'agent',
      targetId: 'replay-api-agent',
      totalItems: 1,
    });
    await experimentsStore!.addExperimentResult({
      experimentId: `prior-for-${traceId}`,
      itemId,
      itemDatasetVersion: 1,
      input: 'Look up first and second',
      output: { text: 'Done with lookups.' },
      groundTruth: null,
      error: null,
      startedAt: new Date(),
      completedAt: new Date(),
      retryCount: 0,
      traceId,
    });

    const base = Date.parse('2026-01-01T00:00:00Z');
    const observabilityStore = await storage.getStore('observability');
    await observabilityStore!.batchCreateSpans({
      records: [
        {
          traceId,
          spanId: `${traceId}-root`,
          name: "agent run: 'replay-api-agent'",
          spanType: SpanType.AGENT_RUN,
          isEvent: false,
          entityType: EntityType.AGENT,
          entityId: 'replay-api-agent',
          entityName: 'Replay API Agent',
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
          startedAt: new Date(base + 1000 * (i + 1)),
          endedAt: new Date(base + 1000 * (i + 1) + 500),
        })),
      ],
    });
    return `prior-for-${traceId}`;
  }

  /** Poll the GET experiment route until the background run reaches a terminal status. */
  async function waitForExperiment(experimentId: string) {
    const deadline = Date.now() + 10_000;
    for (;;) {
      const run = await GET_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId,
        experimentId,
      });
      if (run && (run.status === 'completed' || run.status === 'failed')) return run;
      if (Date.now() > deadline) throw new Error(`Experiment ${experimentId} did not finish: ${run?.status}`);
      await new Promise(r => setTimeout(r, 50));
    }
  }

  async function fetchResults(experimentId: string) {
    const { results } = await LIST_EXPERIMENT_RESULTS_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      datasetId,
      experimentId,
      page: 0,
      perPage: 10,
    });
    return results;
  }

  it('replays a seeded recording through the full async lifecycle without live tool calls', async () => {
    const priorExperimentId = await seedRecording('rec-api-1', [
      { input: { recordId: 'first' }, output: { value: 'recorded:first' } },
      { input: { recordId: 'second' }, output: { value: 'recorded:second' } },
    ]);

    const triggered = await TRIGGER_EXPERIMENT_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      datasetId,
      targetType: 'agent',
      targetId: 'replay-api-agent',
      toolReplay: { fromExperimentId: priorExperimentId },
    });
    expect(triggered.status).toBe('pending');

    const run = await waitForExperiment(triggered.experimentId);
    expect(run!.status).toBe('completed');
    expect(run!.succeededCount).toBe(1);
    expect(run!.failedCount).toBe(0);
    // The external world stayed frozen — no live executions during replay.
    expect(liveCalls).toBe(0);

    // Three model steps: two replayed tool results + the final answer.
    expect(modelCounter.modelCalls).toBe(3);

    // The divergence report survives the results route's response serialization
    // in the dedicated `toolReplay` column — the scored output stays clean.
    const results = await fetchResults(triggered.experimentId);
    expect(results).toHaveLength(1);
    expect(results[0]!.itemId).toBe(itemId);
    expect((results[0]!.output as { text?: string }).text).toBe('Done with lookups.');
    expect(results[0]!.output).not.toHaveProperty('toolReplay');
    expect(results[0]!.toolReplay).toMatchObject({
      sourceTraceId: 'rec-api-1',
      replayedCount: 2,
      misses: [],
      unconsumed: [],
    });
  });

  it('surfaces TOOL_REPLAY_MISS through the results route when the recording runs dry', async () => {
    // Only ONE recorded call — the agent's second lookup is a miss (onMiss defaults to 'error')
    const priorExperimentId = await seedRecording('rec-api-2', [
      { input: { recordId: 'first' }, output: { value: 'recorded:first' } },
    ]);

    const triggered = await TRIGGER_EXPERIMENT_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      datasetId,
      targetType: 'agent',
      targetId: 'replay-api-agent',
      toolReplay: { fromExperimentId: priorExperimentId },
    });

    const run = await waitForExperiment(triggered.experimentId);
    expect(run!.status).toBe('failed'); // single item, deterministic failure
    expect(run!.failedCount).toBe(1);
    expect(run!.succeededCount).toBe(0);
    expect(liveCalls).toBe(0); // the miss never fell through to a live call
    // Execution-side cross-check, independent of the persisted report: the
    // first call must have RETURNED a replayed result for the model to be
    // asked again (call 1 → replayed, call 2 → miss aborts).
    expect(modelCounter.modelCalls).toBe(2);

    const results = await fetchResults(triggered.experimentId);
    expect(results).toHaveLength(1);
    expect(results[0]!.error).toMatchObject({ code: 'TOOL_REPLAY_MISS' });
    expect(results[0]!.error!.message).toContain("Tool replay miss for 'lookup'");
    // Deterministic failure — the retry loop must not have re-run it.
    expect(results[0]!.retryCount).toBe(0);
    // Failed items keep their divergence report through the route's response
    // serialization — failures are when API consumers need it most.
    const failedReport = results[0]!.toolReplay as
      | { replayedCount: number; misses: { toolName: string }[] }
      | null
      | undefined;
    expect(failedReport?.replayedCount).toBe(1);
    expect(failedReport?.misses).toEqual([expect.objectContaining({ toolName: 'lookup' })]);
  });

  it('fails the experiment at setup when fromExperimentId does not exist', async () => {
    const triggered = await TRIGGER_EXPERIMENT_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      datasetId,
      targetType: 'agent',
      targetId: 'replay-api-agent',
      toolReplay: { fromExperimentId: 'no-such-experiment' },
    });
    expect(triggered.status).toBe('pending');

    // A nonexistent source experiment is rejected at setup, before any item
    // runs. The async trigger has already returned pending, so the API
    // surface is a terminal 'failed' experiment with zero results — and the
    // setup reason persists in `metadata.failureReason`, the only place an
    // HTTP caller can learn why the run never started.
    const run = await waitForExperiment(triggered.experimentId);
    expect(run!.status).toBe('failed');
    expect(run!.metadata?.failureReason).toMatchObject({
      id: 'EXPERIMENT_TOOL_REPLAY_SOURCE_NOT_FOUND',
      message: expect.stringContaining('no-such-experiment'),
    });
    expect(liveCalls).toBe(0);
    // The agent is never invoked at all — no item ever started.
    expect(modelCounter.modelCalls).toBe(0);

    const results = await fetchResults(triggered.experimentId);
    expect(results).toHaveLength(0);
  });

  it("onMiss: 'passthrough' executes exactly the unmatched call live and reports the miss", async () => {
    const priorExperimentId = await seedRecording('rec-api-3', [
      { input: { recordId: 'first' }, output: { value: 'recorded:first' } },
    ]);

    const triggered = await TRIGGER_EXPERIMENT_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      datasetId,
      targetType: 'agent',
      targetId: 'replay-api-agent',
      toolReplay: { fromExperimentId: priorExperimentId, onMiss: 'passthrough' },
    });

    const run = await waitForExperiment(triggered.experimentId);
    expect(run!.status).toBe('completed');
    // Exactly the second (unmatched) call hit the live tool
    expect(liveCalls).toBe(1);

    const results = await fetchResults(triggered.experimentId);
    const report = results[0]!.toolReplay as
      | { replayedCount: number; misses: { toolName: string; action: string }[] }
      | null
      | undefined;
    expect(report?.replayedCount).toBe(1);
    expect(report?.misses).toEqual([expect.objectContaining({ toolName: 'lookup', action: 'passthrough' })]);
  });

  it('runs a mock-only experiment through the async lifecycle and stamps the replay marker', async () => {
    // No recording is seeded and no toolReplay is sent — toolMocks alone must
    // suppress live execution, persist mock usage in the report column, and
    // stamp the experiment metadata so it is refused as a future replay source.
    const triggered = await TRIGGER_EXPERIMENT_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      datasetId,
      targetType: 'agent',
      targetId: 'replay-api-agent',
      toolMocks: { lookup: { output: { value: 'mocked-lookup' } } },
    });
    expect(triggered.status).toBe('pending');

    const run = await waitForExperiment(triggered.experimentId);
    expect(run!.status).toBe('completed');
    expect(run!.succeededCount).toBe(1);
    // Both of the agent's lookup calls were answered by the mock.
    expect(liveCalls).toBe(0);
    expect(modelCounter.modelCalls).toBe(3);

    // GET experiment carries the runner-stamped marker in metadata — parsed
    // here exactly the way SDK/UI consumers do.
    expect(getToolReplayMarker(run!.metadata)).toEqual({ mockedTools: ['lookup'] });

    // Mock usage accounting persists in the dedicated report column.
    const results = await fetchResults(triggered.experimentId);
    expect(results).toHaveLength(1);
    expect(results[0]!.error).toBeNull();
    const report = results[0]!.toolReplay as { mocks?: { toolName: string; calls: number; kind: string }[] } | null;
    expect(report?.mocks).toEqual([{ toolName: 'lookup', calls: 2, kind: 'output' }]);
  });
});
