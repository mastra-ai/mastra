import type { ClickHouseClient } from '@clickhouse/client';

import { isReplicationConfigured } from '../../../db/replication';
import type { ClickhouseReplicationConfig } from '../../../db/replication';
import { TABLE_DELETION_REQUESTS } from './ddl';
import { CH_INSERT_SETTINGS } from './helpers';

export interface DeletionRequestRow {
  requestId: string;
  organizationId: string;
  resourceId: string;
  signal: 'traces' | 'feedback' | 'scores';
  predicateType: 'traceIds' | 'itemIds' | 'experimentId' | 'tenant';
  predicateValues: string[];
  requestedAt: string;
  requestedBy: string;
  lastAppliedAt: string;
  purgeVerifiedAt: string;
  updatedAt: string;
}

export interface RecordDeletionRequestArgs {
  requestId: string;
  organizationId?: string;
  resourceId?: string;
  signal: DeletionRequestRow['signal'];
  predicateType: DeletionRequestRow['predicateType'];
  predicateValues: string[];
  requestedAt: string;
  requestedBy?: string;
  replication?: ClickhouseReplicationConfig;
}

const EPOCH = '1970-01-01T00:00:00.000Z';

/**
 * Quorum settings for deletion-request writes on replicated clusters.
 *
 * `select_sequential_consistency` on the mutation guard only holds when quorum
 * inserts are serialized: parallel quorum inserts can land on different replica
 * sets, so no single replica is guaranteed to hold every write. ClickHouse also
 * rejects quorum inserts that are async (`async_insert` defaults to 1 on recent
 * servers), so the audit write is pinned synchronous here. Both are required
 * together; relaxing either silently drops the guard's read guarantee.
 */
const QUORUM_INSERT_SETTINGS = {
  insert_quorum: 'auto',
  insert_quorum_parallel: 0,
  async_insert: 0,
} as const;

export async function recordDeletionRequest(
  client: ClickHouseClient,
  args: RecordDeletionRequestArgs,
): Promise<DeletionRequestRow> {
  const row: DeletionRequestRow = {
    requestId: args.requestId,
    organizationId: args.organizationId ?? '',
    resourceId: args.resourceId ?? '',
    signal: args.signal,
    predicateType: args.predicateType,
    predicateValues: args.predicateValues,
    requestedAt: args.requestedAt,
    requestedBy: args.requestedBy ?? '',
    lastAppliedAt: EPOCH,
    purgeVerifiedAt: EPOCH,
    updatedAt: args.requestedAt,
  };

  await client.insert({
    table: TABLE_DELETION_REQUESTS,
    values: [row],
    format: 'JSONEachRow',
    clickhouse_settings: isReplicationConfigured(args.replication)
      ? { ...CH_INSERT_SETTINGS, ...QUORUM_INSERT_SETTINGS }
      : CH_INSERT_SETTINGS,
  });

  return row;
}

/**
 * Marks a recorded deletion request as applied after its lightweight DELETEs
 * succeeded. The table is `ReplacingMergeTree(updatedAt)`, so re-inserting the
 * row with a newer `updatedAt` supersedes the pending version on merge and
 * under `FINAL`. Requests whose DELETE failed keep `lastAppliedAt` at the
 * epoch; mutation guards ignore them, and re-invoking the delete API records a
 * new request and converges.
 */
export async function markDeletionRequestApplied(
  client: ClickHouseClient,
  row: DeletionRequestRow,
  replication?: ClickhouseReplicationConfig,
): Promise<DeletionRequestRow> {
  // Strictly newer than the pending version so ReplacingMergeTree(updatedAt)
  // never has to tie-break, even when the delete finished within the same ms.
  const appliedAt = new Date(Math.max(Date.now(), Date.parse(row.updatedAt) + 1)).toISOString();
  const applied: DeletionRequestRow = { ...row, lastAppliedAt: appliedAt, updatedAt: appliedAt };

  await client.insert({
    table: TABLE_DELETION_REQUESTS,
    values: [applied],
    format: 'JSONEachRow',
    clickhouse_settings: isReplicationConfigured(replication)
      ? { ...CH_INSERT_SETTINGS, ...QUORUM_INSERT_SETTINGS }
      : CH_INSERT_SETTINGS,
  });

  return applied;
}
