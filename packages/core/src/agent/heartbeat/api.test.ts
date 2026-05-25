import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { Agent } from '../agent';
import { HEARTBEAT_SCHEDULE_PREFIX, HEARTBEAT_WORKFLOW_ID } from './types';

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

describe('Agent.setHeartbeat / clearHeartbeat / getHeartbeat / listHeartbeats', () => {
  it('creates a threadless heartbeat with deterministic id', async () => {
    const agent = makeAgent('pinger');
    makeMastra({ pinger: agent });

    const schedule = await agent.setHeartbeat({
      cron: '*/5 * * * *',
      prompt: 'ping',
    });

    expect(schedule.id).toBe(`${HEARTBEAT_SCHEDULE_PREFIX}pinger`);
    expect(schedule.ownerType).toBe('agent');
    expect(schedule.ownerId).toBe('pinger');
    expect(schedule.target.type).toBe('workflow');
    expect((schedule.target as any).workflowId).toBe(HEARTBEAT_WORKFLOW_ID);
    expect((schedule.target as any).inputData).toMatchObject({
      agentId: 'pinger',
      prompt: 'ping',
    });
    expect((schedule.target as any).inputData.threadId).toBeUndefined();
    expect(schedule.status).toBe('active');
    expect(typeof schedule.nextFireAt).toBe('number');
  });

  it('creates a threaded heartbeat with deterministic per-thread id', async () => {
    const agent = makeAgent('pinger');
    makeMastra({ pinger: agent });

    const schedule = await agent.setHeartbeat({
      cron: '*/5 * * * *',
      prompt: 'check in',
      threadId: 't1',
      resourceId: 'u1',
      signalType: 'system-reminder',
      ifActive: 'persist',
      ifIdle: 'wake',
    });

    expect(schedule.id).toBe(`${HEARTBEAT_SCHEDULE_PREFIX}pinger_t1`);
    expect((schedule.target as any).inputData).toMatchObject({
      threadId: 't1',
      resourceId: 'u1',
      signalType: 'system-reminder',
      ifActive: 'persist',
      ifIdle: 'wake',
    });
  });

  it('upserts when called twice with the same id', async () => {
    const agent = makeAgent('pinger');
    makeMastra({ pinger: agent });

    const first = await agent.setHeartbeat({ cron: '*/5 * * * *', prompt: 'a' });
    const second = await agent.setHeartbeat({ cron: '*/10 * * * *', prompt: 'b' });

    expect(second.id).toBe(first.id);
    expect(second.cron).toBe('*/10 * * * *');
    expect((second.target as any).inputData.prompt).toBe('b');

    const list = await agent.listHeartbeats();
    expect(list).toHaveLength(1);
  });

  it('rejects invalid cron', async () => {
    const agent = makeAgent('pinger');
    makeMastra({ pinger: agent });

    await expect(agent.setHeartbeat({ cron: 'not-a-cron', prompt: 'p' })).rejects.toThrow();
  });

  it('rejects threadId without resourceId', async () => {
    const agent = makeAgent('pinger');
    makeMastra({ pinger: agent });

    await expect(agent.setHeartbeat({ cron: '*/5 * * * *', prompt: 'p', threadId: 't1' })).rejects.toThrow(
      /resourceId/,
    );
  });

  it('rejects thread-only knobs when threadId is omitted', async () => {
    const agent = makeAgent('pinger');
    makeMastra({ pinger: agent });

    await expect(agent.setHeartbeat({ cron: '*/5 * * * *', prompt: 'p', ifIdle: 'wake' }) as any).rejects.toThrow(
      /threadId/,
    );
  });

  it('refuses heartbeats when no Mastra storage adapter exists', async () => {
    const agent = makeAgent('pinger');
    // Mastra registered without storage.
    new Mastra({ logger: false, agents: { pinger: agent } });
    await expect(agent.setHeartbeat({ cron: '*/5 * * * *', prompt: 'p' })).rejects.toThrow(/schedules/);
  });

  it('refuses heartbeats when agent is unregistered', async () => {
    const agent = makeAgent('pinger');
    await expect(agent.setHeartbeat({ cron: '*/5 * * * *', prompt: 'p' })).rejects.toThrow(/Mastra/);
  });

  it('clearHeartbeat removes the heartbeat by threadId', async () => {
    const agent = makeAgent('pinger');
    makeMastra({ pinger: agent });

    await agent.setHeartbeat({ cron: '*/5 * * * *', prompt: 'p', threadId: 't1', resourceId: 'u1' });
    expect(await agent.getHeartbeat('t1')).not.toBeNull();

    await agent.clearHeartbeat('t1');
    expect(await agent.getHeartbeat('t1')).toBeNull();
  });

  it('clearHeartbeat is a no-op for unknown ids', async () => {
    const agent = makeAgent('pinger');
    makeMastra({ pinger: agent });
    await expect(agent.clearHeartbeat('nope')).resolves.toBeUndefined();
  });

  it('clearHeartbeat refuses to delete heartbeats owned by other agents', async () => {
    const a = makeAgent('a');
    const b = makeAgent('b');
    makeMastra({ a, b });
    await a.setHeartbeat({ cron: '*/5 * * * *', prompt: 'p' });
    // Try to delete a's heartbeat by spoofing its full id from b
    await expect(b.clearHeartbeat(`${HEARTBEAT_SCHEDULE_PREFIX}a`)).rejects.toThrow(/not owned/);
  });

  it('getHeartbeat returns null for non-owned schedules', async () => {
    const a = makeAgent('a');
    const b = makeAgent('b');
    makeMastra({ a, b });
    await a.setHeartbeat({ cron: '*/5 * * * *', prompt: 'p' });
    expect(await b.getHeartbeat(`${HEARTBEAT_SCHEDULE_PREFIX}a`)).toBeNull();
  });

  it('listHeartbeats only returns this agent`s heartbeats', async () => {
    const a = makeAgent('a');
    const b = makeAgent('b');
    makeMastra({ a, b });

    await a.setHeartbeat({ cron: '*/5 * * * *', prompt: 'A' });
    await a.setHeartbeat({ cron: '*/5 * * * *', prompt: 'A2', threadId: 't', resourceId: 'r' });
    await b.setHeartbeat({ cron: '*/5 * * * *', prompt: 'B' });

    const aList = await a.listHeartbeats();
    expect(aList).toHaveLength(2);
    expect(aList.every(s => s.ownerId === 'a')).toBe(true);

    const bList = await b.listHeartbeats();
    expect(bList).toHaveLength(1);
    expect(bList[0]!.ownerId).toBe('b');
  });
});
