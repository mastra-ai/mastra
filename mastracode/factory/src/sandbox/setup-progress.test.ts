import { afterEach, describe, expect, it, vi } from 'vitest';

import { SetupCommandError } from '../integrations/github/sandbox.js';
import { describeSetupInProgress, trackSetup, WORKSPACE_SETUP_TARGET } from './setup-progress.js';

describe('trackSetup', () => {
  it('runs setup even when the mark cannot be written, and clears only the mark it wrote', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = {
      setSetupInProgress: vi.fn(async () => {
        throw new Error('database unavailable');
      }),
      clearSetupInProgress: vi.fn(async () => {}),
    };

    await expect(trackSetup(storage, 'session-1', 'acme/web', 60_000, async () => 'built')).resolves.toBe('built');

    const written = storage.setSetupInProgress.mock.calls[0] as unknown as [{ setup: { startedAt: Date } }];
    expect(storage.clearSetupInProgress).toHaveBeenCalledWith({
      sessionId: 'session-1',
      startedAt: written[0].setup.startedAt,
    });
  });
});

describe('trackSetup deadline', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops the command before its mark lapses, even after a mark write slower than a minute', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-23T17:00:00Z') });
    let mark: { deadline: Date } | undefined;
    const storage = {
      setSetupInProgress: vi.fn(async ({ setup }: { setup: { deadline: Date } }) => {
        await new Promise(resolve => setTimeout(resolve, 5 * 60_000));
        mark = setup;
      }),
      clearSetupInProgress: vi.fn(async () => {}),
    };
    let stopsAt = 0;
    const tracked = trackSetup(storage, 'session-1', 'acme/web', 15 * 60_000, async timeoutMs => {
      stopsAt = Date.now() + timeoutMs;
    });
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    await tracked;

    // Still marked running for as long as the command can run.
    expect(stopsAt).toBeLessThanOrEqual(mark!.deadline.getTime());
    expect(mark!.deadline.toISOString()).toBe('2026-11-23T17:15:00.000Z');
    expect(stopsAt - Date.now()).toBe(10 * 60_000);
  });
});

describe('trackSetup with an exhausted limit', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['uses exactly', 15 * 60_000],
    ['exceeds', 16 * 60_000],
  ])('fails setup without starting the command when the mark write %s the limit', async (_, writeMs) => {
    vi.useFakeTimers({ now: new Date('2026-11-23T17:00:00Z') });
    const storage = {
      setSetupInProgress: vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, writeMs));
      }),
      clearSetupInProgress: vi.fn(async () => {}),
    };
    const run = vi.fn(async () => {});
    const tracked = trackSetup(storage, 'session-1', 'acme/web', 15 * 60_000, run);
    const failed = expect(tracked).rejects.toBeInstanceOf(SetupCommandError);
    await vi.advanceTimersByTimeAsync(writeMs);
    await failed;

    expect(run).not.toHaveBeenCalled();
    expect(storage.clearSetupInProgress).toHaveBeenCalledWith({
      sessionId: 'session-1',
      startedAt: new Date('2026-11-23T17:00:00Z'),
    });
  });
});

describe('describeSetupInProgress', () => {
  it("names the environment's own command without calling it a repository", () => {
    const startedAt = new Date('2026-11-23T17:00:00Z');
    const text = describeSetupInProgress({
      target: WORKSPACE_SETUP_TARGET,
      startedAt,
      deadline: new Date('2026-11-23T17:15:00Z'),
    });
    expect(text).toContain(
      "running the environment's own setup command, started at 17:00 UTC and stopped at 17:15 UTC",
    );
  });
});
