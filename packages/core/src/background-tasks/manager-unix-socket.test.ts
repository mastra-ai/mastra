import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { UnixSocketPubSub } from '../events/unix-socket-pubsub';
import { Mastra } from '../mastra';
import { MockStore } from '../storage';
import { BackgroundTaskManager } from './manager';

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

    await vi.waitFor(async () => {
      await expect(manager.getTask(task.id)).resolves.toMatchObject({ status: 'completed', result: 'unix-result' });
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

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

    await vi.waitFor(async () => {
      await expect(originManager.getTask(task.id)).resolves.toMatchObject({
        status: 'completed',
        result: 'origin-result',
      });
    });
    expect(originExecute).toHaveBeenCalledTimes(1);
    expect(remoteExecute).not.toHaveBeenCalled();
  });
});
