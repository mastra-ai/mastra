/**
 * Multi-process integration tests for per-thread socket isolation.
 *
 * Spawns real child processes to verify the mastracode signal routing boundary:
 * - Socket paths mirror /tmp/mc/<resourceId>/<threadId>.sock
 * - Topics use the real format: agent.thread-stream.<encoded(resourceId\0threadId)>
 * - Solo process has zero serialization overhead (broker with 0 clients)
 * - Two processes on the same thread (same socket) exchange stream parts
 * - Processes on different threads (different sockets) don't receive each other's events
 * - Process disconnect is detected and client count drops
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

/** Encodes a topic in the same format as thread-stream-runtime.ts */
function threadTopic(resourceId: string, threadId: string): string {
  return `agent.thread-stream.${encodeURIComponent(`${resourceId}\0${threadId}`)}`;
}

/** Derives socket path matching mastracode's SignalsPubSub routing */
function threadSocketPath(baseDir: string, resourceId: string, threadId: string): string {
  return join(baseDir, resourceId, `${threadId}.sock`);
}

function waitForMessage(
  child: ChildProcess,
  type: string,
  timeoutMs = 5000,
  predicate: (msg: WorkerMessage) => boolean = () => true,
): Promise<WorkerMessage> {
  return new Promise((resolve, reject) => {
    const handler = (msg: WorkerMessage) => {
      if (msg.type === type && predicate(msg)) {
        clearTimeout(timer);
        child.off('message', handler);
        resolve(msg);
      }
    };
    const timer = setTimeout(() => {
      child.off('message', handler);
      reject(new Error(`Timeout waiting for "${type}" from child`));
    }, timeoutMs);
    child.on('message', handler);
  });
}

describe('UnixSocketPubSub - multi-process per-thread isolation', () => {
  let tempDir: string;
  let workerScript: string;
  const children: ChildProcess[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-mp-test-'));
    // Write a worker script that uses UnixSocketPubSub directly with a given socket path.
    // This mirrors how mastracode routes each thread to its own socket.
    workerScript = join(tempDir, 'worker.mjs');
    const distEventsPath = join(__dirname, '../../../dist/events/index.js').replace(/\\/g, '/');
    await writeFile(
      workerScript,
      `
import { UnixSocketPubSub } from '${distEventsPath}';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const socketPath = process.argv[2];
await mkdir(dirname(socketPath), { recursive: true });
const pubsub = new UnixSocketPubSub(socketPath);
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
      process.send({
        type: 'status',
        data: {
          isBroker: pubsub.isBroker,
          remoteClientCount: pubsub.remoteClientCount,
        }
      });
    } else if (msg.type === 'wait-for-status') {
      const start = Date.now();
      while (Date.now() - start < (msg.timeoutMs || 5000)) {
        const status = { isBroker: pubsub.isBroker, remoteClientCount: pubsub.remoteClientCount };
        if ((msg.isBroker === undefined || status.isBroker === msg.isBroker) && (msg.remoteClientCount === undefined || status.remoteClientCount === msg.remoteClientCount)) {
          process.send({ type: 'status', data: status });
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      process.send({ type: 'error', data: { message: 'Timed out waiting for status' } });
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

  function spawnWorker(socketPath: string): ChildProcess {
    const child = fork(workerScript, [socketPath], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    children.push(child);
    return child;
  }

  async function waitForElectedBroker(workers: ChildProcess[]) {
    const start = Date.now();
    let lastStatuses: WorkerMessage[] = [];
    while (Date.now() - start < 5000) {
      const statusPromises = workers.map(worker => {
        worker.send({ type: 'get-status' });
        return waitForMessage(worker, 'status', 1000);
      });
      lastStatuses = await Promise.all(statusPromises);
      const brokers = lastStatuses.filter(status => status.data.isBroker);
      const clients = lastStatuses.filter(status => !status.data.isBroker);
      if (brokers.length === 1 && brokers[0]?.data.remoteClientCount === clients.length) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error(
      `Timed out waiting for broker election: ${JSON.stringify(lastStatuses.map(status => status.data))}`,
    );
  }

  const resourceId = 'res-abc123';
  const threadA = 'thread-aaaa-1111';
  const threadB = 'thread-bbbb-2222';

  it('solo process: broker with 0 clients, zero serialization overhead', async () => {
    const sockPath = threadSocketPath(tempDir, resourceId, threadA);
    const topic = threadTopic(resourceId, threadA);

    const worker = spawnWorker(sockPath);
    await waitForMessage(worker, 'ready'); // started

    worker.send({ type: 'subscribe', topic });
    await waitForMessage(worker, 'ready'); // subscribed

    const eventPromise = waitForMessage(worker, 'event-received');
    worker.send({ type: 'publish', topic, event: { type: 'stream-part' } });

    const received = await eventPromise;
    expect(received.data.eventType).toBe('stream-part');
    expect(received.data.eventCount).toBe(1);

    // Verify: broker with 0 remote clients = no serialization to wire
    worker.send({ type: 'get-status' });
    const status = await waitForMessage(worker, 'status');
    expect(status.data.isBroker).toBe(true);
    expect(status.data.remoteClientCount).toBe(0);

    worker.send({ type: 'close' });
  });

  it('two processes on same thread (same socket) exchange stream parts', async () => {
    const sockPath = threadSocketPath(tempDir, resourceId, threadA);
    const topic = threadTopic(resourceId, threadA);

    const worker1 = spawnWorker(sockPath);
    const worker2 = spawnWorker(sockPath);
    await waitForMessage(worker1, 'ready');
    await waitForMessage(worker2, 'ready');

    worker1.send({ type: 'subscribe', topic });
    await waitForMessage(worker1, 'ready');
    worker2.send({ type: 'subscribe', topic });
    await waitForMessage(worker2, 'ready');

    // Worker1 publishes — both should receive
    const w1EventPromise = waitForMessage(worker1, 'event-received');
    const w2EventPromise = waitForMessage(worker2, 'event-received');

    worker1.send({ type: 'publish', topic, event: { type: 'stream-part' } });
    await waitForMessage(worker1, 'ready'); // published

    const [w1Event, w2Event] = await Promise.all([w1EventPromise, w2EventPromise]);
    expect(w1Event.data.eventType).toBe('stream-part');
    expect(w2Event.data.eventType).toBe('stream-part');

    worker1.send({ type: 'close' });
    worker2.send({ type: 'close' });
  });

  it('processes on different threads (different sockets) are fully isolated', async () => {
    const sockPathA = threadSocketPath(tempDir, resourceId, threadA);
    const sockPathB = threadSocketPath(tempDir, resourceId, threadB);
    const topicA = threadTopic(resourceId, threadA);
    const topicB = threadTopic(resourceId, threadB);

    const workerA = spawnWorker(sockPathA);
    const workerB = spawnWorker(sockPathB);
    await waitForMessage(workerA, 'ready');
    await waitForMessage(workerB, 'ready');

    workerA.send({ type: 'subscribe', topic: topicA });
    await waitForMessage(workerA, 'ready');
    workerB.send({ type: 'subscribe', topic: topicB });
    await waitForMessage(workerB, 'ready');

    // WorkerA publishes on thread-A
    const wAEventPromise = waitForMessage(workerA, 'event-received');
    workerA.send({ type: 'publish', topic: topicA, event: { type: 'only-for-A' } });
    await waitForMessage(workerA, 'ready');

    const wAEvent = await wAEventPromise;
    expect(wAEvent.data.eventType).toBe('only-for-A');

    // Give workerB time — it should NOT receive anything
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify workerB is on its own isolated socket with 0 clients
    workerB.send({ type: 'get-status' });
    const statusB = await waitForMessage(workerB, 'status');
    expect(statusB.data.isBroker).toBe(true);
    expect(statusB.data.remoteClientCount).toBe(0);

    workerA.send({ type: 'close' });
    workerB.send({ type: 'close' });
  });

  it('broker detects peer disconnect and client count drops to 0', async () => {
    const sockPath = threadSocketPath(tempDir, resourceId, threadA);
    const topic = threadTopic(resourceId, threadA);

    const worker1 = spawnWorker(sockPath);
    const worker2 = spawnWorker(sockPath);
    await waitForMessage(worker1, 'ready');
    await waitForMessage(worker2, 'ready');

    worker1.send({ type: 'subscribe', topic });
    await waitForMessage(worker1, 'ready');
    worker2.send({ type: 'subscribe', topic });
    await waitForMessage(worker2, 'ready');

    // Verify broker has 1 remote client
    worker1.send({ type: 'get-status' });
    let status = await waitForMessage(worker1, 'status');
    expect(status.data.isBroker).toBe(true);
    expect(status.data.remoteClientCount).toBe(1);

    // Disconnect worker2
    worker2.send({ type: 'close' });
    await waitForMessage(worker2, 'ready');

    // Give broker time to detect disconnect
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify broker now has 0 clients — subsequent publishes skip serialization
    worker1.send({ type: 'get-status' });
    status = await waitForMessage(worker1, 'status');
    expect(status.data.remoteClientCount).toBe(0);

    worker1.send({ type: 'close' });
  });

  it('elects a new broker and preserves IPC subscriptions after broker process exits', async () => {
    const sockPath = threadSocketPath(tempDir, resourceId, threadA);
    const topic = threadTopic(resourceId, threadA);

    const worker1 = spawnWorker(sockPath);
    const worker2 = spawnWorker(sockPath);
    const worker3 = spawnWorker(sockPath);
    await waitForMessage(worker1, 'ready');
    await waitForMessage(worker2, 'ready');
    await waitForMessage(worker3, 'ready');

    worker1.send({ type: 'subscribe', topic });
    await waitForMessage(worker1, 'ready');
    worker2.send({ type: 'subscribe', topic });
    await waitForMessage(worker2, 'ready');
    worker3.send({ type: 'subscribe', topic });
    await waitForMessage(worker3, 'ready');

    worker1.send({ type: 'get-status' });
    const brokerStatus = await waitForMessage(worker1, 'status');
    expect(brokerStatus.data.isBroker).toBe(true);
    expect(brokerStatus.data.remoteClientCount).toBe(2);

    worker1.kill('SIGKILL');

    await waitForElectedBroker([worker2, worker3]);

    const w2EventPromise = waitForMessage(
      worker2,
      'event-received',
      5000,
      msg => msg.data?.eventType === 'after-failover',
    );
    const w3EventPromise = waitForMessage(
      worker3,
      'event-received',
      5000,
      msg => msg.data?.eventType === 'after-failover',
    );

    worker3.send({ type: 'publish', topic, event: { type: 'after-failover' } });
    await waitForMessage(worker3, 'ready');

    const [w2Event, w3Event] = await Promise.all([w2EventPromise, w3EventPromise]);
    expect(w2Event.data.eventType).toBe('after-failover');
    expect(w3Event.data.eventType).toBe('after-failover');

    worker2.send({ type: 'close' });
    worker3.send({ type: 'close' });
  });

  it('no split-brain when many clients recover concurrently after broker death', async () => {
    const sockPath = threadSocketPath(tempDir, resourceId, threadA);
    const topic = threadTopic(resourceId, threadA);
    const clientCount = 4;

    const broker = spawnWorker(sockPath);
    await waitForMessage(broker, 'ready');
    broker.send({ type: 'subscribe', topic });
    await waitForMessage(broker, 'ready');

    const clients: ChildProcess[] = [];
    for (let i = 0; i < clientCount; i++) {
      const w = spawnWorker(sockPath);
      await waitForMessage(w, 'ready');
      w.send({ type: 'subscribe', topic });
      await waitForMessage(w, 'ready');
      clients.push(w);
    }

    broker.send({ type: 'get-status' });
    const bStatus = await waitForMessage(broker, 'status');
    expect(bStatus.data.isBroker).toBe(true);
    expect(bStatus.data.remoteClientCount).toBe(clientCount);

    broker.kill('SIGKILL');

    await waitForElectedBroker(clients);

    const eventPromises = clients.map(w =>
      waitForMessage(w, 'event-received', 5000, msg => msg.data?.eventType === 'split-brain-check'),
    );

    const publisher = clients[clients.length - 1]!;
    publisher.send({ type: 'publish', topic, event: { type: 'split-brain-check' } });
    await waitForMessage(publisher, 'ready');

    const results = await Promise.all(eventPromises);
    for (const r of results) {
      expect(r.data.eventType).toBe('split-brain-check');
    }

    for (const w of clients) w.send({ type: 'close' });
  });
});
