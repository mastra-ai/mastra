import { EventEmitterPubSub } from '@mastra/core/events';
import { ConsoleLogger } from '@mastra/core/logger';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommentMirrorWorker } from './mirror-worker.js';

function worker(retryDueMirrors: () => Promise<number>, intervalMs = 10) {
  const instance = new CommentMirrorWorker({ comments: { retryDueMirrors }, intervalMs });
  return instance;
}

async function started(instance: CommentMirrorWorker) {
  await instance.init({ logger: new ConsoleLogger({ level: 'error' }), pubsub: new EventEmitterPubSub() });
  await instance.start();
  return instance;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CommentMirrorWorker', () => {
  it('drains on boot, because a restart is when a mirror was most likely dropped', async () => {
    const retryDueMirrors = vi.fn().mockResolvedValue(0);
    const instance = await started(worker(retryDueMirrors, 60_000));

    await vi.waitFor(() => expect(retryDueMirrors).toHaveBeenCalled());
    await instance.stop();
  });

  it('keeps sweeping after a cycle throws', async () => {
    const retryDueMirrors = vi.fn().mockRejectedValueOnce(new Error('storage is down')).mockResolvedValue(0);
    const instance = await started(worker(retryDueMirrors));

    await vi.waitFor(() => expect(retryDueMirrors.mock.calls.length).toBeGreaterThan(1));
    await instance.stop();
  });

  it('stops sweeping once stopped', async () => {
    const retryDueMirrors = vi.fn().mockResolvedValue(0);
    const instance = await started(worker(retryDueMirrors));

    await vi.waitFor(() => expect(retryDueMirrors).toHaveBeenCalled());
    await instance.stop();
    const afterStop = retryDueMirrors.mock.calls.length;

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(retryDueMirrors).toHaveBeenCalledTimes(afterStop);
    expect(instance.isRunning).toBe(false);
  });

  it('refuses an interval that would never fire', () => {
    expect(() => worker(async () => 0, 0)).toThrow(/positive number/);
  });
});
