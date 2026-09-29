import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThreadScheduler } from './scheduler.js';
import { createScheduleTools, SCHEDULE_TOOL_IDS } from './tools.js';

const THREAD = { agent: { threadId: 'thread-1', resourceId: 'res-1' } };
const OTHER_THREAD = { agent: { threadId: 'thread-2', resourceId: 'res-1' } };

const FIVE_MIN = { kind: 'every' as const, interval: { ms: 300_000, label: '5m' } };
const every = (interval: string) => ({ kind: 'every', interval });

const schedulers: ThreadScheduler[] = [];

function setup(files: Record<string, object> = {}) {
  let release: (() => void) | undefined;
  const assemblePrompt = vi.fn(
    async () =>
      new Promise<{ prompt: string }>(resolve => {
        release = () => resolve({ prompt: 'p' });
      }),
  );
  const deliver = vi.fn(async () => {});
  const scheduler = new ThreadScheduler({ assemblePrompt, deliver });
  schedulers.push(scheduler);
  const tools = createScheduleTools({
    scheduler,
    fileOptions: () => ({
      cwd: '/project',
      fileExists: absPath => absPath in files,
    }),
  });
  return { scheduler, tools, assemblePrompt, deliver, release: () => release!() };
}

async function exec(tool: { execute?: (...args: any[]) => any }, input: unknown, context: unknown = THREAD) {
  return tool.execute!(input, context);
}

afterEach(() => {
  for (const scheduler of schedulers.splice(0)) scheduler.stop();
});

describe('schedule tools', () => {
  it('exposes the schedule tools', () => {
    const { tools } = setup();
    expect(Object.keys(tools).sort()).toEqual(Object.values(SCHEDULE_TOOL_IDS).sort());
  });

  describe('schedule_create input schema', () => {
    const { tools } = setup();
    const schema = tools.schedule_create.inputSchema!;

    it('accepts a supported interval with a prompt', () => {
      expect(schema.safeParse({ trigger: every('5m'), prompt: 'check CI' }).success).toBe(true);
    });

    it.each(['30s', '90m', '7m', '2d', 'soon'])('rejects interval %s', interval => {
      expect(schema.safeParse({ trigger: every(interval), prompt: 'x' }).success).toBe(false);
    });

    it('suggests the nearest supported interval', () => {
      const result = schema.safeParse({ trigger: every('90m'), prompt: 'x' });
      expect(JSON.stringify(result.error)).toContain('2h');
    });

    it('rejects unknown trigger kinds', () => {
      expect(schema.safeParse({ trigger: { kind: 'at', at: '2026-01-01' }, prompt: 'x' }).success).toBe(false);
    });

    it('requires exactly one source', () => {
      expect(schema.safeParse({ trigger: every('5m') }).success).toBe(false);
      expect(schema.safeParse({ trigger: every('5m'), prompt: 'x', script: './a.sh' }).success).toBe(false);
      expect(schema.safeParse({ trigger: every('5m'), promptFile: 'a.md', script: './a.sh' }).success).toBe(false);
    });

    it('only allows extraPrompt with a script', () => {
      expect(schema.safeParse({ trigger: every('5m'), prompt: 'x', extraPrompt: 'y' }).success).toBe(false);
      expect(schema.safeParse({ trigger: every('5m'), promptFile: 'a.md', extraPrompt: 'y' }).success).toBe(false);
      expect(schema.safeParse({ trigger: every('5m'), script: './a.sh', extraPrompt: 'y' }).success).toBe(true);
    });
  });

  it('creates a prompt schedule bound to the calling thread, marked as agent-created', async () => {
    const { tools, scheduler } = setup();
    const result = await exec(tools.schedule_create, { trigger: every('5m'), prompt: 'check CI' });
    expect(result.isError).toBeUndefined();
    const [schedule] = scheduler.list();
    expect(schedule).toMatchObject({
      threadId: 'thread-1',
      resourceId: 'res-1',
      prompt: 'check CI',
      createdBy: 'agent',
      trigger: { kind: 'every', interval: { label: '5m' } },
    });
    expect(result.content).toContain(schedule!.id.slice(0, 8));
  });

  it('resolves script and prompt files against the project', async () => {
    const { tools, scheduler } = setup({ '/project/check.sh': {}, '/project/notes.md': {} });
    await exec(tools.schedule_create, { trigger: every('1h'), script: './check.sh', extraPrompt: 'summarize' });
    await exec(tools.schedule_create, { trigger: every('1h'), promptFile: 'notes.md' });
    const [script, notes] = scheduler.list();
    expect(script).toMatchObject({ file: { path: '/project/check.sh', mode: 'script' }, extraPrompt: 'summarize' });
    expect(notes).toMatchObject({ file: { path: '/project/notes.md', mode: 'prompt' } });
  });

  it('refuses a missing file instead of sending its path as the prompt', async () => {
    const { tools, scheduler } = setup();
    const result = await exec(tools.schedule_create, { trigger: every('5m'), script: './missing.sh' });
    expect(result).toEqual({ content: 'File not found: ./missing.sh', isError: true });
    expect(scheduler.list()).toHaveLength(0);
  });

  it('requires a memory-backed thread', async () => {
    const { tools, scheduler } = setup();
    const result = await exec(tools.schedule_create, { trigger: every('5m'), prompt: 'x' }, {});
    expect(result.isError).toBe(true);
    expect(scheduler.list()).toHaveLength(0);
  });

  it("lists and manages only the calling thread's schedules", async () => {
    const { tools, scheduler } = setup();
    const mine = scheduler.create({ trigger: FIVE_MIN, prompt: 'mine' }, THREAD.agent);
    const theirs = scheduler.create({ trigger: FIVE_MIN, prompt: 'theirs' }, OTHER_THREAD.agent);

    const list = await exec(tools.schedule_list, {});
    expect(list.content).toContain('"mine"');
    expect(list.content).toContain('created by user');
    expect(list.content).not.toContain('"theirs"');

    const denied = await exec(tools.schedule_update, { id: theirs.id, action: 'delete' });
    expect(denied.isError).toBe(true);
    expect(scheduler.list()).toHaveLength(2);

    await exec(tools.schedule_update, { id: mine.id.slice(0, 8), action: 'pause' });
    expect(scheduler.list({ threadId: 'thread-1' })[0]!.status).toBe('paused');
    const viaUpdate = await exec(tools.schedule_update, { id: mine.id.slice(0, 8), action: 'resume' });
    expect(viaUpdate).toMatchObject({ error: true });
    expect(scheduler.list({ threadId: 'thread-1' })[0]!.status).toBe('paused');
    await exec(tools.schedule_resume, { id: mine.id.slice(0, 8) });
    expect(scheduler.list({ threadId: 'thread-1' })[0]!.status).toBe('active');
    const deleted = await exec(tools.schedule_update, { id: mine.id.slice(0, 8), action: 'delete' });
    expect(deleted.content).toBe(`Deleted schedule ${mine.id.slice(0, 8)}.`);
    expect(scheduler.list({ threadId: 'thread-1' })).toHaveLength(0);
  });

  it('runs a schedule once, and skips while it is still firing', async () => {
    const { tools, scheduler, assemblePrompt, release } = setup();
    const schedule = scheduler.create({ trigger: FIVE_MIN, prompt: 'x' }, THREAD.agent);

    const first = exec(tools.schedule_run, { id: schedule.id });
    await vi.waitFor(() => expect(assemblePrompt).toHaveBeenCalledTimes(1));
    const second = await exec(tools.schedule_run, { id: schedule.id });
    expect(second.content).toContain('already firing');
    release();
    expect((await first).content).toContain('Triggered schedule');
    expect(assemblePrompt).toHaveBeenCalledTimes(1);
  });

  it('reports a run that never reached the agent as an error', async () => {
    const { tools, scheduler, deliver, release } = setup();
    deliver.mockRejectedValueOnce(new Error('thread blocked'));
    const schedule = scheduler.create({ trigger: FIVE_MIN, prompt: 'x' }, THREAD.agent);
    const result = exec(tools.schedule_run, { id: schedule.id });
    await vi.waitFor(() => release());
    await expect(result).resolves.toEqual({
      content: `Schedule ${schedule.id.slice(0, 8)} failed to fire: thread blocked`,
      isError: true,
    });
  });

  it('reports an unknown id', async () => {
    const { tools } = setup();
    const result = await exec(tools.schedule_run, { id: 'nope' });
    expect(result).toEqual({ content: 'No schedule "nope" on this thread.', isError: true });
  });
});
