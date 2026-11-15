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
