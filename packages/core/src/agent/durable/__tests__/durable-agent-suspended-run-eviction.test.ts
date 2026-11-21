import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { getRunRegistryEntry } from '../run-registry';

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
  const mastra = new Mastra({ storage, logger: false, agents: { a: agent } });
  const workflow = agent.getWorkflow();
  const nested = (workflow as any).steps['durable-agentic-execution'];
  return { agent, workflow, nested, storage, mastra };
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

  it("leaves the parked owner's global entry to an agent that only observes the run", async () => {
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
      agent: new Agent({ id: 'a', name: 'a', instructions: 'x', model: model() as any, tools: { ask } }),
    });
    const observer = createDurableAgent({
      agent: new Agent({ id: 'a', name: 'a', instructions: 'x', model: model() as any, tools: { ask } }),
    });
    const mastra = new Mastra({ storage, logger: false, agents: { owner, observer } });
    const { fullStream } = await owner.stream('hi', { runId: 'run-observed' });
    const reader = (fullStream as ReadableStream<any>).getReader();
    await expect.poll(() => storedStatus(storage, 'run-observed')).toBe('suspended');
    const ownerEntry = getRunRegistryEntry('run-observed', mastra);
    expect(ownerEntry?.executionFence).toBe(owner.runRegistry.get('run-observed')?.executionFence);

    const observed = await observer.observe('run-observed');
    expect(observer.runRegistry.size).toBe(0);
    // An observer holds no run, so it has nothing to release.
    expect(await observer.releaseParkedRun('run-observed')).toBe(false);
    expect(getRunRegistryEntry('run-observed', mastra)).toBe(ownerEntry);
    // Nor does ending the observation take the owner's entry with it.
    observed.cleanup();
    expect(getRunRegistryEntry('run-observed', mastra)).toBe(ownerEntry);

    expect(owner.runRegistry.size).toBe(1);
    expect(await owner.releaseParkedRun('run-observed')).toBe(true);
    expect(getRunRegistryEntry('run-observed', mastra)).toBeUndefined();
    reader.releaseLock();
  });
});

describe('releaseParkedRun on an agent that both runs and observes a run', () => {
  it('releases the run and its entry', async () => {
    const { agent, storage, mastra } = setup();
    const { fullStream } = await agent.stream('hi', { runId: 'run-self-observed' });
    const reader = (fullStream as ReadableStream<any>).getReader();
    await expect.poll(() => storedStatus(storage, 'run-self-observed')).toBe('suspended');
    await agent.observe('run-self-observed');

    expect(await agent.releaseParkedRun('run-self-observed')).toBe(true);
    expect(agent.runRegistry.size).toBe(0);
    expect(getRunRegistryEntry('run-self-observed', mastra)).toBeUndefined();
    reader.releaseLock();
  });
});

describe('an observer that stops watching', () => {
  it('leaves no stream release behind after it detaches', async () => {
    const { agent, workflow, storage } = setup();
    await suspend(agent, 'run-detached');
    await agent.releaseParkedRun('run-detached');
    expect(workflow.runs.size).toBe(0);

    const observed = await agent.observe('run-detached');
    observed.detach();

    expect(await agent.releaseParkedRun('run-detached')).toBe(false);
    expect(await storedStatus(storage, 'run-detached')).toBe('suspended');
  });

  it('leaves no stream release behind when its setup fails', async () => {
    const { agent, workflow } = setup();
    await suspend(agent, 'run-observe-fails');
    await agent.releaseParkedRun('run-observe-fails');
    expect(workflow.runs.size).toBe(0);

    const getStorage = vi.spyOn(agent.getMastraInstance()!, 'getStorage').mockImplementationOnce(() => {
      throw new Error('storage unavailable');
    });
    await expect(agent.observe('run-observe-fails')).rejects.toThrow('storage unavailable');
    getStorage.mockRestore();

    expect(await agent.releaseParkedRun('run-observe-fails')).toBe(false);
  });
});

describe('a failed recovery', () => {
  it('leaves no stream release behind', async () => {
    const { agent, workflow, storage } = setup();
    await suspend(agent, 'run-recover');
    await agent.releaseParkedRun('run-recover');
    expect(workflow.runs.size).toBe(0);
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

describe('releaseParkedRun beside a successor execution', () => {
  it("leaves the global entry of another instance's later execution in place", async () => {
    const storage = new InMemoryStore();
    const ask = createTool({
      id: 'ask',
      description: 'suspends until answered',
      inputSchema: z.object({}),
      suspendSchema: z.object({ q: z.string() }),
      resumeSchema: z.object({ a: z.string() }),
      execute: async (_input, ctx) => (ctx.agent?.resumeData ? 'ok' : ctx.agent?.suspend({ q: '?' })),
    });
    // Asks again after every answer, so a resume parks the run once more.
    const asksForever = () =>
      new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream<any>([
            { type: 'stream-start', warnings: [] },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: `call-${Math.random()}`,
              toolName: 'ask',
              input: '{}',
            },
            { type: 'finish', finishReason: 'tool-calls', usage },
          ]),
        }),
      });
    const older = createDurableAgent({
      agent: new Agent({ id: 'a', name: 'a', instructions: 'x', model: asksForever() as any, tools: { ask } }),
    });
    const newer = createDurableAgent({
      agent: new Agent({ id: 'a', name: 'a', instructions: 'x', model: asksForever() as any, tools: { ask } }),
    });
    const mastra = new Mastra({ storage, logger: false, agents: { older, newer } });
    const { fullStream } = await older.stream('hi', { runId: 'run-successor' });
    const reader = (fullStream as ReadableStream<any>).getReader();
    await expect.poll(() => storedStatus(storage, 'run-successor')).toBe('suspended');

    const resumed = await newer.resume('run-successor', { a: 'yes' }, { closeOnSuspend: true });
    for await (const _chunk of resumed.fullStream as AsyncIterable<any>) {
      // drain to the next suspension
    }
    await expect.poll(() => storedStatus(storage, 'run-successor')).toBe('suspended');
    const successorEntry = getRunRegistryEntry('run-successor', mastra);
    expect(successorEntry?.executionFence).toBe(newer.runRegistry.get('run-successor')?.executionFence);

    expect(await older.releaseParkedRun('run-successor')).toBe(true);
    expect(older.runRegistry.size).toBe(0);
    expect(getRunRegistryEntry('run-successor', mastra)).toBe(successorEntry);
    reader.releaseLock();
    resumed.cleanup();
  });
});

describe('an observer ended by a bare idle timeout', () => {
  async function parkedAndReleased(runId: string) {
    const { agent, workflow } = setup();
    await suspend(agent, runId);
    await agent.releaseParkedRun(runId);
    expect(workflow.runs.size).toBe(0);
    return agent;
  }

  it('leaves no stream release behind when nothing reads it', async () => {
    const agent = await parkedAndReleased('run-idle');
    const onError = vi.fn();
    await agent.observe('run-idle', { idleTimeoutMs: 20, onError });
    await expect.poll(() => onError.mock.calls.length).toBe(1);

    expect(await agent.releaseParkedRun('run-idle')).toBe(false);
  });

  it('leaves no stream release behind when the timeout fires before observe() returns', async () => {
    const { agent, workflow, storage } = setup();
    await suspend(agent, 'run-idle-early');
    await agent.releaseParkedRun('run-idle-early');
    expect(workflow.runs.size).toBe(0);
    // observe()'s last setup read (the completion check) waits until the idle timeout has fired,
    // so the timeout always lands before observe() returns.
    let idled!: () => void;
    const idleFired = new Promise<void>(resolve => (idled = resolve));
    const onError = vi.fn(() => idled());
    let gatedReads = 0;
    const getStore = storage.getStore.bind(storage);
    const gated = vi.spyOn(storage, 'getStore').mockImplementation(async (...args: any[]) => {
      if (new Error().stack?.includes('isObservationComplete')) {
        gatedReads++;
        await idleFired;
      }
      return (getStore as any)(...args);
    });
    try {
      await agent.observe('run-idle-early', { idleTimeoutMs: 5, onError });
    } finally {
      gated.mockRestore();
    }
    expect(gatedReads).toBeGreaterThan(0);
    expect(onError).toHaveBeenCalledTimes(1);

    expect(await agent.releaseParkedRun('run-idle-early')).toBe(false);
  });

  it('leaves no stream release behind when its caller awaits output.text', async () => {
    const agent = await parkedAndReleased('run-idle-text');
    const observed = await agent.observe('run-idle-text', { idleTimeoutMs: 20 });
    await observed.output.text.catch(() => undefined);

    expect(await agent.releaseParkedRun('run-idle-text')).toBe(false);
  });

  it('leaves no stream release behind when its caller reads fullStream', async () => {
    const agent = await parkedAndReleased('run-idle-stream');
    const observed = await agent.observe('run-idle-stream', { idleTimeoutMs: 20 });
    for await (const _chunk of observed.fullStream as AsyncIterable<any>) {
      // ends with the idle timeout's error chunk
    }

    expect(await agent.releaseParkedRun('run-idle-stream')).toBe(false);
  });
});

describe('releaseParkedRun on the evented engine', () => {
  it('drops the parked run from the workflow run map when it reports a release', async () => {
    const storage = new InMemoryStore();
    const ask = createTool({
      id: 'ask',
      description: 'suspends until answered',
      inputSchema: z.object({}),
      suspendSchema: z.object({ q: z.string() }),
      resumeSchema: z.object({ a: z.string() }),
      execute: async (_input, ctx) => (ctx.agent?.resumeData ? 'ok' : ctx.agent?.suspend({ q: '?' })),
    });
    const agent = createEventedAgent({
      agent: new Agent({ id: 'ev', name: 'ev', instructions: 'x', model: model() as any, tools: { ask } }),
    });
    new Mastra({ storage, logger: false, agents: { agent } });
    const workflow = agent.getWorkflow();
    // Hold the run's start result back, as when the worker's finish event has not reached this process yet.
    let deliverResult!: () => void;
    const resultDelivered = new Promise<void>(resolve => (deliverResult = resolve));
    const engine = (workflow as any).executionEngine;
    const execute = engine.execute.bind(engine);
    vi.spyOn(engine, 'execute').mockImplementation(async (...args: any[]) => {
      const result = await execute(...args);
      await resultDelivered;
      return result;
    });
    const { fullStream } = await agent.stream('hi', { runId: 'run-evented' });
    const reader = (fullStream as ReadableStream<any>).getReader();
    await expect.poll(() => storedStatus(storage, 'run-evented')).toBe('suspended');
    await expect.poll(() => workflow.runs.size).toBe(1);

    const parked = workflow.runs.get('run-evented')!;
    expect(parked.workflowRunStatus).not.toBe('suspended');
    expect(await agent.releaseParkedRun('run-evented')).toBe(true);
    expect(workflow.runs.has('run-evented')).toBe(false);
    deliverResult();
    // Once the delayed result lands, the released run stays out of the map.
    await expect.poll(() => parked.workflowRunStatus).toBe('suspended');
    expect(workflow.runs.has('run-evented')).toBe(false);
    reader.releaseLock();
    expect(await resumeText(agent as any, 'run-evented')).toBe('done');
  });
});
