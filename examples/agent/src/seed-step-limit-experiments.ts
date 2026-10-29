/**
 * Reproduces the "agent ran out of steps" experiment case: same dataset, one
 * experiment on `docsAgent` (answers in markdown) and one on
 * `docsAgentStepLimited` (maxSteps: 2 → tool calls but empty `text`).
 *
 * Usage: MASTRA_URL=http://localhost:4123 npx tsx src/seed-step-limit-experiments.ts
 */
import { MastraClient } from '@mastra/client-js';

const baseUrl = process.env.MASTRA_URL ?? 'http://localhost:4111';

const QUESTIONS = [
  'How much does Mastra cost?',
  'What does maxSteps do on an agent?',
  'How do I create a workflow with branches?',
];

async function main() {
  const client = new MastraClient({ baseUrl });

  const dataset = await client.createDataset({
    name: `Docs agent step limit ${Date.now()}`,
    description: 'Baseline answers vs. contender that runs out of steps mid tool-call',
    targetType: 'agent',
    targetIds: ['docsAgent', 'docsAgentStepLimited'],
  });

  for (const input of QUESTIONS) {
    await client.addDatasetItem({ datasetId: dataset.id, input });
  }

  const baseline = await client.triggerDatasetExperiment({
    datasetId: dataset.id,
    targetType: 'agent',
    targetId: 'docsAgent',
    name: 'baseline (maxSteps: 12)',
  });
  const contender = await client.triggerDatasetExperiment({
    datasetId: dataset.id,
    targetType: 'agent',
    targetId: 'docsAgentStepLimited',
    name: 'contender (maxSteps: 2)',
  });

  const ids = [baseline.experimentId, contender.experimentId];
  for (;;) {
    const experiments = await Promise.all(ids.map(id => client.getDatasetExperiment(dataset.id, id)));
    console.log(experiments.map(e => `${e.name}: ${e.status} ${e.succeededCount}/${e.totalItems}`).join(' | '));
    if (experiments.every(e => e.status !== 'pending' && e.status !== 'running')) break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\nComparison: /experiments/compare?dataset=${dataset.id}&baseline=${ids[0]}&contender=${ids[1]}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
