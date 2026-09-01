import type { ClickHouseClient } from '@clickhouse/client';
import { describe, expect, it, vi } from 'vitest';

import { buildTrustedQueryScopeFilter, CLICKHOUSE_TRUSTED_QUERY_SCOPE } from './trusted-query-scope';
import { ObservabilityStorageClickhouseVNext } from './index';

describe('buildTrustedQueryScopeFilter', () => {
  it('builds parameterized AND constraints for trusted infrastructure scope', () => {
    expect(
      buildTrustedQueryScopeFilter({
        organizationId: 'org-1',
        projectId: 'project-1',
      }),
    ).toEqual({
      conditions: [
        'organizationId = {trustedScope_organizationId:String}',
        'projectId = {trustedScope_projectId:String}',
      ],
      params: {
        trustedScope_organizationId: 'org-1',
        trustedScope_projectId: 'project-1',
      },
    });
  });

  it('applies trusted scope inside an aggregate query', async () => {
    const query = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue([{ value: 3 }]),
    });
    const client = { query } as unknown as ClickHouseClient;
    const storage = new ObservabilityStorageClickhouseVNext({
      client,
      [CLICKHOUSE_TRUSTED_QUERY_SCOPE]: {
        organizationId: 'org-1',
        projectId: 'project-1',
      },
    });

    await storage.getScoreAggregate({ scorerId: 'quality', aggregation: 'count' });

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining(
          'WHERE organizationId = {trustedScope_organizationId:String} AND projectId = {trustedScope_projectId:String}',
        ),
        query_params: expect.objectContaining({
          trustedScope_organizationId: 'org-1',
          trustedScope_projectId: 'project-1',
        }),
      }),
    );
  });

  it('rejects identifiers that could inject SQL', () => {
    expect(() => buildTrustedQueryScopeFilter({ 'projectId) OR 1=1 --': 'project-1' })).toThrow(
      'Invalid trusted query scope column',
    );
  });
});
