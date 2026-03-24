import { describe, expect, it } from 'vitest';
import type { LogEvent, MetricEvent } from '../../../observability';
import { EntityType } from '../../../observability/types/tracing';
import { buildLogRecord, buildMetricRecord } from './record-builders';

describe('record-builders', () => {
  describe('buildMetricRecord', () => {
    it('maps shared correlation fields and canonical cost fields', () => {
      const timestamp = new Date('2026-01-01T00:00:00.000Z');
      const event: MetricEvent = {
        type: 'metric',
        metric: {
          timestamp,
          name: 'mastra_agent_duration_ms',
          value: 42,
          labels: {
            other_label: 'kept',
          },
          correlationContext: {
            traceId: 'trace-1',
            spanId: 'span-1',
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
              estimationStatus: 'ok',
              pricingRowId: 'openai-gpt-4o-mini',
              matchedTierIndex: 0,
            },
          },
          metadata: { kept: true },
        },
      };

      expect(buildMetricRecord(event)).toEqual({
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
        scope: null,
        provider: 'openai',
        model: 'gpt-4o-mini',
        estimatedCost: 0.00123,
        costUnit: 'usd',
        costMetadata: {
          estimationStatus: 'ok',
          pricingRowId: 'openai-gpt-4o-mini',
          matchedTierIndex: 0,
        },
        metadata: { kept: true },
      });
    });

    it('does not infer canonical cost fields from metric labels', () => {
      const event: MetricEvent = {
        type: 'metric',
        metric: {
          timestamp: new Date('2026-01-01T00:00:00.000Z'),
          name: 'mastra_tokens',
          value: 10,
          labels: {
            other_label: 'kept',
          },
        },
      };

      expect(buildMetricRecord(event)).toEqual({
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
        source: null,
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
        source: null,
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

  describe('buildLogRecord', () => {
    it('maps log fields from correlationContext only', () => {
      const timestamp = new Date('2026-01-01T00:00:00.000Z');
      const event: LogEvent = {
        type: 'log',
        log: {
          timestamp,
          level: 'info',
          message: 'hello',
          data: { foo: 'bar' },
          correlationContext: {
            traceId: 'trace-1',
            spanId: 'span-1',
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
        scope: null,
        metadata: { kept: true },
      });
    });

    it('falls back to deprecated top-level log correlation fields', () => {
      const timestamp = new Date('2026-01-01T00:00:00.000Z');
      const event: LogEvent = {
        type: 'log',
        log: {
          timestamp,
          level: 'info',
          message: 'legacy',
          traceId: 'legacy-trace',
          spanId: 'legacy-span',
          tags: ['legacy'],
        },
      };

      expect(buildLogRecord(event)).toEqual({
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
        source: null,
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
        source: 'cloud',
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
          timestamp: new Date('2026-01-01T00:00:00.000Z'),
          level: 'warn',
          message: 'warning',
        },
      };

      expect(buildLogRecord(event)).toEqual({
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
        source: null,
        serviceName: null,
        experimentId: null,
        scope: null,
        metadata: null,
      });
    });
  });
});
