import { storage } from '../store';
import { buildSeedData } from './seed-data';

/**
 * Seeds the shared in-memory store with deterministic demo data so Studio's
 * threads, traces, metrics, scores, and dataset tables render populated.
 *
 * Idempotent per process: the work runs once and the resulting promise is
 * memoized. Each cold start gets its own freshly seeded store. Each domain is
 * isolated, so a failure in one area still seeds the others.
 */
let seedPromise: Promise<void> | null = null;

export function seedStudioPreview(now = Date.now()): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed(now).catch(err => {
      console.error('[studio-preview] seeding failed:', err);
    });
  }
  return seedPromise;
}

async function runSeed(now: number): Promise<void> {
  const data = buildSeedData(now);

  const [memory, observability, scores, datasets] = await Promise.all([
    storage.getStore('memory'),
    storage.getStore('observability'),
    storage.getStore('scores'),
    storage.getStore('datasets'),
  ]);

  // ---- Memory: threads + messages (chat sidebar) ----
  if (memory) {
    try {
      for (const thread of data.threads) {
        await memory.saveThread({ thread: thread as Parameters<typeof memory.saveThread>[0]['thread'] });
      }
      await memory.saveMessages({
        messages: data.messages as Parameters<typeof memory.saveMessages>[0]['messages'],
      });
    } catch (err) {
      console.error('[studio-preview] failed to seed memory:', err);
    }
  }

  // ---- Observability: traces, metrics, score events ----
  if (observability) {
    try {
      await observability.batchCreateSpans({
        records: data.spans as Parameters<typeof observability.batchCreateSpans>[0]['records'],
      });
    } catch (err) {
      console.error('[studio-preview] failed to seed traces:', err);
    }
    try {
      await observability.batchCreateMetrics({
        metrics: data.metrics as Parameters<typeof observability.batchCreateMetrics>[0]['metrics'],
      });
    } catch (err) {
      console.error('[studio-preview] failed to seed metrics:', err);
    }
    try {
      await observability.batchCreateScores({
        scores: data.obsScores as Parameters<typeof observability.batchCreateScores>[0]['scores'],
      });
    } catch (err) {
      console.error('[studio-preview] failed to seed score metrics:', err);
    }
  }

  // ---- Scores: list rows ----
  if (scores) {
    try {
      for (const score of data.scores) {
        await scores.saveScore(score as Parameters<typeof scores.saveScore>[0]);
      }
    } catch (err) {
      console.error('[studio-preview] failed to seed scores:', err);
    }
  }

  // ---- Datasets + items ----
  if (datasets) {
    try {
      for (const { dataset, items } of data.datasets) {
        const record = await datasets.createDataset(dataset as Parameters<typeof datasets.createDataset>[0]);
        if (record?.id) {
          await datasets.batchInsertItems({
            datasetId: record.id,
            items: items as Parameters<typeof datasets.batchInsertItems>[0]['items'],
          });
        }
      }
    } catch (err) {
      console.error('[studio-preview] failed to seed datasets:', err);
    }
  }
}
