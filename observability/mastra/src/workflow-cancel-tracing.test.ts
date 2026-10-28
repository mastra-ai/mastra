import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import { MockStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { createWorkflow as createEventedWorkflow } from '@mastra/core/workflows/evented';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { Observability } from './default';
import { TestExporter } from './exporters';
import {
  createControlFlowOutcomeTests,
  createEventedCancelCompletionRaceTests,
  createEventedRemoteTracingTests,
  createEventedNestedDispatchCancellationTests,
  createEventedStaleTerminationTests,
  createConcurrentBranchOutcomeTests,
  createNestedForeachResumeOutcomeTests,
} from './test-utils/workflow-control-flow-suite';

import {
  createOutcomeStep,
  expectWorkflowOutcome,
  expectNestedWorkflowOutcome,
  workflowOutcomeModes,
  createForeachSeed,
  createResumeSeed,
} from './test-utils/workflow-outcomes';

const empty = z.object({});

const quickStep = createStep({
  id: 'quick',
  inputSchema: empty,
  outputSchema: empty,
  execute: async () => ({}),
});

const deafStep = createStep({
  id: 'deaf',
  inputSchema: empty,
  outputSchema: empty,
  execute: () => new Promise<Record<string, never>>(() => {}),
});

const cooperativeStep = createStep({
  id: 'cooperative',
  inputSchema: empty,
  outputSchema: empty,
  execute: ({ abortSignal }) =>
    new Promise<Record<string, never>>(resolve => {
      abortSignal.addEventListener('abort', () => resolve({}), { once: true });
    }),
});

const throwingStep = createStep({
  id: 'throwing',
  inputSchema: empty,
  outputSchema: empty,
  execute: async () => {
    throw new Error('step blew up');
  },
});

function buildMastra(exporter: TestExporter, tailStep: typeof deafStep) {
  const inner = createWorkflow({ id: 'inner', inputSchema: empty, outputSchema: empty })
    .then(quickStep)
    .then(tailStep)
    .commit();
  const outerWorkflow = createWorkflow({ id: 'outer', inputSchema: empty, outputSchema: empty }).then(inner).commit();

  return new Mastra({
    logger: false,
    storage: new MockStore(),
    workflows: { outerWorkflow },
    observability: new Observability({
      configs: {
        default: { serviceName: 'workflow-cancel-tracing', exporters: [exporter] },
      },
    }),
  });
}

const tick = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('workflow run cancellation tracing', () => {
  let exporter: TestExporter;

  beforeEach(() => {
    exporter = new TestExporter();
  });

  const endedSpans = () =>
    exporter.getByEventType(TracingEventType.SPAN_ENDED).map(event => event.exportedSpan as AnyExportedSpan);

  const expectNoDanglingSpans = () => {
    const incomplete = exporter.getIncompleteSpans();
    expect(
      incomplete.map(entry => `${entry.span?.type} ${entry.span?.name}`),
      'spans left open after cancellation',
    ).toEqual([]);
  };

  const expectSingleEndPerSpan = () => {
    const ids = endedSpans().map(span => span.id);
    expect(ids).toHaveLength(new Set(ids).size);
  };

  const expectParentsPresent = () => {
    const ids = new Set(endedSpans().map(span => span.id));
    for (const span of endedSpans()) {
      if (span.parentSpanId) {
        expect(ids.has(span.parentSpanId), `orphan span ${span.name}`).toBe(true);
      }
    }
  };

  it('closes the whole tree when a step ignores abortSignal', async () => {
    const mastra = buildMastra(exporter, deafStep);
    const run = await mastra.getWorkflow('outerWorkflow').createRun();

    run.start({ inputData: {} }).catch(() => {});
    await tick(300);
    await run.cancel();
    await tick(100);

    expectNoDanglingSpans();
    expectSingleEndPerSpan();
    expectParentsPresent();

    const names = endedSpans().map(span => span.name);
    expect(names).toContain("workflow run: 'outer'");
    expect(names).toContain("workflow step: 'inner'");
    expect(names).toContain("workflow run: 'inner'");
    expect(names).toContain("workflow step: 'deaf'");

    const root = endedSpans().find(span => span.isRootSpan);
    expect(root?.type).toBe(SpanType.WORKFLOW_RUN);
    expect(root?.attributes).toMatchObject({ status: 'canceled' });
    expect(root).toMatchObject({ outcome: 'abort', stopReason: 'caller_cancelled' });

    const deaf = endedSpans().find(span => span.name === "workflow step: 'deaf'");
    expect(deaf?.attributes).toMatchObject({ status: 'canceled' });
    expect(deaf).toMatchObject({ outcome: 'abort', stopReason: 'caller_cancelled' });

    const quick = endedSpans().find(span => span.name === "workflow step: 'quick'");
    expect(quick?.attributes).toMatchObject({ status: 'success' });
  });

  it('emits one end per span when the step honours abortSignal', async () => {
    const mastra = buildMastra(exporter, cooperativeStep);
    const run = await mastra.getWorkflow('outerWorkflow').createRun();

    const started = run.start({ inputData: {} });
    await tick(300);
    await run.cancel();
    await started;
    await tick(100);

    expectNoDanglingSpans();
    expectSingleEndPerSpan();
    expectParentsPresent();

    const root = endedSpans().find(span => span.isRootSpan);
    expect(root?.attributes).toMatchObject({ status: 'canceled' });
    expect(root).toMatchObject({ outcome: 'abort', stopReason: 'caller_cancelled' });
  });

  it('leaves an uncanceled failing run untouched', async () => {
    const mastra = buildMastra(exporter, throwingStep);
    const run = await mastra.getWorkflow('outerWorkflow').createRun();

    const result = await run.start({ inputData: {} });
    expect(result.status).toBe('failed');

    expectNoDanglingSpans();
    expectSingleEndPerSpan();

    const root = endedSpans().find(span => span.isRootSpan);
    expect(root?.attributes).toMatchObject({ status: 'failed' });
    expect(root?.errorInfo?.message).toContain('step blew up');
  });

  it('leaves a successful run untouched', async () => {
    const mastra = buildMastra(exporter, quickStep);
    const run = await mastra.getWorkflow('outerWorkflow').createRun();

    const result = await run.start({ inputData: {} });
    expect(result.status).toBe('success');

    expectNoDanglingSpans();
    expectSingleEndPerSpan();

    const root = endedSpans().find(span => span.isRootSpan);
    expect(root?.attributes).toMatchObject({ status: 'success' });
  });

  createControlFlowOutcomeTests({ createStorage: () => new MockStore() });
  createEventedRemoteTracingTests(() => new MockStore());
  createEventedNestedDispatchCancellationTests(() => new MockStore());
  createEventedStaleTerminationTests(() => new MockStore());
  createEventedCancelCompletionRaceTests(() => new MockStore());
  createConcurrentBranchOutcomeTests({ createStorage: () => new MockStore() });

  it.each([
    ['default', false],
    ['default', true],
    ['evented', false],
    ['evented', true],
    ['evented-async', false],
    ['evented-async', true],
  ] as const)('%s reports an authoritative terminal outcome (failure=%s)', async (engine, fail) => {
    const workflow = (engine !== 'default' ? createEventedWorkflow : createWorkflow)({
      id: 'terminal-outcome',
      inputSchema: empty,
      outputSchema: empty,
    })
      .then(createOutcomeStep(fail ? 'error' : 'success').step)
      .commit();
    const host = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { workflow },
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
        expect((await run.start({ inputData: {} })).status).toBe(fail ? 'failed' : 'success');
      }
      const roots = endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN);
      expectWorkflowOutcome(endedSpans(), fail ? 'error' : 'success');
      // A late cancel cannot rewrite an already completed execution.
      await run.cancel();
      expect(endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN)).toEqual(roots);
      expectNoDanglingSpans();
    } finally {
      await host.shutdown();
    }
  });

  it.each([
    ['default', 'retry'],
    ['evented', 'retry'],
    ['default', 'bail'],
    ['evented', 'bail'],
    ['default', 'tripwire'],
    ['evented', 'tripwire'],
    ['evented-async', 'retry'],
    ['evented-async', 'bail'],
    ['evented-async', 'tripwire'],
  ] as const)('%s preserves the meaning of %s termination', async (engine, mode) => {
    const { step, attempts } = createOutcomeStep(mode);
    const workflow = (engine !== 'default' ? createEventedWorkflow : createWorkflow)({
      id: 'decision-outcome',
      inputSchema: empty,
      outputSchema: empty,
      retryConfig: { attempts: 1, delay: 0 },
    })
      .then(step)
      .commit();
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
        const result = await run.start({ inputData: {} });
        expect(result.status).toBe(mode === 'tripwire' ? 'tripwire' : 'success');
      }
      if (mode === 'retry') expect(attempts()).toBe(2);
      expectWorkflowOutcome(endedSpans(), mode);
      expectNoDanglingSpans();
    } finally {
      await host.shutdown();
    }
  });

  it.each(
    (['default', 'evented', 'evented-async'] as const).flatMap(engine =>
      workflowOutcomeModes.map(mode => ({ engine, mode })),
    ),
  )('$engine preserves nested $mode outcomes', async ({ engine, mode }) => {
    const build = engine === 'default' ? createWorkflow : createEventedWorkflow;
    const inner = build({
      id: `nested-child-${mode}`,
      inputSchema: empty,
      outputSchema: empty,
      retryConfig: { attempts: mode === 'retry' ? 1 : 0, delay: 0 },
    })
      .then(createOutcomeStep(mode).step)
      .commit();
    const workflow = build({ id: `nested-parent-${mode}`, inputSchema: empty, outputSchema: empty })
      .then(inner)
      .commit();
    const host = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { [workflow.id]: workflow },
      observability: new Observability({
        configs: { default: { serviceName: 'nested-outcomes', exporters: [exporter] } },
      }),
    });
    try {
      if (engine !== 'default') await host.startWorkers();
      const run = await workflow.createRun();
      if (engine === 'evented-async' && 'startAsync' in run) await run.startAsync({ inputData: {} });
      else await run.start({ inputData: {} });
      await expect.poll(() => endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN).length).toBe(2);
      expectNestedWorkflowOutcome(endedSpans(), mode, inner.id);
      const nestedStarts = exporter
        .getByEventType(TracingEventType.SPAN_STARTED)
        .map(event => event.exportedSpan)
        .filter(span => span.entityId === inner.id);
      expect(nestedStarts).toHaveLength(2);
      for (const span of nestedStarts) expect(span).toMatchObject({ outcome: null });
      expectNoDanglingSpans();
      if (mode === 'suspend') {
        const original = endedSpans();
        const ids = new Set(original.map(span => span.id));
        const resumed = await workflow.createRun({ runId: run.runId });
        await resumed.resume({
          step: [inner.id, 'decision-suspend'],
          resumeData: {},
        });
        await expect.poll(() => endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN).length).toBe(4);
        const continuation = endedSpans().filter(span => !ids.has(span.id));
        expect(continuation.filter(span => span.type === SpanType.WORKFLOW_RUN)).toHaveLength(2);
        for (const span of continuation) expect(span).toMatchObject({ outcome: 'success', stopReason: null });
        for (const span of original) expect(endedSpans().filter(event => event.id === span.id)).toEqual([span]);
        expectNoDanglingSpans();
        expectSingleEndPerSpan();
      }
    } finally {
      await host.shutdown();
    }
  });

  it.each(
    (['default', 'evented', 'evented-async'] as const).flatMap(engine =>
      (['until', 'while', 'foreach', 'parallel', 'conditional'] as const).flatMap(kind =>
        (kind === 'foreach' ? (['explicit', 'auto'] as const) : (['explicit'] as const)).map(resumeMode => ({
          engine,
          kind,
          resumeMode,
        })),
      ),
    ),
  )(
    '$engine resumes a nested workflow inside $kind ($resumeMode) with separate loop outcomes',
    async ({ engine, kind, resumeMode }) => {
      const blockType =
        kind === 'parallel'
          ? SpanType.WORKFLOW_PARALLEL
          : kind === 'conditional'
            ? SpanType.WORKFLOW_CONDITIONAL
            : SpanType.WORKFLOW_LOOP;
      const build = engine === 'default' ? createWorkflow : createEventedWorkflow;
      const inner = build({ id: 'nested-loop-child', inputSchema: empty, outputSchema: empty })
        .then(createOutcomeStep('suspend').step)
        .commit();
      const workflow = build({
        id: 'nested-loop-parent',
        inputSchema: empty,
        outputSchema: kind === 'foreach' ? z.array(empty) : empty,
      });
      if (kind === 'parallel') workflow.parallel([inner]).commit();
      else if (kind === 'conditional') workflow.branch([[async () => true, inner]]).commit();
      else if (kind === 'foreach') workflow.then(createResumeSeed()).foreach(inner, { concurrency: 1 }).commit();
      else if (kind === 'until') workflow.dountil(inner, async () => true).commit();
      else workflow.dowhile(inner, async () => false).commit();
      const host = new Mastra({
        logger: false,
        storage: new MockStore(),
        workflows: { [workflow.id]: workflow },
        observability: new Observability({
          configs: { default: { serviceName: 'nested-loop', exporters: [exporter] } },
        }),
      });
      try {
        if (engine !== 'default') await host.startWorkers();
        const run = await workflow.createRun();
        if (engine === 'evented-async' && 'startAsync' in run) await run.startAsync({ inputData: {} });
        else await run.start({ inputData: {} });
        await expect.poll(() => endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN).length).toBe(2);
        const original = endedSpans();
        expect(original.filter(span => span.type === blockType)).toMatchObject([{ outcome: 'suspend' }]);
        const resumed = await workflow.createRun({ runId: run.runId });
        const resumedResult = await resumed.resume({
          step: resumeMode === 'auto' ? inner.id : [inner.id, 'decision-suspend'],
          resumeData: {},
          ...(kind === 'foreach' ? { forEachIndex: 0 } : {}),
        });
        expect(resumedResult.status, JSON.stringify('error' in resumedResult ? resumedResult.error : '')).toBe(
          'success',
        );
        await expect.poll(() => endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN).length).toBe(4);
        const blocks = endedSpans().filter(span => span.type === blockType);
        expect(blocks.map(span => span.outcome)).toEqual(['suspend', 'success']);
        for (const block of blocks) {
          const wrapper = endedSpans().find(
            span =>
              span.type === SpanType.WORKFLOW_STEP && span.entityId === inner.id && span.parentSpanId === block.id,
          );
          expect(wrapper).toMatchObject({ outcome: block.outcome });
          expect(
            endedSpans().find(span => span.type === SpanType.WORKFLOW_RUN && span.parentSpanId === wrapper!.id),
          ).toMatchObject({ outcome: block.outcome });
        }
        for (const span of original) expect(endedSpans().filter(event => event.id === span.id)).toEqual([span]);
        expectSingleEndPerSpan();
        expectNoDanglingSpans();
        expectParentsPresent();
      } finally {
        await host.shutdown();
      }
    },
  );

  it.each(
    (['default', 'evented', 'evented-async'] as const).flatMap(engine =>
      (['until', 'while', 'foreach', 'parallel', 'conditional', 'conditional-skipped'] as const).map(kind => ({
        engine,
        kind,
      })),
    ),
  )('$engine preserves a completed $kind loop when a later step fails', async ({ engine, kind }) => {
    const workflow = (engine === 'default' ? createWorkflow : createEventedWorkflow)({
      id: 'loop-before-failure',
      inputSchema: empty,
      outputSchema: empty,
      retryConfig: { attempts: 0, delay: 0 },
    });
    const blockType =
      kind === 'parallel'
        ? SpanType.WORKFLOW_PARALLEL
        : kind.startsWith('conditional')
          ? SpanType.WORKFLOW_CONDITIONAL
          : SpanType.WORKFLOW_LOOP;
    const body = createOutcomeStep('success', 'loop-body').step;
    if (kind === 'parallel') workflow.parallel([body]);
    else if (kind === 'conditional' || kind === 'conditional-skipped')
      workflow.branch([[async () => kind === 'conditional', body]]);
    else if (kind === 'foreach') workflow.then(createForeachSeed()).foreach(body, { concurrency: 2 });
    else if (kind === 'until') workflow.dountil(body, async () => true);
    else workflow.dowhile(body, async () => false);
    workflow
      .then(
        createStep({
          id: 'after-loop',
          inputSchema: z.union([empty, z.array(empty)]),
          outputSchema: empty,
          execute: async () => {
            throw new Error('Later step failed');
          },
        }),
      )
      .commit();
    const host = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { [workflow.id]: workflow },
      observability: new Observability({
        configs: { default: { serviceName: 'loop-before-failure', exporters: [exporter] } },
      }),
    });
    try {
      if (engine !== 'default') await host.startWorkers();
      const run = await workflow.createRun();
      if (engine === 'evented-async' && 'startAsync' in run) await run.startAsync({ inputData: {} });
      else await run.start({ inputData: {} });
      await expect.poll(() => endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN).length).toBe(1);
      const root = endedSpans().find(span => span.type === SpanType.WORKFLOW_RUN)!;
      expect(root).toMatchObject({ outcome: 'error', stopReason: 'runtime_error' });
      const blocks = endedSpans().filter(span => span.type === blockType);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({ outcome: 'success', stopReason: null });
      expect(endedSpans().find(span => span.entityId === 'after-loop')).toMatchObject({
        outcome: 'error',
        parentSpanId: root.id,
      });
      if (kind === 'conditional-skipped') expect(endedSpans().some(span => span.entityId === 'loop-body')).toBe(false);
      else
        expect(endedSpans().find(span => span.entityId === 'loop-body')).toMatchObject({
          outcome: 'success',
          parentSpanId: blocks[0]!.id,
        });
      expectSingleEndPerSpan();
      expectNoDanglingSpans();
    } finally {
      await host.shutdown();
    }
  });

  it.each(
    (['default', 'evented', 'evented-async'] as const).flatMap(engine =>
      (['empty', 'complete', 'cancel'] as const).map(action => ({ engine, action })),
    ),
  )('$engine records foreach aggregate $action without changing completed items', async ({ engine, action }) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const calls: number[] = [];
    const finished: number[] = [];
    const values = action === 'empty' ? [] : [0, 1, 2, 3];
    const workflow = (engine === 'default' ? createWorkflow : createEventedWorkflow)({
      id: 'foreach-aggregate',
      inputSchema: empty,
      outputSchema: z.array(z.number()),
    })
      .then(
        createStep({
          id: 'seed-aggregate',
          inputSchema: empty,
          outputSchema: z.array(z.number()),
          execute: async () => values,
        }),
      )
      .foreach(
        createStep({
          id: 'aggregate-item',
          inputSchema: z.number(),
          outputSchema: z.number(),
          execute: async ({ inputData }) => {
            calls.push(inputData);
            if (inputData > 0) await gate;
            finished.push(inputData);
            return inputData;
          },
        }),
        { concurrency: 2 },
      )
      .commit();
    const host = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { [workflow.id]: workflow },
      observability: new Observability({
        configs: { default: { serviceName: 'foreach-aggregate', exporters: [exporter] } },
      }),
    });
    let started: Promise<unknown> | undefined;
    let canceledCalls = 0;
    try {
      if (engine !== 'default') await host.startWorkers();
      const run = await workflow.createRun();
      if (engine === 'evented-async' && 'startAsync' in run) await run.startAsync({ inputData: {} });
      else started = run.start({ inputData: {} });
      if (action !== 'empty') {
        await expect.poll(() => calls.length >= 2).toBe(true);
        await expect.poll(() => endedSpans().filter(span => span.entityId === 'aggregate-item').length).toBe(1);
        expect(endedSpans().filter(span => span.type === SpanType.WORKFLOW_LOOP)).toHaveLength(0);
        const starts = exporter
          .getByEventType(TracingEventType.SPAN_STARTED)
          .filter(event => event.exportedSpan.type === SpanType.WORKFLOW_LOOP);
        expect(starts).toHaveLength(1);
        expect(starts[0]!.exportedSpan).toMatchObject({ outcome: null });
      }
      if (action === 'cancel') {
        await run.cancel();
        canceledCalls = calls.length;
      }
      const beforeRelease = endedSpans();
      release();
      await started;
      await expect.poll(() => endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN).length).toBe(1);
      if (action === 'cancel') {
        await expect.poll(() => finished.length).toBe(canceledCalls);
        await tick(30);
        for (const span of beforeRelease) expect(endedSpans().filter(event => event.id === span.id)).toEqual([span]);
      }
      const blocks = endedSpans().filter(span => span.type === SpanType.WORKFLOW_LOOP);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({
        outcome: action === 'cancel' ? 'abort' : 'success',
        stopReason: action === 'cancel' ? 'caller_cancelled' : null,
      });
      if (action !== 'cancel') expect(blocks[0]!.output).toEqual(values);
      const items = endedSpans().filter(span => span.entityId === 'aggregate-item');
      expect(items).toHaveLength(action === 'empty' ? 0 : action === 'cancel' ? canceledCalls : 4);
      for (const item of items) {
        expect(item.parentSpanId).toBe(blocks[0]!.id);
        expect(item.outcome).toBe(action === 'cancel' && item.output !== 0 ? 'abort' : 'success');
      }
      expect(calls).toHaveLength(action === 'cancel' ? canceledCalls : values.length);
      expectSingleEndPerSpan();
      expectNoDanglingSpans();
    } finally {
      release();
      await host.shutdown({ drainTimeout: 0 });
    }
  });

  createNestedForeachResumeOutcomeTests({ createStorage: () => new MockStore() });

  it.each(['default', 'evented', 'evented-async'] as const)(
    '%s cancels an active nested execution once',
    async engine => {
      const build = engine === 'default' ? createWorkflow : createEventedWorkflow;
      const inner = build({ id: 'cancel-nested-child', inputSchema: empty, outputSchema: empty })
        .then(quickStep)
        .then(deafStep)
        .commit();
      const workflow = build({ id: 'cancel-nested-parent', inputSchema: empty, outputSchema: empty })
        .then(inner)
        .commit();
      const host = new Mastra({
        logger: false,
        storage: new MockStore(),
        workflows: { [workflow.id]: workflow },
        observability: new Observability({
          configs: { default: { serviceName: 'nested-cancel', exporters: [exporter] } },
        }),
      });
      try {
        if (engine !== 'default') await host.startWorkers();
        const run = await workflow.createRun();
        if (engine === 'evented-async' && 'startAsync' in run) await run.startAsync({ inputData: {} });
        else void run.start({ inputData: {} }).catch(() => {});
        await expect
          .poll(() =>
            exporter
              .getByEventType(TracingEventType.SPAN_STARTED)
              .some(event => event.exportedSpan.entityId === 'deaf'),
          )
          .toBe(true);
        const completed = endedSpans().find(span => span.entityId === 'quick')!;
        expect(completed).toMatchObject({ outcome: 'success' });
        await run.cancel();
        await expect.poll(() => exporter.getIncompleteSpans().length).toBe(0);
        expect(endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN)).toHaveLength(2);
        for (const span of endedSpans().filter(span => span.id !== completed.id))
          expect(span).toMatchObject({ outcome: 'abort', stopReason: 'caller_cancelled' });
        expect(endedSpans().filter(span => span.id === completed.id)).toEqual([completed]);
        expectSingleEndPerSpan();
        expectParentsPresent();
      } finally {
        await host.shutdown({ drainTimeout: 0 });
      }
    },
  );

  it.each(
    (['default', 'evented', 'evented-async'] as const).flatMap(engine =>
      (['sleep', 'sleep-until'] as const).map(kind => ({ engine, kind })),
    ),
  )('$engine retains cancellation after the $kind timer expires', async ({ engine, kind }) => {
    const workflow = (engine === 'default' ? createWorkflow : createEventedWorkflow)({
      id: `cancel-timer-${kind}`,
      inputSchema: empty,
      outputSchema: empty,
    }).then(quickStep);
    const duration = 250;
    if (kind === 'sleep') workflow.sleep(async () => duration).commit();
    else workflow.sleepUntil(async () => new Date(Date.now() + duration)).commit();
    const host = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { [workflow.id]: workflow },
      observability: new Observability({ configs: { default: { serviceName: 'wait-cancel', exporters: [exporter] } } }),
    });
    try {
      if (engine !== 'default') await host.startWorkers();
      const run = await workflow.createRun();
      if (engine === 'evented-async' && 'startAsync' in run) await run.startAsync({ inputData: {} });
      else void run.start({ inputData: {} }).catch(() => {});
      await expect
        .poll(() =>
          exporter
            .getByEventType(TracingEventType.SPAN_UPDATED)
            .some(event => event.exportedSpan.type === SpanType.WORKFLOW_SLEEP),
        )
        .toBe(true);
      await run.cancel();
      await expect.poll(() => exporter.getIncompleteSpans().length).toBe(0);
      const completed = endedSpans();
      const wait = completed.filter(span => span.type === SpanType.WORKFLOW_SLEEP);
      expect(wait).toHaveLength(1);
      expect(wait[0]).toMatchObject({ outcome: 'abort', stopReason: 'caller_cancelled' });
      expect(completed.find(span => span.entityId === 'quick')).toMatchObject({ outcome: 'success', stopReason: null });
      await tick(duration + 50);
      expect(endedSpans()).toEqual(completed);
      expectSingleEndPerSpan();
    } finally {
      await host.shutdown({ drainTimeout: 0 });
    }
  });

  it.each(
    (['default', 'evented', 'evented-async'] as const).flatMap(engine =>
      (['branch', 'until', 'while'] as const).map(kind => ({ engine, kind })),
    ),
  )('$engine preserves completed $kind predicates when a pending predicate is canceled', async ({ engine, kind }) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let calls = 0;
    const forbidden = createStep({
      id: 'predicate-body',
      inputSchema: empty,
      outputSchema: empty,
      execute: async () => {
        calls++;
        return {};
      },
    });
    const workflow = (engine === 'default' ? createWorkflow : createEventedWorkflow)({
      id: 'cancel-predicate',
      inputSchema: empty,
      outputSchema: empty,
    }).then(quickStep);
    if (kind === 'branch')
      workflow
        .branch([
          [
            async () => {
              await gate;
              return true;
            },
            forbidden,
          ],
          [async () => false, createOutcomeStep('error', 'unselected').step],
        ])
        .commit();
    else {
      const condition = async ({ iterationCount }: { iterationCount: number }) => {
        if (iterationCount > 1) await gate;
        return kind === 'while';
      };
      if (kind === 'until') workflow.dountil(forbidden, condition).commit();
      else workflow.dowhile(forbidden, condition).commit();
    }
    const host = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { [workflow.id]: workflow },
      observability: new Observability({
        configs: { default: { serviceName: 'predicate-cancel', exporters: [exporter] } },
      }),
    });
    try {
      if (engine !== 'default') await host.startWorkers();
      const run = await workflow.createRun();
      const started =
        engine === 'evented-async' && 'startAsync' in run
          ? run.startAsync({ inputData: {} })
          : run.start({ inputData: {} });
      const evaluations = () => endedSpans().filter(span => span.type === SpanType.WORKFLOW_CONDITIONAL_EVAL);
      await expect.poll(() => evaluations().length).toBe(1);
      const completed = evaluations()[0]!;
      expect(completed).toMatchObject({ outcome: 'success', output: kind === 'while' });
      await expect
        .poll(
          () =>
            exporter
              .getByEventType(TracingEventType.SPAN_STARTED)
              .filter(event => event.exportedSpan.type === SpanType.WORKFLOW_CONDITIONAL_EVAL).length,
        )
        .toBe(2);
      await run.cancel();
      await expect.poll(() => evaluations().length).toBe(2);
      expect(evaluations().find(span => span.id !== completed.id)).toMatchObject({
        outcome: 'abort',
        stopReason: 'caller_cancelled',
      });
      if (kind !== 'branch')
        expect(endedSpans().filter(span => span.type === SpanType.WORKFLOW_LOOP)).toMatchObject([
          { outcome: 'abort', stopReason: 'caller_cancelled' },
        ]);
      const terminal = endedSpans();
      release();
      await started;
      await tick(30);
      for (const span of terminal) expect(endedSpans().filter(event => event.id === span.id)).toEqual([span]);
      // Default execution can record a rejected branch attempt after the
      // predicate unwinds; its body must not run or report success.
      const terminalIds = new Set(terminal.map(span => span.id));
      for (const span of endedSpans().filter(span => !terminalIds.has(span.id)))
        expect(span).toMatchObject({ outcome: 'abort', stopReason: 'caller_cancelled' });
      expect(calls).toBe(kind === 'branch' ? 0 : 2);
      expectNoDanglingSpans();
      expectSingleEndPerSpan();
    } finally {
      release();
      await host.shutdown({ drainTimeout: 0 });
    }
  });

  it('reports an executor yielding the run as interrupted, not a user suspension', async () => {
    let notifyStarted!: () => void;
    const started = new Promise<void>(resolve => {
      notifyStarted = resolve;
    });
    const step = createStep({
      id: 'executor-work',
      inputSchema: empty,
      outputSchema: empty,
      execute: async ({ abortSignal }) => {
        notifyStarted();
        await new Promise<void>(resolve => abortSignal.addEventListener('abort', () => resolve(), { once: true }));
        return {};
      },
    });
    const workflow = createWorkflow({ id: 'executor-interruption', inputSchema: empty, outputSchema: empty })
      .then(step)
      .commit();
    const host = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { [workflow.id]: workflow },
      observability: new Observability({
        configs: { default: { serviceName: 'workflow-outcomes', exporters: [exporter] } },
      }),
    });
    try {
      const run = await workflow.createRun();
      const result = run.start({ inputData: {} });
      await started;
      // This is the runtime's executor-abort path; run.cancel() uses a distinct cancellation signal.
      run.abortController.abort();
      expect((await result).status).toBe('waiting');
      expect(endedSpans().find(span => span.type === SpanType.WORKFLOW_RUN)).toMatchObject({ outcome: 'interrupted' });
      // This cooperative step returned its result before the executor yielded the workflow.
      expect(endedSpans().find(span => span.type === SpanType.WORKFLOW_STEP)).toMatchObject({ outcome: 'success' });
    } finally {
      await host.shutdown();
    }
  });

  it.each(
    (['sleep', 'sleep-until', 'conditional', 'until', 'while'] as const).flatMap(kind =>
      (['cancel', 'executor-stop'] as const).map(stop => ({ kind, stop })),
    ),
  )('$stop during $kind preserves completed work and closes the active wait', async ({ kind, stop }) => {
    const workflow = createWorkflow({ id: `wait-${kind}-${stop}`, inputSchema: empty, outputSchema: empty }).then(
      quickStep,
    );
    const waitForStop = async ({ abortSignal }: { abortSignal: AbortSignal }) => {
      if (!abortSignal.aborted)
        await new Promise<void>(resolve => abortSignal.addEventListener('abort', () => resolve(), { once: true }));
      return false;
    };
    if (kind === 'sleep') workflow.sleep(60_000).commit();
    else if (kind === 'sleep-until') workflow.sleepUntil(new Date(Date.now() + 60_000)).commit();
    else if (kind === 'until') workflow.dountil(createOutcomeStep('success', 'loop-body').step, waitForStop).commit();
    else if (kind === 'while') workflow.dowhile(createOutcomeStep('success', 'loop-body').step, waitForStop).commit();
    else workflow.branch([[waitForStop, createOutcomeStep('error', 'unselected').step]]).commit();
    const isLoop = kind === 'until' || kind === 'while';
    const activeType = kind === 'conditional' || isLoop ? SpanType.WORKFLOW_CONDITIONAL_EVAL : SpanType.WORKFLOW_SLEEP;
    const host = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { [workflow.id]: workflow },
      observability: new Observability({
        configs: { default: { serviceName: 'workflow-outcomes', exporters: [exporter] } },
      }),
    });
    try {
      const run = await workflow.createRun();
      const pending = run.start({ inputData: {} });
      await expect
        .poll(() =>
          exporter.getByEventType(TracingEventType.SPAN_STARTED).some(event => event.exportedSpan.type === activeType),
        )
        .toBe(true);
      if (stop === 'cancel') await run.cancel();
      else run.abortController.abort();
      expect((await pending).status).toBe(stop === 'cancel' ? 'canceled' : 'waiting');
      const termination =
        stop === 'cancel'
          ? { outcome: 'abort', stopReason: 'caller_cancelled' }
          : { outcome: 'interrupted', stopReason: null };
      for (const type of [
        SpanType.WORKFLOW_RUN,
        activeType,
        ...(kind === 'conditional' ? [SpanType.WORKFLOW_CONDITIONAL] : isLoop ? [SpanType.WORKFLOW_LOOP] : []),
      ]) {
        const spans = endedSpans().filter(span => span.type === type);
        expect(spans).toHaveLength(1);
        expect(spans[0]).toMatchObject(termination);
      }
      const completedSteps = endedSpans().filter(span => span.type === SpanType.WORKFLOW_STEP);
      expect(completedSteps).toHaveLength(isLoop ? 2 : 1);
      for (const step of completedSteps) expect(step).toMatchObject({ outcome: 'success', stopReason: null });
      expectNoDanglingSpans();
      expectSingleEndPerSpan();
    } finally {
      await host.shutdown();
    }
  });

  it.each(
    (['parallel', 'foreach', 'until', 'while'] as const).flatMap(kind =>
      (['cancel', 'executor-stop'] as const).map(stop => ({ kind, stop })),
    ),
  )('$stop during $kind body preserves completed siblings and items', async ({ kind, stop }) => {
    let calls = 0;
    let activeStarted = false;
    const body = createStep({
      id: 'active-body',
      inputSchema: empty,
      outputSchema: empty,
      execute: async ({ abortSignal }) => {
        calls++;
        if (kind === 'foreach' && calls === 1) return {};
        activeStarted = true;
        if (!abortSignal.aborted)
          await new Promise<void>(resolve => abortSignal.addEventListener('abort', () => resolve(), { once: true }));
        return {};
      },
    });
    const workflow = createWorkflow({
      id: `body-${kind}-${stop}`,
      inputSchema: empty,
      outputSchema: kind === 'foreach' ? z.array(empty) : empty,
    }).then(quickStep);
    if (kind === 'parallel') workflow.parallel([body, createOutcomeStep('success', 'peer').step]).commit();
    else if (kind === 'foreach') workflow.then(createForeachSeed()).foreach(body, { concurrency: 1 }).commit();
    else if (kind === 'until') workflow.dountil(body, async () => false).commit();
    else workflow.dowhile(body, async () => true).commit();
    const host = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { [workflow.id]: workflow },
      observability: new Observability({
        configs: { default: { serviceName: 'workflow-outcomes', exporters: [exporter] } },
      }),
    });
    try {
      const run = await workflow.createRun();
      const pending = run.start({ inputData: {} });
      await expect.poll(() => activeStarted).toBe(true);
      if (kind === 'parallel') await expect.poll(() => endedSpans().some(span => span.entityId === 'peer')).toBe(true);
      expect(
        exporter
          .getByEventType(TracingEventType.SPAN_STARTED)
          .findLast(event => event.exportedSpan.entityId === 'active-body')?.exportedSpan,
      ).toMatchObject({ outcome: null });
      if (stop === 'cancel') await run.cancel();
      else run.abortController.abort();
      expect((await pending).status).toBe(stop === 'cancel' ? 'canceled' : 'waiting');
      const termination =
        stop === 'cancel'
          ? { outcome: 'abort', stopReason: 'caller_cancelled' }
          : { outcome: 'interrupted', stopReason: null };
      const blockType = kind === 'parallel' ? SpanType.WORKFLOW_PARALLEL : SpanType.WORKFLOW_LOOP;
      for (const type of [SpanType.WORKFLOW_RUN, blockType]) {
        const spans = endedSpans().filter(span => span.type === type);
        expect(spans).toHaveLength(1);
        expect(spans[0]).toMatchObject(termination);
      }
      const steps = endedSpans().filter(span => span.type === SpanType.WORKFLOW_STEP);
      const active = steps.findLast(span => span.entityId === 'active-body');
      expect(active).toMatchObject(stop === 'cancel' ? termination : { outcome: 'success', stopReason: null });
      for (const step of steps.filter(span => span !== active))
        expect(step).toMatchObject({ outcome: 'success', stopReason: null });
      expect(calls).toBe(kind === 'foreach' ? 2 : 1);
      expectNoDanglingSpans();
      expectSingleEndPerSpan();
    } finally {
      await host.shutdown();
    }
  });

  it('cancels a run that never started without emitting spans', async () => {
    const mastra = buildMastra(exporter, deafStep);
    const run = await mastra.getWorkflow('outerWorkflow').createRun();

    await expect(run.cancel()).resolves.toBeUndefined();
    expect(exporter.getAllSpans()).toHaveLength(0);
  });

  it('closes the tree for a run started with startAsync', async () => {
    const mastra = buildMastra(exporter, deafStep);
    const run = await mastra.getWorkflow('outerWorkflow').createRun();

    await run.startAsync({ inputData: {} });
    await tick(300);
    await run.cancel();
    await tick(100);

    expectNoDanglingSpans();
    expectSingleEndPerSpan();
    expectParentsPresent();
  });

  const buildEventedMastra = (id: string) => {
    const eventedWorkflow = createEventedWorkflow({ id, inputSchema: empty, outputSchema: empty })
      .then(quickStep)
      .then(deafStep)
      .commit();

    return new Mastra({
      logger: false,
      storage: new MockStore(),
      pubsub: new EventEmitterPubSub(),
      workflows: { eventedWorkflow },
      observability: new Observability({
        configs: { default: { serviceName: 'workflow-cancel-tracing', exporters: [exporter] } },
      }),
    });
  };

  it('closes the tree on the evented engine', async () => {
    const mastra = buildEventedMastra('evented');
    await mastra.startWorkers();

    try {
      const run = await mastra.getWorkflow('eventedWorkflow').createRun();
      run.start({ inputData: {} }).catch(() => {});
      await tick(500);
      await run.cancel();
      await tick(200);

      expectNoDanglingSpans();
      expectSingleEndPerSpan();
      expectParentsPresent();

      const root = endedSpans().find(span => span.isRootSpan);
      expect(root?.attributes).toMatchObject({ status: 'canceled' });
      expect(root).toMatchObject({ outcome: 'abort', stopReason: 'caller_cancelled' });

      const deaf = endedSpans().find(span => span.name === "workflow step: 'deaf'");
      expect(deaf?.attributes).toMatchObject({ status: 'canceled' });
      expect(deaf).toMatchObject({ outcome: 'abort', stopReason: 'caller_cancelled' });
    } finally {
      // deafStep ignores cancellation, so there is nothing for the worker
      // drain to wait on; skip it instead of burning the default budget.
      await mastra.stopWorkers({ drainTimeout: 0 });
    }
  });

  it('leaves nothing open when an evented startAsync run is canceled', async () => {
    const mastra = buildEventedMastra('eventedAsync');
    await mastra.startWorkers();

    try {
      const run = await mastra.getWorkflow('eventedWorkflow').createRun();
      await run.startAsync({ inputData: {} });
      await tick(500);
      await run.cancel();
      await tick(200);

      expectNoDanglingSpans();
      expectSingleEndPerSpan();
      expectParentsPresent();
      expect(endedSpans().find(span => span.type === SpanType.WORKFLOW_RUN)).toMatchObject({
        outcome: 'abort',
        stopReason: 'caller_cancelled',
      });
    } finally {
      // deafStep ignores cancellation, so there is nothing for the worker
      // drain to wait on; skip it instead of burning the default budget.
      await mastra.stopWorkers({ drainTimeout: 0 });
    }
  });
});
