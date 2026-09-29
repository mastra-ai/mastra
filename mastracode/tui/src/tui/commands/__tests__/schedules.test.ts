import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ThreadScheduler } from '@mastra/code-sdk/schedules';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ModalQuestionOptions } from '../../modal-question.js';
import { formatNextFire, handleSchedulesCommand } from '../schedules.js';
import type { SlashCommandContext } from '../types.js';

const modal = vi.hoisted(() => ({ askModalQuestion: vi.fn() }));
vi.mock('../../modal-question.js', () => ({ askModalQuestion: modal.askModalQuestion }));

let workspaceDir: string;

beforeAll(() => {
  workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-schedules-cmd-'));
  fs.writeFileSync(path.join(workspaceDir, 'check.sh'), '#!/bin/sh\necho ok\n', { mode: 0o755 });
  fs.writeFileSync(path.join(workspaceDir, 'notes.md'), '# notes\n');
});

afterAll(() => {
  fs.rmSync(workspaceDir, { recursive: true, force: true });
});

const schedulers: ThreadScheduler[] = [];
afterEach(() => {
  for (const scheduler of schedulers.splice(0)) scheduler.stop();
});

/** Questions the command asked, in order. */
let asked: ModalQuestionOptions[];

/** Answer each modal question in turn; `null` is Esc. */
function answer(...answers: Array<string | null>) {
  modal.askModalQuestion.mockImplementation(async (_ui: unknown, options: ModalQuestionOptions) => {
    asked.push(options);
    if (answers.length === 0) throw new Error(`Unexpected question: ${options.question}`);
    return answers.shift()!;
  });
}

beforeEach(() => {
  asked = [];
  modal.askModalQuestion.mockReset();
});

function createContext(
  options: { threadId?: string | undefined; scheduler?: boolean; pendingNewThread?: boolean } = {},
) {
  const deliver = vi.fn(async (_schedule: unknown, _assembled: { prompt: string }) => {});
  const assemblePrompt = vi.fn(
    async (s: { prompt?: string }): Promise<{ prompt: string }> => ({
      prompt: s.prompt ?? '',
    }),
  );
  const scheduler = new ThreadScheduler({ assemblePrompt, deliver });
  schedulers.push(scheduler);
  let threadId = 'threadId' in options ? options.threadId : 'thread-1';
  const session = {
    identity: { getResourceId: vi.fn(() => 'resource-1') },
    thread: {
      getId: vi.fn(() => threadId),
      create: vi.fn(async () => {
        threadId = 'thread-new';
        return { id: threadId };
      }),
      list: vi.fn(async () => [
        { id: 'thread-1', resourceId: 'resource-1' },
        { id: 'thread-new', resourceId: 'resource-1' },
      ]),
    },
  };
  const ctx = {
    state: {
      session,
      ui: {},
      projectInfo: { rootPath: workspaceDir },
      pendingNewThread: options.pendingNewThread ?? false,
    },
    threadScheduler: options.scheduler === false ? undefined : scheduler,
    showInfo: vi.fn(),
    showError: vi.fn(),
  } as unknown as SlashCommandContext;
  return {
    ctx,
    scheduler,
    deliver,
    assemblePrompt,
    session,
    showInfo: ctx.showInfo as ReturnType<typeof vi.fn>,
    showError: ctx.showError as ReturnType<typeof vi.fn>,
  };
}

const every5m = { trigger: { kind: 'every' as const, interval: { ms: 300_000, label: '5m' } } };
const optionLabels = (question: ModalQuestionOptions) => question.options?.map(option => option.label) ?? [];

describe('/schedules guards', () => {
  it('reports when no scheduler is available', async () => {
    const { ctx, showError } = createContext({ scheduler: false });
    await handleSchedulesCommand(ctx, []);
    expect(showError).toHaveBeenCalledWith(expect.stringContaining('Schedules are unavailable'));
  });

  it('rejects typed arguments instead of guessing at them', async () => {
    const { ctx, showError, scheduler } = createContext();
    await handleSchedulesCommand(ctx, ['create', '5m', './check.sh']);
    expect(showError).toHaveBeenCalledWith(expect.stringContaining('takes no arguments'));
    expect(modal.askModalQuestion).not.toHaveBeenCalled();
    expect(scheduler.list()).toEqual([]);
  });
});

describe('formatNextFire', () => {
  const at = (h: number, m: number, sec = 0, day = 29) => new Date(2026, 8, day, h, m, sec).getTime();

  it('shows the exact time and seconds when under a minute away', () => {
    expect(formatNextFire(at(17, 43), at(17, 42, 25))).toBe('17:43:00 (in 35s)');
  });

  it('shows minutes and seconds, dropping zero parts', () => {
    expect(formatNextFire(at(17, 45), at(17, 42, 25))).toBe('17:45:00 (in 2m 35s)');
    expect(formatNextFire(at(17, 45), at(17, 42))).toBe('17:45:00 (in 3m)');
  });

  it('shows hours and minutes for later fires', () => {
    expect(formatNextFire(at(20, 0), at(17, 42))).toBe('20:00:00 (in 2h 18m)');
  });

  it('adds the date when the fire is on another day', () => {
    expect(formatNextFire(at(0, 0, 0, 30), at(17, 44))).toMatch(/^Sep 30 00:00:00 \(in 6h 16m\)$/);
  });
});

describe('/schedules picker', () => {
  it('offers Create first, then one row per schedule on this thread', async () => {
    const { ctx, scheduler } = createContext();
    scheduler.create({ ...every5m, prompt: 'mine' }, { threadId: 'thread-1', resourceId: 'resource-1' });
    scheduler.create({ ...every5m, prompt: 'theirs' }, { threadId: 'other', resourceId: 'resource-1' });
    answer(null);
    await handleSchedulesCommand(ctx, []);
    const [picker] = asked;
    expect(picker!.question).toBe('Schedules on this thread (1):');
    expect(picker!.allowCustomResponse).toBe(false);
    expect(optionLabels(picker!)[0]).toBe('Create schedule');
    expect(picker!.options).toHaveLength(2);
    expect(picker!.options![1]).toMatchObject({
      label: expect.stringMatching(/every 5m · next at \d{2}:\d{2}:\d{2} \(in /),
      description: '"mine"',
    });
  });

  it('says when the thread has no schedules', async () => {
    const { ctx } = createContext();
    answer(null);
    await handleSchedulesCommand(ctx, []);
    expect(asked[0]!.question).toBe('No schedules on this thread yet.');
  });
});

describe('/schedules create', () => {
  it('creates a prompt schedule after confirmation', async () => {
    const { ctx, scheduler, showInfo } = createContext();
    answer('Create schedule', 'Prompt', 'check CI', '5m', 'Create');
    await handleSchedulesCommand(ctx, []);
    expect(scheduler.list()).toEqual([
      expect.objectContaining({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        prompt: 'check CI',
        trigger: { kind: 'every', interval: { ms: 300_000, label: '5m' } },
        createdBy: 'user',
      }),
    ]);
    expect(asked.at(-1)!.question).toContain('Create schedule every 5m — "check CI"?');
    expect(showInfo).toHaveBeenCalledWith(
      expect.stringMatching(/^Created schedule [0-9a-f]{8}: every 5m — "check CI", next at \d{2}:\d{2}:\d{2} \(in /),
    );
  });

  it('keeps a quoted prompt as typed', async () => {
    const { ctx, scheduler } = createContext();
    answer('Create schedule', 'Prompt', '"./check.sh"', '5m', 'Create');
    await handleSchedulesCommand(ctx, []);
    expect(scheduler.list()[0]).toMatchObject({ prompt: '"./check.sh"' });
  });

  it('creates a script schedule with an extra prompt', async () => {
    const { ctx, scheduler } = createContext();
    answer('Create schedule', 'Script', './check.sh', 'Report it', '1h', 'Create');
    await handleSchedulesCommand(ctx, []);
    expect(scheduler.list()[0]).toMatchObject({
      file: { path: path.join(workspaceDir, 'check.sh'), displayPath: './check.sh', mode: 'script' },
      extraPrompt: 'Report it',
    });
  });

  it('creates a prompt-file schedule, asking again until the path exists', async () => {
    const { ctx, scheduler } = createContext();
    answer('Create schedule', 'Prompt file', 'missing.md', 'notes.md', '1d', 'Create');
    await handleSchedulesCommand(ctx, []);
    expect(asked[3]!.question).toContain(`No file at ${path.join(workspaceDir, 'missing.md')}`);
    expect(scheduler.list()[0]).toMatchObject({
      file: { path: path.join(workspaceDir, 'notes.md'), mode: 'prompt' },
    });
    expect(scheduler.list()[0]!.extraPrompt).toBeUndefined();
  });

  it('accepts a custom cadence and asks again with a suggestion for an unsupported one', async () => {
    const { ctx, scheduler } = createContext();
    answer('Create schedule', 'Prompt', 'hi', '90m', '20m', 'Create');
    await handleSchedulesCommand(ctx, []);
    expect(asked[3]!.allowCustomResponse).toBe(true);
    expect(asked[4]!.question).toContain('Try 2h.');
    expect(scheduler.list()[0]!.trigger.interval.label).toBe('20m');
  });

  it('creates nothing when cancelled', async () => {
    const { ctx, scheduler, session } = createContext({ threadId: undefined });
    answer('Create schedule', 'Prompt', 'hi', '5m', 'Cancel');
    await handleSchedulesCommand(ctx, []);
    expect(scheduler.list()).toEqual([]);
    expect(session.thread.create).not.toHaveBeenCalled();
  });

  it('creates a thread first when the session has none yet', async () => {
    const { ctx, scheduler, session } = createContext({ threadId: undefined });
    answer('Create schedule', 'Prompt', 'hi', '5m', 'Create');
    await handleSchedulesCommand(ctx, []);
    expect(session.thread.create).toHaveBeenCalledTimes(1);
    expect(scheduler.list()).toEqual([expect.objectContaining({ threadId: 'thread-new' })]);
  });
});

describe('/schedules after /new', () => {
  it('binds a new schedule to the new thread, not the one just left', async () => {
    const { ctx, scheduler, session } = createContext({ pendingNewThread: true });
    answer('Create schedule', 'Prompt', 'hi', '5m', 'Create');
    await handleSchedulesCommand(ctx, []);
    expect(session.thread.create).toHaveBeenCalledTimes(1);
    expect(ctx.state.pendingNewThread).toBe(false);
    expect(scheduler.list()).toEqual([expect.objectContaining({ threadId: 'thread-new' })]);
  });

  it("does not list the previous thread's schedules", async () => {
    const { ctx, scheduler } = createContext({ pendingNewThread: true });
    scheduler.create({ ...every5m, prompt: 'old' }, { threadId: 'thread-1', resourceId: 'resource-1' });
    answer(null);
    await handleSchedulesCommand(ctx, []);
    expect(asked[0]!.options).toHaveLength(1);
  });
});

describe('/schedules manage', () => {
  function withSchedule() {
    const setup = createContext();
    const schedule = setup.scheduler.create(
      { ...every5m, prompt: 'ping' },
      { threadId: 'thread-1', resourceId: 'resource-1' },
    );
    return { ...setup, schedule };
  }
  /** Pick the schedule's row from the picker, whatever its timing text says. */
  function pickRow(...rest: Array<string | null>) {
    modal.askModalQuestion.mockImplementation(async (_ui: unknown, options: ModalQuestionOptions) => {
      asked.push(options);
      if (asked.length === 1) return options.options![1]!.label;
      if (rest.length === 0) throw new Error(`Unexpected question: ${options.question}`);
      return rest.shift()!;
    });
  }

  it('pauses and resumes', async () => {
    const { ctx, scheduler, schedule, showInfo } = withSchedule();
    pickRow('Pause');
    await handleSchedulesCommand(ctx, []);
    expect(optionLabels(asked[1]!)).toEqual(['Pause', 'Run now', 'Delete']);
    expect(scheduler.list()[0]!.status).toBe('paused');
    expect(showInfo).toHaveBeenLastCalledWith(`Paused schedule ${schedule.id.slice(0, 8)}.`);

    asked = [];
    pickRow('Resume');
    await handleSchedulesCommand(ctx, []);
    expect(asked[0]!.options![1]!.label).toContain('paused');
    expect(optionLabels(asked[1]!)).toEqual(['Resume', 'Run now', 'Delete']);
    expect(scheduler.list()[0]!.status).toBe('active');
  });

  it('runs now, even while paused', async () => {
    const { ctx, scheduler, schedule, deliver, showInfo } = withSchedule();
    scheduler.pause(schedule.id);
    pickRow('Run now');
    await handleSchedulesCommand(ctx, []);
    expect(showInfo).toHaveBeenLastCalledWith(`Triggered schedule ${schedule.id.slice(0, 8)}.`);
    await vi.waitFor(() => expect(deliver).toHaveBeenCalledWith(expect.anything(), { prompt: 'ping' }));
    expect(scheduler.list()[0]!.status).toBe('paused');
  });

  it('reports a run that never reached the agent', async () => {
    const { ctx, schedule, deliver, showError } = withSchedule();
    deliver.mockRejectedValueOnce(new Error('thread blocked'));
    pickRow('Run now');
    await handleSchedulesCommand(ctx, []);
    await vi.waitFor(() =>
      expect(showError).toHaveBeenCalledWith(`Schedule ${schedule.id.slice(0, 8)} failed to fire: thread blocked`),
    );
  });

  it('skips a run while the schedule is still firing', async () => {
    const { ctx, assemblePrompt, showInfo } = withSchedule();
    let release!: () => void;
    assemblePrompt.mockImplementationOnce(() => new Promise(resolve => (release = () => resolve({ prompt: 'x' }))));
    pickRow('Run now');
    await handleSchedulesCommand(ctx, []);
    asked = [];
    pickRow('Run now');
    await handleSchedulesCommand(ctx, []);
    expect(showInfo).toHaveBeenLastCalledWith(expect.stringContaining('is already firing; skipped'));
    expect(assemblePrompt).toHaveBeenCalledTimes(1);
    release();
  });

  it('deletes only after confirmation', async () => {
    const { ctx, scheduler } = withSchedule();
    pickRow('Delete', 'Cancel');
    await handleSchedulesCommand(ctx, []);
    expect(scheduler.list()).toHaveLength(1);

    asked = [];
    pickRow('Delete', 'Delete');
    await handleSchedulesCommand(ctx, []);
    expect(scheduler.list()).toEqual([]);
  });
});
