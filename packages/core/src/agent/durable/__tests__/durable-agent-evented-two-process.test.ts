/**
 * Real two-process topology for an EventedAgent: the dedicated-workers deploy.
 *
 * - Producer process: `MASTRA_WORKERS=false` (the API container). It calls
 *   `agent.stream()` and has no workflow consumer of its own.
 * - Worker process: the same Mastra setup with `startWorkers()`. It must pick up
 *   the run's `workflow.start`, execute the loop, and send the finish back.
 *
 * Both processes share a `UnixSocketPubSub`. Unlike `EventEmitterPubSub`, it
 * keeps `localOnly` publishes inside the publishing process, so this test
 * catches the durable loop's events being tagged `localOnly` (COR-1389): the
 * run would sit in `running` forever with no error in either process.
 *
 * The worker checks that the producer's execution still owns the run before
 * and after each step, so the run's claim must be visible to both processes.
 *
 * Children import the built `dist`, matching `events/__tests__/local-only-multiprocess.test.ts`.
 */
import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

interface ChildMessage {
  type: 'ready' | 'model-called' | 'tool-called' | 'stream-done' | 'status' | 'error';
  data?: any;
}

function waitForMessage(child: ChildProcess, type: ChildMessage['type'], timeoutMs = 10_000): Promise<ChildMessage> {
  return new Promise((resolve, reject) => {
    const handler = (msg: ChildMessage) => {
      if (msg.type === 'error') {
        clearTimeout(timer);
        child.off('message', handler);
        reject(new Error(`child error: ${msg.data?.message}`));
      } else if (msg.type === type) {
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

const distPath = (rel: string) => join(__dirname, '../../../../dist', rel).replace(/\\/g, '/');

const CHILD_SCRIPT = `
import { UnixSocketPubSub } from '${distPath('events/index.js')}';
import { Mastra } from '${distPath('mastra/index.js')}';
import { Agent } from '${distPath('agent/index.js')}';
import { createEventedAgent } from '${distPath('agent/durable/index.js')}';
import { createTool } from '${distPath('tools/index.js')}';
import { InMemoryStore } from '${distPath('storage/index.js')}';

const [socketPath, role] = process.argv.slice(2);

function streamOf(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

// Tool call on the first turn, text on the second: a full multi-step loop.
let modelCalls = 0;
const model = {
  specificationVersion: 'v2',
  provider: 'mock',
  modelId: 'mock-model',
  supportedUrls: {},
  async doGenerate() {
    throw new Error('doGenerate not used');
  },
  async doStream() {
    modelCalls++;
    process.send({ type: 'model-called', data: { role, call: modelCalls } });
    const head = [
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id: 'id-' + modelCalls, modelId: 'mock-model', timestamp: new Date(0) },
    ];
    const body =
      modelCalls === 1
        ? [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'whereAmI', input: '{}', providerExecuted: false },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ]
        : [
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'All done' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 9, totalTokens: 19 } },
          ];
    return { stream: streamOf([...head, ...body]), rawCall: { rawPrompt: null, rawSettings: {} } };
  },
};

const whereAmI = createTool({
  id: 'whereAmI',
  description: 'Reports which process executed the tool',
  execute: async () => {
    process.send({ type: 'tool-called', data: { role } });
    return 'executed-in-' + role;
  },
});

const agent = new Agent({ id: 'two-process-agent', name: 'two-process-agent', instructions: 'Use tools.', model, tools: { whereAmI } });
const evented = createEventedAgent({ agent });
const pubsub = new UnixSocketPubSub(socketPath);
// Each process has its own in-memory store, so storage can't carry the run's
// ownership claim to the worker. Turn storage fencing off so the claim lives in
// the shared pubsub lease, which both processes can check.
const storage = new InMemoryStore();
for (const domain of ['workflows', 'memory']) {
  (await storage.getStore(domain)).supportsRunFencing = () => false;
}
const mastra = new Mastra({
  logger: false,
  storage,
  pubsub,
  agents: { [evented.id]: evented },
});

process.on('message', async msg => {
  try {
    if (msg.type === 'start-workers') {
      await mastra.startWorkers();
      process.send({ type: 'ready', data: { workers: true } });
    } else if (msg.type === 'wait-for-status') {
      const start = Date.now();
      while (Date.now() - start < 5000) {
        if (pubsub.isBroker === msg.isBroker && (msg.remoteClientCount === undefined || pubsub.remoteClientCount === msg.remoteClientCount)) {
          process.send({ type: 'status', data: { isBroker: pubsub.isBroker } });
          return;
        }
        await new Promise(r => setTimeout(r, 10));
      }
      process.send({ type: 'error', data: { message: 'timed out waiting for pubsub status' } });
    } else if (msg.type === 'stream') {
      const { output } = await mastra.getAgentById(evented.id).stream('where am I?');
      const text = await output.text;
      const finishReason = await output.finishReason;
      process.send({ type: 'stream-done', data: { text, finishReason } });
    }
  } catch (err) {
    process.send({ type: 'error', data: { message: err?.stack ?? String(err) } });
  }
});

// Bind/connect the socket eagerly so broker election is deterministic.
await pubsub.subscribe('__boot__', () => {});
process.send({ type: 'ready', data: { started: true } });
`;

describe('EventedAgent - producer (MASTRA_WORKERS=false) + dedicated worker process', () => {
  let tempDir: string;
  let scriptPath: string;
  const children: ChildProcess[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-evented-two-proc-'));
    scriptPath = join(tempDir, 'child.mjs');
    await writeFile(scriptPath, CHILD_SCRIPT);
  });

  afterEach(async () => {
    for (const child of children.splice(0)) child.kill('SIGKILL');
    await rm(tempDir, { recursive: true, force: true });
  });

  async function spawn(socketPath: string, role: 'producer' | 'worker'): Promise<ChildProcess> {
    const env = { ...process.env };
    if (role === 'producer') env.MASTRA_WORKERS = 'false';
    else delete env.MASTRA_WORKERS;
    const child = fork(scriptPath, [socketPath, role], { env, stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
    children.push(child);
    await waitForMessage(child, 'ready');
    return child;
  }

  function record(child: ChildProcess, type: 'model-called' | 'tool-called'): string[] {
    const seen: string[] = [];
    child.on('message', (msg: ChildMessage) => {
      if (msg.type === type) seen.push(msg.data.role);
    });
    return seen;
  }

  it.each([
    { brokerRole: 'worker' as const, label: 'worker process owns the broker' },
    { brokerRole: 'producer' as const, label: 'producer process owns the broker' },
  ])(
    'completes the run when the $label',
    async ({ brokerRole }) => {
      const socketPath = join(tempDir, 'pubsub.sock');

      const first = await spawn(socketPath, brokerRole);
      const second = await spawn(socketPath, brokerRole === 'worker' ? 'producer' : 'worker');
      const [worker, producer] = brokerRole === 'worker' ? [first, second] : [second, first];

      first.send({ type: 'wait-for-status', isBroker: true, remoteClientCount: 1 });
      await waitForMessage(first, 'status');
      second.send({ type: 'wait-for-status', isBroker: false });
      await waitForMessage(second, 'status');

      worker.send({ type: 'start-workers' });
      await waitForMessage(worker, 'ready');

      const workerModels = record(worker, 'model-called');
      const producerModels = record(producer, 'model-called');
      const workerTools = record(worker, 'tool-called');
      const producerTools = record(producer, 'tool-called');

      producer.send({ type: 'stream' });
      const done = await waitForMessage(producer, 'stream-done', 15_000);

      expect(done.data).toEqual({ text: 'All done', finishReason: 'stop' });
      // The loop ran in the worker process, not the producer.
      expect(workerModels).toEqual(['worker', 'worker']);
      expect(workerTools).toEqual(['worker']);
      expect(producerModels).toEqual([]);
      expect(producerTools).toEqual([]);
    },
    30_000,
  );
});
