import http from 'http';
import type { AddressInfo } from 'net';
import { describe, it, beforeAll, beforeEach, afterAll, expect } from 'vitest';
import type { GetLegacyWorkflowRunsResponse } from '../types';
import { LegacyWorkflow } from './legacy-workflow';

describe('LegacyWorkflow.runs', () => {
  let server: http.Server;
  let workflow: LegacyWorkflow;
  let lastRequestUrl: string;
  let serverPort: number;
  let baseUrl: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      lastRequestUrl = req.url || '';
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({} as GetLegacyWorkflowRunsResponse));
    });

    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        serverPort = (server.address() as AddressInfo).port;
        baseUrl = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });
  });

  beforeEach(() => {
    lastRequestUrl = '';
    workflow = new LegacyWorkflow(
      {
        apiKey: 'test-key',
        baseUrl,
      },
      'test-workflow-id',
    );
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('should call API without query parameters when no params provided', async () => {
    // Act: Call runs() with no parameters
    await workflow.runs();

    // Assert: Verify URL has correct path and no query parameters
    const url = new URL(lastRequestUrl, baseUrl);
    expect(url.pathname).toBe('/api/workflows/legacy/test-workflow-id/runs');
    expect(url.search).toBe('');
  });

  it('should include fromDate parameter as an ISO string in the URL', async () => {
    // Arrange: Create fixed date for consistent testing
    const fixedDate = new Date('2024-01-01T00:00:00.000Z');

    // Act: Call runs() with fromDate parameter
    await workflow.runs({ fromDate: fixedDate });

    // Assert: Verify fromDate parameter is correct ISO string
    const url = new URL(lastRequestUrl, baseUrl);
    expect(url.searchParams.get('fromDate')).toBe(fixedDate.toISOString());
  });

  it('should include limit parameter as a numeric string in the URL', async () => {
    // Arrange: Set limit value
    const limit = 50;

    // Act: Call runs() with limit parameter
    await workflow.runs({ limit });

    // Assert: Verify limit parameter is correct string value
    const url = new URL(lastRequestUrl, baseUrl);
    expect(url.searchParams.get('limit')).toBe(String(limit));
  });

  it('should include offset parameter as a numeric string in the URL', async () => {
    // Arrange: Set offset value
    const offset = 100;

    // Act: Call runs() with offset parameter
    await workflow.runs({ offset });

    // Assert: Verify offset parameter is correct string value
    const url = new URL(lastRequestUrl, baseUrl);
    expect(url.pathname).toBe('/api/workflows/legacy/test-workflow-id/runs');
    expect(url.searchParams.get('offset')).toBe(String(offset));
  });

  it('should include toDate parameter as an ISO string in the URL', async () => {
    // Arrange: Create fixed date for consistent testing
    const fixedDate = new Date('2024-02-01T00:00:00.000Z');

    // Act: Call runs() with toDate parameter
    await workflow.runs({ toDate: fixedDate });

    // Assert: Verify toDate parameter is correct ISO string
    const url = new URL(lastRequestUrl, baseUrl);
    expect(url.searchParams.get('toDate')).toBe(fixedDate.toISOString());
  });

  it('should include resourceId parameter directly as a string in the URL', async () => {
    // Arrange: Define test resourceId
    const resourceId = 'test-resource-123';

    // Act: Call runs() with resourceId parameter
    await workflow.runs({ resourceId });

    // Assert: Verify resourceId parameter is included as-is
    const url = new URL(lastRequestUrl, baseUrl);
    expect(url.searchParams.get('resourceId')).toBe(resourceId);
  });

  it('should correctly combine multiple parameters in the query string', async () => {
    // Arrange: Create test parameters with all possible fields
    const params = {
      fromDate: new Date('2024-01-01T00:00:00.000Z'),
      toDate: new Date('2024-02-01T00:00:00.000Z'),
      limit: 50,
      offset: 100,
      resourceId: 'test-resource-123',
    };

    // Act: Call runs() with multiple parameters
    await workflow.runs(params);

    // Assert: Verify all parameters are correctly included
    const url = new URL(lastRequestUrl, baseUrl);
    expect(url.pathname).toBe('/api/workflows/legacy/test-workflow-id/runs');
    expect(url.searchParams.get('fromDate')).toBe(params.fromDate.toISOString());
    expect(url.searchParams.get('toDate')).toBe(params.toDate.toISOString());
    expect(url.searchParams.get('limit')).toBe(String(params.limit));
    expect(url.searchParams.get('offset')).toBe(String(params.offset));
    expect(url.searchParams.get('resourceId')).toBe(params.resourceId);
  });
});
