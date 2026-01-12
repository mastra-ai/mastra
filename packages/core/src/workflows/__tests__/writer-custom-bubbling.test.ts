import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '../workflow';

const testStorage = new MockStore();

describe('writer.custom() bubbling', () => {
  const normalStep = createStep({
    id: 'normalStep',
    description: 'Normal step',
    inputSchema: z.object({
      context: z.string(),
    }),
    outputSchema: z.object({
      context: z.string(),
    }),
    execute: async ({ inputData, writer }) => {
      await writer?.write({
        type: 'custom-status',
        data: { customMessage: 'NORMAL_STEP_WRITE' },
      });
      await writer?.custom({
        type: 'custom-status',
        data: { customMessage: 'NORMAL_STEP_CUSTOM' },
      });
      return { context: `${inputData.context}-step` };
    },
  });

  const subStep = createStep({
    id: 'subStep',
    description: 'Sub step',
    inputSchema: z.object({
      context: z.string(),
    }),
    outputSchema: z.object({
      context: z.string(),
    }),
    execute: async ({ inputData, writer }) => {
      await writer?.write({
        type: 'custom-status',
        data: { customMessage: 'SUB_STEP_WRITE' },
      });
      await writer?.custom({
        type: 'custom-status',
        data: { customMessage: 'SUB_STEP_CUSTOM' },
      });
      return { context: `${inputData.context}-step` };
    },
  });

  const subWorkflow = createWorkflow({
    id: 'subWorkflow',
    description: 'Sub workflow',
    inputSchema: z.object({
      context: z.string(),
    }),
    outputSchema: z.object({
      context: z.string(),
    }),
  })
    .then(subStep)
    .commit();

  const loopStep = createStep({
    id: 'loopStep',
    description: 'Loop step',
    inputSchema: z.object({
      context: z.string(),
    }),
    outputSchema: z.object({
      context: z.string(),
    }),
    execute: async ({ inputData, writer }) => {
      await writer?.write({
        type: 'custom-status',
        data: { customMessage: 'LOOP_STEP_WRITE' },
      });
      await writer?.custom({
        type: 'custom-status',
        data: { customMessage: 'LOOP_STEP_CUSTOM' },
      });
      return { context: `${inputData.context}-step` };
    },
  });

  const loopWorkflow = createWorkflow({
    id: 'loopWorkflow',
    description: 'Loop workflow',
    inputSchema: z.object({
      context: z.string(),
    }),
    outputSchema: z.object({
      context: z.string(),
    }),
  })
    .then(loopStep)
    .commit();

  const topWorkflow = createWorkflow({
    id: 'topWorkflow',
    description: 'Top workflow',
    inputSchema: z.object({
      context: z.string(),
    }),
    outputSchema: z.object({
      context: z.string(),
    }),
  })
    .then(normalStep)
    .then(subWorkflow)
    .dountil(loopWorkflow, async ({ inputData }) => inputData.context.length > 15)
    .commit();

  it('should write custom status with data from all steps including sub-workflows and loops', async () => {
    new Mastra({
      logger: false,
      storage: testStorage,
      workflows: { topWorkflow, subWorkflow, loopWorkflow },
    });

    const run = await topWorkflow.createRun();
    const stream = run.stream({
      inputData: {
        context: 'start',
      },
    });

    const events: any[] = [];

    for await (const event of stream) {
      events.push(event);
    }

    // Check for normalStep custom event
    const normalStepCustom = events.find(
      event => event.type === 'custom-status' && event.data?.customMessage === 'NORMAL_STEP_CUSTOM',
    );
    expect(normalStepCustom).toBeDefined();

    // Check for subStep custom event (from nested sub-workflow)
    const subStepCustom = events.find(
      event => event.type === 'custom-status' && event.data?.customMessage === 'SUB_STEP_CUSTOM',
    );
    expect(subStepCustom).toBeDefined();

    // Check for loopStep custom event (from loop)
    const loopStepCustom = events.find(
      event => event.type === 'custom-status' && event.data?.customMessage === 'LOOP_STEP_CUSTOM',
    );
    expect(loopStepCustom).toBeDefined();
  });
});
