import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

describe('concurrent workflow resume', () => {
  it('executes downstream steps at most once for the same suspended run', async () => {
    let downstreamExecutions = 0;
    let releaseDownstream!: () => void;
    let downstreamStarted!: () => void;
    const downstreamRelease = new Promise<void>(resolve => {
      releaseDownstream = resolve;
    });
    const firstDownstreamExecution = new Promise<void>(resolve => {
      downstreamStarted = resolve;
    });

    const suspendingStep = createStep({
      id: 'suspending-step',
      inputSchema: z.object({}),
      outputSchema: z.object({ resumed: z.boolean() }),
      suspendSchema: z.object({ waiting: z.boolean() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ resumeData, suspend }) => {
        if (!resumeData?.approved) {
          await suspend({ waiting: true });
        }
        return { resumed: true };
      },
    });

    const downstreamStep = createStep({
      id: 'downstream-step',
      inputSchema: z.object({ resumed: z.boolean() }),
      outputSchema: z.object({ completed: z.boolean() }),
      execute: async () => {
        downstreamExecutions += 1;
        downstreamStarted();
        await downstreamRelease;
        return { completed: true };
      },
    });

    const workflow = createWorkflow({
      id: 'concurrent-resume-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ completed: z.boolean() }),
      steps: [suspendingStep, downstreamStep],
    })
      .then(suspendingStep)
      .then(downstreamStep)
      .commit();

    new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { 'concurrent-resume-workflow': workflow },
    });

    const run = await workflow.createRun({ runId: 'concurrent-resume-run' });
    const suspended = await run.start({ inputData: {} });
    expect(suspended.status).toBe('suspended');

    const firstResume = run.resume({
      step: 'suspending-step',
      resumeData: { approved: true },
    });
    const secondResume = run.resume({
      step: 'suspending-step',
      resumeData: { approved: true },
    });

    await firstDownstreamExecution;
    await new Promise(resolve => setTimeout(resolve, 25));
    expect(downstreamExecutions).toBe(1);

    releaseDownstream();
    const results = await Promise.all([firstResume, secondResume]);

    expect(results.map(result => result.status)).toEqual(['success', 'success']);
    expect(downstreamExecutions).toBe(1);
  });

  it('allows another resume after an in-flight resume rejects', async () => {
    const suspendingStep = createStep({
      id: 'suspending-step',
      inputSchema: z.object({}),
      outputSchema: z.object({ resumed: z.boolean() }),
      suspendSchema: z.object({ waiting: z.boolean() }),
      resumeSchema: z.object({ approved: z.literal(true) }),
      execute: async ({ resumeData, suspend }) => {
        if (!resumeData?.approved) {
          await suspend({ waiting: true });
        }
        return { resumed: true };
      },
    });

    const workflow = createWorkflow({
      id: 'resume-rejection-cleanup-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ resumed: z.boolean() }),
      steps: [suspendingStep],
    })
      .then(suspendingStep)
      .commit();

    new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { 'resume-rejection-cleanup-workflow': workflow },
    });

    const run = await workflow.createRun({ runId: 'resume-rejection-cleanup-run' });
    const suspended = await run.start({ inputData: {} });
    expect(suspended.status).toBe('suspended');

    await expect(
      run.resume({
        step: 'suspending-step',
        resumeData: { approved: false } as { approved: true },
      }),
    ).rejects.toThrow();

    const resumed = await run.resume({
      step: 'suspending-step',
      resumeData: { approved: true },
    });

    expect(resumed.status).toBe('success');
  });
});
