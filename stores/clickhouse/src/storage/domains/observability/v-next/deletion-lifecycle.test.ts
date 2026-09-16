import type { ClickHouseClient } from '@clickhouse/client';
import { describe, expect, it, vi } from 'vitest';

import { ALL_MIGRATIONS, ALL_TABLE_NAMES, DELETION_REQUESTS_DDL, TABLE_DELETION_REQUESTS } from './ddl';
import { recordDeletionRequest } from './deletion-requests';

describe('deletion request DDL', () => {
  it('defines and tracks the deletion request table', () => {
    expect(DELETION_REQUESTS_DDL).toContain(`CREATE TABLE IF NOT EXISTS ${TABLE_DELETION_REQUESTS}`);
    expect(DELETION_REQUESTS_DDL).toContain('predicateValues Array(String)');
    expect(DELETION_REQUESTS_DDL).toContain('ENGINE = ReplacingMergeTree(updatedAt)');
    expect(DELETION_REQUESTS_DDL).toContain('ORDER BY (organizationId, resourceId, requestId)');
    expect(DELETION_REQUESTS_DDL).not.toContain('TTL');
    expect(ALL_TABLE_NAMES).toContain(TABLE_DELETION_REQUESTS);
  });

  it('indexes predicateValues for fresh tables and existing deployments', () => {
    const indexDdl = 'idx_predicateValues predicateValues TYPE bloom_filter(0.01) GRANULARITY 2';
    expect(DELETION_REQUESTS_DDL).toContain(`INDEX ${indexDdl}`);

    const migration = ALL_MIGRATIONS.find(
      entry =>
        entry.kind === 'index' && entry.table === TABLE_DELETION_REQUESTS && entry.name === 'idx_predicateValues',
    );
    expect(migration?.sql).toBe(`ALTER TABLE ${TABLE_DELETION_REQUESTS} ADD INDEX IF NOT EXISTS ${indexDdl}`);
  });
});

describe('recordDeletionRequest', () => {
  const args = {
    requestId: 'request-1',
    organizationId: 'org-1',
    resourceId: 'resource-1',
    signal: 'traces' as const,
    predicateType: 'traceIds' as const,
    predicateValues: ['trace-2', 'trace-1', 'trace-2'],
    requestedAt: '2026-09-01T16:00:00.123Z',
  };

  it('inserts the complete request row without quorum for non-replicated tables', async () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    const row = await recordDeletionRequest({ insert } as unknown as ClickHouseClient, args);

    expect(row).toEqual({
      ...args,
      requestedBy: '',
      lastAppliedAt: '1970-01-01T00:00:00.000Z',
      purgeVerifiedAt: '1970-01-01T00:00:00.000Z',
      updatedAt: args.requestedAt,
    });
    expect(insert).toHaveBeenCalledWith({
      table: TABLE_DELETION_REQUESTS,
      values: [row],
      format: 'JSONEachRow',
      clickhouse_settings: {
        date_time_input_format: 'best_effort',
        use_client_time_zone: 1,
        output_format_json_quote_64bit_integers: 0,
      },
    });
  });

  it('requires insert quorum when replication is configured', async () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    await recordDeletionRequest({ insert } as unknown as ClickHouseClient, {
      ...args,
      replication: { cluster: 'test_cluster' },
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        clickhouse_settings: expect.objectContaining({
          insert_quorum: 'auto',
          insert_quorum_parallel: 1,
        }),
      }),
    );
  });
});
