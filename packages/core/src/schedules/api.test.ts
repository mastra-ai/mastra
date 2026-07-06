import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../agent/agent';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { AGENT_SCHEDULE_PREFIX } from './types';

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

describe('mastra.schedules', () => {
  it('creates a threadless agent schedule with a random agent_ id', async () => {
    const agent = makeAgent('pinger');
    const mastra = makeMastra({ pinger: agent });

    const hb = await mastra.schedules.create({
      agentId: agent.id,
      cron: '*/5 * * * *',
      prompt: 'ping',
    });

    expect(hb.id.startsWith(AGENT_SCHEDULE_PREFIX)).toBe(true);
    expect(hb.agentId).toBe('pinger');
    expect(hb.prompt).toBe('ping');
    expect(hb.threadId).toBeUndefined();
    expect(hb.status).toBe('active');
    expect(typeof hb.nextFireAt).toBe('number');
  });

  it('creates a threaded agent schedule with the threaded knobs', async () => {
    const agent = makeAgent('pinger');
    const mastra = makeMastra({ pinger: agent });

    const hb = await mastra.schedules.create({
      agentId: agent.id,
      cron: '*/5 * * * *',
      prompt: 'check in',
      threadId: 't1',
      resourceId: 'u1',
      signalType: 'system-reminder',
      ifActive: { behavior: 'persist' },
      ifIdle: { behavior: 'wake' },
    });

    expect(hb.threadId).toBe('t1');
    expect(hb.resourceId).toBe('u1');
    expect(hb.signalType).toBe('system-reminder');
    expect(hb.ifActive).toEqual({ behavior: 'persist' });
    expect(hb.ifIdle).toEqual({ behavior: 'wake' });
  });

  it('supports multiple schedules per agent/thread with distinct ids', async () => {
    const agent = makeAgent('pinger');
    const mastra = makeMastra({ pinger: agent });

    const a = await mastra.schedules.create({
      agentId: agent.id,
      cron: '*/5 * * * *',
      prompt: 'a',
      name: 'morning',
      threadId: 't1',
      resourceId: 'u1',
    });
    const b = await mastra.schedules.create({
      agentId: agent.id,
      cron: '*/10 * * * *',
      prompt: 'b',
      name: 'evening',
      threadId: 't1',
      resourceId: 'u1',
    });

    expect(a.id).not.toBe(b.id);
    const list = await mastra.schedules.list({ agentId: agent.id });
    expect(list).toHaveLength(2);
    expect(list.map(h => h.name).sort()).toEqual(['evening', 'morning']);
  });

  it('rejects invalid cron', async () => {
    const agent = makeAgent('pinger');
    const mastra = makeMastra({ pinger: agent });

    await expect(mastra.schedules.create({ agentId: agent.id, cron: 'not-a-cron', prompt: 'p' })).rejects.toThrow();
  });

  it('rejects a missing agentId', async () => {
    const agent = makeAgent('pinger');
    const mastra = makeMastra({ pinger: agent });

    await expect(mastra.schedules.create({ cron: '*/5 * * * *', prompt: 'p' } as any)).rejects.toThrow(/agentId/);
  });

  it('rejects threadId without resourceId', async () => {
    const agent = makeAgent('pinger');
    const mastra = makeMastra({ pinger: agent });

    await expect(
      mastra.schedules.create({ agentId: agent.id, cron: '*/5 * * * *', prompt: 'p', threadId: 't1' }),
    ).rejects.toThrow(/resourceId/);
  });

  it('rejects thread-only knobs when threadId is omitted', async () => {
    const agent = makeAgent('pinger');
    const mastra = makeMastra({ pinger: agent });

    await expect(
      mastra.schedules.create({ agentId: agent.id, cron: '*/5 * * * *', prompt: 'p', ifIdle: 'wake' } as any),
    ).rejects.toThrow(/threadId/);
  });

  it('rejects updating thread-only knobs on a threadless schedule', async () => {
    const agent = makeAgent('pinger');
    const mastra = makeMastra({ pinger: agent });

    const hb = await mastra.schedules.create({ agentId: agent.id, cron: '*/5 * * * *', prompt: 'p' });

    await expect(mastra.schedules.update(hb.id, { ifIdle: 'wake' } as any)).rejects.toThrow(/threadId/);
    await expect(mastra.schedules.update(hb.id, { ifActive: 'queue' } as any)).rejects.toThrow(/threadId/);
    await expect(mastra.schedules.update(hb.id, { signalType: 'notification' } as any)).rejects.toThrow(/threadId/);

    // A non-thread-scoped patch on the same threadless schedule still works.
    const patched = await mastra.schedules.update(hb.id, { prompt: 'changed' });
    expect(patched.prompt).toBe('changed');
  });

  it('refuses schedules when storage lacks the schedules domain', async () => {
    const agent = makeAgent('pinger');
    // Mastra now always backs `new Mastra({})` with an in-memory store (which
    // includes the schedules domain), so the guard can only be exercised by a
    // storage adapter that genuinely lacks the schedules domain.
    const storage = new MockStore();
    delete (storage.stores as Partial<typeof storage.stores>).schedules;
    const mastra = new Mastra({ logger: false, storage, agents: { pinger: agent } });
    await expect(mastra.schedules.create({ agentId: agent.id, cron: '*/5 * * * *', prompt: 'p' })).rejects.toThrow(
      /schedules/,
    );
  });

  it('delete removes the schedule by id', async () => {
    const agent = makeAgent('pinger');
    const mastra = makeMastra({ pinger: agent });

    const hb = await mastra.schedules.create({
      agentId: agent.id,
      cron: '*/5 * * * *',
      prompt: 'p',
      threadId: 't1',
      resourceId: 'u1',
    });
    expect(await mastra.schedules.get(hb.id)).not.toBeNull();

    await mastra.schedules.delete(hb.id);
    expect(await mastra.schedules.get(hb.id)).toBeNull();
  });

  it('delete is a no-op for unknown ids', async () => {
    const agent = makeAgent('pinger');
    const mastra = makeMastra({ pinger: agent });
    await expect(mastra.schedules.delete('agent_does-not-exist')).resolves.toBeUndefined();
  });

  it('list filters by agentId', async () => {
    const a = makeAgent('a');
    const b = makeAgent('b');
    const mastra = makeMastra({ a, b });

    await mastra.schedules.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'A' });
    await mastra.schedules.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'A2', threadId: 't', resourceId: 'r' });
    await mastra.schedules.create({ agentId: 'b', cron: '*/5 * * * *', prompt: 'B' });

    const aList = await mastra.schedules.list({ agentId: 'a' });
    expect(aList).toHaveLength(2);
    expect(aList.every(h => h.agentId === 'a')).toBe(true);

    const bList = await mastra.schedules.list({ agentId: 'b' });
    expect(bList).toHaveLength(1);
    expect(bList[0]!.agentId).toBe('b');
  });

  it('list supports filtering by threadId and name', async () => {
    const agent = makeAgent('pinger');
    const mastra = makeMastra({ pinger: agent });

    await mastra.schedules.create({
      agentId: agent.id,
      cron: '*/5 * * * *',
      prompt: 'a',
      name: 'morning',
      threadId: 't1',
      resourceId: 'u1',
    });
    await mastra.schedules.create({
      agentId: agent.id,
      cron: '*/5 * * * *',
      prompt: 'b',
      name: 'evening',
      threadId: 't1',
      resourceId: 'u1',
    });
    await mastra.schedules.create({
      agentId: agent.id,
      cron: '*/5 * * * *',
      prompt: 'c',
      threadId: 't2',
      resourceId: 'u1',
    });

    expect(await mastra.schedules.list({ agentId: agent.id, threadId: 't1' })).toHaveLength(2);
    expect(await mastra.schedules.list({ agentId: agent.id, name: 'morning' })).toHaveLength(1);
    expect(await mastra.schedules.list({ agentId: agent.id, threadId: 't2' })).toHaveLength(1);
  });
});
