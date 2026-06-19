import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { Agent } from '../agent';
import { HEARTBEAT_SCHEDULE_PREFIX } from './types';

function makeAgent(id: string): Agent {
  return new Agent({
    id,
    name: id,
    instructions: 'test',
    model: new MockLanguageModelV2(),
  });
}

function makeMastra(agents: Record<string, Agent>) {
  return new Mastra({ logger: false, storage: new MockStore(), agents });
}

describe('agent.heartbeats sugar', () => {
  it('creates a threadless heartbeat with a random hb_ id', async () => {
    const agent = makeAgent('pinger');
    makeMastra({ pinger: agent });

    const hb = await agent.heartbeats.create({
      cron: '*/5 * * * *',
      prompt: 'ping',
    });

    expect(hb.id.startsWith(HEARTBEAT_SCHEDULE_PREFIX)).toBe(true);
    expect(hb.agentId).toBe('pinger');
    expect(hb.prompt).toBe('ping');
    expect(hb.threadId).toBeUndefined();
    expect(hb.status).toBe('active');
    expect(typeof hb.nextFireAt).toBe('number');
  });

  it('creates a threaded heartbeat with the threaded knobs', async () => {
    const agent = makeAgent('pinger');
    makeMastra({ pinger: agent });

    const hb = await agent.heartbeats.create({
      cron: '*/5 * * * *',
      prompt: 'check in',
      threadId: 't1',
      resourceId: 'u1',
      signalType: 'system-reminder',
      ifActive: 'persist',
      ifIdle: 'wake',
    });

    expect(hb.threadId).toBe('t1');
    expect(hb.resourceId).toBe('u1');
    expect(hb.signalType).toBe('system-reminder');
    expect(hb.ifActive).toBe('persist');
    expect(hb.ifIdle).toBe('wake');
  });

  it('supports multiple heartbeats per agent/thread with distinct ids', async () => {
    const agent = makeAgent('pinger');
    makeMastra({ pinger: agent });

    const a = await agent.heartbeats.create({
      cron: '*/5 * * * *',
      prompt: 'a',
      name: 'morning',
      threadId: 't1',
      resourceId: 'u1',
    });
    const b = await agent.heartbeats.create({
      cron: '*/10 * * * *',
      prompt: 'b',
      name: 'evening',
      threadId: 't1',
      resourceId: 'u1',
    });

    expect(a.id).not.toBe(b.id);
    const list = await agent.heartbeats.list();
    expect(list).toHaveLength(2);
    expect(list.map(h => h.name).sort()).toEqual(['evening', 'morning']);
  });

  it('rejects invalid cron', async () => {
    const agent = makeAgent('pinger');
    makeMastra({ pinger: agent });

    await expect(agent.heartbeats.create({ cron: 'not-a-cron', prompt: 'p' })).rejects.toThrow();
  });

  it('rejects threadId without resourceId', async () => {
    const agent = makeAgent('pinger');
    makeMastra({ pinger: agent });

    await expect(agent.heartbeats.create({ cron: '*/5 * * * *', prompt: 'p', threadId: 't1' })).rejects.toThrow(
      /resourceId/,
    );
  });

  it('rejects thread-only knobs when threadId is omitted', async () => {
    const agent = makeAgent('pinger');
    makeMastra({ pinger: agent });

    await expect(agent.heartbeats.create({ cron: '*/5 * * * *', prompt: 'p', ifIdle: 'wake' } as any)).rejects.toThrow(
      /threadId/,
    );
  });

  it('refuses heartbeats when storage lacks the schedules domain', async () => {
    const agent = makeAgent('pinger');
    // Mastra now always backs `new Mastra({})` with an in-memory store (which
    // includes the schedules domain), so the guard can only be exercised by a
    // storage adapter that genuinely lacks the schedules domain.
    const storage = new MockStore();
    delete (storage.stores as Partial<typeof storage.stores>).schedules;
    new Mastra({ logger: false, storage, agents: { pinger: agent } });
    await expect(agent.heartbeats.create({ cron: '*/5 * * * *', prompt: 'p' })).rejects.toThrow(/schedules/);
  });

  it('refuses heartbeats when agent is unregistered', async () => {
    const agent = makeAgent('pinger');
    await expect(agent.heartbeats.create({ cron: '*/5 * * * *', prompt: 'p' })).rejects.toThrow(/Mastra/);
  });

  it('delete removes the heartbeat by id', async () => {
    const agent = makeAgent('pinger');
    makeMastra({ pinger: agent });

    const hb = await agent.heartbeats.create({
      cron: '*/5 * * * *',
      prompt: 'p',
      threadId: 't1',
      resourceId: 'u1',
    });
    expect(await agent.heartbeats.get(hb.id)).not.toBeNull();

    await agent.heartbeats.delete(hb.id);
    expect(await agent.heartbeats.get(hb.id)).toBeNull();
  });

  it('delete is a no-op for unknown ids', async () => {
    const agent = makeAgent('pinger');
    makeMastra({ pinger: agent });
    await expect(agent.heartbeats.delete('hb_does-not-exist')).resolves.toBeUndefined();
  });

  it('delete refuses to delete heartbeats owned by other agents', async () => {
    const a = makeAgent('a');
    const b = makeAgent('b');
    makeMastra({ a, b });
    const aHb = await a.heartbeats.create({ cron: '*/5 * * * *', prompt: 'p' });
    await expect(b.heartbeats.delete(aHb.id)).rejects.toThrow(/owned/);
  });

  it('get returns null for non-owned heartbeats', async () => {
    const a = makeAgent('a');
    const b = makeAgent('b');
    makeMastra({ a, b });
    const aHb = await a.heartbeats.create({ cron: '*/5 * * * *', prompt: 'p' });
    // mastra.heartbeats.get returns it (canonical), but agent.heartbeats.list
    // filters by agentId, so it never surfaces on b.
    const bList = await b.heartbeats.list();
    expect(bList.find(h => h.id === aHb.id)).toBeUndefined();
  });

  it('list only returns this agent`s heartbeats', async () => {
    const a = makeAgent('a');
    const b = makeAgent('b');
    makeMastra({ a, b });

    await a.heartbeats.create({ cron: '*/5 * * * *', prompt: 'A' });
    await a.heartbeats.create({ cron: '*/5 * * * *', prompt: 'A2', threadId: 't', resourceId: 'r' });
    await b.heartbeats.create({ cron: '*/5 * * * *', prompt: 'B' });

    const aList = await a.heartbeats.list();
    expect(aList).toHaveLength(2);
    expect(aList.every(h => h.agentId === 'a')).toBe(true);

    const bList = await b.heartbeats.list();
    expect(bList).toHaveLength(1);
    expect(bList[0]!.agentId).toBe('b');
  });

  it('list supports filtering by threadId and name', async () => {
    const agent = makeAgent('pinger');
    makeMastra({ pinger: agent });

    await agent.heartbeats.create({
      cron: '*/5 * * * *',
      prompt: 'a',
      name: 'morning',
      threadId: 't1',
      resourceId: 'u1',
    });
    await agent.heartbeats.create({
      cron: '*/5 * * * *',
      prompt: 'b',
      name: 'evening',
      threadId: 't1',
      resourceId: 'u1',
    });
    await agent.heartbeats.create({
      cron: '*/5 * * * *',
      prompt: 'c',
      threadId: 't2',
      resourceId: 'u1',
    });

    expect(await agent.heartbeats.list({ threadId: 't1' })).toHaveLength(2);
    expect(await agent.heartbeats.list({ name: 'morning' })).toHaveLength(1);
    expect(await agent.heartbeats.list({ threadId: 't2' })).toHaveLength(1);
  });
});
