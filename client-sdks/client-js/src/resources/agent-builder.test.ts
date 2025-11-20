import type { Server, IncomingMessage } from 'http';
import { createServer } from 'http';
import type { AddressInfo } from 'net';
import { describe, it, beforeAll, beforeEach, afterAll, expect, vi, afterEach } from 'vitest';
import type { ClientOptions } from '../types';
import { AgentBuilder } from './agent-builder';
import { Workflow } from './workflow';

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

  it('should include zero value for perPage in query parameters', async () => {
    // Act: Call runs() with perPage=0
    await agentBuilder.runs({ perPage: 0 });

    // Assert: Verify request details
    expect(lastRequest.method).toBe('GET');
    expect(lastRequest.url).toBe('/api/agent-builder/test-action-id/runs?perPage=0');
  });

  it('should include zero value for page in query parameters', async () => {
    // Act: Call runs() with page=0
    await agentBuilder.runs({ page: 0 });

    // Assert: Verify request details
    expect(lastRequest.method).toBe('GET');
    expect(lastRequest.url).toBe('/api/agent-builder/test-action-id/runs?page=0');
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
    const perPage = 50;
    const page = 10;
    const resourceId = 'test-resource-456';

    // Act: Call runs with all parameters
    await agentBuilder.runs({
      fromDate,
      toDate,
      perPage,
      page,
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
    expect(params.get('perPage')).toBe('50');
    expect(params.get('page')).toBe('10');
    expect(params.get('resourceId')).toBe('test-resource-456');
  });
});

describe('AgentBuilder Streaming Methods (fetch-mocked)', () => {
  let fetchMock: any;
  let agentBuilder: AgentBuilder;
  let originalFetch: any;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn((input: any) => {
      const url = String(input);

      // Mock observeStream endpoint
      if (url.includes('/observe?runId=')) {
        const body = Workflow.createRecordStream([
          { type: 'cache', payload: { step: 'step1', status: 'completed' } },
          { type: 'cache', payload: { step: 'step2', status: 'completed' } },
          { type: 'live', payload: { step: 'step3', status: 'running' } },
        ]);
        return Promise.resolve(new Response(body as unknown as ReadableStream, { status: 200 }));
      }

      // Mock observeStreamVNext endpoint
      if (url.includes('/observe-streamVNext?runId=')) {
        const body = Workflow.createRecordStream([
          { type: 'cache', payload: { msg: 'cached event 1' } },
          { type: 'live', payload: { msg: 'live event 1' } },
        ]);
        return Promise.resolve(new Response(body as unknown as ReadableStream, { status: 200 }));
      }

      // Mock observeStreamLegacy endpoint
      if (url.includes('/observe-stream-legacy?runId=')) {
        const body = Workflow.createRecordStream([
          { type: 'cache', payload: { legacy: true } },
          { type: 'live', payload: { legacy: false } },
        ]);
        return Promise.resolve(new Response(body as unknown as ReadableStream, { status: 200 }));
      }

      // Mock resumeStream endpoint
      if (url.includes('/resume-stream?runId=')) {
        const body = Workflow.createRecordStream([
          { type: 'transition', payload: { step: 'resumed-step' } },
          { type: 'result', payload: { success: true } },
        ]);
        return Promise.resolve(new Response(body as unknown as ReadableStream, { status: 200 }));
      }

      return Promise.reject(new Error(`Unhandled fetch to ${url}`));
    });
    globalThis.fetch = fetchMock as any;

    const options: ClientOptions = { baseUrl: 'http://localhost', retries: 0 } as any;
    agentBuilder = new AgentBuilder(options, 'test-action');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('observeStream returns ReadableStream with cached and live events', async () => {
    const stream = await agentBuilder.observeStream({ runId: 'run-123' });
    const reader = (stream as ReadableStream<any>).getReader();
    const records: any[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      records.push(value);
    }

    expect(records).toEqual([
      { type: 'cache', payload: { step: 'step1', status: 'completed' } },
      { type: 'cache', payload: { step: 'step2', status: 'completed' } },
      { type: 'live', payload: { step: 'step3', status: 'running' } },
    ]);

    // Verify correct endpoint was called
    const call = fetchMock.mock.calls.find((args: any[]) => String(args[0]).includes('/observe?runId='));
    expect(call).toBeTruthy();
  });

  it('observeStreamVNext returns ReadableStream with VNext streaming', async () => {
    const stream = await agentBuilder.observeStreamVNext({ runId: 'run-456' });
    const reader = (stream as ReadableStream<any>).getReader();
    const records: any[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      records.push(value);
    }

    expect(records).toEqual([
      { type: 'cache', payload: { msg: 'cached event 1' } },
      { type: 'live', payload: { msg: 'live event 1' } },
    ]);

    // Verify correct endpoint was called
    const call = fetchMock.mock.calls.find((args: any[]) => String(args[0]).includes('/observe-streamVNext?runId='));
    expect(call).toBeTruthy();
  });

  it('observeStreamLegacy returns ReadableStream with legacy streaming', async () => {
    const stream = await agentBuilder.observeStreamLegacy({ runId: 'run-789' });
    const reader = (stream as ReadableStream<any>).getReader();
    const records: any[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      records.push(value);
    }

    expect(records).toEqual([
      { type: 'cache', payload: { legacy: true } },
      { type: 'live', payload: { legacy: false } },
    ]);

    // Verify correct endpoint was called
    const call = fetchMock.mock.calls.find((args: any[]) => String(args[0]).includes('/observe-stream-legacy?runId='));
    expect(call).toBeTruthy();
  });

  it('resumeStream returns ReadableStream with resume results', async () => {
    const stream = await agentBuilder.resumeStream({
      runId: 'run-abc',
      step: 'suspended-step',
      resumeData: { userInput: 'proceed' },
    });
    const reader = (stream as ReadableStream<any>).getReader();
    const records: any[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      records.push(value);
    }

    expect(records).toEqual([
      { type: 'transition', payload: { step: 'resumed-step' } },
      { type: 'result', payload: { success: true } },
    ]);

    // Verify correct endpoint was called with proper body
    const call = fetchMock.mock.calls.find((args: any[]) => String(args[0]).includes('/resume-stream?runId='));
    expect(call).toBeTruthy();
    const options = call[1];
    const body = JSON.parse(options.body);
    expect(body.step).toBe('suspended-step');
    expect(body.resumeData).toEqual({ userInput: 'proceed' });
  });

  it('resumeStream passes requestContext correctly', async () => {
    const requestContext = { userId: 'user-123', tenantId: 'tenant-456' };

    await agentBuilder.resumeStream({
      runId: 'run-context',
      step: 'step1',
      requestContext,
    });

    const call = fetchMock.mock.calls.find((args: any[]) => String(args[0]).includes('/resume-stream?runId='));
    expect(call).toBeTruthy();
    const options = call[1];
    const body = JSON.parse(options.body);
    expect(body.requestContext).toEqual(requestContext);
  });
});
