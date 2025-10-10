import type { Server, IncomingMessage } from 'http';
import { createServer } from 'http';
import type { AddressInfo } from 'net';
import { describe, it, beforeAll, beforeEach, afterAll, expect } from 'vitest';
import { AgentBuilder } from './agent-builder';

describe('AgentBuilder.runs', () => {
  let server: Server;
  let baseUrl: string;
  let agentBuilder: AgentBuilder;
  let lastRequest: { method?: string; url?: string } = {};

  beforeAll(async () => {
    // Start HTTP server to capture requests
    server = createServer((req: IncomingMessage, res) => {
      lastRequest.method = req.method;
      lastRequest.url = req.url;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    });

    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    lastRequest = {};
    agentBuilder = new AgentBuilder({ baseUrl }, 'test-action-id');
  });

  afterAll(() => {
    server.close();
  });

  it('should make request with correct URL when no parameters provided', async () => {
    // Act: Call runs() with no parameters
    await agentBuilder.runs();

    // Assert: Verify request details
    expect(lastRequest.method).toBe('GET');
    expect(lastRequest.url).toBe('/api/agent-builder/test-action-id/runs');
  });

  it('should include zero value for limit in query parameters', async () => {
    // Act: Call runs() with limit=0
    await agentBuilder.runs({ limit: 0 });

    // Assert: Verify request details
    expect(lastRequest.method).toBe('GET');
    expect(lastRequest.url).toBe('/api/agent-builder/test-action-id/runs?limit=0');
  });

  it('should include zero value for offset in query parameters', async () => {
    // Act: Call runs() with offset=0
    await agentBuilder.runs({ offset: 0 });

    // Assert: Verify request details
    expect(lastRequest.method).toBe('GET');
    expect(lastRequest.url).toBe('/api/agent-builder/test-action-id/runs?offset=0');
  });

  it('should correctly handle fromDate parameter', async () => {
    // Arrange: Create a fixed date for consistent ISO string output
    const testDate = new Date('2024-01-15T12:00:00.000Z');

    // Act: Call runs() with fromDate parameter
    await agentBuilder.runs({ fromDate: testDate });

    // Assert: Verify request details and URL structure
    expect(lastRequest.method).toBe('GET');
    expect(lastRequest.url).toBe('/api/agent-builder/test-action-id/runs?fromDate=2024-01-15T12%3A00%3A00.000Z');
  });

  it('should correctly handle toDate parameter', async () => {
    // Arrange: Create a fixed date for consistent ISO string output
    const testDate = new Date('2024-01-15T12:00:00.000Z');

    // Act: Call runs() with toDate parameter
    await agentBuilder.runs({ toDate: testDate });

    // Assert: Verify request details and URL structure
    expect(lastRequest.method).toBe('GET');
    expect(lastRequest.url).toBe('/api/agent-builder/test-action-id/runs?toDate=2024-01-15T12%3A00%3A00.000Z');
  });

  it('should correctly handle resourceId parameter', async () => {
    // Arrange: Define a test resourceId
    const testResourceId = 'test-resource-123';

    // Act: Call runs() with resourceId parameter
    await agentBuilder.runs({ resourceId: testResourceId });

    // Assert: Verify request details and URL structure
    expect(lastRequest.method).toBe('GET');
    expect(lastRequest.url).toBe('/api/agent-builder/test-action-id/runs?resourceId=test-resource-123');
  });

  it('should correctly handle multiple parameters together', async () => {
    // Arrange: Set up test parameters with fixed values
    const fromDate = new Date('2024-01-15T10:00:00.000Z');
    const toDate = new Date('2024-01-15T14:00:00.000Z');
    const limit = 50;
    const offset = 10;
    const resourceId = 'test-resource-456';

    // Act: Call runs with all parameters
    await agentBuilder.runs({
      fromDate,
      toDate,
      limit,
      offset,
      resourceId,
    });

    // Assert: Verify request details using URL API
    expect(lastRequest.method).toBe('GET');

    const url = new URL(lastRequest.url!, 'http://dummy-base'); // Base URL needed for parsing
    expect(url.pathname).toBe('/api/agent-builder/test-action-id/runs');

    // Verify each parameter individually
    const params = url.searchParams;
    expect(params.get('fromDate')).toBe('2024-01-15T10:00:00.000Z');
    expect(params.get('toDate')).toBe('2024-01-15T14:00:00.000Z');
    expect(params.get('limit')).toBe('50');
    expect(params.get('offset')).toBe('10');
    expect(params.get('resourceId')).toBe('test-resource-456');
  });
});

describe('AgentBuilder.startAsync', () => {
  let server: Server;
  let baseUrl: string;
  let agentBuilder: AgentBuilder;
  let lastRequest: { method?: string; url?: string; body?: any } = {};

  const minimalParams = () => ({
    runtimeContext: {},
    input: 'test input',
  });

  beforeAll(async () => {
    server = createServer((req: IncomingMessage, res) => {
      lastRequest.method = req.method;
      lastRequest.url = req.url;

      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', () => {
        if (body) {
          lastRequest.body = JSON.parse(body);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
      });
    });

    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    lastRequest = {};
    agentBuilder = new AgentBuilder({ baseUrl }, 'test-action-id');
  });

  afterAll(() => {
    server.close();
  });

  it('should include runId in URL when provided', async () => {
    // Arrange: Create action request params and runId
    const params = {
      runtimeContext: {},
      input: 'test input',
    };
    const testRunId = 'test-run-123';

    // Act: Call startAsync with params and runId
    await agentBuilder.startAsync(params, testRunId);

    // Assert: Verify URL structure
    expect(lastRequest.url).toContain('/api/agent-builder/test-action-id/start-async');
    expect(lastRequest.url).toContain('runId=test-run-123');
  });

  it('should structure request body correctly with actionParams and runtimeContext', async () => {
    // Arrange: Create action request params with runtimeContext
    const params = {
      runtimeContext: {
        env: 'test',
        version: '1.0',
      },
      input: 'test input',
      options: {
        flag: true,
      },
    };

    // Act: Call startAsync with params
    await agentBuilder.startAsync(params);

    // Assert: Verify request body structure
    expect(lastRequest.body).toEqual({
      input: 'test input',
      options: {
        flag: true,
      },
      runtimeContext: {
        env: 'test',
        version: '1.0',
      },
    });
    // Verify the original runtimeContext field is not present
    expect(lastRequest.body).not.toHaveProperty('runtimeContext.runtimeContext');
  });

  it('should not include query parameters in URL when runId is not provided', async () => {
    // Act: Call startAsync without runId
    await agentBuilder.startAsync(minimalParams());

    // Assert: Verify URL format
    expect(lastRequest.url).toBe(
      '/api/agent-builder/test-action-id/start-async',
      'URL should not contain any query parameters when runId is not provided',
    );
  });

  it('should use POST method for the API request', async () => {
    // Act: Call startAsync
    await agentBuilder.startAsync(minimalParams());

    // Assert: Verify HTTP method
    expect(lastRequest.method).toBe('POST', 'Request should use POST method');
  });
});
