import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { runExperiment } from '@mastra/core/datasets';
import { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import { MockStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { Observability } from './default';
import { MastraStorageExporter } from './exporters';

/**
 * True end-to-end tests for dataset experiment tool replay (issue #17466).
 *
 * Unlike the unit/integration tests in @mastra/core (which seed synthetic
 * span records), these tests exercise the REAL data flow:
 *
 *   record experiment (live tools, real tracing pipeline)
 *     → AGENT_RUN / TOOL_CALL spans emitted by CoreToolBuilder
 *     → SensitiveDataFilter span processor (applied by default)
 *     → MastraStorageExporter batches them into the observability store
 *     → experiment result persists the run's traceId per item
 *   replay experiment (toolReplay.fromExperimentId)
 *     → itemId → traceId map from prior results
 *     → getTrace() → extractToolReplayEvents() over genuinely recorded spans
 *     → beforeToolCall hook short-circuits with recorded outputs
 *
 * If the tracing pipeline ever changes the recorded span shape (entity
 * fields, payload placement, redaction behavior), these tests fail — the
 * synthetic fixtures in core cannot catch that.
 */

/**
 * Model that issues `inputs.length` tool-call steps then a final answer.
 * Uses modulo so it behaves identically across record and replay runs.
 */
function createToolCallingModel(toolName: string, inputs: string[]) {
  let modelCalls = 0;
  const stepsPerRun = inputs.length + 1;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      modelCalls++;
      const step = ((modelCalls - 1) % stepsPerRun) + 1;
      if (step <= inputs.length) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: 'tool-call' as const,
              toolCallType: 'function' as const,
              toolCallId: `call-${modelCalls}`,
              toolName,
              input: inputs[step - 1]!,
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
}

function createTracedMastra(agent: Agent) {
  const storage = new MockStore();
  const storageExporter = new MastraStorageExporter({
    // Keep batching real but fast — the tests flush explicitly below,
    // mirroring what production relies on between record and replay.
    maxBatchWaitMs: 50,
  });
  const mastra = new Mastra({
    storage,
    agents: { [agent.id]: agent },
    logger: false,
    observability: new Observability({
      configs: {
        default: {
          serviceName: 'tool-replay-e2e',
          exporters: [storageExporter],
        },
      },
    }),
  });
  return { mastra, storage, storageExporter };
}

describe('tool replay end-to-end through the real tracing pipeline', () => {
  it('records a live run via the storage exporter and replays it without touching live tools', async () => {
    // The "external world": replay must freeze it.
    let liveCalls = 0;

    const lookupTool = createTool({
      id: 'lookup',
      description: 'Look up a record in an external system',
      inputSchema: z.object({ recordId: z.string() }),
      execute: async ({ recordId }) => {
        liveCalls++;
        return { value: `live:${recordId}:${liveCalls}` };
      },
    });

    const agent = new Agent({
      id: 'replay-e2e-agent',
      name: 'Replay E2E Agent',
      instructions: 'Use the lookup tool.',
      model: createToolCallingModel('lookup', ['{"recordId":"first"}', '{"recordId":"second"}']),
      tools: { lookup: lookupTool },
    });

    const { mastra, storage, storageExporter } = createTracedMastra(agent);

    // ── 1. Record: live run through the real tracing pipeline ──────────────
    const recorded = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Look up first and second' }],
      targetType: 'agent',
      targetId: 'replay-e2e-agent',
    });

    expect(recorded.succeededCount).toBe(1);
    expect(liveCalls).toBe(2); // live tools executed — the issue's baseline

    const recordedTraceId = (recorded.results[0]?.output as { traceId?: string }).traceId;
    expect(recordedTraceId).toBeTruthy();

    // Spans are exported asynchronously (batched) — drain the exporter so the
    // recording is durable before replaying, as production traces would be.
    await storageExporter.flush();

    // ── 2. Validate the REAL recorded span shape the extractor depends on ──
    const observabilityStore = await storage.getStore('observability');
    const trace = await observabilityStore!.getTrace({ traceId: recordedTraceId! });
    expect(trace).toBeTruthy();

    const toolSpans = trace!.spans.filter(s => s.spanType === SpanType.TOOL_CALL && !s.isEvent);
    expect(toolSpans).toHaveLength(2);
    for (const span of toolSpans) {
      // entityName/entityId carry the tool name (extractToolReplayEvents contract)
      expect(span.entityName ?? span.entityId).toBe('lookup');
      // payloads are the raw args/result, not wrapped
      expect(span.input).toMatchObject({ recordId: expect.any(String) });
      expect(span.output).toMatchObject({ value: expect.stringMatching(/^live:/) });
      expect(span.parentSpanId).toBeTruthy();
    }

    // ── 3. Replay: from the prior experiment, no live tool executions ──────
    const replayed = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Look up first and second' }],
      targetType: 'agent',
      targetId: 'replay-e2e-agent',
      toolReplay: { fromExperimentId: recorded.experimentId },
    });

    expect(replayed.results[0]?.error).toBeNull();
    expect(replayed.succeededCount).toBe(1);
    // The external world stayed frozen.
    expect(liveCalls).toBe(2);

    const report = replayed.results[0]?.toolReplay;
    expect(report).toMatchObject({
      sourceTraceId: recordedTraceId,
      totalRecorded: 2,
      replayedCount: 2,
      misses: [],
      unconsumed: [],
      argMismatches: [],
    });

    // The agent saw the RECORDED observations (live:…:1 / live:…:2), and the
    // replay run completed on them.
    const output = replayed.results[0]?.output as { text?: string; toolResults?: unknown[] };
    expect(output.text).toBe('Done with lookups.');
    const serializedResults = JSON.stringify(output.toolResults);
    expect(serializedResults).toContain('live:first:1');
    expect(serializedResults).toContain('live:second:2');

    // ── 4. The replay run's own trace shows the served calls as SYNTHETIC
    // tool spans — named like live ones, flagged toolReplay.synthetic ────────
    await storageExporter.flush();
    const replayTraceId = (replayed.results[0]?.output as { traceId?: string }).traceId;
    expect(replayTraceId).toBeTruthy();
    const replayTrace = await observabilityStore!.getTrace({ traceId: replayTraceId! });
    const syntheticSpans = replayTrace!.spans.filter(s => s.spanType === SpanType.TOOL_CALL && !s.isEvent);
    expect(syntheticSpans).toHaveLength(2);
    for (const span of syntheticSpans) {
      expect(span.name).toBe("tool: 'lookup'");
      expect(span.entityName ?? span.entityId).toBe('lookup');
      const marker = (span.metadata as { toolReplay?: Record<string, unknown> })?.toolReplay;
      expect(marker?.synthetic).toBe(true);
      expect(marker?.outcome).toBe('replayed');
      // The span carries the served observation, so the timeline stays readable.
      expect(span.output).toMatchObject({ value: expect.stringMatching(/^live:/) });
      expect(span.parentSpanId).toBeTruthy();
    }
    const sequences = syntheticSpans
      .map(s => (s.metadata as { toolReplay: { sequence: number } }).toolReplay.sequence)
      .sort();
    expect(sequences).toEqual([0, 1]);

    // ── 5. Synthetic spans can never serve as a recording: chaining a replay
    // directly at the replay run's trace finds zero events and all-misses ───
    const chained = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Look up first and second', replayTraceId: replayTraceId! }],
      targetType: 'agent',
      targetId: 'replay-e2e-agent',
      toolReplay: {},
    });
    expect(chained.failedCount).toBe(1);
    expect(chained.results[0]?.error?.code).toBe('TOOL_REPLAY_MISS');
    expect(chained.results[0]?.toolReplay?.totalRecorded).toBe(0);
    expect(liveCalls).toBe(2); // the external world stayed frozen throughout
  });

  it('fails a replay miss with the report and trace link intact through real persistence', async () => {
    let liveCalls = 0;
    const makeLookupTool = () =>
      createTool({
        id: 'lookup',
        description: 'Look up a record in an external system',
        inputSchema: z.object({ recordId: z.string() }),
        execute: async ({ recordId }) => {
          liveCalls++;
          return { value: `live:${recordId}` };
        },
      });

    // The recorder makes ONE tool call; the replayer makes TWO — its second
    // call has no recorded event and must miss.
    const recorderAgent = new Agent({
      id: 'replay-miss-recorder',
      name: 'Replay Miss Recorder',
      instructions: 'Use the lookup tool.',
      model: createToolCallingModel('lookup', ['{"recordId":"first"}']),
      tools: { lookup: makeLookupTool() },
    });
    const replayerAgent = new Agent({
      id: 'replay-miss-replayer',
      name: 'Replay Miss Replayer',
      instructions: 'Use the lookup tool.',
      model: createToolCallingModel('lookup', ['{"recordId":"first"}', '{"recordId":"second"}']),
      tools: { lookup: makeLookupTool() },
    });

    const storage = new MockStore();
    const storageExporter = new MastraStorageExporter({ maxBatchWaitMs: 50 });
    const mastra = new Mastra({
      storage,
      agents: { [recorderAgent.id]: recorderAgent, [replayerAgent.id]: replayerAgent },
      logger: false,
      observability: new Observability({
        configs: { default: { serviceName: 'tool-replay-e2e', exporters: [storageExporter] } },
      }),
    });

    const recorded = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Look up first' }],
      targetType: 'agent',
      targetId: 'replay-miss-recorder',
    });
    expect(recorded.succeededCount).toBe(1);
    expect(liveCalls).toBe(1);
    await storageExporter.flush();

    const replayed = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Look up first and second' }],
      targetType: 'agent',
      targetId: 'replay-miss-replayer',
      toolReplay: { fromExperimentId: recorded.experimentId },
    });

    expect(replayed.failedCount).toBe(1);
    expect(liveCalls).toBe(1); // the miss never executed live
    const result = replayed.results[0]!;
    expect(result.error?.code).toBe('TOOL_REPLAY_MISS');
    expect(result.toolReplay?.replayedCount).toBe(1);
    expect(result.toolReplay?.misses).toHaveLength(1);

    // The failed item stays debuggable over the API: the persisted row keeps
    // both the divergence report and the replay run's trace link.
    const experimentsStore = await storage.getStore('experiments');
    const persisted = await experimentsStore!.listExperimentResults({
      experimentId: replayed.experimentId,
      pagination: { page: 0, perPage: false },
    });
    const row = persisted.results[0]!;
    expect(row.toolReplay?.misses).toHaveLength(1);
    expect(row.traceId).toBeTruthy();
    await storageExporter.flush();
    const observabilityStore = await storage.getStore('observability');
    const missTrace = await observabilityStore!.getTrace({ traceId: row.traceId! });
    expect(missTrace?.spans.length).toBeGreaterThan(0);
  });

  it('a mock run records flagged synthetic tool spans and its trace can never serve as a recording', async () => {
    let liveCalls = 0;
    const lookupTool = createTool({
      id: 'lookup',
      description: 'Look up a record in an external system',
      inputSchema: z.object({ recordId: z.string() }),
      execute: async ({ recordId }) => {
        liveCalls++;
        return { value: `live:${recordId}` };
      },
    });
    const agent = new Agent({
      id: 'mock-e2e-agent',
      name: 'Mock E2E Agent',
      instructions: 'Use the lookup tool.',
      model: createToolCallingModel('lookup', ['{"recordId":"first"}']),
      tools: { lookup: lookupTool },
    });
    const { mastra, storage, storageExporter } = createTracedMastra(agent);

    const mocked = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Look up first' }],
      targetType: 'agent',
      targetId: 'mock-e2e-agent',
      toolMocks: { lookup: { output: { value: 'stubbed' } } },
    });
    expect(mocked.succeededCount).toBe(1);
    expect(liveCalls).toBe(0);
    await storageExporter.flush();

    // The mock run's own trace shows the stubbed call as a synthetic span.
    const mockTraceId = (mocked.results[0]?.output as { traceId?: string }).traceId;
    expect(mockTraceId).toBeTruthy();
    const observabilityStore = await storage.getStore('observability');
    const trace = await observabilityStore!.getTrace({ traceId: mockTraceId! });
    const toolSpans = trace!.spans.filter(s => s.spanType === SpanType.TOOL_CALL && !s.isEvent);
    expect(toolSpans).toHaveLength(1);
    expect(toolSpans[0]!.name).toBe("tool: 'lookup'");
    expect(toolSpans[0]!.output).toEqual({ value: 'stubbed' });
    expect(toolSpans[0]!.metadata).toMatchObject({ toolReplay: { synthetic: true, outcome: 'mocked' } });

    // Pointing a replay at the mock run's trace finds zero replayable events.
    const chained = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Look up first', replayTraceId: mockTraceId! }],
      targetType: 'agent',
      targetId: 'mock-e2e-agent',
      toolReplay: {},
    });
    expect(chained.failedCount).toBe(1);
    expect(chained.results[0]?.error?.code).toBe('TOOL_REPLAY_MISS');
    expect(chained.results[0]?.toolReplay?.totalRecorded).toBe(0);
    expect(liveCalls).toBe(0); // the stub answered; live tools never ran
  });

  it('replays redacted recordings: sensitive fields are [REDACTED] in spans and replay returns them as recorded', async () => {
    // The default Observability config applies a SensitiveDataFilter to span
    // payloads (fields like apiKey, token, secret, key, ...). Recordings are
    // therefore REDACTED recordings: redacted inputs surface as argMismatches
    // (diagnostic only — matching is order-based), and redacted outputs replay
    // as '[REDACTED]' values. This test pins that production behavior.
    let liveCalls = 0;

    const authTool = createTool({
      id: 'fetchCredential',
      description: 'Fetch a credential from a vault',
      inputSchema: z.object({ apiKey: z.string() }),
      outputSchema: z.object({ token: z.string(), expiresIn: z.number() }),
      execute: async () => {
        liveCalls++;
        return { token: 'super-secret-token', expiresIn: 3600 };
      },
    });

    const agent = new Agent({
      id: 'replay-redaction-agent',
      name: 'Replay Redaction Agent',
      instructions: 'Use the credential tool.',
      model: createToolCallingModel('fetchCredential', ['{"apiKey":"ak-123"}']),
      tools: { fetchCredential: authTool },
    });

    const { mastra, storage, storageExporter } = createTracedMastra(agent);

    const recorded = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Fetch the credential' }],
      targetType: 'agent',
      targetId: 'replay-redaction-agent',
    });
    expect(recorded.succeededCount).toBe(1);
    expect(liveCalls).toBe(1);
    await storageExporter.flush();

    // The REAL recorded span is redacted by the SensitiveDataFilter.
    const recordedTraceId = (recorded.results[0]?.output as { traceId?: string }).traceId!;
    const observabilityStore = await storage.getStore('observability');
    const trace = await observabilityStore!.getTrace({ traceId: recordedTraceId });
    const toolSpan = trace!.spans.find(s => s.spanType === SpanType.TOOL_CALL);
    expect(toolSpan?.input).toEqual({ apiKey: '[REDACTED]' });
    expect(toolSpan?.output).toEqual({ token: '[REDACTED]', expiresIn: 3600 });

    const replayed = await runExperiment(mastra, {
      data: [{ id: 'item-1', input: 'Fetch the credential' }],
      targetType: 'agent',
      targetId: 'replay-redaction-agent',
      toolReplay: { fromExperimentId: recorded.experimentId },
    });

    expect(replayed.succeededCount).toBe(1);
    expect(liveCalls).toBe(1); // still frozen

    const report = replayed.results[0]?.toolReplay;
    expect(report?.replayedCount).toBe(1);
    expect(report?.misses).toEqual([]);
    // Redacted input ≠ live args → flagged as an arg mismatch (diagnostic only)
    expect(report?.argMismatches).toHaveLength(1);

    // The agent received the redacted output — replay returns recordings as-is.
    const output = replayed.results[0]?.output as { toolResults?: unknown[] };
    const serializedResults = JSON.stringify(output.toolResults);
    expect(serializedResults).toContain('[REDACTED]');
    expect(serializedResults).not.toContain('super-secret-token');
  });
});
