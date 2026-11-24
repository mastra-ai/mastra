import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Classifier } from '@mastra/core/classifier';
import { executeTarget } from '@mastra/core/datasets';
import { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import { MockStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { Observability } from './default';
import { TestExporter } from './exporters';

/**
 * Regression test for workflow-target dataset experiments: every span of the
 * run, including the spans of an auto-resumed suspension, must carry the
 * experimentId so Studio can total cost, tokens and duration per experiment.
 */

const empty = z.object({});

function buildWorkflow(exporter: TestExporter) {
  const prepare = createStep({
    id: 'prepare',
    inputSchema: empty,
    outputSchema: empty,
    execute: async () => ({}),
  });
  const approval = createStep({
    id: 'approval',
    inputSchema: empty,
    outputSchema: z.object({ approved: z.boolean() }),
    suspendSchema: empty,
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async ({ resumeData, suspend }) => {
      if (!resumeData) {
        await suspend({});
        return { approved: false };
      }
      return { approved: resumeData.approved };
    },
  });

  const workflow = createWorkflow({
    id: 'experiment-tracing-workflow',
    inputSchema: empty,
    outputSchema: z.object({ approved: z.boolean() }),
    steps: [prepare, approval],
  })
    .then(prepare)
    .then(approval)
    .commit();

  new Mastra({
    logger: false,
    storage: new MockStore(),
    workflows: { 'experiment-tracing-workflow': workflow },
    observability: new Observability({
      configs: { default: { serviceName: 'experiment-workflow-tracing', exporters: [exporter] } },
    }),
  });

  return workflow;
}

describe('workflow-target experiment tracing', () => {
  let exporter: TestExporter;

  beforeEach(() => {
    exporter = new TestExporter();
  });

  it('tags every span of the started and resumed run with experimentId', async () => {
    const workflow = buildWorkflow(exporter);

    const result = await executeTarget(
      workflow,
      'workflow',
      { input: {}, resumeData: { approved: true } },
      { experimentId: 'exp-wf-1' },
    );

    expect(result.error).toBeNull();
    expect(result.output).toEqual({ approved: true });

    const spans = exporter.getAllSpans();
    const workflowRuns = spans.filter(span => span.type === SpanType.WORKFLOW_RUN);
    expect(workflowRuns).toHaveLength(2);
    expect(workflowRuns.some(span => span.metadata?.resumed === true)).toBe(true);
    expect(spans.length).toBeGreaterThan(workflowRuns.length);
    for (const span of spans) {
      expect(span.metadata?.experimentId, `${span.type} ${span.name}`).toBe('exp-wf-1');
    }
  });

  it('leaves experimentId unset when the run is not part of an experiment', async () => {
    const workflow = buildWorkflow(exporter);

    const result = await executeTarget(workflow, 'workflow', { input: {}, resumeData: { approved: true } });

    expect(result.error).toBeNull();
    const spans = exporter.getAllSpans();
    expect(spans.length).toBeGreaterThan(0);
    for (const span of spans) {
      expect(span.metadata?.experimentId).toBeUndefined();
    }
  });
});

describe('durable experiment tracing', () => {
  // The experiment runs items as steps of an internal workflow that has no span of its own.
  it('gives each item its own trace for work done before its agent run', async () => {
    const exporter = new TestExporter();
    const classifier = new Classifier({
      id: 'tone',
      model: {
        specificationVersion: 'v4',
        provider: 'test-provider',
        modelId: 'test-model',
        supportedQuestionTypes: ['boolean'],
        doEvaluate: async () => ({
          answers: { formal: { type: 'boolean', probability: 0.9 } },
          usage: { inputTokens: 1, outputTokens: 1 },
          warnings: [],
        }),
      },
      questions: { formal: { type: 'boolean', criteria: { true: 'Formal', false: 'Casual' } } },
    });
    const writer = new Agent({
      id: 'writer',
      name: 'writer',
      instructions: async () => {
        await classifier.decide({ state: 'hello' });
        return 'Answer.';
      },
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          content: [{ type: 'text', text: 'done' }],
          warnings: [],
        }),
      }),
    });
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { writer },
      classifiers: { classifier },
      observability: new Observability({
        configs: { default: { serviceName: 'durable-experiment-tracing', exporters: [exporter] } },
      }),
    });
    try {
      await mastra.startWorkers();
      const dataset = await mastra.datasets.create({ name: 'greetings' });
      for (const input of ['hi', 'hey']) await dataset.addItem({ input });
      const { experimentId } = await dataset.startExperimentAsync({
        targetType: 'agent',
        targetId: 'writer',
        durable: true,
      });
      await expect
        .poll(async () => (await dataset.getExperiment({ experimentId }))?.status, { timeout: 10_000 })
        .toBe('completed');

      const evaluations = exporter.getSpansByType(SpanType.CLASSIFIER_EVALUATION);
      expect(evaluations.map(span => span.isRootSpan)).toEqual([true, true]);
      expect(new Set(evaluations.map(span => span.traceId)).size).toBe(2);
      expect(exporter.getSpansByType(SpanType.WORKFLOW_RUN)).toEqual([]);
    } finally {
      await mastra.shutdown();
    }
  }, 15_000);
});
