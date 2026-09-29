import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ThreadScheduler } from '@mastra/code-sdk/schedules';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { handleSchedulesCommand } from '../schedules.js';
import type { SlashCommandContext } from '../types.js';

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

function createContext(options: { threadId?: string | undefined; scheduler?: boolean } = {}) {
  const deliver = vi.fn(async (_schedule: unknown, _prompt: string) => {});
  const scheduler = new ThreadScheduler({ assemblePrompt: async s => s.prompt ?? '', deliver });
  schedulers.push(scheduler);
  const threadId = 'threadId' in options ? options.threadId : 'thread-1';
  const session = {
    identity: { getResourceId: vi.fn(() => 'resource-1') },
    thread: { getId: vi.fn(() => threadId), list: vi.fn(async () => [{ id: 'thread-1', resourceId: 'resource-1' }]) },
  };
  const ctx = {
    state: { session, projectInfo: { rootPath: workspaceDir } },
    threadScheduler: options.scheduler === false ? undefined : scheduler,
    showInfo: vi.fn(),
    showError: vi.fn(),
  } as unknown as SlashCommandContext;
  return {
    ctx,
    scheduler,
    deliver,
    showInfo: ctx.showInfo as ReturnType<typeof vi.fn>,
    showError: ctx.showError as ReturnType<typeof vi.fn>,
  };
}

const lastInfo = (showInfo: ReturnType<typeof vi.fn>) => showInfo.mock.calls.at(-1)![0] as string;

describe('/schedules guards', () => {
  it('reports when no scheduler is available', async () => {
    const { ctx, showError } = createContext({ scheduler: false });
    await handleSchedulesCommand(ctx, []);
    expect(showError).toHaveBeenCalledWith(expect.stringContaining('Schedules are unavailable'));
  });

  it('requires an active thread', async () => {
    const { ctx, showError, scheduler } = createContext({ threadId: undefined });
    await handleSchedulesCommand(ctx, ['create', '5m', 'hi']);
    expect(showError).toHaveBeenCalledWith(expect.stringContaining('active thread'));
    expect(scheduler.list()).toEqual([]);
  });

  it('rejects unknown subcommands with usage', async () => {
    const { ctx, showError } = createContext();
    await handleSchedulesCommand(ctx, ['bogus']);
    expect(showError).toHaveBeenCalledWith(expect.stringContaining('Unknown subcommand "bogus"'));
  });
});

describe('/schedules (list)', () => {
  it('shows the empty-state hint', async () => {
    const { ctx, showInfo } = createContext();
    await handleSchedulesCommand(ctx, []);
    expect(showInfo).toHaveBeenCalledWith(
      'No schedules on this thread. Use /schedules create <interval> <prompt|file>.',
    );
  });

  it('lists only this thread’s schedules with id, cadence, timing, and source', async () => {
    const { ctx, scheduler, showInfo } = createContext();
    const a = scheduler.create(
      { interval: { ms: 300_000, label: '5m' }, prompt: 'check the build' },
      {
        threadId: 'thread-1',
        resourceId: 'resource-1',
      },
    );
    const b = scheduler.create(
      {
        interval: { ms: 3_600_000, label: '1h' },
        file: { path: '/x/check.sh', displayPath: './check.sh', mode: 'exec' },
        extraPrompt: 'Report',
      },
      { threadId: 'thread-1', resourceId: 'resource-1' },
    );
    scheduler.pause(b.id);
    scheduler.create(
      { interval: { ms: 300_000, label: '5m' }, prompt: 'elsewhere' },
      {
        threadId: 'thread-2',
        resourceId: 'resource-1',
      },
    );

    await handleSchedulesCommand(ctx, []);
    const text = lastInfo(showInfo);
    expect(text).toContain('Schedules on this thread (2)');
    expect(text).toMatch(new RegExp(`${a.id.slice(0, 8)}  every 5m  next in (<1m|\\d+m)  "check the build"`));
    expect(text).toContain(`${b.id.slice(0, 8)}  every 1h  paused  run ./check.sh + "Report"`);
    expect(text).not.toContain('elsewhere');
  });
});

describe('/schedules create', () => {
  it('creates a prompt schedule on the current thread and reports it', async () => {
    const { ctx, scheduler, showInfo } = createContext();
    await handleSchedulesCommand(ctx, ['create', '5m', 'check', 'the', 'build']);
    expect(scheduler.list()).toEqual([
      expect.objectContaining({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        interval: { ms: 300_000, label: '5m' },
        prompt: 'check the build',
        status: 'active',
      }),
    ]);
    const text = lastInfo(showInfo);
    expect(text).toContain(`Created schedule ${scheduler.list()[0]!.id.slice(0, 8)}: every 5m`);
    expect(text).toContain('clock boundaries');
  });

  it('strips quotes wrapping the prompt', async () => {
    const { ctx, scheduler } = createContext();
    await handleSchedulesCommand(ctx, ['create', '1m', '"schedules', 'test"']);
    expect(scheduler.list()[0]!.prompt).toBe('schedules test');
  });

  it('creates an exec-file schedule with an extra prompt', async () => {
    const { ctx, scheduler } = createContext();
    await handleSchedulesCommand(ctx, ['create', '1h', './check.sh', 'Report', 'the', 'result']);
    expect(scheduler.list()[0]).toMatchObject({
      file: { path: path.join(workspaceDir, 'check.sh'), displayPath: './check.sh', mode: 'exec' },
      extraPrompt: 'Report the result',
    });
  });

  it('creates a prompt-file schedule', async () => {
    const { ctx, scheduler } = createContext();
    await handleSchedulesCommand(ctx, ['create', '1d', 'notes.md']);
    expect(scheduler.list()[0]).toMatchObject({ file: { mode: 'prompt', displayPath: 'notes.md' } });
  });

  it('warns when a path-looking token does not exist', async () => {
    const { ctx, scheduler, showInfo } = createContext();
    await handleSchedulesCommand(ctx, ['create', '5m', './missing.sh']);
    expect(scheduler.list()[0]!.prompt).toBe('./missing.sh');
    expect(lastInfo(showInfo)).toContain('Note: "./missing.sh" looks like a path but was not found');
  });

  it('shows parse errors with usage and creates nothing', async () => {
    const { ctx, scheduler, showError } = createContext();
    await handleSchedulesCommand(ctx, ['create', '90m', 'ping']);
    expect(showError).toHaveBeenCalledWith(expect.stringMatching(/Try 2h\.[\s\S]*Usage:/));
    expect(scheduler.list()).toEqual([]);
  });

  it('caps schedules per thread', async () => {
    const { ctx, scheduler, showError } = createContext();
    for (let i = 0; i < 10; i++) await handleSchedulesCommand(ctx, ['create', '5m', `p${i}`]);
    await handleSchedulesCommand(ctx, ['create', '5m', 'one more']);
    expect(scheduler.list()).toHaveLength(10);
    expect(showError).toHaveBeenCalledWith(expect.stringContaining('already has 10 schedules'));
  });
});

describe('/schedules delete|pause|resume|run', () => {
  async function withTwo() {
    const context = createContext();
    await handleSchedulesCommand(context.ctx, ['create', '5m', 'first']);
    await handleSchedulesCommand(context.ctx, ['create', '5m', 'second']);
    const [first, second] = context.scheduler.list();
    return { ...context, first: first!, second: second! };
  }

  it('errors when the thread has no schedules', async () => {
    const { ctx, showError } = createContext();
    await handleSchedulesCommand(ctx, ['run']);
    expect(showError).toHaveBeenCalledWith('No schedules on this thread.');
  });

  it('targets the only schedule when no id is given', async () => {
    const { ctx, scheduler, showInfo } = createContext();
    await handleSchedulesCommand(ctx, ['create', '5m', 'only']);
    const id = scheduler.list()[0]!.id;
    await handleSchedulesCommand(ctx, ['pause']);
    expect(scheduler.list()[0]!.status).toBe('paused');
    expect(lastInfo(showInfo)).toBe(`Paused schedule ${id.slice(0, 8)}`);
    await handleSchedulesCommand(ctx, ['resume']);
    expect(scheduler.list()[0]!.status).toBe('active');
  });

  it('requires an id for pause/resume/run when several exist', async () => {
    const { ctx, showError } = await withTwo();
    await handleSchedulesCommand(ctx, ['run']);
    expect(showError).toHaveBeenCalledWith(expect.stringContaining('specify an id: /schedules run <id>'));
  });

  it('bare delete removes every schedule on the thread', async () => {
    const { ctx, scheduler, showInfo } = await withTwo();
    await handleSchedulesCommand(ctx, ['delete']);
    expect(scheduler.list()).toEqual([]);
    expect(lastInfo(showInfo)).toMatch(/^Deleted schedules /);
  });

  it('resolves ids by case-insensitive prefix', async () => {
    const { ctx, scheduler, second } = await withTwo();
    await handleSchedulesCommand(ctx, ['delete', second.id.slice(0, 8).toUpperCase()]);
    expect(scheduler.list().map(s => s.prompt)).toEqual(['first']);
  });

  it('reports unknown ids with the list', async () => {
    const { ctx, showError } = await withTwo();
    await handleSchedulesCommand(ctx, ['delete', 'zzzz']);
    expect(showError).toHaveBeenCalledWith(expect.stringMatching(/No schedule matching "zzzz"[\s\S]*first/));
  });

  it('run fires the schedule now', async () => {
    const { ctx, deliver, first, showInfo } = await withTwo();
    await handleSchedulesCommand(ctx, ['run', first.id.slice(0, 8)]);
    expect(lastInfo(showInfo)).toBe(`Triggered schedule ${first.id.slice(0, 8)}`);
    await vi.waitFor(() => expect(deliver).toHaveBeenCalledWith(expect.objectContaining({ id: first.id }), 'first'));
  });
});
