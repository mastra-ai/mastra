import { EventEmitter, getEventListeners } from 'node:events';
import type { ClientRequest } from 'node:http';
import net from 'node:net';
import { Duplex, Readable } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

const mocks = vi.hoisted(() => ({
  dnsLookup: vi.fn(),
  httpRequest: vi.fn(),
  httpsRequest: vi.fn(),
}));

vi.mock('node:dns', () => ({
  lookup: mocks.dnsLookup,
}));

vi.mock('node:http', async () => {
  const actual = await vi.importActual<typeof import('node:http')>('node:http');
  return {
    ...actual,
    default: {
      ...(actual as any),
      request: mocks.httpRequest,
    },
  };
});

vi.mock('node:https', async () => {
  const actual = await vi.importActual<typeof import('node:https')>('node:https');
  return {
    ...actual,
    default: {
      ...(actual as any),
      request: mocks.httpsRequest,
    },
  };
});

import { createStep, createWorkflow } from '../../workflows';
import { webFetchTool as exportedWebFetchTool } from '../index';
import { webFetchTool } from './web-fetch';

function allowPublicDns(address = '93.184.216.34') {
  mocks.dnsLookup.mockImplementation((_hostname, options, callback) => {
    if (options.all) {
      callback(null, [{ address, family: 4 }]);
      return;
    }

    callback(null, address, 4);
  });
}

function mockRequest(
  response: Readable & {
    statusCode?: number;
    statusMessage?: string;
    headers: Record<string, string | string[] | undefined>;
  },
) {
  const request = new EventEmitter() as EventEmitter & { end: () => void; destroy: (error?: Error) => void };
  request.end = vi.fn(() => {
    const options = mocks.httpsRequest.mock.calls.at(-1)?.[1] ?? mocks.httpRequest.mock.calls.at(-1)?.[1];
    options.lookup('example.com', {}, (error: Error | null) => {
      if (error) {
        request.emit('error', error);
        return;
      }

      mocks.httpsRequest.mock.calls.at(-1)?.[2](response);
      mocks.httpRequest.mock.calls.at(-1)?.[2](response);
    });
  });
  request.destroy = vi.fn(error => {
    if (error) {
      request.emit('error', error);
    }
  });

  mocks.httpsRequest.mockReturnValue(request);
  mocks.httpRequest.mockReturnValue(request);

  return request;
}

function createResponse(
  chunks: string[],
  init: { statusCode?: number; statusMessage?: string; headers?: Record<string, string | string[]> } = {},
) {
  const response = Readable.from(chunks) as Readable & {
    statusCode?: number;
    statusMessage?: string;
    headers: Record<string, string | string[] | undefined>;
  };
  response.statusCode = init.statusCode ?? 200;
  response.statusMessage = init.statusMessage ?? 'OK';
  response.headers = init.headers ?? {};
  vi.spyOn(response, 'destroy');

  return response;
}

describe('webFetchTool', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('fetches a URL and returns response metadata', async () => {
    allowPublicDns();
    mockRequest(
      createResponse(['Hello world'], {
        statusCode: 200,
        statusMessage: 'OK',
        headers: { 'content-type': 'text/plain' },
      }),
    );

    const result = await (webFetchTool as any).execute({ url: 'https://example.com/page' }, {});

    expect(mocks.httpsRequest).toHaveBeenCalledWith(
      new URL('https://example.com/page'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'user-agent': 'Mastra Web Fetch Tool/1.0',
        }),
      }),
      expect.any(Function),
    );
    expect(result).toEqual({
      content: 'Hello world',
      truncated: false,
      status: 200,
      statusText: 'OK',
      contentType: 'text/plain',
      url: 'https://example.com/page',
      ok: true,
    });
  });

  it('stops reading oversized streaming response bodies', async () => {
    allowPublicDns();
    const response = createResponse(['a'.repeat(100_001)], { statusCode: 200 });
    mockRequest(response);

    const result = await (webFetchTool as any).execute({ url: 'https://example.com/large' }, {});

    expect(result.content).toHaveLength(100_000);
    expect(result.truncated).toBe(true);
    expect(response.destroy).toHaveBeenCalled();
  });

  it('returns non-2xx responses without marking them as tool errors', async () => {
    allowPublicDns();
    mockRequest(createResponse(['Not found'], { statusCode: 404, statusMessage: 'Not Found' }));

    const result = await (webFetchTool as any).execute({ url: 'https://example.com/missing' }, {});

    expect(result).toMatchObject({
      content: 'Not found',
      status: 404,
      statusText: 'Not Found',
      ok: false,
    });
    expect(result.isError).toBeUndefined();
  });

  it('rejects non-HTTP URLs', async () => {
    const result = await (webFetchTool as any).execute({ url: 'file:///etc/passwd' }, {});

    expect(mocks.httpsRequest).not.toHaveBeenCalled();
    expect(result).toEqual({
      content: 'Failed to fetch URL: only HTTP and HTTPS URLs are supported.',
      isError: true,
    });
  });

  it('rejects private hostnames before connecting', async () => {
    const result = await (webFetchTool as any).execute({ url: 'http://localhost:8080' }, {});

    expect(mocks.httpRequest).not.toHaveBeenCalled();
    expect(result).toEqual({
      content: 'Failed to fetch URL: URL resolves to a private or reserved address.',
      isError: true,
    });
  });

  it.each([
    'http://[::1]/',
    'http://[0:0:0:0:0:0:0:1]/',
    'http://[fc00::1]/',
    'http://[0:0:0:0:0:ffff:127.0.0.1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:7f00:1]/',
  ])('rejects private IPv6 literal %s before connecting', async url => {
    const result = await (webFetchTool as any).execute({ url }, {});

    expect(mocks.httpRequest).not.toHaveBeenCalled();
    expect(result).toEqual({
      content: 'Failed to fetch URL: URL resolves to a private or reserved address.',
      isError: true,
    });
  });

  it('rejects private addresses returned by DNS lookup', async () => {
    mocks.dnsLookup.mockImplementation((_hostname, _options, callback) => callback(null, '127.0.0.1', 4));
    mockRequest(createResponse(['internal'], { statusCode: 200 }));

    const result = await (webFetchTool as any).execute({ url: 'https://example.com' }, {});

    expect(result).toEqual({
      content: 'Failed to fetch URL: URL resolves to a private or reserved address.',
      isError: true,
    });
  });

  it('preserves DNS lookup options and rejects blocked addresses in all results', async () => {
    mocks.dnsLookup.mockImplementation((_hostname, options, callback) => {
      expect(options.all).toBe(true);
      callback(null, [
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ]);
    });

    const request = mockRequest(createResponse(['internal'], { statusCode: 200 }));
    request.end = vi.fn(() => {
      const options = mocks.httpsRequest.mock.calls.at(-1)?.[1];
      options.lookup('example.com', { all: true }, (error: Error | null) => {
        if (error) {
          request.emit('error', error);
        }
      });
    });

    const result = await (webFetchTool as any).execute({ url: 'https://example.com' }, {});

    expect(result).toEqual({
      content: 'Failed to fetch URL: URL resolves to a private or reserved address.',
      isError: true,
    });
  });

  it('validates redirect targets before following them', async () => {
    allowPublicDns();
    const response = createResponse([], {
      statusCode: 302,
      statusMessage: 'Found',
      headers: { location: 'http://169.254.169.254/latest/meta-data' },
    });
    mockRequest(response);

    const result = await (webFetchTool as any).execute({ url: 'https://example.com/redirect' }, {});

    expect(response.destroy).toHaveBeenCalled();
    expect(result).toEqual({
      content: 'Failed to fetch URL: URL resolves to a private or reserved address.',
      isError: true,
    });
  });

  it('returns request errors as tool errors', async () => {
    allowPublicDns();
    const request = new EventEmitter() as EventEmitter & { end: () => void; destroy: (error?: Error) => void };
    request.end = vi.fn(() => request.emit('error', new Error('network down')));
    request.destroy = vi.fn();
    mocks.httpsRequest.mockReturnValue(request);

    const result = await (webFetchTool as any).execute({ url: 'https://example.com' }, {});

    expect(result).toEqual({
      content: 'Failed to fetch URL: network down',
      isError: true,
    });
  });

  it('is exported from the tools index', () => {
    expect(exportedWebFetchTool).toBe(webFetchTool);
  });
});

describe('webFetchTool cancellation and deadline', () => {
  const sockets: Duplex[] = [];
  const requests: ClientRequest[] = [];
  const flush = () => new Promise(resolve => setImmediate(resolve));

  // Keep Node's real ClientRequest, HTTP parser, IncomingMessage and signal handling.
  // Only socket creation is replaced, so these cases cannot connect to a network.
  async function useLocalSockets(pendingDns = false) {
    const actualHttp = await vi.importActual<typeof import('node:http')>('node:http');
    vi.spyOn(net.Socket.prototype, 'connect').mockImplementation(() => {
      throw new Error('Real network connections are forbidden in this test');
    });
    mocks.httpRequest.mockImplementation((url, options, callback) => {
      const socket = Object.assign(
        new Duplex({
          read() {},
          write(_chunk, _encoding, done) {
            done();
          },
        }),
        { setTimeout: vi.fn(), setNoDelay: vi.fn(), setKeepAlive: vi.fn() },
      );
      sockets.push(socket);
      const agent = new actualHttp.Agent({ keepAlive: false });
      agent.createConnection = connectionOptions => {
        if (pendingDns) {
          Object.assign(socket, { connecting: true });
          mocks.dnsLookup.mockImplementation(() => {});
          connectionOptions.lookup!('example.com', {}, () => {});
        }
        return socket as unknown as net.Socket;
      };
      const request = actualHttp.request(url, { ...options, agent }, callback);
      requests.push(request);
      return request;
    });
    mocks.httpsRequest.mockImplementation(() => {
      throw new Error('Unexpected HTTPS request in a socket-only test');
    });
  }

  afterEach(async () => {
    for (const request of requests) request.destroy();
    for (const socket of sockets) socket.destroy();
    await flush();
    sockets.length = 0;
    requests.length = 0;
    expect(net.Socket.prototype.connect).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it('does not start a request when native cancellation already happened', async () => {
    await useLocalSockets();
    const reason = new Error('Owner stopped the run');
    const promise = (webFetchTool as any).execute(
      { url: 'http://example.com' },
      { abortSignal: AbortSignal.abort(reason) },
    );
    let outcome: unknown;
    promise.then(
      (value: unknown) => {
        outcome = value;
      },
      (error: unknown) => {
        outcome = error;
      },
    );
    await flush();
    expect(outcome).toBe(reason);
    expect(mocks.httpRequest).not.toHaveBeenCalled();
  });

  it.each(['dns', 'headers', 'body', 'redirect'] as const)('cancels the live Node request during %s', async stage => {
    await useLocalSockets(stage === 'dns');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const controller = new AbortController();
    const reason = new Error('Owner stopped the run');
    let outcome: unknown;
    const promise = (webFetchTool as any).execute({ url: 'http://example.com' }, { abortSignal: controller.signal });
    promise.then(
      (value: unknown) => {
        outcome = value;
      },
      (error: unknown) => {
        outcome = error;
      },
    );
    await flush();
    if (stage === 'body') {
      sockets[0]!.push('HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\npartial');
      await flush();
    }
    if (stage === 'redirect') {
      sockets[0]!.push('HTTP/1.1 302 Found\r\nLocation: /next\r\nContent-Length: 0\r\n\r\n');
      await flush();
      expect(requests).toHaveLength(2);
    }
    controller.abort(reason);
    await flush();
    await flush();
    expect(outcome).toBe(reason);
    expect(requests.every(request => request.destroyed)).toBe(true);
    expect(sockets.every(socket => socket.destroyed)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    if (stage === 'dns') expect(mocks.dnsLookup).toHaveBeenCalledOnce();
  });

  it.each(['dns', 'headers', 'body', 'redirect'] as const)('applies one 15-second deadline through %s', async stage => {
    await useLocalSockets(stage === 'dns');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let outcome: any;
    const promise = (webFetchTool as any).execute({ url: 'http://example.com' }, {});
    promise.then((value: unknown) => {
      outcome = value;
    });
    await flush();
    if (stage === 'body') {
      sockets[0]!.push('HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\n');
      await flush();
    }
    await vi.advanceTimersByTimeAsync(10_000);
    if (stage === 'body') sockets[0]!.push('still sending');
    if (stage === 'redirect') {
      // An unread redirect body must not outlive the final request.
      sockets[0]!.push('HTTP/1.1 302 Found\r\nLocation: /next\r\nContent-Length: 100\r\n\r\n');
      await flush();
      expect(requests).toHaveLength(2);
    }
    await vi.advanceTimersByTimeAsync(4_999);
    expect(outcome).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(outcome).toEqual({ content: 'Failed to fetch URL: Request timed out after 15000ms.', isError: true });
    expect(requests.every(request => request.destroyed)).toBe(true);
    expect(sockets.every(socket => socket.destroyed)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    if (stage === 'dns') expect(mocks.dnsLookup).toHaveBeenCalledOnce();
  });

  it('clears the deadline after a successful redirect and stops reading its unused body', async () => {
    await useLocalSockets();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const controller = new AbortController();
    const promise = (webFetchTool as any).execute({ url: 'http://example.com' }, { abortSignal: controller.signal });
    await flush();
    sockets[0]!.push('HTTP/1.1 302 Found\r\nLocation: /next\r\nContent-Length: 100\r\n\r\n');
    await flush();
    sockets[1]!.push('HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nHello');
    expect(await promise).toMatchObject({ content: 'Hello', url: 'http://example.com/next', ok: true });
    await flush();
    expect(sockets[0]!.destroyed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  });

  it('keeps truncation working with the real Node response stream and clears its deadline', async () => {
    await useLocalSockets();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const promise = (webFetchTool as any).execute({ url: 'http://example.com' }, {});
    await flush();
    sockets[0]!.push(`HTTP/1.1 200 OK\r\nContent-Length: 100001\r\n\r\n${'x'.repeat(100_001)}`);
    const result = await promise;
    expect(result.content).toHaveLength(100_000);
    expect(result).toMatchObject({ truncated: true, ok: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps private redirect targets blocked and clears the deadline', async () => {
    await useLocalSockets();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const promise = (webFetchTool as any).execute({ url: 'http://example.com' }, {});
    await flush();
    sockets[0]!.push('HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1\r\nContent-Length: 100\r\n\r\n');
    expect(await promise).toEqual({
      content: 'Failed to fetch URL: URL resolves to a private or reserved address.',
      isError: true,
    });
    expect(requests).toHaveLength(1);
    expect(sockets[0]!.destroyed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up the deadline after a network error', async () => {
    await useLocalSockets();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const promise = (webFetchTool as any).execute({ url: 'http://example.com' }, {});
    await flush();
    requests[0]!.destroy(new Error('Connection lost'));
    expect(await promise).toEqual({ content: 'Failed to fetch URL: Connection lost', isError: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops the request through native workflow cancellation without running the next step', async () => {
    await useLocalSockets();
    const next = vi.fn(async () => ({ content: 'next step' }));
    const resultSchema = z.object({ content: z.string() });
    const workflow = createWorkflow({
      id: 'web-fetch-cancellation',
      inputSchema: z.object({ url: z.string() }),
      outputSchema: resultSchema,
      options: { shouldPersistSnapshot: () => false },
    })
      .then(createStep(webFetchTool))
      .then(createStep({ id: 'after-fetch', inputSchema: resultSchema, outputSchema: resultSchema, execute: next }))
      .commit();
    const run = await workflow.createRun();
    const completion = run.start({ inputData: { url: 'http://example.com' } });
    await flush();
    expect(requests).toHaveLength(1);
    await run.cancel();
    expect((await completion).status).toBe('canceled');
    expect(requests[0]!.destroyed).toBe(true);
    expect(sockets[0]!.destroyed).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });
});
