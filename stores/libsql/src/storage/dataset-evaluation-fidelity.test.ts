import { createScorer } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { LibSQLStore } from './index';

describe.each(['in-memory', 'libsql'] as const)('public dataset null evaluation: %s', adapter => {
  let storage: InMemoryStore | LibSQLStore;

  beforeEach(async () => {
    storage = adapter === 'libsql' ? new LibSQLStore({ id: 'null-evaluation', url: ':memory:' }) : new InMemoryStore();
    await storage.init();
  });

  afterEach(async () => {
    await storage.close();
  });

  it('preserves null versus missing ground truth through public task execution and real scoring', async () => {
    const mastra = new Mastra({ storage });
    const dataset = await mastra.datasets.create({
      name: 'nullable lookup',
      inputSchema: { type: ['string', 'null'] },
      groundTruthSchema: { type: ['string', 'null'] },
    });
    await dataset.addItem({ input: 'missing' });
    await dataset.addItems({ items: [{ input: 'explicit', groundTruth: null }] });
    const taskInputs: { input: unknown; groundTruth: unknown }[] = [];
    const scorerInputs: { input: unknown; groundTruth: unknown; output: unknown }[] = [];
    const scorer = createScorer({
      id: 'exact-null',
      name: 'Exact result match',
      description: 'Compare actual output with the authored ground truth.',
    }).generateScore(({ run }) => {
      scorerInputs.push({ input: run.input, groundTruth: run.groundTruth, output: run.output });
      return Number(run.output === run.groundTruth);
    });
    const summary = await dataset.startExperiment({
      task: ({ input, groundTruth }) => {
        taskInputs.push({ input, groundTruth });
        return null;
      },
      scorers: [scorer],
    });

    expect(summary).toMatchObject({ status: 'completed', succeededCount: 2, failedCount: 0, persistenceFailures: 0 });
    const expected = [
      { input: 'missing', groundTruth: undefined },
      { input: 'explicit', groundTruth: null },
    ];
    expect(taskInputs).toHaveLength(2);
    expect(taskInputs).toEqual(expect.arrayContaining(expected));
    expect(scorerInputs).toHaveLength(2);
    expect(scorerInputs).toEqual(expect.arrayContaining(expected.map(item => ({ ...item, output: null }))));
    for (const result of summary.results) {
      expect(result.output).toBeNull();
      expect(result.error).toBeNull();
      expect(result.scores).toEqual([
        expect.objectContaining({ score: result.input === 'missing' ? 0 : 1, error: null }),
      ]);
    }
  });

  it('executes a nullable workflow and scores its actual null result', async () => {
    const inputs: unknown[] = [];
    const step = createStep({
      id: 'lookup',
      inputSchema: z.null(),
      outputSchema: z.null(),
      execute: async ({ inputData }) => {
        inputs.push(inputData);
        return null;
      },
    });
    const workflow = createWorkflow({ id: 'nullable-workflow', inputSchema: z.null(), outputSchema: z.null() })
      .then(step)
      .commit();
    const mastra = new Mastra({ storage, workflows: { workflow } });
    const dataset = await mastra.datasets.create({ name: 'nullable workflow', inputSchema: { type: 'null' } });
    await dataset.addItem({ input: null, groundTruth: null });
    const scorer = createScorer({
      id: 'null-workflow-result',
      name: 'Null result',
      description: 'Verify that nullable workflow data reaches the scorer unchanged.',
    }).generateScore(({ run }) => Number(run.input === null && run.output === null && run.groundTruth === null));
    const summary = await dataset.startExperiment({ targetType: 'workflow', targetId: workflow.id, scorers: [scorer] });
    expect(inputs).toEqual([null]);
    expect(summary).toMatchObject({ status: 'completed', succeededCount: 1, failedCount: 0, persistenceFailures: 0 });
    expect(summary.results[0]).toMatchObject({ input: null, output: null, groundTruth: null, error: null });
    expect(summary.results[0]?.scores).toEqual([expect.objectContaining({ score: 1, error: null })]);
  });

  it('rejects null through public writes when the dataset schemas do not allow it', async () => {
    const mastra = new Mastra({ storage });
    const dataset = await mastra.datasets.create({
      name: 'non-nullable',
      inputSchema: { type: 'string' },
      groundTruthSchema: { type: 'string' },
    });
    await expect(dataset.addItem({ input: null })).rejects.toThrow(/Validation failed for input/);
    await expect(dataset.addItems({ items: [{ input: 'valid', groundTruth: null }] })).rejects.toThrow(
      /Validation failed for groundTruth/,
    );
    expect(await dataset.listItems()).toMatchObject({ items: [] });
  });
});
