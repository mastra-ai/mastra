/**
 * Peer fixture for thread-metadata-concurrency.test.ts: one process that writes
 * overlapping metadata keys onto one thread on the shared LibSQL file. It waits
 * for the test process's `go` before it writes, so two peers write at the same
 * time rather than one after the other.
 */
import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';

export interface ThreadMetadataPeerArgs {
  threadId: string;
  /** Prefix for this peer's keys, so each writer's keys stay distinguishable. */
  prefix: string;
  rounds: number;
  /** Which metadata write to exercise. */
  method: 'updateThread' | 'updateThreadMetadata';
}

export interface ThreadMetadataPeerResult {
  prefix: string;
}

runPeer<ThreadMetadataPeerArgs>(async peer => {
  const { threadId, prefix, rounds, method } = peer.args;
  const store = new LibSQLStore({ id: `thread-metadata-peer-${process.pid}`, url: peer.dbUrl });
  const memory = (await store.getStore('memory'))!;

  await peer.waitFor('go');
  for (let i = 0; i < rounds; i++) {
    const patch = { [`${prefix}${i}`]: i };
    if (method === 'updateThread') await memory.updateThread({ id: threadId, metadata: patch });
    else await memory.updateThreadMetadata({ id: threadId, update: thread => ({ ...thread.metadata, ...patch }) });
  }

  await store.close();
  return { prefix } satisfies ThreadMetadataPeerResult;
});
