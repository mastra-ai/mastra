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
        await agent.generate([{ role: 'user', content: 'Hello, just testing!' }]);

        // Wait a bit for the trace to be persisted
        // The batch-with-updates strategy has a 5 second flush interval
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (e) {
        console.warn('Could not generate agent trace, some tests may fail:', e);
      }

      // Seed scores and feedback for those endpoints
      try {
        // Get a trace ID to associate scores/feedback with
        const listResponse = await client.listTraces({ pagination: { page: 0, perPage: 1 } });
        if (!listResponse.spans?.length) {
          throw new Error(
            'No traces found after agent generation — cannot seed scores/feedback without real trace data',
          );
        }
        const traceId = listResponse.spans[0].traceId;
        const spanId = listResponse.spans[0].spanId;

        await client.createScore({
          score: {
            traceId,
            spanId,
            scorerId: 'e2e-test-scorer',
            score: 0.95,
            reason: 'E2E test score',
          },
        });

        await client.createFeedback({
          feedback: {
            traceId,
            spanId,
            source: 'user',
            feedbackType: 'thumbs',
            value: 1,
            comment: 'E2E test feedback',
          },
        });
      } catch (e) {
        throw e;
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

      it.skip('should list traces filtered by endedAt date range', async () => {
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

    // ========================================================================
    // Scores
    // ========================================================================

    describe('createScore', () => {
      it('should create a score and return success', async () => {
        const listResponse = await client.listTraces({ pagination: { page: 0, perPage: 1 } });
        const traceId = listResponse.spans[0]?.traceId;
        if (!traceId) {
          throw new Error('No traces available for createScore test (setup likely failed)');
        }

        const result = await client.createScore({
          score: {
            traceId,
            scorerId: 'e2e-create-test',
            score: 0.8,
            reason: 'Created in e2e test',
          },
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
      });
    });

    describe('listScores', () => {
      it('should list scores without filters', async () => {
        const response = await client.listScores();

        expect(response).toBeDefined();
        expect(response.scores).toBeDefined();
        expect(Array.isArray(response.scores)).toBe(true);
        expect(response.scores.length).toBeGreaterThan(0);
        expect(response.pagination).toBeDefined();
      });

      it('should list scores with pagination', async () => {
        const response = await client.listScores({
          pagination: { page: 0, perPage: 5 },
        });

        expect(response).toBeDefined();
        expect(response.scores).toBeDefined();
        expect(response.pagination.perPage).toBe(5);
      });

      it('should list scores filtered by scorerId', async () => {
        const response = await client.listScores({
          filters: { scorerId: 'e2e-test-scorer' },
        });

        expect(response).toBeDefined();
        expect(response.scores).toBeDefined();
        expect(response.scores.length).toBeGreaterThan(0);

        for (const score of response.scores) {
          expect(score.scorerId).toBe('e2e-test-scorer');
        }
      });
    });

    // ========================================================================
    // Feedback
    // ========================================================================

    describe('createFeedback', () => {
      it('should create feedback and return success', async () => {
        const listResponse = await client.listTraces({ pagination: { page: 0, perPage: 1 } });
        const traceId = listResponse.spans[0]?.traceId;
        if (!traceId) {
          throw new Error('No traces available for createFeedback test (setup likely failed)');
        }

        const result = await client.createFeedback({
          feedback: {
            traceId,
            source: 'user',
            feedbackType: 'rating',
            value: 5,
            comment: 'Created in e2e test',
          },
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
      });
    });

    describe('listFeedback', () => {
      it('should list feedback without filters', async () => {
        const response = await client.listFeedback();

        expect(response).toBeDefined();
        expect(response.feedback).toBeDefined();
        expect(Array.isArray(response.feedback)).toBe(true);
        expect(response.feedback.length).toBeGreaterThan(0);
        expect(response.pagination).toBeDefined();
      });

      it('should list feedback with pagination', async () => {
        const response = await client.listFeedback({
          pagination: { page: 0, perPage: 5 },
        });

        expect(response).toBeDefined();
        expect(response.feedback).toBeDefined();
        expect(response.pagination.perPage).toBe(5);
      });

      it('should list feedback filtered by feedbackType', async () => {
        const response = await client.listFeedback({
          filters: { feedbackType: 'thumbs' },
        });

        expect(response).toBeDefined();
        expect(response.feedback).toBeDefined();
        expect(response.feedback.length).toBeGreaterThan(0);

        for (const fb of response.feedback) {
          expect(fb.feedbackType).toBe('thumbs');
        }
      });
    });

    // ========================================================================
    // Logs
    // ========================================================================

    describe('listLogsVNext', () => {
      it('should list logs without filters', async () => {
        const response = await client.listLogsVNext();

        expect(response).toBeDefined();
        expect(response.logs).toBeDefined();
        expect(Array.isArray(response.logs)).toBe(true);
        expect(response.pagination).toBeDefined();
      });

      it('should list logs with pagination', async () => {
        const response = await client.listLogsVNext({
          pagination: { page: 0, perPage: 5 },
        });

        expect(response).toBeDefined();
        expect(response.logs).toBeDefined();
        expect(response.pagination.perPage).toBe(5);
      });
    });

    // ========================================================================
    // Discovery
    // ========================================================================

    describe('discovery', () => {
      it('should get entity types', async () => {
        const response = await client.getEntityTypes();

        expect(response).toBeDefined();
        expect(response.entityTypes).toBeDefined();
        expect(Array.isArray(response.entityTypes)).toBe(true);
      });

      it('should get entity names', async () => {
        const response = await client.getEntityNames();

        expect(response).toBeDefined();
        expect(response.names).toBeDefined();
        expect(Array.isArray(response.names)).toBe(true);
      });

      it('should get entity names filtered by entityType', async () => {
        const response = await client.getEntityNames({ entityType: EntityType.AGENT });

        expect(response).toBeDefined();
        expect(response.names).toBeDefined();
        expect(Array.isArray(response.names)).toBe(true);
      });

      it('should get service names', async () => {
        const response = await client.getServiceNames();

        expect(response).toBeDefined();
        expect(response.serviceNames).toBeDefined();
        expect(Array.isArray(response.serviceNames)).toBe(true);
      });

      it('should get environments', async () => {
        const response = await client.getEnvironments();

        expect(response).toBeDefined();
        expect(response.environments).toBeDefined();
        expect(Array.isArray(response.environments)).toBe(true);
      });

      it('should get tags', async () => {
        const response = await client.getTags();

        expect(response).toBeDefined();
        expect(response.tags).toBeDefined();
        expect(Array.isArray(response.tags)).toBe(true);
      });
    });

    // ========================================================================
    // Server-side validation
    // ========================================================================

    describe('server validation', () => {
      const expectHttpError = async (promise: Promise<unknown>, expectedStatus: number) => {
        try {
          await promise;
          throw new Error('Expected request to fail but it succeeded');
        } catch (error: any) {
          expect(error.status).toBe(expectedStatus);
          expect(error.message).toBeDefined();
          expect(error.message.length).toBeGreaterThan(0);
        }
      };

      it('should reject createScore with missing required fields', async () => {
        await expectHttpError(
          client.createScore({
            traceId: 'trace-123',
            name: 'accuracy',
            value: 0.95,
          } as any),
          400,
        );
      });

      it('should reject createFeedback with missing required fields', async () => {
        await expectHttpError(
          client.createFeedback({
            traceId: 'trace-123',
            score: 1,
            comment: 'Great response',
          } as any),
          400,
        );
      });

      it('should reject getMetricAggregate with wrong param names', async () => {
        await expectHttpError(
          client.getMetricAggregate({
            metricName: 'latency',
            aggregation: 'avg',
          } as any),
          400,
        );
      });

      it('should reject getMetricPercentiles with out-of-range percentiles', async () => {
        await expectHttpError(
          client.getMetricPercentiles({
            name: 'latency',
            percentiles: [50, 90, 99],
            interval: '1h',
          } as any),
          400,
        );
      });
    });
  });
}
