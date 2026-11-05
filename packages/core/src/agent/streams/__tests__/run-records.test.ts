/**
 * Shared run ownership records of plain Agent runs: written before the run's
 * first event, kept current through suspension, resume and finish, readable
 * from another Mastra instance sharing the record cache, and gone once the
 * topic is cleared or the record expires. Model traffic goes through AIMock.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { useLoopScenarioAimock } from '../../../loop/test-utils/aimock/aimock-scenario';
import { SCENARIO_MODEL_ID } from '../../../loop/test-utils/aimock/types';
import { Mastra } from '../../../mastra';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type { AgentConfig } from '../../types';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';
import { AGENT_RUN_RECORD_TTL_MS, agentRunRecordKey } from '../run-records';
import type { AgentRunRecord } from '../run-records';

class RecordingCache extends InMemoryServerCache {
  readonly writes: Array<{ key: string; value: AgentRunRecord; ttlMs?: number }> = [];
  override async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    if (key.startsWith('agent.run.')) this.writes.push({ key, value: value as AgentRunRecord, ttlMs });
    return super.set(key, value, ttlMs);
  }
}

/** A transient write failure at the cache boundary; all other operations stay real. */
class RecoveringCache extends RecordingCache {
  runningAttempts = 0;
  beforeRunningRetry?: () => Promise<void>;

  override async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    if (key.startsWith('agent.run.') && (value as AgentRunRecord).status === 'running') {
      this.runningAttempts++;
      if (this.runningAttempts === 1) throw new Error('Cache temporarily unavailable');
      await this.beforeRunningRetry?.();
    }
    return super.set(key, value, ttlMs);
  }
}

/** Records, per run topic event, the run record status visible at that moment. */
class OrderingPubSub extends EventEmitterPubSub {
  readonly seen: Array<{ type: string; status?: string }> = [];
  constructor(
    private readonly cache: InMemoryServerCache,
    private readonly agentId: string,
  ) {
    super();
  }
  override async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>, options?: { localOnly?: boolean }) {
    if (topic.startsWith('agent.stream.')) {
      const runId = topic.slice('agent.stream.'.length);
      const record = (await this.cache.get(agentRunRecordKey(this.agentId, runId))) as AgentRunRecord | null;
      this.seen.push({ type: event.type, status: record?.status });
    }
    return super.publish(topic, event, options);
  }
}

describe('Agent run records', () => {
  const getMock = useLoopScenarioAimock();
  const openai = () => createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${getMock().url}/v1` });
  const makeAgent = (config: Partial<AgentConfig<any, any, any>> = {}) =>
    new Agent({
      id: 'records-agent',
      name: 'records-agent',
      instructions: 'Be brief.',
      model: openai()(SCENARIO_MODEL_ID),
      ...config,
    } as AgentConfig<any, any, any>);
  const owner = () =>
    new RequestContext([
      [MASTRA_RESOURCE_ID_KEY, 'user-1'],
      [MASTRA_THREAD_ID_KEY, 'thread-1'],
    ]);

  it('writes the record before the first event and follows suspend, resume and finish on another instance', async () => {
    getMock().on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call-1', name: 'lookup', arguments: { q: 'a' } }] },
    );
    getMock().on({ endpoint: 'chat', hasToolResult: true }, { content: 'Looked it up.' });
    const cache = new RecordingCache();
    const pubsub = new OrderingPubSub(cache, 'records-agent');
    const lookup = createTool({
      id: 'lookup',
      description: 'Look something up',
      inputSchema: z.object({ q: z.string() }),
      requireApproval: true,
      execute: async () => ({ ok: true }),
    });
    const agentA = makeAgent({ tools: { lookup }, durable: { cleanupTimeoutMs: 0 } });
    new Mastra({ agents: { agent: agentA }, pubsub, cache, storage: new InMemoryStore(), logger: false });
    // A second server: same pubsub and cache, its own Agent instance.
    const agentB = makeAgent({ tools: { lookup }, durable: { cleanupTimeoutMs: 0 } });
    new Mastra({ agents: { agent: agentB }, pubsub, cache, storage: new InMemoryStore(), logger: false });

    const output = await agentA.stream('Look up a.', { requestContext: owner() });
    await output.consumeStream();
    await vi.waitFor(async () => expect((await agentB.__getRunRecord(output.runId))?.status).toBe('suspended'));
    expect(await agentB.__getRunRecord(output.runId)).toMatchObject({
      agentId: 'records-agent',
      runId: output.runId,
      resourceId: 'user-1',
      threadId: 'thread-1',
    });
    // Every event, the first included, was published with the record in place.
    expect(pubsub.seen.length).toBeGreaterThan(0);
    expect(pubsub.seen.every(e => e.status !== undefined)).toBe(true);
    expect(pubsub.seen.at(-1)).toEqual({ type: AgentStreamEventTypes.SUSPENDED, status: 'running' });

    const resumed = await agentA.approveToolCall({
      runId: output.runId,
      toolCallId: 'call-1',
      requestContext: owner(),
    });
    await resumed.consumeStream();
    await vi.waitFor(async () => expect((await agentB.__getRunRecord(output.runId))?.status).toBe('finished'));
    const statuses = cache.writes
      .filter(w => w.key === agentRunRecordKey('records-agent', output.runId))
      .map(w => w.value.status);
    expect(statuses).toEqual(['running', 'suspended', 'running', 'finished']);
    expect(cache.writes.every(w => w.ttlMs === AGENT_RUN_RECORD_TTL_MS)).toBe(true);
  });

  it('restores cross-instance ownership while a quiet tool is still running after a cache write failure', async () => {
    getMock().on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call-1', name: 'wait', arguments: {} }] },
    );
    getMock().on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done waiting.' });
    const cache = new RecoveringCache();
    const pubsub = new EventEmitterPubSub();
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const toolStarted = new Promise<void>(resolve => (started = resolve));
    const wait = createTool({
      id: 'wait',
      description: 'Wait for work.',
      inputSchema: z.object({}),
      execute: async () => {
        started();
        await gate;
        return { ok: true };
      },
    });
    const agentA = makeAgent({ tools: { wait }, durable: { cache: false, cleanupTimeoutMs: 0 } });
    const agentB = makeAgent({ durable: { cache: false, cleanupTimeoutMs: 0 } });
    const mastraA = new Mastra({ agents: { agent: agentA }, pubsub, cache, logger: false });
    const mastraB = new Mastra({ agents: { agent: agentB }, pubsub, cache, logger: false });
    try {
      const output = await agentA.stream('Wait for work.', { requestContext: owner(), maxSteps: 3 });
      const consuming = output.consumeStream();
      await toolStarted;
      await vi.waitFor(
        async () =>
          expect(await agentB.__getRunRecord(output.runId)).toMatchObject({
            resourceId: 'user-1',
            status: 'running',
          }),
        { timeout: 3000 },
      );
      expect(cache.runningAttempts).toBe(2);
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(cache.runningAttempts).toBe(2);
      release();
      await consuming;
      expect(await output.text).toBe('Done waiting.');
      await vi.waitFor(async () => expect((await agentB.__getRunRecord(output.runId))?.status).toBe('finished'));
    } finally {
      release();
      await Promise.all([mastraA.shutdown(), mastraB.shutdown()]);
    }
  });

  it.each(['finished', 'suspended'] as const)('cancels a pending ownership retry when the run is %s', async status => {
    getMock().on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call-1', name: 'lookup', arguments: {} }] },
    );
    getMock().on({ endpoint: 'chat', hasToolResult: true }, { content: 'Looked it up.' });
    const cache = new RecoveringCache();
    const lookup = createTool({
      id: 'lookup',
      description: 'Look something up.',
      inputSchema: z.object({}),
      requireApproval: status === 'suspended',
      execute: async () => ({ ok: true }),
    });
    const agent = makeAgent({ tools: { lookup }, durable: { cache: false, cleanupTimeoutMs: 0 } });
    const mastra = new Mastra({ agents: { agent }, cache, storage: new InMemoryStore(), logger: false });
    try {
      const output = await agent.stream('Look it up.', { requestContext: owner(), maxSteps: 3 });
      await output.consumeStream();
      const key = agentRunRecordKey('records-agent', output.runId);
      await vi.waitFor(async () => expect(await cache.get(key)).toMatchObject({ status }));
      await new Promise(resolve => setTimeout(resolve, 1200));
      expect(await cache.get(key)).toMatchObject({ status });
      expect(cache.runningAttempts).toBe(1);
      expect(cache.writes.map(write => write.value.status)).toEqual([status]);
    } finally {
      await mastra.shutdown();
    }
  });

  it('serializes an in-flight recovery before the finished ownership record', async () => {
    getMock().on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call-1', name: 'wait', arguments: {} }] },
    );
    getMock().on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done waiting.' });
    const cache = new RecoveringCache();
    let releaseWrite!: () => void;
    let retryStarted!: () => void;
    const writeGate = new Promise<void>(resolve => (releaseWrite = resolve));
    const retry = new Promise<void>(resolve => (retryStarted = resolve));
    cache.beforeRunningRetry = async () => {
      retryStarted();
      await writeGate;
    };
    let releaseTool!: () => void;
    const toolGate = new Promise<void>(resolve => (releaseTool = resolve));
    const wait = createTool({
      id: 'wait',
      description: 'Wait for work.',
      inputSchema: z.object({}),
      execute: async () => {
        await toolGate;
        return { ok: true };
      },
    });
    const agent = makeAgent({ tools: { wait }, durable: { cache: false, cleanupTimeoutMs: 0 } });
    const mastra = new Mastra({ agents: { agent }, cache, logger: false });
    try {
      const output = await agent.stream('Wait for work.', { requestContext: owner(), maxSteps: 3 });
      const consuming = output.consumeStream();
      await retry;
      releaseTool();
      await consuming;
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(cache.runningAttempts).toBe(2);
      releaseWrite();
      const key = agentRunRecordKey('records-agent', output.runId);
      await vi.waitFor(async () => expect(await cache.get(key)).toMatchObject({ status: 'finished' }));
      expect(cache.writes.map(write => write.value.status)).toEqual(['running', 'finished']);
    } finally {
      releaseTool();
      releaseWrite();
      await mastra.shutdown();
    }
  });

  it('deletes the record when the topic is cleared', async () => {
    getMock().on({ endpoint: 'chat' }, { content: 'Hello there.' });
    const cache = new InMemoryServerCache();
    const pubsub = new EventEmitterPubSub();
    const agent = makeAgent({ durable: { cleanupTimeoutMs: 100 } });
    new Mastra({ agents: { agent }, pubsub, cache, logger: false });
    const output = await agent.stream('Say hello.', { requestContext: owner() });
    await output.consumeStream();
    await vi.waitFor(async () => expect((await agent.__getRunRecord(output.runId))?.status).toBe('finished'));
    await vi.waitFor(
      async () => expect(await cache.get(agentRunRecordKey('records-agent', output.runId))).toBeUndefined(),
      {
        timeout: 2000,
      },
    );
    expect(await agent.__getRunRecord(output.runId)).toBeUndefined();
  });

  it('clears the run control and ack topics with the run log', async () => {
    getMock().on({ endpoint: 'chat' }, { content: 'Hello there.' });
    const pubsub = new EventEmitterPubSub();
    const cleared = vi.spyOn(pubsub, 'clearTopic');
    const agent = makeAgent({ durable: { cleanupTimeoutMs: 50 } });
    new Mastra({ agents: { agent }, pubsub, cache: new InMemoryServerCache(), logger: false });
    const output = await agent.stream('Say hello.', { requestContext: owner() });
    await output.consumeStream();
    const runId = output.runId;
    await vi.waitFor(
      () => {
        const topics = cleared.mock.calls.map(([topic]) => topic);
        expect(topics).toEqual(
          expect.arrayContaining([`agent.stream.${runId}`, `agent.control.${runId}`, `agent.control.${runId}.ack`]),
        );
      },
      { timeout: 2000 },
    );
  });

  it('treats an expired or evicted record as an unknown run', async () => {
    getMock().on({ endpoint: 'chat' }, { content: 'Hello there.' });
    const cache = new InMemoryServerCache();
    const agent = makeAgent({ durable: { cleanupTimeoutMs: 0 } });
    new Mastra({ agents: { agent }, pubsub: new EventEmitterPubSub(), cache, logger: false });
    const output = await agent.stream('Say hello.', { requestContext: owner() });
    await output.consumeStream();
    await vi.waitFor(async () => expect((await agent.__getRunRecord(output.runId))?.status).toBe('finished'));
    await cache.delete(agentRunRecordKey('records-agent', output.runId));
    expect(await agent.__getRunRecord(output.runId)).toBeUndefined();
  });

  it('keeps records in the server cache when replay caching is off', async () => {
    getMock().on({ endpoint: 'chat' }, { content: 'Hello there.' });
    const cache = new InMemoryServerCache();
    const pubsub = new EventEmitterPubSub();
    const agentA = makeAgent({ durable: { cache: false, cleanupTimeoutMs: 0 } });
    new Mastra({ agents: { agent: agentA }, pubsub, cache, logger: false });
    const agentB = makeAgent({ durable: { cache: false, cleanupTimeoutMs: 0 } });
    new Mastra({ agents: { agent: agentB }, pubsub, cache, logger: false });
    const output = await agentA.stream('Say hello.', { requestContext: owner() });
    await output.consumeStream();
    await vi.waitFor(async () =>
      expect(await agentB.__getRunRecord(output.runId)).toMatchObject({ resourceId: 'user-1', status: 'finished' }),
    );
    // No replay log was written: only the record.
    expect(await cache.listLength(AGENT_STREAM_TOPIC(output.runId))).toBe(0);
  });

  it('rejects when the record cache cannot be read', async () => {
    const cache = new InMemoryServerCache();
    const agent = makeAgent();
    new Mastra({ agents: { agent }, pubsub: new EventEmitterPubSub(), cache, logger: false });
    vi.spyOn(cache, 'get').mockRejectedValue(new Error('cache down'));
    await expect(agent.__getRunRecord('some-run')).rejects.toThrow('cache down');
  });

  it('keeps no record for a run of an agent with streams off', async () => {
    getMock().on({ endpoint: 'chat' }, { content: 'Hello there.' });
    const cache = new RecordingCache();
    const agent = makeAgent({ durable: false });
    new Mastra({ agents: { agent }, pubsub: new EventEmitterPubSub(), cache, logger: false });
    const output = await agent.stream('Say hello.', { requestContext: owner() });
    await output.consumeStream();
    expect(cache.writes).toEqual([]);
    expect(await agent.__getRunRecord(output.runId)).toBeUndefined();
  });
});
