import { randomUUID } from 'node:crypto';
import type { Event } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows/evented';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { RedisStreamsPubSub } from './index';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6381';

// When an event exhausts its delivery budget the evented workflow processor
// publishes workflow.fail. If that publish throws, a Redis redelivery must
// retry it so the caller waiting on workflows-finish still gets the failure.
describe('workflow.fail publish fails after retry exhaustion', () => {
  let mastra: Mastra | undefined;
  let pubsub: RedisStreamsPubSub | undefined;

  afterEach(async () => {
    await mastra?.stopWorkers();
    await pubsub?.close();
    vi.restoreAllMocks();
  });

  it.each([0, 1, 2, 3])(
    'handles %i workflow.fail publish failures',
    async failPublishes => {
      const workflowId = `fail-publish-${randomUUID()}`;
      let executions = 0;
      const workflow = createWorkflow({
        id: workflowId,
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
      })
        .then(
          createStep({
            id: 'work',
            inputSchema: z.object({}),
            outputSchema: z.object({ ok: z.boolean() }),
            execute: async () => {
              executions++;
              return { ok: true };
            },
          }),
        )
        .commit();

      pubsub = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix: workflowId, blockMs: 50 });
      const publish = pubsub.publish.bind(pubsub);
      let failAttempts = 0;
      // Every step-end publish throws, so the step.run event exhausts its
      // delivery budget; then workflow.fail throws `failPublishes` times.
      vi.spyOn(pubsub, 'publish').mockImplementation(async (topic, event, options) => {
        if (topic === 'workflows' && event.type === 'workflow.step.end') {
          throw new Error('injected publish failure for workflow.step.end');
        }
        if (topic === 'workflows' && event.type === 'workflow.fail' && ++failAttempts <= failPublishes) {
          throw new Error('injected publish failure for workflow.fail');
        }
        return publish(topic, event, options);
      });

      mastra = new Mastra({ workflows: { workflow }, storage: new InMemoryStore(), pubsub, logger: false });
      await mastra.startWorkers();

      const finishEvents: Event[] = [];
      await pubsub.subscribe('workflows-finish', async (event, ack) => {
        if (event.runId) finishEvents.push(event);
        await ack?.();
      });

      const run = await mastra.getWorkflow('workflow').createRun();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        run.start({ inputData: {} }),
        new Promise<'HANG'>(resolve => {
          timer = setTimeout(() => resolve('HANG'), 20_000);
        }),
      ]);
      clearTimeout(timer);
      const stored = await (await mastra.getStorage()!.getStore('workflows'))!.loadWorkflowSnapshot({
        workflowName: workflowId,
        runId: run.runId,
      });

      expect(executions).toBe(3);
      if (failPublishes === 3) {
        // Bounded give-up: no more publishes, run left for recoverActiveRuns().
        expect(failAttempts).toBe(3);
        expect(result).toBe('HANG');
        expect(stored?.status).toBe('running');
        return;
      }
      expect(failAttempts).toBe(failPublishes + 1);
      expect(result).not.toBe('HANG');
      expect((result as { status: string }).status).toBe('failed');
      expect(stored?.status).toBe('failed');
      expect(finishEvents.filter(event => event.runId === run.runId).map(event => event.type)).toContain(
        'workflow.fail',
      );
    },
    60_000,
  );
});
