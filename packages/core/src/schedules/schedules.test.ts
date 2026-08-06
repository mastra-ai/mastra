import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent/agent';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import type { AgentSchedule } from './schedules';
import { AGENT_SCHEDULE_PREFIX, WORKFLOW_SCHEDULE_PREFIX } from './types';

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

describe('mastra.schedules canonical service', () => {
  it('creates agent schedules for any registered agent and gets them back', async () => {
    const { mastra } = makeMastra(['a', 'b']);

    const aHb = await mastra.schedules.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'A' });
    const bHb = await mastra.schedules.create({
      agentId: 'b',
      cron: '*/10 * * * *',
      prompt: 'B',
      name: 'nightly',
    });

    expect(aHb.id).not.toBe(bHb.id);
    expect(aHb.id.startsWith(AGENT_SCHEDULE_PREFIX)).toBe(true);
    expect(bHb.name).toBe('nightly');

    expect((await mastra.schedules.get(aHb.id))?.agentId).toBe('a');
    expect((await mastra.schedules.get(bHb.id))?.agentId).toBe('b');
  });

  it('accepts a custom id, normalizing it to agent_<slug>', async () => {
    const { mastra } = makeMastra(['a']);

    const withRaw = await mastra.schedules.create({
      agentId: 'a',
      cron: '*/5 * * * *',
      prompt: 'A',
      id: 'Nightly Summary!',
    });
    expect(withRaw.id).toBe(`${AGENT_SCHEDULE_PREFIX}nightly-summary`);
    expect((await mastra.schedules.get(withRaw.id))?.agentId).toBe('a');

    const withPrefix = await mastra.schedules.create({
      agentId: 'a',
      cron: '*/5 * * * *',
      prompt: 'B',
      id: 'agent_morning-report',
    });
    expect(withPrefix.id).toBe(`${AGENT_SCHEDULE_PREFIX}morning-report`);
  });

  it('resolves lookups by the prefixed stored id and the bare caller id alike', async () => {
    const { mastra } = makeMastra(['a']);

    const hb = await mastra.schedules.create({
      agentId: 'a',
      cron: '*/5 * * * *',
      prompt: 'A',
      id: 'Nightly Summary!',
    });
    expect(hb.id).toBe(`${AGENT_SCHEDULE_PREFIX}nightly-summary`);

    // The fully-formed stored id resolves verbatim (no re-slugification).
    expect((await mastra.schedules.get(hb.id))?.id).toBe(hb.id);
    // The bare caller id resolves to the same schedule.
    expect((await mastra.schedules.get('Nightly Summary!'))?.id).toBe(hb.id);
  });

  it('throws when creating a schedule with an id that already exists', async () => {
    const { mastra } = makeMastra(['a']);
    await mastra.schedules.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'A', id: 'dupe' });

    await expect(
      mastra.schedules.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'B', id: 'dupe' }),
    ).rejects.toThrow(/already exists/);
  });

  it('throws when a custom id is empty after normalization', async () => {
    const { mastra } = makeMastra(['a']);
    await expect(
      mastra.schedules.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'A', id: '!!!' }),
    ).rejects.toThrow(/empty after normalization/);
  });

  it('list with no filter returns schedules across agents', async () => {
    const { mastra } = makeMastra(['a', 'b']);
    await mastra.schedules.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'A' });
    await mastra.schedules.create({ agentId: 'b', cron: '*/5 * * * *', prompt: 'B' });

    const all = await mastra.schedules.list();
    expect(all).toHaveLength(2);
    expect(new Set(all.map(h => h.agentId))).toEqual(new Set(['a', 'b']));
  });

  it('list filters by agentId, threadId, resourceId, name', async () => {
    const { mastra } = makeMastra(['a']);

    await mastra.schedules.create({
      agentId: 'a',
      cron: '*/5 * * * *',
      prompt: 'morning',
      name: 'morning',
      threadId: 't1',
      resourceId: 'u1',
    });
    await mastra.schedules.create({
      agentId: 'a',
      cron: '*/5 * * * *',
      prompt: 'evening',
      name: 'evening',
      threadId: 't1',
      resourceId: 'u1',
    });
    await mastra.schedules.create({
      agentId: 'a',
      cron: '*/5 * * * *',
      prompt: 'other',
      threadId: 't2',
      resourceId: 'u2',
    });

    expect(await mastra.schedules.list({ agentId: 'a' })).toHaveLength(3);
    expect(await mastra.schedules.list({ threadId: 't1' })).toHaveLength(2);
    expect(await mastra.schedules.list({ resourceId: 'u2' })).toHaveLength(1);
    expect(await mastra.schedules.list({ name: 'morning' })).toHaveLength(1);
    expect(await mastra.schedules.list({ threadId: 't1', name: 'evening' })).toHaveLength(1);
  });

  it('update patches cron + prompt + name and recomputes nextFireAt for cron changes', async () => {
    // Pin the clock mid-hour so the original (*/5) and updated (0 * * * *)
    // crons resolve to different next-fire instants. Near the top of the hour
    // both crons coincide on the same boundary, which would make this flaky.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-23T12:30:00.000Z'));
    try {
      const { mastra } = makeMastra(['a']);
      const hb = await mastra.schedules.create({
        agentId: 'a',
        cron: '*/5 * * * *',
        prompt: 'old',
        name: 'old-name',
      });
      const prevNext = hb.nextFireAt;

      const patched = (await mastra.schedules.update(hb.id, {
        cron: '0 * * * *',
        prompt: 'new',
        name: 'new-name',
      })) as AgentSchedule;

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
    const hb = await mastra.schedules.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'p' });
    expect(hb.status).toBe('active');

    const paused = await mastra.schedules.pause(hb.id);
    expect(paused.status).toBe('paused');

    const resumed = await mastra.schedules.resume(hb.id);
    expect(resumed.status).toBe('active');
    expect(typeof resumed.nextFireAt).toBe('number');
  });

  it('update({ status: active }) on a paused schedule recomputes nextFireAt like resume()', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-23T12:30:00.000Z'));
    try {
      const { mastra } = makeMastra(['a']);
      const hb = await mastra.schedules.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'p' });

      const paused = await mastra.schedules.pause(hb.id);
      expect(paused.status).toBe('paused');
      const staleNext = paused.nextFireAt;

      // Advance well past the paused nextFireAt so a naive status flip would
      // leave a stale (past) fire time and trigger an immediate spurious run.
      vi.advanceTimersByTime(30 * 60 * 1000);

      const resumedViaUpdate = await mastra.schedules.update(hb.id, { status: 'active' });
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
    const hb = await mastra.schedules.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'p' });
    const prevNext = hb.nextFireAt;

    const patched = (await mastra.schedules.update(hb.id, { prompt: 'changed' })) as AgentSchedule;
    expect(patched.prompt).toBe('changed');
    expect(patched.nextFireAt).toBe(prevNext);
  });

  it('delete is idempotent', async () => {
    const { mastra } = makeMastra(['a']);
    const hb = await mastra.schedules.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'p' });

    await mastra.schedules.delete(hb.id);
    await expect(mastra.schedules.delete(hb.id)).resolves.toBeUndefined();
    expect(await mastra.schedules.get(hb.id)).toBeNull();
  });

  it('get returns null for unknown ids and for workflow-target rows it cannot match', async () => {
    const { mastra } = makeMastra(['a']);
    expect(await mastra.schedules.get('agent_nope')).toBeNull();

    const wf = await mastra.schedules.create({ workflowId: 'daily-report', cron: '0 6 * * *' });
    // An agent-prefixed id must not resolve to a workflow-target row.
    expect(await mastra.schedules.get(`agent_${wf.id.slice('schedule_'.length)}`)).toBeNull();
  });

  it('reuses the same Schedules instance across getter accesses', () => {
    const { mastra } = makeMastra(['a']);
    expect(mastra.schedules).toBe(mastra.schedules);
  });

  describe('workflow targets', () => {
    it('creates a workflow schedule with a schedule_ id (never wf_) and round-trips it', async () => {
      const { mastra } = makeMastra(['a']);

      const wf = await mastra.schedules.create({
        workflowId: 'daily-report',
        cron: '0 6 * * *',
        inputData: { region: 'us' },
      });
      expect(wf.id.startsWith(WORKFLOW_SCHEDULE_PREFIX)).toBe(true);
      expect(wf.id.startsWith('wf_')).toBe(false);
      expect(wf.workflowId).toBe('daily-report');
      expect(wf.inputData).toEqual({ region: 'us' });

      const fetched = await mastra.schedules.get(wf.id);
      expect(fetched?.workflowId).toBe('daily-report');
      expect(fetched?.agentId).toBeUndefined();
    });

    it('normalizes custom workflow-schedule ids to schedule_<slug>', async () => {
      const { mastra } = makeMastra(['a']);
      const wf = await mastra.schedules.create({
        workflowId: 'daily-report',
        cron: '0 6 * * *',
        id: 'Morning Report!',
      });
      expect(wf.id).toBe(`${WORKFLOW_SCHEDULE_PREFIX}morning-report`);
    });

    it('list mixes agent and workflow schedules; agentId/workflowId filters split them', async () => {
      const { mastra } = makeMastra(['a']);
      await mastra.schedules.create({ agentId: 'a', cron: '*/5 * * * *', prompt: 'A' });
      await mastra.schedules.create({ workflowId: 'daily-report', cron: '0 6 * * *' });

      const all = await mastra.schedules.list();
      expect(all).toHaveLength(2);

      const agentOnly = await mastra.schedules.list({ agentId: 'a' });
      expect(agentOnly).toHaveLength(1);
      expect(agentOnly[0]!.agentId).toBe('a');

      const wfOnly = await mastra.schedules.list({ workflowId: 'daily-report' });
      expect(wfOnly).toHaveLength(1);
      expect(wfOnly[0]!.workflowId).toBe('daily-report');
    });

    it('pause/resume and update work on workflow schedules; agent-only patches are rejected', async () => {
      const { mastra } = makeMastra(['a']);
      const wf = await mastra.schedules.create({ workflowId: 'daily-report', cron: '0 6 * * *' });

      const paused = await mastra.schedules.pause(wf.id);
      expect(paused.status).toBe('paused');
      const resumed = await mastra.schedules.resume(wf.id);
      expect(resumed.status).toBe('active');

      const updated = await mastra.schedules.update(wf.id, { inputData: { region: 'eu' } });
      expect(updated.workflowId).toBe('daily-report');
      expect((updated as { inputData?: unknown }).inputData).toEqual({ region: 'eu' });

      await expect(mastra.schedules.update(wf.id, { prompt: 'nope' })).rejects.toThrow(/only apply to agent schedules/);
    });

    it('run publishes workflow.start and records a manual trigger row', async () => {
      const { mastra } = makeMastra(['a']);
      const wf = await mastra.schedules.create({ workflowId: 'daily-report', cron: '0 6 * * *' });

      const publishSpy = vi.spyOn(mastra.pubsub, 'publish');
      const fired = await mastra.schedules.run(wf.id);
      expect(fired.scheduleId).toBe(wf.id);
      expect(fired.claimId.startsWith(`sched_${wf.id}_`)).toBe(true);

      const workflowStart = publishSpy.mock.calls.find(([topic]) => topic === 'workflows');
      expect(workflowStart?.[1]).toMatchObject({
        type: 'workflow.start',
        runId: fired.claimId,
        data: { workflowId: 'daily-report', runId: fired.claimId },
      });

      const store = (await mastra.getStorage()!.getStore('schedules'))!;
      const triggers = await store.listTriggers(wf.id);
      expect(triggers).toHaveLength(1);
      expect(triggers[0]).toMatchObject({ runId: fired.claimId, outcome: 'published', triggerKind: 'manual' });
    });
  });
});
