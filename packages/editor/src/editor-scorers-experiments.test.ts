/**
 * Durable experiments scored by stored (editor-created) llm-judge scorers.
 * The experiment is created from one Mastra instance and its steps run on a
 * separate worker instance with its own scorer registry and editor; both share
 * the database and the event bus, like an API process and a worker process.
 */
import { randomUUID } from 'node:crypto';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { LanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Mastra } from '@mastra/core';
import { createScorer } from '@mastra/core/evals';
import { EventEmitterPubSub } from '@mastra/core/events';
import { MastraModelGateway } from '@mastra/core/llm';
import type { ProviderConfig } from '@mastra/core/llm';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { LibSQLStore } from '@mastra/libsql';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MastraEditor } from './index';

const JUDGE_MODEL = `judge-${randomUUID()}`;
const LENIENT = 'Rate how helpful the response is from 0 to 1.';
const STRICT = 'STRICT: only a perfect answer scores above 0.5.';
const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

/** Scores 0.2 under the strict instructions and 0.6 otherwise, so a score shows which version judged. */
const judgeModel = new MockLanguageModelV2({
  doStream: async ({ prompt }) => {
    const reply = JSON.stringify({ score: JSON.stringify(prompt).includes('STRICT') ? 0.2 : 0.6 });
    return {
      rawCall: { rawPrompt: null, rawSettings: {} },
      stream: convertArrayToReadableStream([
        { type: 'text-start' as const, id: 'text-1' },
        { type: 'text-delta' as const, id: 'text-1', delta: reply },
        { type: 'text-end' as const, id: 'text-1' },
        { type: 'finish' as const, finishReason: 'stop' as const, usage },
      ]),
    };
  },
});

class JudgeGateway extends MastraModelGateway {
  readonly id = 'models.dev';
  readonly name = 'Judge gateway';
  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return { mock: { name: 'Mock', models: [JUDGE_MODEL], apiKeyEnvVar: 'MOCK_API_KEY', gateway: 'models.dev' } };
  }
  buildUrl(): string {
    return 'https://api.mock-gateway.com/v1';
  }
  async getApiKey(): Promise<string> {
    return 'MOCK_API_KEY';
  }
  async resolveEmbeddingModel(): Promise<any> {
    throw new Error('Not implemented');
  }
  async resolveLanguageModel(args: { modelId: string }): Promise<LanguageModelV2> {
    if (args.modelId !== JUDGE_MODEL) throw new Error(`Unknown mock model: ${args.modelId}`);
    return judgeModel;
  }
}

const TextInput = z.object({ text: z.string() });

const upperTarget = () =>
  createWorkflow({ id: 'upper', inputSchema: TextInput, outputSchema: TextInput })
    .then(
      createStep({
        id: 'upper',
        inputSchema: TextInput,
        outputSchema: TextInput,
        execute: async ({ inputData }) => ({ text: inputData.text.toUpperCase() }),
      }),
    )
    .commit();

const codeScorer = createScorer({ id: 'code-check', description: 'Code scorer' }).generateScore(() => 1);

describe('stored scorers in durable experiments', () => {
  const mastras: Mastra[] = [];

  afterEach(async () => {
    await Promise.all(mastras.map(mastra => mastra.stopWorkers()));
    for (const mastra of mastras.splice(0)) mastra.__unregisterHooks();
  });

  /** An API instance and a started worker instance over one database and event bus. */
  async function setup() {
    const storage = new LibSQLStore({ id: `experiments-${randomUUID()}`, url: ':memory:' });
    await storage.init();
    const pubsub = new EventEmitterPubSub();
    const instance = () => {
      const mastra = new Mastra({
        storage,
        editor: new MastraEditor(),
        workflows: { upper: upperTarget() },
        scorers: { 'code-check': codeScorer },
        gateways: { 'models.dev': new JudgeGateway() },
        pubsub,
        logger: false,
      });
      mastras.push(mastra);
      return mastra;
    };
    const api = instance();
    const worker = instance();
    await worker.startWorkers();
    return { storage, api, worker };
  }

  async function createJudge(mastra: Mastra, id: string) {
    const created = await mastra.getEditor()!.scorer.create({
      id,
      name: id,
      type: 'llm-judge',
      model: { provider: 'mock', name: JUDGE_MODEL },
      instructions: LENIENT,
    });
    return created.resolvedVersionId!;
  }

  /** Publish a new version of a stored scorer with different instructions, as editing it in Studio does. */
  async function publishInstructions(mastra: Mastra, id: string, instructions: string) {
    const store = (await mastra.getStorage()!.getStore('scorerDefinitions'))!;
    const current = (await store.getByIdResolved(id))!;
    const versionId = randomUUID();
    await store.createVersion({
      id: versionId,
      scorerDefinitionId: id,
      versionNumber: 2,
      name: current.name,
      type: current.type,
      model: current.model,
      instructions,
      changedFields: ['instructions'],
    });
    await mastra.getEditor()!.scorer.update({ id, activeVersionId: versionId, status: 'published' });
    return versionId;
  }

  async function seedDataset(mastra: Mastra) {
    const dataset = await mastra.datasets.create({ name: `stored-scorers-${randomUUID()}` });
    await dataset.addItems({ items: [{ input: { text: 'a' } }, { input: { text: 'b' } }] });
    return dataset;
  }

  async function runDurably(worker: Mastra, datasetId: string, experimentId: string) {
    await worker.__ensureExperimentWorkflow();
    const run = await worker.__getInternalWorkflow('__mastra-experiment').createRun({ runId: experimentId });
    await run.startAsync({ inputData: { datasetId, experimentId } });
  }

  async function waitForExperiment(storage: LibSQLStore, experimentId: string) {
    const experiments = (await storage.getStore('experiments'))!;
    const deadline = Date.now() + 15_000;
    let experiment = await experiments.getExperimentById({ id: experimentId });
    while (experiment?.status !== 'completed' && experiment?.status !== 'failed' && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
      experiment = await experiments.getExperimentById({ id: experimentId });
    }
    return experiment;
  }

  async function scoresFor(storage: LibSQLStore, experimentId: string) {
    const { scores } = await (await storage.getStore('scores'))!.listScoresByRunId({
      runId: experimentId,
      pagination: { page: 0, perPage: 10 },
    });
    return scores.map(score => ({ scorerId: score.scorerId, score: score.score, versionId: score.scorer.versionId }));
  }

  it('a worker that never loaded the stored scorer still scores every item', async () => {
    const { storage, api, worker } = await setup();
    const versionId = await createJudge(api, 'helpfulness');
    expect(worker.listScorers()['helpfulness']).toBeUndefined();

    const dataset = await seedDataset(api);
    const { experimentId } = await dataset.startExperimentAsync({
      targetType: 'workflow',
      targetId: 'upper',
      scorers: ['helpfulness'],
      durable: true,
    });

    expect(await waitForExperiment(storage, experimentId)).toMatchObject({ status: 'completed', succeededCount: 2 });
    expect(await scoresFor(storage, experimentId)).toEqual([
      { scorerId: 'helpfulness', score: 0.6, versionId },
      { scorerId: 'helpfulness', score: 0.6, versionId },
    ]);
  });

  it('pins the version of every stored scorer the experiment can use, but not code scorers', async () => {
    const { api } = await setup();
    const runVersion = await createJudge(api, 'run-judge');
    const datasetVersion = await createJudge(api, 'dataset-judge');
    const itemVersion = await createJudge(api, 'item-judge');

    const dataset = await api.datasets.create({ name: 'pins', scorerIds: ['dataset-judge'] });
    await dataset.addItems({ items: [{ input: { text: 'a' }, scorerIds: ['item-judge'] }, { input: { text: 'b' } }] });
    const { experimentId } = await dataset.createExperiment({
      targetType: 'workflow',
      targetId: 'upper',
      scorers: ['run-judge', 'code-check'],
    });

    expect((await dataset.getExperiment({ experimentId }))?.scorerVersions).toEqual({
      'run-judge': runVersion,
      'dataset-judge': datasetVersion,
      'item-judge': itemVersion,
    });
  });

  it('scores every item with the pinned version when the scorer is edited after the experiment starts', async () => {
    const { storage, api, worker } = await setup();
    const pinnedVersion = await createJudge(api, 'helpfulness');
    const dataset = await seedDataset(api);
    const { experimentId } = await dataset.createExperiment({
      targetType: 'workflow',
      targetId: 'upper',
      scorers: ['helpfulness'],
    });
    await publishInstructions(api, 'helpfulness', STRICT);

    await runDurably(worker, dataset.id, experimentId);

    expect((await waitForExperiment(storage, experimentId))?.status).toBe('completed');
    expect(await scoresFor(storage, experimentId)).toEqual([
      { scorerId: 'helpfulness', score: 0.6, versionId: pinnedVersion },
      { scorerId: 'helpfulness', score: 0.6, versionId: pinnedVersion },
    ]);
    // The pinned version was used for this run only; the registry still serves the published version.
    expect(worker.listScorers()['helpfulness']).toBeUndefined();
    await worker.getEditor()!.scorer.getById('helpfulness');
    const current = await worker
      .getScorerById('helpfulness')
      .run({ input: { text: 'a' }, output: { text: 'A' } } as any);
    expect(current.score).toBe(0.2);
  });

  it('fails a run whose pinned scorer version cannot be loaded, instead of reporting the scorer as missing', async () => {
    const { storage, api, worker } = await setup();
    await createJudge(api, 'helpfulness');
    const dataset = await seedDataset(api);
    const { experimentId } = await dataset.createExperiment({
      targetType: 'workflow',
      targetId: 'upper',
      scorers: ['helpfulness'],
    });
    const scorerDefinitions = (await storage.getStore('scorerDefinitions'))!;
    vi.spyOn(scorerDefinitions, 'getByIdResolved').mockRejectedValue(new Error('scorer storage unavailable'));

    await runDurably(worker, dataset.id, experimentId);

    expect((await waitForExperiment(storage, experimentId))?.status).toBe('failed');
    const { results } = await (await storage.getStore('experiments'))!.listExperimentResults({
      experimentId,
      pagination: { page: 0, perPage: 10 },
    });
    expect(results.map(result => result.error?.code)).not.toContain('EXPERIMENT_ITEM_SCORER_NOT_FOUND');
  });

  it('an in-process run records the scorer version it pinned on every score', async () => {
    const { storage, api } = await setup();
    const versionId = await createJudge(api, 'helpfulness');
    const dataset = await seedDataset(api);

    const summary = await dataset.startExperiment({
      targetType: 'workflow',
      targetId: 'upper',
      scorers: ['helpfulness'],
    });

    expect((await dataset.getExperiment({ experimentId: summary.experimentId }))?.scorerVersions).toEqual({
      helpfulness: versionId,
    });
    expect(await scoresFor(storage, summary.experimentId)).toEqual([
      { scorerId: 'helpfulness', score: 0.6, versionId },
      { scorerId: 'helpfulness', score: 0.6, versionId },
    ]);
  });

  it('scores with a code scorer whose id matches a built-in object property alongside a pinned scorer', async () => {
    const { storage, api } = await setup();
    const versionId = await createJudge(api, 'helpfulness');
    api.addScorer(
      createScorer({ id: 'toString', description: 'Code scorer' }).generateScore(() => 1),
      'to-string',
    );
    const dataset = await seedDataset(api);

    const summary = await dataset.startExperiment({
      targetType: 'workflow',
      targetId: 'upper',
      scorers: ['helpfulness', 'toString'],
    });

    expect(summary).toMatchObject({ status: 'completed', succeededCount: 2, failedCount: 0 });
    expect((await dataset.getExperiment({ experimentId: summary.experimentId }))?.scorerVersions).toEqual({
      helpfulness: versionId,
    });
    const scores = await scoresFor(storage, summary.experimentId);
    expect(scores.sort((a, b) => a.scorerId.localeCompare(b.scorerId))).toEqual([
      { scorerId: 'helpfulness', score: 0.6, versionId },
      { scorerId: 'helpfulness', score: 0.6, versionId },
      { scorerId: 'toString', score: 1, versionId: undefined },
      { scorerId: 'toString', score: 1, versionId: undefined },
    ]);
  });

  it('pins and scores with the version of a stored workflow step scorer', async () => {
    const { storage, api } = await setup();
    const versionId = await createJudge(api, 'helpfulness');
    const dataset = await seedDataset(api);

    const summary = await dataset.startExperiment({
      targetType: 'workflow',
      targetId: 'upper',
      scorers: { steps: { upper: ['helpfulness'] } },
    });

    expect((await dataset.getExperiment({ experimentId: summary.experimentId }))?.scorerVersions).toEqual({
      helpfulness: versionId,
    });
    expect(await scoresFor(storage, summary.experimentId)).toEqual([
      { scorerId: 'helpfulness', score: 0.6, versionId },
      { scorerId: 'helpfulness', score: 0.6, versionId },
    ]);
  });

  it('scores an experiment created without pinned versions with the current version', async () => {
    const { storage, api, worker } = await setup();
    await createJudge(api, 'helpfulness');
    const dataset = await seedDataset(api);
    // An experiment recorded before scorer versions were pinned.
    const experiment = await (await storage.getStore('experiments'))!.createExperiment({
      datasetId: dataset.id,
      datasetVersion: (await dataset.getDetails()).version,
      targetType: 'workflow',
      targetId: 'upper',
      scorerIds: ['helpfulness'],
      totalItems: 2,
    });
    await publishInstructions(api, 'helpfulness', STRICT);

    await runDurably(worker, dataset.id, experiment.id);

    expect((await waitForExperiment(storage, experiment.id))?.status).toBe('completed');
    expect(await scoresFor(storage, experiment.id)).toEqual([
      { scorerId: 'helpfulness', score: 0.2, versionId: undefined },
      { scorerId: 'helpfulness', score: 0.2, versionId: undefined },
    ]);
  });
});
