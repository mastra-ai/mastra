import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

describe('evented workflow subscriber isolation', () => {
  it('completes once when a workflows subscriber throws synchronously', async () => {
    const error = vi.fn();
    const pubsub = new EventEmitterPubSub(undefined, {
      logger: { error, warn: vi.fn(), info: vi.fn(), debug: vi.fn() } as any,
    });
    const execute = vi.fn(async () => ({ result: 'done' }));
    const step = createStep({
      id: 'step',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      execute,
    });
    const workflow = createWorkflow({
      id: 'subscriber-isolation-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    })
      .then(step)
      .commit();
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      pubsub,
      workflows: { [workflow.id]: workflow },
    });
    const subscriberError = new Error('sync workflows subscriber boom');

    await pubsub.subscribe('workflows', () => {
      throw subscriberError;
    });
    await mastra.startWorkers();

    try {
      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('success');
      expect(execute).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith('[EventEmitterPubSub] subscriber failed for workflows', subscriberError);
    } finally {
      await mastra.stopWorkers();
    }
  });
});
