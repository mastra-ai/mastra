import type { ClickHouseClient } from '@clickhouse/client';
import { describe, expect, it, vi } from 'vitest';

import {
  ALL_TABLE_NAMES,
  buildAllTableDDL,
  buildLifecycleRetentionEntries,
  DELETION_REQUESTS_DDL,
  LIFECYCLE_TTL_TABLES,
  TABLE_DELETION_REQUESTS,
  TABLE_LOG_EVENTS,
} from './ddl';
import { recordDeletionRequest } from './deletion-requests';

describe('deletion lifecycle DDL', () => {
  it('adds deletedAt and a conditional 30-day TTL to every cascade table', () => {
    const tableDdls = buildAllTableDDL();

    for (const table of LIFECYCLE_TTL_TABLES) {
      const tableDdl = tableDdls.find(ddl => ddl.includes(`CREATE TABLE IF NOT EXISTS ${table} (`));
      expect(tableDdl).toContain('deletedAt          DateTime64(3) DEFAULT 0');
      expect(tableDdl).toContain('TTL deletedAt + INTERVAL 30 DAY DELETE WHERE deletedAt > toDateTime(0)');
    }
  });

  it('defines and tracks the deletion request table', () => {
    expect(DELETION_REQUESTS_DDL).toContain(`CREATE TABLE IF NOT EXISTS ${TABLE_DELETION_REQUESTS}`);
    expect(DELETION_REQUESTS_DDL).toContain('predicateValues Array(String)');
    expect(DELETION_REQUESTS_DDL).toContain('ENGINE = ReplacingMergeTree(updatedAt)');
    expect(DELETION_REQUESTS_DDL).toContain('ORDER BY (organizationId, resourceId, requestId)');
    expect(DELETION_REQUESTS_DDL).toContain('TTL toDateTime(requestedAt) + INTERVAL 90 DAY');
    expect(ALL_TABLE_NAMES).toContain(TABLE_DELETION_REQUESTS);
  });

  it('appends the deletion TTL without changing stored managed or unmanaged clauses', () => {
    const stored = new Map([
      [
        TABLE_LOG_EVENTS,
        `CREATE TABLE ${TABLE_LOG_EVENTS} (timestamp DateTime64(3), deletedAt DateTime64(3)) ENGINE = MergeTree ORDER BY timestamp TTL timestamp + toIntervalDay(14), timestamp + toIntervalDay(2) MOVE TO VOLUME 'cold'`,
      ],
    ]);

    const entry = buildLifecycleRetentionEntries(stored).find(candidate => candidate.table === TABLE_LOG_EVENTS);
    expect(entry?.sql).toBe(
      `ALTER TABLE ${TABLE_LOG_EVENTS} MODIFY TTL timestamp + toIntervalDay(14), timestamp + toIntervalDay(2) MOVE TO VOLUME 'cold', deletedAt + INTERVAL 30 DAY DELETE WHERE deletedAt > toDateTime(0)`,
    );
  });

  it('replaces only the configured managed age clause and keeps deletion TTL idempotent', () => {
    const stored = new Map([
      [
        TABLE_LOG_EVENTS,
        `CREATE TABLE ${TABLE_LOG_EVENTS} (timestamp DateTime64(3), deletedAt DateTime64(3)) ENGINE = MergeTree ORDER BY timestamp TTL timestamp + toIntervalDay(14), timestamp + toIntervalDay(2) MOVE TO VOLUME 'cold', deletedAt + toIntervalDay(30) DELETE WHERE deletedAt > toDateTime(0)`,
      ],
    ]);

    const entry = buildLifecycleRetentionEntries(stored, { logs: 7 }).find(
      candidate => candidate.table === TABLE_LOG_EVENTS,
    );
    expect(entry).toEqual({
      table: TABLE_LOG_EVENTS,
      sql: `ALTER TABLE ${TABLE_LOG_EVENTS} MODIFY TTL timestamp + INTERVAL 7 DAY, timestamp + toIntervalDay(2) MOVE TO VOLUME 'cold', deletedAt + toIntervalDay(30) DELETE WHERE deletedAt > toDateTime(0)`,
    });
    expect(
      buildLifecycleRetentionEntries(
        new Map([
          [
            TABLE_LOG_EVENTS,
            `CREATE TABLE ${TABLE_LOG_EVENTS} (timestamp DateTime64(3), deletedAt DateTime64(3)) ENGINE = MergeTree ORDER BY timestamp TTL timestamp + toIntervalDay(7), deletedAt + toIntervalDay(30) WHERE deletedAt > toDateTime(0)`,
          ],
        ]),
        { logs: 7 },
      ).find(entry => entry.table === TABLE_LOG_EVENTS),
    ).toBeUndefined();
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
    requestedAt: '2026-08-31T16:00:00.123Z',
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
