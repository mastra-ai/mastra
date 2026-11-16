/**
 * Concurrent thread metadata writes from two real OS processes sharing one
 * LibSQL file (#30441). The tests next to the storage domain cover two
 * connections in one process, where the local-file gate serializes the two
 * write transactions; across processes nothing coordinates the writers except
 * SQLite's write lock and each connection's busy timeout, which is the path
 * this file covers. An in-memory store cannot show it, because both writers
 * would share one object.
 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LibSQLStore } from '../../storage';
import type { ThreadMetadataPeerArgs } from './fixtures/thread-metadata-peer';
import { createXprocEnv, PEER_TIMEOUT_MS } from './peer-helper';
import type { XprocEnv } from './peer-helper';

const FIXTURE = new URL('./fixtures/thread-metadata-peer.ts', import.meta.url);
const TEST_TIMEOUT_MS = PEER_TIMEOUT_MS + 15_000;
/**
 * Two processes only race on a round their writes overlap, so take more rounds
 * than the in-process test: at 25 the `updateThread` case sometimes serialized
 * its way through on the unfixed code, at 50 both cases fail there every run.
 */
const ROUNDS = 50;

describe('thread metadata concurrency across processes on a shared LibSQL file', () => {
  let env: XprocEnv;
  let storage: LibSQLStore;
  let threadId: string;

  beforeEach(async () => {
    env = await createXprocEnv({ workers: false });
    storage = new LibSQLStore({ id: 'thread-metadata-main', url: env.dbUrl });
    await storage.init();
    threadId = `thread-${randomUUID()}`;
    const memory = (await storage.getStore('memory'))!;
    await memory.saveThread({
      thread: {
        id: threadId,
        resourceId: 'resource-1',
        title: 'Test thread',
        metadata: { seed: true },
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      },
    });
  });

  afterEach(async () => {
    await env.cleanup();
    await storage.close();
  });

  /** Both peers write at the same time, so each writer's read overlaps the other's write. */
  async function writeFromTwoProcesses(method: ThreadMetadataPeerArgs['method']): Promise<void> {
    const spawn = (prefix: 'a' | 'b') =>
      env.spawnPeer(FIXTURE, { threadId, prefix, rounds: ROUNDS, method } satisfies ThreadMetadataPeerArgs, {
        role: `peer-${prefix}`,
        workers: false,
      });
    const [a, b] = await Promise.all([spawn('a'), spawn('b')]);
    a.send('go');
    b.send('go');
    await Promise.all([a.result(), b.result()]);
  }

  function expectedKeys(): Record<string, unknown> {
    const keys: Record<string, unknown> = { seed: true };
    for (let i = 0; i < ROUNDS; i++) {
      keys[`a${i}`] = i;
      keys[`b${i}`] = i;
    }
    return keys;
  }

  async function storedMetadata(): Promise<Record<string, unknown> | undefined> {
    const memory = (await storage.getStore('memory'))!;
    return (await memory.getThreadById({ threadId }))?.metadata as Record<string, unknown> | undefined;
  }

  it(
    'updateThread keeps every key when two processes write concurrently',
    async () => {
      await writeFromTwoProcesses('updateThread');
      expect(await storedMetadata(), env.describe()).toEqual(expectedKeys());
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'updateThreadMetadata keeps every key when two processes write whole objects concurrently',
    async () => {
      await writeFromTwoProcesses('updateThreadMetadata');
      expect(await storedMetadata(), env.describe()).toEqual(expectedKeys());
    },
    TEST_TIMEOUT_MS,
  );
});
