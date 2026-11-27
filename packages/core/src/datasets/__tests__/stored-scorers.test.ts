/**
 * Stored scorers (created through the editor — platform "managed scorers") are
 * only in Mastra's scorer registry after the editor hydrates them. A durable
 * experiment step can run in a worker that never did, so every scorer level
 * must load them on demand.
 *
 * Real Mastra, real evented engine, real in-memory storage. The editor is a
 * separate package; the stub below does what it does on `scorer.getById`:
 * read the stored definition and register the scorer on Mastra.
 */
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { IMastraEditor } from '../../editor/types';
import { createScorer } from '../../evals/base';
import type { MastraScorer } from '../../evals/base';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createStep, createWorkflow } from '../../workflows';
import { createScorerResolver } from '../experiment/scorer';
import { EXPERIMENT_WORKFLOW_ID } from '../experiment/workflow';

const TextInput = z.object({ text: z.string() });

const upperTarget = createWorkflow({ id: 'upper', inputSchema: TextInput, outputSchema: TextInput })
  .then(
    createStep({
      id: 'upper',
      inputSchema: TextInput,
      outputSchema: TextInput,
      execute: async ({ inputData }) => ({ text: inputData.text.toUpperCase() }),
    }),
  )
  .commit();

const judge = (id: string, score: number) =>
  createScorer({ id, description: `Stored judge ${id}` }).generateScore(() => score);

/** Editor stand-in: `stored` plays the scorerDefinitions table; ids in `unreachable` fail to load like a storage outage. */
function storedScorerEditor(stored: Map<string, MastraScorer<any, any, any, any>>, unreachable: Set<string>) {
  let mastra: Mastra | undefined;
  return {
    registerWithMastra: (instance: Mastra) => {
      mastra = instance;
    },
    scorer: {
      getById: async (id: string) => {
        if (unreachable.has(id)) throw new Error(`scorer storage unavailable while loading ${id}`);
        const scorer = stored.get(id);
        if (!scorer) return null;
        mastra!.addScorer(scorer, id, { source: 'stored' });
        return { id };
      },
    },
  } as unknown as IMastraEditor;
}

describe('stored scorers in experiments', () => {
  const started: Mastra[] = [];

  afterEach(async () => {
    const mastras = started.splice(0);
    await Promise.all(mastras.map(mastra => mastra.stopWorkers()));
    for (const mastra of mastras) mastra.__unregisterHooks();
  });

  async function setup(storedScorers: MastraScorer<any, any, any, any>[]) {
    const stored = new Map(storedScorers.map(scorer => [scorer.id, scorer]));
    const unreachable = new Set<string>();
    const storage = new InMemoryStore();
    const mastra = new Mastra({
      workflows: { upper: upperTarget },
      storage,
      pubsub: new EventEmitterPubSub(),
      editor: storedScorerEditor(stored, unreachable),
      logger: false,
    });
    await mastra.startWorkers();
    started.push(mastra);
    return { mastra, storage, stored, unreachable };
  }

  async function seedDataset(mastra: Mastra, scorerIds?: string[]) {
    const dataset = await mastra.datasets.create({ name: `stored-scorers-${randomUUID()}`, scorerIds });
    await dataset.addItems({ items: [{ input: { text: 'a' } }, { input: { text: 'b' } }] });
    return dataset;
  }

  async function runDurably(mastra: Mastra, datasetId: string, experimentId: string) {
    await mastra.__ensureExperimentWorkflow();
    const run = await mastra.__getInternalWorkflow(EXPERIMENT_WORKFLOW_ID).createRun({ runId: experimentId });
    await run.startAsync({ inputData: { datasetId, experimentId } });
  }

  async function waitForExperiment(storage: InMemoryStore, experimentId: string) {
    const experiments = (await storage.getStore('experiments'))!;
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const experiment = await experiments.getExperimentById({ id: experimentId });
      if (experiment?.status === 'completed' || experiment?.status === 'failed') return experiment;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error(`experiment ${experimentId} did not finish`);
  }

  async function scoresFor(storage: InMemoryStore, experimentId: string) {
    const { scores } = await (await storage.getStore('scores'))!.listScoresByRunId({
      runId: experimentId,
      pagination: { page: 0, perPage: 100 },
    });
    return scores.map(score => [score.scorerId, score.score]);
  }

  it('a durable run scores items with an experiment-level stored scorer the worker never loaded', async () => {
    const { mastra, storage } = await setup([judge('managed-judge', 0.7)]);
    const dataset = await seedDataset(mastra);
    const { experimentId } = await dataset.createExperiment({
      targetType: 'workflow',
      targetId: 'upper',
      scorers: ['managed-judge'],
    });
    // The process that created the experiment loaded the scorer; the worker running the steps has not.
    mastra.removeScorer('managed-judge');

    await runDurably(mastra, dataset.id, experimentId);

    const experiment = await waitForExperiment(storage, experimentId);
    expect(experiment.status).toBe('completed');
    expect(experiment.succeededCount).toBe(2);
    expect(await scoresFor(storage, experimentId)).toEqual([
      ['managed-judge', 0.7],
      ['managed-judge', 0.7],
    ]);
  });

  it('a durable run scores items with a dataset-level stored scorer', async () => {
    const { mastra, storage } = await setup([judge('dataset-judge', 0.4)]);
    const dataset = await seedDataset(mastra, ['dataset-judge']);
    const { experimentId } = await dataset.createExperiment({ targetType: 'workflow', targetId: 'upper' });

    await runDurably(mastra, dataset.id, experimentId);

    expect((await waitForExperiment(storage, experimentId)).status).toBe('completed');
    expect(await scoresFor(storage, experimentId)).toEqual([
      ['dataset-judge', 0.4],
      ['dataset-judge', 0.4],
    ]);
  });

  it('an in-process run scores items with run-level and dataset-level stored scorers', async () => {
    const { mastra } = await setup([judge('run-judge', 1), judge('dataset-judge', 0.5)]);

    const runLevel = await (
      await seedDataset(mastra)
    ).startExperiment({ targetType: 'workflow', targetId: 'upper', scorers: ['run-judge'] });
    expect(runLevel.results.map(item => item.scores.map(score => [score.scorerId, score.score]))).toEqual([
      [['run-judge', 1]],
      [['run-judge', 1]],
    ]);

    mastra.removeScorer('dataset-judge');
    const datasetLevel = await (
      await seedDataset(mastra, ['dataset-judge'])
    ).startExperiment({ targetType: 'workflow', targetId: 'upper' });
    expect(datasetLevel.results.map(item => item.scores.map(score => [score.scorerId, score.score]))).toEqual([
      [['dataset-judge', 0.5]],
      [['dataset-judge', 0.5]],
    ]);
  });

  it('an in-process run scores a workflow step with a stored scorer that was never loaded', async () => {
    const { mastra } = await setup([judge('step-judge', 0.9)]);

    const summary = await (
      await seedDataset(mastra)
    ).startExperiment({ targetType: 'workflow', targetId: 'upper', scorers: { steps: { upper: ['step-judge'] } } });

    expect(summary.status).toBe('completed');
    expect(summary.results.map(item => item.scores.map(score => [score.scorerId, score.stepId, score.score]))).toEqual([
      [['step-judge', 'upper', 0.9]],
      [['step-judge', 'upper', 0.9]],
    ]);
  });

  it('rejects an unknown step scorer before creating the experiment', async () => {
    const { mastra, storage } = await setup([judge('step-judge', 1)]);
    const dataset = await seedDataset(mastra);

    await expect(
      dataset.startExperiment({
        targetType: 'workflow',
        targetId: 'upper',
        scorers: { steps: { upper: ['step-judge', 'typo-step-judge'] } },
      }),
    ).rejects.toMatchObject({ id: 'EXPERIMENT_SCORER_NOT_FOUND', message: expect.stringContaining('typo-step-judge') });
    await expect(
      dataset.startExperimentAsync({
        targetType: 'workflow',
        targetId: 'upper',
        scorers: { steps: { upper: ['typo-step-judge'] } },
      }),
    ).rejects.toMatchObject({ id: 'EXPERIMENT_SCORER_NOT_FOUND' });

    const { experiments } = await (await storage.getStore('experiments'))!.listExperiments({
      pagination: { page: 0, perPage: 10 },
    });
    expect(experiments).toHaveLength(0);
  });

  it('rejects an unknown run-level scorer before creating the experiment', async () => {
    const { mastra, storage } = await setup([judge('managed-judge', 1)]);
    const dataset = await seedDataset(mastra);

    await expect(
      dataset.createExperiment({ targetType: 'workflow', targetId: 'upper', scorers: ['managed-judge', 'typo-judge'] }),
    ).rejects.toMatchObject({ id: 'EXPERIMENT_SCORER_NOT_FOUND', message: expect.stringContaining('typo-judge') });
    await expect(
      dataset.startExperimentAsync({
        targetType: 'workflow',
        targetId: 'upper',
        scorers: ['typo-judge'],
        durable: true,
      }),
    ).rejects.toMatchObject({ id: 'EXPERIMENT_SCORER_NOT_FOUND' });
    await expect(
      dataset.startExperimentAsync({
        targetType: 'workflow',
        targetId: 'upper',
        scorers: { workflow: ['typo-judge'] },
      }),
    ).rejects.toMatchObject({ id: 'EXPERIMENT_SCORER_NOT_FOUND' });

    const { experiments } = await (await storage.getStore('experiments'))!.listExperiments({
      pagination: { page: 0, perPage: 10 },
    });
    expect(experiments).toHaveLength(0);
  });

  async function resultErrors(storage: InMemoryStore, experimentId: string) {
    const { results } = await (await storage.getStore('experiments'))!.listExperimentResults({
      experimentId,
      pagination: { page: 0, perPage: 100 },
    });
    return results
      .map(result => [result.input, result.error])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }

  it('fails every item, not the experiment, when its stored scorer is deleted after the experiment was created', async () => {
    const { mastra, storage, stored } = await setup([judge('managed-judge', 1)]);
    const dataset = await seedDataset(mastra);
    const { experimentId } = await dataset.createExperiment({
      targetType: 'workflow',
      targetId: 'upper',
      scorers: ['managed-judge'],
    });
    stored.delete('managed-judge');
    mastra.removeScorer('managed-judge');

    await runDurably(mastra, dataset.id, experimentId);

    const experiment = await waitForExperiment(storage, experimentId);
    expect(experiment).toMatchObject({ status: 'completed', succeededCount: 0, failedCount: 2 });
    const error = {
      code: 'EXPERIMENT_ITEM_SCORER_NOT_FOUND',
      message: 'Experiment scorer configuration references unregistered scorer IDs: managed-judge',
    };
    expect(await resultErrors(storage, experimentId)).toEqual([
      [{ text: 'a' }, error],
      [{ text: 'b' }, error],
    ]);
    expect(await scoresFor(storage, experimentId)).toEqual([]);
  });

  it('fails only the items that use a deleted dataset-level stored scorer; the rest still run', async () => {
    const { mastra, storage, stored } = await setup([judge('dataset-judge', 1), judge('item-judge', 0.3)]);
    const dataset = await mastra.datasets.create({
      name: `stored-scorers-${randomUUID()}`,
      scorerIds: ['dataset-judge'],
    });
    await dataset.addItems({
      items: [{ input: { text: 'a' } }, { input: { text: 'b' }, scorerIds: ['item-judge'] }],
    });
    const { experimentId } = await dataset.createExperiment({ targetType: 'workflow', targetId: 'upper' });
    stored.delete('dataset-judge');
    mastra.removeScorer('dataset-judge');

    await runDurably(mastra, dataset.id, experimentId);

    const experiment = await waitForExperiment(storage, experimentId);
    expect(experiment).toMatchObject({ status: 'completed', succeededCount: 1, failedCount: 1 });
    expect(await resultErrors(storage, experimentId)).toEqual([
      [
        { text: 'a' },
        {
          code: 'EXPERIMENT_ITEM_SCORER_NOT_FOUND',
          message: 'Dataset scorer configuration references unregistered scorer IDs: dataset-judge',
        },
      ],
      [{ text: 'b' }, null],
    ]);
    expect(await scoresFor(storage, experimentId)).toEqual([['item-judge', 0.3]]);
  });

  it('reports a failed scorer lookup as that error, not as an unknown scorer ID', async () => {
    const { mastra, storage, unreachable } = await setup([judge('managed-judge', 1)]);
    const dataset = await seedDataset(mastra);
    unreachable.add('managed-judge');

    const rejection = dataset.createExperiment({
      targetType: 'workflow',
      targetId: 'upper',
      scorers: ['managed-judge'],
    });
    await expect(rejection).rejects.toThrow('scorer storage unavailable while loading managed-judge');
    await expect(rejection).rejects.not.toMatchObject({ id: 'EXPERIMENT_SCORER_NOT_FOUND' });
    const { experiments } = await (await storage.getStore('experiments'))!.listExperiments({
      pagination: { page: 0, perPage: 10 },
    });
    expect(experiments).toHaveLength(0);
  });

  it('fails a durable run whose scorer lookup fails mid-run, instead of reporting the scorer as missing', async () => {
    const { mastra, storage, unreachable } = await setup([judge('managed-judge', 1)]);
    const dataset = await seedDataset(mastra);
    const { experimentId } = await dataset.createExperiment({
      targetType: 'workflow',
      targetId: 'upper',
      scorers: ['managed-judge'],
    });
    mastra.removeScorer('managed-judge');
    unreachable.add('managed-judge');

    await runDurably(mastra, dataset.id, experimentId);

    expect((await waitForExperiment(storage, experimentId)).status).toBe('failed');
    const errors = (await resultErrors(storage, experimentId)).map(([, error]) => error);
    expect(errors).not.toContainEqual(expect.objectContaining({ code: 'EXPERIMENT_ITEM_SCORER_NOT_FOUND' }));
  });

  it('retries a scorer lookup that failed, rather than caching the failure for the run', async () => {
    const { mastra, unreachable } = await setup([judge('managed-judge', 1)]);
    const resolve = createScorerResolver(mastra);
    unreachable.add('managed-judge');

    await expect(resolve(['managed-judge'])).rejects.toThrow('scorer storage unavailable');

    unreachable.delete('managed-judge');
    const resolution = await resolve(['managed-judge']);
    expect(resolution.missingIds).toEqual([]);
    expect(resolution.scorers.map(scorer => scorer.id)).toEqual(['managed-judge']);
  });
});
