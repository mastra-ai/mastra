import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { PubSub } from '../../../events/pubsub';
import { UnixSocketPubSub } from '../../../events/unix-socket-pubsub';
import { ensureRemoteAbortListener, requestAcknowledgedAbort } from '../abort-transport';
import { globalRunRegistry } from '../run-registry';
import type { RunRegistryEntry } from '../types';

/**
 * `requestAcknowledgedAbort` lets a process that does not own a run (e.g. the
 * server that received POST /runs/:runId/abort) tell whether the abort reached
 * the process executing it. See #28495.
 */
const transports: Array<{ name: string; setup: () => Promise<{ owner: PubSub; requester: PubSub }> }> = [
  {
    name: 'EventEmitterPubSub',
    setup: async () => {
      const pubsub = new EventEmitterPubSub();
      return { owner: pubsub, requester: pubsub };
    },
  },
  {
    name: 'UnixSocketPubSub',
    setup: async () => {
      const dir = await mkdtemp(join(tmpdir(), 'mastra-abort-ack-'));
      const socketPath = join(dir, 'events.sock');
      const owner = new UnixSocketPubSub(socketPath);
      const requester = new UnixSocketPubSub(socketPath);
      cleanups.push(async () => {
        await Promise.allSettled([requester.close(), owner.close()]);
        await rm(dir, { recursive: true, force: true });
      });
      return { owner, requester };
    },
  },
];

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

describe.each(transports)('requestAcknowledgedAbort over $name', ({ setup }) => {
  it('resolves true once the process executing the run applies the abort', async () => {
    const { owner, requester } = await setup();
    const runId = `acked-run-${globalThis.crypto.randomUUID()}`;
    const entry = { isPlaceholder: true } as RunRegistryEntry;
    globalRunRegistry.set(runId, entry);
    cleanups.push(async () => {
      entry.cleanup?.();
      globalRunRegistry.delete(runId);
    });
    await ensureRemoteAbortListener(owner, runId);

    await expect(requestAcknowledgedAbort(requester, runId)).resolves.toBe(true);
    expect(entry.abortSignal!.aborted).toBe(true);
  });

  it('resolves false when no process is executing the run', async () => {
    const { requester } = await setup();
    const runId = `orphaned-run-${globalThis.crypto.randomUUID()}`;

    await expect(requestAcknowledgedAbort(requester, runId, 300)).resolves.toBe(false);
  });

  it('rejects when the abort request cannot be published', async () => {
    const { requester } = await setup();
    vi.spyOn(requester, 'publish').mockRejectedValue(new Error('pubsub down'));

    await expect(requestAcknowledgedAbort(requester, 'any-run', 300)).rejects.toThrow('pubsub down');
  });
});
