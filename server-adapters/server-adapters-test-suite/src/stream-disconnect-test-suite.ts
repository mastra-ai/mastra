import { randomBytes } from 'node:crypto';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { afterEach, describe, expect, it } from 'vitest';

export interface StreamDisconnectTestConfig {
  /**
   * Serves `route` over real HTTP with no prefix and returns the route's absolute URL. When `beforeContext` is
   * given, run it as async middleware (or the framework's request hook) before the adapter's context middleware.
   * When `compress` is set, gzip responses with the framework's usual compression middleware.
   */
  startServer: (
    route: ServerRoute<any, any, any>,
    options?: { beforeContext?: () => Promise<void>; compress?: boolean },
  ) => Promise<{ url: string; close: () => Promise<void> }>;
  /** Set when `startServer` supports `compress`, to run the compressed-response cases. */
  supportsCompression?: boolean;
}

type ResponseType = 'stream' | 'datastream-response';

// Base64 of random bytes: gzip can't shrink it much, so a compressed response still fills the socket buffer.
const incompressible = (bytes: number) =>
  randomBytes(Math.ceil((bytes * 3) / 4))
    .toString('base64')
    .slice(0, bytes);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Covers what happens to the stream a route returns when the client goes away (#29634, #29640). The adapter has
 * to cancel the upstream stream once the client is gone; for agents with resumable streams that cancel is the only
 * signal that the HTTP observer left, and without it the upstream keeps being read into a dead socket.
 */
export function createStreamDisconnectTestSuite(config: StreamDisconnectTestConfig) {
  describe('streaming client disconnect', () => {
    let close: (() => Promise<void>) | undefined;

    afterEach(async () => {
      await close?.();
      close = undefined;
    });

    async function setup({
      responseType,
      chunks = 60,
      chunkBytes = 16,
      paceMs = 10,
      holdUntilDisconnect = false,
      compress = false,
    }: {
      responseType: ResponseType;
      chunks?: number;
      chunkBytes?: number;
      paceMs?: number;
      holdUntilDisconnect?: boolean;
      compress?: boolean;
    }) {
      const state = { pulls: 0, canceled: false };
      let handlerEntered!: () => void;
      const handlerStarted = new Promise<void>(resolve => (handlerEntered = resolve));
      let handlerReturned!: () => void;
      const handlerDone = new Promise<void>(resolve => (handlerReturned = resolve));
      const padding = compress ? incompressible(chunkBytes) : 'x'.repeat(chunkBytes);

      const route: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/disconnect',
        responseType,
        handler: async ({ abortSignal }: { abortSignal?: AbortSignal }) => {
          handlerEntered();
          if (holdUntilDisconnect) {
            // Hold the handler until the server has seen the client leave, so the adapter only gets the stream
            // after its 'close' already fired. The timeout keeps a broken abort signal from hanging the test.
            await Promise.race([
              new Promise<void>(resolve => {
                if (abortSignal?.aborted) {
                  resolve();
                }

                abortSignal?.addEventListener('abort', () => resolve(), { once: true });
              }),
              sleep(2_000),
            ]);
          }
          handlerReturned();
          const body = new ReadableStream({
            async pull(controller) {
              if (state.pulls >= chunks) {
                return controller.close();
              }

              state.pulls++;

              if (paceMs) {
                await sleep(paceMs);
              }

              controller.enqueue(
                responseType === 'stream'
                  ? { type: 'chunk', n: state.pulls, padding }
                  : new TextEncoder().encode(`chunk-${state.pulls} ${padding}\n`),
              );
            },
            cancel() {
              state.canceled = true;
            },
          });
          return responseType === 'stream'
            ? body
            : new Response(body, { status: 200, headers: { 'Content-Type': 'text/plain' } });
        },
      };

      const server = await config.startServer(route, { compress });
      close = server.close;
      return { url: server.url, state, handlerStarted, handlerDone };
    }

    const post = (url: string, signal?: AbortSignal) =>
      fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal });

    // Async auth or body parsing can run before the context middleware creates the route's abort signal. A client
    // that leaves then fires 'close' before the adapter listens for it. (#28480)
    it('aborts the route abort signal when the client left while earlier middleware was running', async () => {
      let hookEntered!: () => void;
      const inHook = new Promise<void>(resolve => (hookEntered = resolve));
      let releaseHook!: () => void;
      const hookReleased = new Promise<void>(resolve => (releaseHook = resolve));
      let routeRan!: (aborted: boolean | undefined) => void;
      const routeResult = new Promise<boolean | undefined>(resolve => (routeRan = resolve));

      const server = await config.startServer(
        {
          method: 'GET',
          path: '/test/early-close',
          responseType: 'json',
          handler: async ({ abortSignal }: { abortSignal?: AbortSignal }) => {
            routeRan(abortSignal?.aborted);
            return {};
          },
        },
        {
          beforeContext: async () => {
            hookEntered();
            await hookReleased;
          },
        },
      );
      close = server.close;

      const client = new AbortController();
      const request = fetch(server.url, { signal: client.signal }).catch(() => undefined);
      await inHook;
      client.abort();
      await request;
      await sleep(100);
      releaseHook();

      const aborted = await Promise.race([routeResult, sleep(2_000).then(() => 'route never ran' as const)]);
      expect(aborted, 'route abortSignal.aborted').toBe(true);
    });

    describe.each(['stream', 'datastream-response'] as const)('%s route', responseType => {
      it('stops reading the upstream when the client aborts mid-body', async () => {
        const { url, state } = await setup({ responseType });

        const client = new AbortController();
        const response = await post(url, client.signal);
        await response.body!.getReader().read();
        const pullsAtAbort = state.pulls;
        client.abort();

        await sleep(300);
        expect(state.pulls - pullsAtAbort, 'upstream pulls after client abort').toBeLessThanOrEqual(2);
        expect(state.canceled, 'upstream cancel()').toBe(true);
      });

      it('stops reading the upstream when the client aborts before the handler returns', async () => {
        const { url, state, handlerStarted, handlerDone } = await setup({ responseType, holdUntilDisconnect: true });

        const client = new AbortController();
        const request = post(url, client.signal).catch(() => undefined);
        await handlerStarted;
        client.abort();
        await request;

        await handlerDone;
        await sleep(300);
        expect(state.pulls, 'upstream pulls after client abort').toBeLessThanOrEqual(2);
        expect(state.canceled, 'upstream cancel()').toBe(true);
      });

      it('delivers the whole body without cancelling the upstream when the client reads to the end', async () => {
        const { url, state } = await setup({ responseType, chunks: 20 });

        const text = await (await post(url)).text();

        expect(text.match(/"n":\d+|chunk-\d+/g)).toHaveLength(20);
        expect(state.canceled, 'upstream cancel()').toBe(false);
      });

      it('pauses reading the upstream while a connected client is not reading, and cancels it once the client leaves', async () => {
        // 400 chunks of 64 KiB is far more than the socket buffers on both ends can hold.
        const { url, state } = await setup({ responseType, chunks: 400, chunkBytes: 64 * 1024, paceMs: 0 });

        const client = new AbortController();
        const response = await post(url, client.signal);
        await sleep(500);
        const pullsWhilePaused = state.pulls;
        client.abort();
        await response.body?.cancel().catch(() => {});

        expect(pullsWhilePaused, 'upstream pulls while the client was not reading').toBeLessThan(400);
        await sleep(300);
        expect(state.canceled, 'upstream cancel()').toBe(true);
      });

      // The `compression` middleware forwards `res.on('drain')` to its zlib stream but not `res.off`, so a listener
      // per backpressure wait piles up there and Node warns about a possible memory leak.
      it.runIf(config.supportsCompression)(
        'streams a compressed response to a slow client without piling up drain listeners',
        async () => {
          const warnings: string[] = [];
          const onWarning = (warning: Error) => {
            if (warning.name === 'MaxListenersExceededWarning') {
              warnings.push(warning.message);
            }
          };
          process.on('warning', onWarning);
          try {
            const { url } = await setup({
              responseType,
              chunks: 100,
              chunkBytes: 64 * 1024,
              paceMs: 0,
              compress: true,
            });

            const response = await fetch(url, {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'accept-encoding': 'gzip' },
              body: '{}',
            });
            expect(response.headers.get('content-encoding')).toBe('gzip');
            const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
            let text = '';
            for (let next = await reader.read(); !next.done; next = await reader.read()) {
              text += next.value;
              // Read slower than the server writes, so it keeps waiting for the socket to drain.
              await sleep(1);
            }
            await sleep(50);

            expect(text.match(/"n":\d+|chunk-\d+/g)).toHaveLength(100);
            expect(warnings, 'MaxListenersExceededWarning').toEqual([]);
          } finally {
            process.off('warning', onWarning);
          }
        },
      );
    });
  });
}
