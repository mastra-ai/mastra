/**
 * A run that suspends or finishes shortly before its `modelSettings.timeout.totalMs` deadline is
 * not a timed-out run: the caller saw it park or finish and cleared its timer, so nothing deleted
 * it. Its snapshot write may still reach storage after the deadline, and must land, or the run can
 * never be resumed. Only a run the caller deleted at the deadline stays unwritten.
 */
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
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

const TOTAL_MS = 3000;
/** Holds the loop snapshot write past the deadline whatever the machine's write latency. */
const WRITE_DELAY_MS = 400;

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

const loopSnapshot = async (runId: string) =>
  (await getSharedMastra().getStorage()!.getStore('workflows'))!.loadWorkflowSnapshot({
    workflowName: InngestDurableStepIds.AGENTIC_LOOP,
    runId,
  });

/** Delays the loop's `status` snapshot writes so they reach storage after the deadline. */
async function delayLoopWrites(status: string) {
  const workflows = (await getSharedMastra().getStorage()!.getStore('workflows'))!;
  const persist = workflows.persistWorkflowSnapshot.bind(workflows);
  return vi.spyOn(workflows, 'persistWorkflowSnapshot').mockImplementation(async params => {
    if (params.workflowName === InngestDurableStepIds.AGENTIC_LOOP && params.snapshot.status === status) {
      await new Promise(resolve => setTimeout(resolve, WRITE_DELAY_MS));
    }
    return persist(params);
  });
}

/** An agent whose `gate` tool waits until `marginMs` before the deadline, then suspends or returns. */
function buildAgent(label: string, marginMs: number, suspends: boolean) {
  let deadlineAt = 0;
  const gate = createTool({
    id: 'gate',
    description: 'Waits until just before the deadline.',
    inputSchema: z.object({}),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async (_input, context: any) => {
      if (context?.agent?.resumeData) return { approved: context.agent.resumeData.approved };
      const wait = deadlineAt - marginMs - Date.now();
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      return suspends ? context.agent.suspend({ ask: true }) : { ok: true };
    },
  });
  const agent = new Agent({
    id: `near-miss-${label}-${Date.now()}`,
    name: 'Near miss',
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

describe('a run that parks or finishes just before its deadline', () => {
  beforeAll(async () => {
    await setupSharedTestInfrastructure();
  });
  afterAll(async () => {
    await teardownSharedTestInfrastructure();
  });

  it.each([120, 60])('resumes after its tool suspended %i ms before the deadline', async marginMs => {
    const delayed = await delayLoopWrites('suspended');
    try {
      const { inngestAgent, start } = buildAgent(`suspend-${marginMs}`, marginMs, true);
      const first = await start();
      const parked = await drain(first.output.fullStream, type => type === 'tool-call-suspended');
      first.cleanup();
      expect(parked.errors, 'errors before the suspension').toEqual([]);
      expect(parked.types).toContain('tool-call-suspended');

      await vi.waitFor(async () => expect((await loopSnapshot(first.runId))?.status).toBe('suspended'), {
        timeout: TOTAL_MS + WRITE_DELAY_MS + 5000,
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

  it.each([1, 2, 3])('keeps a run that finished before the deadline as success (run %i)', async () => {
    const { start } = buildAgent('finish', 1000, false);
    const first = await start();
    const finished = await drain(first.output.fullStream, type => type === 'finish');
    first.cleanup();
    expect(finished.errors).toEqual([]);
    expect(finished.types).toContain('finish');
    await vi.waitFor(async () => expect((await loopSnapshot(first.runId))?.status).toBe('success'), {
      timeout: 5000,
      interval: 100,
    });
  });
});
