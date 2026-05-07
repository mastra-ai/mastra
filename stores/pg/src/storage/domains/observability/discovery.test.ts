import { MastraError } from '@mastra/core/error';
import { EntityType, SpanType } from '@mastra/core/observability';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { connectionString } from '../../test-utils';
import { ObservabilityPG } from './index';

describe('ObservabilityPG discovery', () => {
  let pool: Pool;
  let storage: ObservabilityPG;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    storage = new ObservabilityPG({ pool });
    await storage.init();
  });

  beforeEach(async () => {
    await storage.dangerouslyClearAll();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('returns distinct entity names filtered by entity type', async () => {
    const startedAt = new Date('2026-01-01T00:00:00.000Z');

    await storage.createSpan({
      span: {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'agent span',
        spanType: SpanType.AGENT_RUN,
        isEvent: false,
        startedAt,
        entityType: EntityType.AGENT,
        entityId: 'agent-1',
        entityName: 'Chef Agent',
        serviceName: 'agent-service',
        environment: 'production',
        tags: ['agent', 'chef'],
      },
    });
    await storage.createSpan({
      span: {
        traceId: 'trace-2',
        spanId: 'span-2',
        name: 'duplicate agent span',
        spanType: SpanType.AGENT_RUN,
        isEvent: false,
        startedAt,
        entityType: EntityType.AGENT,
        entityId: 'agent-2',
        entityName: 'Chef Agent',
        serviceName: 'agent-service',
        environment: 'production',
        tags: ['agent'],
      },
    });
    await storage.createSpan({
      span: {
        traceId: 'trace-3',
        spanId: 'span-3',
        name: 'tool span',
        spanType: SpanType.TOOL_CALL,
        isEvent: false,
        startedAt,
        entityType: EntityType.TOOL,
        entityId: 'tool-1',
        entityName: 'Weather Tool',
        serviceName: 'tool-service',
        environment: 'staging',
        tags: ['tool', 'weather'],
      },
    });

    await expect(storage.getEntityTypes({})).resolves.toEqual({
      entityTypes: [EntityType.AGENT, EntityType.TOOL],
    });
    await expect(storage.getEntityNames({ entityType: EntityType.AGENT })).resolves.toEqual({
      names: ['Chef Agent'],
    });
    await expect(storage.getEntityNames({})).resolves.toEqual({
      names: ['Chef Agent', 'Weather Tool'],
    });
    await expect(storage.getServiceNames({})).resolves.toEqual({
      serviceNames: ['agent-service', 'tool-service'],
    });
    await expect(storage.getEnvironments({})).resolves.toEqual({
      environments: ['production', 'staging'],
    });
    await expect(storage.getTags({ entityType: EntityType.AGENT })).resolves.toEqual({
      tags: ['agent', 'chef'],
    });
    await expect(storage.getTags({})).resolves.toEqual({
      tags: ['agent', 'chef', 'tool', 'weather'],
    });
  });

  it('normalizes database errors from discovery queries', async () => {
    const cause = new Error('database unavailable');
    const storageWithFailingClient = new ObservabilityPG({
      client: {
        manyOrNone: vi.fn().mockRejectedValue(cause),
      } as any,
    });

    const cases: Array<[string, () => Promise<unknown>, string]> = [
      ['entity types', () => storageWithFailingClient.getEntityTypes({}), 'Failed to fetch entityTypes from storage'],
      [
        'entity names',
        () => storageWithFailingClient.getEntityNames({ entityType: EntityType.AGENT }),
        'Failed to fetch entityNames from storage',
      ],
      [
        'service names',
        () => storageWithFailingClient.getServiceNames({}),
        'Failed to fetch serviceNames from storage',
      ],
      ['environments', () => storageWithFailingClient.getEnvironments({}), 'Failed to fetch environments from storage'],
      [
        'tags',
        () => storageWithFailingClient.getTags({ entityType: EntityType.AGENT }),
        'Failed to fetch tags from storage',
      ],
    ];

    for (const [_name, callDiscoveryMethod, message] of cases) {
      await expect(callDiscoveryMethod()).rejects.toMatchObject({
        message,
        cause: expect.objectContaining({ message: cause.message }),
      });
      await expect(callDiscoveryMethod()).rejects.toBeInstanceOf(MastraError);
    }
  });
});
