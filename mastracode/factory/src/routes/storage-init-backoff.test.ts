import { setImmediate } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureReadyWithBackoff, lastInitError } from './storage-init-backoff.js';

const isReady = (storage: { ensureReady(): Promise<void> }) => ensureReadyWithBackoff(storage, 'test storage is down');
const later = (ms: number) => vi.setSystemTime(Date.now() + ms);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('storage that fails to start', () => {
  it('answers unavailable at once while its retry hangs, instead of holding up requests', async () => {
    const storage = {
      ensureReady: vi
        .fn<() => Promise<void>>()
        .mockRejectedValueOnce(new Error('db down'))
        .mockReturnValue(new Promise(() => {})),
    };
    await expect(isReady(storage)).resolves.toBe(false);

    later(1_000);
    for (let request = 0; request < 5; request++) await expect(isReady(storage)).resolves.toBe(false);

    expect(storage.ensureReady).toHaveBeenCalledTimes(2);
  });

  it('retries 1 second after a failure, waiting twice as long each time up to 15 seconds', async () => {
    const storage = { ensureReady: vi.fn<() => Promise<void>>().mockRejectedValue(new Error('db down')) };
    await isReady(storage);

    for (const wait of [1_000, 2_000, 4_000, 8_000, 15_000, 15_000]) {
      const attempts = storage.ensureReady.mock.calls.length;
      later(wait - 1);
      await isReady(storage);
      expect(storage.ensureReady).toHaveBeenCalledTimes(attempts);
      later(1);
      await isReady(storage);
      expect(storage.ensureReady).toHaveBeenCalledTimes(attempts + 1);
      await setImmediate();
    }
  });

  it('is served again as soon as a retry succeeds, and starts over at 1 second if it fails later', async () => {
    const down = new Error('db down');
    const storage = {
      ensureReady: vi
        .fn<() => Promise<void>>()
        .mockRejectedValueOnce(down)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValue(new Error('db down again')),
    };
    await isReady(storage);
    expect(lastInitError(storage)).toBe(down);

    later(1_000);
    await expect(isReady(storage)).resolves.toBe(false);
    await setImmediate();
    await expect(isReady(storage)).resolves.toBe(true);
    expect(lastInitError(storage)).toBeUndefined();

    await expect(isReady(storage)).resolves.toBe(false);
    later(1_000);
    await isReady(storage);
    expect(storage.ensureReady).toHaveBeenCalledTimes(5);
  });
});
