import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { isForeignExecutionContext, setExecutionClaim } from '../../agent/durable/execution-fence';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { PublisherQueueLimitError } from '../../events/publisher-queue-limit-error';
import type { PubSub } from '../../events/pubsub';
import type { Event } from '../../events/types';
import { UnixSocketPubSub } from '../../events/unix-socket-pubsub';
import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
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

describe('workflow finish publication failure', () => {
  it('ignores a competing execution’s failed finish for the same run', async () => {
    const pubsub = new EventEmitterPubSub();
    const workflow = createWorkflow({
      id: 'competing-finish',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
    })
      .then(
        createStep({
          id: 'complete',
          inputSchema: z.object({}),
          outputSchema: z.object({ ok: z.boolean() }),
          execute: async () => ({ ok: true }),
        }),
      )
      .commit();
    workflow.options.isForeignExecution = isForeignExecutionContext;
    const mastra = new Mastra({
      workflows: { [workflow.id]: workflow },
      storage: new MockStore(),
      pubsub,
      logger: false,
    });
    await mastra.startWorkers();
    const publish = pubsub.publish.bind(pubsub);
    let receivedForeignFailure = false;
    let ownFinish: Parameters<PubSub['publish']>[1] | undefined;
    pubsub.publish = async (topic, event, options) => {
      if (topic === 'workflows-finish' && event.type === 'workflow.end') {
        ownFinish = { ...event, data: { ...event.data } };
        setExecutionClaim(foreignContext, event.runId, { executionId: 'old' });
        event.data.requestContext = foreignContext.toJSON();
        throw new PublisherQueueLimitError();
      }
      if (topic === 'workflows-finish' && event.type === 'workflow.publish-failed') {
        receivedForeignFailure = true;
        await publish(topic, event, options);
        await publish(topic, ownFinish!);
        return;
      }
      return publish(topic, event, options);
    };
    const foreignContext = new RequestContext();
    const ownContext = new RequestContext();
    try {
      const run = await workflow.createRun();
      setExecutionClaim(ownContext, run.runId, { executionId: 'new' });
      const result = await Promise.race([
        run.start({ inputData: {}, requestContext: ownContext }).then(
          value => value,
          error => (error as Error).message,
        ),
        new Promise<'HANG'>(resolve => setTimeout(() => resolve('HANG'), 5000)),
      ]);
      expect(receivedForeignFailure).toBe(true);
      expect(result).toMatchObject({ status: 'success', result: { ok: true } });
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('resolves a successful run after sustained temporary publisher saturation', async () => {
    const pubsub = new EventEmitterPubSub();
    const publish = pubsub.publish.bind(pubsub);
    let rejected = 0;
    const notifications: string[] = [];
    pubsub.publish = async (topic, event, options) => {
      if (topic === 'workflows-finish' && event.type === 'workflow.end' && rejected < 4) {
        rejected++;
        throw new PublisherQueueLimitError(undefined, async () => {});
      }
      if (topic === 'workflows-finish' && event.type === 'workflow.publish-failed') {
        notifications.push(event.type);
      }
      return publish(topic, event, options);
    };
    const workflow = createWorkflow({
      id: 'temporary-finish-saturation',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
    })
      .then(
        createStep({
          id: 'complete',
          inputSchema: z.object({}),
          outputSchema: z.object({ ok: z.boolean() }),
          execute: async () => ({ ok: true }),
        }),
      )
      .commit();
    const mastra = new Mastra({
      workflows: { [workflow.id]: workflow },
      storage: new MockStore(),
      pubsub,
      logger: false,
    });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      const result = await Promise.race([
        run.start({ inputData: {} }),
        new Promise<'HANG'>(resolve => setTimeout(() => resolve('HANG'), 5000)),
      ]);
      expect(rejected).toBe(4);
      expect(notifications).toEqual([]);
      expect(result).toMatchObject({ status: 'success', result: { ok: true } });
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('rejects the waiting caller when a real socket cannot publish an oversized finish event', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastra-finish-cap-'));
    const path = join(dir, 'events.sock');
    const broker = new UnixSocketPubSub(path);
    await broker.subscribe('broker-ready', () => {});
    const pubsub = new UnixSocketPubSub(path);
    const cappedPublisher = new UnixSocketPubSub(path, { maxPublisherQueuedBytes: 48 * 1024 });
    const published: string[] = [];
    const publish = pubsub.publish.bind(pubsub);
    pubsub.publish = async (topic, event, options) => {
      if (topic === 'workflows-finish') {
        published.push(event.type);
        return cappedPublisher.publish(topic, event, options);
      }
      return publish(topic, event, options);
    };
    const workflow = createWorkflow({
      id: 'oversized-finish',
      inputSchema: z.object({}),
      outputSchema: z.object({ payload: z.string() }),
    })
      .then(
        createStep({
          id: 'large-output',
          inputSchema: z.object({}),
          outputSchema: z.object({ payload: z.string() }),
          execute: async () => ({ payload: 'x'.repeat(32 * 1024) }),
        }),
      )
      .commit();
    const mastra = new Mastra({
      workflows: { [workflow.id]: workflow },
      storage: new MockStore(),
      pubsub,
      logger: false,
    });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      const result = await Promise.race([
        run.start({ inputData: {} }).then(
          () => 'RESOLVED',
          error => (error as Error).message,
        ),
        new Promise<'HANG'>(resolve => setTimeout(() => resolve('HANG'), 5000)),
      ]);
      expect(result).toMatch(/publisher queue limit exceeded/);
      expect(published).toContain('workflow.publish-failed');
    } finally {
      await mastra.stopWorkers();
      await cappedPublisher.close();
      await pubsub.close();
      await broker.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('waits for snapshot deletion before reporting an oversized finish failure', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastra-finish-cleanup-'));
    const path = join(dir, 'events.sock');
    const broker = new UnixSocketPubSub(path);
    await broker.subscribe('broker-ready', () => {});
    const pubsub = new UnixSocketPubSub(path);
    const cappedPublisher = new UnixSocketPubSub(path, { maxPublisherQueuedBytes: 48 * 1024 });
    const publish = pubsub.publish.bind(pubsub);
    pubsub.publish = (topic, event, options) =>
      topic === 'workflows-finish' ? cappedPublisher.publish(topic, event, options) : publish(topic, event, options);

    const storage = new MockStore();
    const workflowsStore = await storage.getStore('workflows');
    const deleteSnapshot = workflowsStore!.deleteWorkflowRunById.bind(workflowsStore);
    let deletionStarted!: () => void;
    const started = new Promise<void>(resolve => {
      deletionStarted = resolve;
    });
    let releaseDeletion!: () => void;
    const released = new Promise<void>(resolve => {
      releaseDeletion = resolve;
    });
    vi.spyOn(workflowsStore!, 'deleteWorkflowRunById').mockImplementation(async args => {
      deletionStarted();
      await released;
      return deleteSnapshot(args);
    });
    const workflow = createWorkflow({
      id: 'oversized-finish-cleanup',
      inputSchema: z.object({}),
      outputSchema: z.object({ payload: z.string() }),
      options: { shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus !== 'success' },
    })
      .then(
        createStep({
          id: 'large-output',
          inputSchema: z.object({}),
          outputSchema: z.object({ payload: z.string() }),
          execute: async () => ({ payload: 'x'.repeat(32 * 1024) }),
        }),
      )
      .commit();
    const mastra = new Mastra({ workflows: { [workflow.id]: workflow }, storage, pubsub, logger: false });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      let settled = false;
      const result = run
        .start({ inputData: {} })
        .then(
          () => 'RESOLVED',
          error => (error as Error).message,
        )
        .finally(() => {
          settled = true;
        });
      await Promise.race([
        started,
        new Promise((_, reject) => setTimeout(() => reject(new Error('delete not started')), 5000)),
      ]);
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(settled).toBe(false);
      releaseDeletion();
      expect(await result).toMatch(/publisher queue limit exceeded/);
      expect(await workflowsStore!.getWorkflowRunById({ runId: run.runId, workflowName: workflow.id })).toBeNull();
    } finally {
      releaseDeletion();
      await mastra.stopWorkers();
      await cappedPublisher.close();
      await pubsub.close();
      await broker.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('defers a compact finish failure until publisher capacity is restored', async () => {
    const pubsub = new EventEmitterPubSub();
    const publish = pubsub.publish.bind(pubsub);
    let resolveCapacity!: () => void;
    const capacity = new Promise<void>(resolve => {
      resolveCapacity = resolve;
    });
    let capacityAvailable = false;
    const releaseCapacity = () => {
      capacityAvailable = true;
      resolveCapacity();
    };
    let attempts = 0;
    let terminalAttempts = 0;
    pubsub.publish = async (topic, event, options) => {
      if (topic === 'workflows-finish' && event.type === 'workflow.end') {
        terminalAttempts++;
        throw new PublisherQueueLimitError();
      }
      if (topic === 'workflows-finish' && event.type === 'workflow.publish-failed') {
        attempts++;
        if (!capacityAvailable) throw new PublisherQueueLimitError(undefined, () => capacity);
      }
      return publish(topic, event, options);
    };
    const workflow = createWorkflow({
      id: 'saturated-finish',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
    })
      .then(
        createStep({
          id: 'complete',
          inputSchema: z.object({}),
          outputSchema: z.object({ ok: z.boolean() }),
          execute: async () => ({ ok: true }),
        }),
      )
      .commit();
    const mastra = new Mastra({
      workflows: { [workflow.id]: workflow },
      storage: new MockStore(),
      pubsub,
      logger: false,
    });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      const result = Promise.race([
        run.start({ inputData: {} }).then(
          () => 'RESOLVED',
          error => (error as Error).message,
        ),
        new Promise<'HANG'>(resolve => setTimeout(() => resolve('HANG'), 5000)),
      ]);
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('No saturated finish notification')), 3000);
        const poll = () => {
          if (attempts) {
            clearTimeout(timeout);
            resolve();
          } else setTimeout(poll, 10);
        };
        poll();
      });
      expect(attempts).toBe(1);
      releaseCapacity();
      expect(await result).toMatch(/publisher queue limit exceeded/);
      expect(attempts).toBe(2);
      expect(terminalAttempts).toBe(1);
    } finally {
      releaseCapacity();
      await mastra.stopWorkers();
    }
  });

  it('advances the parent once when a nested finish waits for publisher capacity', async () => {
    const pubsub = new EventEmitterPubSub();
    const publish = pubsub.publish.bind(pubsub);
    let rejected = 0;
    let finishAttempts = 0;
    let parentHandoffs = 0;
    let parentAdvances = 0;
    let releaseCapacity = () => {};
    const capacity = new Promise<void>(resolve => {
      releaseCapacity = resolve;
    });
    let firstRejection = () => {};
    const rejectedOnce = new Promise<void>(resolve => {
      firstRejection = resolve;
    });
    pubsub.publish = async (topic, event, options) => {
      if (
        topic === 'workflows' &&
        event.type === 'workflow.step.end' &&
        event.data.workflowId === 'parent-saturation' &&
        event.data.nestedRunId
      ) {
        parentHandoffs++;
      }
      if (
        topic === 'workflows-finish' &&
        event.type === 'workflow.end' &&
        event.data.workflowId === 'child-saturation'
      ) {
        finishAttempts++;
        if (rejected < 1) {
          rejected++;
          firstRejection();
          throw new PublisherQueueLimitError(undefined, () => capacity);
        }
      }
      return publish(topic, event, options);
    };
    const child = createWorkflow({
      id: 'child-saturation',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
    })
      .then(
        createStep({
          id: 'child-work',
          inputSchema: z.object({}),
          outputSchema: z.object({ ok: z.boolean() }),
          execute: async () => ({ ok: true }),
        }),
      )
      .commit();
    const parent = createWorkflow({
      id: 'parent-saturation',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
    })
      .then(child)
      .then(
        createStep({
          id: 'parent-work',
          inputSchema: z.object({ ok: z.boolean() }),
          outputSchema: z.object({ ok: z.boolean() }),
          execute: async ({ inputData }) => {
            parentAdvances++;
            return inputData;
          },
        }),
      )
      .commit();
    const mastra = new Mastra({
      workflows: { [parent.id]: parent, [child.id]: child },
      storage: new MockStore(),
      pubsub,
      logger: false,
    });
    await mastra.startWorkers();
    try {
      const run = await parent.createRun();
      const resultPromise = run.start({ inputData: {} });
      await Promise.race([
        rejectedOnce,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('finish was not attempted')), 5000)),
      ]);
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(rejected).toBe(1);
      expect(finishAttempts).toBe(1);
      expect(parentHandoffs).toBe(1);
      releaseCapacity();
      const result = await Promise.race([
        resultPromise,
        new Promise<'HANG'>(resolve => setTimeout(() => resolve('HANG'), 5000)),
      ]);
      expect(rejected).toBe(1);
      expect(finishAttempts).toBe(2);
      expect(result).toMatchObject({ status: 'success', result: { ok: true } });
      expect(parentHandoffs).toBe(1);
      expect(parentAdvances).toBe(1);
    } finally {
      releaseCapacity();
      await mastra.stopWorkers();
    }
  });

  it('does not advance the parent twice when a finish frame hits the publisher cap', async () => {
    const pubsub = new EventEmitterPubSub();
    let rejectedRunId: string | undefined;
    const publishFailedEvents: Array<Omit<Event, 'id' | 'createdAt'>> = [];
    const publish = pubsub.publish.bind(pubsub);
    pubsub.publish = async (topic, event, options) => {
      if (topic === 'workflows-finish' && event.type === 'workflow.end' && !rejectedRunId) {
        rejectedRunId = event.runId;
        throw new PublisherQueueLimitError('UnixSocketPubSub publisher queue limit exceeded');
      }
      if (topic === 'workflows-finish' && event.type === 'workflow.publish-failed') {
        publishFailedEvents.push(event);
      }
      return publish(topic, event, options);
    };
    let parentAdvances = 0;
    const child = createWorkflow({
      id: 'child-cap',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
    })
      .then(
        createStep({
          id: 'child-work',
          inputSchema: z.object({}),
          outputSchema: z.object({ ok: z.boolean() }),
          execute: async () => ({ ok: true }),
        }),
      )
      .commit();
    const parent = createWorkflow({
      id: 'parent-cap',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
    })
      .then(child)
      .then(
        createStep({
          id: 'parent-work',
          inputSchema: z.object({ ok: z.boolean() }),
          outputSchema: z.object({ ok: z.boolean() }),
          execute: async ({ inputData }) => {
            parentAdvances++;
            return inputData;
          },
        }),
      )
      .commit();
    const mastra = new Mastra({
      workflows: { [parent.id]: parent, [child.id]: child },
      storage: new MockStore(),
      pubsub,
      logger: false,
    });
    await mastra.startWorkers();
    try {
      const run = await parent.createRun();
      const result = await Promise.race([
        run.start({ inputData: {} }),
        new Promise<'HANG'>(resolve => setTimeout(() => resolve('HANG'), 5000)),
      ]);
      expect(rejectedRunId).toBeDefined();
      expect(publishFailedEvents).toEqual([
        expect.objectContaining({
          type: 'workflow.publish-failed',
          runId: rejectedRunId,
          data: expect.objectContaining({
            message: 'UnixSocketPubSub publisher queue limit exceeded',
            workflowId: 'child-cap',
            runId: rejectedRunId,
          }),
        }),
      ]);
      expect(result).not.toBe('HANG');
      expect(result).toMatchObject({ status: 'success', result: { ok: true } });
      expect(parentAdvances).toBe(1);
    } finally {
      await mastra.stopWorkers();
    }
  });
});

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
