import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MastraClient } from '@mastra/client-js';

const statePath = join(tmpdir(), 'mastra-4510-manual-state.json');
const terminalStatuses = new Set(['completed', 'failed']);
const validModes = ['inherit', 'run', 'none', 'clear', 'stale', 'restore'] as const;
type Mode = (typeof validModes)[number];

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
  const mode = parseMode(process.argv[2]);
  const state = JSON.parse(await readFile(statePath, 'utf8')) as ManualTestState;
  const client = new MastraClient({ baseUrl: process.env.MASTRA_URL ?? state.baseUrl });

  if (mode === 'clear') {
    await client.updateDatasetItem({
      datasetId: state.datasetId,
      itemId: state.items.override,
      scorerIds: null,
    });
  } else if (mode === 'stale') {
    await client.updateDatasetItem({
      datasetId: state.datasetId,
      itemId: state.items.override,
      scorerIds: ['missing-manual-scorer'],
    });
  } else if (mode === 'restore') {
    await client.updateDatasetItem({
      datasetId: state.datasetId,
      itemId: state.items.override,
      scorerIds: [state.itemScorerId],
    });
  }

  const scorerIds = mode === 'run' ? [state.runScorerId] : mode === 'none' ? [] : undefined;
  const trigger = await client.triggerDatasetExperiment({
    datasetId: state.datasetId,
    targetType: 'agent',
    targetId: 'evalAgent',
    maxConcurrency: 1,
    ...(scorerIds !== undefined ? { scorerIds } : {}),
  });

  console.log(`Experiment: ${trigger.experimentId}`);
  await printExpectedSelection(client, state, mode);

  let experiment = await client.getDatasetExperiment(state.datasetId, trigger.experimentId);
  for (let attempt = 0; attempt < 180 && !terminalStatuses.has(experiment.status); attempt++) {
    process.stdout.write(`\rStatus: ${experiment.status}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    experiment = await client.getDatasetExperiment(state.datasetId, trigger.experimentId);
  }
  process.stdout.write(`\rStatus: ${experiment.status}\n`);

  if (!terminalStatuses.has(experiment.status)) {
    throw new Error('Experiment did not finish within six minutes');
  }

  const [{ results }, { scores }] = await Promise.all([
    client.listDatasetExperimentResults(state.datasetId, trigger.experimentId, { perPage: 100 }),
    client.listScoresByRunId({ runId: trigger.experimentId, perPage: 100 }),
  ]);

  console.log('Item results:');
  console.table(
    results.map(result => ({
      item: itemLabel(state, result.itemId),
      error: formatError(result.error),
      retryCount: result.retryCount,
      hasOutput: result.output !== null,
    })),
  );

  console.log('Persisted scores:');
  console.table(
    scores.map(score => ({
      item: itemLabel(state, score.entityId),
      scorerId: score.scorerId,
      score: score.score,
    })),
  );
}

function parseMode(value: string | undefined): Mode {
  const mode = value ?? 'inherit';
  if (!validModes.includes(mode as Mode)) {
    throw new Error(`Usage: pnpm item-scorers:run <${validModes.join('|')}>`);
  }
  return mode as Mode;
}

async function printExpectedSelection(client: MastraClient, state: ManualTestState, mode: Mode) {
  const { items } = await client.listDatasetItems(state.datasetId, { perPage: 100 });
  const registeredScorers = await client.listScorers();
  const runScorerIds = mode === 'run' ? [state.runScorerId] : mode === 'none' ? [] : undefined;

  console.log('Expected selection:');
  console.table(
    items.map(item => {
      const scorerIds = runScorerIds ?? item.scorerIds ?? [state.datasetScorerId];
      const missingIds = scorerIds.filter(id => !registeredScorers[id]?.isRegistered);
      return {
        item: itemLabel(state, item.id),
        outcome:
          missingIds.length > 0 ? `configuration error: ${missingIds.join(', ')}` : scorerIds.join(', ') || 'no scores',
      };
    }),
  );
}

function itemLabel(state: ManualTestState, itemId: string) {
  return Object.entries(state.items).find(([, id]) => id === itemId)?.[0] ?? itemId;
}

function formatError(error: unknown) {
  if (error === null || error === undefined) return '';
  return typeof error === 'string' ? error : JSON.stringify(error);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
