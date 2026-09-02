import { randomUUID } from 'node:crypto';

import type { ClickHouseClient } from '@clickhouse/client';

import { isReplicationConfigured } from '../../../db/replication';
import type { ClickhouseReplicationConfig } from '../../../db/replication';
import { TABLE_DELETION_REQUESTS } from './ddl';
import { CH_INSERT_SETTINGS } from './helpers';

export interface DeletionRequestRow {
  requestId: string;
  requestedAt: string;
  completedAt: null;
  requestType: 'score' | 'feedback';
  organizationId: string | null;
  resourceId: string | null;
  traceIds: string[];
  experimentId: null;
  datasetId: null;
  datasetItemIds: string[];
  scoreIds: string[];
  feedbackIds: string[];
  status: 'pending';
  lastError: null;
  attemptCount: number;
  nextAttemptAt: null;
}

export interface RecordDeletionRequestArgs {
  requestType: DeletionRequestRow['requestType'];
  organizationId?: string;
  resourceId?: string;
  scoreIds?: string[];
  feedbackIds?: string[];
  replication?: ClickhouseReplicationConfig;
}

export async function recordDeletionRequest(
  client: ClickHouseClient,
  args: RecordDeletionRequestArgs,
): Promise<DeletionRequestRow> {
  const row: DeletionRequestRow = {
    requestId: randomUUID(),
    requestedAt: new Date().toISOString(),
    completedAt: null,
    requestType: args.requestType,
    organizationId: args.organizationId ?? null,
    resourceId: args.resourceId ?? null,
    traceIds: [],
    experimentId: null,
    datasetId: null,
    datasetItemIds: [],
    scoreIds: args.scoreIds ?? [],
    feedbackIds: args.feedbackIds ?? [],
    status: 'pending',
    lastError: null,
    attemptCount: 0,
    nextAttemptAt: null,
  };

  await client.insert({
    table: TABLE_DELETION_REQUESTS,
    values: [row],
    format: 'JSONEachRow',
    clickhouse_settings: isReplicationConfigured(args.replication)
      ? { ...CH_INSERT_SETTINGS, insert_quorum: 'auto', insert_quorum_parallel: 1 }
      : CH_INSERT_SETTINGS,
  });

  return row;
}
