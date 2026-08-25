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

const empty = z.object({});

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * Resolved by the tail step as soon as its `execute` is entered, which is after
 * the engine has opened the step's span. Tests await this instead of sleeping,
 * so cancellation always lands on a run with a live, open step span.
 */
let tailStepEntered = createDeferred();
/** Lets a test release a parked tail step so it fails after cancel() ran. */
let releaseTailStep = createDeferred();

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
  execute: () => {
    tailStepEntered.resolve();
    return new Promise<Record<string, never>>(() => {});
  },
});

const cooperativeStep = createStep({
  id: 'cooperative',
  inputSchema: empty,
  outputSchema: empty,
  execute: ({ abortSignal }) =>
    new Promise<Record<string, never>>(resolve => {
      tailStepEntered.resolve();
      abortSignal.addEventListener('abort', () => resolve({}), { once: true });
    }),
});

/** Ignores abortSignal like deafStep, but eventually rejects after cancellation. */
const deafThenFailingStep = createStep({
  id: 'deaf',
  inputSchema: empty,
  outputSchema: empty,
  execute: async () => {
    tailStepEntered.resolve();
    await releaseTailStep.promise;
    throw new Error('late failure');
  },
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
    tailStepEntered = createDeferred();
    releaseTailStep = createDeferred();
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
    await tailStepEntered.promise;
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

    const deaf = endedSpans().find(span => span.name === "workflow step: 'deaf'");
    expect(deaf?.attributes).toMatchObject({ status: 'canceled' });

    const quick = endedSpans().find(span => span.name === "workflow step: 'quick'");
    expect(quick?.attributes).toMatchObject({ status: 'success' });
  });

  it('keeps the canceled record when a step that ignored abortSignal fails afterwards', async () => {
    const mastra = buildMastra(exporter, deafThenFailingStep);
    const run = await mastra.getWorkflow('outerWorkflow').createRun();

    run.start({ inputData: {} }).catch(() => {});
    await tailStepEntered.promise;
    await run.cancel();

    // The step only rejects once the run is canceled and its span tree already
    // force-closed, so the engine reports the failure against a span that has
    // already emitted its single SPAN_ENDED.
    releaseTailStep.resolve();
    await tick(200);

    expectNoDanglingSpans();
    expectSingleEndPerSpan();
    expectParentsPresent();

    const deaf = endedSpans().find(span => span.name === "workflow step: 'deaf'");
    expect(deaf?.attributes).toMatchObject({ status: 'canceled' });
    expect(deaf?.errorInfo).toBeUndefined();

    const root = endedSpans().find(span => span.isRootSpan);
    expect(root?.attributes).toMatchObject({ status: 'canceled' });
    expect(root?.errorInfo).toBeUndefined();
  });

  it('emits one end per span when the step honours abortSignal', async () => {
    const mastra = buildMastra(exporter, cooperativeStep);
    const run = await mastra.getWorkflow('outerWorkflow').createRun();

    const started = run.start({ inputData: {} });
    await tailStepEntered.promise;
    await run.cancel();
    await started;
    await tick(100);

    expectNoDanglingSpans();
    expectSingleEndPerSpan();
    expectParentsPresent();

    const root = endedSpans().find(span => span.isRootSpan);
    expect(root?.attributes).toMatchObject({ status: 'canceled' });
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
    await tailStepEntered.promise;
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
      await tailStepEntered.promise;
      await run.cancel();
      await tick(200);

      expectNoDanglingSpans();
      expectSingleEndPerSpan();
      expectParentsPresent();

      const root = endedSpans().find(span => span.isRootSpan);
      expect(root?.attributes).toMatchObject({ status: 'canceled' });

      const deaf = endedSpans().find(span => span.name === "workflow step: 'deaf'");
      expect(deaf?.attributes).toMatchObject({ status: 'canceled' });
    } finally {
      await mastra.stopWorkers();
    }
  });

  // Characterizes a pre-existing gap rather than asserting the fix: the evented
  // engine's startAsync() publishes workflow.start and returns without opening a
  // run span, so an evented startAsync run emits no spans at all and cancel()
  // has no tree to close. Asserting "nothing dangles" here would pass on an
  // empty exporter and prove nothing. When evented startAsync gains tracing this
  // test fails, which is the signal to cover its cancellation path properly.
  it('emits no spans at all for an evented startAsync run', async () => {
    const mastra = buildEventedMastra('eventedAsync');
    await mastra.startWorkers();

    try {
      const run = await mastra.getWorkflow('eventedWorkflow').createRun();
      await run.startAsync({ inputData: {} });
      await tailStepEntered.promise;
      await run.cancel();
      await tick(200);

      expect(exporter.getAllSpans()).toHaveLength(0);
    } finally {
      await mastra.stopWorkers();
    }
  });
});
