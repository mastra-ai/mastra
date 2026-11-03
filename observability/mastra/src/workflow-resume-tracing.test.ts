import { Mastra } from '@mastra/core/mastra';
import { SamplingStrategyType, SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
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
      if (!resumeData?.approved) {
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

  // startAsync() only dispatches; it creates no WORKFLOW_RUN span because the worker may run in another process.
  it.each(['default', 'evented'] as const)('%s ends suspension before a distinct resumed execution', async engine => {
    const workflow = makeWorkflow(engine);
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
      expect((await run.start({ inputData: {} })).status).toBe('suspended');
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
  });

  it.each(['default', 'evented'] as const)(
    '%s resumes of a run suspended twice both continue its first execution',
    async engine => {
      const workflow = makeWorkflow(engine);
      const host = new Mastra({
        logger: false,
        storage: new MockStore(),
        workflows: { [workflow.id]: workflow },
        observability: new Observability({
          configs: { default: { serviceName: 'workflow-resume-lineage', exporters: [exporter] } },
        }),
      });
      try {
        if (engine === 'evented') await host.startWorkers();
        const run = await workflow.createRun();
        expect((await run.start({ inputData: {} })).status).toBe('suspended');
        const rejected = await workflow.createRun({ runId: run.runId });
        expect((await rejected.resume({ resumeData: { approved: false } })).status).toBe('suspended');
        const approved = await workflow.createRun({ runId: run.runId });
        expect((await approved.resume({ resumeData: { approved: true } })).status).toBe('success');

        const executions = endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN);
        const ids = executions.map(span => span.id);
        expect(executions.map(span => span.parentSpanId ?? null)).toEqual([null, ids[0], ids[1]]);
        expect(executions.map(span => span.resumedFromSpanId ?? null)).toEqual([null, ids[0], ids[0]]);
      } finally {
        await host.shutdown();
      }
    },
  );

  // Evented control-flow spans were split out of this change, so only the default engine emits them.
  it.each(
    (['default'] as Array<'default' | 'evented' | 'evented-async'>).flatMap(engine =>
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

  /** A sampler whose decisions are scripted, so a resume that samples again is visible. */
  function scriptedSampler(decisions: boolean[]) {
    let calls = 0;
    return {
      sampling: {
        type: SamplingStrategyType.CUSTOM,
        sampler: () => {
          calls++;
          return decisions.shift() ?? true;
        },
      },
      calls: () => calls,
    };
  }

  const buildSampledHost = (
    engine: 'default' | 'evented',
    sampling: ReturnType<typeof scriptedSampler>['sampling'],
  ) => {
    const storage = new MockStore();
    const workflow = makeWorkflow(engine);
    const host = new Mastra({
      logger: false,
      storage,
      workflows: { [workflow.id]: workflow },
      observability: new Observability({
        configs: { default: { serviceName: 'workflow-resume-sampling', exporters: [exporter], sampling } },
      }),
    });
    return { storage, workflow, host };
  };

  it.each(['default', 'evented'] as const)(
    '%s resume keeps a sampled run recorded without sampling again',
    async engine => {
      const sampler = scriptedSampler([true, false]);
      const { workflow, host } = buildSampledHost(engine, sampler.sampling);
      try {
        if (engine === 'evented') await host.startWorkers();
        const run = await workflow.createRun();
        expect((await run.start({ inputData: {} })).status).toBe('suspended');
        const original = endedSpans().find(span => span.type === SpanType.WORKFLOW_RUN)!;
        expect(original).toBeDefined();

        const resumed = await workflow.createRun({ runId: run.runId });
        expect((await resumed.resume({ resumeData: { approved: true } })).status).toBe('success');

        // The original run decided the trace's sampling; the resume continues that decision.
        expect(sampler.calls(), 'sampler decisions').toBe(1);
        const roots = endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN);
        expect(roots.map(span => span.outcome)).toEqual(['suspend', 'success']);
        expect(roots[1]).toMatchObject({ traceId: original.traceId, parentSpanId: original.id });
        expectNoOrphans();
      } finally {
        await host.shutdown();
      }
    },
  );

  it.each(['default', 'evented'] as const)('%s resume keeps an unsampled run unrecorded', async engine => {
    const sampler = scriptedSampler([false, true]);
    const { storage, workflow, host } = buildSampledHost(engine, sampler.sampling);
    try {
      if (engine === 'evented') await host.startWorkers();
      const run = await workflow.createRun();
      expect((await run.start({ inputData: {} })).status).toBe('suspended');
      expect(await readTracingContext(storage, run.runId)).toEqual({ sampled: false });

      const resumed = await workflow.createRun({ runId: run.runId });
      expect((await resumed.resume({ resumeData: { approved: true } })).status).toBe('success');

      // A resume that sampled again would record a `(resumed)` root with no original to hang under.
      expect(sampler.calls(), 'sampler decisions').toBe(1);
      expect(endedSpans()).toEqual([]);
    } finally {
      await host.shutdown();
    }
  });

  // Only the default engine's start() takes tracingOptions, so only it can hide a run's input.
  it("default resume keeps the original run's hidden input", async () => {
    const { workflow, host } = buildSampledHost('default', { type: SamplingStrategyType.ALWAYS });
    try {
      const run = await workflow.createRun();
      expect((await run.start({ inputData: {}, tracingOptions: { hideInput: true } })).status).toBe('suspended');

      const resumed = await workflow.createRun({ runId: run.runId });
      expect((await resumed.resume({ resumeData: { approved: true } })).status).toBe('success');

      const roots = endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN);
      expect(roots).toHaveLength(2);
      // The trace hid its inputs when it started; the resumed segment belongs to that trace.
      expect(roots.map(span => span.input)).toEqual([undefined, undefined]);
    } finally {
      await host.shutdown();
    }
  });

  // The resume call's own tracing options win over the saved trace state, field by field.
  it.each([
    ['input', { hideOutput: true }, { hideInput: true }],
    ['output', { hideInput: true }, { hideOutput: true }],
  ] as const)(
    'default resume hides the %s its own call hides and keeps what the original run hid',
    async (field, startOptions, resumeOptions) => {
      const { workflow, host } = buildSampledHost('default', { type: SamplingStrategyType.ALWAYS });
      try {
        const run = await workflow.createRun();
        expect((await run.start({ inputData: {}, tracingOptions: startOptions })).status).toBe('suspended');

        const resumed = await workflow.createRun({ runId: run.runId });
        expect((await resumed.resume({ resumeData: { approved: true }, tracingOptions: resumeOptions })).status).toBe(
          'success',
        );

        const roots = endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN);
        expect(roots).toHaveLength(2);
        expect(roots[1]![field], `resumed ${field} hidden by the resume call`).toBeUndefined();
        const other = field === 'input' ? 'output' : 'input';
        expect(roots[1]![other], `resumed ${other} hidden by the original run`).toBeUndefined();
      } finally {
        await host.shutdown();
      }
    },
  );

  it("default resume keeps the original run's request context keys once and adds its own", async () => {
    const approve = (id: string) =>
      createStep({
        id,
        inputSchema: empty,
        outputSchema: empty,
        resumeSchema: z.object({ approved: z.boolean() }),
        execute: async ({ resumeData, suspend }) => {
          if (!resumeData?.approved) await suspend({});
          return {};
        },
      });
    const workflow = createWorkflow({ id: 'resume-tracing-workflow', inputSchema: empty, outputSchema: empty })
      .then(approve('first'))
      .then(approve('second'))
      .commit();
    const storage = new MockStore();
    const host = new Mastra({
      logger: false,
      storage,
      workflows: { [workflow.id]: workflow },
      observability: new Observability({
        configs: { default: { serviceName: 'workflow-resume-keys', exporters: [exporter] } },
      }),
    });
    try {
      const requestContext = new RequestContext([
        ['userId', 'u1'],
        ['tenant', 'acme'],
      ]);
      const run = await workflow.createRun();
      expect(
        (await run.start({ inputData: {}, requestContext, tracingOptions: { requestContextKeys: ['userId'] } })).status,
      ).toBe('suspended');

      const first = await workflow.createRun({ runId: run.runId });
      expect((await first.resume({ step: 'first', resumeData: { approved: true }, requestContext })).status).toBe(
        'suspended',
      );
      const saved = (await readTracingContext(storage, run.runId)) as { traceState?: { requestContextKeys: string[] } };
      expect(saved.traceState?.requestContextKeys).toEqual(['userId']);

      const second = await workflow.createRun({ runId: run.runId });
      expect(
        (
          await second.resume({
            step: 'second',
            resumeData: { approved: true },
            requestContext,
            tracingOptions: { requestContextKeys: ['tenant'] },
          })
        ).status,
      ).toBe('success');

      const roots = endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN);
      expect(roots.map(span => [span.metadata?.userId, span.metadata?.tenant])).toEqual([
        ['u1', undefined],
        ['u1', undefined],
        [undefined, 'acme'],
      ]);
    } finally {
      await host.shutdown();
    }
  });

  it('default resume hides the input its call hides when only configured keys were saved', async () => {
    const workflow = makeWorkflow();
    const host = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { [workflow.id]: workflow },
      observability: new Observability({
        configs: {
          default: { serviceName: 'workflow-resume-keys', exporters: [exporter], requestContextKeys: ['userId'] },
        },
      }),
    });
    try {
      const run = await workflow.createRun();
      expect((await run.start({ inputData: {} })).status).toBe('suspended');

      const resumed = await workflow.createRun({ runId: run.runId });
      expect(
        (await resumed.resume({ resumeData: { approved: true }, tracingOptions: { hideInput: true } })).status,
      ).toBe('success');

      const roots = endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN);
      expect(roots.map(span => span.input)).toEqual([{}, undefined]);
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
