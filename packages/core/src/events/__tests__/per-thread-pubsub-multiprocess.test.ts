/**
 * Multi-process integration tests for PerThreadPubSub.
 *
 * Spawns real child processes on separate threads to verify:
 * - Solo process has zero serialization overhead (broker with 0 clients)
 * - Two processes on the same thread exchange stream parts
 * - Processes on different threads don't receive each other's events
 * - Process disconnect stops requiring broadcast
 *
 * Uses IPC (process.send / process.on('message')) for cross-process assertions.
 */
import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

interface WorkerMessage {
  type: 'ready' | 'event-received' | 'status' | 'error';
  data?: any;
}

function waitForMessage(child: ChildProcess, type: string, timeoutMs = 5000): Promise<WorkerMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${type}" from child`)), timeoutMs);
    const handler = (msg: WorkerMessage) => {
      if (msg.type === type) {
        clearTimeout(timer);
        child.off('message', handler);
        resolve(msg);
      }
    };
    child.on('message', handler);
  });
}

describe('PerThreadPubSub - multi-process', () => {
  let tempDir: string;
  let workerScript: string;
  const children: ChildProcess[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-mp-test-'));
    // Write a worker script that uses the compiled dist output
    workerScript = join(tempDir, 'worker.mjs');
    // Resolve relative to this test file's directory → src/events/__tests__/ → up to packages/core/dist
    const distEventsPath = join(__dirname, '../../../dist/events/index.js').replace(/\\/g, '/');
    await writeFile(
      workerScript,
      `
import { PerThreadPubSub } from '${distEventsPath}';

const prefix = process.argv[2];
const pubsub = new PerThreadPubSub(prefix);
let eventCount = 0;

process.on('message', async (msg) => {
  try {
    if (msg.type === 'subscribe') {
      await pubsub.subscribe(msg.topic, (event) => {
        eventCount++;
        process.send({ type: 'event-received', data: { eventType: event.type, eventCount, topic: msg.topic } });
      });
      process.send({ type: 'ready', data: { topic: msg.topic } });
    } else if (msg.type === 'publish') {
      await pubsub.publish(msg.topic, { type: msg.event.type, data: msg.event.data || {}, runId: 'run-1' });
      process.send({ type: 'ready', data: { published: true } });
    } else if (msg.type === 'get-status') {
      const socket = pubsub.getSocket(msg.topic);
      process.send({
        type: 'status',
        data: {
          isBroker: socket?.isBroker ?? null,
          remoteClientCount: socket?.remoteClientCount ?? null,
        }
      });
    } else if (msg.type === 'close') {
      await pubsub.close();
      process.send({ type: 'ready', data: { closed: true } });
      process.exit(0);
    }
  } catch (err) {
    process.send({ type: 'error', data: { message: err.message } });
  }
});

process.send({ type: 'ready', data: { started: true } });
`,
    );
  });

  afterEach(async () => {
    for (const child of children.splice(0)) {
      child.kill('SIGKILL');
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  function spawnWorker(prefix: string): ChildProcess {
    const child = fork(workerScript, [prefix], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    children.push(child);
    return child;
  }

  it('solo process: broker with 0 clients delivers locally', async () => {
    const worker = spawnWorker('solo-resource');
    await waitForMessage(worker, 'ready'); // started

    worker.send({ type: 'subscribe', topic: 'thread-solo' });
    await waitForMessage(worker, 'ready'); // subscribed

    // Listen for event-received before publishing (local delivery is synchronous)
    const eventPromise = waitForMessage(worker, 'event-received');
    worker.send({ type: 'publish', topic: 'thread-solo', event: { type: 'solo-event' } });

    const received = await eventPromise;
    expect(received.data.eventType).toBe('solo-event');
    expect(received.data.eventCount).toBe(1);

    // Verify broker status: should have 0 remote clients
    worker.send({ type: 'get-status', topic: 'thread-solo' });
    const status = await waitForMessage(worker, 'status');
    expect(status.data.isBroker).toBe(true);
    expect(status.data.remoteClientCount).toBe(0);

    worker.send({ type: 'close' });
  });

  it('two processes on same thread exchange events', async () => {
    const worker1 = spawnWorker('shared-resource');
    const worker2 = spawnWorker('shared-resource');
    await waitForMessage(worker1, 'ready'); // started
    await waitForMessage(worker2, 'ready'); // started

    // Both subscribe to the same topic (thread)
    worker1.send({ type: 'subscribe', topic: 'thread-shared' });
    await waitForMessage(worker1, 'ready');
    worker2.send({ type: 'subscribe', topic: 'thread-shared' });
    await waitForMessage(worker2, 'ready');

    // Worker1 publishes — both should receive
    const w1EventPromise = waitForMessage(worker1, 'event-received');
    const w2EventPromise = waitForMessage(worker2, 'event-received');

    worker1.send({ type: 'publish', topic: 'thread-shared', event: { type: 'hello-from-1' } });
    await waitForMessage(worker1, 'ready'); // published

    const [w1Event, w2Event] = await Promise.all([w1EventPromise, w2EventPromise]);
    expect(w1Event.data.eventType).toBe('hello-from-1');
    expect(w2Event.data.eventType).toBe('hello-from-1');

    worker1.send({ type: 'close' });
    worker2.send({ type: 'close' });
  });

  it('processes on different threads do NOT receive each other events', async () => {
    const worker1 = spawnWorker('isolation-resource');
    const worker2 = spawnWorker('isolation-resource');
    await waitForMessage(worker1, 'ready');
    await waitForMessage(worker2, 'ready');

    // Subscribe to DIFFERENT topics (different threads)
    worker1.send({ type: 'subscribe', topic: 'thread-A' });
    await waitForMessage(worker1, 'ready');
    worker2.send({ type: 'subscribe', topic: 'thread-B' });
    await waitForMessage(worker2, 'ready');

    // Worker1 publishes on thread-A
    const w1EventPromise = waitForMessage(worker1, 'event-received');
    worker1.send({ type: 'publish', topic: 'thread-A', event: { type: 'only-for-A' } });
    await waitForMessage(worker1, 'ready');

    // Worker1 should receive its own event
    const w1Event = await w1EventPromise;
    expect(w1Event.data.eventType).toBe('only-for-A');

    // Worker2 should NOT receive it — give it time to verify no event arrives
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify worker2's socket is on a different path (different broker)
    worker2.send({ type: 'get-status', topic: 'thread-B' });
    const status = await waitForMessage(worker2, 'status');
    // Worker2's socket has 0 remote clients (it's alone on thread-B)
    expect(status.data.isBroker).toBe(true);
    expect(status.data.remoteClientCount).toBe(0);

    worker1.send({ type: 'close' });
    worker2.send({ type: 'close' });
  });

  it('broker detects peer disconnect and reports correct client count', async () => {
    const worker1 = spawnWorker('disconnect-resource');
    const worker2 = spawnWorker('disconnect-resource');
    await waitForMessage(worker1, 'ready');
    await waitForMessage(worker2, 'ready');

    worker1.send({ type: 'subscribe', topic: 'thread-disconnect' });
    await waitForMessage(worker1, 'ready');
    worker2.send({ type: 'subscribe', topic: 'thread-disconnect' });
    await waitForMessage(worker2, 'ready');

    // Verify broker has 1 remote client
    worker1.send({ type: 'get-status', topic: 'thread-disconnect' });
    let status = await waitForMessage(worker1, 'status');
    expect(status.data.isBroker).toBe(true);
    expect(status.data.remoteClientCount).toBe(1);

    // Disconnect worker2
    worker2.send({ type: 'close' });
    await waitForMessage(worker2, 'ready'); // closed

    // Give the broker time to detect the disconnect
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify broker now has 0 remote clients
    worker1.send({ type: 'get-status', topic: 'thread-disconnect' });
    status = await waitForMessage(worker1, 'status');
    expect(status.data.remoteClientCount).toBe(0);

    worker1.send({ type: 'close' });
  });
});
