import type { Server } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
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

  it('should accept Headers instances from client options', async () => {
    server.on('request', req => {
      requestCount++;
      expect(req.headers['x-client-header']).toBe('from-headers-instance');
    });

    const headersResource = new BaseResource({
      baseUrl: serverUrl,
      retries: 0,
      headers: new Headers({
        'X-Client-Header': 'from-headers-instance',
      }),
    });

    server.on('request', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });

    const result = await headersResource.request('/test');
    expect(result).toEqual({ success: true });
    expect(requestCount).toBe(1);
  });

  it('should accept tuple-array request headers and merge them with client headers', async () => {
    server.on('request', req => {
      requestCount++;
      expect(req.headers['x-client-header']).toBe('client-header');
      expect(req.headers['x-request-header']).toBe('request-header');
    });

    const tupleResource = new BaseResource({
      baseUrl: serverUrl,
      retries: 0,
      headers: [['X-Client-Header', 'client-header']],
    });

    server.on('request', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });

    const result = await tupleResource.request('/test', {
      headers: [['X-Request-Header', 'request-header']],
    });

    expect(result).toEqual({ success: true });
    expect(requestCount).toBe(1);
  });
});
