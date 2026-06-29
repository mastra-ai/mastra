import { EventEmitter } from 'node:events';
import type { ServerRoute } from '@mastra/server/server-adapter';
import Fastify from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { MastraServer } from '../index';

class MockRawReply extends EventEmitter {
  writes = 0;
  ended = false;
  destroyed = false;
  writableEnded = false;

  writeHead(): void {}

  write(): boolean {
    this.writes += 1;
    return true;
  }

  end(): void {
    this.ended = true;
    this.writableEnded = true;
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
    if (Date.now() - start > timeout) {
      throw new Error('Timed out waiting for assertion');
    }
    await sleep(1);
  }
}

describe('stream disconnect handling', () => {
  function createAdapter(app: unknown = {}) {
    return new MastraServer({
      app: app as any,
      mastra: {
        getLogger: () => ({
          error: vi.fn(),
        }),
        getServer: () => undefined,
        setMastraServer: vi.fn(),
      } as any,
    });
  }

  async function createRequestWithAbortSignal(requestRaw: MockRawRequest, replyRaw: MockRawReply) {
    const adapter = createAdapter();
    const request = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {},
      raw: requestRaw,
    } as unknown as FastifyRequest;
    const reply = {
      raw: replyRaw,
    } as unknown as FastifyReply;

    await adapter.createContextMiddleware()(request, reply, vi.fn());
    return request;
  }

  it('aborts the route abortSignal when a completed request reports an aborted close', async () => {
    const requestRaw = new MockRawRequest();
    requestRaw.complete = true;
    requestRaw.aborted = true;
    requestRaw.readableAborted = true;
    const replyRaw = new MockRawReply();
    const request = await createRequestWithAbortSignal(requestRaw, replyRaw);

    requestRaw.emit('close');

    expect(request.abortSignal.aborted).toBe(true);
  });

  it('does not abort the route abortSignal when a completed request body closes normally', async () => {
    const requestRaw = new MockRawRequest();
    requestRaw.complete = true;
    requestRaw.aborted = false;
    requestRaw.readableAborted = false;
    const replyRaw = new MockRawReply();
    const request = await createRequestWithAbortSignal(requestRaw, replyRaw);

    requestRaw.emit('close');

    expect(request.abortSignal.aborted).toBe(false);
  });

  it('aborts the route abortSignal when the response closes before finishing', async () => {
    const requestRaw = new MockRawRequest();
    requestRaw.complete = true;
    requestRaw.aborted = false;
    requestRaw.readableAborted = false;
    const replyRaw = new MockRawReply();
    const request = await createRequestWithAbortSignal(requestRaw, replyRaw);

    replyRaw.emit('close');

    expect(request.abortSignal.aborted).toBe(true);
  });

  it('cancels a hijacked stream when the request closes without a response close event', async () => {
    const adapter = createAdapter();

    const rawReply = new MockRawReply();
    const requestRaw = new MockRawRequest();
    const reply = {
      getHeaders: () => ({}),
      hijack: vi.fn(),
      raw: rawReply,
    } as unknown as FastifyReply;
    const request = {
      raw: requestRaw,
    } as unknown as FastifyRequest;
    const route = {
      method: 'GET',
      path: '/stream',
      responseType: 'stream',
      streamFormat: 'sse',
      handler: vi.fn(),
    } as unknown as ServerRoute;

    let resolveCanceled!: (reason: unknown) => void;
    const canceled = new Promise<unknown>(resolve => {
      resolveCanceled = resolve;
    });
    const stream = new ReadableStream({
      async pull(controller) {
        controller.enqueue({ type: 'chunk' });
        await sleep(5);
      },
      cancel(reason) {
        resolveCanceled(reason);
      },
    });

    const streamPromise = adapter.stream(route, reply, { fullStream: stream }, request);

    await waitFor(() => rawReply.writes > 0);

    requestRaw.emit('close');

    const canceledByRequestClose = await Promise.race([canceled.then(() => true), sleep(100).then(() => false)]);
    if (!canceledByRequestClose) {
      rawReply.emit('close');
    }

    await streamPromise;

    expect(canceledByRequestClose).toBe(true);
    await expect(canceled).resolves.toBe('request aborted');
    expect(reply.hijack).toHaveBeenCalledOnce();
    expect(rawReply.ended).toBe(true);
  });

  it('does not cancel a hijacked stream when a completed request body closes normally', async () => {
    const adapter = createAdapter();

    const rawReply = new MockRawReply();
    const requestRaw = new MockRawRequest();
    requestRaw.complete = true;
    requestRaw.aborted = false;
    requestRaw.readableAborted = false;
    const reply = {
      getHeaders: () => ({}),
      hijack: vi.fn(),
      raw: rawReply,
    } as unknown as FastifyReply;
    const request = {
      raw: requestRaw,
    } as unknown as FastifyRequest;
    const route = {
      method: 'POST',
      path: '/stream',
      responseType: 'stream',
      streamFormat: 'sse',
      handler: vi.fn(),
    } as unknown as ServerRoute;

    const cancel = vi.fn();
    let pulls = 0;
    const stream = new ReadableStream({
      async pull(controller) {
        pulls += 1;
        controller.enqueue({ type: 'chunk', pulls });
        await sleep(5);
        if (pulls >= 3) {
          controller.close();
        }
      },
      cancel,
    });

    const streamPromise = adapter.stream(route, reply, { fullStream: stream }, request);

    await waitFor(() => rawReply.writes > 0);

    requestRaw.emit('close');
    await streamPromise;

    expect(cancel).not.toHaveBeenCalled();
    expect(rawReply.writes).toBe(3);
    expect(rawReply.ended).toBe(true);
  });

  it('keeps a real Fastify POST stream open when the request body closes normally', async () => {
    const app = Fastify();
    const adapter = createAdapter(app);
    const cancel = vi.fn();
    const route = {
      method: 'POST',
      path: '/stream',
      responseType: 'stream',
      streamFormat: 'sse',
      handler: vi.fn(),
    } as unknown as ServerRoute;

    app.post('/stream', async (request, reply) => {
      let pulls = 0;
      const stream = new ReadableStream({
        async pull(controller) {
          pulls += 1;
          controller.enqueue({ type: 'chunk', pulls });
          await sleep(5);
          if (pulls >= 3) {
            controller.close();
          }
        },
        cancel,
      });

      await adapter.stream(route, reply, { fullStream: stream }, request);
    });

    try {
      const address = await app.listen({ port: 0 });
      const response = await fetch(`${address}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hello: 'world' }),
      });

      expect(response.status).toBe(200);
      const body = await response.text();

      expect(cancel).not.toHaveBeenCalled();
      expect(body).toContain('"pulls":1');
      expect(body).toContain('"pulls":2');
      expect(body).toContain('"pulls":3');
    } finally {
      await app.close();
    }
  });

  it('cancels a real Fastify stream when the client cancels the response body', async () => {
    const app = Fastify();
    const adapter = createAdapter(app);
    const route = {
      method: 'GET',
      path: '/stream',
      responseType: 'stream',
      streamFormat: 'sse',
      handler: vi.fn(),
    } as unknown as ServerRoute;
    let resolveCanceled!: (reason: unknown) => void;
    const canceled = new Promise<unknown>(resolve => {
      resolveCanceled = resolve;
    });

    app.get('/stream', async (request, reply) => {
      const stream = new ReadableStream({
        async pull(controller) {
          controller.enqueue({ type: 'chunk' });
          await sleep(5);
        },
        cancel(reason) {
          resolveCanceled(reason);
        },
      });

      await adapter.stream(route, reply, { fullStream: stream }, request);
    });

    try {
      const address = await app.listen({ port: 0 });
      const response = await fetch(`${address}/stream`);
      const reader = response.body?.getReader();
      expect(reader).toBeDefined();

      await reader!.read();
      await reader!.cancel();

      await expect(Promise.race([canceled, sleep(500).then(() => 'timed out')])).resolves.toBe('request aborted');
    } finally {
      await app.close();
    }
  });

  it('cancels a datastream response when the request closes without a response close event', async () => {
    const adapter = createAdapter();

    const rawReply = new MockRawReply();
    const requestRaw = new MockRawRequest();
    const reply = {
      header: vi.fn(),
      status: vi.fn(),
      raw: rawReply,
    } as unknown as FastifyReply;
    const request = {
      raw: requestRaw,
    } as unknown as FastifyRequest;
    const route = {
      method: 'GET',
      path: '/datastream',
      responseType: 'datastream-response',
      handler: vi.fn(),
    } as unknown as ServerRoute;

    let resolveCanceled!: (reason: unknown) => void;
    const canceled = new Promise<unknown>(resolve => {
      resolveCanceled = resolve;
    });
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        controller.enqueue(new TextEncoder().encode('data\n'));
        await sleep(5);
      },
      cancel(reason) {
        resolveCanceled(reason);
      },
    });

    const streamPromise = adapter.sendResponse(route, reply, new Response(stream), request);

    await waitFor(() => rawReply.writes > 0);

    requestRaw.emit('close');

    const canceledByRequestClose = await Promise.race([canceled.then(() => true), sleep(100).then(() => false)]);
    if (!canceledByRequestClose) {
      rawReply.emit('error', new Error('cleanup'));
    }

    await streamPromise;

    expect(canceledByRequestClose).toBe(true);
    await expect(canceled).resolves.toBe('request aborted');
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(rawReply.ended).toBe(true);
  });

  it('does not cancel a datastream response when a completed request body closes normally', async () => {
    const adapter = createAdapter();

    const rawReply = new MockRawReply();
    const requestRaw = new MockRawRequest();
    requestRaw.complete = true;
    requestRaw.aborted = false;
    requestRaw.readableAborted = false;
    const reply = {
      header: vi.fn(),
      status: vi.fn(),
      raw: rawReply,
    } as unknown as FastifyReply;
    const request = {
      raw: requestRaw,
    } as unknown as FastifyRequest;
    const route = {
      method: 'POST',
      path: '/datastream',
      responseType: 'datastream-response',
      handler: vi.fn(),
    } as unknown as ServerRoute;

    const cancel = vi.fn();
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        pulls += 1;
        controller.enqueue(new TextEncoder().encode(`data-${pulls}\n`));
        await sleep(5);
        if (pulls >= 3) {
          controller.close();
        }
      },
      cancel,
    });

    const streamPromise = adapter.sendResponse(route, reply, new Response(stream), request);

    await waitFor(() => rawReply.writes > 0);

    requestRaw.emit('close');
    await streamPromise;

    expect(cancel).not.toHaveBeenCalled();
    expect(rawReply.writes).toBe(3);
    expect(rawReply.ended).toBe(true);
  });
});
