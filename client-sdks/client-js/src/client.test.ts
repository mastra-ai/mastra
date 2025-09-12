import type { Server, IncomingMessage, ServerResponse } from 'http';
import { createServer } from 'http';
import type { AddressInfo } from 'net';
import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import { MastraClient } from './client';
import type { GetLogParams, LogLevel } from './types';

describe('MastraClient.getLogForRun', () => {
  let server: Server;
  let client: MastraClient;
  let lastRequestUrl: string | null;

  beforeAll(async () => {
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      lastRequestUrl = req.url || '';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ logs: [] }));
    });

    await new Promise<void>(resolve => {
      server.listen(0, 'localhost', () => resolve());
    });
  });

  beforeEach(() => {
    lastRequestUrl = null;
    const address = server.address();
    expect(address).not.toBeNull();
    expect(typeof address).not.toBe('string');
    const port = (address as AddressInfo).port;
    client = new MastraClient({ baseUrl: `http://localhost:${port}` });
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('should transform object filters into formatted string array', async () => {
    // Arrange: Create params with filters
    const params: GetLogParams = {
      runId: 'test-run',
      filters: {
        source: 'system',
        severity: 'high',
        component: 'auth',
      },
    } as unknown as GetLogParams; // test-only: allow missing transportId

    // Act: Make request and parse URL
    await client.getLogForRun(params);
    const url = new URL(`http://localhost${lastRequestUrl}`);

    // Assert: Verify filter parameters
    const filters = url.searchParams.getAll('filters');
    expect(filters).toContain('source:system');
    expect(filters).toContain('severity:high');
    expect(filters).toContain('component:auth');
    expect(filters.length).toBe(3);
  });

  it('should convert fromDate to ISO string in URL parameters', async () => {
    // Arrange: Create params with fromDate
    const testDate = new Date('2023-01-01T10:00:00Z');
    const params: GetLogParams = {
      runId: 'test-run',
      fromDate: testDate,
    } as unknown as GetLogParams; // test-only: allow missing transportId

    // Act: Make request and parse URL
    await client.getLogForRun(params);
    const url = new URL(`http://localhost${lastRequestUrl}`);

    // Assert: Verify date parameter
    expect(url.searchParams.get('fromDate')).toBe(testDate.toISOString());
    expect(url.searchParams.has('toDate')).toBe(false);
  });

  it('should convert toDate to ISO string in URL parameters', async () => {
    // Arrange: Create params with toDate
    const testDate = new Date('2023-01-01T10:00:00Z');
    const params: GetLogParams = {
      runId: 'test-run',
      toDate: testDate,
    } as unknown as GetLogParams; // test-only: allow missing transportId

    // Act: Make request and parse URL
    await client.getLogForRun(params);
    const url = new URL(`http://localhost${lastRequestUrl}`);

    // Assert: Verify date parameter
    expect(url.searchParams.get('toDate')).toBe(testDate.toISOString());
    expect(url.searchParams.has('fromDate')).toBe(false);
  });

  it('should construct URL with runId in path and include runId as the only query parameter when no other parameters provided', async () => {
    // Arrange: Create GetLogParams with only runId
    const params: GetLogParams = {
      runId: 'test-run-123',
    } as unknown as GetLogParams; // test-only: allow missing transportId

    // Act: Make request
    await client.getLogForRun(params);

    // Assert: Verify URL format
    const url = new URL(`http://localhost${lastRequestUrl}`);
    expect(url.pathname).toBe('/api/logs/test-run-123');
    expect(url.searchParams.size).toBe(1);
    expect(url.searchParams.get('runId')).toBe('test-run-123');
  });

  it('should handle undefined runId by including it in path', async () => {
    // Arrange: Create GetLogParams with undefined runId
    const params: GetLogParams = {
      runId: undefined,
    } as unknown as GetLogParams;

    // Act: Make request
    await client.getLogForRun(params);

    // Assert: Verify lastRequestUrl exactly matches '/api/logs/undefined'
    expect(lastRequestUrl).toBe('/api/logs/undefined');
  });

  it('should include transportId in query parameters when provided', async () => {
    // Arrange: Create GetLogParams with both runId and transportId
    const params: GetLogParams = {
      runId: 'test-run-456',
      transportId: 'transport-789',
    } as unknown as GetLogParams;

    // Act: Make request and parse URL
    await client.getLogForRun(params);
    const url = new URL(`http://localhost${lastRequestUrl}`);

    // Assert: Verify URL parameters
    expect(url.pathname).toBe('/api/logs/test-run-456');
    expect(url.searchParams.get('transportId')).toBe('transport-789');
  });

  it('should include logLevel in query parameters when provided', async () => {
    // Arrange: Create GetLogParams with runId and logLevel
    const params: GetLogParams = {
      runId: 'test-run',
      logLevel: 'INFO' as LogLevel,
    } as unknown as GetLogParams;

    // Act: Make request and parse URL
    await client.getLogForRun(params);
    const url = new URL(`http://localhost${lastRequestUrl}`);

    // Assert: Verify logLevel parameter
    expect(url.searchParams.get('logLevel')).toBe('INFO');
  });

  it('should convert numeric page parameter to string in query parameters', async () => {
    // Arrange: Create GetLogParams with runId and page number
    const params: GetLogParams = {
      runId: 'test-run',
      page: 2,
    } as unknown as GetLogParams;

    // Act: Make request and parse URL
    await client.getLogForRun(params);
    const url = new URL(`http://localhost${lastRequestUrl}`);

    // Assert: Verify page parameter is converted to string
    expect(url.searchParams.get('page')).toBe('2');
  });

  it('should convert numeric perPage parameter to string in query parameters', async () => {
    // Arrange: Create GetLogParams with runId and perPage number
    const params: GetLogParams = {
      runId: 'test-run',
      perPage: 50,
    } as unknown as GetLogParams;

    // Act: Make request and parse URL
    await client.getLogForRun(params);
    const url = new URL(`http://localhost${lastRequestUrl}`);

    // Assert: Verify perPage parameter is converted to string
    expect(url.searchParams.get('perPage')).toBe('50');
  });

  it('should handle undefined filters parameter without adding filter parameters', async () => {
    // Arrange: Create params with required runId and undefined filters
    const params: GetLogParams = {
      runId: 'test-run',
      filters: undefined,
    } as unknown as GetLogParams;

    // Act: Make request and parse URL
    await client.getLogForRun(params);
    const url = new URL(`http://localhost${lastRequestUrl}`);

    // Assert: Verify no filter parameters are present
    expect(url.searchParams.has('filters')).toBe(false);
    expect(url.searchParams.getAll('filters').length).toBe(0);
  });

  it('should handle null filters parameter without adding filter parameters', async () => {
    // Arrange: Create params with required runId and null filters
    const params: GetLogParams = {
      runId: 'test-run',
      filters: null,
    } as unknown as GetLogParams;

    // Act: Make request and parse URL
    await client.getLogForRun(params);
    const url = new URL(`http://localhost${lastRequestUrl}`);

    // Assert: Verify no filter parameters are present
    expect(url.searchParams.has('filters')).toBe(false);
    expect(url.searchParams.getAll('filters').length).toBe(0);
  });

  it('should handle empty filters object without adding filter parameters', async () => {
    // Arrange: Create GetLogParams with empty filters object
    const params: GetLogParams = {
      runId: 'test-run-123',
      filters: {},
    } as unknown as GetLogParams;

    // Act: Make request and parse URL
    await client.getLogForRun(params);
    const url = new URL(`http://localhost${lastRequestUrl}`);

    // Assert: Verify URL components
    expect(url.pathname).toBe('/api/logs/test-run-123');
    expect(url.searchParams.getAll('filters').length).toBe(0);
    expect(url.searchParams.get('runId')).toBe('test-run-123');
  });
});
