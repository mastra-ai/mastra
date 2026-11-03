/**
 * ClickHouse, Cloudflare D1, KV and DO, and LanceDB throw from `updateWorkflowState`. The worker's
 * snapshot writes after a run's `modelSettings.timeout.totalMs` deadline must still work on them:
 * a timed-out run ends its root spans once as `limit / timeout` and stays deleted, and a run that
 * parked just before the deadline keeps its suspended snapshot so it can be resumed.
 */
import { Agent } from '@mastra/core/agent';
import type { TracingEvent } from '@mastra/core/observability';
import { createTool } from '@mastra/core/tools';
import { BaseExporter, Observability } from '@mastra/observability';
import { simulateReadableStream } from 'ai';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createInngestAgent } from '../durable-agent';
import { InngestDurableStepIds } from '../durable-agent/create-inngest-agentic-workflow';
import {
  getSharedInngest,
  getSharedMastra,
  setupSharedTestInfrastructure,
  teardownSharedTestInfrastructure,
} from './durable-agent.test.utils';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 90_000 });

const TOTAL_MS = 4000;
/** How long the timed-out tool keeps running after the deadline, as a slow upstream call does. */
const TOOL_AFTER_DEADLINE_MS = 1000;
/** The parked run's tool suspends this long before the deadline, so the caller sees the suspension first. */
const SUSPEND_MARGIN_MS = 600;
/** Holds the nested iteration's suspended snapshot past the deadline, so the loop's writes follow it. */
const NESTED_WRITE_DELAY_MS = 1000;

interface SpanEnd {
  type: string;
  spanId: string;
  runId?: string;
  outcome: unknown;
  stopReason: unknown;
}

const ends: SpanEnd[] = [];

class MemoryExporter extends BaseExporter {
  name = 'memory-span-ends';
  constructor() {
    super({});
  }
  async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (event.type !== 'span_ended' || !event.exportedSpan) return;
    const span = event.exportedSpan;
    ends.push({
      type: span.type,
      spanId: span.id,
      runId: span.metadata?.runId as string | undefined,
      outcome: span.outcome ?? null,
      stopReason: span.stopReason ?? null,
    });
  }
}

/** Calls `gate` first, then answers. */
function gateThenTextModel(): any {
  let calls = 0;
  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'mock-model',
    supportedUrls: {},
    async doStream() {
      const first = calls++ === 0;
      const chunks = first
        ? [
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'r0', modelId: 'mock-model', timestamp: new Date(0) },
            { type: 'tool-call', toolCallId: 'call-0', toolName: 'gate', input: '{}', providerExecuted: false },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ]
        : [
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'r1', modelId: 'mock-model', timestamp: new Date(0) },
            { type: 'text-start', id: 't1' },
            { type: 'text-delta', id: 't1', delta: 'done' },
            { type: 'text-end', id: 't1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ];
      return {
        stream: simulateReadableStream({ chunks: chunks as any }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}

async function drain(stream: AsyncIterable<any>, stopAt: (type: string) => boolean) {
  const types: string[] = [];
  const errors: string[] = [];
  for await (const chunk of stream) {
    types.push(chunk?.type);
    if (chunk?.type === 'error') errors.push(String(chunk.payload?.error?.message ?? chunk.payload));
    if (stopAt(chunk?.type)) break;
  }
  return { types, errors };
}

const workflowsStore = async () => (await getSharedMastra().getStorage()!.getStore('workflows'))!;

const loopSnapshot = async (runId: string) =>
  (await workflowsStore()).loadWorkflowSnapshot({ workflowName: InngestDurableStepIds.AGENTIC_LOOP, runId });

/**
 * An agent whose `gate` tool waits until `at` ms before the deadline (after it when negative),
 * then suspends when `suspends` is set and returns otherwise.
 */
function buildAgent(label: string, at: number, suspends: boolean) {
  let deadlineAt = 0;
  const gate = createTool({
    id: 'gate',
    description: 'Waits, then suspends or returns.',
    inputSchema: z.object({}),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async (_input, context: any) => {
      if (context?.agent?.resumeData) return { approved: context.agent.resumeData.approved };
      const wait = deadlineAt - at - Date.now();
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      return suspends ? context.agent.suspend({ ask: true }) : { ok: true };
    },
  });
  const agent = new Agent({
    id: `unsupported-update-${label}-${Date.now()}`,
    name: 'Unsupported update',
    instructions: 'Call gate.',
    model: gateThenTextModel(),
    tools: { gate },
  });
  const inngestAgent = createInngestAgent({ agent, inngest: getSharedInngest() });
  getSharedMastra().addAgent(inngestAgent);
  return {
    inngestAgent,
    start: () => {
      deadlineAt = Date.now() + TOTAL_MS;
      return inngestAgent.stream([{ role: 'user', content: 'go' }], {
        modelSettings: { timeout: { totalMs: TOTAL_MS } },
      });
    },
  };
}

/**
 * Delays the nested iteration's `suspended` snapshot writes. The loop's own writes come after the
 * nested iteration returns, so they reach the engine after the deadline on every machine.
 */
async function delayNestedSuspendedWrites() {
  const store = await workflowsStore();
  const persist = store.persistWorkflowSnapshot.bind(store);
  return vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async params => {
    if (params.workflowName === InngestDurableStepIds.AGENTIC_EXECUTION && params.snapshot.status === 'suspended') {
      await new Promise(resolve => setTimeout(resolve, NESTED_WRITE_DELAY_MS));
    }
    return persist(params);
  });
}

describe('a workflows store whose updateWorkflowState throws', () => {
  beforeAll(async () => {
    await setupSharedTestInfrastructure({
      observability: new Observability({
        configs: { default: { serviceName: 'unsupported-update', exporters: [new MemoryExporter()] } },
      }),
    });
    const store = await workflowsStore();
    vi.spyOn(store, 'supportsConcurrentUpdates').mockReturnValue(false);
    vi.spyOn(store, 'updateWorkflowState').mockRejectedValue(
      new Error('updateWorkflowState is not implemented for this storage.'),
    );
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await teardownSharedTestInfrastructure();
  });

  it('ends a timed-out run once as limit / timeout and leaves it deleted', async () => {
    const { start } = buildAgent('timeout', -TOOL_AFTER_DEADLINE_MS, false);
    const result = await start();
    const { errors } = await drain(result.output.fullStream, () => false);
    result.cleanup();
    expect(errors, 'the caller sees the deadline').toEqual([
      `Agent execution timed out after ${TOTAL_MS}ms (modelSettings.timeout.totalMs)`,
    ]);

    const rootEnds = () =>
      ends.filter(end => end.runId === result.runId && ['agent_run', 'model_generation'].includes(end.type));
    await vi.waitFor(() => expect(rootEnds().map(end => end.type)).toContain('agent_run'), {
      timeout: TOOL_AFTER_DEADLINE_MS + 20_000,
      interval: 250,
    });
    // Give a worker that would end a span again, or persist again, time to do so.
    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(
      rootEnds()
        .map(end => `${end.type}:${end.outcome}/${end.stopReason}`)
        .sort(),
      'one end per root span',
    ).toEqual(['agent_run:limit/timeout', 'model_generation:limit/timeout']);
    expect(await loopSnapshot(result.runId), 'the run the caller deleted at the deadline stays deleted').toBeNull();
  });

  it('keeps a run that suspended just before the deadline resumable', async () => {
    const { inngestAgent, start } = buildAgent('suspend', SUSPEND_MARGIN_MS, true);
    const delayed = await delayNestedSuspendedWrites();
    try {
      const first = await start();
      const parked = await drain(first.output.fullStream, type => type === 'tool-call-suspended');
      first.cleanup();
      expect(parked.errors, 'errors before the suspension').toEqual([]);
      expect(parked.types).toContain('tool-call-suspended');

      await vi.waitFor(async () => expect((await loopSnapshot(first.runId))?.status).toBe('suspended'), {
        timeout: TOTAL_MS + 10_000,
        interval: 100,
      });

      const resumed = await inngestAgent.resume(first.runId, { approved: true });
      const finished = await drain(resumed.output.fullStream, type => type === 'finish');
      resumed.cleanup();
      expect(finished.errors).toEqual([]);
      expect(finished.types).toContain('finish');
    } finally {
      delayed.mockRestore();
    }
  });
});
