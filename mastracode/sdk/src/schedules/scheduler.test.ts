import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  describeScheduleSource,
  LATE_FIRE_GRACE_MS,
  scheduleSignalAttributes,
  shortScheduleId,
  ThreadScheduler,
} from './scheduler.js';

const target = { threadId: 'thread-1', resourceId: 'resource-1' };
const every5m = { interval: { ms: 5 * 60_000, label: '5m' }, prompt: 'ping' };

function setup(now?: () => number) {
  const deliver = vi.fn(async (_schedule: unknown, _assembled: { prompt: string }) => {});
  const onError = vi.fn();
  const assemblePrompt = vi.fn(
    async (schedule: { prompt?: string }): Promise<{ prompt: string }> => ({
      prompt: schedule.prompt ?? '',
    }),
  );
  const scheduler = new ThreadScheduler({ assemblePrompt, deliver, onError, ...(now ? { now } : {}) });
  return { scheduler, deliver, onError, assemblePrompt };
}

describe('ThreadScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 10, 7, 30));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires on clock boundaries and re-arms', async () => {
    const { scheduler, deliver } = setup();
    const schedule = scheduler.create(every5m, target);
    expect(schedule.nextFireAt).toBe(new Date(2026, 0, 15, 10, 10).getTime());

    await vi.advanceTimersByTimeAsync(2.5 * 60_000 - 1);
    expect(deliver).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledWith(expect.objectContaining({ id: schedule.id, ...target }), { prompt: 'ping' });

    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(deliver).toHaveBeenCalledTimes(3);
    expect(scheduler.list()[0]!.nextFireAt).toBe(new Date(2026, 0, 15, 10, 25).getTime());
  });

  it('lists per thread in creation order', () => {
    const { scheduler } = setup();
    const a = scheduler.create(every5m, target);
    const b = scheduler.create({ ...every5m, prompt: 'pong' }, target);
    scheduler.create(every5m, { threadId: 'other', resourceId: 'resource-1' });
    expect(scheduler.list({ threadId: 'thread-1' }).map(s => s.id)).toEqual([a.id, b.id]);
    expect(scheduler.list()).toHaveLength(3);
  });

  it('delete stops future fires', async () => {
    const { scheduler, deliver } = setup();
    const schedule = scheduler.create(every5m, target);
    expect(scheduler.delete(schedule.id)).toBe(true);
    expect(scheduler.delete(schedule.id)).toBe(false);
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(deliver).not.toHaveBeenCalled();
  });

  it('pause skips fires and resume re-arms from now', async () => {
    const { scheduler, deliver } = setup();
    const schedule = scheduler.create(every5m, target);
    scheduler.pause(schedule.id);
    expect(scheduler.list()[0]!.status).toBe('paused');
    await vi.advanceTimersByTimeAsync(20 * 60_000); // now 10:27:30
    expect(deliver).not.toHaveBeenCalled();

    scheduler.resume(schedule.id);
    expect(scheduler.list()[0]).toMatchObject({
      status: 'active',
      nextFireAt: new Date(2026, 0, 15, 10, 30).getTime(),
    });
    await vi.advanceTimersByTimeAsync(2.5 * 60_000);
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('run fires immediately without changing the cadence', async () => {
    const { scheduler, deliver } = setup();
    const schedule = scheduler.create(every5m, target);
    await expect(scheduler.run(schedule.id)).resolves.toBe('fired');
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(scheduler.list()[0]!.nextFireAt).toBe(schedule.nextFireAt);
    await expect(scheduler.run('missing')).resolves.toBe('not-found');
  });

  it('does not stack timer fires while a slow fire is still running', async () => {
    const { scheduler, deliver, assemblePrompt } = setup();
    let release!: () => void;
    assemblePrompt.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          release = () => resolve({ prompt: 'slow' });
        }),
    );
    scheduler.create({ interval: { ms: 60_000, label: '1m' }, prompt: 'ping' }, target);
    await vi.advanceTimersByTimeAsync(30_000); // 10:08 fire starts and hangs
    await vi.advanceTimersByTimeAsync(60_000); // 10:09 boundary skipped
    expect(assemblePrompt).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(deliver).toHaveBeenCalledWith(expect.anything(), { prompt: 'slow' });
    await vi.advanceTimersByTimeAsync(60_000); // 10:10 fires normally
    expect(assemblePrompt).toHaveBeenCalledTimes(2);
  });

  it('reports delivery failures and keeps firing', async () => {
    const { scheduler, deliver, onError } = setup();
    deliver.mockRejectedValueOnce(new Error('agent missing'));
    const schedule = scheduler.create(every5m, target);
    await vi.advanceTimersByTimeAsync(2.5 * 60_000);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'agent missing' }),
      expect.objectContaining({ id: schedule.id }),
    );
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(deliver).toHaveBeenCalledTimes(2);
  });

  it('does not deliver a fire whose schedule was deleted while its prompt was assembling', async () => {
    const { scheduler, deliver, assemblePrompt } = setup();
    let release!: () => void;
    assemblePrompt.mockImplementationOnce(() => new Promise(resolve => (release = () => resolve({ prompt: 'late' }))));
    const schedule = scheduler.create(every5m, target);
    const run = scheduler.run(schedule.id);
    scheduler.delete(schedule.id);
    release();
    await run;
    expect(deliver).not.toHaveBeenCalled();
  });

  it('rejects unsupported intervals when called directly', () => {
    const { scheduler } = setup();
    for (const ms of [0, -60_000, Number.NaN, Number.POSITIVE_INFINITY, 30_000, 90_000, 7 * 60_000, 2 * 86_400_000]) {
      expect(() => scheduler.create({ interval: { ms, label: 'x' }, prompt: 'ping' }, target)).toThrow(
        /Invalid schedule interval/,
      );
    }
    expect(scheduler.list()).toEqual([]);
  });

  it('records who created a schedule', () => {
    const { scheduler } = setup();
    expect(scheduler.create(every5m, target).createdBy).toBe('user');
    expect(scheduler.create({ ...every5m, createdBy: 'agent' }, target).createdBy).toBe('agent');
  });

  it('reports busy instead of overlapping two manual runs', async () => {
    const { scheduler, assemblePrompt, deliver } = setup();
    let release!: () => void;
    assemblePrompt.mockImplementationOnce(() => new Promise(resolve => (release = () => resolve({ prompt: 'a' }))));
    const schedule = scheduler.create(every5m, target);
    const first = scheduler.run(schedule.id);
    expect(scheduler.isFiring(schedule.id)).toBe(true);
    await expect(scheduler.run(schedule.id)).resolves.toBe('busy');
    release();
    await expect(first).resolves.toBe('fired');
    expect(scheduler.isFiring(schedule.id)).toBe(false);
    expect(assemblePrompt).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('reports busy for a manual run while a timer fire is running, and skips the timer during a manual run', async () => {
    const { scheduler, assemblePrompt } = setup();
    let release!: () => void;
    assemblePrompt.mockImplementationOnce(() => new Promise(resolve => (release = () => resolve({ prompt: 'a' }))));
    const schedule = scheduler.create(every5m, target);
    await vi.advanceTimersByTimeAsync(2.5 * 60_000); // 10:10 timer fire hangs
    await expect(scheduler.run(schedule.id)).resolves.toBe('busy');
    release();
    await vi.advanceTimersByTimeAsync(0);

    assemblePrompt.mockImplementationOnce(() => new Promise(resolve => (release = () => resolve({ prompt: 'b' }))));
    const manual = scheduler.run(schedule.id); // hangs across the 10:15 boundary
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(assemblePrompt).toHaveBeenCalledTimes(2);
    release();
    await expect(manual).resolves.toBe('fired');
  });

  it('skips a fire whose timer ran long after its boundary', async () => {
    let skew = 0;
    const { scheduler, deliver } = setup(() => Date.now() + skew);
    scheduler.create(every5m, target); // due 10:10
    skew = 17 * 60_000 + 30_000; // machine slept: the 10:10 timer runs at 10:27:30
    await vi.advanceTimersByTimeAsync(2.5 * 60_000);
    expect(deliver).not.toHaveBeenCalled();
    expect(scheduler.list()[0]!.nextFireAt).toBe(new Date(2026, 0, 15, 10, 30).getTime());
  });

  it('still fires a timer that is only slightly late', async () => {
    let skew = 0;
    const { scheduler, deliver } = setup(() => Date.now() + skew);
    scheduler.create(every5m, target);
    skew = LATE_FIRE_GRACE_MS - 1_000;
    await vi.advanceTimersByTimeAsync(2.5 * 60_000);
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('stop clears every schedule', async () => {
    const { scheduler, deliver } = setup();
    scheduler.create(every5m, target);
    scheduler.stop();
    expect(scheduler.list()).toEqual([]);
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(deliver).not.toHaveBeenCalled();
  });
});

describe('describeScheduleSource', () => {
  it('describes prompt, exec, and prompt-file schedules', () => {
    expect(describeScheduleSource({ prompt: 'check' })).toBe('"check"');
    expect(
      describeScheduleSource({
        file: { path: '/w/c.sh', displayPath: './c.sh', mode: 'exec' },
        extraPrompt: 'Report',
      }),
    ).toBe('run ./c.sh + "Report"');
    expect(describeScheduleSource({ file: { path: '/w/p.md', displayPath: 'p.md', mode: 'prompt' } })).toBe(
      'read p.md',
    );
  });

  it('shortens ids to 8 characters', () => {
    expect(shortScheduleId('0f75d166-0763-4c11-9fdc-9280aa16535c')).toBe('0f75d166');
  });
});

describe('scheduleSignalAttributes', () => {
  it('carries what the transcript header needs', () => {
    const schedule = {
      id: '0f75d166-0763-4c11-9fdc-9280aa16535c',
      threadId: 't',
      resourceId: 'r',
      interval: { ms: 300_000, label: '5m' },
      file: { path: '/w/c.sh', displayPath: './c.sh', mode: 'exec' as const },
      createdBy: 'agent' as const,
      status: 'active' as const,
      nextFireAt: 0,
      createdAt: 0,
    };
    expect(scheduleSignalAttributes(schedule, { outcome: 'exit 3' })).toEqual({
      source: 'schedule',
      scheduleId: schedule.id,
      scheduleCadence: '5m',
      scheduleSource: 'run ./c.sh',
      scheduleCreatedBy: 'agent',
      scheduleOutcome: 'exit 3',
    });
  });
});
