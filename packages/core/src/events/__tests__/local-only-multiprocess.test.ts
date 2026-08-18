/**
 * Multi-process integration test for `localOnly` publishes on UnixSocketPubSub.
 *
 * Background: mastracode (and any embedder running multiple Mastra instances against the
 * same SignalsPubSub resource) shares a unix socket broker across processes. The Mastra
 * pubsub proxy tags internal workflow events with `{ localOnly: true }` so they never
 * cross to other processes — but if the underlying transport still serialized the frame
 * over the wire and round-tripped it through the broker, non-serializable values (live
 * methods like `getFullOutput`, function-valued `step.condition`) would be stripped, and
 * foreign-process subscribers would still touch events they don't own. The end-user
 * symptom is a silent multi-instance hang where the active mastracode tab times out with
 * AGENT_GENERATE_MALFORMED_RESULT.
 *
 * This test pins the cross-process contract:
 * - A non-broker process publishing with `localOnly: true` delivers only to its own
 *   local subscribers; the broker process (and any other peer) never sees the event.
 * - The publisher's local subscribers receive the event with all non-serializable
 *   values intact (live function references, class instances), because the localOnly
 *   path bypasses the unix socket entirely.
 * - Non-localOnly publishes from the same client still fan out across the broker as
 *   usual, so this is not a blanket disconnect.
 */
import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let workerExecArgv: string[] = [];

interface WorkerMessage {
  type: 'ready' | 'event-received' | 'status' | 'error';
  data?: any;
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
      reject(new Error(`Timeout waiting for "${type}" from worker`));
    }, timeoutMs);
    child.on('message', handler);
  });
}

describe('UnixSocketPubSub - multi-process localOnly contract', () => {
  let tempDir: string;
  let workerScript: string;
  const children: ChildProcess[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-local-only-mp-'));
    const sourceResolverScript = join(tempDir, 'workspace-source-resolver.mjs');
    const workspaceRoot = join(__dirname, '../../../../..').replace(/\\/g, '/');
    await writeFile(
      sourceResolverScript,
      `
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createWorkspacePackageIndex, resolveWorkspaceSource } from '${workspaceRoot}/packages/_config/src/vitest-source-resolver.js';

const index = createWorkspacePackageIndex('${workspaceRoot}');
registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = resolveWorkspaceSource(specifier, index, context.parentURL ? new URL(context.parentURL).pathname : undefined);
    if (resolved) return { url: pathToFileURL(resolved.path).href + resolved.query, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
`,
    );
    workerExecArgv = process.env.CI ? [] : ['--import', 'tsx', '--import', sourceResolverScript];
    workerScript = join(tempDir, 'worker.mjs');
    const eventsPath = join(
      __dirname,
      process.env.CI ? '../../../dist/events/index.js' : '../unix-socket-pubsub.ts',
    ).replace(/\\/g, '/');
    await writeFile(
      workerScript,
      `
import { UnixSocketPubSub } from '${eventsPath}';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const socketPath = process.argv[2];
await mkdir(dirname(socketPath), { recursive: true });
const pubsub = new UnixSocketPubSub(socketPath);
const received = [];

process.on('message', async (msg) => {
  try {
    if (msg.type === 'subscribe') {
      await pubsub.subscribe(msg.topic, (event) => {
        // Preserve a witness for non-serializable values: did "live" survive?
        const live = event && typeof event.live === 'function' ? event.live() : null;
        received.push({ type: event.type, runId: event.runId, live });
        process.send({ type: 'event-received', data: { type: event.type, runId: event.runId, live, count: received.length } });
      });
      process.send({ type: 'ready', data: { topic: msg.topic } });
    } else if (msg.type === 'publish') {
      const event = { type: msg.eventType, data: msg.data || {}, runId: msg.runId };
      if (msg.withLive) {
        // Carries a function value to verify it survives the in-process delivery path.
        event.live = () => 'live-value-' + msg.runId;
      }
      await pubsub.publish(msg.topic, event, msg.options);
      process.send({ type: 'ready', data: { published: true } });
    } else if (msg.type === 'get-status') {
      process.send({
        type: 'status',
        data: {
          isBroker: pubsub.isBroker,
          remoteClientCount: pubsub.remoteClientCount,
          received: received.map(r => ({ type: r.type, runId: r.runId, live: r.live })),
        },
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
      execArgv: workerExecArgv,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    children.push(child);
    return child;
  }

  async function waitForBrokerAndClient(broker: ChildProcess, client: ChildProcess) {
    broker.send({ type: 'wait-for-status', isBroker: true, remoteClientCount: 1 });
    await waitForMessage(broker, 'status');
    client.send({ type: 'wait-for-status', isBroker: false });
    await waitForMessage(client, 'status');
  }

  const topic = 'workflows';

  it('localOnly publish from a non-broker client never reaches the broker process', async () => {
    const sockPath = join(tempDir, 'pubsub.sock');

    const brokerProc = spawnWorker(sockPath);
    await waitForMessage(brokerProc, 'ready'); // started
    brokerProc.send({ type: 'subscribe', topic });
    await waitForMessage(brokerProc, 'ready'); // subscribed

    const clientProc = spawnWorker(sockPath);
    await waitForMessage(clientProc, 'ready');
    clientProc.send({ type: 'subscribe', topic });
    await waitForMessage(clientProc, 'ready');

    await waitForBrokerAndClient(brokerProc, clientProc);

    // Client publishes with localOnly — broker should NEVER see it.
    const clientReceived = waitForMessage(clientProc, 'event-received');
    clientProc.send({
      type: 'publish',
      topic,
      eventType: 'workflow.start',
      runId: 'local-only-run',
      options: { localOnly: true },
    });
    await waitForMessage(clientProc, 'ready'); // published

    const clientEvent = await clientReceived;
    expect(clientEvent.data.type).toBe('workflow.start');
    expect(clientEvent.data.runId).toBe('local-only-run');

    // Give the broker a generous window to (incorrectly) receive — it should not.
    await new Promise(resolve => setTimeout(resolve, 250));

    brokerProc.send({ type: 'get-status' });
    const brokerStatus = await waitForMessage(brokerProc, 'status');
    expect(brokerStatus.data.received).toEqual([]);

    brokerProc.send({ type: 'close' });
    clientProc.send({ type: 'close' });
  });

  it('localOnly preserves non-serializable values for the publisher; non-localOnly still fans out', async () => {
    const sockPath = join(tempDir, 'pubsub.sock');

    const brokerProc = spawnWorker(sockPath);
    await waitForMessage(brokerProc, 'ready');
    brokerProc.send({ type: 'subscribe', topic });
    await waitForMessage(brokerProc, 'ready');

    const clientProc = spawnWorker(sockPath);
    await waitForMessage(clientProc, 'ready');
    clientProc.send({ type: 'subscribe', topic });
    await waitForMessage(clientProc, 'ready');

    await waitForBrokerAndClient(brokerProc, clientProc);

    // 1. localOnly publish with a live function value — only the client should see it,
    //    and the function value must survive (no JSON round-trip).
    const clientLocalOnly = waitForMessage(clientProc, 'event-received');
    clientProc.send({
      type: 'publish',
      topic,
      eventType: 'workflow.step.run',
      runId: 'live-run',
      withLive: true,
      options: { localOnly: true },
    });
    await waitForMessage(clientProc, 'ready');

    const localOnlyEvent = await clientLocalOnly;
    expect(localOnlyEvent.data.runId).toBe('live-run');
    expect(localOnlyEvent.data.live).toBe('live-value-live-run');

    await new Promise(resolve => setTimeout(resolve, 100));
    brokerProc.send({ type: 'get-status' });
    let brokerStatus = await waitForMessage(brokerProc, 'status');
    expect(brokerStatus.data.received.find((r: any) => r.runId === 'live-run')).toBeUndefined();

    // 2. Plain publish (no localOnly) from the same client — broker should now receive it,
    //    confirming the transport still works for events that legitimately need to fan out.
    const brokerReceived = waitForMessage(brokerProc, 'event-received');
    const clientReceived = waitForMessage(clientProc, 'event-received');
    clientProc.send({
      type: 'publish',
      topic,
      eventType: 'workflow.start',
      runId: 'shared-run',
    });
    await waitForMessage(clientProc, 'ready');

    const [brokerEvent, clientEvent] = await Promise.all([brokerReceived, clientReceived]);
    expect(brokerEvent.data.runId).toBe('shared-run');
    expect(clientEvent.data.runId).toBe('shared-run');

    // Final witness: broker still has no record of the localOnly run, only the shared one.
    brokerProc.send({ type: 'get-status' });
    brokerStatus = await waitForMessage(brokerProc, 'status');
    const runIds = brokerStatus.data.received.map((r: any) => r.runId);
    expect(runIds).not.toContain('live-run');
    expect(runIds).toContain('shared-run');

    brokerProc.send({ type: 'close' });
    clientProc.send({ type: 'close' });
  });
});
