import { describe, expect, it, vi } from 'vitest';

import { createRunCleanup } from './run-cleanup';

function manualTimer() {
  let fire: (() => void) | undefined;
  const scheduleTimer = vi.fn((cleanup: () => void) => {
    fire = cleanup;
    return setTimeout(() => {}, 0);
  });
  return { scheduleTimer, fire: () => fire?.() };
}

describe('createRunCleanup', () => {
  it('releases once across explicit and timer cleanup', () => {
    const timer = manualTimer();
    const release = vi.fn();
    const cleanup = createRunCleanup({ scheduleTimer: timer.scheduleTimer, release });

    cleanup.schedule();
    cleanup.schedule();
    expect(timer.scheduleTimer).toHaveBeenCalledTimes(1);

    timer.fire();
    cleanup.run();
    cleanup.schedule();
    expect(release).toHaveBeenCalledTimes(1);
    expect(timer.scheduleTimer).toHaveBeenCalledTimes(1);
    expect(cleanup.done).toBe(true);
  });

  it('cancels a pending timer when cleaned up explicitly', () => {
    vi.useFakeTimers();
    try {
      const release = vi.fn();
      const cleanup = createRunCleanup({ scheduleTimer: fn => setTimeout(fn, 100), release });
      cleanup.schedule();
      cleanup.run();
      vi.advanceTimersByTime(200);
      expect(release).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('runs the timer-specific release on the timer and the full release explicitly', () => {
    const timer = manualTimer();
    const release = vi.fn();
    const releaseOnTimer = vi.fn();
    const viaTimer = createRunCleanup({ scheduleTimer: timer.scheduleTimer, release, releaseOnTimer });
    viaTimer.schedule();
    timer.fire();
    viaTimer.run();
    expect(releaseOnTimer).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();

    const explicit = createRunCleanup({ scheduleTimer: timer.scheduleTimer, release, releaseOnTimer });
    explicit.run();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('stays pending when the release throws, and when no timer is armed', () => {
    const release = vi.fn().mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const cleanup = createRunCleanup({ scheduleTimer: () => undefined, release });
    expect(() => cleanup.run()).toThrow('boom');
    expect(cleanup.done).toBe(false);
    cleanup.schedule();
    cleanup.run();
    expect(release).toHaveBeenCalledTimes(2);
    expect(cleanup.done).toBe(true);
  });
});
