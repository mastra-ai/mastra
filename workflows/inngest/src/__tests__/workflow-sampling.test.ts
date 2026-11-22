/**
 * An Inngest workflow run makes one sampling decision. Its step spans and its resumed root start from
 * ids instead of a live parent, so each has to repeat that decision: a sampled run stays recorded and
 * linked, an unsampled run stays unrecorded.
 */
import { SamplingStrategyType, SpanType, TracingEventType } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
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
 * The decision for a run's original root, which is the first to ask. Every later ask gets the
 * opposite, so a span that samples on its own shows up as dropped or as an orphan.
 */
let originalSampled = true;
let samplingDecisions = 0;

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

const child = createWorkflow({
  id: 'sampling-child',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  retryConfig: { attempts: 0, delay: 0 },
})
  .then(createStep({ id: 'work', inputSchema: z.object({}), outputSchema: z.object({}), execute: async () => ({}) }))
  .commit();
const parent = createWorkflow({
  id: 'sampling-parent',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  retryConfig: { attempts: 0, delay: 0 },
})
  .then(child)
  .commit();

beforeAll(async () => {
  await setupSharedTestInfrastructure({
    workflows: { [workflow.id]: workflow, [parent.id]: parent, [child.id]: child },
    observability: new Observability({
      configs: {
        default: {
          serviceName: 'resume-sampling',
          exporters: [exporter],
          sampling: {
            type: SamplingStrategyType.CUSTOM,
            sampler: () => (++samplingDecisions === 1 ? originalSampled : !originalSampled),
          },
        },
      },
    }),
    fastRetries: true,
  });
}, 60000);

afterAll(() => teardownSharedTestInfrastructure({ forceClose: true }));

beforeEach(() => {
  samplingDecisions = 0;
  exporter.reset();
});

const endedSpans = () => exporter.getByEventType(TracingEventType.SPAN_ENDED).map(event => event.exportedSpan);

const rootsOf = (runId: string) =>
  endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN && span.metadata?.runId === runId);

const tracingContextOf = async (runId: string) => {
  const store = await getSharedMastra().getStorage()?.getStore('workflows');
  return (await store?.loadWorkflowSnapshot({ workflowName: workflow.id, runId }))?.tracingContext;
};

describe('Inngest workflow sampling', () => {
  it('keeps a sampled run and its steps recorded and linked without sampling again', async () => {
    originalSampled = true;
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');
    await expect.poll(() => rootsOf(run.runId).length).toBe(1);
    const original = rootsOf(run.runId)[0]!;
    expect(await tracingContextOf(run.runId)).toMatchObject({ traceId: original.traceId, sampled: true });

    const resumed = await workflow.createRun({ runId: run.runId });
    expect((await resumed.resume({ step: 'approval', resumeData: { approved: true } })).status).toBe('success');
    await expect.poll(() => rootsOf(run.runId).length).toBe(2);

    expect(samplingDecisions, 'sampling decisions').toBe(1);
    expect(rootsOf(run.runId)[1]).toMatchObject({
      outcome: 'success',
      traceId: original.traceId,
      parentSpanId: original.id,
      resumedFromSpanId: original.id,
    });
    const steps = endedSpans().filter(span => span.type === SpanType.WORKFLOW_STEP);
    expect(steps.map(span => span.traceId)).toEqual([original.traceId, original.traceId]);
  });

  it('keeps an unsampled run unrecorded', async () => {
    originalSampled = false;
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');
    expect(await tracingContextOf(run.runId)).toEqual({ sampled: false });

    const resumed = await workflow.createRun({ runId: run.runId });
    expect((await resumed.resume({ step: 'approval', resumeData: { approved: true } })).status).toBe('success');

    expect(samplingDecisions, 'sampling decisions').toBe(1);
    expect(endedSpans()).toEqual([]);
  });

  it('keeps a nested run in the trace of the run that invoked it', async () => {
    originalSampled = true;
    const run = await parent.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('success');
    const runs = () => endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN);
    await expect
      .poll(() =>
        runs()
          .map(span => span.entityId)
          .sort(),
      )
      .toEqual([child.id, parent.id]);

    expect(samplingDecisions, 'sampling decisions').toBe(1);
    expect(new Set(endedSpans().map(span => span.traceId)).size, 'traces').toBe(1);
  });
});

describe('Inngest workflow hidden input and output', () => {
  it('hides input and output on every span of the run, and names the request context keys on each', async () => {
    originalSampled = true;
    const run = await parent.createRun();
    const result = await run.start({
      inputData: {},
      requestContext: new RequestContext([['tenant', 'tenant-a']]),
      tracingOptions: { hideInput: true, hideOutput: true, requestContextKeys: ['tenant'] },
    });
    expect(result.status).toBe('success');
    // The parent run, its step, the nested run and its step.
    await expect.poll(() => endedSpans().length).toBe(4);

    expect(endedSpans().map(span => [span.name, span.input, span.output, span.metadata?.tenant])).toEqual(
      endedSpans().map(span => [span.name, undefined, undefined, 'tenant-a']),
    );
  });
});
