import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { PubSub } from '../../events/pubsub';
import type { Event } from '../../events/types';
import { UnixSocketPubSub } from '../../events/unix-socket-pubsub';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createFlakyPublishPubSub } from './test-utils/flaky-publish-pubsub';
import { createStep, createWorkflow } from '.';

// When an event exhausts its delivery budget, handle() publishes workflow.fail.
// If that publish throws, the failure must still reach the caller waiting on
// workflows-finish instead of leaving run.start() pending forever.
const transports: Array<[string, () => Promise<{ pubsub: PubSub; close: () => Promise<void> }>]> = [
  ['EventEmitterPubSub', async () => ({ pubsub: new EventEmitterPubSub(), close: async () => {} })],
  [
    'UnixSocketPubSub',
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'mastra-fail-publish-'));
      const pubsub = new UnixSocketPubSub(join(dir, 'events.sock'));
      return {
        pubsub,
        close: async () => {
          await pubsub.close();
          await rm(dir, { recursive: true, force: true });
        },
      };
    },
  ],
];

describe.each(transports)(
  'evented workflow: workflow.fail publish fails after retry exhaustion (%s)',
  (_name, makeTransport) => {
    const cleanups: Array<() => Promise<void>> = [];
    afterEach(async () => {
      for (const fn of cleanups.splice(0).reverse()) await fn().catch(() => {});
    });

    function build(id: string) {
      let executions = 0;
      const step = createStep({
        id: 'work',
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
        execute: async () => {
          executions++;
          return { ok: true };
        },
      });
      const workflow = createWorkflow({ id, inputSchema: z.object({}), outputSchema: z.object({ ok: z.boolean() }) })
        .then(step)
        .commit();
      return { workflow, executions: () => executions };
    }

    async function run(failPublishes: number) {
      const { pubsub: inner, close } = await makeTransport();
      cleanups.push(close);
      const id = `fail-publish-${failPublishes}-${Math.random().toString(36).slice(2)}`;
      const { workflow, executions } = build(id);
      // Every `workflow.step.end` publish throws, so the `workflow.step.run`
      // event's dispatch throws on every delivery and exhausts the budget.
      // `workflow.fail` publishes throw the first `failPublishes` times.
      const flaky = createFlakyPublishPubSub(inner, {
        'workflow.step.end': Number.POSITIVE_INFINITY,
        'workflow.fail': failPublishes,
      });
      const mastra = new Mastra({
        workflows: { [id]: workflow },
        storage: new MockStore(),
        pubsub: flaky.pubsub,
        logger: false,
      });
      await mastra.startWorkers();
      cleanups.push(() => mastra.stopWorkers());

      const finishEvents: Event[] = [];
      await flaky.pubsub.subscribe('workflows-finish', async (event, ack) => {
        finishEvents.push(event);
        await ack?.();
      });

      const wfRun = await workflow.createRun();
      const result = await Promise.race([
        wfRun.start({ inputData: {} }),
        new Promise<'HANG'>(resolve => setTimeout(() => resolve('HANG'), 5000)),
      ]);
      const stored = await (await mastra.getStorage()!.getStore('workflows'))!.loadWorkflowSnapshot({
        workflowName: id,
        runId: wfRun.runId,
      });
      return { result, stored, flaky, executions: executions(), finishEvents };
    }

    it('control: a workflow.fail publish that succeeds fails the run', async () => {
      const { result, stored, flaky } = await run(0);
      expect(result).not.toBe('HANG');
      expect((result as any).status).toBe('failed');
      expect(stored?.status).toBe('failed');
      expect(flaky.attempts['workflow.fail']).toBe(1);
    });

    it('fails the run when the first workflow.fail publish throws', async () => {
      const { result, stored, flaky, executions } = await run(1);
      expect(flaky.rejected['workflow.fail']).toBe(1);
      expect(result).not.toBe('HANG');
      expect((result as any).status).toBe('failed');
      expect(stored?.status).toBe('failed');
      // The republish must not rerun the step handler.
      expect(executions).toBe(3);
    });

    it('fails the run when two workflow.fail publishes throw', async () => {
      const { result, stored, flaky } = await run(2);
      expect(flaky.rejected['workflow.fail']).toBe(2);
      expect(result).not.toBe('HANG');
      expect((result as any).status).toBe('failed');
      expect(stored?.status).toBe('failed');
    });

    it('stops republishing after a bounded number of workflow.fail attempts', async () => {
      const { result, stored, flaky, executions } = await run(Number.POSITIVE_INFINITY);
      // Give the transport time to deliver anything else it still would.
      await new Promise(resolve => setTimeout(resolve, 1500));
      expect(flaky.attempts['workflow.fail']).toBe(3);
      expect(executions).toBe(3);
      // The run is left to crash recovery (recoverActiveRuns) in this case.
      expect(result).toBe('HANG');
      expect(stored?.status).toBe('running');
    });
  },
);
