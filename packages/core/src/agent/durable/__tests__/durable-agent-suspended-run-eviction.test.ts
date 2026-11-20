import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

/** First call suspends on `ask`; once resumed, the model answers with text. */
function model() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const resumed = prompt.some(message => message.role === 'tool');
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream<any>(
          resumed
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'done' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: `call-${Math.random()}`,
                  toolName: 'ask',
                  input: '{}',
                },
                { type: 'finish', finishReason: 'tool-calls', usage },
              ],
        ),
      };
    },
  });
}

function setup(storage = new InMemoryStore()) {
  const ask = createTool({
    id: 'ask',
    description: 'suspends until answered',
    inputSchema: z.object({}),
    suspendSchema: z.object({ q: z.string() }),
    resumeSchema: z.object({ a: z.string() }),
    execute: async (_input, ctx) => (ctx.agent?.resumeData ? 'ok' : ctx.agent?.suspend({ q: '?' })),
  });
  const agent = createDurableAgent({
    agent: new Agent({ id: 'a', name: 'a', instructions: 'x', model: model() as any, tools: { ask } }),
  });
  new Mastra({ storage, logger: false, agents: { a: agent } });
  const workflow = agent.getWorkflow();
  const nested = (workflow as any).steps['durable-agentic-execution'];
  return { agent, workflow, nested, storage };
}

async function suspend(agent: ReturnType<typeof setup>['agent'], runId: string) {
  const { fullStream, cleanup } = await agent.stream('hi', { runId, closeOnSuspend: true });
  for await (const _chunk of fullStream) {
    // drain to the suspension
  }
  cleanup();
}

async function storedStatus(storage: InMemoryStore, runId: string) {
  const run = await (await storage.getStore('workflows'))!.getWorkflowRunById({ runId });
  const snapshot = typeof run?.snapshot === 'string' ? JSON.parse(run.snapshot) : run?.snapshot;
  return snapshot?.status;
}

async function resumeText(agent: ReturnType<typeof setup>['agent'], runId: string) {
  const resumed = await agent.resume(runId, { a: 'yes' });
  let text = '';
  for await (const chunk of resumed.fullStream as AsyncIterable<any>) {
    if (chunk.type === 'text-delta') text += chunk.payload.text;
  }
  resumed.cleanup();
  return text;
}

describe('suspended durable runs are not kept in memory (#30774)', () => {
  it('evicts the loop and nested workflow runs once the suspension is persisted', async () => {
    const { agent, workflow, nested, storage } = setup();
    for (let i = 0; i < 5; i++) await suspend(agent, `run-${i}`);

    await expect.poll(() => workflow.runs.size).toBe(0);
    expect(nested.runs.size).toBe(0);
    expect(agent.runRegistry.size).toBe(0);
    for (let i = 0; i < 5; i++) expect(await storedStatus(storage, `run-${i}`)).toBe('suspended');
  });

  it('still resumes an evicted run in the same process', async () => {
    const { agent, workflow, storage } = setup();
    await suspend(agent, 'run-in-process');
    await expect.poll(() => workflow.runs.size).toBe(0);

    expect(await storedStatus(storage, 'run-in-process')).toBe('suspended');
    expect(await resumeText(agent, 'run-in-process')).toBe('done');
  });

  it('still resumes an evicted run from a fresh process', async () => {
    const storage = new InMemoryStore();
    const first = setup(storage);
    await suspend(first.agent, 'run-cold');
    await expect.poll(() => first.workflow.runs.size).toBe(0);

    const second = setup(storage);
    expect(await resumeText(second.agent, 'run-cold')).toBe('done');
  });

  it('evicts a run whose stream stays open across the suspension', async () => {
    const { agent, workflow, nested, storage } = setup();
    const { fullStream } = await agent.stream('hi', { runId: 'run-open' });
    const reader = (fullStream as ReadableStream<any>).getReader();
    await expect.poll(() => storedStatus(storage, 'run-open')).toBe('suspended');

    await expect.poll(() => workflow.runs.size).toBe(0);
    expect(nested.runs.size).toBe(0);
    reader.releaseLock();
  });
});

describe('releaseParkedRun', () => {
  it('releases a parked run and keeps its snapshot', async () => {
    const { agent, storage } = setup();
    const { fullStream } = await agent.stream('hi', { runId: 'run-parked' });
    const reader = (fullStream as ReadableStream<any>).getReader();
    await expect.poll(() => storedStatus(storage, 'run-parked')).toBe('suspended');
    expect(agent.runRegistry.size).toBe(1);

    expect(await agent.releaseParkedRun('run-parked')).toBe(true);
    expect(agent.runRegistry.size).toBe(0);
    expect(await storedStatus(storage, 'run-parked')).toBe('suspended');
    reader.releaseLock();
    expect(await resumeText(agent, 'run-parked')).toBe('done');
  });

  it('leaves a run alone while a resume of it is setting up', async () => {
    const { agent, storage } = setup();
    const { fullStream } = await agent.stream('hi', { runId: 'run-resuming' });
    const reader = (fullStream as ReadableStream<any>).getReader();
    await expect.poll(() => storedStatus(storage, 'run-resuming')).toBe('suspended');

    const resumed = resumeText(agent, 'run-resuming');
    expect(await agent.releaseParkedRun('run-resuming')).toBe(false);
    reader.releaseLock();
    expect(await resumed).toBe('done');
  });

  it('leaves a run alone while its resumed execution runs', async () => {
    const { agent, storage } = setup();
    const { fullStream } = await agent.stream('hi', { runId: 'run-executing' });
    const reader = (fullStream as ReadableStream<any>).getReader();
    await expect.poll(() => storedStatus(storage, 'run-executing')).toBe('suspended');

    // resume() has returned; its execution has not claimed the run yet.
    const resumed = await agent.resume('run-executing', { a: 'yes' });
    expect(await agent.releaseParkedRun('run-executing')).toBe(false);
    reader.releaseLock();
    let text = '';
    for await (const chunk of resumed.fullStream as AsyncIterable<any>) {
      if (chunk.type === 'text-delta') text += chunk.payload.text;
    }
    resumed.cleanup();
    expect(text).toBe('done');
  });
});

describe('releaseParkedRun ownership', () => {
  it('leaves a run another agent parked to that agent', async () => {
    const storage = new InMemoryStore();
    const ask = createTool({
      id: 'ask',
      description: 'suspends until answered',
      inputSchema: z.object({}),
      suspendSchema: z.object({ q: z.string() }),
      resumeSchema: z.object({ a: z.string() }),
      execute: async (_input, ctx) => (ctx.agent?.resumeData ? 'ok' : ctx.agent?.suspend({ q: '?' })),
    });
    const owner = createDurableAgent({
      agent: new Agent({ id: 'owner', name: 'owner', instructions: 'x', model: model() as any, tools: { ask } }),
    });
    const other = createDurableAgent({
      agent: new Agent({ id: 'other', name: 'other', instructions: 'x', model: model() as any, tools: { ask } }),
    });
    new Mastra({ storage, logger: false, agents: { owner, other } });
    const { fullStream } = await owner.stream('hi', { runId: 'run-owned' });
    const reader = (fullStream as ReadableStream<any>).getReader();
    await expect.poll(() => storedStatus(storage, 'run-owned')).toBe('suspended');

    expect(await other.releaseParkedRun('run-owned')).toBe(false);
    expect(owner.runRegistry.size).toBe(1);
    expect(await owner.releaseParkedRun('run-owned')).toBe(true);
    expect(owner.runRegistry.size).toBe(0);
    reader.releaseLock();
  });
});

describe('a failed recovery', () => {
  it('leaves no stream release behind', async () => {
    const { agent, workflow, storage } = setup();
    await suspend(agent, 'run-recover');
    await expect.poll(() => workflow.runs.size).toBe(0);
    const store = (await storage.getStore('workflows'))!;
    const setStatus = async (status: 'running' | 'suspended') => {
      const stored = await store.getWorkflowRunById({
        runId: 'run-recover',
        workflowName: DurableStepIds.AGENTIC_LOOP,
      });
      const snapshot = typeof stored!.snapshot === 'string' ? JSON.parse(stored!.snapshot) : stored!.snapshot;
      await store.persistWorkflowSnapshot({
        workflowName: DurableStepIds.AGENTIC_LOOP,
        runId: 'run-recover',
        snapshot: { ...snapshot, status },
      });
    };
    // A run that crashed mid-step, which recover() restarts.
    await setStatus('running');

    const getWorkflow = vi.spyOn(agent, 'getWorkflow').mockImplementationOnce(() => {
      throw new Error('workflow unavailable');
    });
    await expect(agent.recover('run-recover')).rejects.toThrow('workflow unavailable');
    getWorkflow.mockRestore();

    // Nothing of the failed recovery is held, so a release finds nothing to release.
    await setStatus('suspended');
    await expect(agent.releaseParkedRun('run-recover')).resolves.toBe(false);
  });
});
