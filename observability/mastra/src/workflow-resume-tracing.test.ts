import { Mastra } from '@mastra/core/mastra';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import { MockStore } from '@mastra/core/storage';
import { createStep, createWorkflow, createEventedWorkflow } from '@mastra/core/workflows';
import type { WorkflowOptions } from '@mastra/core/workflows';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { Observability } from './default';
import { TestExporter } from './exporters';
import {
  expectWorkflowSegments,
  createResumeOutcomeStep,
  resumeActions,
  expectedResumeOutcomes,
  createResumeSeed,
  controlFlowResumeKinds,
  expectControlFlowSegments,
} from './test-utils/workflow-outcomes';

/**
 * Regression tests for the spanId a suspended run persists for resume linkage.
 *
 * On resume that spanId becomes the resumed span's `parentSpanId`
 * (`observability/utils.ts`: `parentSpanId: resumedFromSpanId`). If the
 * suspended WORKFLOW_RUN span was dropped before export, it was never written
 * to storage, so the resumed span's exported children inherit a parentSpanId
 * that points at nothing and land as orphans.
 *
 * Note the trap: when WORKFLOW_RUN is dropped, the *resumed* WORKFLOW_RUN is
 * dropped too (it is built with the same tracingPolicy), so asserting on the
 * resumed span itself finds nothing wrong. The damage only shows up one level
 * down, on its exported descendants.
 */

const empty = z.object({});

const makeWorkflow = (engine: 'default' | 'evented' = 'default', options?: WorkflowOptions) => {
  const approvalStep = createStep({
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

  return (engine === 'evented' ? createEventedWorkflow : createWorkflow)({
    id: 'resume-tracing-workflow',
    inputSchema: empty,
    outputSchema: z.object({ approved: z.boolean() }),
    steps: [approvalStep],
    options,
  })
    .then(approvalStep)
    .commit();
};

function buildMastra(exporter: TestExporter, excludeSpanTypes?: SpanType[]) {
  const storage = new MockStore();
  const workflow = makeWorkflow();

  new Mastra({
    logger: false,
    storage,
    workflows: { 'resume-tracing-workflow': workflow },
    observability: new Observability({
      configs: {
        default: { serviceName: 'workflow-resume-tracing', exporters: [exporter], excludeSpanTypes },
      },
    }),
  });

  return { storage, workflow };
}

const readTracingContext = async (storage: MockStore, runId: string) => {
  const store = await storage.getStore('workflows');
  const snapshot = await store?.loadWorkflowSnapshot({
    workflowName: 'resume-tracing-workflow',
    runId,
  });
  return snapshot?.tracingContext as { traceId?: string; spanId?: string } | undefined;
};

describe('workflow resume span linkage', () => {
  let exporter: TestExporter;

  beforeEach(() => {
    exporter = new TestExporter();
  });

  const endedSpans = () =>
    exporter.getByEventType(TracingEventType.SPAN_ENDED).map(event => event.exportedSpan as AnyExportedSpan);

  /** Every exported span's parentSpanId must name another exported span. */
  const expectNoOrphans = () => {
    const ids = new Set(endedSpans().map(span => span.id));
    const orphans = endedSpans()
      .filter(span => span.parentSpanId && !ids.has(span.parentSpanId))
      .map(span => `${span.type} ${span.name} -> ${span.parentSpanId}`);
    expect(orphans, 'exported spans whose parentSpanId was never exported').toEqual([]);
  };

  it.each(['default', 'evented'] as const)(
    '%s saves an explicit resume target without reparenting live execution',
    async engine => {
      const resumeTracingContext = {
        traceId: '11111111111111111111111111111111',
        spanId: '2222222222222222',
      };
      const storage = new MockStore();
      const workflow = makeWorkflow(engine);
      workflow.__setResumeTracingContext(resumeTracingContext);
      const host = new Mastra({
        logger: false,
        storage,
        workflows: { 'resume-tracing-workflow': workflow },
        observability: new Observability({
          configs: { default: { serviceName: 'explicit-resume-target', exporters: [exporter] } },
        }),
      });
      try {
        if (engine === 'evented') await host.startWorkers();
        const run = await workflow.createRun();
        expect((await run.start({ inputData: {} })).status).toBe('suspended');
        expect(await readTracingContext(storage, run.runId)).toEqual(resumeTracingContext);
        // The default engine creates a workflow span; evented execution relies on
        // caller-provided live context. Saving a target must not reparent this span.
        if (engine === 'default') {
          const original = exporter.getSpansByType(SpanType.WORKFLOW_RUN);
          expect(original).toHaveLength(1);
          expect(original[0]!.parentSpanId).toBeUndefined();
          expect(original[0]!.traceId).not.toBe(resumeTracingContext.traceId);
        }
      } finally {
        await host.shutdown();
      }
    },
  );

  it.each(['default', 'evented', 'evented-async'] as const)(
    '%s ends suspension before a distinct resumed execution',
    async engine => {
      const workflow = makeWorkflow(engine === 'default' ? 'default' : 'evented');
      const host = new Mastra({
        logger: false,
        storage: new MockStore(),
        workflows: { [workflow.id]: workflow },
        observability: new Observability({
          configs: { default: { serviceName: 'workflow-outcomes', exporters: [exporter] } },
        }),
      });
      try {
        if (engine !== 'default') await host.startWorkers();
        const run = await workflow.createRun();
        if (engine === 'evented-async' && 'startAsync' in run) {
          await run.startAsync({ inputData: {} });
          await expect.poll(() => endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN).length).toBe(1);
        } else {
          expect((await run.start({ inputData: {} })).status).toBe('suspended');
        }
        const suspended = endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN);
        expect(suspended).toHaveLength(1);
        expect(suspended[0]).toMatchObject({ outcome: 'suspend' });
        const originalId = suspended[0]!.id;

        const resumedRun = await workflow.createRun({ runId: run.runId });
        expect(await resumedRun.resume({ resumeData: { approved: true } })).toMatchObject({
          status: 'success',
          result: { approved: true },
        });
        const executions = endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN);
        expectWorkflowSegments(endedSpans(), originalId);
        expect(executions[1]).toMatchObject({ outcome: 'success', parentSpanId: originalId });
        const started = exporter
          .getByEventType(TracingEventType.SPAN_STARTED)
          .map(event => event.exportedSpan)
          .filter(span => span.type === SpanType.WORKFLOW_RUN);
        expect(started.map(span => span.outcome)).toEqual([null, null]);
        expectNoOrphans();
      } finally {
        await host.shutdown();
      }
    },
  );

  it.each(
    (['default', 'evented', 'evented-async'] as const).flatMap(engine =>
      controlFlowResumeKinds.flatMap(kind => resumeActions.map(action => ({ engine, kind, action }))),
    ),
  )('$engine gives resumed $kind blocks separate $action executions', async ({ engine, kind, action }) => {
    const workflow = (engine === 'default' ? createWorkflow : createEventedWorkflow)({
      id: `resume-${kind}-${action}`,
      inputSchema: empty,
      outputSchema: kind === 'foreach' ? z.array(empty) : empty,
    });
    const step = createResumeOutcomeStep();
    if (kind === 'parallel') workflow.parallel([step]).commit();
    else if (kind === 'conditional') workflow.branch([[async () => true, step]]).commit();
    else if (kind === 'until') workflow.dountil(step, async () => true).commit();
    else if (kind === 'while') workflow.dowhile(step, async () => false).commit();
    else workflow.then(createResumeSeed()).foreach(step, { concurrency: 1 }).commit();
    const host = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { [workflow.id]: workflow },
      observability: new Observability({
        configs: { default: { serviceName: 'workflow-resume', exporters: [exporter] } },
      }),
    });
    try {
      if (engine !== 'default') await host.startWorkers();
      const run = await workflow.createRun();
      if (engine === 'evented-async' && 'startAsync' in run) await run.startAsync({ inputData: {} });
      else expect((await run.start({ inputData: {} })).status).toBe('suspended');
      await expect.poll(() => endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN).length).toBe(1);
      const original = endedSpans();
      for (const nextAction of action === 'suspend' ? (['suspend', 'success'] as const) : [action]) {
        const resumed = await workflow.createRun({ runId: run.runId });
        expect(
          (
            await resumed.resume({
              step: 'decision-suspend',
              resumeData: { action: nextAction },
              ...(kind === 'foreach' ? { forEachIndex: 0 } : {}),
            })
          ).status,
        ).toBe(
          nextAction === 'error'
            ? 'failed'
            : nextAction === 'suspend'
              ? 'suspended'
              : nextAction === 'tripwire'
                ? 'tripwire'
                : 'success',
        );
      }
      expectControlFlowSegments(endedSpans(), kind, true, expectedResumeOutcomes(action));
      for (const span of original) expect(endedSpans().filter(event => event.id === span.id)).toEqual([span]);
      expectNoOrphans();
    } finally {
      await host.shutdown();
    }
  });

  it('omits the persisted resume spanId when the suspended run span is never exported', async () => {
    const { storage, workflow } = buildMastra(exporter, [SpanType.WORKFLOW_RUN]);

    const run = await workflow.createRun();
    const result = await run.start({ inputData: {} });
    expect(result.status).toBe('suspended');

    const tracingContext = await readTracingContext(storage, run.runId);
    // The WORKFLOW_RUN span is dropped by excludeSpanTypes, so there is no
    // exportable span to link the resumed run to. Persisting its raw id would
    // orphan the resumed run's exported children.
    expect(tracingContext?.spanId).toBeUndefined();
  });

  it('leaves no orphaned spans after resuming a run whose run span is never exported', async () => {
    const { workflow } = buildMastra(exporter, [SpanType.WORKFLOW_RUN]);

    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    const resumed = await run.resume({ resumeData: { approved: true } });
    expect(resumed.status).toBe('success');

    // Steps still export, so there are children to be orphaned.
    expect(endedSpans().some(span => span.type === SpanType.WORKFLOW_STEP)).toBe(true);
    expectNoOrphans();
  });

  it('still persists the run span id when the run span is exported', async () => {
    const { storage, workflow } = buildMastra(exporter);

    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    const tracingContext = await readTracingContext(storage, run.runId);
    const runSpan = endedSpans().find(span => span.type === SpanType.WORKFLOW_RUN);
    expect(tracingContext?.spanId).toBeDefined();
    // Exportable run spans keep linking to themselves, as before.
    if (runSpan) {
      expect(tracingContext?.spanId).toBe(runSpan.id);
    }

    expect((await run.resume({ resumeData: { approved: true } })).status).toBe('success');
    expectNoOrphans();
  });
});
