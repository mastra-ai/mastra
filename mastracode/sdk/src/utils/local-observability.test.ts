import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DuckDBStore } from '@mastra/duckdb';
import { afterEach, describe, expect, it } from 'vitest';

import { openLocalObservabilityStore } from './local-observability.js';

const DAY = 24 * 60 * 60 * 1000;

describe('openLocalObservabilityStore', () => {
  const dirs: string[] = [];
  const stores: DuckDBStore[] = [];

  afterEach(async () => {
    await Promise.all(stores.splice(0).map(store => store.close()));
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  async function seed(path: string): Promise<void> {
    const seeder = new DuckDBStore({ path });
    await seeder.init();
    const old = new Date(Date.now() - 60 * DAY);
    const recent = new Date(Date.now() - DAY);
    await seeder.db.execute(
      `INSERT INTO span_events (eventType, timestamp, traceId, spanId)
       VALUES ('start', ?, 'trace-old', 'old'), ('start', ?, 'trace-new', 'new')`,
      [old, recent],
    );
    await seeder.db.execute(
      `INSERT INTO log_events (timestamp, logId, level, message)
       VALUES (?, 'log-old', 'info', 'm'), (?, 'log-new', 'info', 'm')`,
      [old, recent],
    );
    await seeder.db.execute(
      `INSERT INTO metric_events (timestamp, metricId, name, value)
       VALUES (?, 'metric-old', 'm', 1), (?, 'metric-new', 'm', 1)`,
      [old, recent],
    );
    await seeder.db.execute(
      `INSERT INTO score_events (timestamp, scoreId, scorerId, score)
       VALUES (?, 'score-old', 'scorer', 1), (?, 'score-new', 'scorer', 1)`,
      [old, recent],
    );
    await seeder.close();
  }

  it('prunes aged traces, logs, metrics and scores from an existing file on open', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mc-local-obs-'));
    dirs.push(dir);
    const path = join(dir, 'observability.duckdb');
    await seed(path);

    const opened = await openLocalObservabilityStore(path);
    stores.push(opened.store);
    await opened.pruned;

    const remaining = await opened.store.db.query<{ tableName: string; ids: string }>(`
      SELECT 'spans' AS tableName, string_agg(spanId, ',') AS ids FROM span_events
      UNION ALL SELECT 'logs', string_agg(logId, ',') FROM log_events
      UNION ALL SELECT 'metrics', string_agg(metricId, ',') FROM metric_events
      UNION ALL SELECT 'scores', string_agg(scoreId, ',') FROM score_events
      ORDER BY tableName
    `);
    expect(remaining).toEqual([
      { tableName: 'logs', ids: 'log-new' },
      { tableName: 'metrics', ids: 'metric-new' },
      { tableName: 'scores', ids: 'score-new' },
      { tableName: 'spans', ids: 'new' },
    ]);
  });

  it('opens a brand-new file without failing the background prune', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mc-local-obs-'));
    dirs.push(dir);

    const opened = await openLocalObservabilityStore(join(dir, 'observability.duckdb'));
    stores.push(opened.store);

    await expect(opened.pruned).resolves.toBeInstanceOf(Array);
  });
});
