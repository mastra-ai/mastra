import type { ClickHouseClient } from '@clickhouse/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ALL_MIGRATIONS, ALL_TABLE_NAMES, DELETION_REQUESTS_DDL, TABLE_DELETION_REQUESTS } from './ddl';
import { markDeletionRequestApplied, recordDeletionRequest } from './deletion-requests';

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
          insert_quorum_parallel: 0,
          async_insert: 0,
        }),
      }),
    );
  });
});

describe('markDeletionRequestApplied', () => {
  const pending = {
    requestId: 'request-1',
    organizationId: 'org-1',
    resourceId: 'resource-1',
    signal: 'feedback' as const,
    predicateType: 'itemIds' as const,
    predicateValues: ['feedback-1'],
    requestedAt: '2026-09-01T16:00:00.123Z',
    requestedBy: '',
    lastAppliedAt: '1970-01-01T00:00:00.000Z',
    purgeVerifiedAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '2026-09-01T16:00:00.123Z',
  };

  it('re-inserts the same request with lastAppliedAt and a newer updatedAt', async () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    const applied = await markDeletionRequestApplied({ insert } as unknown as ClickHouseClient, pending);

    expect(applied).toEqual({ ...pending, lastAppliedAt: applied.lastAppliedAt, updatedAt: applied.lastAppliedAt });
    expect(applied.lastAppliedAt).not.toBe(pending.lastAppliedAt);
    expect(new Date(applied.updatedAt).getTime()).toBeGreaterThan(new Date(pending.updatedAt).getTime());
    expect(applied.purgeVerifiedAt).toBe(pending.purgeVerifiedAt);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ table: TABLE_DELETION_REQUESTS, values: [applied], format: 'JSONEachRow' }),
    );
    expect(insert.mock.calls[0]?.[0].clickhouse_settings).not.toHaveProperty('insert_quorum');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays strictly newer than a pending version recorded in the same millisecond', async () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    const now = '2026-09-01T16:00:00.123Z';
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));

    const applied = await markDeletionRequestApplied({ insert } as unknown as ClickHouseClient, {
      ...pending,
      requestedAt: now,
      updatedAt: now,
    });

    expect(applied.updatedAt).toBe('2026-09-01T16:00:00.124Z');
    expect(applied.lastAppliedAt).toBe(applied.updatedAt);
  });

  it('requires insert quorum when replication is configured', async () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    await markDeletionRequestApplied({ insert } as unknown as ClickHouseClient, pending, { cluster: 'test_cluster' });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        clickhouse_settings: expect.objectContaining({
          insert_quorum: 'auto',
          insert_quorum_parallel: 0,
          async_insert: 0,
        }),
      }),
    );
  });
});

describe('serialized quorum contention', () => {
  const args = {
    requestId: 'contended-request',
    signal: 'feedback' as const,
    predicateType: 'itemIds' as const,
    predicateValues: ['feedback-1'],
    requestedAt: '2026-09-01T16:00:00.123Z',
    replication: {},
  };
  const busy = () => Object.assign(new Error('previous quorum is pending'), { code: '286' });

  it('retries the same pending and applied rows without changing identity or version', async () => {
    const insert = vi.fn().mockRejectedValueOnce(busy()).mockResolvedValue(undefined);
    const client = { insert } as unknown as ClickHouseClient;
    const pending = await recordDeletionRequest(client, args);
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[0]).toEqual(insert.mock.calls[1]);
    insert.mockClear().mockRejectedValueOnce(busy()).mockResolvedValue(undefined);
    const applied = await markDeletionRequestApplied(client, pending, {});
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[0]).toEqual(insert.mock.calls[1]);
    expect(applied.requestId).toBe(pending.requestId);
    expect(applied.lastAppliedAt).not.toBe(pending.lastAppliedAt);
  });

  it('bounds retries and preserves the final error for caller recovery', async () => {
    const error = busy();
    const insert = vi.fn().mockRejectedValue(error);
    await expect(recordDeletionRequest({ insert } as unknown as ClickHouseClient, args)).rejects.toBe(error);
    expect(insert).toHaveBeenCalledTimes(6);
  });

  it.each(['285', '999'])('does not retry ambiguous failures (code %s)', async code => {
    const error = Object.assign(new Error('insert failed'), { code });
    const insert = vi.fn().mockRejectedValue(error);
    await expect(recordDeletionRequest({ insert } as unknown as ClickHouseClient, args)).rejects.toBe(error);
    expect(insert).toHaveBeenCalledOnce();
  });
});
