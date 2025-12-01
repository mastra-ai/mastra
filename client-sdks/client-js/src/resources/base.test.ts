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

  const runRetryTest = async (config: RetryTestConfig) => {
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
    expect(requestCount).toBe(3); // Initial request + 2 retries
  };

  it('should retry and eventually reject when receiving non-ok response with JSON error', async () => {
    await runRetryTest({
      statusCode: 400,
      contentType: 'application/json',
      responseBody: { error: 'Bad Request' },
    });
  });

  it('should retry and eventually reject when receiving non-ok response with plain text error', async () => {
    await runRetryTest({
      statusCode: 500,
      contentType: 'text/plain',
      responseBody: 'Internal Server Error',
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
});
