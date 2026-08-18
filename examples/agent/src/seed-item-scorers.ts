import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MastraClient } from '@mastra/client-js';

const baseUrl = process.env.MASTRA_URL ?? 'http://localhost:4111';
const statePath = join(tmpdir(), 'mastra-4510-manual-state.json');

interface ManualTestState {
  baseUrl: string;
  datasetId: string;
  datasetScorerId: string;
  itemScorerId: string;
  runScorerId: string;
  items: {
    inherit: string;
    override: string;
    disabled: string;
  };
}

async function main() {
  const client = new MastraClient({ baseUrl });
  const suffix = Date.now();
  const datasetScorerId = `manual-dataset-scorer-${suffix}`;
  const itemScorerId = `manual-item-scorer-${suffix}`;
  const runScorerId = `manual-run-scorer-${suffix}`;

  await client.listScorers();

  await createScorer(client, datasetScorerId, 'Manual dataset scorer', 'relevant to the user input');
  await createScorer(client, itemScorerId, 'Manual item scorer', 'clear and concise');
  await createScorer(client, runScorerId, 'Manual run scorer', 'factually correct');

  const scorers = await client.listScorers();
  for (const scorerId of [datasetScorerId, itemScorerId, runScorerId]) {
    if (!scorers[scorerId]?.isRegistered) {
      throw new Error(`Scorer ${scorerId} was created but was not registered`);
    }
  }

  const dataset = await client.createDataset({
    name: `Manual item scorer test ${suffix}`,
    description: 'Manual verification for MASTRA-4510',
    targetType: 'agent',
    targetIds: ['evalAgent'],
    scorerIds: [datasetScorerId],
  });

  const inheritItem = await client.addDatasetItem({
    datasetId: dataset.id,
    externalId: 'inherit-dataset-scorer',
    input: 'Answer in one sentence: What is TypeScript?',
    groundTruth: 'TypeScript is a typed superset of JavaScript.',
  });

  const overrideItem = await client.addDatasetItem({
    datasetId: dataset.id,
    externalId: 'override-with-item-scorer',
    input: 'Answer in one sentence: What is Node.js?',
    groundTruth: 'Node.js is a JavaScript runtime.',
    scorerIds: [itemScorerId],
  });

  const disabledItem = await client.addDatasetItem({
    datasetId: dataset.id,
    externalId: 'override-with-no-scorers',
    input: 'Answer in one sentence: What is JSON?',
    groundTruth: 'JSON is a text data-interchange format.',
    scorerIds: [],
  });

  const state: ManualTestState = {
    baseUrl,
    datasetId: dataset.id,
    datasetScorerId,
    itemScorerId,
    runScorerId,
    items: {
      inherit: inheritItem.id,
      override: overrideItem.id,
      disabled: disabledItem.id,
    },
  };
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

  const { items } = await client.listDatasetItems(dataset.id, { perPage: 100 });
  console.log(`Created dataset: ${dataset.id}`);
  console.log(`State written to: ${statePath}`);
  console.table(
    items.map(item => ({
      id: item.id,
      externalId: item.externalId,
      scorerIds: item.scorerIds === undefined ? 'inherited' : JSON.stringify(item.scorerIds),
    })),
  );
  console.log('Next: pnpm item-scorers:run inherit');
}

async function createScorer(client: MastraClient, id: string, name: string, focus: string) {
  await client.createStoredScorer({
    id,
    name,
    description: focus,
    type: 'llm-judge',
    model: { provider: 'openai', name: 'gpt-5.5' },
    instructions: `Judge whether the response is ${focus}. Return a score from 0 to 1.`,
    scoreRange: { min: 0, max: 1 },
    defaultSampling: { type: 'none' },
  });
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
