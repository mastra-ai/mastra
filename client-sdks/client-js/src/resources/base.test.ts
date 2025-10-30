import type { Server } from 'http';
import { createServer } from 'http';
import type { AddressInfo } from 'net';
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
});
