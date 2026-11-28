import { fork } from 'node:child_process';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { agentThreadStreamRuntime } from '../../thread-stream-runtime';
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

function streamPubSub(agent: ReturnType<typeof setup>['agent']) {
  return (agent as any).__getStreamBus(true).forRun((agent as any).__usesSharedRunLog()).pubsub;
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
    const unsubscribe = vi.spyOn(streamPubSub(agent), 'unsubscribe');

    expect(await agent.releaseParkedRun('run-parked')).toBe(true);
    expect(agent.runRegistry.size).toBe(0);
    // Neither its reader nor its remote-abort listener (which holds the registry entry) stays subscribed.
    expect(unsubscribe).toHaveBeenCalledWith('agent.stream.run-parked', expect.any(Function));
    await vi.waitFor(() => expect(unsubscribe).toHaveBeenCalledWith('agent.control.run-parked', expect.any(Function)));
    expect(await storedStatus(storage, 'run-parked')).toBe('suspended');
    reader.releaseLock();
    expect(await resumeText(agent, 'run-parked')).toBe('done');
  });

  it('still drops the run and its entries when a stream release throws', async () => {
    const { agent, workflow, storage, mastra } = setup();
    const { fullStream } = await agent.stream('hi', { runId: 'run-throws' });
    const reader = (fullStream as ReadableStream<any>).getReader();
    await expect.poll(() => storedStatus(storage, 'run-throws')).toBe('suspended');
    const unsubscribe = vi.spyOn(streamPubSub(agent), 'unsubscribe');
    const getPubSub = vi.spyOn(agent as any, 'getPubSub').mockImplementationOnce(() => {
      throw new Error('stream release failed');
    });

    await expect(agent.releaseParkedRun('run-throws')).rejects.toThrow('stream release failed');
    getPubSub.mockRestore();
    // The reader is still unsubscribed after the continuation close threw.
    expect(unsubscribe).toHaveBeenCalledWith('agent.stream.run-throws', expect.any(Function));
    expect(workflow.runs.size).toBe(0);
    expect(agent.runRegistry.size).toBe(0);
    expect(getRunRegistryEntry('run-throws', mastra)).toBeUndefined();
    expect(await storedStatus(storage, 'run-throws')).toBe('suspended');
    // The failed release is not kept around for a later release to retry.
    expect(await agent.releaseParkedRun('run-throws')).toBe(false);
    reader.releaseLock();
  });

  it('reports every failure when several stream release steps throw', async () => {
    const { agent, workflow, storage, mastra } = setup();
    const { fullStream } = await agent.stream('hi', { runId: 'run-throws-twice' });
    const reader = (fullStream as ReadableStream<any>).getReader();
    await expect.poll(() => storedStatus(storage, 'run-throws-twice')).toBe('suspended');
    const unsubscribe = vi.spyOn(streamPubSub(agent), 'unsubscribe');
    // Both the continuation close and the runtime eviction read it.
    const getPubSub = vi.spyOn(agent as any, 'getPubSub').mockImplementation(() => {
      throw new Error('pubsub unavailable');
    });

    const failure = await agent.releaseParkedRun('run-throws-twice').catch(error => error);
    getPubSub.mockRestore();
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors.map(error => (error as Error).message)).toEqual([
      'pubsub unavailable',
      'pubsub unavailable',
    ]);
    expect(unsubscribe).toHaveBeenCalledWith('agent.stream.run-throws-twice', expect.any(Function));
    expect(workflow.runs.size).toBe(0);
    expect(agent.runRegistry.size).toBe(0);
    expect(getRunRegistryEntry('run-throws-twice', mastra)).toBeUndefined();
    expect(await storedStatus(storage, 'run-throws-twice')).toBe('suspended');
    reader.releaseLock();
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
  type Setup = ReturnType<typeof setup>;
  type IdleObserve = (s: Setup, runId: string) => Promise<void>;

  /**
   * Observes `runId` until the idle timeout ends the observer, twice: once after the parked run is
   * released (nothing local is left, so nothing is releasable) and once while it is still parked.
   * A timed-out observer's release left tracked would run with the parked run's release and clear
   * the run's stream topics, which the parked run keeps for whoever resumes or observes it next.
   */
  async function expectNoReleaseLeftBehind(runId: string, idleObserve: IdleObserve) {
    const released = setup();
    await suspend(released.agent, runId);
    await released.agent.releaseParkedRun(runId);
    expect(released.workflow.runs.size).toBe(0);
    await idleObserve(released, runId);
    expect(await released.agent.releaseParkedRun(runId)).toBe(false);

    const parked = setup();
    await suspend(parked.agent, runId);
    await idleObserve(parked, runId);
    const clearTopic = vi.spyOn((parked.mastra as any).pubsub, 'clearTopic');
    expect(await parked.agent.releaseParkedRun(runId)).toBe(true);
    expect(clearTopic).not.toHaveBeenCalled();
  }

  it('leaves no stream release behind when nothing reads it', async () => {
    await expectNoReleaseLeftBehind('run-idle', async ({ agent }, runId) => {
      const onError = vi.fn();
      await agent.observe(runId, { idleTimeoutMs: 20, onError });
      await expect.poll(() => onError.mock.calls.length).toBe(1);
    });
  });

  it('leaves no stream release behind when the timeout fires before observe() returns', async () => {
    await expectNoReleaseLeftBehind('run-idle-early', async ({ agent, storage }, runId) => {
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
        await agent.observe(runId, { idleTimeoutMs: 5, onError });
      } finally {
        gated.mockRestore();
      }
      expect(gatedReads).toBeGreaterThan(0);
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  it('leaves no stream release behind when its caller awaits output.text', async () => {
    await expectNoReleaseLeftBehind('run-idle-text', async ({ agent }, runId) => {
      const observed = await agent.observe(runId, { idleTimeoutMs: 20 });
      await observed.output.text.catch(() => undefined);
    });
  });

  it('leaves no stream release behind when its caller reads fullStream', async () => {
    await expectNoReleaseLeftBehind('run-idle-stream', async ({ agent }, runId) => {
      const observed = await agent.observe(runId, { idleTimeoutMs: 20 });
      for await (const _chunk of observed.fullStream as AsyncIterable<any>) {
        // ends with the idle timeout's error chunk
      }
    });
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

describe('releaseParkedRun on a thread-bound stream', () => {
  const memory = { thread: 'thread-1', resource: 'user-1' };

  it('drops the parked thread-runtime record, then resumes cold', async () => {
    const { agent, storage, mastra } = setup();
    const { fullStream } = await agent.stream('hi', { runId: 'run-thread', memory });
    const reader = (fullStream as ReadableStream<any>).getReader();
    await expect.poll(() => storedStatus(storage, 'run-thread')).toBe('suspended');
    await expect.poll(() => agentThreadStreamRuntime.isRunParked('run-thread', mastra.pubsub)).toBe(true);

    expect(await agent.releaseParkedRun('run-thread')).toBe(true);
    expect(agentThreadStreamRuntime.isRunParked('run-thread', mastra.pubsub)).toBe(false);
    reader.releaseLock();
    expect(await storedStatus(storage, 'run-thread')).toBe('suspended');
    const resumed = await agent.resume('run-thread', { a: 'yes' }, { memory });
    let text = '';
    for await (const chunk of resumed.fullStream as AsyncIterable<any>) {
      if (chunk.type === 'text-delta') text += chunk.payload.text;
    }
    resumed.cleanup();
    expect(text).toBe('done');
  });

  it.each(['release', 'cleanup, then release', 'release, then cleanup'] as const)(
    "leaves a later resume's parked record in place (%s)",
    async order => {
      const storage = new InMemoryStore();
      const ask = createTool({
        id: 'ask',
        description: 'suspends until answered',
        inputSchema: z.object({}),
        suspendSchema: z.object({ q: z.string() }),
        resumeSchema: z.object({ a: z.string() }),
        execute: async (_input, ctx) => (ctx.agent?.resumeData ? 'ok' : ctx.agent?.suspend({ q: '?' })),
      });
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
      const publish = vi.spyOn(mastra.pubsub, 'publish');
      const suspendedStreamIds = () =>
        publish.mock.calls
          .map(([, event]) => (event as { data?: any }).data)
          .filter(data => data?.type === 'run-suspended' && data.runId === 'run-thread-successor')
          .map(data => data.streamId as string);
      const olderOutput = await older.stream('hi', { runId: 'run-thread-successor', memory });
      const { fullStream } = olderOutput;
      const reader = (fullStream as ReadableStream<any>).getReader();
      await expect.poll(() => storedStatus(storage, 'run-thread-successor')).toBe('suspended');
      await expect.poll(() => suspendedStreamIds().length).toBeGreaterThan(0);
      const olderStreamId = suspendedStreamIds()[0];

      const resumed = await newer.resume('run-thread-successor', { a: 'yes' }, { memory });
      const resumedReader = (resumed.fullStream as ReadableStream<any>).getReader();
      // Read the resumed segment to its own suspension: the tool call it made, not a replay of the older one.
      let successorCallId: string | undefined;
      for (;;) {
        const { done, value } = await resumedReader.read();
        if (done) throw new Error('resumed stream ended before the successor suspended');
        if (value.type === 'tool-call') successorCallId = value.payload.toolCallId;
        if (value.type === 'tool-call-suspended' && value.payload.toolCallId === successorCallId) break;
      }
      // isRunParked() is already true while the successor is still `suspending`, which no eviction matches; wait
      // for the successor's own run-suspended so its record is `suspended` and a wrong eviction could take it.
      await expect.poll(() => suspendedStreamIds().some(streamId => streamId !== olderStreamId)).toBe(true);
      await expect.poll(() => storedStatus(storage, 'run-thread-successor')).toBe('suspended');

      if (order === 'cleanup, then release') olderOutput.cleanup();
      expect(await older.releaseParkedRun('run-thread-successor')).toBe(true);
      if (order === 'release, then cleanup') olderOutput.cleanup();
      expect(agentThreadStreamRuntime.isRunParked('run-thread-successor', mastra.pubsub)).toBe(true);
      reader.releaseLock();
      resumedReader.releaseLock();
      resumed.cleanup();
    },
  );

  it.each(['cleanup, then release', 'release, then cleanup'] as const)(
    'drops the parked record once whichever of stream cleanup and release comes first (%s), then resumes cold',
    async order => {
      const { agent, storage, mastra } = setup();
      const output = await agent.stream('hi', { runId: 'run-thread-order', memory });
      const reader = (output.fullStream as ReadableStream<any>).getReader();
      await expect.poll(() => storedStatus(storage, 'run-thread-order')).toBe('suspended');
      await expect.poll(() => agentThreadStreamRuntime.isRunParked('run-thread-order', mastra.pubsub)).toBe(true);
      const evict = vi.spyOn(agentThreadStreamRuntime, 'evictParkedRun');

      if (order === 'cleanup, then release') {
        output.cleanup();
        // A stream cleanup alone keeps the parked record for a warm resume.
        expect(agentThreadStreamRuntime.isRunParked('run-thread-order', mastra.pubsub)).toBe(true);
        expect(await agent.releaseParkedRun('run-thread-order')).toBe(true);
      } else {
        expect(await agent.releaseParkedRun('run-thread-order')).toBe(true);
        expect(() => output.cleanup()).not.toThrow();
      }
      expect(agentThreadStreamRuntime.isRunParked('run-thread-order', mastra.pubsub)).toBe(false);
      expect(evict.mock.results.filter(result => result.value === true)).toHaveLength(1);
      evict.mockRestore();
      expect(await agent.releaseParkedRun('run-thread-order')).toBe(false);
      reader.releaseLock();
      expect(await storedStatus(storage, 'run-thread-order')).toBe('suspended');
      const resumed = await agent.resume('run-thread-order', { a: 'yes' }, { memory });
      let text = '';
      for await (const chunk of resumed.fullStream as AsyncIterable<any>) {
        if (chunk.type === 'text-delta') text += chunk.payload.text;
      }
      resumed.cleanup();
      expect(text).toBe('done');
    },
  );

  it("drops the owner's parked record when an observer stops watching first", async () => {
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
    const { fullStream } = await owner.stream('hi', { runId: 'run-thread-observed', memory });
    const reader = (fullStream as ReadableStream<any>).getReader();
    await expect.poll(() => storedStatus(storage, 'run-thread-observed')).toBe('suspended');
    await expect.poll(() => agentThreadStreamRuntime.isRunParked('run-thread-observed', mastra.pubsub)).toBe(true);

    const observed = await observer.observe('run-thread-observed');
    observed.cleanup();
    expect(agentThreadStreamRuntime.isRunParked('run-thread-observed', mastra.pubsub)).toBe(true);
    expect(await owner.releaseParkedRun('run-thread-observed')).toBe(true);
    expect(agentThreadStreamRuntime.isRunParked('run-thread-observed', mastra.pubsub)).toBe(false);
    reader.releaseLock();
  });
});

describe('an abandoned closeOnSuspend output', () => {
  it.each([
    ['its cleanup timer still pending', { CLEANUP_TIMEOUT_MS: '30000', WAIT_MS: '200' }],
    ['its cleanup timer fired', { CLEANUP_TIMEOUT_MS: '50' }],
    ['cleanup disabled', { CLEANUP_TIMEOUT_MS: '0' }],
    [
      'its cleanup timer still pending, from a resume',
      { CLEANUP_TIMEOUT_MS: '30000', WAIT_MS: '200', SEGMENT: 'resume' },
    ],
    ['cleanup disabled, from a resume', { CLEANUP_TIMEOUT_MS: '0', SEGMENT: 'resume' }],
  ])(
    'is garbage collected with %s',
    async (_case, env) => {
      // Isolate forced garbage collection so the test suite does not need to run with --expose-gc.
      const child = fork(new URL('./fixtures/abandoned-close-on-suspend-output-gc.ts', import.meta.url), {
        execArgv: ['--expose-gc', '--import', import.meta.resolve('tsx')],
        env: { ...process.env, ...env },
        silent: true,
      });
      const stderr: Buffer[] = [];
      child.stderr?.on('data', chunk => stderr.push(chunk));
      let completed = false;
      child.on('message', message => {
        if (message === 'ok') completed = true;
      });
      const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
        const timeout = setTimeout(() => child.kill('SIGKILL'), 15_000);
        child.once('error', error => {
          clearTimeout(timeout);
          reject(error);
        });
        child.once('close', (code, signal) => {
          clearTimeout(timeout);
          resolve({ code, signal });
        });
      });
      const diagnostics = Buffer.concat(stderr).toString() || 'child produced no stderr';
      expect({ ...result, completed }, diagnostics).toEqual({ code: 0, signal: null, completed: true });
    },
    20_000,
  );
});
