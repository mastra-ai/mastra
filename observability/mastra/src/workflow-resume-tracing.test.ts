import { Mastra } from '@mastra/core/mastra';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import { MockStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { Observability } from './default';
import { TestExporter } from './exporters';

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

const makeWorkflow = () => {
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

  return createWorkflow({
    id: 'resume-tracing-workflow',
    inputSchema: empty,
    outputSchema: z.object({ approved: z.boolean() }),
    steps: [approvalStep],
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
