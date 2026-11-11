/**
 * A published run's id identifies one run: its stream topic and ownership record
 * are keyed by it. A caller-supplied `runId` is only a claim, so starting a run
 * on an id another run already holds is refused instead of taking that run over.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { useLoopScenarioAimock } from '../../../loop/test-utils/aimock/aimock-scenario';
import { SCENARIO_MODEL_ID } from '../../../loop/test-utils/aimock/types';
import { Mastra } from '../../../mastra';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '../../../request-context';
import { Agent } from '../../agent';
import type { AgentConfig } from '../../types';
import { AGENT_STREAM_TOPIC, RUN_RECORD_ADMISSION_TIMEOUT_MS } from '../constants';
import { writeAgentRunRecord } from '../run-records';

class RecordingPubSub extends EventEmitterPubSub {
  readonly published: Array<{ topic: string; event: Omit<Event, 'id' | 'createdAt'> }> = [];

  override async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>, options?: { localOnly?: boolean }) {
    if (topic.startsWith('agent.stream.')) this.published.push({ topic, event });
    return super.publish(topic, event, options);
  }

  count(runId: string) {
    return this.published.filter(p => p.topic === AGENT_STREAM_TOPIC(runId)).length;
  }
}

const RUN_ID_CLAIMED = { id: 'AGENT_RUN_ID_ALREADY_CLAIMED' };

const collect = async (stream: ReadableStream<any>) => {
  const types: string[] = [];
  let text = '';
  for await (const chunk of stream) {
    types.push(chunk.type);
    if (chunk.type === 'text-delta') text += chunk.payload.text;
  }
  return { types, text };
};

describe('run id ownership', () => {
  const getMock = useLoopScenarioAimock();

  const makeAgent = (config: Partial<AgentConfig<any, any, any>> = {}) => {
    getMock().on({ endpoint: 'chat' }, { content: 'Hello there.' });
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${getMock().url}/v1` });
    return new Agent({
      id: 'run-id-agent',
      name: 'run-id-agent',
      instructions: 'Be brief.',
      model: openai(SCENARIO_MODEL_ID),
      ...config,
    } as AgentConfig<any, any, any>);
  };

  const resource = (id: string) => new RequestContext([[MASTRA_RESOURCE_ID_KEY, id]]);

  it('refuses a runId another resource is already running', async () => {
    const pubsub = new RecordingPubSub();
    const agent = makeAgent();
    new Mastra({ agents: { agent }, pubsub, logger: false });

    const first = await agent.stream('Say hello.', { runId: 'shared-run', requestContext: resource('tenant-a') });
    await first.consumeStream();
    const publishedByOwner = pubsub.count('shared-run');

    await expect(
      agent.stream('Say hello.', { runId: 'shared-run', requestContext: resource('tenant-b') }),
    ).rejects.toMatchObject(RUN_ID_CLAIMED);

    // The owner keeps the record, and the refused run published nothing on its topic.
    expect(await agent.__getRunRecord('shared-run')).toMatchObject({ resourceId: 'tenant-a' });
    expect(pubsub.count('shared-run')).toBe(publishedByOwner);
  });

  it('keeps the run id with its owner after the run finishes', async () => {
    const agent = makeAgent();
    new Mastra({ agents: { agent }, pubsub: new RecordingPubSub(), logger: false });

    const first = await agent.stream('Say hello.', { runId: 'finished-run', requestContext: resource('tenant-a') });
    await first.consumeStream();

    await expect(
      agent.stream('Say hello.', { runId: 'finished-run', requestContext: resource('tenant-b') }),
    ).rejects.toMatchObject(RUN_ID_CLAIMED);

    // The owner can still reuse it.
    const again = await agent.stream('Say hello.', { runId: 'finished-run', requestContext: resource('tenant-a') });
    await again.consumeStream();
    expect(await agent.__getRunRecord('finished-run')).toMatchObject({ resourceId: 'tenant-a' });
  });

  it('refuses a scoped run id to a caller without a resource id', async () => {
    const agent = makeAgent();
    new Mastra({ agents: { agent }, pubsub: new RecordingPubSub(), logger: false });

    const first = await agent.stream('Say hello.', { runId: 'scoped-run', requestContext: resource('tenant-a') });
    await first.consumeStream();

    await expect(agent.stream('Say hello.', { runId: 'scoped-run' })).rejects.toMatchObject(RUN_ID_CLAIMED);
  });

  it('allows unscoped runs to reuse a run id', async () => {
    const agent = makeAgent();
    new Mastra({ agents: { agent }, pubsub: new RecordingPubSub(), logger: false });

    const first = await agent.stream('Say hello.', { runId: 'unscoped-run' });
    await first.consumeStream();
    const again = await agent.stream('Say hello.', { runId: 'unscoped-run' });
    await again.consumeStream();

    expect(await agent.__getRunRecord('unscoped-run')).toMatchObject({ runId: 'unscoped-run' });
  });

  it('refuses a run id another process is running, even for the same owner', async () => {
    const agent = makeAgent();
    new Mastra({ agents: { agent }, pubsub: new RecordingPubSub(), logger: false });

    // A running record means another process holds the id and is listening for its
    // abort requests, so sharing it would cross both streams and stops.
    await writeAgentRunRecord(agent.__getStreamBus()!.runRecordCache, {
      agentId: agent.id,
      runId: 'running-elsewhere',
      resourceId: 'tenant-a',
      status: 'running',
      updatedAt: Date.now(),
    });

    await expect(
      agent.stream('Say hello.', { runId: 'running-elsewhere', requestContext: resource('tenant-a') }),
    ).rejects.toMatchObject(RUN_ID_CLAIMED);
  });

  it('starts a reused run id on an empty log, so a reader never replays the previous run', async () => {
    const agent = makeAgent();
    new Mastra({ agents: { agent }, pubsub: new RecordingPubSub(), logger: false });
    const topic = AGENT_STREAM_TOPIC('twice-run');
    const history = async () =>
      (agent.__getStreamBus()!.pubsub as unknown as { getHistory(t: string, o?: number): Promise<Event[]> }).getHistory(
        topic,
        0,
      );

    const first = await agent.stream('Say hello.', { runId: 'twice-run', requestContext: resource('tenant-a') });
    await first.consumeStream();
    const previous = await history();
    expect(previous.length).toBeGreaterThan(0);

    const second = await agent.stream('Say hello.', { runId: 'twice-run', requestContext: resource('tenant-a') });
    await second.consumeStream();

    // The finished run's log is gone, so the reuse starts at its own `start` rather than
    // replaying the previous run — whose `finish` would close a reader before this run spoke.
    const reused = await history();
    expect(reused.map(event => event.id)).not.toContain(previous[0]!.id);
    expect(reused.at(-1)?.type).toBe('finish');
  });

  it("does not clear a reused run id when the previous run's cleanup timer fires", async () => {
    const pubsub = new RecordingPubSub();
    const agent = makeAgent({ durable: { cleanupTimeoutMs: 50 } });
    new Mastra({ agents: { agent }, pubsub, logger: false });

    const first = await agent.stream('Say hello.', { runId: 'reused-run', requestContext: resource('tenant-a') });
    await first.consumeStream();
    const published = pubsub.count('reused-run');

    // A later run now owns the id. The finished run's timer must leave its record and
    // history alone, or the new run would lose both while it is still running.
    const bus = agent.__getStreamBus()!;
    await writeAgentRunRecord(bus.runRecordCache, {
      agentId: agent.id,
      runId: 'reused-run',
      resourceId: 'tenant-a',
      status: 'suspended',
      updatedAt: Date.now(),
    });
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(await agent.__getRunRecord('reused-run')).toMatchObject({ status: 'suspended' });
    const replay = await collect((await agent.observe('reused-run')).fullStream);
    expect(replay.types.at(-1)).toBe('finish');
    expect(pubsub.count('reused-run')).toBe(published);
  });

  describe('when the run record cannot be read', () => {
    const RECORD_UNAVAILABLE = { id: 'AGENT_RUN_RECORD_UNAVAILABLE' };

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    // A paused or partitioned cache answers nothing; the run must be refused
    // within the bound instead of waiting out the outage.
    it.each([
      ['a generated run id', undefined],
      ['a caller-supplied run id', 'caller-run'],
    ])('refuses to start %s when the cache does not answer', async (_label, runId) => {
      const pubsub = new RecordingPubSub();
      const cache = new InMemoryServerCache();
      const agent = makeAgent();
      new Mastra({ agents: { agent }, pubsub, cache, logger: false });
      vi.spyOn(cache, 'get').mockReturnValue(new Promise(() => {}));
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      const started = agent.stream('Say hello.', { runId, requestContext: resource('tenant-a') });
      const refused = expect(started).rejects.toMatchObject(RECORD_UNAVAILABLE);
      await vi.advanceTimersByTimeAsync(RUN_RECORD_ADMISSION_TIMEOUT_MS);
      await refused;

      expect(pubsub.published).toEqual([]);
    });

    it('refuses to start a run when the cache read fails', async () => {
      const pubsub = new RecordingPubSub();
      const cache = new InMemoryServerCache();
      const agent = makeAgent();
      new Mastra({ agents: { agent }, pubsub, cache, logger: false });
      const outage = new Error('Socket closed unexpectedly');
      vi.spyOn(cache, 'get').mockRejectedValue(outage);

      const error = await agent.stream('Say hello.', { requestContext: resource('tenant-a') }).catch(e => e);

      expect(error).toMatchObject(RECORD_UNAVAILABLE);
      expect(error.cause).toMatchObject({ message: 'Socket closed unexpectedly' });
      expect(pubsub.published).toEqual([]);
    });

    it('still refuses a claimed run id once the cache answers within the bound', async () => {
      const cache = new InMemoryServerCache();
      const agent = makeAgent();
      new Mastra({ agents: { agent }, pubsub: new RecordingPubSub(), cache, logger: false });
      await writeAgentRunRecord(agent.__getStreamBus()!.runRecordCache, {
        agentId: agent.id,
        runId: 'slow-claimed-run',
        resourceId: 'tenant-a',
        status: 'running',
        updatedAt: Date.now(),
      });
      const get = cache.get.bind(cache);
      vi.spyOn(cache, 'get').mockImplementation(async key => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return get(key);
      });

      await expect(
        agent.stream('Say hello.', { runId: 'slow-claimed-run', requestContext: resource('tenant-b') }),
      ).rejects.toMatchObject(RUN_ID_CLAIMED);
    });
  });
});
