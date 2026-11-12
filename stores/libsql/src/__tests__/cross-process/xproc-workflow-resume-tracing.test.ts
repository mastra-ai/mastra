/**
 * An evented workflow started by the API replica suspends on a worker in another process. That
 * worker holds no live span for the run, so the snapshot it writes has to carry the tracing
 * context the run started with; otherwise the resume starts a new, unlinked trace.
 */
import { randomUUID } from 'node:crypto';

import { Mastra } from '@mastra/core/mastra';
import { describe, expect, it, vi } from 'vitest';

import { LibSQLStore } from '../../storage';
import { createApprovalWorkflow, createResumeTracingObservability } from './fixtures/approval-workflow';
import type { WorkflowResumePeerArgs } from './fixtures/workflow-resume-peer';
import { createXprocEnv, DEFAULT_HANG_GUARD_MS, PEER_TIMEOUT_MS } from './peer-helper';

const WORKER = new URL('./fixtures/workflow-resume-peer.ts', import.meta.url);

describe('an evented workflow suspended by a worker in another process', () => {
  it(
    'resumes linked to the run span the API replica started',
    async () => {
      const env = await createXprocEnv({ workers: false });
      const workflowId = `resume-tracing-${randomUUID()}`;
      const workflow = createApprovalWorkflow(workflowId);
      const storage = new LibSQLStore({ id: 'workflow-resume-api', url: env.dbUrl });
      const mastra = new Mastra({
        workflows: { [workflowId]: workflow },
        storage,
        pubsub: env.pubsub(),
        logger: false,
        workers: false,
        observability: createResumeTracingObservability(),
      });
      try {
        const worker = await env.spawnPeer(WORKER, { workflowId } satisfies WorkflowResumePeerArgs, {
          role: 'worker',
          workers: true,
        });
        await worker.waitFor('worker-ready');

        const run = await mastra.getWorkflow(workflowId).createRun();
        expect((await run.start({ inputData: {} })).status).toBe('suspended');

        const workflows = await storage.getStore('workflows');
        const snapshot = await vi.waitFor(
          async () => {
            const current = await workflows.loadWorkflowSnapshot({ workflowName: workflowId, runId: run.runId });
            expect(current?.status).toBe('suspended');
            return current!;
          },
          { timeout: DEFAULT_HANG_GUARD_MS, interval: 100 },
        );
        // The worker wrote this snapshot without a live span of its own.
        expect(snapshot.tracingContext, `snapshot written by\n${env.describe()}`).toMatchObject({
          traceId: expect.any(String),
          spanId: expect.any(String),
          sampled: true,
        });

        const resumed = await mastra.getWorkflow(workflowId).createRun({ runId: run.runId });
        expect((await resumed.resume({ resumeData: { approved: true } })).status).toBe('success');

        const observability = await storage.getStore('observability');
        const roots = await vi.waitFor(
          async () => {
            const trace = await observability!.getTrace({ traceId: snapshot.tracingContext!.traceId! });
            const runs = (trace?.spans ?? []).filter(span => span.spanType === 'workflow_run' && span.endedAt);
            expect(runs).toHaveLength(2);
            return runs;
          },
          { timeout: DEFAULT_HANG_GUARD_MS, interval: 100 },
        );
        const original = roots.find(span => !span.metadata?.resumed)!;
        const continuation = roots.find(span => span.metadata?.resumed)!;
        expect(original).toMatchObject({ spanId: snapshot.tracingContext!.spanId, outcome: 'suspend' });
        expect(continuation).toMatchObject({ outcome: 'success', parentSpanId: original.spanId });
        expect(continuation.resumedFromSpanId ?? continuation.metadata?.resumedFromSpanId).toBe(original.spanId);

        worker.send('finish');
        await worker.result();
        expect(await worker.exit()).toEqual({ code: 0, signal: null });
      } finally {
        await mastra.shutdown();
        await storage.close();
        await env.cleanup();
      }
    },
    PEER_TIMEOUT_MS + DEFAULT_HANG_GUARD_MS * 3,
  );
});
