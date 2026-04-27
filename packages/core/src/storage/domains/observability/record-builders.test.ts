import { describe, expect, it } from 'vitest';
import type { FeedbackEvent, LogEvent, MetricEvent, ScoreEvent } from '../../../observability';
import { EntityType } from '../../../observability/types/tracing';
import { buildFeedbackRecord, buildLogRecord, buildMetricRecord, buildScoreRecord } from './record-builders';

describe('record-builders', () => {
  describe('buildMetricRecord', () => {
    it('maps shared correlation fields and canonical cost fields', () => {
      const timestamp = new Date('2026-01-01T00:00:00.000Z');
      const event: MetricEvent = {
        type: 'metric',
        metric: {
          metricId: 'metric-builder-1',
          timestamp,
          traceId: 'trace-1',
          spanId: 'span-1',
          name: 'mastra_agent_duration_ms',
          value: 42,
          labels: {
            other_label: 'kept',
          },
          correlationContext: {
            tags: ['prod', 'agent'],
            entityType: EntityType.AGENT,
            entityId: 'agent-1',
            entityName: 'research-agent',
            parentEntityType: EntityType.WORKFLOW_RUN,
            parentEntityId: 'workflow-1',
            parentEntityName: 'daily-workflow',
            rootEntityType: EntityType.WORKFLOW_RUN,
            rootEntityId: 'workflow-root',
            rootEntityName: 'root-workflow',
            userId: 'user-1',
            organizationId: 'org-1',
            resourceId: 'resource-1',
            runId: 'run-1',
            sessionId: 'session-1',
            threadId: 'thread-1',
            requestId: 'request-1',
            environment: 'production',
            source: 'cloud',
            serviceName: 'api-server',
            experimentId: 'exp-1',
          },
          costContext: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            estimatedCost: 0.00123,
            costUnit: 'usd',
            costMetadata: {
              pricing_id: 'openai-gpt-4o-mini',
              tier_index: 0,
            },
          },
          metadata: { kept: true },
        },
      };

      expect(buildMetricRecord(event)).toEqual({
        metricId: 'metric-builder-1',
        timestamp,
        name: 'mastra_agent_duration_ms',
        value: 42,
        labels: {
          other_label: 'kept',
        },
        traceId: 'trace-1',
        spanId: 'span-1',
        tags: ['prod', 'agent'],
        entityType: EntityType.AGENT,
        entityId: 'agent-1',
        entityName: 'research-agent',
        entityVersionId: null,
        parentEntityVersionId: null,
        rootEntityVersionId: null,
        parentEntityType: EntityType.WORKFLOW_RUN,
        parentEntityId: 'workflow-1',
        parentEntityName: 'daily-workflow',
        rootEntityType: EntityType.WORKFLOW_RUN,
        rootEntityId: 'workflow-root',
        rootEntityName: 'root-workflow',
        userId: 'user-1',
        organizationId: 'org-1',
        resourceId: 'resource-1',
        runId: 'run-1',
        sessionId: 'session-1',
        threadId: 'thread-1',
        requestId: 'request-1',
        environment: 'production',
        executionSource: 'cloud',
        serviceName: 'api-server',
        experimentId: 'exp-1',
        scope: null,
        provider: 'openai',
        model: 'gpt-4o-mini',
        estimatedCost: 0.00123,
        costUnit: 'usd',
        costMetadata: {
          pricing_id: 'openai-gpt-4o-mini',
          tier_index: 0,
        },
        metadata: { kept: true },
      });
    });

    it('does not infer canonical cost fields from metric labels', () => {
      const event: MetricEvent = {
        type: 'metric',
        metric: {
          metricId: 'metric-builder-2',
          timestamp: new Date('2026-01-01T00:00:00.000Z'),
          name: 'mastra_tokens',
          value: 10,
          labels: {
            other_label: 'kept',
          },
        },
      };

      expect(buildMetricRecord(event)).toEqual({
        metricId: 'metric-builder-2',
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
        name: 'mastra_tokens',
        value: 10,
        labels: {
          other_label: 'kept',
        },
        traceId: null,
        spanId: null,
        tags: null,
        entityType: null,
        entityId: null,
        entityName: null,
        entityVersionId: null,
        parentEntityVersionId: null,
        rootEntityVersionId: null,
        parentEntityType: null,
        parentEntityId: null,
        parentEntityName: null,
        rootEntityType: null,
        rootEntityId: null,
        rootEntityName: null,
        userId: null,
        organizationId: null,
        resourceId: null,
        runId: null,
        sessionId: null,
        threadId: null,
        requestId: null,
        environment: null,
        executionSource: null,
        serviceName: null,
        experimentId: null,
        scope: null,
        provider: null,
        model: null,
        estimatedCost: null,
        costUnit: null,
        costMetadata: null,
        metadata: null,
      });
    });

    it('falls back to legacy metric labels for entity hierarchy and service name', () => {
      const event: MetricEvent = {
        type: 'metric',
        metric: {
          metricId: 'metric-builder-3',
          timestamp: new Date('2026-01-01T00:00:00.000Z'),
          name: 'mastra_agent_duration_ms',
          value: 1,
          labels: {
            entity_type: 'agent',
            entity_name: 'my-agent',
            parent_type: 'workflow_run',
            parent_name: 'my-workflow',
            service_name: 'api-server',
            other_label: 'kept',
          },
        },
      };

      expect(buildMetricRecord(event)).toEqual({
        metricId: 'metric-builder-3',
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
        name: 'mastra_agent_duration_ms',
        value: 1,
        labels: {
          other_label: 'kept',
        },
        traceId: null,
        spanId: null,
        tags: null,
        entityType: EntityType.AGENT,
        entityId: null,
        entityName: 'my-agent',
        entityVersionId: null,
        parentEntityVersionId: null,
        rootEntityVersionId: null,
        parentEntityType: EntityType.WORKFLOW_RUN,
        parentEntityId: null,
        parentEntityName: 'my-workflow',
        rootEntityType: null,
        rootEntityId: null,
        rootEntityName: null,
        userId: null,
        organizationId: null,
        resourceId: null,
        runId: null,
        sessionId: null,
        threadId: null,
        requestId: null,
        environment: null,
        executionSource: null,
        serviceName: 'api-server',
        experimentId: null,
        scope: null,
        provider: null,
        model: null,
        estimatedCost: null,
        costUnit: null,
        costMetadata: null,
        metadata: null,
      });
    });
  });

  describe('buildScoreRecord', () => {
    it('builds a complete score record with all context fields', () => {
      const timestamp = new Date('2026-01-01T00:00:00.000Z');
      const event: ScoreEvent = {
        type: 'score',
        score: {
          scoreId: 'score-builder-1',
          timestamp,
          traceId: 'trace-1',
          spanId: 'span-1',
          scorerId: 'judge-1',
          scorerVersion: 'v1',
          scoreSource: 'eval',
          score: 0.91,
          reason: 'good answer',
          experimentId: 'exp-1',
          scoreTraceId: 'score-trace-1',
          correlationContext: {
            organizationId: 'org-1',
          },
          metadata: {
            kept: true,
          },
        },
      };

      expect(buildScoreRecord(event)).toEqual({
        scoreId: 'score-builder-1',
        timestamp,
        traceId: 'trace-1',
        spanId: 'span-1',
        scorerId: 'judge-1',
        scorerVersion: 'v1',
        scoreSource: 'eval',
        source: 'eval',
        score: 0.91,
        reason: 'good answer',
        experimentId: 'exp-1',
        scoreTraceId: 'score-trace-1',
        tags: null,
        entityType: null,
        entityId: null,
        entityName: null,
        entityVersionId: null,
        parentEntityVersionId: null,
        rootEntityVersionId: null,
        parentEntityType: null,
        parentEntityId: null,
        parentEntityName: null,
        rootEntityType: null,
        rootEntityId: null,
        rootEntityName: null,
        userId: null,
        organizationId: 'org-1',
        resourceId: null,
        runId: null,
        sessionId: null,
        threadId: null,
        requestId: null,
        environment: null,
        executionSource: null,
        serviceName: null,
        scope: null,
        metadata: {
          kept: true,
        },
      });
    });

    it('keeps deprecated score source alias support', () => {
      const timestamp = new Date('2026-01-01T00:00:00.000Z');
      const event: ScoreEvent = {
        type: 'score',
        score: {
          scoreId: 'score-builder-legacy',
          timestamp,
          traceId: 'trace-legacy-score-source',
          scorerId: 'judge-legacy',
          source: 'legacy-eval',
          score: 0.42,
        },
      };

      expect(buildScoreRecord(event)).toEqual(
        expect.objectContaining({
          scoreId: 'score-builder-legacy',
          scoreSource: 'legacy-eval',
          source: 'legacy-eval',
        }),
      );
    });

    it('allows unanchored scores without traceId', () => {
      const timestamp = new Date('2026-01-01T00:00:00.000Z');
      const event: ScoreEvent = {
        type: 'score',
        score: {
          scoreId: 'score-builder-unanchored',
          timestamp,
          scorerId: 'judge-unanchored',
          score: 0.42,
        },
      };

      expect(buildScoreRecord(event)).toEqual(
        expect.objectContaining({
          scoreId: 'score-builder-unanchored',
          traceId: null,
          spanId: null,
          scorerId: 'judge-unanchored',
          score: 0.42,
        }),
      );
    });
  });

  describe('buildFeedbackRecord', () => {
    it('builds a complete feedback record with explicit feedback context fields', () => {
      const timestamp = new Date('2026-01-01T00:00:00.000Z');
      const event: FeedbackEvent = {
        type: 'feedback',
        feedback: {
          feedbackId: 'feedback-builder-1',
          timestamp,
          traceId: 'trace-1',
          spanId: 'span-1',
          feedbackSource: 'playground',
          feedbackType: 'thumbs-up',
          value: 'positive',
          comment: 'helpful',
          experimentId: 'exp-1',
          feedbackUserId: 'user-1',
          correlationContext: {
            organizationId: 'org-1',
          },
          metadata: {
            kept: true,
          },
        },
      };

      expect(buildFeedbackRecord(event)).toEqual({
        feedbackId: 'feedback-builder-1',
        timestamp,
        traceId: 'trace-1',
        spanId: 'span-1',
        feedbackSource: 'playground',
        source: 'playground',
        feedbackType: 'thumbs-up',
        value: 'positive',
        comment: 'helpful',
        experimentId: 'exp-1',
        feedbackUserId: 'user-1',
        sourceId: null,
        tags: null,
        entityType: null,
        entityId: null,
        entityName: null,
        entityVersionId: null,
        parentEntityVersionId: null,
        rootEntityVersionId: null,
        parentEntityType: null,
        parentEntityId: null,
        parentEntityName: null,
        rootEntityType: null,
        rootEntityId: null,
        rootEntityName: null,
        userId: null,
        organizationId: 'org-1',
        resourceId: null,
        runId: null,
        sessionId: null,
        threadId: null,
        requestId: null,
        environment: null,
        executionSource: null,
        serviceName: null,
        scope: null,
        metadata: {
          kept: true,
        },
      });
    });

    it('keeps deprecated feedback source alias support', () => {
      const timestamp = new Date('2026-01-01T00:00:00.000Z');
      const event: FeedbackEvent = {
        type: 'feedback',
        feedback: {
          feedbackId: 'feedback-builder-legacy',
          timestamp,
          traceId: 'trace-legacy-feedback-source',
          source: 'legacy-api',
          feedbackType: 'rating',
          value: 3,
        },
      };

      expect(buildFeedbackRecord(event)).toEqual(
        expect.objectContaining({
          feedbackId: 'feedback-builder-legacy',
          feedbackSource: 'legacy-api',
          source: 'legacy-api',
        }),
      );
    });

    it('allows unanchored feedback without traceId', () => {
      const timestamp = new Date('2026-01-01T00:00:00.000Z');
      const event: FeedbackEvent = {
        type: 'feedback',
        feedback: {
          feedbackId: 'feedback-builder-unanchored',
          timestamp,
          feedbackSource: 'user',
          feedbackType: 'thumbs',
          value: 1,
        },
      };

      expect(buildFeedbackRecord(event)).toEqual(
        expect.objectContaining({
          feedbackId: 'feedback-builder-unanchored',
          traceId: null,
          spanId: null,
          feedbackSource: 'user',
          feedbackType: 'thumbs',
          value: 1,
        }),
      );
    });
  });

  describe('buildLogRecord', () => {
    it('maps top-level trace ids and contextual fields from correlationContext', () => {
      const timestamp = new Date('2026-01-01T00:00:00.000Z');
      const event: LogEvent = {
        type: 'log',
        log: {
          logId: 'log-builder-1',
          timestamp,
          traceId: 'trace-1',
          spanId: 'span-1',
          level: 'info',
          message: 'hello',
          data: { foo: 'bar' },
          correlationContext: {
            tags: ['prod', 'agent'],
            entityType: EntityType.AGENT,
            entityId: 'agent-1',
            entityName: 'research-agent',
            parentEntityType: EntityType.WORKFLOW_RUN,
            parentEntityId: 'workflow-1',
            parentEntityName: 'daily-workflow',
            rootEntityType: EntityType.WORKFLOW_RUN,
            rootEntityId: 'workflow-root',
            rootEntityName: 'root-workflow',
            userId: 'user-1',
            organizationId: 'org-1',
            resourceId: 'resource-1',
            runId: 'run-1',
            sessionId: 'session-1',
            threadId: 'thread-1',
            requestId: 'request-1',
            environment: 'production',
            source: 'cloud',
            serviceName: 'api-server',
            experimentId: 'exp-1',
          },
          metadata: { kept: true },
        },
      };

      expect(buildLogRecord(event)).toEqual({
        logId: 'log-builder-1',
        timestamp,
        level: 'info',
        message: 'hello',
        data: { foo: 'bar' },
        traceId: 'trace-1',
        spanId: 'span-1',
        tags: ['prod', 'agent'],
        entityType: EntityType.AGENT,
        entityId: 'agent-1',
        entityName: 'research-agent',
        entityVersionId: null,
        parentEntityVersionId: null,
        rootEntityVersionId: null,
        parentEntityType: EntityType.WORKFLOW_RUN,
        parentEntityId: 'workflow-1',
        parentEntityName: 'daily-workflow',
        rootEntityType: EntityType.WORKFLOW_RUN,
        rootEntityId: 'workflow-root',
        rootEntityName: 'root-workflow',
        userId: 'user-1',
        organizationId: 'org-1',
        resourceId: 'resource-1',
        runId: 'run-1',
        sessionId: 'session-1',
        threadId: 'thread-1',
        requestId: 'request-1',
        environment: 'production',
        executionSource: 'cloud',
        serviceName: 'api-server',
        experimentId: 'exp-1',
        scope: null,
        metadata: { kept: true },
      });
    });

    it('uses top-level log trace ids and deprecated top-level tags', () => {
      const timestamp = new Date('2026-01-01T00:00:00.000Z');
      const event: LogEvent = {
        type: 'log',
        log: {
          logId: 'log-builder-legacy-tags',
          timestamp,
          level: 'info',
          message: 'legacy',
          traceId: 'legacy-trace',
          spanId: 'legacy-span',
          tags: ['legacy'],
        },
      };

      expect(buildLogRecord(event)).toEqual({
        logId: 'log-builder-legacy-tags',
        timestamp,
        level: 'info',
        message: 'legacy',
        data: null,
        traceId: 'legacy-trace',
        spanId: 'legacy-span',
        tags: ['legacy'],
        entityType: null,
        entityId: null,
        entityName: null,
        entityVersionId: null,
        parentEntityVersionId: null,
        rootEntityVersionId: null,
        parentEntityType: null,
        parentEntityId: null,
        parentEntityName: null,
        rootEntityType: null,
        rootEntityId: null,
        rootEntityName: null,
        userId: null,
        organizationId: null,
        resourceId: null,
        runId: null,
        sessionId: null,
        threadId: null,
        requestId: null,
        environment: null,
        executionSource: null,
        serviceName: null,
        experimentId: null,
        scope: null,
        metadata: null,
      });
    });

    it('falls back to legacy log metadata for typed correlation fields', () => {
      const timestamp = new Date('2026-01-01T00:00:00.000Z');
      const event: LogEvent = {
        type: 'log',
        log: {
          logId: 'log-builder-legacy-metadata',
          timestamp,
          level: 'info',
          message: 'legacy-metadata',
          metadata: {
            entity_type: 'agent',
            entity_name: 'my-agent',
            parent_type: 'workflow_run',
            parent_name: 'my-workflow',
            root_type: 'workflow_run',
            root_name: 'root-workflow',
            environment: 'production',
            source: 'cloud',
            service_name: 'api-server',
          },
        },
      };

      expect(buildLogRecord(event)).toEqual({
        logId: 'log-builder-legacy-metadata',
        timestamp,
        level: 'info',
        message: 'legacy-metadata',
        data: null,
        traceId: null,
        spanId: null,
        tags: null,
        entityType: EntityType.AGENT,
        entityId: null,
        entityName: 'my-agent',
        entityVersionId: null,
        parentEntityVersionId: null,
        rootEntityVersionId: null,
        parentEntityType: EntityType.WORKFLOW_RUN,
        parentEntityId: null,
        parentEntityName: 'my-workflow',
        rootEntityType: EntityType.WORKFLOW_RUN,
        rootEntityId: null,
        rootEntityName: 'root-workflow',
        userId: null,
        organizationId: null,
        resourceId: null,
        runId: null,
        sessionId: null,
        threadId: null,
        requestId: null,
        environment: 'production',
        executionSource: 'cloud',
        serviceName: 'api-server',
        experimentId: null,
        scope: null,
        metadata: {
          entity_type: 'agent',
          entity_name: 'my-agent',
          parent_type: 'workflow_run',
          parent_name: 'my-workflow',
          root_type: 'workflow_run',
          root_name: 'root-workflow',
          environment: 'production',
          source: 'cloud',
          service_name: 'api-server',
        },
      });
    });

    it('returns nulls for missing correlation context fields', () => {
      const event: LogEvent = {
        type: 'log',
        log: {
          logId: 'log-builder-warning',
          timestamp: new Date('2026-01-01T00:00:00.000Z'),
          level: 'warn',
          message: 'warning',
        },
      };

      expect(buildLogRecord(event)).toEqual({
        logId: 'log-builder-warning',
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
        level: 'warn',
        message: 'warning',
        data: null,
        traceId: null,
        spanId: null,
        tags: null,
        entityType: null,
        entityId: null,
        entityName: null,
        entityVersionId: null,
        parentEntityVersionId: null,
        rootEntityVersionId: null,
        parentEntityType: null,
        parentEntityId: null,
        parentEntityName: null,
        rootEntityType: null,
        rootEntityId: null,
        rootEntityName: null,
        userId: null,
        organizationId: null,
        resourceId: null,
        runId: null,
        sessionId: null,
        threadId: null,
        requestId: null,
        environment: null,
        executionSource: null,
        serviceName: null,
        experimentId: null,
        scope: null,
        metadata: null,
      });
    });
  });

  describe('buildScoreRecord', () => {
    it('persists derived correlation context with deprecated experimentId fallback', () => {
      const timestamp = new Date('2026-01-01T00:00:00.000Z');
      const event: ScoreEvent = {
        type: 'score',
        score: {
          scoreId: 'score-builder-relevance',
          timestamp,
          traceId: 'trace-1',
          spanId: 'span-1',
          scorerId: 'relevance',
          scorerName: 'Relevance Scorer',
          score: 0.92,
          experimentId: 'deprecated-exp',
          correlationContext: {
            tags: ['prod'],
            entityType: EntityType.AGENT,
            entityId: 'agent-1',
            entityName: 'research-agent',
            parentEntityType: EntityType.WORKFLOW_RUN,
            parentEntityId: 'workflow-1',
            parentEntityName: 'daily-workflow',
            rootEntityType: EntityType.WORKFLOW_RUN,
            rootEntityId: 'workflow-root',
            rootEntityName: 'root-workflow',
            userId: 'trace-user',
            organizationId: 'org-1',
            resourceId: 'resource-1',
            runId: 'run-1',
            sessionId: 'session-1',
            threadId: 'thread-1',
            requestId: 'request-1',
            environment: 'production',
            source: 'cloud',
            serviceName: 'api-server',
            experimentId: 'context-exp',
          },
          metadata: { kept: true },
        },
      };

      expect(buildScoreRecord(event)).toEqual({
        scoreId: 'score-builder-relevance',
        timestamp,
        traceId: 'trace-1',
        spanId: 'span-1',
        scorerId: 'relevance',
        scorerVersion: null,
        scoreSource: null,
        source: null,
        score: 0.92,
        reason: null,
        tags: ['prod'],
        entityType: EntityType.AGENT,
        entityId: 'agent-1',
        entityName: 'research-agent',
        entityVersionId: null,
        parentEntityVersionId: null,
        rootEntityVersionId: null,
        parentEntityType: EntityType.WORKFLOW_RUN,
        parentEntityId: 'workflow-1',
        parentEntityName: 'daily-workflow',
        rootEntityType: EntityType.WORKFLOW_RUN,
        rootEntityId: 'workflow-root',
        rootEntityName: 'root-workflow',
        userId: 'trace-user',
        organizationId: 'org-1',
        resourceId: 'resource-1',
        runId: 'run-1',
        sessionId: 'session-1',
        threadId: 'thread-1',
        requestId: 'request-1',
        environment: 'production',
        executionSource: 'cloud',
        serviceName: 'api-server',
        experimentId: 'context-exp',
        scope: null,
        scoreTraceId: null,
        metadata: { kept: true, scorerName: 'Relevance Scorer' },
      });
    });
  });

  describe('buildFeedbackRecord', () => {
    it('persists derived correlation context with deprecated fallbacks', () => {
      const timestamp = new Date('2026-01-01T00:00:00.000Z');
      const event: FeedbackEvent = {
        type: 'feedback',
        feedback: {
          feedbackId: 'feedback-builder-derived',
          timestamp,
          traceId: 'trace-1',
          spanId: 'span-1',
          source: 'user',
          feedbackType: 'thumbs',
          value: 1,
          feedbackUserId: 'feedback-user',
          experimentId: 'deprecated-exp',
          correlationContext: {
            tags: ['prod'],
            entityType: EntityType.AGENT,
            entityId: 'agent-1',
            entityName: 'research-agent',
            parentEntityType: EntityType.WORKFLOW_RUN,
            parentEntityId: 'workflow-1',
            parentEntityName: 'daily-workflow',
            rootEntityType: EntityType.WORKFLOW_RUN,
            rootEntityId: 'workflow-root',
            rootEntityName: 'root-workflow',
            userId: 'trace-user',
            organizationId: 'org-1',
            resourceId: 'resource-1',
            runId: 'run-1',
            sessionId: 'session-1',
            threadId: 'thread-1',
            requestId: 'request-1',
            environment: 'production',
            source: 'cloud',
            serviceName: 'api-server',
            experimentId: 'context-exp',
          },
          sourceId: 'dataset-result-1',
          metadata: { userId: 'legacy-user', kept: true },
        },
      };

      expect(buildFeedbackRecord(event)).toEqual({
        feedbackId: 'feedback-builder-derived',
        timestamp,
        traceId: 'trace-1',
        spanId: 'span-1',
        feedbackSource: 'user',
        source: 'user',
        feedbackType: 'thumbs',
        value: 1,
        comment: null,
        tags: ['prod'],
        entityType: EntityType.AGENT,
        entityId: 'agent-1',
        entityName: 'research-agent',
        entityVersionId: null,
        parentEntityVersionId: null,
        rootEntityVersionId: null,
        parentEntityType: EntityType.WORKFLOW_RUN,
        parentEntityId: 'workflow-1',
        parentEntityName: 'daily-workflow',
        rootEntityType: EntityType.WORKFLOW_RUN,
        rootEntityId: 'workflow-root',
        rootEntityName: 'root-workflow',
        userId: 'trace-user',
        organizationId: 'org-1',
        resourceId: 'resource-1',
        runId: 'run-1',
        sessionId: 'session-1',
        threadId: 'thread-1',
        requestId: 'request-1',
        environment: 'production',
        executionSource: 'cloud',
        serviceName: 'api-server',
        experimentId: 'context-exp',
        feedbackUserId: 'feedback-user',
        scope: null,
        sourceId: 'dataset-result-1',
        metadata: { userId: 'legacy-user', kept: true },
      });
    });
  });
});
