import { Mastra } from '@mastra/core';
import { MockStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { init } from '../src/index';
import { mastraRunner } from '../src/workflows/index';

/**
 * Engine-specific copy of the shared suite's `resumeMapBranchCondition` test.
 *
 * The shared harness can't run it because the test rebuilds the workflow to
 * simulate a server restart, and the rebuilt instance must be registered on a
 * new `Mastra` bound to the same storage — a step the suite's fixed
 * `registerWorkflows` hook can't repeat mid-test. The default engine skips it
 * in the shared suite for the same reason.
 *
 * What it guards against: branch conditions being re-evaluated on resume with
 * inputs keyed by the map step's auto-generated UUID, which differs between
 * the run that suspended and the rebuilt definitions.
 */

const { createWorkflow, createStep } = init({ runner: mastraRunner });

const conditionSpy = vi.fn();

const suspendingStepAction = vi.fn(async ({ inputData, suspend, resumeData }: any) => {
  if (!resumeData) {
    await suspend({ prompt: 'Please provide an answer' });
    return { result: '' };
  }
  return { result: `processed: ${inputData.mappedValue}, answer: ${resumeData.answer}` };
});

const fallbackStepAction = vi.fn(async ({ inputData }: any) => {
  return { result: `fallback: ${inputData.mappedValue}` };
});

/**
 * Builds fresh workflow instances. Committing re-registers
 * 'mb-map-branch-suspend-workflow' in the global registry, overwriting the
 * previous entry — exactly what happens when a server restarts and re-runs
 * its Mastra entrypoint.
 */
function buildWorkflow() {
  const suspendingStep = createStep({
    id: 'suspending-step',
    inputSchema: z.object({ mappedValue: z.number() }),
    outputSchema: z.object({ result: z.string() }),
    resumeSchema: z.object({ answer: z.string() }),
    execute: suspendingStepAction,
  });

  const nestedWorkflow = createWorkflow({
    id: 'mb-nested-wf-with-suspend',
    inputSchema: z.object({ mappedValue: z.number() }),
    outputSchema: z.object({ result: z.string() }),
  })
    .then(suspendingStep)
    .commit();

  const fallbackStep = createStep({
    id: 'fallback-step',
    inputSchema: z.object({ mappedValue: z.number() }),
    outputSchema: z.object({ result: z.string() }),
    execute: fallbackStepAction,
  });

  const mainWorkflow = createWorkflow({
    id: 'mb-map-branch-suspend-workflow',
    inputSchema: z.object({ value: z.number() }),
    outputSchema: z.object({ result: z.string() }),
  })
    .map(async ({ inputData }) => {
      return { mappedValue: inputData.value * 2 };
    })
    .branch([
      [
        async ({ inputData }) => {
          conditionSpy(inputData);
          return inputData.mappedValue > 10;
        },
        nestedWorkflow,
      ],
      [
        async ({ inputData }) => {
          conditionSpy(inputData);
          return inputData.mappedValue <= 10;
        },
        fallbackStep,
      ],
    ])
    .commit();

  return { mainWorkflow };
}

describe('map + branch resume across a rebuilt workflow', () => {
  it('passes correct inputData to branch conditions and does not re-evaluate them on resume', async () => {
    const sharedStorage = new MockStore();

    const { mainWorkflow } = buildWorkflow();
    new Mastra({
      logger: false,
      storage: sharedStorage,
      workflows: { mapBranch: mainWorkflow },
    });

    const runId = `map-branch-condition-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // value=10 maps to mappedValue=20, which is > 10, so the nested workflow
    // branch runs and suspends.
    const run = await mainWorkflow.createRun({ runId });
    const initialResult = await run.start({ inputData: { value: 10 } });

    expect(initialResult.status).toBe('suspended');
    if (initialResult.status !== 'suspended') return;
    expect(conditionSpy).toHaveBeenCalledWith({ mappedValue: 20 });
    conditionSpy.mockClear();

    // Simulate a server restart: rebuild the definitions (new map UUID) and
    // bind them to a fresh Mastra sharing the same storage.
    const { mainWorkflow: rebuilt } = buildWorkflow();
    new Mastra({
      logger: false,
      storage: sharedStorage,
      workflows: { mapBranch: rebuilt },
    });

    const resumeRun = await rebuilt.createRun({ runId });
    const resumedResult = await resumeRun.resume({
      step: initialResult.suspended[0]!,
      resumeData: { answer: 'hello' },
    });

    // Branch conditions must not be re-evaluated during resume.
    expect(conditionSpy).not.toHaveBeenCalled();

    expect(resumedResult.status).toBe('success');
    if (resumedResult.status !== 'success') return;
    expect(resumedResult.steps['mb-nested-wf-with-suspend']!.status).toBe('success');
    expect(resumedResult.result).toEqual({
      'mb-nested-wf-with-suspend': { result: 'processed: 20, answer: hello' },
    });
  });
});
