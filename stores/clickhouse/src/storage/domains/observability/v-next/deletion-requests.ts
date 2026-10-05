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

  await insertDeletionRequest(client, row, args.replication);

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
  // A pending version with an unparsable timestamp falls back to now.
  const pendingAt = Date.parse(row.updatedAt);
  const appliedAt = new Date(
    Number.isFinite(pendingAt) ? Math.max(Date.now(), pendingAt + 1) : Date.now(),
  ).toISOString();
  const applied: DeletionRequestRow = { ...row, lastAppliedAt: appliedAt, updatedAt: appliedAt };

  await insertDeletionRequest(client, applied, replication);

  return applied;
}

/**
 * Replicated clusters insert with parallel quorum, the same as every other
 * deletion-request write on main, so concurrent deletes never reject each other.
 * The guard that reads these rows is advisory: review updates mutate feedback
 * in place and preserve the delete mask, so a replica that has not yet received
 * a marker can only mis-report a status, never bring deleted feedback back.
 */
async function insertDeletionRequest(
  client: ClickHouseClient,
  row: DeletionRequestRow,
  replication?: ClickhouseReplicationConfig,
): Promise<void> {
  await client.insert({
    table: TABLE_DELETION_REQUESTS,
    values: [row],
    format: 'JSONEachRow',
    clickhouse_settings: isReplicationConfigured(replication)
      ? { ...CH_INSERT_SETTINGS, insert_quorum: 'auto', insert_quorum_parallel: 1 }
      : CH_INSERT_SETTINGS,
  });
}
