import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
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

function makeMastra(agentIds: string[]) {
  const agents = Object.fromEntries(agentIds.map(id => [id, makeAgent(id)])) as Record<string, Agent>;
  const mastra = new Mastra({ logger: false, storage: new MockStore(), agents });
  return { mastra, agents };
}

describe('mastra.heartbeats canonical service', () => {
  it('creates heartbeats for any registered agent and gets them back', async () => {
    const { mastra } = makeMastra(['a', 'b']);

    const aHb = await mastra.heartbeats.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'A' });
    const bHb = await mastra.heartbeats.create({
      agentId: 'b',
      cron: '*/10 * * * *',
      prompt: 'B',
      name: 'nightly',
    });

    expect(aHb.id).not.toBe(bHb.id);
    expect(aHb.id.startsWith(HEARTBEAT_SCHEDULE_PREFIX)).toBe(true);
    expect(bHb.name).toBe('nightly');

    expect((await mastra.heartbeats.get(aHb.id))?.agentId).toBe('a');
    expect((await mastra.heartbeats.get(bHb.id))?.agentId).toBe('b');
  });

  it('accepts a custom id, normalizing it to hb_<slug>', async () => {
    const { mastra } = makeMastra(['a']);

    const withRaw = await mastra.heartbeats.create({
      agentId: 'a',
      cron: '*/5 * * * *',
      prompt: 'A',
      id: 'Nightly Summary!',
    });
    expect(withRaw.id).toBe(`${HEARTBEAT_SCHEDULE_PREFIX}nightly-summary`);
    expect((await mastra.heartbeats.get(withRaw.id))?.agentId).toBe('a');

    const withPrefix = await mastra.heartbeats.create({
      agentId: 'a',
      cron: '*/5 * * * *',
      prompt: 'B',
      id: 'hb_morning-report',
    });
    expect(withPrefix.id).toBe(`${HEARTBEAT_SCHEDULE_PREFIX}morning-report`);
  });

  it('resolves lookups by the prefixed stored id and the bare caller id alike', async () => {
    const { mastra } = makeMastra(['a']);

    const hb = await mastra.heartbeats.create({
      agentId: 'a',
      cron: '*/5 * * * *',
      prompt: 'A',
      id: 'Nightly Summary!',
    });
    expect(hb.id).toBe(`${HEARTBEAT_SCHEDULE_PREFIX}nightly-summary`);

    // The fully-formed stored id resolves verbatim (no re-slugification).
    expect((await mastra.heartbeats.get(hb.id))?.id).toBe(hb.id);
    // The bare caller id resolves to the same heartbeat.
    expect((await mastra.heartbeats.get('Nightly Summary!'))?.id).toBe(hb.id);
  });

  it('throws when creating a heartbeat with an id that already exists', async () => {
    const { mastra } = makeMastra(['a']);
    await mastra.heartbeats.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'A', id: 'dupe' });

    await expect(
      mastra.heartbeats.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'B', id: 'dupe' }),
    ).rejects.toThrow(/already exists/);
  });

  it('throws when a custom id is empty after normalization', async () => {
    const { mastra } = makeMastra(['a']);
    await expect(
      mastra.heartbeats.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'A', id: '!!!' }),
    ).rejects.toThrow(/empty after normalization/);
  });

  it('list with no filter returns heartbeats across agents', async () => {
    const { mastra } = makeMastra(['a', 'b']);
    await mastra.heartbeats.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'A' });
    await mastra.heartbeats.create({ agentId: 'b', cron: '*/5 * * * *', prompt: 'B' });

    const all = await mastra.heartbeats.list();
    expect(all).toHaveLength(2);
    expect(new Set(all.map(h => h.agentId))).toEqual(new Set(['a', 'b']));
  });

  it('list filters by agentId, threadId, resourceId, name', async () => {
    const { mastra } = makeMastra(['a']);

    await mastra.heartbeats.create({
      agentId: 'a',
      cron: '*/5 * * * *',
      prompt: 'morning',
      name: 'morning',
      threadId: 't1',
      resourceId: 'u1',
    });
    await mastra.heartbeats.create({
      agentId: 'a',
      cron: '*/5 * * * *',
      prompt: 'evening',
      name: 'evening',
      threadId: 't1',
      resourceId: 'u1',
    });
    await mastra.heartbeats.create({
      agentId: 'a',
      cron: '*/5 * * * *',
      prompt: 'other',
      threadId: 't2',
      resourceId: 'u2',
    });

    expect(await mastra.heartbeats.list({ agentId: 'a' })).toHaveLength(3);
    expect(await mastra.heartbeats.list({ threadId: 't1' })).toHaveLength(2);
    expect(await mastra.heartbeats.list({ resourceId: 'u2' })).toHaveLength(1);
    expect(await mastra.heartbeats.list({ name: 'morning' })).toHaveLength(1);
    expect(await mastra.heartbeats.list({ threadId: 't1', name: 'evening' })).toHaveLength(1);
  });

  it('update patches cron + prompt + name and recomputes nextFireAt for cron changes', async () => {
    // Pin the clock mid-hour so the original (*/5) and updated (0 * * * *)
    // crons resolve to different next-fire instants. Near the top of the hour
    // both crons coincide on the same boundary, which would make this flaky.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-23T12:30:00.000Z'));
    try {
      const { mastra } = makeMastra(['a']);
      const hb = await mastra.heartbeats.create({
        agentId: 'a',
        cron: '*/5 * * * *',
        prompt: 'old',
        name: 'old-name',
      });
      const prevNext = hb.nextFireAt;

      const patched = await mastra.heartbeats.update(hb.id, {
        cron: '0 * * * *',
        prompt: 'new',
        name: 'new-name',
      });

      expect(patched.cron).toBe('0 * * * *');
      expect(patched.prompt).toBe('new');
      expect(patched.name).toBe('new-name');
      expect(patched.nextFireAt).not.toBe(prevNext);
    } finally {
      vi.useRealTimers();
    }
  });

  it('pause and resume flip status and clear/recompute nextFireAt', async () => {
    const { mastra } = makeMastra(['a']);
    const hb = await mastra.heartbeats.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'p' });
    expect(hb.status).toBe('active');

    const paused = await mastra.heartbeats.pause(hb.id);
    expect(paused.status).toBe('paused');

    const resumed = await mastra.heartbeats.resume(hb.id);
    expect(resumed.status).toBe('active');
    expect(typeof resumed.nextFireAt).toBe('number');
  });

  it('update({ status: active }) on a paused heartbeat recomputes nextFireAt like resume()', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-23T12:30:00.000Z'));
    try {
      const { mastra } = makeMastra(['a']);
      const hb = await mastra.heartbeats.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'p' });

      const paused = await mastra.heartbeats.pause(hb.id);
      expect(paused.status).toBe('paused');
      const staleNext = paused.nextFireAt;

      // Advance well past the paused nextFireAt so a naive status flip would
      // leave a stale (past) fire time and trigger an immediate spurious run.
      vi.advanceTimersByTime(30 * 60 * 1000);

      const resumedViaUpdate = await mastra.heartbeats.update(hb.id, { status: 'active' });
      expect(resumedViaUpdate.status).toBe('active');
      // Must be recomputed forward from "now", not the stale paused value.
      expect(resumedViaUpdate.nextFireAt).not.toBe(staleNext);
      expect(resumedViaUpdate.nextFireAt).toBeGreaterThan(Date.now());
    } finally {
      vi.useRealTimers();
    }
  });

  it('update without a resume does not recompute nextFireAt', async () => {
    const { mastra } = makeMastra(['a']);
    const hb = await mastra.heartbeats.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'p' });
    const prevNext = hb.nextFireAt;

    const patched = await mastra.heartbeats.update(hb.id, { prompt: 'changed' });
    expect(patched.prompt).toBe('changed');
    expect(patched.nextFireAt).toBe(prevNext);
  });

  it('delete is idempotent', async () => {
    const { mastra } = makeMastra(['a']);
    const hb = await mastra.heartbeats.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'p' });

    await mastra.heartbeats.delete(hb.id);
    await expect(mastra.heartbeats.delete(hb.id)).resolves.toBeUndefined();
    expect(await mastra.heartbeats.get(hb.id)).toBeNull();
  });

  it('get returns null for unknown ids and for non-heartbeat schedule rows', async () => {
    const { mastra } = makeMastra(['a']);
    expect(await mastra.heartbeats.get('hb_nope')).toBeNull();
  });

  it('reuses the same Heartbeats instance across getter accesses', () => {
    const { mastra } = makeMastra(['a']);
    expect(mastra.heartbeats).toBe(mastra.heartbeats);
  });
});
