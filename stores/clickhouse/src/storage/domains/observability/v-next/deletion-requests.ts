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
