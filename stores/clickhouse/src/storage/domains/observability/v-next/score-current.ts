import type { ClickHouseClient } from '@clickhouse/client';

import {
  SCORE_EVENT_COLUMN_NAMES,
  TABLE_SCORE_EVENTS,
  TABLE_SCORE_EVENTS_CURRENT,
  TABLE_SCORE_EVENTS_CURRENT_BACKFILL,
} from './ddl';

const SCORE_CURRENT_BACKFILL_MARKER = 'v1';

export async function backfillCurrentScores(client: ClickHouseClient): Promise<void> {
  const markerResult = await client.query({
    query: `SELECT count() AS count
            FROM ${TABLE_SCORE_EVENTS_CURRENT_BACKFILL} FINAL
            WHERE marker = {marker:String}`,
    query_params: { marker: SCORE_CURRENT_BACKFILL_MARKER },
    format: 'JSONEachRow',
  });
  const markerRows = (await markerResult.json()) as Array<{ count: string | number }>;
  if (Number(markerRows[0]?.count ?? 0) > 0) return;

  const columns = SCORE_EVENT_COLUMN_NAMES.join(', ');
  await client.command({
    query: `INSERT INTO ${TABLE_SCORE_EVENTS_CURRENT} (${columns})
            SELECT ${columns}
            FROM (
              SELECT *, cityHash64(tuple(*)) AS _currentScoreFingerprint
              FROM ${TABLE_SCORE_EVENTS} FINAL
              ORDER BY scoreId, writeVersion DESC, timestamp DESC, _currentScoreFingerprint DESC
              LIMIT 1 BY scoreId
            )`,
    clickhouse_settings: {
      max_bytes_ratio_before_external_sort: 0.5,
    },
  });

  await client.command({
    query: `INSERT INTO ${TABLE_SCORE_EVENTS_CURRENT_BACKFILL} (marker, completedAt)
            VALUES ({marker:String}, now64(3, 'UTC'))`,
    query_params: { marker: SCORE_CURRENT_BACKFILL_MARKER },
  });
}
