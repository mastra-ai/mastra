import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LibSQLStore } from '../index';

const packageRoot = resolve(__dirname, '../..');
const importPath = (path: string) => path.replace(/\\/g, '/');
const coreDist = (path: string) => importPath(join(packageRoot, '../../packages/core/dist', path));
const threadId = 'lost-worker-thread';
const resourceId = 'lost-worker-user';
const inputId = 'accepted-request';
const input = 'Please preserve this request even if the worker disappears.';
const reply = 'Your request survived the worker restart.';

type Engine = 'default' | 'evented';
type Role = 'api' | 'worker';
interface ChildMessage {
  type: string;
  data?: { succeeded?: number; failed?: number; errors?: unknown[]; message?: string; role?: Role };
}

// Children import the built core to exercise the same execution and storage-fencing
// boundaries as a deployed worker, not the Vitest module graph. (COR-1472)
const childScript = `
import { Agent } from '${coreDist('agent/index.js')}';
import { createDurableAgent, createEventedAgent } from '${coreDist('agent/durable/index.js')}';
import { UnixSocketPubSub } from '${coreDist('events/index.js')}';
import { Mastra } from '${coreDist('mastra/index.js')}';
import { MockMemory } from '${coreDist('memory/index.js')}';
import { LibSQLStore } from '${importPath(join(packageRoot, 'src/index.ts'))}';

const [socketPath, dbUrl, engine, role, mode] = process.argv.slice(2);
const storage = new LibSQLStore({ id: 'input-persistence', url: dbUrl });
const pubsub = new UnixSocketPubSub(socketPath);
const model = {
  specificationVersion: 'v2', provider: 'mock', modelId: 'mock-model', supportedUrls: {},
  async doGenerate() { throw new Error('doGenerate not used'); },
  async doStream({ prompt }) {
    if (!JSON.stringify(prompt).includes(${JSON.stringify(input)})) throw new Error('recovered prompt lost user input');
    process.send({ type: 'model-called', data: { role } });
    if (mode === 'hang') await new Promise(() => {});
    return { stream: new ReadableStream({ start(controller) {
      for (const chunk of [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'reply', modelId: 'mock-model', timestamp: new Date(0) },
        { type: 'text-start', id: 'text' },
        { type: 'text-delta', id: 'text', delta: ${JSON.stringify(reply)} },
        { type: 'text-end', id: 'text' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
      ]) controller.enqueue(chunk);
      controller.close();
    } }) };
  },
};
const memory = new MockMemory({ storage, options: { lastMessages: 20 } });
const agent = new Agent({ id: 'input-persistence-agent', name: 'Input persistence agent', instructions: 'Answer the request.', model, memory });
// Enable restart checkpoints without allowing automatic boot recovery to race the pre-recovery read.
const options = { agent, shouldPersistSnapshot: () => true };
const durable = engine === 'evented' ? createEventedAgent(options) : createDurableAgent(options);
const mastra = new Mastra({ logger: false, storage, pubsub, agents: { [durable.id]: durable }, recovery: { durableAgents: 'off' } });

process.on('message', async (message) => {
  try {
    if (message.type === 'start-workers') {
      await mastra.startWorkers();
      process.send({ type: 'workers-ready' });
    } else if (message.type === 'connected') {
      const deadline = Date.now() + 10000;
      while (pubsub.isBroker !== message.isBroker || (message.clients !== undefined && pubsub.remoteClientCount !== message.clients)) {
        if (Date.now() > deadline) throw new Error('pubsub connection timed out');
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      process.send({ type: 'connected' });
    } else if (message.type === 'stream') {
      const stream = await durable.stream([{
        id: ${JSON.stringify(inputId)}, role: 'user', content: ${JSON.stringify(input)},
      }], { memory: { thread: ${JSON.stringify(threadId)}, resource: ${JSON.stringify(resourceId)} } });
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'error') throw new Error(JSON.stringify(chunk));
      }
    } else if (message.type === 'recover') {
      const workflows = await storage.getStore('workflows');
      const { runs } = await workflows.listWorkflowRuns({ workflowName: 'durable-agentic-loop' });
      if (runs.length !== 1) throw new Error('expected one orphaned run, got ' + runs.length);
      const snapshot = typeof runs[0].snapshot === 'string' ? JSON.parse(runs[0].snapshot) : runs[0].snapshot;
      if (snapshot?.status !== 'running') throw new Error('orphan snapshot status: ' + snapshot?.status);
      const claim = await workflows.getRunOwnership({ runId: runs[0].runId });
      // Simulate the killed owner's lease expiring; do not wait for the production TTL.
      if (claim?.live) await workflows.releaseRunOwnership({ runId: runs[0].runId, generation: claim.generation, ownerId: claim.ownerId });
      const result = await durable.recoverActiveRuns({ runId: runs[0].runId });
      process.send({ type: 'recovered', data: {
        succeeded: result.succeeded, failed: result.failed,
        errors: result.recovered.filter(run => run.status !== 'success'),
      } });
    }
  } catch (error) {
    process.send({ type: 'error', data: { message: error?.stack ?? String(error) } });
  }
});
await storage.init();
await pubsub.subscribe('__boot__', () => {});
process.send({ type: 'ready' });
`;

class Child {
  readonly messages: ChildMessage[] = [];
  private stderr = '';

  constructor(readonly process: ChildProcess) {
    process.on('message', message => this.messages.push(message as ChildMessage));
    process.stderr?.on('data', chunk => (this.stderr += String(chunk)));
  }

  async wait(type: string, timeout = 20_000): Promise<ChildMessage> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const error = this.messages.find(message => message.type === 'error');
      if (error) throw new Error(error.data?.message);
      const index = this.messages.findIndex(message => message.type === type);
      if (index !== -1) return this.messages.splice(index, 1)[0]!;
      if (this.process.exitCode !== null || this.process.signalCode !== null) {
        throw new Error(`Child exited while waiting for ${type}: ${this.stderr}`);
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error(`Timeout waiting for ${type}: ${this.stderr}`);
  }

  async request(message: Record<string, unknown>, response: string) {
    this.process.send(message);
    return this.wait(response);
  }

  async kill() {
    if (this.process.exitCode !== null || this.process.signalCode !== null) return;
    const exited = once(this.process, 'exit');
    this.process.kill('SIGKILL');
    await exited;
  }
}

describe('User input survives a lost durable worker (COR-1472)', () => {
  let tempDir: string;
  let scriptPath: string;
  let dbUrl: string;
  let reader: LibSQLStore;
  const children: Child[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-durable-input-'));
    scriptPath = join(tempDir, 'child.mts');
    dbUrl = `file:${join(tempDir, 'messages.db')}`;
    await writeFile(scriptPath, childScript);
    reader = new LibSQLStore({ id: 'independent-reader', url: dbUrl });
  });

  afterEach(async () => {
    await Promise.all(children.splice(0).map(child => child.kill()));
    await reader.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  async function spawn(engine: Engine, socket: string, role: Role, mode: 'hang' | 'normal') {
    const env = { ...process.env };
    if (role === 'api') env.MASTRA_WORKERS = 'false';
    else delete env.MASTRA_WORKERS;
    const child = new Child(
      fork(scriptPath, [socket, dbUrl, engine, role, mode], {
        cwd: packageRoot,
        env,
        execArgv: ['--import', 'tsx'],
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      }),
    );
    children.push(child);
    await child.wait('ready');
    return child;
  }

  async function start(engine: Engine, generation: number, mode: 'hang' | 'normal') {
    const socket = join(tempDir, `pubsub-${generation}.sock`);
    if (engine === 'default') {
      const worker = await spawn(engine, socket, 'worker', mode);
      return { api: worker, worker };
    }
    const api = await spawn(engine, socket, 'api', 'normal');
    const worker = await spawn(engine, socket, 'worker', mode);
    await api.request({ type: 'connected', isBroker: true, clients: 1 }, 'connected');
    await worker.request({ type: 'connected', isBroker: false }, 'connected');
    await worker.request({ type: 'start-workers' }, 'workers-ready');
    return { api, worker };
  }

  it.each<Engine>(['default', 'evented'])(
    'retains the request before recovery and saves it once after recovery (%s)',
    async engine => {
      const first = await start(engine, 1, 'hang');
      first.api.process.send({ type: 'stream' });
      expect((await first.worker.wait('model-called')).data?.role).toBe('worker');
      await reader.init();
      const workflows = (await reader.getStore('workflows'))!;
      // The model can be entered before the asynchronous initial checkpoint settles.
      // Kill only once a restartable outer snapshot is visible to another process.
      await expect
        .poll(
          async () => {
            const { runs } = await workflows.listWorkflowRuns({ workflowName: 'durable-agentic-loop' });
            return runs.map(run => {
              const snapshot = typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot;
              return snapshot?.status;
            });
          },
          { timeout: 10_000 },
        )
        .toEqual(['running']);
      await first.worker.kill();
      await first.api.kill();

      // This connection has never participated in the run and recovery has not started.
      const memory = (await reader.getStore('memory'))!;
      const before = await memory.listMessages({ threadId, perPage: false });
      expect
        .soft(before.messages.map(message => ({ id: message.id, role: message.role, text: message.content.content })))
        .toEqual([{ id: inputId, role: 'user', text: input }]);

      const second = await start(engine, 2, 'normal');
      const recovered = await second.api.request({ type: 'recover' }, 'recovered');
      expect(recovered.data).toEqual({ succeeded: 1, failed: 0, errors: [] });
      expect((await second.worker.wait('model-called')).data?.role).toBe('worker');
      await expect
        .poll(
          async () => {
            const after = await memory.listMessages({ threadId, perPage: false });
            return after.messages.map(message => ({
              id: message.id,
              role: message.role,
              text: message.content.content,
            }));
          },
          { timeout: 10_000 },
        )
        .toEqual([
          { id: inputId, role: 'user', text: input },
          { id: expect.any(String), role: 'assistant', text: reply },
        ]);
    },
    90_000,
  );
});
