import { executeTarget } from '@mastra/core/datasets';
import { Mastra } from '@mastra/core/mastra';
import { SamplingStrategyType, SpanType } from '@mastra/core/observability';
import { MockStore } from '@mastra/core/storage';
import { createEventedWorkflow, createStep, createWorkflow } from '@mastra/core/workflows';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { Observability } from './default';
import { TestExporter } from './exporters';

/**
 * Regression test for workflow-target dataset experiments (#29232): every span
 * of the run, including the spans of an auto-resumed suspension, must carry the
 * experimentId so Studio can total cost and tokens per experiment. Runs on both
 * workflow engines because each creates its own workflow-run spans.
 */

type Engine = 'default' | 'evented';

const empty = z.object({});

function buildMastra(engine: Engine, exporter: TestExporter, sampled = true) {
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

  const workflow = (engine === 'evented' ? createEventedWorkflow : createWorkflow)({
    id: 'experiment-tracing-workflow',
    inputSchema: empty,
    outputSchema: z.object({ approved: z.boolean() }),
    steps: [prepare, approval],
  })
    .then(prepare)
    .then(approval)
    .commit();

  const mastra: Mastra = new Mastra({
    logger: false,
    storage: new MockStore(),
    workflows: { 'experiment-tracing-workflow': workflow },
    observability: new Observability({
      configs: {
        default: {
          serviceName: 'experiment-workflow-tracing',
          exporters: [exporter],
          ...(sampled ? {} : { sampling: { type: SamplingStrategyType.NEVER } }),
        },
      },
    }),
  });

  return mastra;
}

async function runItem(
  engine: Engine,
  exporter: TestExporter,
  experimentId?: string,
  { sampled = true, resume = true }: { sampled?: boolean; resume?: boolean } = {},
) {
  const mastra = buildMastra(engine, exporter, sampled);
  try {
    if (engine === 'evented') await mastra.startWorkers();
    return await executeTarget(
      mastra.getWorkflowById('experiment-tracing-workflow'),
      'workflow',
      { input: {}, ...(resume ? { resumeData: { approved: true } } : {}) },
      experimentId ? { experimentId } : undefined,
    );
  } finally {
    await mastra.shutdown();
  }
}

describe.each(['default', 'evented'] as const)('workflow-target experiment tracing (%s engine)', engine => {
  let exporter: TestExporter;

  beforeEach(() => {
    exporter = new TestExporter();
  });

  it('tags every span of the started and resumed run with experimentId', async () => {
    const result = await runItem(engine, exporter, 'exp-wf-1');

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

  // Studio matches each item's usage and trace link through the item result's traceId.
  it('returns the trace id that the started and resumed spans were recorded under', async () => {
    const result = await runItem(engine, exporter, 'exp-wf-1');

    expect(result.error).toBeNull();
    const spans = exporter.getAllSpans();
    expect(spans.length).toBeGreaterThan(0);
    expect(result.traceId).toBeTruthy();
    expect(new Set(spans.map(span => span.traceId))).toEqual(new Set([result.traceId]));
  });

  // A sampled-out run must not hand scorers the no-op span's placeholder id as a target span.
  it.each([
    ['started', false],
    ['resumed', true],
  ] as const)('returns no trace or span id from a sampled-out %s run', async (_label, resume) => {
    const result = await runItem(engine, exporter, 'exp-wf-1', { sampled: false, resume });

    expect(exporter.getAllSpans()).toHaveLength(0);
    expect(result.traceId).toBeNull();
    expect(result.spanId).toBeNull();
  });

  it('leaves experimentId unset when the run is not part of an experiment', async () => {
    const result = await runItem(engine, exporter);

    expect(result.error).toBeNull();
    const spans = exporter.getAllSpans();
    expect(spans.length).toBeGreaterThan(0);
    for (const span of spans) {
      expect(span.metadata?.experimentId).toBeUndefined();
    }
  });
});
