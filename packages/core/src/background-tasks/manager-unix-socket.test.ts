import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { UnixSocketPubSub } from '../events/unix-socket-pubsub';
import { Mastra } from '../mastra';
import { MockStore } from '../storage';
import { createBackgroundTask } from './create';
import { BackgroundTaskManager } from './manager';

const WAIT_TIMEOUT_MS = 10_000;

describe('BackgroundTaskManager with UnixSocketPubSub', () => {
  const managers: BackgroundTaskManager[] = [];
  const mastras: Mastra[] = [];
  const pubsubs: UnixSocketPubSub[] = [];
  let tempDir: string | undefined;

  afterEach(async () => {
    await Promise.allSettled(managers.splice(0).map(manager => manager.shutdown()));
    await Promise.allSettled(pubsubs.splice(0).map(pubsub => pubsub.close()));
    await Promise.allSettled(mastras.splice(0).map(mastra => mastra.stopWorkers()));
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('dispatches a task through UnixSocketPubSub', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-background-task-uds-'));
    const pubsub = new UnixSocketPubSub(join(tempDir, 'events.sock'));
    const storage = new MockStore();
    const mastra = new Mastra({ logger: false, storage });
    const manager = new BackgroundTaskManager({ enabled: true, defaultTimeoutMs: 5_000 });
    pubsubs.push(pubsub);
    mastras.push(mastra);
    managers.push(manager);

    manager.__registerMastra(mastra);
    await mastra.startWorkers();
    await manager.init(pubsub);

    const execute = vi.fn().mockResolvedValue('unix-result');
    manager.registerStaticExecutor('read-only-tool', { execute });
    const { task } = await manager.enqueue({
      toolName: 'read-only-tool',
      toolCallId: 'call-1',
      args: {},
      agentId: 'agent-1',
      runId: 'run-1',
    });

    await vi.waitFor(
      async () => {
        await expect(manager.getTask(task.id)).resolves.toMatchObject({ status: 'completed', result: 'unix-result' });
      },
      { timeout: WAIT_TIMEOUT_MS },
    );
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rejects invocation-bound producer work without stranding it or blocking portable work (#31089)', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-background-task-portable-'));
    const socketPath = join(tempDir, 'events.sock');
    const storage = new MockStore();
    const producerMastra = new Mastra({ logger: false, storage, workers: false });
    const workerMastra = new Mastra({ logger: false, storage });
    const producerPubsub = new UnixSocketPubSub(socketPath);
    const workerPubsub = new UnixSocketPubSub(socketPath);
    const producer = new BackgroundTaskManager({
      enabled: true,
      mode: 'producer',
      globalConcurrency: 1,
      recoverStaleTasksOnStart: false,
    });
    const worker = new BackgroundTaskManager({ enabled: true, mode: 'worker', recoverStaleTasksOnStart: false });
    managers.push(producer, worker);
    mastras.push(producerMastra, workerMastra);
    pubsubs.push(producerPubsub, workerPubsub);
    producer.__registerMastra(producerMastra);
    worker.__registerMastra(workerMastra);
    await workerMastra.startWorkers();
    await Promise.all([producer.init(producerPubsub), worker.init(workerPubsub)]);
    const execute = vi.fn().mockResolvedValue('remote-result');
    const localExecute = vi.fn().mockResolvedValue('local-result');
    worker.registerStaticExecutor('portable-tool', { execute });

    for (const options of [undefined, { pinToWorker: true }]) {
      await expect(
        producer.enqueue(
          { toolName: 'portable-tool', toolCallId: 'bound', args: {}, agentId: 'agent', runId: 'bound' },
          { executor: { execute: localExecute } },
          options,
        ),
      ).rejects.toThrow(/producer.*local.*worker/i);
      expect(await producer.listTasks({})).toMatchObject({ tasks: [], total: 0 });
    }
    expect(localExecute).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();

    const { task } = await producer.enqueue({
      toolName: 'portable-tool',
      toolCallId: 'portable',
      args: {},
      agentId: 'agent',
      runId: 'portable',
    });
    await vi.waitFor(
      async () => {
        expect(await producer.getTask(task.id)).toMatchObject({ status: 'completed', result: 'remote-result' });
      },
      { timeout: WAIT_TIMEOUT_MS },
    );
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each(['pending', 'running', 'suspended'] as const)(
    'refuses to reattach producer closures to %s work without changing persisted state (#31089)',
    async status => {
      tempDir = await mkdtemp(join(tmpdir(), 'mastra-background-task-reattach-'));
      const pubsub = new UnixSocketPubSub(join(tempDir, 'events.sock'));
      const storage = new MockStore();
      const mastra = new Mastra({ logger: false, storage, workers: false });
      const producer = new BackgroundTaskManager({ enabled: true, mode: 'producer', recoverStaleTasksOnStart: false });
      managers.push(producer);
      mastras.push(mastra);
      pubsubs.push(pubsub);
      producer.__registerMastra(mastra);
      await storage.init();
      await producer.init(pubsub);

      const identity = { toolName: 'bound-tool', toolCallId: 'call-1', agentId: 'agent', runId: 'run-1' };
      const store = (await storage.getStore('backgroundTasks'))!;
      await store.createTask({
        ...identity,
        id: 'existing-task',
        status,
        args: {},
        ownerId: 'original-worker',
        retryCount: 1,
        maxRetries: 2,
        timeoutMs: 5_000,
        createdAt: new Date(),
        leaseExpiresAt: new Date(Date.now() + 60_000),
      });
      const original = await producer.getTask('existing-task');
      const execute = vi.fn().mockResolvedValue('must-not-run');
      const context = { executor: { execute } };
      const handle = createBackgroundTask(producer, { ...identity, args: {}, context });

      expect(() => producer.registerTaskContext('existing-task', context)).toThrow(/producer.*local.*worker/i);
      await expect(handle.checkIfExisting(identity)).rejects.toThrow(/producer.*local.*worker/i);
      if (status === 'suspended') {
        await expect(handle.checkIfSuspended(identity)).resolves.toBe(true);
        await expect(handle.resume({ approved: true })).rejects.toThrow(/producer.*local.*worker/i);
      } else {
        await expect(handle.checkIfRunning(identity)).resolves.toBe(status === 'running');
        await expect(handle.restart()).rejects.toThrow(/producer.*local.*worker/i);
      }
      expect(await producer.getTask('existing-task')).toEqual(original);
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('keeps invocation-bound executors on their originating manager', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-background-task-affinity-'));
    const socketPath = join(tempDir, 'events.sock');
    const storage = new MockStore();
    const originMastra = new Mastra({ logger: false, storage });
    const remoteMastra = new Mastra({ logger: false, storage });
    const originPubsub = new UnixSocketPubSub(socketPath);
    const remotePubsub = new UnixSocketPubSub(socketPath);
    const originManager = new BackgroundTaskManager({ enabled: true, recoverStaleTasksOnStart: false });
    const remoteManager = new BackgroundTaskManager({ enabled: true, recoverStaleTasksOnStart: false });
    managers.push(originManager, remoteManager);
    mastras.push(originMastra, remoteMastra);
    pubsubs.push(originPubsub, remotePubsub);

    originManager.__registerMastra(originMastra);
    remoteManager.__registerMastra(remoteMastra);
    await Promise.all([originMastra.startWorkers(), remoteMastra.startWorkers()]);
    await Promise.all([originManager.init(originPubsub), remoteManager.init(remotePubsub)]);

    const originExecute = vi.fn().mockResolvedValue('origin-result');
    const remoteExecute = vi.fn().mockResolvedValue('remote-result');
    remoteManager.registerStaticExecutor('read-only-tool', { execute: remoteExecute });

    const { task } = await originManager.enqueue(
      { toolName: 'read-only-tool', toolCallId: 'call-1', args: {}, agentId: 'agent-1', runId: 'run-1' },
      { executor: { execute: originExecute } },
    );

    await vi.waitFor(
      async () => {
        await expect(originManager.getTask(task.id)).resolves.toMatchObject({
          status: 'completed',
          result: 'origin-result',
        });
      },
      { timeout: WAIT_TIMEOUT_MS },
    );
    expect(originExecute).toHaveBeenCalledTimes(1);
    expect(remoteExecute).not.toHaveBeenCalled();
  });
});
