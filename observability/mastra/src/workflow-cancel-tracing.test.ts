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

    const deaf = endedSpans().find(span => span.name === "workflow step: 'deaf'");
    expect(deaf?.attributes).toMatchObject({ status: 'canceled' });

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

      const deaf = endedSpans().find(span => span.name === "workflow step: 'deaf'");
      expect(deaf?.attributes).toMatchObject({ status: 'canceled' });
    } finally {
      await mastra.stopWorkers();
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
    } finally {
      await mastra.stopWorkers();
    }
  });
});
