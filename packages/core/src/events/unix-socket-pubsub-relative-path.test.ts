/**
 * Regression tests for https://github.com/mastra-ai/mastra/issues/27790:
 * a bare relative socketPath must not turn the broker's private socket name
 * into something Node parses as a TCP port.
 */
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UnixSocketPubSub } from './unix-socket-pubsub';

describe('UnixSocketPubSub - relative socket path', () => {
  const pubsubs: UnixSocketPubSub[] = [];
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await realpath(await mkdtemp(join(tmpdir(), 'mastra-uds-relative-')));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    await Promise.allSettled(pubsubs.splice(0).map(p => p.close()));
    vi.restoreAllMocks();
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  // `.28381e422682` reads as Infinity and `.0e3034010403` as 0, so a bare
  // private name would be treated by net.Server#listen as a port.
  const paths = ['events.sock', './events.sock', '././events.sock', 'sub/../events.sock'];
  const byteSequences = [
    [0x28, 0x38, 0x1e, 0x42, 0x26, 0x82],
    [0x0e, 0x30, 0x34, 0x01, 0x04, 0x03],
  ];
  it.each(byteSequences.flatMap(bytes => paths.map(path => [path, bytes] as const)))(
    'starts a broker for %s when the private name looks numeric (%j)',
    async (socketPath, bytes) => {
      vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(
        <T extends ArrayBufferView | null>(values: T) => {
          (values as unknown as Uint8Array).set(
            Uint8Array.from(bytes).subarray(0, (values as unknown as Uint8Array).length),
          );
          return values;
        },
      );

      const pubsub = new UnixSocketPubSub(socketPath);
      pubsubs.push(pubsub);

      const received: unknown[] = [];
      await pubsub.subscribe('topic', event => {
        received.push(event.data);
      });
      await pubsub.publish('topic', { type: 'test', data: { ok: true }, runId: 'run-1' });

      await vi.waitFor(() => expect(received).toEqual([{ ok: true }]));
    },
  );
});
