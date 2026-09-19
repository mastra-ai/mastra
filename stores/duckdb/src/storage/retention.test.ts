import { afterEach, describe, expect, it } from 'vitest';

import { DuckDBStore } from './index';

const DAY = 24 * 60 * 60 * 1000;

async function insertSpanEvent(store: DuckDBStore, spanId: string, timestamp: Date): Promise<void> {
  await store.db.execute(
    `INSERT INTO span_events (eventType, timestamp, traceId, spanId)
     VALUES ('start', ?, ?, ?)`,
    [timestamp, `trace-${spanId}`, spanId],
  );
}

describe('DuckDB retention', () => {
  const stores: DuckDBStore[] = [];

  afterEach(async () => {
    await Promise.all(stores.splice(0).map(store => store.close()));
  });

  async function newStore(
    retention?: NonNullable<ConstructorParameters<typeof DuckDBStore>[0]>['retention'],
  ): Promise<DuckDBStore> {
    const store = new DuckDBStore({ path: ':memory:', retention });
    stores.push(store);
    await store.init();
    return store;
  }

  it('prunes old events for every observability signal and keeps newer events', async () => {
    const policy = { maxAge: '30d' as const };
    const store = await newStore({
      observability: { spans: policy, metrics: policy, logs: policy, scores: policy, feedback: policy },
    });
    const old = new Date(Date.now() - 31 * DAY);
    await insertSpanEvent(store, 'old', old);
    await insertSpanEvent(store, 'new', new Date(Date.now() - 29 * DAY));
    const recent = new Date(Date.now() - 29 * DAY);
    await store.db.execute(
      `INSERT INTO metric_events (timestamp, metricId, name, value)
       VALUES (?, 'metric-old', 'm', 1), (?, 'metric-new', 'm', 1)`,
      [old, recent],
    );
    await store.db.execute(
      `INSERT INTO log_events (timestamp, logId, level, message)
       VALUES (?, 'log-old', 'info', 'm'), (?, 'log-new', 'info', 'm')`,
      [old, recent],
    );
    await store.db.execute(
      `INSERT INTO score_events (timestamp, scoreId, scorerId, score)
       VALUES (?, 'score-old', 'scorer', 1), (?, 'score-new', 'scorer', 1)`,
      [old, recent],
    );
    await store.db.execute(
      `INSERT INTO feedback_events (timestamp, feedbackId, feedbackSource, feedbackType, value)
       VALUES (?, 'feedback-old', 'user', 'thumbs', 'up'), (?, 'feedback-new', 'user', 'thumbs', 'up')`,
      [old, recent],
    );

    await expect(store.prune()).resolves.toEqual([
      { domain: 'observability', table: 'span_events', deleted: 1, done: true },
      { domain: 'observability', table: 'metric_events', deleted: 1, done: true },
      { domain: 'observability', table: 'log_events', deleted: 1, done: true },
      { domain: 'observability', table: 'score_events', deleted: 1, done: true },
      { domain: 'observability', table: 'feedback_events', deleted: 1, done: true },
    ]);

    const remaining = await store.db.query<{ tableName: string; count: number }>(`
      SELECT 'spans' AS tableName, count(*)::INTEGER AS count FROM span_events
      UNION ALL SELECT 'metrics', count(*)::INTEGER FROM metric_events
      UNION ALL SELECT 'logs', count(*)::INTEGER FROM log_events
      UNION ALL SELECT 'scores', count(*)::INTEGER FROM score_events
      UNION ALL SELECT 'feedback', count(*)::INTEGER FROM feedback_events
      ORDER BY tableName
    `);
    expect(remaining).toEqual([
      { tableName: 'feedback', count: 1 },
      { tableName: 'logs', count: 1 },
      { tableName: 'metrics', count: 1 },
      { tableName: 'scores', count: 1 },
      { tableName: 'spans', count: 1 },
    ]);
  });

  it('supports bounded, resumable batches', async () => {
    const store = await newStore();
    for (let i = 0; i < 3; i++) {
      await insertSpanEvent(store, `old-${i}`, new Date(Date.now() - 31 * DAY));
    }

    await expect(
      store.prune({ retention: { observability: { spans: { maxAge: '30d', batchSize: 2 } } }, maxRows: 2 }),
    ).resolves.toEqual([{ domain: 'observability', table: 'span_events', deleted: 2, done: false }]);

    await expect(
      store.prune({ retention: { observability: { spans: { maxAge: '30d', batchSize: 2 } } } }),
    ).resolves.toEqual([{ domain: 'observability', table: 'span_events', deleted: 1, done: true }]);
  });

  it('leaves data untouched when no table policy is configured', async () => {
    const store = await newStore({ observability: {} });
    await insertSpanEvent(store, 'old', new Date(Date.now() - 31 * DAY));

    await expect(store.prune()).resolves.toEqual([]);
    const rows = await store.db.query<{ count: number }>('SELECT count(*)::INTEGER AS count FROM span_events');
    expect(rows).toEqual([{ count: 1 }]);
  });
});
