/**
 * Regression for https://github.com/mastra-ai/mastra/issues/20225
 *
 * Boot-time recovery of a parent `.parallel([nested…])` must treat terminal
 * child snapshots as authoritative. Parent activeStepsPath can still list
 * completed branches as running after a crash; restarting those children
 * previously threw "This workflow run was not active".
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

describe('parallel nested workflow restart recovery (issue #20225)', () => {
  it('reuses terminal nested parallel branches on parent restart', async () => {
    const storage = new MockStore();
    const mastra = new Mastra({ logger: false, storage });

    const inputSchema = z.object({ value: z.string() });
    const outputSchema = z.object({ branch: z.string(), value: z.string() });

    const mockFastA = vi.fn().mockResolvedValue({ branch: 'fastBranchA', value: 'repro' });
    const mockSlow = vi.fn().mockResolvedValue({ branch: 'slowBranch', value: 'repro' });
    const mockFastC = vi.fn().mockResolvedValue({ branch: 'fastBranchC', value: 'repro' });

    const makeBranch = (id: string, execute: typeof mockFastA) => {
      const step = createStep({
        id: `${id}Step`,
        execute,
        inputSchema,
        outputSchema,
      });
      return createWorkflow({
        id,
        inputSchema,
        outputSchema,
        steps: [step],
      })
        .then(step)
        .commit();
    };

    const fastBranchA = makeBranch('fastBranchA', mockFastA);
    const slowBranch = makeBranch('slowBranch', mockSlow);
    const fastBranchC = makeBranch('fastBranchC', mockFastC);

    const parentWorkflow = createWorkflow({
      id: 'parallelNestedParent',
      inputSchema,
      outputSchema: z.any(),
    })
      .parallel([fastBranchA, slowBranch, fastBranchC])
      .commit();

    parentWorkflow.__registerMastra(mastra);
    fastBranchA.__registerMastra(mastra);
    slowBranch.__registerMastra(mastra);
    fastBranchC.__registerMastra(mastra);

    const workflowsStore = await storage.getStore('workflows');
    expect(workflowsStore).toBeTruthy();

    const runId = `parallel-nested-recovery-${Date.now()}`;
    const startedAt = Date.now();
    const input = { value: 'repro' };

    // Parent crash window: every parallel nested branch still looks active.
    await workflowsStore!.persistWorkflowSnapshot({
      workflowName: parentWorkflow.id,
      runId,
      snapshot: {
        runId,
        status: 'running',
        activePaths: [0],
        activeStepsPath: {
          fastBranchA: [0, 0],
          slowBranch: [0, 1],
          fastBranchC: [0, 2],
        },
        value: {},
        context: {
          input,
          fastBranchA: {
            payload: input,
            startedAt,
            status: 'running',
          },
          slowBranch: {
            payload: input,
            startedAt,
            status: 'running',
          },
          fastBranchC: {
            payload: input,
            startedAt,
            status: 'running',
          },
        },
        serializedStepGraph: (parentWorkflow as any).serializedStepGraph,
        suspendedPaths: {},
        waitingPaths: {},
        resumeLabels: {},
        timestamp: Date.now(),
      },
    });

    const fastResultA = { branch: 'fastBranchA', value: 'repro' };
    const fastResultC = { branch: 'fastBranchC', value: 'repro' };

    await workflowsStore!.persistWorkflowSnapshot({
      workflowName: fastBranchA.id,
      runId,
      snapshot: {
        runId,
        status: 'success',
        result: fastResultA,
        activePaths: [],
        activeStepsPath: {},
        value: {},
        context: {
          input,
          fastBranchAStep: {
            payload: input,
            startedAt,
            status: 'success',
            output: fastResultA,
            endedAt: startedAt + 150,
          },
        },
        serializedStepGraph: (fastBranchA as any).serializedStepGraph,
        suspendedPaths: {},
        waitingPaths: {},
        resumeLabels: {},
        timestamp: Date.now(),
      },
    });

    await workflowsStore!.persistWorkflowSnapshot({
      workflowName: fastBranchC.id,
      runId,
      snapshot: {
        runId,
        status: 'success',
        result: fastResultC,
        activePaths: [],
        activeStepsPath: {},
        value: {},
        context: {
          input,
          fastBranchCStep: {
            payload: input,
            startedAt,
            status: 'success',
            output: fastResultC,
            endedAt: startedAt + 250,
          },
        },
        serializedStepGraph: (fastBranchC as any).serializedStepGraph,
        suspendedPaths: {},
        waitingPaths: {},
        resumeLabels: {},
        timestamp: Date.now(),
      },
    });

    await workflowsStore!.persistWorkflowSnapshot({
      workflowName: slowBranch.id,
      runId,
      snapshot: {
        runId,
        status: 'running',
        activePaths: [0],
        activeStepsPath: { slowBranchStep: [0] },
        value: {},
        context: {
          input,
          slowBranchStep: {
            payload: input,
            startedAt,
            status: 'running',
          },
        },
        serializedStepGraph: (slowBranch as any).serializedStepGraph,
        suspendedPaths: {},
        waitingPaths: {},
        resumeLabels: {},
        timestamp: Date.now(),
      },
    });

    const run = await parentWorkflow.createRun({ runId });
    const restartResult = await run.restart();

    expect(restartResult.status).toBe('success');
    expect(restartResult).toMatchObject({
      status: 'success',
      result: {
        fastBranchA: fastResultA,
        slowBranch: { branch: 'slowBranch', value: 'repro' },
        fastBranchC: fastResultC,
      },
    });

    // Terminal children must not re-execute; only the still-active slow branch may.
    expect(mockFastA).toHaveBeenCalledTimes(0);
    expect(mockFastC).toHaveBeenCalledTimes(0);
    expect(mockSlow).toHaveBeenCalledTimes(1);

    const parentSnap = await workflowsStore!.loadWorkflowSnapshot({
      workflowName: parentWorkflow.id,
      runId,
    });
    expect(parentSnap?.status).toBe('success');
  });

  it('returns terminal snapshot from restart without re-executing steps', async () => {
    const storage = new MockStore();
    const mastra = new Mastra({ logger: false, storage });

    const mockStep = vi.fn().mockResolvedValue({ done: true });
    const step = createStep({
      id: 'done-step',
      execute: mockStep,
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ done: z.boolean() }),
    });
    const workflow = createWorkflow({
      id: 'already-complete-wf',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ done: z.boolean() }),
      steps: [step],
    })
      .then(step)
      .commit();

    workflow.__registerMastra(mastra);
    const workflowsStore = await storage.getStore('workflows');
    const runId = `terminal-restart-${Date.now()}`;

    await workflowsStore!.persistWorkflowSnapshot({
      workflowName: workflow.id,
      runId,
      snapshot: {
        runId,
        status: 'success',
        result: { done: true },
        activePaths: [],
        activeStepsPath: {},
        value: {},
        context: {
          input: { value: 1 },
          'done-step': {
            payload: { value: 1 },
            startedAt: Date.now(),
            status: 'success',
            output: { done: true },
            endedAt: Date.now(),
            // Internal bookkeeping that fmtReturnValue strips from live results —
            // the reconstructed terminal result must strip it too.
            __state: { internal: true },
            metadata: { nestedRunId: 'internal-nested-run-id', userField: 'kept' },
          },
        },
        serializedStepGraph: (workflow as any).serializedStepGraph,
        suspendedPaths: {},
        waitingPaths: {},
        resumeLabels: {},
        timestamp: Date.now(),
      },
    });

    const run = await workflow.createRun({ runId });
    const result = await run.restart();

    expect(result.status).toBe('success');
    expect(result).toMatchObject({ status: 'success', result: { done: true } });
    expect(mockStep).toHaveBeenCalledTimes(0);

    // Reconstructed steps must strip internal bookkeeping, matching fmtReturnValue.
    const doneStep = result.steps['done-step'] as Record<string, unknown>;
    expect(doneStep).not.toHaveProperty('__state');
    expect(doneStep.metadata).toEqual({ userField: 'kept' });
  });
});
