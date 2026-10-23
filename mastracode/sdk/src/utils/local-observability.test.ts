import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DuckDBStore } from '@mastra/duckdb';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
    await seeder.db.execute(
      `INSERT INTO feedback_events (timestamp, feedbackId, feedbackSource, feedbackType, value)
       VALUES (?, 'feedback-old', 'user', 'thumbs', 'up'), (?, 'feedback-new', 'user', 'thumbs', 'up')`,
      [old, recent],
    );
    await seeder.close();
  }

  it('prunes aged traces, logs, metrics, scores and feedback from an existing file on open', async () => {
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
      UNION ALL SELECT 'feedback', string_agg(feedbackId, ',') FROM feedback_events
      ORDER BY tableName
    `);
    expect(remaining).toEqual([
      { tableName: 'feedback', ids: 'feedback-new' },
      { tableName: 'logs', ids: 'log-new' },
      { tableName: 'metrics', ids: 'metric-new' },
      { tableName: 'scores', ids: 'score-new' },
      { tableName: 'spans', ids: 'new' },
    ]);
  });

  it('keeps scores and feedback for 30 days while pruning telemetry after 14', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mc-local-obs-'));
    dirs.push(dir);
    const path = join(dir, 'observability.duckdb');
    const seeder = new DuckDBStore({ path });
    await seeder.init();
    const day29 = new Date(Date.now() - 29 * DAY);
    const day31 = new Date(Date.now() - 31 * DAY);
    await seeder.db.execute(
      `INSERT INTO span_events (eventType, timestamp, traceId, spanId) VALUES ('start', ?, 'trace-29', 'span-29')`,
      [day29],
    );
    await seeder.db.execute(
      `INSERT INTO score_events (timestamp, scoreId, scorerId, score)
       VALUES (?, 'score-29', 'scorer', 1), (?, 'score-31', 'scorer', 1)`,
      [day29, day31],
    );
    await seeder.db.execute(
      `INSERT INTO feedback_events (timestamp, feedbackId, feedbackSource, feedbackType, value)
       VALUES (?, 'feedback-29', 'user', 'thumbs', 'up'), (?, 'feedback-31', 'user', 'thumbs', 'up')`,
      [day29, day31],
    );
    await seeder.close();

    const opened = await openLocalObservabilityStore(path);
    stores.push(opened.store);
    await opened.pruned;

    const remaining = await opened.store.db.query<{ tableName: string; ids: string | null }>(`
      SELECT 'feedback' AS tableName, string_agg(feedbackId, ',') AS ids FROM feedback_events
      UNION ALL SELECT 'scores', string_agg(scoreId, ',') FROM score_events
      UNION ALL SELECT 'spans', string_agg(spanId, ',') FROM span_events
      ORDER BY tableName
    `);
    expect(remaining).toEqual([
      { tableName: 'feedback', ids: 'feedback-29' },
      { tableName: 'scores', ids: 'score-29' },
      { tableName: 'spans', ids: null },
    ]);
  });

  it('opens a brand-new file without logging a prune error', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mc-local-obs-'));
    dirs.push(dir);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const opened = await openLocalObservabilityStore(join(dir, 'observability.duckdb'));
      stores.push(opened.store);

      await expect(opened.pruned).resolves.toEqual([]);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
