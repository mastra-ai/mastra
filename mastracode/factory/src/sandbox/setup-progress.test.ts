import { describe, expect, it, vi } from 'vitest';

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
