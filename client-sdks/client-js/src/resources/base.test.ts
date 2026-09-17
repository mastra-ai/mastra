import type { Server } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { BaseResource } from './base';

interface RetryTestConfig {
  statusCode: number;
  contentType: string;
  responseBody: string | object;
}

describe('BaseResource', () => {
  let server: Server;
  let resource: BaseResource;
  let serverUrl: string;
  let requestCount: number;

  beforeEach(async () => {
    requestCount = 0;
    server = createServer();

    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        resolve();
      });
    });

    const address = server.address() as AddressInfo;
    serverUrl = `http://127.0.0.1:${address.port}`;
    resource = new BaseResource({
      baseUrl: serverUrl,
      retries: 2,
      backoffMs: 0,
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close(err => (err ? reject(err) : resolve()));
    });
  });

  const runRetryTest = async (config: RetryTestConfig & { expectedRequestCount: number }) => {
    // Arrange: Configure server response
    server.on('request', (_req, res) => {
      requestCount++;
      res.writeHead(config.statusCode, { 'Content-Type': config.contentType });
      const body = typeof config.responseBody === 'string' ? config.responseBody : JSON.stringify(config.responseBody);
      res.end(body);
    });

    // Act: Make request and handle retries
    const requestPromise = resource.request('/test');

    // Assert: Check error and retry count
    await expect(requestPromise).rejects.toBeInstanceOf(Error);
    expect(requestCount).toBe(config.expectedRequestCount);
  };

  it('should NOT retry 4xx client errors (they will not resolve with retries)', async () => {
    await runRetryTest({
      statusCode: 400,
      contentType: 'application/json',
      responseBody: { error: 'Bad Request' },
      expectedRequestCount: 1, // No retries for 4xx
    });
  });

  it('should NOT retry 403 Forbidden errors', async () => {
    await runRetryTest({
      statusCode: 403,
      contentType: 'application/json',
      responseBody: { error: 'Forbidden' },
      expectedRequestCount: 1, // No retries for 4xx
    });
  });

  it('should retry 5xx server errors and eventually reject', async () => {
    await runRetryTest({
      statusCode: 500,
      contentType: 'text/plain',
      responseBody: 'Internal Server Error',
      expectedRequestCount: 3, // Initial request + 2 retries
    });
  });

  it('should let a request override the client retry count', async () => {
    server.on('request', (_req, res) => {
      requestCount++;
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    });

    await expect(resource.request('/test', { retries: 0 })).rejects.toBeInstanceOf(Error);
    expect(requestCount).toBe(1);
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'should reject an invalid request retry count of %s before fetching',
    async retries => {
      await expect(resource.request('/test', { retries })).rejects.toThrow(
        new RangeError('retries must be a non-negative safe integer'),
      );
      expect(requestCount).toBe(0);
    },
  );

  it('should reject an invalid client retry count before fetching', async () => {
    const customResource = new BaseResource({ baseUrl: serverUrl, retries: Number.NaN });

    await expect(customResource.request('/test')).rejects.toThrow(
      new RangeError('retries must be a non-negative safe integer'),
    );
    expect(requestCount).toBe(0);
  });

  it('should stop retrying when the selected request signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    let attempts = 0;
    const customResource = new BaseResource({
      baseUrl: serverUrl,
      retries: 2,
      backoffMs: 0,
      fetch: async () => {
        attempts++;
        throw controller.signal.reason;
      },
    });

    await expect(customResource.request('/test', { signal: controller.signal })).rejects.toBe(controller.signal.reason);
    expect(attempts).toBe(1);
  });

  it('should abort when either the request or the client abort signal fires', async () => {
    const clientController = new AbortController();
    const requestController = new AbortController();
    let receivedSignal: AbortSignal | null | undefined;
    const customResource = new BaseResource({
      baseUrl: serverUrl,
      abortSignal: clientController.signal,
      fetch: async (_input, init) => {
        receivedSignal = init?.signal;
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
    });

    await customResource.request('/test', { signal: requestController.signal });

    expect(receivedSignal?.aborted).toBe(false);
    requestController.abort();
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('should use the client abort signal when the request does not provide one', async () => {
    const clientSignal = new AbortController().signal;
    let receivedSignal: AbortSignal | null | undefined;
    const customResource = new BaseResource({
      baseUrl: serverUrl,
      abortSignal: clientSignal,
      fetch: async (_input, init) => {
        receivedSignal = init?.signal;
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
    });

    await customResource.request('/test');

    expect(receivedSignal).toBe(clientSignal);
  });

  it('should use custom fetch function when provided', async () => {
    // Arrange: Create a custom fetch that adds a custom header
    const customFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const response = await fetch(url, {
        ...init,
        headers: {
          ...init?.headers,
          'X-Custom-Fetch': 'true',
        },
      });
      return response;
    };

    const customResource = new BaseResource({
      baseUrl: serverUrl,
      retries: 0,
      fetch: customFetch,
    });

    // Set up server to respond successfully
    server.on('request', (req, res) => {
      const customHeader = req.headers['x-custom-fetch'];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ customFetchUsed: customHeader === 'true' }));
    });

    // Act: Make request
    const result = await customResource.request('/test');

    // Assert: Verify custom fetch was used
    expect(result).toEqual({ customFetchUsed: true });
  });

  it('should fall back to global fetch when custom fetch is not provided', async () => {
    // Arrange: Set up server to respond successfully
    server.on('request', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });

    // Act: Make request without custom fetch
    const result = await resource.request('/test');

    // Assert: Verify request succeeded using global fetch
    expect(result).toEqual({ success: true });
  });

  describe('abort signals', () => {
    const okResponse = () => new Response(JSON.stringify({ ok: true }), { status: 200 });

    it('passes a per-call signal through to fetch', async () => {
      const customFetch = vi.fn(async () => okResponse());
      const controller = new AbortController();
      const customResource = new BaseResource({ baseUrl: serverUrl, retries: 0, fetch: customFetch });

      await customResource.request('/test', { signal: controller.signal });

      const passedSignal = (customFetch.mock.calls[0] as unknown as [string, RequestInit])[1].signal!;
      expect(passedSignal.aborted).toBe(false);
      controller.abort();
      expect(passedSignal.aborted).toBe(true);
    });

    it('merges the client-wide abortSignal with the per-call signal', async () => {
      const customFetch = vi.fn(async () => okResponse());
      const clientController = new AbortController();
      const callController = new AbortController();
      const customResource = new BaseResource({
        baseUrl: serverUrl,
        retries: 0,
        fetch: customFetch,
        abortSignal: clientController.signal,
      });

      await customResource.request('/test', { signal: callController.signal });

      const passedSignal = (customFetch.mock.calls[0] as unknown as [string, RequestInit])[1].signal!;
      expect(passedSignal.aborted).toBe(false);
      clientController.abort();
      expect(passedSignal.aborted).toBe(true);
    });

    it('does not retry when the request was aborted', async () => {
      const controller = new AbortController();
      const customFetch = vi.fn(async (_url: string, init: RequestInit) => {
        controller.abort();
        throw init.signal!.reason;
      });
      const customResource = new BaseResource({ baseUrl: serverUrl, retries: 3, backoffMs: 0, fetch: customFetch });

      await expect(customResource.request('/test', { signal: controller.signal })).rejects.toMatchObject({
        name: 'AbortError',
      });
      expect(customFetch).toHaveBeenCalledTimes(1);
    });
  });
});
