/**
 * A durable experiment scored by a stored (editor-created) llm-judge scorer,
 * with the experiment started from one Mastra instance and its steps run by a
 * separate worker instance that never loaded the scorer.
 */
import { randomUUID } from 'node:crypto';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { LanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Mastra } from '@mastra/core';
import { EventEmitterPubSub } from '@mastra/core/events';
import { MastraModelGateway } from '@mastra/core/llm';
import type { ProviderConfig } from '@mastra/core/llm';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { LibSQLStore } from '@mastra/libsql';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MastraEditor } from './index';

const JUDGE_MODEL = `judge-${randomUUID()}`;

const JUDGE_REPLY = JSON.stringify({ score: 0.6 });
const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

/** Every judge call returns the same score; the reason step gets the same text back. */
const judgeModel = new MockLanguageModelV2({
  doStream: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    stream: convertArrayToReadableStream([
      { type: 'text-start' as const, id: 'text-1' },
      { type: 'text-delta' as const, id: 'text-1', delta: JUDGE_REPLY },
      { type: 'text-end' as const, id: 'text-1' },
      { type: 'finish' as const, finishReason: 'stop' as const, usage },
    ]),
  }),
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

describe('stored scorers in durable experiments', () => {
  const mastras: Mastra[] = [];

  afterEach(async () => {
    await Promise.all(mastras.map(mastra => mastra.stopWorkers()));
    for (const mastra of mastras.splice(0)) mastra.__unregisterHooks();
  });

  /** Each instance has its own scorer registry and editor; they share the database and the event bus. */
  function instance(storage: LibSQLStore, pubsub: EventEmitterPubSub) {
    const mastra = new Mastra({
      storage,
      editor: new MastraEditor(),
      workflows: { upper: upperTarget() },
      gateways: { 'models.dev': new JudgeGateway() },
      pubsub,
      logger: false,
    });
    mastras.push(mastra);
    return { mastra, storage };
  }

  it('a worker that never loaded the stored scorer still scores every item', async () => {
    const storage = new LibSQLStore({ id: `experiments-${randomUUID()}`, url: ':memory:' });
    await storage.init();
    const pubsub = new EventEmitterPubSub();
    const api = instance(storage, pubsub);
    const worker = instance(storage, pubsub);
    await worker.mastra.startWorkers();

    await api.mastra.getEditor()!.scorer.create({
      id: 'helpfulness',
      name: 'Helpfulness',
      type: 'llm-judge',
      model: { provider: 'mock', name: JUDGE_MODEL },
      instructions: 'Rate how helpful the response is from 0 to 1.',
    });
    expect(worker.mastra.listScorers()['helpfulness']).toBeUndefined();

    const dataset = await api.mastra.datasets.create({ name: 'stored-scorer-durable' });
    await dataset.addItems({ items: [{ input: { text: 'a' } }, { input: { text: 'b' } }] });
    const { experimentId } = await dataset.startExperimentAsync({
      targetType: 'workflow',
      targetId: 'upper',
      scorers: ['helpfulness'],
      durable: true,
    });

    const experiments = (await worker.storage.getStore('experiments'))!;
    const deadline = Date.now() + 15_000;
    let experiment = await experiments.getExperimentById({ id: experimentId });
    while (experiment?.status !== 'completed' && experiment?.status !== 'failed' && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
      experiment = await experiments.getExperimentById({ id: experimentId });
    }

    expect(experiment).toMatchObject({ status: 'completed', succeededCount: 2 });
    const { scores } = await (await worker.storage.getStore('scores'))!.listScoresByRunId({
      runId: experimentId,
      pagination: { page: 0, perPage: 10 },
    });
    expect(scores.map(score => [score.scorerId, score.score])).toEqual([
      ['helpfulness', 0.6],
      ['helpfulness', 0.6],
    ]);
    expect(worker.mastra.getScorerById('helpfulness').source).toBe('stored');
  });
});
