import { describe, it, expect, beforeAll, inject } from 'vitest';
import { MastraClient } from '@mastra/client-js';
import { EntityType } from '@mastra/core/observability';

/**
 * Configuration for observability e2e tests
 */
export interface ObservabilityTestConfig {
  /**
   * Optional test name suffix for identification
   */
  testNameSuffix?: string;

  /**
   * Name of the test agent to use for generating traces
   */
  agentName?: string;
}

/**
 * Creates observability e2e tests that verify the client-js -> server -> storage flow.
 * These tests verify that query parameters (especially complex types like date ranges)
 * are properly handled regardless of which zod version is used.
 *
 * The tests automatically:
 * - Get baseUrl from vitest's inject()
 * - Create a MastraClient
 * - Reset storage before tests
 * - Generate traces by calling an agent
 */
export function createObservabilityTests(config: ObservabilityTestConfig = {}) {
  const { testNameSuffix, agentName = 'testAgent' } = config;
  const suiteName = testNameSuffix
    ? `Observability Client JS E2E Tests (${testNameSuffix})`
    : 'Observability Client JS E2E Tests';

  let client: MastraClient;
  let baseUrl: string;

  describe(suiteName, () => {
    beforeAll(async () => {
      baseUrl = inject('baseUrl');
      client = new MastraClient({ baseUrl, retries: 0 });

      // Reset storage to start fresh
      try {
        const res = await fetch(`${baseUrl}/e2e/reset-storage`, { method: 'POST' });
        if (!res.ok) {
          throw new Error(`reset-storage failed: ${res.status} ${res.statusText}`);
        }
      } catch (e) {
        console.warn('Could not reset storage, continuing anyway:', e);
      }

      // Generate some traces by calling an agent
      // This will create observability data we can query
      try {
        const agent = client.getAgent(agentName);
        await agent.generate({
          messages: [{ role: 'user', content: 'Hello, just testing!' }],
        });

        // Wait a bit for the trace to be persisted
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.warn('Could not generate agent trace, some tests may fail:', e);
      }
    });

    describe('listTraces', () => {
      it('should list traces without filters', async () => {
        const response = await client.listTraces({
          pagination: { page: 0, perPage: 10 },
        });

        expect(response).toBeDefined();
        expect(response.spans).toBeDefined();
        expect(Array.isArray(response.spans)).toBe(true);
        expect(response.spans.length).toBeGreaterThan(0);
        expect(response.pagination).toBeDefined();
      });

      it('should list traces with pagination', async () => {
        const response = await client.listTraces({
          pagination: { page: 0, perPage: 5 },
        });

        expect(response).toBeDefined();
        expect(response.spans).toBeDefined();
        expect(response.spans.length).toBeGreaterThan(0);
        expect(response.pagination).toBeDefined();
        expect(response.pagination.perPage).toBe(5);
      });

      it('should list traces filtered by entityType', async () => {
        const response = await client.listTraces({
          filters: {
            entityType: EntityType.AGENT,
          },
          pagination: { page: 0, perPage: 10 },
        });

        expect(response).toBeDefined();
        expect(response.spans).toBeDefined();
        expect(response.spans.length).toBeGreaterThan(0);
        expect(Array.isArray(response.spans)).toBe(true);

        // All returned spans should have entityType 'agent'
        for (const span of response.spans) {
          expect(span.entityType).toBe(EntityType.AGENT);
        }
      });

      it('should list traces filtered by entityId', async () => {
        const response = await client.listTraces({
          filters: {
            entityId: agentName,
          },
          pagination: { page: 0, perPage: 10 },
        });

        expect(response).toBeDefined();
        expect(response.spans).toBeDefined();
        expect(Array.isArray(response.spans)).toBe(true);
        expect(response.spans.length).toBeGreaterThan(0);

        // All returned spans should have entityId 'testAgent'
        for (const span of response.spans) {
          expect(span.entityId).toBe(agentName);
        }
      });

      it('should list traces filtered by entityType and entityId', async () => {
        const response = await client.listTraces({
          filters: {
            entityType: EntityType.AGENT,
            entityId: agentName,
          },
          pagination: { page: 0, perPage: 10 },
        });

        expect(response).toBeDefined();
        expect(response.spans).toBeDefined();
        expect(Array.isArray(response.spans)).toBe(true);
        expect(response.spans.length).toBeGreaterThan(0);

        // All returned spans should match both filters
        for (const span of response.spans) {
          expect(span.entityType).toBe(EntityType.AGENT);
          expect(span.entityId).toBe(agentName);
        }
      });

      it('should list traces filtered by startedAt date range', async () => {
        // Filter for traces started in the last hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const response = await client.listTraces({
          filters: {
            startedAt: {
              start: oneHourAgo,
            },
          },
          pagination: { page: 0, perPage: 10 },
        });

        expect(response).toBeDefined();
        expect(response.spans).toBeDefined();
        expect(Array.isArray(response.spans)).toBe(true);
        expect(response.spans.length).toBeGreaterThan(0);

        // All returned spans should have startedAt >= oneHourAgo
        for (const span of response.spans) {
          expect(new Date(span.startedAt).getTime()).toBeGreaterThanOrEqual(oneHourAgo.getTime());
        }
      });

      it('should list traces filtered by startedAt with start and end', async () => {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const now = new Date();

        const response = await client.listTraces({
          filters: {
            startedAt: {
              start: oneHourAgo,
              end: now,
            },
          },
          pagination: { page: 0, perPage: 10 },
        });

        expect(response).toBeDefined();
        expect(response.spans).toBeDefined();
        expect(Array.isArray(response.spans)).toBe(true);
        expect(response.spans.length).toBeGreaterThan(0);

        // All returned spans should have startedAt within the range
        for (const span of response.spans) {
          const startedAt = new Date(span.startedAt).getTime();
          expect(startedAt).toBeGreaterThanOrEqual(oneHourAgo.getTime());
          expect(startedAt).toBeLessThanOrEqual(now.getTime());
        }
      });

      it('should list traces filtered by endedAt date range', async () => {
        const now = new Date();

        const response = await client.listTraces({
          filters: {
            endedAt: {
              end: now,
            },
          },
          pagination: { page: 0, perPage: 10 },
        });

        expect(response).toBeDefined();
        expect(response.spans).toBeDefined();
        expect(Array.isArray(response.spans)).toBe(true);
        expect(response.spans.length).toBeGreaterThan(0);
      });

      it('should list traces with combined filters (entityType + startedAt)', async () => {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const response = await client.listTraces({
          filters: {
            entityType: EntityType.AGENT,
            startedAt: {
              start: oneHourAgo,
            },
          },
          pagination: { page: 0, perPage: 10 },
        });

        expect(response).toBeDefined();
        expect(response.spans).toBeDefined();
        expect(Array.isArray(response.spans)).toBe(true);
        expect(response.spans.length).toBeGreaterThan(0);

        // All returned spans should match both filters
        for (const span of response.spans) {
          expect(span.entityType).toBe(EntityType.AGENT);
          expect(new Date(span.startedAt).getTime()).toBeGreaterThanOrEqual(oneHourAgo.getTime());
        }
      });

      it('should list traces with orderBy', async () => {
        const response = await client.listTraces({
          pagination: { page: 0, perPage: 10 },
          orderBy: {
            field: 'startedAt',
            direction: 'DESC',
          },
        });

        expect(response).toBeDefined();
        expect(response.spans).toBeDefined();
        expect(Array.isArray(response.spans)).toBe(true);
        expect(response.spans.length).toBeGreaterThan(0);

        // Verify descending order
        for (let i = 1; i < response.spans.length; i++) {
          const prevTime = new Date(response.spans[i - 1].startedAt).getTime();
          const currTime = new Date(response.spans[i].startedAt).getTime();
          expect(prevTime).toBeGreaterThanOrEqual(currTime);
        }
      });

      it('should handle empty filters object', async () => {
        const response = await client.listTraces({
          filters: {},
          pagination: { page: 0, perPage: 10 },
        });

        expect(response).toBeDefined();
        expect(response.spans).toBeDefined();
        expect(Array.isArray(response.spans)).toBe(true);
        expect(response.spans.length).toBeGreaterThan(0);
      });
    });

    describe('getTrace', () => {
      it('should get a trace by ID', async () => {
        // First, get a list to find a valid trace ID
        const listResponse = await client.listTraces({
          pagination: { page: 0, perPage: 1 },
        });
        if (listResponse.spans.length === 0) {
          throw new Error('No traces available for getTrace test (setup likely failed)');
        }
        const traceId = listResponse.spans[0].traceId;
        const response = await client.getTrace(traceId);
        expect(response).toBeDefined();
        expect(response.traceId).toBe(traceId);
        expect(response.spans).toBeDefined();
        expect(Array.isArray(response.spans)).toBe(true);
        expect(response.spans.length).toBeGreaterThan(0);
        // All spans should belong to the same trace
        for (const span of response.spans) {
          expect(span.traceId).toBe(traceId);
        }
      });
      it('should return 404 for non-existent trace', async () => {
        await expect(client.getTrace('non-existent-trace-id-12345')).rejects.toThrow();
      });
    });

    describe('legacy getTraces (backward compatibility)', () => {
      it('should work with legacy getTraces API', async () => {
        const response = await client.getTraces({
          pagination: { page: 0, perPage: 10 },
        });

        expect(response).toBeDefined();
        expect(response.spans).toBeDefined();
        expect(Array.isArray(response.spans)).toBe(true);
      });

      it('should work with legacy dateRange filter', async () => {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const now = new Date();

        const response = await client.getTraces({
          pagination: {
            page: 0,
            perPage: 10,
            dateRange: {
              start: oneHourAgo,
              end: now,
            },
          },
        });

        expect(response).toBeDefined();
        expect(response.spans).toBeDefined();
        expect(Array.isArray(response.spans)).toBe(true);
      });
    });
  });
}

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string;
    port: number;
  }
}
