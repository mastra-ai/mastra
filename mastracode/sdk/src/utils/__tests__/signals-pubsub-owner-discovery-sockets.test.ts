/**
 * Cross-process owner discovery runs in the shared socket scope
 * (`<root>/_shared/`), and every lookup mints a one-shot reply topic
 * (`agent.thread-owner-discovery.<uuid>`) that Core drops once the lookup
 * settles: unsubscribe, then clearTopic.
 *
 * While a cleared reply topic kept its socket and its socket file, every
 * lookup leaked one of each. On the machine where senders reported "No claimed
 * thread owner responded", `/tmp/mc/_shared` held 39 leaked
 * `agent_thread-owner-discovery_*.sock` files and that project's own directory
 * held 8368 socket files, most of them peer-discovery reply topics. A process
 * under that much descriptor and directory pressure cannot answer owner
 * discovery in time, which is what the sender times out waiting for.
 *
 * These tests use the real Unix-socket pubsub under a throwaway socket root.
 */
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSignalsPubSub } from '../signals-pubsub.js';

const OWNER_DISCOVERY_TOPIC = 'agent.thread-owner-discovery';
const LOOKUPS = 5;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function waitFor(predicate: () => boolean, what: string, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(5);
  }
}

/** Short root: unix socket paths are capped at 104 bytes on macOS. */
function createRoot() {
  const rootDir = mkdtempSync('/tmp/mct-');
  cleanups.push(() => rmSync(rootDir, { recursive: true, force: true }));
  return rootDir;
}

/** One-shot reply sockets still on disk in the shared scope. */
function replySockets(rootDir: string): string[] {
  return readdirSync(join(rootDir, '_shared'))
    .filter(name => name.startsWith('agent_thread-owner-discovery_'))
    .sort();
}

describe.runIf(process.platform !== 'win32')('owner discovery sockets', () => {
  it('releases the shared-scope reply socket once a lookup settles', async () => {
    const rootDir = createRoot();
    const requester = createSignalsPubSub('sentinel-requester', { rootDir });
    const owner = createSignalsPubSub('sentinel-owner', { rootDir });
    cleanups.push(async () => {
      await requester.close().catch(() => {});
      await owner.close().catch(() => {});
    });

    // The owner answers every lookup, the way a process holding the thread does.
    await owner.subscribe(OWNER_DISCOVERY_TOPIC, async event => {
      const replyTopic = (event as { data?: { replyTopic?: string } }).data?.replyTopic;
      if (!replyTopic) return;
      await owner.publish(replyTopic, {
        type: 'thread-owner-response',
        runId: replyTopic,
        data: { type: 'thread-owner-response' },
      });
    });

    const replies: unknown[] = [];
    const leaked: string[] = [];
    for (let i = 0; i < LOOKUPS; i++) {
      const requestId = globalThis.crypto.randomUUID();
      const replyTopic = `${OWNER_DISCOVERY_TOPIC}.${requestId}`;
      const onReply = (event: unknown) => {
        replies.push(event);
      };

      // What Core's owner lookup does: subscribe for the one-shot reply,
      // publish the request, then drop the reply topic when it settles.
      await requester.subscribe(replyTopic, onReply);
      await requester.publish(OWNER_DISCOVERY_TOPIC, {
        type: 'thread-owner-request',
        runId: requestId,
        data: { type: 'thread-owner-request', requestId, replyTopic },
      });
      await waitFor(() => replies.length > i, `reply to lookup ${i + 1}`);
      await requester.unsubscribe(replyTopic, onReply);
      await requester.clearTopic(replyTopic);

      if (requester.getSocket(replyTopic)) leaked.push(replyTopic);
    }

    // The lookups worked, so the leak below is not an artifact of a dead round trip.
    expect(replies).toHaveLength(LOOKUPS);
    // Releasing a reply topic closes its socket, and the socket file is
    // unlinked as part of that close, so the file can outlive `clearTopic` by
    // a tick. What must not happen is the file surviving the lookup: before
    // the release work this list only ever grew.
    await waitFor(() => replySockets(rootDir).length === 0, 'reply socket files to be released');
    expect(leaked).toEqual([]);
  }, 30_000);
});
