import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { Mastra } from '../../../../mastra';
import { InMemoryStore } from '../../../../storage';
import { createTool } from '../../../../tools';
import { runExperiment } from '../../index';
import { scriptedModel } from './scenario-helpers';

/**
 * BDD scenario: the same dataset (and its tool mocks) is run against several
 * models of ONE registered agent.
 *
 * Given a registered agent `weather-agent` (model A) with a `getWeather` tool
 *   whose real `execute` throws, and a dataset item mocking
 *   getWeather(*) -> { tempF: 52 }
 * When the experiment is run twice under the same `comparisonId`
 *   - variant `model-a`: no override
 *   - variant `model-b`: `model: B`
 * Then both runs succeed, each output comes from the right model, the same
 *      tool mock is served on both runs (the live tool never executes), and
 *      both experiments list under the same `targetId`.
 */
describe('Model override scenario: shared tool mocks across two models', () => {
  it('serves the same mocks to every model variant and keeps the agent id stable', async () => {
    const getWeather = createTool({
      id: 'getWeather',
      description: 'Weather lookup (must never run live in this scenario)',
      inputSchema: z.object({}).passthrough(),
      execute: async () => {
        throw new Error('live getWeather must not run');
      },
    });
    const agent = new Agent({
      id: 'weather-agent',
      name: 'Weather Agent',
      instructions: 'Answer with the weather.',
      model: scriptedModel(
        [{ toolCalls: [{ id: 'c1', toolName: 'getWeather', args: { city: 'Seattle' } }] }, { text: 'A says 52' }],
        'model-a',
      ),
      tools: { getWeather },
    });
    const storage = new InMemoryStore();
    const mastra = new Mastra({ agents: { 'weather-agent': agent }, storage, logger: false });

    const datasetsStore = (await storage.getStore('datasets'))!;
    const dataset = await datasetsStore.createDataset({ name: 'Weather DS' });
    await datasetsStore.addItem({
      datasetId: dataset.id,
      input: 'weather in Seattle?',
      toolMocks: [{ toolName: 'getWeather', args: {}, output: { tempF: 52 }, matchArgs: 'ignore' }],
    });

    const base = {
      targetType: 'agent' as const,
      targetId: 'weather-agent',
      datasetId: dataset.id,
      scorers: [],
      maxConcurrency: 1,
      unmockedToolPolicy: 'deny' as const,
    };

    const runA = await runExperiment(mastra, {
      ...base,
      grouping: { comparisonId: 'cmp', variantId: 'model-a' },
    });
    const runB = await runExperiment(mastra, {
      ...base,
      grouping: { comparisonId: 'cmp', variantId: 'model-b' },
      model: scriptedModel(
        [{ toolCalls: [{ id: 'c1', toolName: 'getWeather', args: { city: 'Seattle, WA' } }] }, { text: 'B says 52' }],
        'model-b',
      ),
    });

    for (const run of [runA, runB]) {
      expect(run.status).toBe('completed');
      expect(run.succeededCount).toBe(1);
      expect(run.results[0]!.error).toBeNull();
      expect(run.results[0]!.toolMockReport?.served).toHaveLength(1);
      expect(run.results[0]!.toolMockReport?.served[0]).toMatchObject({ toolName: 'getWeather' });
      expect(run.results[0]!.toolMockReport?.liveCalls).toEqual([]);
    }
    expect((runA.results[0]!.output as { text: string }).text).toBe('A says 52');
    expect((runB.results[0]!.output as { text: string }).text).toBe('B says 52');

    const experimentsStore = (await storage.getStore('experiments'))!;
    const listed = await experimentsStore.listExperiments({
      datasetId: dataset.id,
      comparisonId: 'cmp',
      pagination: { page: 0, perPage: 10 },
    });
    expect(listed.experiments).toHaveLength(2);
    expect(new Set(listed.experiments.map(e => e.targetId))).toEqual(new Set(['weather-agent']));
    expect(new Set(listed.experiments.map(e => e.variantId))).toEqual(new Set(['model-a', 'model-b']));

    // The registered agent is untouched by the override run.
    expect((await mastra.getAgent('weather-agent').getModel()).modelId).toBe('model-a');
  });
});
