import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { scheduleStreamCleanup } from '../bus';

describe('stream cleanup scheduling', () => {
  it('does not keep a finished CLI process alive for the replay grace period', () => {
    const child = spawnSync(
      process.execPath,
      [
        '-e',
        `const schedule = ${scheduleStreamCleanup.toString()};
         schedule(30_000, () => console.log('cleaned'));
         console.log('finished');`,
      ],
      { encoding: 'utf8', timeout: 2_000 },
    );

    expect(child.error).toBeUndefined();
    expect(child.status).toBe(0);
    expect(child.stdout.trim()).toBe('finished');
  });

  it('still cleans up while the application is running', async () => {
    let cleaned = false;
    scheduleStreamCleanup(10, () => {
      cleaned = true;
    });

    await delay(30);
    expect(cleaned).toBe(true);
  });

  it('leaves cleanup disabled for a zero grace period', async () => {
    let cleaned = false;
    expect(
      scheduleStreamCleanup(0, () => {
        cleaned = true;
      }),
    ).toBeUndefined();

    await delay(30);
    expect(cleaned).toBe(false);
  });
});
