import type { Experimental_EvaluationModelV4 as EvaluationModelV4 } from '@ai-sdk/provider-v7';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Classifier } from '../../classifier';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createWorkflow } from '../create';
import { createStep } from '../workflow';

const questions = {
  route: {
    type: 'choice',
    instructions: 'Choose a route',
    criteria: { billing: 'Billing', support: 'Support', other: 'Other' },
  },
  quality: {
    type: 'score',
    instructions: 'Score quality',
    criteria: ['Poor', 'Good', 'Excellent'],
  },
  urgent: {
    type: 'boolean',
    instructions: 'Is this urgent?',
    criteria: { true: 'Urgent', false: 'Not urgent' },
  },
} as const;

function createClassifier(doEvaluate?: EvaluationModelV4['doEvaluate']) {
  const model: EvaluationModelV4 = {
    specificationVersion: 'v4',
    provider: 'test',
    modelId: 'test-classifier',
    supportedQuestionTypes: ['choice', 'score', 'boolean'],
    doEvaluate:
      doEvaluate ??
      (async () => ({
        answers: {
          route: {
            type: 'choice' as const,
            choice: 'billing',
            probabilities: { billing: 0.8, support: 0.15, other: 0.05 },
          },
          quality: { type: 'score' as const, score: 1.5, probabilities: { '0': 0.1, '1': 0.3, '2': 0.6 } },
          urgent: { type: 'boolean' as const, probability: 0.9 },
        },
        usage: { inputTokens: 10, outputTokens: 5 },
        warnings: [],
      })),
  };
  return new Classifier({ id: 'ticket-router', model, questions });
}

function bind(workflow: ReturnType<typeof createWorkflow>, classifier = createClassifier()) {
  const mastra = new Mastra({
    workflows: { [workflow.id]: workflow },
    classifiers: { router: classifier },
    storage: new InMemoryStore(),
    logger: false,
  });
  workflow.__registerMastra(mastra);
  return mastra;
}

const ENGINES = [
  { name: 'default', evented: false },
  { name: 'evented', evented: true },
] as const;

describe.each(ENGINES)('classifier workflow ($name engine)', ({ evented }) => {
  afterEach(() => {
    delete process.env.MASTRA_EVENTED_EXECUTION;
    vi.restoreAllMocks();
  });

  it('executes inline and projects JSON-safe routing values', async () => {
    if (evented) process.env.MASTRA_EVENTED_EXECUTION = 'true';
    const classifier = createClassifier();
    const workflow = createWorkflow({
      id: `inline-${evented}`,
      inputSchema: z.object({ message: z.string() }),
      outputSchema: z.any(),
    })
      .classifier(classifier)
      .commit();
    bind(workflow, classifier);

    const result = await (await workflow.createRun()).start({ inputData: { message: 'Refund me' } });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.result.values).toEqual({ route: 'billing', quality: 1.5, urgent: 0.9 });
      expect(result.result.answers.route.probabilities).toEqual({ billing: 0.8, support: 0.15, other: 0.05 });
      expect(result.result.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
    }
  });

  it('resolves a registered classifier and a path-mapped state', async () => {
    if (evented) process.env.MASTRA_EVENTED_EXECUTION = 'true';
    const doEvaluate = vi.fn(createClassifier().model.doEvaluate);
    const classifier = createClassifier(doEvaluate);
    const workflow = createWorkflow({
      id: `registered-${evented}`,
      inputSchema: z.object({ message: z.string() }),
      outputSchema: z.any(),
    })
      .classifier('ticket-router', { state: { path: 'inputData.message' } }, { id: 'classify-ticket' })
      .commit();
    bind(workflow, classifier);

    const result = await (await workflow.createRun()).start({ inputData: { message: 'Account locked' } });

    expect(result.status).toBe('success');
    expect(doEvaluate).toHaveBeenCalledWith(expect.objectContaining({ state: 'Account locked' }));
  });

  it('passes classifier output to a following branch', async () => {
    if (evented) process.env.MASTRA_EVENTED_EXECUTION = 'true';
    const classifier = createClassifier();
    const billingStep = createStep({
      id: 'billing-branch',
      inputSchema: z.any(),
      outputSchema: z.object({ routedTo: z.literal('billing') }),
      execute: async () => ({ routedTo: 'billing' as const }),
    });
    const fallbackStep = createStep({
      id: 'fallback-branch',
      inputSchema: z.any(),
      outputSchema: z.object({ routedTo: z.literal('fallback') }),
      execute: async () => ({ routedTo: 'fallback' as const }),
    });
    const workflow = createWorkflow({
      id: `branch-${evented}`,
      inputSchema: z.object({ message: z.string() }),
      outputSchema: z.any(),
    })
      .classifier(classifier)
      .branch([
        [async ({ inputData }) => inputData.values.route === 'billing', billingStep],
        [async ({ inputData }) => inputData.values.route === 'other', fallbackStep],
      ])
      .commit();
    bind(workflow, classifier);

    const result = await (await workflow.createRun()).start({ inputData: { message: 'Refund me' } });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.result).toEqual({ 'billing-branch': { routedTo: 'billing' } });
    }
  });
});

describe('classifier workflow construction', () => {
  it('supports live state selectors and preserves classifier entries from createStep()', async () => {
    const states: unknown[] = [];
    const classifier = createClassifier(async options => {
      states.push(options.state);
      return {
        answers: {
          route: { type: 'choice', choice: 'support', probabilities: { billing: 0.1, support: 0.8, other: 0.1 } },
          quality: { type: 'score', score: 1, probabilities: { '0': 0.1, '1': 0.8, '2': 0.1 } },
          urgent: { type: 'boolean', probability: 0.2 },
        },
        usage: { inputTokens: 1, outputTokens: 1 },
        warnings: [],
      };
    });
    const step = createStep(classifier, { state: ({ inputData }) => inputData.message });
    const workflow = createWorkflow({
      id: 'selector-step',
      inputSchema: z.object({ message: z.string() }),
      outputSchema: z.any(),
    })
      .then(step)
      .commit();
    bind(workflow, classifier);

    expect(workflow.stepGraph[0]).toMatchObject({ type: 'classifier', classifierId: 'ticket-router' });
    const result = await (await workflow.createRun()).start({ inputData: { message: 'Need help' } });
    expect(result.status).toBe('success');
    expect(states).toEqual(['Need help']);
  });

  it('fails clearly when a registered classifier is missing', async () => {
    const workflow = createWorkflow({ id: 'missing', inputSchema: z.string(), outputSchema: z.any() })
      .classifier('missing-router')
      .commit();
    bind(workflow);

    await expect((await workflow.createRun()).start({ inputData: 'hello' })).rejects.toThrow(
      /Classifier 'missing-router' not found for workflow step 'missing-router'/,
    );
  });

  it('keeps workflow retries separate from classifier model retries and forwards abort signals', async () => {
    const classifier = createClassifier();
    const evaluate = vi.spyOn(classifier, 'evaluate');
    const workflow = createWorkflow({ id: 'options', inputSchema: z.string(), outputSchema: z.any() })
      .classifier(classifier, { maxRetries: 4, retries: 2, providerOptions: { test: { mode: 'fast' } } })
      .commit();
    bind(workflow, classifier);
    const abortController = new AbortController();

    expect((workflow as any).executionGraph.steps[0]).toMatchObject({
      options: { maxRetries: 4, retries: 2 },
    });
    const result = await (await workflow.createRun()).start({ inputData: 'hello', abortSignal: abortController.signal });

    expect(result.status).toBe('success');
    expect(workflow.stepGraph[0]).toMatchObject({ options: { maxRetries: 4, retries: 2 } });
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        maxRetries: 4,
        providerOptions: { test: { mode: 'fast' } },
        abortSignal: expect.any(AbortSignal),
      }),
    );
  });
});
