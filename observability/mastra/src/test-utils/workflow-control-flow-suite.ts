import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import type { MastraCompositeStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { createWorkflow as createEventedWorkflow } from '@mastra/core/workflows/evented';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createFlakyPublishPubSub } from '../../../../packages/core/src/workflows/evented/test-utils/flaky-publish-pubsub';
import { Observability } from '../default';
import { TestExporter } from '../exporters';
import { DelayedNestedStartPubSub } from './delayed-nested-start-pubsub';
import { TerminalRedeliveryPubSub } from './terminal-redelivery-pubsub';
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
  engines = ['default', 'evented', 'evented-async'],
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
export function createGuardedLoopReplayOutcomeTests(createStorage: () => Promise<MastraCompositeStore>) {
  it.each(
    (['until', 'while', 'foreach', 'parallel', 'conditional'] as const).flatMap(kind =>
      [1, 2].map(failures => ({ kind, failures })),
    ),
  )('$kind keeps committed outcomes after $failures failed continuation publications', async ({ kind, failures }) => {
    const storage = await createStorage();
    const workflowStore = (await storage.getStore('workflows'))!;
    expect(workflowStore.supportsWorkflowStepGuards()).toBe(true);
    const exporter = new TestExporter();
    const ended = () => exporter.getByEventType(TracingEventType.SPAN_ENDED).map(event => event.exportedSpan);
    const empty = z.object({});
    let bodyCalls = 0;
    let conditionCalls = 0;
    const body = createStep({
      id: 'guarded-body',
      inputSchema: empty,
      outputSchema: empty,
      execute: async () => {
        bodyCalls++;
        return {};
      },
    });
    const condition = async () => {
      conditionCalls++;
      return kind === 'until' || kind === 'conditional';
    };
    const workflow = createEventedWorkflow({
      id: `guarded-replay-${kind}`,
      inputSchema: empty,
      outputSchema: kind === 'foreach' ? z.array(empty) : empty,
    });
    if (kind === 'foreach') workflow.then(createResumeSeed()).foreach(body, { concurrency: 1 }).commit();
    else if (kind === 'until') workflow.dountil(body, condition).commit();
    else if (kind === 'while') workflow.dowhile(body, condition).commit();
    else if (kind === 'parallel') workflow.parallel([body]).commit();
    else workflow.branch([[condition, body]]).commit();
    const eventType = kind === 'foreach' ? 'workflow.step.run' : 'workflow.step.end';
    const flaky = createFlakyPublishPubSub(new EventEmitterPubSub(), { [eventType]: failures }, event => {
      const data = event.data as { executionPath?: number[] } | undefined;
      if (kind === 'foreach') return data?.executionPath?.[0] === 2;
      return data?.executionPath?.length === 1;
    });
    const host = new Mastra({
      logger: false,
      storage,
      workflows: { workflow },
      pubsub: flaky.pubsub,
      observability: new Observability({
        configs: { default: { serviceName: 'guarded-replay', exporters: [exporter] } },
      }),
    });
    try {
      await host.startWorkers();
      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });
      expect(result.status).toBe('success');
      expect(flaky.rejected[eventType]).toBe(failures);
      expect(flaky.attempts[eventType]).toBe(failures + 1);
      expect(bodyCalls).toBe(1);
      expect(conditionCalls).toBe(kind === 'foreach' || kind === 'parallel' ? 0 : 1);
      const snapshot = await workflowStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
      expect(snapshot?.status).toBe('success');
      if (kind === 'until' || kind === 'while')
        expect(snapshot?.context['guarded-body']).toMatchObject({
          status: 'success',
          metadata: { loopCondition: kind === 'until' },
        });
      await expect.poll(() => ended().filter(span => span.type === SpanType.WORKFLOW_RUN).length).toBe(1);
      const evaluations = ended().filter(span => span.type === SpanType.WORKFLOW_CONDITIONAL_EVAL);
      expect(evaluations).toHaveLength(kind === 'foreach' || kind === 'parallel' ? 0 : 1);
      if (kind !== 'foreach' && kind !== 'parallel')
        expect(evaluations[0]).toMatchObject({
          outcome: 'success',
          stopReason: null,
          output: kind === 'until' || kind === 'conditional',
        });
      const blockType =
        kind === 'parallel'
          ? SpanType.WORKFLOW_PARALLEL
          : kind === 'conditional'
            ? SpanType.WORKFLOW_CONDITIONAL
            : SpanType.WORKFLOW_LOOP;
      const blocks = ended().filter(span => span.type === blockType);
      expect(blocks).toHaveLength(1);
      if (kind !== 'foreach' && kind !== 'parallel') expect(evaluations[0]!.parentSpanId).toBe(blocks[0]!.id);
      const bodies = ended().filter(span => span.type === SpanType.WORKFLOW_STEP && span.entityId === 'guarded-body');
      expect(bodies).toHaveLength(1);
      expect(bodies[0]!.parentSpanId).toBe(blocks[0]!.id);
      for (const span of ended()) expect(span).toMatchObject({ outcome: 'success', stopReason: null });
      expect(exporter.getIncompleteSpans()).toEqual([]);
      expect(new Set(ended().map(span => span.id)).size).toBe(ended().length);
    } finally {
      await host.shutdown();
    }
  });
}

/** Resume a selected suspended child without confusing it with another foreach item. */
export function createNestedForeachResumeOutcomeTests({
  createStorage,
  engines = ['default', 'evented', 'evented-async'],
}: {
  createStorage: () => MastraCompositeStore | Promise<MastraCompositeStore>;
  engines?: readonly ('default' | 'evented' | 'evented-async')[];
}) {
  const empty = z.object({});
  it.each(engines.flatMap(engine => (['explicit', 'auto'] as const).map(resumeMode => ({ engine, resumeMode }))))(
    '$engine resumes the selected foreach child ($resumeMode) and preserves prior outcomes',
    async ({ engine, resumeMode }) => {
      const exporter = new TestExporter();
      const endedSpans = () => exporter.getByEventType(TracingEventType.SPAN_ENDED).map(event => event.exportedSpan);
      const build = engine === 'default' ? createWorkflow : createEventedWorkflow;
      const itemOutput = z.object({ index: z.number(), token: z.string() });
      const accepted: { index: number; token: string }[] = [];
      const inner = build({ id: 'indexed-child', inputSchema: z.number(), outputSchema: itemOutput })
        .then(
          createStep({
            id: 'indexed-gate',
            inputSchema: z.number(),
            outputSchema: itemOutput,
            resumeSchema: z.object({ token: z.string() }),
            suspendSchema: empty,
            execute: async ({ inputData, resumeData, suspend }) => {
              if (!resumeData) return suspend({});
              const result = { index: inputData, token: resumeData.token };
              accepted.push(result);
              return result;
            },
          }),
        )
        .commit();
      const workflow = build({ id: 'indexed-foreach', inputSchema: empty, outputSchema: z.array(itemOutput) })
        .then(
          createStep({
            id: 'indices',
            inputSchema: empty,
            outputSchema: z.array(z.number()),
            execute: async () => [0, 1],
          }),
        )
        .foreach(inner, { concurrency: 2 })
        .commit();
      const host = new Mastra({
        logger: false,
        storage: await createStorage(),
        workflows: { [workflow.id]: workflow },
        observability: new Observability({
          configs: { default: { serviceName: 'indexed-foreach', exporters: [exporter] } },
        }),
      });
      try {
        if (engine !== 'default') await host.startWorkers();
        const run = await workflow.createRun();
        if (engine === 'evented-async' && 'startAsync' in run) await run.startAsync({ inputData: {} });
        else expect((await run.start({ inputData: {} })).status).toBe('suspended');
        await expect.poll(() => endedSpans().filter(span => span.type === SpanType.WORKFLOW_LOOP).length).toBe(1);
        const initial = endedSpans();
        const step = resumeMode === 'auto' ? inner.id : [inner.id, 'indexed-gate'];
        const second = await workflow.createRun({ runId: run.runId });
        expect((await second.resume({ step, forEachIndex: 1, resumeData: { token: 'second' } })).status).toBe(
          'suspended',
        );
        expect(accepted).toEqual([{ index: 1, token: 'second' }]);
        await expect.poll(() => endedSpans().filter(span => span.type === SpanType.WORKFLOW_LOOP).length).toBe(2);
        const partial = endedSpans();
        const first = await workflow.createRun({ runId: run.runId });
        const result = await first.resume({ step, forEachIndex: 0, resumeData: { token: 'first' } });
        expect(result).toMatchObject({
          status: 'success',
          result: [
            { index: 0, token: 'first' },
            { index: 1, token: 'second' },
          ],
        });
        expect(accepted).toEqual([
          { index: 1, token: 'second' },
          { index: 0, token: 'first' },
        ]);
        await expect.poll(() => endedSpans().filter(span => span.type === SpanType.WORKFLOW_LOOP).length).toBe(3);
        expect(
          endedSpans()
            .filter(span => span.type === SpanType.WORKFLOW_LOOP)
            .map(span => span.outcome),
        ).toEqual(['suspend', 'suspend', 'success']);
        for (const span of [...initial, ...partial])
          expect(endedSpans().filter(event => event.id === span.id)).toEqual([span]);
        const ids = endedSpans().map(span => span.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(exporter.getIncompleteSpans()).toEqual([]);
        for (const span of endedSpans()) if (span.parentSpanId) expect(ids).toContain(span.parentSpanId);
      } finally {
        await host.shutdown();
      }
    },
  );
}

/** A settled branch keeps its outcome while the container still owns an active sibling. */
export function createConcurrentBranchOutcomeTests({
  createStorage,
  engines = ['default', 'evented', 'evented-async'],
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
        outcome: action === 'cancel' ? 'abort' : 'success',
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
export function createEventedCancelCompletionRaceTests(
  createStorage: () => MastraCompositeStore | Promise<MastraCompositeStore>,
) {
  it.each(
    (['evented', 'evented-async'] as const).flatMap(engine =>
      (['success', 'error', 'tripwire', 'bail'] as const).map(mode => ({ engine, mode })),
    ),
  )('$engine preserves $mode completion when remote cancellation arrives late', async ({ engine, mode }) => {
    let releaseBody!: () => void;
    let enteredBody!: () => void;
    let releaseCancel!: () => void;
    let enteredCancel!: () => void;
    const bodyGate = new Promise<void>(resolve => {
      releaseBody = resolve;
    });
    const bodyEntered = new Promise<void>(resolve => {
      enteredBody = resolve;
    });
    const cancelGate = new Promise<void>(resolve => {
      releaseCancel = resolve;
    });
    const cancelEntered = new Promise<void>(resolve => {
      enteredCancel = resolve;
    });
    const transport = new EventEmitterPubSub();
    const delayedTransport = new Proxy(transport, {
      get(target, prop) {
        if (prop === 'publish')
          return async (...args: Parameters<EventEmitterPubSub['publish']>) => {
            if (args[0] === 'workflows' && args[1].type === 'workflow.cancel') {
              enteredCancel();
              await cancelGate;
            }
            return target.publish(...args);
          };
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const storage = await createStorage();
    const exporter = new TestExporter();
    const workflow = createEventedWorkflow({
      id: `cancel-completion-${mode}`,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      retryConfig: { attempts: 0, delay: 0 },
    })
      .then(
        createStep({
          id: 'gate',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => {
            enteredBody();
            await bodyGate;
            return {};
          },
        }),
      )
      .then(createOutcomeStep(mode).step)
      .commit();
    const remoteWorkflow = createEventedWorkflow({
      id: workflow.id,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    })
      .then(createOutcomeStep('success').step)
      .commit();
    const owner = new Mastra({
      logger: false,
      storage,
      pubsub: transport,
      workflows: { workflow },
      observability: new Observability({
        configs: { default: { serviceName: 'cancel-completion', exporters: [exporter] } },
      }),
    });
    const remote = new Mastra({ logger: false, storage, pubsub: delayedTransport, workflows: { remoteWorkflow } });
    let execution: Promise<unknown> | undefined;
    let cancellation: Promise<void> | undefined;
    try {
      await owner.startWorkers();
      const run = await workflow.createRun();
      execution = engine === 'evented' ? run.start({ inputData: {} }) : run.startAsync({ inputData: {} });
      await bodyEntered;
      const remoteRun = await remoteWorkflow.createRun({ runId: run.runId });
      cancellation = remoteRun.cancel();
      await cancelEntered;
      releaseBody();
      await execution;
      const ended = () => exporter.getByEventType(TracingEventType.SPAN_ENDED).map(event => event.exportedSpan);
      await expect.poll(() => ended().filter(span => span.type === SpanType.WORKFLOW_RUN).length).toBe(1);
      const completions = ended();
      expectWorkflowOutcome(completions, mode);
      const store = (await storage.getStore('workflows'))!;
      const read = () => store.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
      const before = (await read())!;
      expect(['success', 'failed', 'tripwire', 'bailed']).toContain(before.status);
      releaseCancel();
      await cancellation;
      // Allow the real transport's queued worker callback to consume the stale cancel.
      await new Promise(resolve => setTimeout(resolve, 100));
      expect((await read())?.status).toBe(before.status);
      expect((await read())?.result).toEqual(before.result);
      expect(ended()).toEqual(completions);
    } finally {
      releaseBody();
      releaseCancel();
      await execution?.catch(() => {});
      await cancellation?.catch(() => {});
      await remote.stopWorkers();
      await owner.shutdown();
    }
  });
}

/** The caller and consumer are different Mastra instances; only storage and transport are shared. */
export function createEventedRemoteTracingTests(
  createStorage: () => MastraCompositeStore | Promise<MastraCompositeStore>,
) {
  it.each(
    (['start', 'startAsync'] as const).flatMap(start =>
      (['success', 'error', 'tripwire', 'bail', 'suspend'] as const).map(mode => ({ start, mode })),
    ),
  )('evented $start retains $mode tracing on a separate worker', async ({ start, mode }) => {
    const storage = await createStorage();
    const pubsub = new EventEmitterPubSub();
    const callerExporter = new TestExporter();
    const workerExporter = new TestExporter();
    const unusedExporter = new TestExporter();
    const build = () =>
      createEventedWorkflow({
        id: `remote-tracing-${mode}`,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        retryConfig: { attempts: 0, delay: 0 },
      })
        .then(createOutcomeStep(mode).step)
        .commit();
    const callerWorkflow = build();
    const workerWorkflow = build();
    const observability = (exporter: TestExporter, selectAlias = true) => {
      const registry = new Observability({
        configSelector: () => 'selected',
        configs: {
          default: { serviceName: 'unused', exporters: [unusedExporter] },
          selected: { serviceName: 'remote-tracing', exporters: [exporter] },
        },
      });
      const selected = registry.getInstance('selected')!;
      registry.unregisterInstance('selected');
      registry.registerInstance('selected-alias', selected);
      registry.setConfigSelector(() => (selectAlias ? 'selected-alias' : 'default'));
      return registry;
    };
    const caller = new Mastra({
      logger: false,
      storage,
      pubsub,
      workflows: { [callerWorkflow.id]: callerWorkflow },
      observability: observability(callerExporter),
    });
    const worker = new Mastra({
      logger: false,
      storage,
      pubsub,
      workflows: { [workerWorkflow.id]: workerWorkflow },
      observability: observability(workerExporter, false),
    });
    const ended = () =>
      [callerExporter, workerExporter].flatMap(exporter =>
        exporter.getByEventType(TracingEventType.SPAN_ENDED).map(event => event.exportedSpan),
      );
    try {
      await worker.startWorkers();
      const run = await callerWorkflow.createRun();
      await run[start]({ inputData: {} });
      await expect.poll(() => ended().filter(span => span.type === SpanType.WORKFLOW_RUN).length).toBe(1);
      expectWorkflowOutcome(ended(), mode);
      const root = ended().find(span => span.type === SpanType.WORKFLOW_RUN)!;
      const child = workerExporter
        .getByEventType(TracingEventType.SPAN_ENDED)
        .map(event => event.exportedSpan)
        .find(span => span.type === SpanType.WORKFLOW_STEP)!;
      expect(child).toMatchObject({ traceId: root.traceId, parentSpanId: root.id });
      if (mode === 'suspend') {
        await run.resume({ step: 'decision-suspend', resumeData: {} });
        await expect.poll(() => ended().filter(span => span.type === SpanType.WORKFLOW_RUN).length).toBe(2);
        const resumed = ended().find(span => span.type === SpanType.WORKFLOW_RUN && span.id !== root.id)!;
        expect(resumed).toMatchObject({ outcome: 'success', traceId: root.traceId, resumedFromSpanId: root.id });
        expect(ended().filter(span => span.type === SpanType.WORKFLOW_STEP && span.outcome === 'success')).toEqual([
          expect.objectContaining({ traceId: root.traceId, parentSpanId: resumed.id }),
        ]);
        expect(ended().find(span => span.id === root.id)).toEqual(root);
      }
      const store = (await storage.getStore('workflows'))!;
      for (const root of ended().filter(span => span.type === SpanType.WORKFLOW_RUN)) {
        await expect
          .poll(
            async () =>
              (await store.loadWorkflowSnapshot({ workflowName: callerWorkflow.id, runId: run.runId }))?.tracingSpans?.[
                `${root.traceId}:${root.id}`
              ]?.outcome,
          )
          .toBe(root.outcome);
        const saved = (await store.loadWorkflowSnapshot({ workflowName: callerWorkflow.id, runId: run.runId }))!
          .tracingSpans![`${root.traceId}:${root.id}`]!;
        expect(saved).toMatchObject({
          observabilityInstanceName: 'selected-alias',
          stopReason: root.stopReason,
          stopReasonContext: JSON.parse(JSON.stringify(root.stopReasonContext ?? null)),
        });
        expect(new Date(saved.endTime!)).toEqual(root.endTime);
      }
      expect(unusedExporter.getByEventType(TracingEventType.SPAN_ENDED)).toEqual([]);
      const starts = [callerExporter, workerExporter].flatMap(exporter =>
        exporter.getByEventType(TracingEventType.SPAN_STARTED),
      );
      expect(starts.filter(event => event.exportedSpan.type === SpanType.WORKFLOW_RUN)).toHaveLength(
        mode === 'suspend' ? 2 : 1,
      );
      expect(ended()).toHaveLength(mode === 'suspend' ? 4 : 2);
      const currentRoot = ended()
        .filter(span => span.type === SpanType.WORKFLOW_RUN)
        .at(-1)!;
      expect(
        (await store.loadWorkflowSnapshot({ workflowName: callerWorkflow.id, runId: run.runId }))?.tracingContext,
      ).toMatchObject({ traceId: currentRoot.traceId, spanId: currentRoot.id });
      for (const event of starts) expect(event.exportedSpan.outcome).toBeNull();
    } finally {
      await worker.stopWorkers();
      await caller.shutdown();
    }
  });
}

/** A replacement worker must not apply an old suspension to the currently running resume. */
export function createEventedStaleTerminationTests(
  createStorage: () => MastraCompositeStore | Promise<MastraCompositeStore>,
) {
  it.each(
    (['start', 'startAsync'] as const).flatMap(start =>
      (['workflows', 'workflows-finish'] as const).flatMap(topic =>
        (['success', 'suspend'] as const).map(finish => ({ start, topic, finish })),
      ),
    ),
  )(
    'evented $start ignores an acknowledged old suspension after resume ($topic, $finish)',
    async ({ start, topic, finish }) => {
      const storage = await createStorage();
      const pubsub = new TerminalRedeliveryPubSub();
      const exporter = new TestExporter();
      let release!: () => void;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      let entered!: () => void;
      const resumedBody = new Promise<void>(resolve => {
        entered = resolve;
      });
      const build = () => {
        const step = createStep({
          id: 'approval',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          resumeSchema: z.object({}),
          suspendSchema: z.object({}),
          execute: async ({ resumeData, suspend }) => {
            if (!resumeData) return suspend({});
            entered();
            await gate;
            return finish === 'suspend' ? suspend({}) : {};
          },
        });
        const workflow = createEventedWorkflow({
          id: 'stale-suspension',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
        })
          .then(step)
          .commit();
        const mastra = new Mastra({
          logger: false,
          storage,
          pubsub,
          workflows: { [workflow.id]: workflow },
          observability: new Observability({
            configs: { default: { serviceName: 'stale-suspension', exporters: [exporter] } },
          }),
        });
        return { mastra, workflow };
      };
      const caller = build();
      const firstWorker = build();
      const replacement = build();
      const roots = () =>
        exporter
          .getByEventType(TracingEventType.SPAN_ENDED)
          .map(event => event.exportedSpan)
          .filter(span => span.type === SpanType.WORKFLOW_RUN);
      let resume: Promise<unknown> | undefined;
      try {
        await firstWorker.mastra.startWorkers();
        const run = await caller.workflow.createRun();
        await run[start]({ inputData: {} });
        await expect.poll(() => roots().length).toBe(1);
        const original = roots()[0]!;
        expect(original.outcome).toBe('suspend');
        if (finish === 'suspend')
          replacement.workflow.__setResumeTracingContext({ traceId: original.traceId, spanId: original.id });
        await firstWorker.mastra.stopWorkers();
        await replacement.mastra.startWorkers();
        resume = run.resume({ step: 'approval', resumeData: {} });
        await resumedBody;
        await pubsub.replaySuspension(topic);
        expect(roots()).toEqual([original]);
        release();
        expect(await resume).toMatchObject({ status: finish === 'suspend' ? 'suspended' : 'success' });
        await expect.poll(() => roots().length).toBe(2);
        expect(roots()[1]).toMatchObject({ outcome: finish, resumedFromSpanId: original.id });
        expect(roots()[0]).toEqual(original);
        const store = (await storage.getStore('workflows'))!;
        const saved = await store.loadWorkflowSnapshot({ workflowName: caller.workflow.id, runId: run.runId });
        expect(saved?.status).toBe(finish === 'suspend' ? 'suspended' : 'success');
        expect(saved?.executionSpan).toEqual({ traceId: roots()[1]!.traceId, spanId: roots()[1]!.id });
        if (finish === 'suspend')
          expect(saved?.tracingContext).toEqual({ traceId: original.traceId, spanId: original.id });
        expect(saved?.tracingSpans?.[`${roots()[1]!.traceId}:${roots()[1]!.id}`]?.outcome).toBe(finish);
      } finally {
        release();
        await resume?.catch(() => {});
        await firstWorker.mastra.stopWorkers();
        await replacement.mastra.stopWorkers();
        await caller.mastra.shutdown();
      }
    },
  );
}

/** Cancellation must remain authoritative when a nested start was already being published. */
export function createEventedNestedDispatchCancellationTests(
  createStorage: () => MastraCompositeStore | Promise<MastraCompositeStore>,
) {
  it('keeps a canceled child stopped when its delayed start is finally delivered', async () => {
    const empty = z.object({});
    let calls = 0;
    const child = createEventedWorkflow({ id: 'delayed-child', inputSchema: empty, outputSchema: empty })
      .then(
        createStep({
          id: 'must-not-run',
          inputSchema: empty,
          outputSchema: empty,
          execute: async () => {
            calls++;
            return {};
          },
        }),
      )
      .commit();
    const parent = createEventedWorkflow({ id: 'delayed-parent', inputSchema: empty, outputSchema: empty })
      .then(child)
      .commit();
    const storage = await createStorage();
    const pubsub = new DelayedNestedStartPubSub();
    const exporter = new TestExporter();
    const host = new Mastra({
      logger: false,
      storage,
      pubsub,
      workflows: { parent, child },
      observability: new Observability({
        configs: { default: { serviceName: 'delayed-child', exporters: [exporter] } },
      }),
    });
    try {
      await host.startWorkers();
      const run = await parent.createRun();
      await run.startAsync({ inputData: {} });
      await expect.poll(() => pubsub.child).toBeDefined();
      const store = (await storage.getStore('workflows'))!;
      const key = { workflowName: child.id, runId: pubsub.child!.runId };
      expect((await store.loadWorkflowSnapshot(key))?.status).toBe('pending');
      await run.cancel();
      await expect.poll(async () => (await store.loadWorkflowSnapshot(key))?.status).toBe('canceled');
      const ended = () => exporter.getByEventType(TracingEventType.SPAN_ENDED).map(event => event.exportedSpan);
      await expect.poll(() => ended().length).toBe(3);
      const completions = structuredClone(ended());
      for (const span of completions)
        expect(span).toMatchObject({ outcome: 'abort', stopReason: 'caller_cancelled', stopReasonContext: null });
      await pubsub.deliver();
      expect(calls).toBe(0);
      expect((await store.loadWorkflowSnapshot(key))?.status).toBe('canceled');
      expect(ended()).toEqual(completions);
      expect(exporter.getIncompleteSpans()).toEqual([]);
    } finally {
      pubsub.release();
      await host.shutdown({ drainTimeout: 0 });
    }
  });
}
