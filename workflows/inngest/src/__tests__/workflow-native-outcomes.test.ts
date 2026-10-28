import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { TripWire } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/di';
import { Mastra } from '@mastra/core/mastra';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { createStep } from '@mastra/core/workflows';
import { Inngest } from 'inngest';
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
  INNGEST_PORT,
  getSharedInngest,
  getSharedMastra,
  setupSharedTestInfrastructure,
  teardownSharedTestInfrastructure,
} from './durable-agent.test.utils';

const exporter = new TestExporter();
const selectedExporter = new TestExporter();
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

let releaseCompletion = () => {};
let completionGate: Promise<void> = Promise.resolve();
let completionFinished = false;
const raceInput = z.object({ mode: z.enum(['success', 'error', 'tripwire', 'bail']) });
const completionRaceWorkflow = createWorkflow({
  id: 'native-cancel-completion-race',
  inputSchema: raceInput,
  outputSchema: z.object({}),
  retryConfig: { attempts: 0, delay: 0 },
})
  .then(
    createStep({
      id: 'completion-gate',
      inputSchema: raceInput,
      outputSchema: z.object({}),
      execute: async ({ inputData, bail }) => {
        await completionGate;
        completionFinished = true;
        if (inputData.mode === 'error') throw new Error('Execution failed');
        if (inputData.mode === 'tripwire') throw new TripWire('Policy rejected', {}, 'policy');
        if (inputData.mode === 'bail') return bail({});
        return {};
      },
    }),
  )
  .commit();

const cancelSuspendedWorkflow = createWorkflow({
  id: 'native-cancel-suspended',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
})
  .then(createOutcomeStep('suspend').step)
  .commit();

let finalizerGate: Promise<void> = Promise.resolve();
let releaseFinalizer = () => {};
let finalizerEntered = false;
let finalizerReturned = false;
const finalizerRaceWorkflow = createWorkflow({
  id: 'native-cancel-finalizer-race',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  options: {
    onFinish: async () => {
      finalizerEntered = true;
      await finalizerGate;
      finalizerReturned = true;
    },
  },
})
  .then(createOutcomeStep('suspend').step)
  .commit();

const cancelFixture = createOutcomeStep('success');
const cancelWorkflow = createWorkflow({
  id: 'native-outcome-active-cancel',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
})
  .then(cancelFixture.step)
  .sleep(60000)
  .commit();

const nestedCancelCases = (['direct', 'deep', 'foreach'] as const).map(kind => {
  const child = createWorkflow({
    id: `native-cancel-${kind}-child`,
    inputSchema: z.object({}),
    outputSchema: z.object({}),
  })
    .then(createOutcomeStep('success').step)
    .sleep(60000)
    .commit();
  const middle = createWorkflow({
    id: `native-cancel-${kind}-middle`,
    inputSchema: z.object({}),
    outputSchema: z.object({}),
  })
    .then(child)
    .commit();
  const parent = createWorkflow({
    id: `native-cancel-${kind}-parent`,
    inputSchema: z.object({}),
    outputSchema: kind === 'foreach' ? z.array(z.object({})) : z.object({}),
  });
  if (kind === 'foreach') parent.then(createForeachSeed()).foreach(child, { concurrency: 3 }).commit();
  else parent.then(kind === 'deep' ? middle : child).commit();
  return { kind, child, parent, count: kind === 'foreach' ? 3 : 1 };
});

const completedNestedChild = createWorkflow({
  id: 'native-cancel-completed-child',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
})
  .then(createOutcomeStep('success').step)
  .commit();
const completedNestedParent = createWorkflow({
  id: 'native-cancel-completed-parent',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
})
  .then(completedNestedChild)
  .sleep(60000)
  .commit();

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
      [cancelWorkflow.id]: cancelWorkflow,
      [completedNestedParent.id]: completedNestedParent,
      ...Object.fromEntries(nestedCancelCases.map(({ parent }) => [parent.id, parent])),
      [cancelSuspendedWorkflow.id]: cancelSuspendedWorkflow,
      [completionRaceWorkflow.id]: completionRaceWorkflow,
      [finalizerRaceWorkflow.id]: finalizerRaceWorkflow,
    },
    observability: new Observability({
      configs: {
        default: { serviceName: 'workflow-outcomes', exporters: [exporter] },
        selected: { serviceName: 'selected-workflow-outcomes', exporters: [selectedExporter] },
      },
      configSelector: ({ requestContext }) =>
        requestContext?.get('checkpoint-route') === 'selected' ? 'selected' : 'default',
    }),
    fastRetries: true,
  });
  // Registry keys can differ from the instance's configured name.
  const observability = getSharedMastra().observability!;
  const selected = observability.getInstance('selected')!;
  observability.unregisterInstance('selected');
  observability.registerInstance('selected-alias', selected);
  observability.setConfigSelector(({ requestContext }) =>
    requestContext?.get('checkpoint-route') === 'selected' ? 'selected-alias' : 'default',
  );
}, 60000);

afterAll(() => teardownSharedTestInfrastructure({ forceClose: true }));

describe('native workflow outcomes across Inngest replay', () => {
  it.each(nestedCancelCases)(
    'cancels waiting children when their $kind parent is canceled',
    async ({ kind, child, parent, count }) => {
      const run = await parent.createRun();
      const store = await getSharedMastra().getStorage()!.getStore('workflows');
      const childIds = Array.from({ length: count }, (_, index) =>
        kind === 'foreach' ? `${run.runId}-foreach-${index}` : run.runId,
      );
      const childSnapshots = () =>
        Promise.all(childIds.map(runId => store!.loadWorkflowSnapshot({ workflowName: child.id, runId })));
      const events = (type: TracingEventType) => exporter.getByEventType(type).map(event => event.exportedSpan);
      await run.startAsync({ inputData: {} });
      try {
        await expect
          .poll(
            async () =>
              (await childSnapshots()).filter(snapshot =>
                Object.values(snapshot?.tracingSpans ?? {}).some(
                  span => span.type === SpanType.WORKFLOW_SLEEP && !span.endTime,
                ),
              ).length,
            { timeout: 10000 },
          )
          .toBe(count);
        const pending = (await childSnapshots()).flatMap(snapshot =>
          Object.values(snapshot!.tracingSpans!).filter(span => !span.endTime),
        );
        expect(pending).toHaveLength(count * 2);
        const traceId = pending[0]!.traceId;
        const completed = events(TracingEventType.SPAN_ENDED).filter(span => span.traceId === traceId);
        expect(completed.filter(span => span.entityId === 'decision-success')).toHaveLength(count);
        expect(completed.every(span => span.outcome === 'success')).toBe(true);
        await run.cancel();
        await expect
          .poll(async () => (await childSnapshots()).map(snapshot => snapshot?.status), { timeout: 5000 })
          .toEqual(childIds.map(() => 'canceled'));
        for (const span of pending) {
          await expect
            .poll(() =>
              events(TracingEventType.SPAN_ENDED).filter(event => event.id === span.id && event.traceId === traceId),
            )
            .toEqual([
              expect.objectContaining({ outcome: 'abort', stopReason: 'caller_cancelled', stopReasonContext: null }),
            ]);
        }
        for (const span of completed) {
          expect(
            events(TracingEventType.SPAN_ENDED).filter(event => event.id === span.id && event.traceId === traceId),
          ).toEqual([span]);
        }
        await expect
          .poll(() => {
            const endedIds = new Set(
              events(TracingEventType.SPAN_ENDED)
                .filter(span => span.traceId === traceId)
                .map(span => span.id),
            );
            return events(TracingEventType.SPAN_STARTED).filter(
              span => span.traceId === traceId && !endedIds.has(span.id),
            );
          })
          .toEqual([]);
      } finally {
        await run.cancel();
        for (const runId of childIds) await (await child.createRun({ runId })).cancel();
      }
    },
  );

  it('preserves a completed child when its still-waiting parent is canceled', async () => {
    const run = await completedNestedParent.createRun();
    const store = await getSharedMastra().getStorage()!.getStore('workflows');
    const readChild = () => store!.loadWorkflowSnapshot({ workflowName: completedNestedChild.id, runId: run.runId });
    await run.startAsync({ inputData: {} });
    try {
      await expect
        .poll(
          async () => {
            const parent = await store!.loadWorkflowSnapshot({
              workflowName: completedNestedParent.id,
              runId: run.runId,
            });
            return Object.values(parent?.tracingSpans ?? {}).some(
              span => span.type === SpanType.WORKFLOW_SLEEP && !span.endTime,
            );
          },
          { timeout: 10000 },
        )
        .toBe(true);
      const before = (await readChild())!;
      expect(before.status).toBe('success');
      const roots = () =>
        exporter
          .getByEventType(TracingEventType.SPAN_ENDED)
          .filter(
            event =>
              event.exportedSpan.entityId === completedNestedParent.id &&
              event.exportedSpan.metadata?.runId === run.runId,
          );
      await run.cancel();
      await expect.poll(() => roots().map(event => event.exportedSpan.outcome), { timeout: 5000 }).toEqual(['abort']);
      expect(await readChild()).toEqual(before);
    } finally {
      await run.cancel();
    }
  });

  it('does not execute a child whose cancellation arrived before dispatch', async () => {
    const { child } = nestedCancelCases[0]!;
    const run = await child.createRun();
    await run.cancel();
    await getSharedInngest().send({ name: `workflow.${child.id}`, data: { runId: run.runId, inputData: {} } });
    const roots = () =>
      exporter
        .getByEventType(TracingEventType.SPAN_ENDED)
        .map(event => event.exportedSpan)
        .filter(
          span =>
            span.type === SpanType.WORKFLOW_RUN && span.entityId === child.id && span.metadata?.runId === run.runId,
        );
    await expect
      .poll(roots, { timeout: 5000 })
      .toEqual([expect.objectContaining({ outcome: 'abort', stopReason: 'caller_cancelled' })]);
    const traceId = roots()[0]!.traceId;
    expect(
      exporter.getByEventType(TracingEventType.SPAN_STARTED).filter(event => event.exportedSpan.traceId === traceId),
    ).toHaveLength(1);
    const store = await getSharedMastra().getStorage()!.getStore('workflows');
    expect((await store!.loadWorkflowSnapshot({ workflowName: child.id, runId: run.runId }))?.status).toBe('canceled');
  });

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
      const beforeCancel = await store!.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
      await run.cancel();
      const afterCancel = await store!.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
      expect(afterCancel?.status).toBe(beforeCancel?.status);
      expect(
        exporter
          .getByEventType(TracingEventType.SPAN_ENDED)
          .map(event => event.exportedSpan)
          .filter(span => span.type === SpanType.WORKFLOW_RUN && span.entityId === workflow.id),
      ).toEqual([root]);
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

  it.each(['success', 'error', 'tripwire', 'bail'] as const)(
    'preserves %s completion while a cancellation request is in flight',
    async mode => {
      completionGate = new Promise<void>(resolve => {
        releaseCompletion = resolve;
      });
      let releaseCancellation = () => {};
      const cancellationGate = new Promise<void>(resolve => {
        releaseCancellation = resolve;
      });
      let requestArrived = false;
      const proxy = createServer(async (request, response) => {
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const body = Buffer.concat(chunks);
          if (body.toString().includes(`cancel.workflow.${completionRaceWorkflow.id}`)) {
            requestArrived = true;
            await cancellationGate;
          }
          const upstream = await fetch(`http://localhost:${INNGEST_PORT}${request.url}`, {
            method: request.method,
            headers: { 'content-type': 'application/json' },
            body,
          });
          response.writeHead(upstream.status, { 'content-type': 'application/json' });
          response.end(await upstream.text());
        } catch (error) {
          response.writeHead(500);
          response.end(String(error));
        }
      });
      await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
      const callerInngest = new Inngest({
        id: 'cancel-race-caller',
        baseUrl: `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`,
      });
      const callerWorkflow = init(callerInngest)
        .createWorkflow({ id: completionRaceWorkflow.id, inputSchema: raceInput, outputSchema: z.object({}) })
        .then(createOutcomeStep('success', 'caller-placeholder').step)
        .commit();
      const caller = new Mastra({
        logger: false,
        storage: getSharedMastra().getStorage(),
        workflows: { [callerWorkflow.id]: callerWorkflow },
      });
      let cancellation: Promise<void> | undefined;
      try {
        const run = await completionRaceWorkflow.createRun();
        await run.startAsync({ inputData: { mode } });
        const store = await getSharedMastra().getStorage()!.getStore('workflows');
        const readSnapshot = () =>
          store!.loadWorkflowSnapshot({ workflowName: completionRaceWorkflow.id, runId: run.runId });
        await expect.poll(async () => (await readSnapshot())?.context['completion-gate']?.status).toBe('running');
        const callerRun = await callerWorkflow.createRun({ runId: run.runId });
        cancellation = callerRun.cancel();
        await expect.poll(() => requestArrived).toBe(true);
        releaseCompletion();
        const status = mode === 'error' ? 'failed' : mode === 'bail' ? 'success' : mode;
        await expect.poll(async () => (await readSnapshot())?.status).toBe(status);
        const roots = () =>
          exporter
            .getByEventType(TracingEventType.SPAN_ENDED)
            .map(event => event.exportedSpan)
            .filter(span => span.type === SpanType.WORKFLOW_RUN && span.metadata?.runId === run.runId);
        await expect.poll(() => roots().length).toBe(1);
        const completed = await readSnapshot();
        const completedRoots = roots();
        releaseCancellation();
        await cancellation;
        expect(await readSnapshot()).toEqual(completed);
        expect(roots()).toEqual(completedRoots);
      } finally {
        releaseCompletion();
        releaseCancellation();
        await cancellation?.catch(() => {});
        await new Promise<void>(resolve => {
          proxy.close(() => resolve());
          proxy.closeAllConnections();
        });
        // The shared host owns this storage connection.
        await caller.stopWorkers({ drainTimeout: 0 });
      }
    },
  );

  it('does not reopen cancellation when a suspended finalizer returns late', async () => {
    finalizerEntered = false;
    finalizerReturned = false;
    finalizerGate = new Promise<void>(resolve => {
      releaseFinalizer = resolve;
    });
    const run = await finalizerRaceWorkflow.createRun();
    const store = (await getSharedMastra().getStorage()!.getStore('workflows'))!;
    const readSnapshot = () => store.loadWorkflowSnapshot({ workflowName: finalizerRaceWorkflow.id, runId: run.runId });
    const roots = () =>
      exporter
        .getByEventType(TracingEventType.SPAN_ENDED)
        .map(event => event.exportedSpan)
        .filter(span => span.type === SpanType.WORKFLOW_RUN && span.metadata?.runId === run.runId);
    try {
      await run.startAsync({ inputData: {} });
      await expect.poll(() => finalizerEntered).toBe(true);
      expect((await readSnapshot())?.status).toBe('suspended');
      await run.cancel();
      await expect
        .poll(roots)
        .toEqual([
          expect.objectContaining({ outcome: 'abort', stopReason: 'caller_cancelled', stopReasonContext: null }),
        ]);
      const canceledRoots = roots();
      releaseFinalizer();
      await expect.poll(() => finalizerReturned).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 100));
      expect((await readSnapshot())?.status).toBe('canceled');
      expect(roots()).toEqual(canceledRoots);
    } finally {
      releaseFinalizer();
      await run.cancel();
    }
  });

  it.each(['success', 'error', 'tripwire', 'bail'] as const)(
    'retains cancellation when active work later returns %s',
    async mode => {
      completionFinished = false;
      completionGate = new Promise<void>(resolve => {
        releaseCompletion = resolve;
      });
      const run = await completionRaceWorkflow.createRun();
      const store = (await getSharedMastra().getStorage()!.getStore('workflows'))!;
      const readSnapshot = () =>
        store.loadWorkflowSnapshot({ workflowName: completionRaceWorkflow.id, runId: run.runId });
      try {
        await run.startAsync({ inputData: { mode } });
        await expect.poll(async () => (await readSnapshot())?.context['completion-gate']?.status).toBe('running');
        const started = exporter.getByEventType(TracingEventType.SPAN_STARTED).map(event => event.exportedSpan);
        const root = started.find(span => span.type === SpanType.WORKFLOW_RUN && span.metadata?.runId === run.runId)!;
        const pending = started.filter(span => span.traceId === root.traceId);
        expect(pending).toHaveLength(2);
        const ended = () =>
          exporter
            .getByEventType(TracingEventType.SPAN_ENDED)
            .map(event => event.exportedSpan)
            .filter(span => span.traceId === root.traceId);
        await run.cancel();
        await expect.poll(ended).toEqual(
          expect.arrayContaining(
            pending.map(span =>
              expect.objectContaining({
                id: span.id,
                outcome: 'abort',
                stopReason: 'caller_cancelled',
                stopReasonContext: null,
              }),
            ),
          ),
        );
        const cancellation = ended();
        expect(cancellation).toHaveLength(2);
        releaseCompletion();
        await expect.poll(() => completionFinished).toBe(true);
        await new Promise(resolve => setTimeout(resolve, 100));
        expect((await readSnapshot())?.status).toBe('canceled');
        expect(ended()).toEqual(cancellation);
        for (const span of cancellation) {
          expect((await readSnapshot())?.tracingSpans?.[`${span.traceId}:${span.id}`]).toMatchObject({
            outcome: 'abort',
            stopReason: 'caller_cancelled',
          });
        }
      } finally {
        releaseCompletion();
        await run.cancel();
      }
    },
  );

  it.each([
    { state: 'running', workflow: cancelWorkflow, stepId: 'decision-success', stepOutcome: 'success' },
    { state: 'suspended', workflow: cancelSuspendedWorkflow, stepId: 'decision-suspend', stepOutcome: 'suspend' },
  ] as const)(
    'still cancels a $state run while retaining completed step data',
    async ({ state, workflow, stepId, stepOutcome }) => {
      const run = await workflow.createRun();
      await run.startAsync({ inputData: {} });
      const store = await getSharedMastra().getStorage()!.getStore('workflows');
      const readSnapshot = () => store!.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
      await expect
        .poll(async () => (await readSnapshot())?.context[stepId]?.status)
        .toBe(state === 'suspended' ? 'suspended' : 'success');
      const root = exporter
        .getByEventType(TracingEventType.SPAN_STARTED)
        .map(event => event.exportedSpan)
        .find(span => span.type === SpanType.WORKFLOW_RUN && span.metadata?.runId === run.runId)!;
      const stepEvents = () =>
        exporter
          .getByEventType(TracingEventType.SPAN_ENDED)
          .map(event => event.exportedSpan)
          .filter(
            span => span.type === SpanType.WORKFLOW_STEP && span.entityId === stepId && span.traceId === root.traceId,
          );
      await expect.poll(() => stepEvents().length).toBe(1);
      const completedStep = (await readSnapshot())?.context[stepId];
      await run.cancel();
      expect((await readSnapshot())?.status).toBe('canceled');
      expect((await readSnapshot())?.context[stepId]).toEqual(completedStep);
      expect(stepEvents()).toMatchObject([{ outcome: stepOutcome, stopReason: null }]);
    },
  );

  // OBS-724: cancelOn can prevent the worker finalizer from running. Both the
  // initiating caller and a fresh host need durable identities for every active span.
  // Original/fresh callers reproduced missing root and sleep completions on three
  // real-server attempts each before durable checkpoint handoff.
  it.each(
    (['original', 'fresh'] as const).flatMap(callerMode =>
      (['default', 'selected'] as const).map(route => ({ callerMode, route })),
    ),
  )(
    'exports cancellation from the $callerMode caller ($route) while a workflow waits',
    async ({ callerMode, route }) => {
      const run = await cancelWorkflow.createRun();
      await run.startAsync({ inputData: {}, requestContext: new RequestContext([['checkpoint-route', route]]) });
      const capture = route === 'selected' ? selectedExporter : exporter;
      const events = (type: TracingEventType) => capture.getByEventType(type).map(event => event.exportedSpan);
      const roots = () =>
        events(TracingEventType.SPAN_STARTED).filter(
          span =>
            span.type === SpanType.WORKFLOW_RUN &&
            span.entityId === cancelWorkflow.id &&
            span.metadata?.runId === run.runId,
        );
      const store = await getSharedMastra().getStorage()!.getStore('workflows');
      let caller: Mastra | undefined;
      let cancel = () => run.cancel();
      try {
        await expect
          .poll(
            async () =>
              (await store!.loadWorkflowSnapshot({ workflowName: cancelWorkflow.id, runId: run.runId }))?.context[
                'decision-success'
              ]?.status,
          )
          .toBe('success');
        expect(roots()).toHaveLength(1);
        const root = roots()[0]!;
        expect(root.outcome).toBeNull();
        await expect
          .poll(
            () =>
              events(TracingEventType.SPAN_STARTED).filter(
                span => span.traceId === root.traceId && span.type === SpanType.WORKFLOW_SLEEP,
              ).length,
          )
          .toBe(1);
        const completed = events(TracingEventType.SPAN_ENDED).filter(span => span.traceId === root.traceId);
        expect(completed).toEqual([expect.objectContaining({ entityId: 'decision-success', outcome: 'success' })]);
        const completedIds = new Set(completed.map(span => span.id));
        const pending = events(TracingEventType.SPAN_STARTED).filter(
          span => span.traceId === root.traceId && !completedIds.has(span.id),
        );
        expect(pending).toHaveLength(2);
        if (callerMode === 'fresh') {
          const callerWorkflow = init(getSharedInngest())
            .createWorkflow({ id: cancelWorkflow.id, inputSchema: z.object({}), outputSchema: z.object({}) })
            .then(createOutcomeStep('success', 'caller-placeholder').step)
            .commit();
          caller = new Mastra({
            logger: false,
            storage: getSharedMastra().getStorage(),
            workflows: { [callerWorkflow.id]: callerWorkflow },
          });
          const callerRun = await callerWorkflow.createRun({ runId: run.runId });
          cancel = () => callerRun.cancel();
        }
        await cancel();
        expect((await store!.loadWorkflowSnapshot({ workflowName: cancelWorkflow.id, runId: run.runId }))?.status).toBe(
          'canceled',
        );
        for (const span of completed)
          expect(events(TracingEventType.SPAN_ENDED).filter(event => event.id === span.id)).toEqual([span]);
        await expect
          .poll(() => pending.map(span => events(TracingEventType.SPAN_ENDED).filter(event => event.id === span.id)), {
            timeout: 2000,
          })
          .toEqual(
            pending.map(() => [
              expect.objectContaining({ outcome: 'abort', stopReason: 'caller_cancelled', stopReasonContext: null }),
            ]),
          );
        const checkpoints = (await store!.loadWorkflowSnapshot({ workflowName: cancelWorkflow.id, runId: run.runId }))!
          .tracingSpans!;
        for (const span of pending) {
          const saved = checkpoints[`${span.traceId}:${span.id}`]!;
          expect(saved).toMatchObject({
            observabilityInstanceName: route === 'selected' ? 'selected-alias' : 'default',
            outcome: 'abort',
            stopReason: 'caller_cancelled',
          });
          expect(new Date(saved.endTime!)).toEqual(
            events(TracingEventType.SPAN_ENDED).find(event => event.id === span.id)!.endTime,
          );
        }
        const other = route === 'selected' ? exporter : selectedExporter;
        expect(
          other
            .getByEventType(TracingEventType.SPAN_ENDED)
            .filter(event => event.exportedSpan.traceId === root.traceId),
        ).toEqual([]);
      } finally {
        await cancel();
        // The shared host owns the database connection.
        await caller?.stopWorkers({ drainTimeout: 0 });
      }
    },
  );
  it('preserves the suspended segment when another execution resumes it', async () => {
    const { workflow } = cases.find(({ mode }) => mode === 'suspend')!;
    const roots = () =>
      exporter
        .getByEventType(TracingEventType.SPAN_ENDED)
        .map(event => event.exportedSpan)
        .filter(span => span.type === SpanType.WORKFLOW_RUN && span.entityId === workflow.id);
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');
    await expect.poll(() => roots().length).toBe(1);
    expect(roots()[0]).toMatchObject({ outcome: 'suspend', stopReason: null });
    const originalId = roots()[0]!.id;
    const resumed = await workflow.createRun({ runId: run.runId });
    expect((await resumed.resume({ step: 'decision-suspend', resumeData: {} })).status).toBe('success');
    await expect.poll(() => roots().length).toBe(2);
    const traceIds = new Set(roots().map(span => span.traceId));
    const spans = exporter
      .getByEventType(TracingEventType.SPAN_ENDED)
      .map(event => event.exportedSpan)
      .filter(span => traceIds.has(span.traceId));
    expectWorkflowSegments(spans, originalId);
    const started = exporter
      .getByEventType(TracingEventType.SPAN_STARTED)
      .map(event => event.exportedSpan)
      .filter(span => span.type === SpanType.WORKFLOW_RUN && span.entityId === workflow.id);
    expect(started.map(span => span.outcome)).toEqual([null, null]);
  });
});
