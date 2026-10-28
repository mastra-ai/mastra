import { SpanType, TracingEventType } from '@mastra/core/observability';
import { createStep } from '@mastra/core/workflows';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Observability } from '../../../../observability/mastra/src/default';
import { TestExporter } from '../../../../observability/mastra/src/exporters';
import {
  createOutcomeStep,
  createResumeSeed,
  createResumeOutcomeStep,
  resumeActions,
  expectedResumeOutcomes,
  controlFlowResumeKinds,
  expectControlFlowSegments,
  expectWorkflowOutcome,
  expectNestedWorkflowOutcome,
  expectParallelOutcome,
  expectConditionalOutcome,
  expectLoopOutcome,
  expectLoopConditionFailure,
  expectSleepOutcome,
  expectForeachOutcome,
  createForeachSeed,
  expectWorkflowSegments,
  workflowOutcomeModes,
} from '../../../../observability/mastra/src/test-utils/workflow-outcomes';
import { init } from '../index';
import {
  getSharedInngest,
  getSharedMastra,
  setupSharedTestInfrastructure,
  teardownSharedTestInfrastructure,
} from './durable-agent.test.utils';

const exporter = new TestExporter();
const { createWorkflow } = init(getSharedInngest());
const cases = workflowOutcomeModes.map(mode => {
  const fixture = createOutcomeStep(mode);
  const workflow = createWorkflow({
    id: `native-outcome-${mode}`,
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    retryConfig: { attempts: mode === 'retry' ? 1 : 0, delay: 0 },
  })
    .then(fixture.step)
    .commit();
  return { mode, workflow, attempts: fixture.attempts };
});

const nestedCases = workflowOutcomeModes.map(mode => {
  const inner = createWorkflow({
    id: `native-nested-child-${mode}`,
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    retryConfig: { attempts: mode === 'retry' ? 1 : 0, delay: 0 },
  })
    .then(createOutcomeStep(mode).step)
    .commit();
  const workflow = createWorkflow({
    id: `native-nested-parent-${mode}`,
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    retryConfig: { attempts: 0, delay: 0 },
  })
    .then(inner)
    .commit();
  return { mode, inner, workflow };
});

const parallelCases = (['success', 'error', 'tripwire', 'suspend'] as const).map(mode => ({
  mode,
  workflow: createWorkflow({
    id: `native-parallel-${mode}`,
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    retryConfig: { attempts: 0, delay: 0 },
  })
    .parallel([createOutcomeStep(mode).step, createOutcomeStep('success', 'parallel-peer').step])
    .commit(),
}));

const conditionalCases = (['success', 'error', 'tripwire', 'suspend', 'condition-error'] as const).map(mode => ({
  mode,
  workflow: createWorkflow({
    id: `native-conditional-${mode}`,
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    retryConfig: { attempts: 0, delay: 0 },
  })
    .branch([
      [async () => true, createOutcomeStep(mode === 'condition-error' ? 'success' : mode).step],
      [
        async () => {
          if (mode === 'condition-error') throw new Error('Condition failed');
          return false;
        },
        createOutcomeStep('error', 'unselected').step,
      ],
    ])
    .commit(),
}));

const loopCases = (['until', 'while'] as const).flatMap(kind =>
  (['success', 'error', 'tripwire', 'suspend', 'condition-error'] as const).map(mode => {
    const workflow = createWorkflow({
      id: `native-${kind}-${mode}`,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      retryConfig: { attempts: 0, delay: 0 },
    });
    const step = createOutcomeStep(mode === 'condition-error' ? 'success' : mode).step;
    if (kind === 'until')
      workflow
        .dountil(step, async ({ iterationCount }) => {
          if (mode === 'condition-error') throw new Error('Condition failed');
          return iterationCount >= 2;
        })
        .commit();
    else
      workflow
        .dowhile(step, async ({ iterationCount }) => {
          if (mode === 'condition-error') throw new Error('Condition failed');
          return iterationCount < 2;
        })
        .commit();
    return { mode, kind, workflow };
  }),
);

const foreachCases = (['success', 'error', 'tripwire', 'suspend'] as const).map(mode => ({
  mode,
  kind: 'foreach' as const,
  workflow: createWorkflow({
    id: `native-foreach-${mode}`,
    inputSchema: z.object({}),
    outputSchema: z.array(z.object({})),
    retryConfig: { attempts: 0, delay: 0 },
  })
    .then(createForeachSeed())
    .foreach(createOutcomeStep(mode, undefined, true).step, { concurrency: 1 })
    .commit(),
}));

const sleepCases = (['sleep', 'sleep-until'] as const).flatMap(kind =>
  (['success', 'condition-error'] as const).map(mode => {
    const workflow = createWorkflow({
      id: `native-${kind}-${mode}`,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      retryConfig: { attempts: 0, delay: 0 },
    }).then(createOutcomeStep('success').step);
    if (kind === 'sleep') {
      if (mode === 'condition-error')
        workflow
          .sleep(async () => {
            throw new Error('Condition failed');
          })
          .commit();
      else workflow.sleep(20).commit();
    } else
      workflow
        .sleepUntil(async () => {
          if (mode === 'condition-error') throw new Error('Condition failed');
          return new Date(Date.now() + 20);
        })
        .commit();
    return { mode, kind, workflow };
  }),
);

const resumeCases = controlFlowResumeKinds.flatMap(kind =>
  resumeActions.map(action => {
    const workflow = createWorkflow({
      id: `native-resume-${kind}-${action}`,
      inputSchema: z.object({}),
      outputSchema: kind === 'foreach' ? z.array(z.object({})) : z.object({}),
      retryConfig: { attempts: 0, delay: 0 },
    });
    const step = createResumeOutcomeStep();
    if (kind === 'parallel') workflow.parallel([step]).commit();
    else if (kind === 'conditional') workflow.branch([[async () => true, step]]).commit();
    else if (kind === 'until') workflow.dountil(step, async () => true).commit();
    else if (kind === 'while') workflow.dowhile(step, async () => false).commit();
    else workflow.then(createResumeSeed()).foreach(step, { concurrency: 1 }).commit();
    return { kind, workflow, action };
  }),
);

beforeAll(async () => {
  await setupSharedTestInfrastructure({
    workflows: {
      ...Object.fromEntries(
        [
          ...cases,
          ...nestedCases,
          ...parallelCases,
          ...conditionalCases,
          ...loopCases,
          ...foreachCases,
          ...sleepCases,
          ...resumeCases,
        ].map(({ workflow }) => [workflow.id, workflow]),
      ),
    },
    observability: new Observability({
      configs: { default: { serviceName: 'native-workflows', exporters: [exporter] } },
    }),
    fastRetries: true,
  });
}, 60000);

afterAll(() => teardownSharedTestInfrastructure({ forceClose: true }));

describe('native workflow outcomes across Inngest replay', () => {
  it.each(nestedCases)('preserves nested $mode outcomes', async ({ mode, inner, workflow }) => {
    const run = await workflow.createRun();
    await run.start({ inputData: {} });
    const ended = () => exporter.getByEventType(TracingEventType.SPAN_ENDED).map(event => event.exportedSpan);
    await expect
      .poll(() => ended().some(span => span.type === SpanType.WORKFLOW_RUN && span.entityId === workflow.id))
      .toBe(true);
    const root = ended().find(span => span.type === SpanType.WORKFLOW_RUN && span.entityId === workflow.id)!;
    expectNestedWorkflowOutcome(
      ended().filter(span => span.traceId === root.traceId),
      mode,
      inner.id,
      true,
    );
  });

  it.each(cases.filter(({ mode }) => mode !== 'suspend'))(
    'preserves $mode on exported executions',
    async ({ mode, workflow, attempts }) => {
      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });
      // Known public-status race: snapshot polling can observe the intermediate
      // failed step before tripwire finalization. Native outcome assertions below
      // use finalized storage/export boundaries, not that early polling response.
      if (mode !== 'tripwire') expect(result.status).toBe(mode === 'error' ? 'failed' : 'success');
      const store = await getSharedMastra().getStorage()!.getStore('workflows');
      await expect
        .poll(
          async () =>
            (
              await store!.loadWorkflowSnapshot({
                workflowName: workflow.id,
                runId: run.runId,
              })
            )?.status,
        )
        .toBe(mode === 'error' ? 'failed' : mode === 'tripwire' ? 'tripwire' : 'success');
      await expect
        .poll(() =>
          exporter
            .getByEventType(TracingEventType.SPAN_ENDED)
            .some(
              event => event.exportedSpan.type === SpanType.WORKFLOW_RUN && event.exportedSpan.entityId === workflow.id,
            ),
        )
        .toBe(true);
      const ended = exporter.getByEventType(TracingEventType.SPAN_ENDED).map(event => event.exportedSpan);
      const root = ended.find(span => span.type === SpanType.WORKFLOW_RUN && span.entityId === workflow.id);
      expectWorkflowOutcome(
        ended.filter(span => span.traceId === root?.traceId),
        mode,
      );
      if (mode === 'retry') expect(attempts()).toBe(2);
      const started = exporter
        .getByEventType(TracingEventType.SPAN_STARTED)
        .map(event => event.exportedSpan)
        .filter(span => span.type === SpanType.WORKFLOW_RUN && span.entityId === workflow.id);
      expect(started).toHaveLength(1);
      expect(started[0]).toMatchObject({ outcome: null });
    },
  );
  it.each([
    ...parallelCases.map(test => ({ ...test, kind: 'parallel' as const })),
    ...conditionalCases.map(test => ({ ...test, kind: 'conditional' as const })),
    ...loopCases,
    ...foreachCases,
    ...sleepCases,
  ])('records $mode on the $kind execution', async ({ mode, workflow, kind }) => {
    const run = await workflow.createRun();
    await run.start({ inputData: {} });
    const ended = () => exporter.getByEventType(TracingEventType.SPAN_ENDED).map(e => e.exportedSpan);
    await expect
      .poll(() => ended().some(span => span.type === SpanType.WORKFLOW_RUN && span.entityId === workflow.id))
      .toBe(true);
    const root = ended().find(span => span.type === SpanType.WORKFLOW_RUN && span.entityId === workflow.id)!;
    if (kind === 'sleep' || kind === 'sleep-until')
      expectSleepOutcome(
        ended().filter(span => span.traceId === root.traceId),
        mode,
      );
    else if (kind === 'conditional')
      expectConditionalOutcome(
        ended().filter(span => span.traceId === root.traceId),
        mode,
      );
    else if (mode === 'condition-error')
      expectLoopConditionFailure(ended().filter(span => span.traceId === root.traceId));
    else
      (kind === 'parallel' ? expectParallelOutcome : kind === 'foreach' ? expectForeachOutcome : expectLoopOutcome)(
        ended().filter(span => span.traceId === root.traceId),
        mode,
      );
    expect(
      exporter
        .getByEventType(TracingEventType.SPAN_STARTED)
        .find(
          e =>
            e.exportedSpan.type ===
              (kind === 'sleep' || kind === 'sleep-until'
                ? SpanType.WORKFLOW_SLEEP
                : kind === 'parallel'
                  ? SpanType.WORKFLOW_PARALLEL
                  : kind === 'conditional'
                    ? SpanType.WORKFLOW_CONDITIONAL
                    : SpanType.WORKFLOW_LOOP) && e.exportedSpan.traceId === root.traceId,
        )?.exportedSpan,
    ).toMatchObject({ outcome: null });
  });
  it.each(resumeCases)('preserves separate resumed $kind $action executions', async ({ kind, workflow, action }) => {
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');
    const ended = () => exporter.getByEventType(TracingEventType.SPAN_ENDED).map(event => event.exportedSpan);
    await expect
      .poll(() =>
        ended().some(
          span =>
            span.type === SpanType.WORKFLOW_RUN && span.entityId === workflow.id && span.metadata?.runId === run.runId,
        ),
      )
      .toBe(true);
    const root = ended().find(
      span =>
        span.type === SpanType.WORKFLOW_RUN && span.entityId === workflow.id && span.metadata?.runId === run.runId,
    )!;
    const original = ended().filter(span => span.traceId === root.traceId);
    for (const nextAction of action === 'suspend' ? (['suspend', 'success'] as const) : [action]) {
      const resumed = await workflow.createRun({ runId: run.runId });
      const result = await resumed.resume({
        step: 'decision-suspend',
        resumeData: { action: nextAction },
        ...(kind === 'foreach' ? { forEachIndex: 0 } : {}),
      });
      // Tripwire snapshots can transiently report failed before native finalization.
      if (nextAction !== 'tripwire')
        expect(result.status).toBe(
          nextAction === 'error' ? 'failed' : nextAction === 'suspend' ? 'suspended' : 'success',
        );
    }
    await expect
      .poll(
        () =>
          ended().filter(
            span =>
              span.type === SpanType.WORKFLOW_RUN &&
              span.entityId === workflow.id &&
              span.metadata?.runId === run.runId,
          ).length,
      )
      .toBe(expectedResumeOutcomes(action).length);
    const traceIds = new Set(
      ended()
        .filter(
          span =>
            span.type === SpanType.WORKFLOW_RUN && span.entityId === workflow.id && span.metadata?.runId === run.runId,
        )
        .map(span => span.traceId),
    );
    expectControlFlowSegments(
      ended().filter(span => traceIds.has(span.traceId)),
      kind,
      true,
      expectedResumeOutcomes(action),
    );
    for (const span of original) expect(ended().filter(event => event.id === span.id)).toEqual([span]);
  });
});
