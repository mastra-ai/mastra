import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
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
 *       response serialization (output is the only place the report persists)
 *
 * Edge cases covered: recording runs dry over the API (deterministic failure,
 * no retries), nonexistent fromExperimentId (graceful per-item failure, no
 * hang), and onMiss: 'passthrough' mixing exactly the unmatched call live.
 */

/**
 * Model that issues two same-tool calls then answers — modulo-based so every
 * run behaves identically. Exposes the call counter: failed replay items don't
 * persist the divergence report, so model-step counts are how the tests
 * distinguish "replayed once, then ran dry" from "never had a recording".
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
    // (output is the only place the report persists).
    const results = await fetchResults(triggered.experimentId);
    expect(results).toHaveLength(1);
    expect(results[0]!.itemId).toBe(itemId);
    const output = results[0]!.output as {
      text?: string;
      toolReplay?: { sourceTraceId: string; replayedCount: number; misses: unknown[]; unconsumed: unknown[] };
    };
    expect(output.text).toBe('Done with lookups.');
    expect(output.toolReplay).toMatchObject({
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
    // Failed items don't persist the divergence report, so distinguish
    // "replayed once, then ran dry" from "never had a recording" by model
    // steps: the first call must have RETURNED a replayed result for the
    // model to be asked again (call 1 → replayed, call 2 → miss aborts).
    expect(modelCounter.modelCalls).toBe(2);

    const results = await fetchResults(triggered.experimentId);
    expect(results).toHaveLength(1);
    expect(results[0]!.error).toMatchObject({ code: 'TOOL_REPLAY_MISS' });
    expect(results[0]!.error!.message).toContain("Tool replay miss for 'lookup'");
    // Deterministic failure — the retry loop must not have re-run it.
    expect(results[0]!.retryCount).toBe(0);
  });

  it('fails items gracefully when fromExperimentId does not exist', async () => {
    const triggered = await TRIGGER_EXPERIMENT_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      datasetId,
      targetType: 'agent',
      targetId: 'replay-api-agent',
      toolReplay: { fromExperimentId: 'no-such-experiment' },
    });
    expect(triggered.status).toBe('pending');

    // No recording resolves for any item → the item fails BEFORE the agent
    // runs (replay never executes an item silently live). The run must
    // terminate (no hang) and report a structured error.
    const run = await waitForExperiment(triggered.experimentId);
    expect(run!.status).toBe('failed');
    expect(run!.failedCount).toBe(1);
    expect(liveCalls).toBe(0);
    // Counterpart to the dry-recording test: with NO recording the agent is
    // never invoked at all, while a partial recording reaches the model.
    expect(modelCounter.modelCalls).toBe(0);

    const results = await fetchResults(triggered.experimentId);
    expect(results).toHaveLength(1);
    expect(results[0]!.error).toMatchObject({ code: 'TOOL_REPLAY_NO_RECORDING' });
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
    const output = results[0]!.output as {
      toolReplay?: { replayedCount: number; misses: { toolName: string; action: string }[] };
    };
    expect(output.toolReplay?.replayedCount).toBe(1);
    expect(output.toolReplay?.misses).toEqual([expect.objectContaining({ toolName: 'lookup', action: 'passthrough' })]);
  });
});
