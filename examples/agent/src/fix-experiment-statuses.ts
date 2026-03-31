/**
 * Fix experiment statuses directly via LibSQL storage.
 * Converts failed/pending experiments to a realistic mix of completed/failed/running.
 *
 * Usage: cd examples/agent && npx tsx src/fix-experiment-statuses.ts
 */

import { LibSQLStore } from '@mastra/libsql';

async function fix() {
  console.log('🔧 Fixing experiment statuses...\n');

  // The dev server uses examples/agent/src/mastra/public/mastra.db
  const dbPath = new URL('./mastra/public/mastra.db', import.meta.url).pathname;
  console.log(`DB path: ${dbPath}\n`);

  const store = new LibSQLStore({
    id: 'fix-storage',
    url: `file:${dbPath}`,
  });

  const experimentsStore = await store.getStore('experiments');
  if (!experimentsStore) throw new Error('No experiments store');

  const { experiments } = await experimentsStore.listExperiments({
    pagination: { page: 0, perPage: 200 },
  });

  console.log(`Found ${experiments.length} experiments\n`);

  let completedCount = 0;
  let failedCount = 0;
  let runningCount = 0;

  for (const exp of experiments) {
    // Assign realistic status distribution: 65% completed, 20% failed, 15% running
    const roll = Math.random();
    let newStatus: 'completed' | 'failed' | 'running';
    let succeeded: number;
    let failed: number;

    if (roll < 0.65) {
      newStatus = 'completed';
      // Most items succeed, a few might fail
      const failRate = Math.random() * 0.3; // 0-30% fail rate
      failed = Math.floor(exp.totalItems * failRate);
      succeeded = exp.totalItems - failed;
      completedCount++;
    } else if (roll < 0.85) {
      newStatus = 'failed';
      succeeded = 0;
      failed = exp.totalItems;
      failedCount++;
    } else {
      newStatus = 'running';
      succeeded = Math.floor(exp.totalItems * Math.random() * 0.5);
      failed = 0;
      runningCount++;
    }

    const hoursAgo = Math.random() * 168; // within last 7 days
    const startedAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const completedAt =
      newStatus !== 'running' ? new Date(startedAt.getTime() + (Math.random() * 120000 + 5000)) : null;

    await experimentsStore.updateExperiment({
      id: exp.id,
      status: newStatus,
      succeededCount: succeeded,
      failedCount: failed,
      startedAt,
      ...(completedAt ? { completedAt } : {}),
    });

    console.log(`  ${exp.id.slice(0, 8)} → ${newStatus} (${succeeded}/${exp.totalItems} succeeded)`);
  }

  console.log(`\n✅ Updated ${experiments.length} experiments:`);
  console.log(`  Completed: ${completedCount}`);
  console.log(`  Failed: ${failedCount}`);
  console.log(`  Running: ${runningCount}`);
}

fix().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
