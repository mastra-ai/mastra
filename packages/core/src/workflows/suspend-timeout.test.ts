/**
 * A step can pass a timeout when it suspends. The engine records it on the
 * suspended step result and in the snapshot so a host can expire the run.
 * Nothing is enforced by the engine, and the timeout is dropped again once the
 * step completes.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createWorkflowStateReader } from './state-reader';
import { createStep } from './workflow';

function build() {
  const approvalStep = createStep({
    id: 'approval-step',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ approved: z.boolean() }),
    suspendSchema: z.object({ reason: z.string() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async ({ suspend, resumeData }) => {
      if (!resumeData) {
        return await suspend({ reason: 'manual review' }, { timeout: 60_000 });
      }

      return { approved: resumeData.approved };
    },
  });

  return createWorkflow({
    id: 'timeout-workflow',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ approved: z.boolean() }),
  })
    .then(approvalStep)
    .commit();
}

describe('suspend timeout', () => {
  it('records the timeout on the suspended step result and in the snapshot', async () => {
    const storage = new MockStore();
    const workflow = build();
    new Mastra({ logger: false, storage, workflows: { timeoutWorkflow: workflow } });

    const run = await workflow.createRun();
    const result = await run.start({ inputData: { value: 'test' } });

    expect(result.status).toBe('suspended');
    expect(result.steps['approval-step']).toMatchObject({
      status: 'suspended',
      suspendPayload: { reason: 'manual review' },
      suspendTimeout: 60_000,
    });

    const store = (await storage.getStore('workflows'))!;
    const snapshot = await store.loadWorkflowSnapshot({
      workflowName: 'timeout-workflow',
      runId: run.runId,
    });
    expect(snapshot?.context['approval-step']).toMatchObject({
      status: 'suspended',
      suspendTimeout: 60_000,
    });

    const state = await workflow.getWorkflowRunById(run.runId);
    expect(createWorkflowStateReader(state!).getSuspendedStep()).toMatchObject({
      stepId: 'approval-step',
      suspendTimeout: 60_000,
    });
  });

  it('drops the timeout once the step completes', async () => {
    const storage = new MockStore();
    const workflow = build();
    new Mastra({ logger: false, storage, workflows: { timeoutWorkflow: workflow } });

    const run = await workflow.createRun();
    await run.start({ inputData: { value: 'test' } });

    const final = await run.resume({ step: 'approval-step', resumeData: { approved: true } });

    expect(final.status).toBe('success');
    expect(final.steps['approval-step']).toMatchObject({ status: 'success', output: { approved: true } });
    expect((final.steps['approval-step'] as { suspendTimeout?: number }).suspendTimeout).toBeUndefined();

    const store = (await storage.getStore('workflows'))!;
    const snapshot = await store.loadWorkflowSnapshot({
      workflowName: 'timeout-workflow',
      runId: run.runId,
    });
    expect((snapshot?.context['approval-step'] as { suspendTimeout?: number }).suspendTimeout).toBeUndefined();
  });

  it('leaves the field unset when no timeout is passed', async () => {
    const storage = new MockStore();
    const step = createStep({
      id: 'plain-step',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ ok: z.boolean() }),
      suspendSchema: z.object({ reason: z.string() }),
      resumeSchema: z.object({ ok: z.boolean() }),
      execute: async ({ suspend, resumeData }) => {
        if (!resumeData) {
          return await suspend({ reason: 'no timeout' });
        }
        return { ok: resumeData.ok };
      },
    });
    const workflow = createWorkflow({
      id: 'no-timeout-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ ok: z.boolean() }),
    })
      .then(step)
      .commit();
    new Mastra({ logger: false, storage, workflows: { noTimeoutWorkflow: workflow } });

    const run = await workflow.createRun();
    const result = await run.start({ inputData: { value: 'test' } });

    expect(result.status).toBe('suspended');
    expect(result.steps['plain-step']).toMatchObject({ status: 'suspended' });
    expect((result.steps['plain-step'] as { suspendTimeout?: number }).suspendTimeout).toBeUndefined();
  });
});
