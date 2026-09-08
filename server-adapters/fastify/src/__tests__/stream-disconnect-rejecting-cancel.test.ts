// Regression test for mastra #20307.
// Modeled on the repo's existing server-adapters/fastify/src/__tests__/stream-disconnect.test.ts
// (same MockRawReply/MockRawRequest/createAdapter helpers). Drop this `it(...)` block into that
// file, or keep as its own file next to it, and run with the repo's vitest.
//
// It asserts the fix: when a canceled stream's teardown REJECTS (e.g. an in-flight storage write
// fails during cancel), the adapter must not surface an unhandled promise rejection — which, on
// Node >=15, would crash the whole server process and drop every concurrent request.
//
// NOTE: this test was authored against HEAD 1d677d5 following the repo's conventions but was not
// executed in-repo here (running it needs the monorepo install/build). The underlying behavior it
// guards is proven language-level by ../repro.mjs. Before opening the PR, run it with the repo's
// vitest and confirm it FAILS on main and PASSES with mastra-20307.patch applied.

import { EventEmitter } from 'node:events';
import type { ServerRoute } from '@mastra/server/server-adapter';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { MastraServer } from '../index';

class MockRawReply extends EventEmitter {
  writes = 0;
  ended = false;
  writeHead(): void {}
  write(): boolean {
    this.writes += 1;
    return true;
  }
  end(): void {
    this.ended = true;
  }
}

class MockRawRequest extends EventEmitter {
  complete = false;
  aborted = true;
  readableAborted = true;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(assertion: () => boolean, timeout = 500): Promise<void> {
  const start = Date.now();
  while (!assertion()) {
    if (Date.now() - start > timeout) throw new Error('Timed out waiting for assertion');
    await sleep(1);
  }
}

function createAdapter(app: unknown = {}) {
  return new MastraServer({
    app: app as any,
    mastra: {
      getLogger: () => ({ error: vi.fn() }),
      getServer: () => undefined,
      setMastraServer: vi.fn(),
    } as any,
  });
}

describe('stream disconnect handling — rejecting cancel (#20307)', () => {
  it('does not surface an unhandled rejection when a canceled stream teardown rejects', async () => {
    const adapter = createAdapter();
    const rawReply = new MockRawReply();
    const requestRaw = new MockRawRequest();
    const reply = { getHeaders: () => ({}), hijack: vi.fn(), raw: rawReply } as unknown as FastifyReply;
    const request = { raw: requestRaw } as unknown as FastifyRequest;
    const route = {
      method: 'GET',
      path: '/stream',
      responseType: 'stream',
      streamFormat: 'sse',
      handler: vi.fn(),
    } as unknown as ServerRoute;

    const rejections: unknown[] = [];
    const onUnhandled = (reason: unknown) => rejections.push(reason);
    process.on('unhandledRejection', onUnhandled);

    try {
      // teardown that fails — models an in-flight storage write rejecting during cancel()
      const stream = new ReadableStream({
        async pull(controller) {
          controller.enqueue({ type: 'chunk' });
          await sleep(5);
        },
        cancel() {
          return Promise.reject(new Error('storage write timed out during stream teardown'));
        },
      });

      const streamPromise = adapter.stream(route, reply, { fullStream: stream }, request);
      await waitFor(() => rawReply.writes > 0);

      requestRaw.emit('close'); // client disconnects -> abort handler calls reader.cancel()

      await streamPromise;
      await sleep(20); // let the rejected cancel() settle
      await new Promise(resolve => setImmediate(resolve)); // allow any unhandledRejection to fire
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }

    // Before the fix: `void reader.cancel(...)` leaves the rejection unhandled -> this is non-empty
    // (and the process would crash in production). After the fix: empty.
    expect(rejections).toEqual([]);
  });
});
