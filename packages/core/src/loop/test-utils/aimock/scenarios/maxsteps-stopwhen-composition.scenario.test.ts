import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression: a user-provided `stopWhen` must still be honored when `maxSteps`
 * is also set. `maxSteps` is sugar for `stepCountIs(maxSteps)`, and the loop
 * composes stop conditions with OR, so the two should combine rather than the
 * maxSteps cap replacing the user's condition.
 */
describeForAllEngines(
  'AIMock loop scenario: maxSteps + stopWhen composition',
  engine => {
    const getMock = useLoopScenarioAimock();

    const tickTool = () =>
      createTool({
        id: 'tick',
        description: 'Advance a counter.',
        inputSchema: z.object({}),
        outputSchema: z.object({ count: z.number() }),
        execute: async () => ({ count: 1 }),
      });

    it('honors a custom stopWhen even when maxSteps is also set', async () => {
      let stepCount = 0;

      const { requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Keep ticking.',
        tools: { tick: tickTool() },
        maxSteps: 10,
        stopWhen: () => {
          stepCount++;
          return stepCount >= 2;
        },
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: {} }] });
        },
      });

      // The custom stopWhen fires at step 2, so the loop must stop at 2 requests,
      // not run to the maxSteps cap of 10.
      expect(requests).toHaveLength(2);
    });

    it('still caps at maxSteps when no custom stopWhen is given', async () => {
      const { requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Keep ticking.',
        tools: { tick: tickTool() },
        maxSteps: 3,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: {} }] });
        },
      });

      expect(requests).toHaveLength(3);
    });
  },
  { skip: ['durable'] },
);
