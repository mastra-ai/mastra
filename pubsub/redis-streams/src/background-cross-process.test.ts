import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  flushRedis,
  getFreePort,
  killProcess,
  makeStorageDir,
  PACKAGE_DIR,
  REDIS_URL,
  spawnFixture,
  waitFor,
  waitForLine,
  waitForServerHttp,
} from '../test-fixtures/harness';
import type { ManagedProcess } from '../test-fixtures/harness';

const SERVER_ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/app.server.entry.ts');
const BACKGROUND_ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/app.worker.entry.ts');

/**
 * Verifies that BackgroundTaskWorker actually executes statically-registered
 * tools in a remote process.
 *
 * Topology:
 *   process A: HTTP server (MASTRA_WORKERS=false)
 *   process B: standalone BackgroundTaskWorker
 *
 * Tools registered on `Mastra` (here: `echo-tool` from shared.ts) are wired
 * into `BackgroundTaskManager`'s static executor registry. When dispatch
 * crosses Redis to the remote worker, the worker resolves the executor by
 * `payload.toolName` and runs it. Tasks dispatched for a tool name not in
 * the registry still fail with "No executor registered" — that's the
 * documented closure-tool limitation and is asserted by the negative test.
 */
describe('cross-process background tasks', () => {
  let storage: { dir: string; storageUrl: string; cleanup: () => Promise<void> };
  let server: ManagedProcess | undefined;
  let background: ManagedProcess | undefined;
  let serverUrl: string;

  beforeAll(async () => {
    await flushRedis();
    storage = await makeStorageDir('mastra-bg-xp-');
    const port = await getFreePort();
    serverUrl = `http://localhost:${port}`;

    server = spawnFixture({
      entry: SERVER_ENTRY,
      label: 'server',
      env: { MASTRA_WORKERS: 'false', REDIS_URL, STORAGE_URL: storage.storageUrl, PORT: String(port) },
    });
    await waitForLine(server, 'server-ready');
    await waitForServerHttp(serverUrl);

    background = spawnFixture({
      entry: BACKGROUND_ENTRY,
      label: 'background',
      env: { MASTRA_WORKERS: 'backgroundTasks', REDIS_URL, STORAGE_URL: storage.storageUrl },
    });
    await waitForLine(background, 'background-ready');
  }, 60_000);

  afterAll(async () => {
    await killProcess(background);
    await killProcess(server);
    await storage?.cleanup();
  });

  it('dispatch crosses processes and the remote worker executes the registered tool', async () => {
    const { Mastra } = await import('@mastra/core/mastra');
    const { LibSQLStore } = await import('@mastra/libsql');
    const { BackgroundTaskManager } = await import('@mastra/core/background-tasks');
    const { RedisStreamsPubSub } = await import('../src/index.js');
    const { echoTool } = await import('../test-fixtures/shared.js');

    const producerPubSub = new RedisStreamsPubSub({ url: REDIS_URL });
    const producer = new Mastra({
      storage: new LibSQLStore({ id: 'mastra-storage', url: storage.storageUrl }),
      pubsub: producerPubSub,
      tools: { 'echo-tool': echoTool },
      logger: false,
      // No local workers — we want the remote bg worker (process B) to
      // be the only subscriber to the `background-tasks` topic so the
      // dispatch event must cross processes.
      workers: false,
    });

    // Stand up a manager locally just to publish dispatch events. After
    // init we unsubscribe its worker callback from the dispatch topic
    // so the remote process is the *only* consumer in the
    // `background-task-workers` group. This proves the dispatch truly
    // crossed processes and was executed there.
    const manager: any = new BackgroundTaskManager({ enabled: true });
    manager.__registerMastra(producer);
    await manager.init(producerPubSub);
    await producerPubSub.unsubscribe('background-tasks', manager.workerCallback);

    const { task } = await manager.enqueue({
      runId: `xp-bg-run-${Date.now()}`,
      toolName: 'echo-tool',
      toolCallId: `xp-bg-call-${Date.now()}`,
      args: { text: 'cross-process hello' },
      agentId: 'xp-test-agent',
    });

    const storageInstance = producer.getStorage();
    if (!storageInstance) throw new Error('storage not available on producer');
    const bgStore = (await storageInstance.getStore('backgroundTasks')) as
      | { getTask: (id: string) => Promise<any | null> }
      | undefined;
    if (!bgStore) throw new Error('backgroundTasks store not available');

    let finalTask: any;
    await waitFor(async () => {
      finalTask = await bgStore.getTask(task.id);
      return Boolean(finalTask && (finalTask.status === 'completed' || finalTask.status === 'failed'));
    }, 15_000);

    expect(finalTask.status).toBe('completed');
    expect(finalTask.result).toEqual({ echoed: 'cross-process hello' });

    await producer.shutdown();
  }, 30_000);

  it('dispatch for a tool not in the worker registry fails with a clear error', async () => {
    const { Mastra } = await import('@mastra/core/mastra');
    const { LibSQLStore } = await import('@mastra/libsql');
    const { BackgroundTaskManager } = await import('@mastra/core/background-tasks');
    const { RedisStreamsPubSub } = await import('../src/index.js');

    const producerPubSub = new RedisStreamsPubSub({ url: REDIS_URL });
    const producer = new Mastra({
      storage: new LibSQLStore({ id: 'mastra-storage', url: storage.storageUrl }),
      pubsub: producerPubSub,
      logger: false,
      workers: false,
    });

    const manager: any = new BackgroundTaskManager({ enabled: true });
    manager.__registerMastra(producer);
    await manager.init(producerPubSub);
    await producerPubSub.unsubscribe('background-tasks', manager.workerCallback);

    const { task } = await manager.enqueue({
      runId: `xp-bg-unknown-${Date.now()}`,
      toolName: 'never-registered-tool',
      toolCallId: `xp-bg-call-unk-${Date.now()}`,
      args: { foo: 'bar' },
      agentId: 'xp-test-agent',
    });

    const storageInstance = producer.getStorage();
    const bgStore = (await storageInstance!.getStore('backgroundTasks')) as
      | { getTask: (id: string) => Promise<any | null> }
      | undefined;

    let finalTask: any;
    await waitFor(async () => {
      finalTask = await bgStore!.getTask(task.id);
      return Boolean(finalTask && (finalTask.status === 'failed' || finalTask.status === 'completed'));
    }, 15_000);

    expect(finalTask.status).toBe('failed');
    expect(finalTask.error?.message ?? finalTask.error).toMatch(/No executor registered/i);

    await producer.shutdown();
  }, 30_000);

  it('handles a burst of dispatches across processes (each task completes successfully)', async () => {
    const { Mastra } = await import('@mastra/core/mastra');
    const { LibSQLStore } = await import('@mastra/libsql');
    const { BackgroundTaskManager } = await import('@mastra/core/background-tasks');
    const { RedisStreamsPubSub } = await import('../src/index.js');
    const { echoTool } = await import('../test-fixtures/shared.js');

    const producerPubSub = new RedisStreamsPubSub({ url: REDIS_URL });
    const producer = new Mastra({
      storage: new LibSQLStore({ id: 'mastra-storage', url: storage.storageUrl }),
      pubsub: producerPubSub,
      tools: { 'echo-tool': echoTool },
      logger: false,
      workers: false,
    });

    const manager: any = new BackgroundTaskManager({ enabled: true });
    manager.__registerMastra(producer);
    await manager.init(producerPubSub);
    await producerPubSub.unsubscribe('background-tasks', manager.workerCallback);

    const taskIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const { task } = await manager.enqueue({
        runId: `xp-bg-burst-${i}-${Date.now()}`,
        toolName: 'echo-tool',
        toolCallId: `xp-bg-call-burst-${i}-${Date.now()}`,
        args: { text: `burst-${i}` },
        agentId: 'xp-test-agent',
      });
      taskIds.push(task.id);
    }

    const storageInstance = producer.getStorage();
    const bgStore = (await storageInstance!.getStore('backgroundTasks')) as
      | { getTask: (id: string) => Promise<any | null> }
      | undefined;

    await waitFor(async () => {
      for (const id of taskIds) {
        const t = await bgStore!.getTask(id);
        if (!t || (t.status !== 'failed' && t.status !== 'completed')) return false;
      }
      return true;
    }, 20_000);

    for (let i = 0; i < taskIds.length; i++) {
      const t = await bgStore!.getTask(taskIds[i]!);
      expect(t.status).toBe('completed');
      expect(t.result).toEqual({ echoed: `burst-${i}` });
    }

    await producer.shutdown();
  }, 30_000);
});
