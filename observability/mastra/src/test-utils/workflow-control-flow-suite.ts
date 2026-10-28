import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import type { MastraCompositeStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { createWorkflow as createEventedWorkflow } from '@mastra/core/workflows/evented';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Observability } from '../default';
import { TestExporter } from '../exporters';
import {
  createOutcomeStep,
  expectWorkflowOutcome,
  createForeachSeed,
  createResumeSeed,
  expectParallelOutcome,
  expectConditionalOutcome,
  expectForeachOutcome,
  expectLoopOutcome,
  expectLoopConditionFailure,
  expectSleepOutcome,
} from './workflow-outcomes';

/** Identical public runtime scenarios for stores with and without step occurrence guards. */
export function createControlFlowOutcomeTests({
  createStorage,
  engines = ['default'],
}: {
  createStorage: () => MastraCompositeStore | Promise<MastraCompositeStore>;
  engines?: readonly ('default' | 'evented' | 'evented-async')[];
}) {
  const empty = z.object({});
  it.each(
    engines.flatMap(engine =>
      (['parallel', 'conditional', 'until', 'while', 'foreach', 'sleep', 'sleep-until'] as const).flatMap(kind => {
        const modes =
          kind === 'sleep' || kind === 'sleep-until'
            ? (['success', 'condition-error'] as const)
            : kind === 'until' || kind === 'while' || kind === 'conditional'
              ? (['success', 'error', 'tripwire', 'suspend', 'condition-error'] as const)
              : (['success', 'error', 'tripwire', 'suspend'] as const);
        return modes.map(mode => ({ engine, kind, mode }));
      }),
    ),
  )('$engine records $kind $mode outcomes', async ({ engine, kind, mode }) => {
    const exporter = new TestExporter();
    const endedSpans = () =>
      exporter.getByEventType(TracingEventType.SPAN_ENDED).map(event => event.exportedSpan as AnyExportedSpan);
    const workflow = (engine === 'default' ? createWorkflow : createEventedWorkflow)({
      id: `${kind}-${mode}`,
      retryConfig: { attempts: 0, delay: 0 },
      inputSchema: empty,
      outputSchema: kind === 'foreach' ? z.array(empty) : empty,
    });
    const selected = createOutcomeStep(
      mode === 'condition-error' ? 'success' : mode,
      undefined,
      kind === 'foreach',
    ).step;
    if (kind === 'parallel') {
      // This scenario checks that an already completed peer retains success.
      // Real storage introduces scheduling gaps, so establish that ordering explicitly.
      const execute = selected.execute;
      selected.execute = async args => {
        await expect.poll(() => endedSpans().some(span => span.entityId === 'parallel-peer')).toBe(true);
        return execute(args);
      };
    }
    if (kind === 'sleep') {
      const chained = workflow.then(selected);
      if (mode === 'condition-error')
        chained
          .sleep(async () => {
            throw new Error('Condition failed');
          })
          .commit();
      else chained.sleep(20).commit();
    } else if (kind === 'sleep-until') {
      workflow
        .then(selected)
        .sleepUntil(async () => {
          if (mode === 'condition-error') throw new Error('Condition failed');
          return new Date(Date.now() + 20);
        })
        .commit();
    } else if (kind === 'foreach') workflow.then(createForeachSeed()).foreach(selected, { concurrency: 1 }).commit();
    else if (kind === 'parallel')
      workflow.parallel([selected, createOutcomeStep('success', 'parallel-peer').step]).commit();
    else if (kind === 'until')
      workflow
        .dountil(selected, async ({ iterationCount }) => {
          if (mode === 'condition-error') throw new Error('Condition failed');
          return iterationCount >= 2;
        })
        .commit();
    else if (kind === 'while')
      workflow
        .dowhile(selected, async ({ iterationCount }) => {
          if (mode === 'condition-error') throw new Error('Condition failed');
          return iterationCount < 2;
        })
        .commit();
    else
      workflow
        .branch([
          [async () => true, selected],
          [
            async () => {
              if (mode === 'condition-error') throw new Error('Condition failed');
              return false;
            },
            createOutcomeStep('error', 'unselected').step,
          ],
        ])
        .commit();
    const assertOutcome =
      kind === 'parallel'
        ? expectParallelOutcome
        : kind === 'conditional'
          ? expectConditionalOutcome
          : kind === 'foreach'
            ? expectForeachOutcome
            : expectLoopOutcome;
    const blockType =
      kind === 'sleep' || kind === 'sleep-until'
        ? SpanType.WORKFLOW_SLEEP
        : kind === 'parallel'
          ? SpanType.WORKFLOW_PARALLEL
          : kind === 'conditional'
            ? SpanType.WORKFLOW_CONDITIONAL
            : SpanType.WORKFLOW_LOOP;
    const host = new Mastra({
      logger: false,
      storage: await createStorage(),
      workflows: { workflow },
      observability: new Observability({
        configs: { default: { serviceName: 'parallel-outcomes', exporters: [exporter] } },
      }),
    });
    try {
      if (engine !== 'default') await host.startWorkers();
      const run = await workflow.createRun();
      if (engine === 'evented-async' && 'startAsync' in run) await run.startAsync({ inputData: {} });
      else if (mode === 'condition-error' && engine === 'default' && kind !== 'conditional')
        await expect(run.start({ inputData: {} })).rejects.toThrow('Condition failed');
      else await run.start({ inputData: {} });
      await expect.poll(() => endedSpans().filter(span => span.type === SpanType.WORKFLOW_RUN).length).toBe(1);
      if (engine === 'default') {
        if (kind === 'sleep' || kind === 'sleep-until')
          expectSleepOutcome(endedSpans(), mode as 'success' | 'condition-error');
        else if (kind === 'conditional') expectConditionalOutcome(endedSpans(), mode);
        else if (mode === 'condition-error') expectLoopConditionFailure(endedSpans());
        else assertOutcome(endedSpans(), mode);
        expect(
          exporter.getByEventType(TracingEventType.SPAN_STARTED).find(e => e.exportedSpan.type === blockType)
            ?.exportedSpan,
        ).toMatchObject({ outcome: null });
      } else if (kind === 'sleep' || kind === 'sleep-until') {
        expectSleepOutcome(endedSpans(), mode as 'success' | 'condition-error', true);
        expect(
          exporter
            .getByEventType(TracingEventType.SPAN_STARTED)
            .find(event => event.exportedSpan.type === SpanType.WORKFLOW_SLEEP)?.exportedSpan,
        ).toMatchObject({ outcome: null });
      } else if (kind === 'conditional') {
        expectConditionalOutcome(endedSpans(), mode);
      } else if (mode === 'condition-error') {
        expectLoopConditionFailure(endedSpans(), true, true);
      } else {
        assertOutcome(endedSpans(), mode);
      }
      if (kind !== 'sleep' && kind !== 'sleep-until') {
        const starts = exporter
          .getByEventType(TracingEventType.SPAN_STARTED)
          .filter(event => event.exportedSpan.type === blockType);
        expect(starts).toHaveLength(1);
        expect(starts[0]!.exportedSpan).toMatchObject({ outcome: null });
      }
      if (kind === 'conditional') {
        const evaluations = exporter
          .getByEventType(TracingEventType.SPAN_STARTED)
          .map(event => event.exportedSpan)
          .filter(span => span.type === SpanType.WORKFLOW_CONDITIONAL_EVAL);
        expect(evaluations).toHaveLength(2);
        for (const span of evaluations) expect(span).toMatchObject({ outcome: null });
      }
      if ((kind === 'until' || kind === 'while') && (mode === 'success' || mode === 'condition-error')) {
        const evaluations = exporter
          .getByEventType(TracingEventType.SPAN_STARTED)
          .map(event => event.exportedSpan)
          .filter(span => span.type === SpanType.WORKFLOW_CONDITIONAL_EVAL);
        expect(evaluations.length).toBeGreaterThan(0);
        for (const span of evaluations) expect(span).toMatchObject({ outcome: null });
      }
      expect(exporter.getIncompleteSpans()).toEqual([]);
      const terminalIds = endedSpans().map(span => span.id);
      expect(new Set(terminalIds).size).toBe(terminalIds.length);
    } finally {
      await host.shutdown();
    }
  });
}

/** A committed loop decision must survive a failed continuation publication. */
export function createConcurrentBranchOutcomeTests({
  createStorage,
  engines = ['default'],
}: {
  createStorage: () => MastraCompositeStore | Promise<MastraCompositeStore>;
  engines?: readonly ('default' | 'evented' | 'evented-async')[];
}) {
  it.each(
    engines.flatMap(engine =>
      (['parallel', 'conditional'] as const).flatMap(kind =>
        (['complete', 'cancel'] as const).map(action => ({ engine, kind, action })),
      ),
    ),
  )('$engine retains completed $kind branch outcomes during aggregate $action', async ({ engine, kind, action }) => {
    const empty = z.object({});
    const exporter = new TestExporter();
    const ended = () => exporter.getByEventType(TracingEventType.SPAN_ENDED).map(event => event.exportedSpan);
    let release!: () => void;
    let pendingFinished = false;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const completed = createStep({
      id: 'completed-branch',
      inputSchema: empty,
      outputSchema: empty,
      execute: async () => ({}),
    });
    const pending = createStep({
      id: 'pending-branch',
      inputSchema: empty,
      outputSchema: empty,
      execute: async () => {
        await gate;
        pendingFinished = true;
        return {};
      },
    });
    const workflow = (engine === 'default' ? createWorkflow : createEventedWorkflow)({
      id: 'concurrent-branches',
      inputSchema: empty,
      outputSchema: empty,
    });
    if (kind === 'parallel') workflow.parallel([completed, pending]).commit();
    else
      workflow
        .branch([
          [async () => true, completed],
          [async () => true, pending],
        ])
        .commit();
    const blockType = kind === 'parallel' ? SpanType.WORKFLOW_PARALLEL : SpanType.WORKFLOW_CONDITIONAL;
    const host = new Mastra({
      logger: false,
      storage: await createStorage(),
      workflows: { [workflow.id]: workflow },
      observability: new Observability({
        configs: { default: { serviceName: 'concurrent-branches', exporters: [exporter] } },
      }),
    });
    let started: Promise<unknown> | undefined;
    try {
      if (engine !== 'default') await host.startWorkers();
      const run = await workflow.createRun();
      if (engine === 'evented-async' && 'startAsync' in run) await run.startAsync({ inputData: {} });
      else started = run.start({ inputData: {} });
      await expect.poll(() => ended().some(span => span.entityId === completed.id)).toBe(true);
      await expect
        .poll(() =>
          exporter
            .getByEventType(TracingEventType.SPAN_STARTED)
            .some(event => event.exportedSpan.entityId === pending.id),
        )
        .toBe(true);
      const finishedBranch = ended().find(span => span.entityId === completed.id)!;
      expect(finishedBranch).toMatchObject({ outcome: 'success', stopReason: null });
      expect(ended().filter(span => span.type === blockType)).toHaveLength(0);
      const starts = exporter
        .getByEventType(TracingEventType.SPAN_STARTED)
        .filter(event => event.exportedSpan.type === blockType);
      expect(starts).toHaveLength(1);
      expect(starts[0]!.exportedSpan).toMatchObject({ outcome: null });
      if (action === 'cancel') await run.cancel();
      const beforeRelease = ended();
      release();
      await started;
      await expect.poll(() => pendingFinished).toBe(true);
      await expect.poll(() => ended().filter(span => span.type === SpanType.WORKFLOW_RUN).length).toBe(1);
      await new Promise(resolve => setTimeout(resolve, 30));
      const blocks = ended().filter(span => span.type === blockType);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({
        outcome: action === 'cancel' ? 'interrupted' : 'success',
        stopReason: action === 'cancel' ? 'caller_cancelled' : null,
      });
      expect(ended().find(span => span.entityId === pending.id)).toMatchObject({
        outcome: blocks[0]!.outcome,
        parentSpanId: blocks[0]!.id,
      });
      expect(finishedBranch.parentSpanId).toBe(blocks[0]!.id);
      for (const span of beforeRelease) expect(ended().filter(event => event.id === span.id)).toEqual([span]);
      expect(exporter.getIncompleteSpans()).toEqual([]);
      expect(new Set(ended().map(span => span.id)).size).toBe(ended().length);
    } finally {
      release();
      await host.shutdown();
    }
  });
}

/** A remote cancellation is delayed in transport while the owner finishes normally. */
