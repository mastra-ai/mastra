/**
 * An Inngest workflow's resume is a fresh function run. Its root span must continue the suspended
 * run's trace rather than sample again: a sampled run stays recorded and linked, an unsampled run
 * stays unrecorded.
 */
import { SamplingStrategyType, SpanType, TracingEventType } from '@mastra/core/observability';
import { createStep } from '@mastra/core/workflows';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Observability } from '../../../../observability/mastra/src/default';
import { TestExporter } from '../../../../observability/mastra/src/exporters';
import { init } from '../index';
import {
  getSharedInngest,
  getSharedMastra,
  setupSharedTestInfrastructure,
  teardownSharedTestInfrastructure,
} from './durable-agent.test.utils';

const exporter = new TestExporter();
/**
 * The decision for a run's original root. A resumed root that asks again gets the opposite, so a
 * resume that samples on its own shows up as a dropped continuation or an orphan. Inngest step spans
 * start from ids rather than a live parent and ask too; they follow the original decision.
 */
let originalSampled = true;
let resumedRootDecisions = 0;

const { createWorkflow } = init(getSharedInngest());
const approval = createStep({
  id: 'approval',
  inputSchema: z.object({}),
  outputSchema: z.object({ approved: z.boolean() }),
  suspendSchema: z.object({}),
  resumeSchema: z.object({ approved: z.boolean() }),
  execute: async ({ resumeData, suspend }) => {
    if (!resumeData?.approved) {
      await suspend({});
      return { approved: false };
    }
    return { approved: resumeData.approved };
  },
});
const workflow = createWorkflow({
  id: 'resume-sampling',
  inputSchema: z.object({}),
  outputSchema: z.object({ approved: z.boolean() }),
  retryConfig: { attempts: 0, delay: 0 },
})
  .then(approval)
  .commit();

beforeAll(async () => {
  await setupSharedTestInfrastructure({
    workflows: { [workflow.id]: workflow },
    observability: new Observability({
      configs: {
        default: {
          serviceName: 'resume-sampling',
          exporters: [exporter],
          sampling: {
            type: SamplingStrategyType.CUSTOM,
            sampler: options => {
              if (options?.metadata?.resumed !== true) return originalSampled;
              resumedRootDecisions++;
              return !originalSampled;
            },
          },
        },
      },
    }),
    fastRetries: true,
  });
}, 60000);

afterAll(() => teardownSharedTestInfrastructure({ forceClose: true }));

beforeEach(() => {
  resumedRootDecisions = 0;
});

const rootsOf = (runId: string) =>
  exporter
    .getByEventType(TracingEventType.SPAN_ENDED)
    .map(event => event.exportedSpan)
    .filter(span => span.type === SpanType.WORKFLOW_RUN && span.metadata?.runId === runId);

const tracingContextOf = async (runId: string) => {
  const store = await getSharedMastra().getStorage()?.getStore('workflows');
  return (await store?.loadWorkflowSnapshot({ workflowName: workflow.id, runId }))?.tracingContext;
};

describe('resumed Inngest workflow sampling', () => {
  it('keeps a sampled run recorded and linked without sampling again', async () => {
    originalSampled = true;
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');
    await expect.poll(() => rootsOf(run.runId).length).toBe(1);
    const original = rootsOf(run.runId)[0]!;
    expect(await tracingContextOf(run.runId)).toMatchObject({ traceId: original.traceId, sampled: true });

    const resumed = await workflow.createRun({ runId: run.runId });
    expect((await resumed.resume({ step: 'approval', resumeData: { approved: true } })).status).toBe('success');
    await expect.poll(() => rootsOf(run.runId).length).toBe(2);

    expect(resumedRootDecisions, 'resumed root sampling decisions').toBe(0);
    expect(rootsOf(run.runId)[1]).toMatchObject({
      outcome: 'success',
      traceId: original.traceId,
      parentSpanId: original.id,
      resumedFromSpanId: original.id,
    });
  });

  it('keeps an unsampled run unrecorded', async () => {
    originalSampled = false;
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');
    expect(await tracingContextOf(run.runId)).toEqual({ sampled: false });

    const resumed = await workflow.createRun({ runId: run.runId });
    expect((await resumed.resume({ step: 'approval', resumeData: { approved: true } })).status).toBe('success');

    expect(resumedRootDecisions, 'resumed root sampling decisions').toBe(0);
    expect(rootsOf(run.runId)).toEqual([]);
  });
});
