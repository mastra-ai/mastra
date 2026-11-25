import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

// Only the evented engine reserves `__state` in step results for workflow state. On the default engine it is
// an ordinary step id, so time travel must not read that step's result as the run's state. (#30022)

describe('timeTravel on the default engine with a step named __state (#30022)', () => {
  it('replays with the state the earlier steps set, not the __state step result', async () => {
    const stateSchema = z.object({ order: z.number().optional() });
    const chargeSawOrder: unknown[] = [];
    let chargeAttempts = 0;

    const save = createStep({
      id: 'save',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      stateSchema,
      execute: async ({ setState }) => {
        await setState({ order: 42 });
        return {};
      },
    });
    const stateNamedStep = createStep({
      id: '__state',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => ({}),
    });
    const charge = createStep({
      id: 'charge',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      stateSchema,
      execute: async ({ state }) => {
        chargeSawOrder.push(state.order);
        if (chargeAttempts++ === 0) {
          throw new Error('card declined');
        }
        return {};
      },
    });

    const workflow = createWorkflow({
      id: 'tt-state-step-id-default',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      stateSchema,
    })
      .then(save)
      .then(stateNamedStep)
      .then(charge)
      .commit();

    const mastra = new Mastra({
      logger: false,
      storage: new InMemoryStore(),
      workflows: { [workflow.id]: workflow },
    });

    const run = await mastra.getWorkflow(workflow.id).createRun();
    const started = await run.start({ inputData: {}, initialState: { order: 7 } });
    expect(started.status).toBe('failed');

    const replayed = await run.timeTravel({ step: 'charge', outputOptions: { includeState: true } });

    expect(replayed.status).toBe('success');
    expect(chargeSawOrder).toEqual([42, 42]);
    expect(replayed.state).toEqual({ order: 42 });
  });
});
