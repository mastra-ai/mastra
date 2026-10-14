import { expect, it } from 'vitest';
import { draftingFixture } from '../support/drafting.ts';
import { temporaryDirectory, cleanupDirectory } from '../fixtures/support.ts';
import { openProcessingStore } from '../../src/mastra/persistence/processing.ts';
import { openDatabase } from '../../src/mastra/persistence/database.ts';
import { defaultExecutionPolicy } from '../../src/mastra/contracts/execution-policy.ts';
import { serviceLimits } from '../../src/mastra/contracts/service-limits.ts';

it('atomically limits reserved spend across run IDs and retains it after reopening and run usage cleanup', async () => {
  const root = await temporaryDirectory();
  const first = await draftingFixture(root, { runId: 'first' });
  const second = await draftingFixture(root, { runId: 'second' });
  const store = await openProcessingStore(first.url);
  const other = await openProcessingStore(first.url);
  const policy = {
    ...defaultExecutionPolicy,
    budgetUsd: 100,
    maxOutputTokens: 1,
    rates: { ...defaultExecutionPolicy.rates, inputUsdPerMillion: 0, outputUsdPerMillion: 30_000_000 },
  };
  try {
    await store.begin(first.runId, policy);
    await other.begin(second.runId, policy);
    const results = await Promise.all([
      store.reserve(first.runId, 'q', 'draft', 1, 1),
      other.reserve(second.runId, 'q', 'draft', 1, 1),
    ]);
    expect(results.filter(r => 'record' in r)).toHaveLength(1);
    expect(results.filter(r => 'failure' in r)).toEqual([{ failure: 'BUDGET_EXHAUSTED' }]);
  } finally {
    await store.close();
    await other.close();
  }
  try {
    const db = await openDatabase(first.url);
    await db.execute('DELETE FROM vrq_usage');
    db.close();
    const third = await draftingFixture(root, { runId: 'third' });
    const reopened = await openProcessingStore(first.url);
    try {
      await reopened.begin(third.runId, policy);
      expect(await reopened.reserve(third.runId, 'q', 'draft', 1, 1)).toEqual({ failure: 'BUDGET_EXHAUSTED' });
    } finally {
      await reopened.close();
    }
  } finally {
    await cleanupDirectory(root);
  }
});

it('bounds calls even at zero configured cost and expires old reservations', async () => {
  const root = await temporaryDirectory();
  try {
    const f = await draftingFixture(root);
    const store = await openProcessingStore(f.url);
    const db = await openDatabase(f.url);
    try {
      await store.begin(f.runId, defaultExecutionPolicy);
      await db.execute({
        sql: 'WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i < ?) INSERT INTO vrq_service_usage SELECT CAST(i AS TEXT), ?, 0 FROM n',
        args: [serviceLimits.maxDailyCalls, new Date().toISOString()],
      });
      expect(await store.reserve(f.runId, 'q', 'draft', 1, 1)).toEqual({ failure: 'BUDGET_EXHAUSTED' });
      await db.execute("UPDATE vrq_service_usage SET created_at = '2000-01-01T00:00:00.000Z'");
      const next = await draftingFixture(root, { runId: 'next' });
      await store.begin(next.runId, defaultExecutionPolicy);
      expect(await store.reserve(next.runId, 'q', 'draft', 1, 1)).toHaveProperty('record');
    } finally {
      db.close();
      await store.close();
    }
  } finally {
    await cleanupDirectory(root);
  }
});
