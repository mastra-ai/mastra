/**
 * AIMock Scenario: step-finish continuation flag
 *
 * Output processors and channels read `stepResult.isContinued` on each
 * step-finish chunk to know whether another step follows. The step a run
 * stops on must report `false`, whatever stopped it.
 *
 * Asserts:
 * - a tool-calling step stopped by maxSteps reports isContinued false
 * - a completed text step keeps isContinued false when its output step
 *   processor aborts the run
 *
 * stopWhen and iteration feedback are covered by parity-stop-when and
 * parity-default-loop-contracts.
 */

import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { Processor } from '../../../../processors/index';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

function recordStepFinishes() {
  const stepFinishes: unknown[] = [];
  const recorder: Processor = {
    id: 'step-finish-recorder',
    async processOutputStream({ part }) {
      if (part.type === 'step-finish') {
        stepFinishes.push(part.payload.stepResult.isContinued);
      }
      return part;
    },
  };
  return { stepFinishes, recorder };
}

describeForAllEngines('AIMock loop scenario: step-finish continuation flag', engine => {
  const getMock = useLoopScenarioAimock();

  it('reports false when maxSteps stops a tool-calling step', async () => {
    const { stepFinishes, recorder } = recordStepFinishes();
    const step = createTool({
      id: 'step',
      description: 'Completes one step.',
      inputSchema: z.object({}),
      execute: async () => ({ done: true }),
    });

    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Run it.',
      tools: { step },
      maxSteps: 1,
      outputProcessors: [recorder],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'call_step', name: 'step', arguments: {} }] });
      },
    });

    expect(requests).toHaveLength(1);
    expect(stepFinishes).toEqual([false]);
  });

  it('reports false for a completed text step when its output step processor aborts the run', async () => {
    const { stepFinishes, recorder } = recordStepFinishes();
    const abortController = new AbortController();
    const abortAfterOutputStep: Processor = {
      id: 'abort-after-output-step',
      async processOutputStep({ messageList }) {
        abortController.abort();
        return messageList;
      },
    };

    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Run it.',
      abortSignal: abortController.signal,
      outputProcessors: [recorder, abortAfterOutputStep],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'first' });
      },
    });

    expect(requests).toHaveLength(1);
    expect(stepFinishes).toEqual([false]);
  });
});
