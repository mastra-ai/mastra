/**
 * Restart recovery for an EventedAgent in the dedicated-workers deploy
 * (COR-1389): an API process with `MASTRA_WORKERS=false` and a separate worker
 * process, sharing a `UnixSocketPubSub` and a LibSQL file.
 *
 * 1. The API process starts a run and the worker dies while the model call is
 *    in flight, so the run is left `running` in storage.
 * 2. Both processes restart. The killed process's claim on the run lapses, then
 *    the new API process calls
 *    `agent.recoverActiveRuns()`, which restarts the run and publishes
 *    `workflow.start`. That event must reach the new worker process; if the
 *    durable loop's events were local-only, the run would stay `running`.
 *
 * Lives here rather than in core because recovery needs storage shared across
 * processes. Children run under tsx so they can import this package's source.
 */
import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

interface ChildMessage {
  type: 'ready' | 'status' | 'model-called' | 'tool-called' | 'recovered' | 'claim-lapsed' | 'run-status' | 'error';
  data?: any;
}

function waitForMessage(child: ChildProcess, type: ChildMessage['type'], timeoutMs = 10_000): Promise<ChildMessage> {
  return new Promise((resolvePromise, reject) => {
    const handler = (msg: ChildMessage) => {
      if (msg.type === 'error') {
        clearTimeout(timer);
        child.off('message', handler);
        reject(new Error(`child error: ${msg.data?.message}`));
      } else if (msg.type === type) {
        clearTimeout(timer);
        child.off('message', handler);
        resolvePromise(msg);
      }
    };
    const timer = setTimeout(() => {
      child.off('message', handler);
      reject(new Error(`Timeout waiting for "${type}" from child`));
    }, timeoutMs);
    child.on('message', handler);
  });
}

const packageRoot = resolve(__dirname, '../..');
const toImportPath = (p: string) => p.replace(/\\/g, '/');
const coreDist = (rel: string) => toImportPath(join(packageRoot, '../../packages/core/dist', rel));
const libsqlSrc = toImportPath(join(packageRoot, 'src/index.ts'));

const AGENT_ID = 'split-recovery-agent';

const CHILD_SCRIPT = `
import { Agent } from '${coreDist('agent/index.js')}';
import { createEventedAgent } from '${coreDist('agent/durable/index.js')}';
import { UnixSocketPubSub } from '${coreDist('events/index.js')}';
import { Mastra } from '${coreDist('mastra/index.js')}';
import { createTool } from '${coreDist('tools/index.js')}';
import { LibSQLStore } from '${libsqlSrc}';

const [socketPath, dbUrl, role, mode] = process.argv.slice(2);

function streamOf(chunks: unknown[]) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

// Tool call on the first turn, text on the second. In 'hang' mode the first
// model call never returns, so the process can be killed mid-run.
let modelCalls = 0;
const model: any = {
  specificationVersion: 'v2',
  provider: 'mock',
  modelId: 'mock-model',
  supportedUrls: {},
  async doGenerate() {
    throw new Error('doGenerate not used');
  },
  async doStream() {
    modelCalls++;
    process.send!({ type: 'model-called', data: { role, mode, call: modelCalls } });
    if (mode === 'hang') await new Promise(() => {});
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
    process.send!({ type: 'tool-called', data: { role, mode } });
    return 'executed-in-' + role;
  },
});

const agent = new Agent({ id: '${AGENT_ID}', name: '${AGENT_ID}', instructions: 'Use tools.', model, tools: { whereAmI } });
const evented = createEventedAgent({ agent });
const pubsub = new UnixSocketPubSub(socketPath);
const storage = new LibSQLStore({ id: 'split-recovery', url: dbUrl });
const mastra = new Mastra({ logger: false, storage, pubsub, agents: { [evented.id]: evented } });

process.on('message', async (msg: any) => {
  try {
    if (msg.type === 'start-workers') {
      await mastra.startWorkers();
      process.send!({ type: 'ready', data: { workers: true } });
    } else if (msg.type === 'wait-for-status') {
      const start = Date.now();
      while (Date.now() - start < 5000) {
        if (
          pubsub.isBroker === msg.isBroker &&
          (msg.remoteClientCount === undefined || pubsub.remoteClientCount === msg.remoteClientCount)
        ) {
          process.send!({ type: 'status', data: { isBroker: pubsub.isBroker } });
          return;
        }
        await new Promise(r => setTimeout(r, 10));
      }
      process.send!({ type: 'error', data: { message: 'timed out waiting for pubsub status' } });
    } else if (msg.type === 'stream') {
      // Fire and forget: the worker is killed before this run finishes.
      await mastra.getAgentById(evented.id).stream('where am I?');
    } else if (msg.type === 'recover') {
      const result = await mastra.getAgentById(evented.id).recoverActiveRuns();
      process.send!({
        type: 'recovered',
        data: {
          succeeded: result.succeeded,
          failed: result.failed,
          runIds: result.recovered.map(r => r.runId),
          statuses: result.recovered.map(r => r.status),
          errors: result.recovered.map(r => r.error?.message).filter(Boolean),
        },
      });
    } else if (msg.type === 'lapse-claim') {
      // End the killed process's claim the way its lease running out would.
      const workflows = await storage.getStore('workflows');
      const record = await workflows!.getRunOwnership({ runId: msg.runId });
      if (record?.live) {
        await workflows!.releaseRunOwnership({ runId: msg.runId, generation: record.generation, ownerId: record.ownerId });
      }
      process.send!({ type: 'claim-lapsed' });
    } else if (msg.type === 'run-status') {
      const workflows = await storage.getStore('workflows');
      const { runs } = await workflows!.listWorkflowRuns({ workflowName: 'durable-agentic-loop' });
      process.send!({
        type: 'run-status',
        data: runs.map(run => {
          const snapshot = typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot;
          return { runId: run.runId, status: snapshot?.status };
        }),
      });
    }
  } catch (err: any) {
    process.send!({ type: 'error', data: { message: err?.stack ?? String(err) } });
  }
});

await storage.init();
// Bind/connect the socket eagerly so broker election is deterministic.
await pubsub.subscribe('__boot__', () => {});
process.send!({ type: 'ready', data: { started: true } });
`;

type Role = 'api' | 'worker';

describe('EventedAgent restart recovery - API (MASTRA_WORKERS=false) + dedicated worker process', () => {
  let tempDir: string;
  let scriptPath: string;
  let dbUrl: string;
  const children: ChildProcess[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-evented-split-recovery-'));
    scriptPath = join(tempDir, 'child.mts');
    dbUrl = `file:${join(tempDir, 'mastra.db')}`;
    await writeFile(scriptPath, CHILD_SCRIPT);
  });

  afterEach(async () => {
    for (const child of children.splice(0)) child.kill('SIGKILL');
    await rm(tempDir, { recursive: true, force: true });
  });

  async function spawn(socketPath: string, role: Role, mode: 'hang' | 'normal'): Promise<ChildProcess> {
    const env = { ...process.env };
    if (role === 'api') env.MASTRA_WORKERS = 'false';
    else delete env.MASTRA_WORKERS;
    const child = fork(scriptPath, [socketPath, dbUrl, role, mode], {
      cwd: packageRoot,
      env,
      execArgv: ['--import', 'tsx'],
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    children.push(child);
    await waitForMessage(child, 'ready', 20_000);
    return child;
  }

  /** API process owns the broker; the worker connects to it and starts its workers. */
  async function startPair(socketPath: string, workerMode: 'hang' | 'normal') {
    const api = await spawn(socketPath, 'api', 'normal');
    const worker = await spawn(socketPath, 'worker', workerMode);
    api.send({ type: 'wait-for-status', isBroker: true, remoteClientCount: 1 });
    await waitForMessage(api, 'status');
    worker.send({ type: 'wait-for-status', isBroker: false });
    await waitForMessage(worker, 'status');
    worker.send({ type: 'start-workers' });
    await waitForMessage(worker, 'ready');
    return { api, worker };
  }

  function record(child: ChildProcess, type: 'model-called' | 'tool-called'): string[] {
    const seen: string[] = [];
    child.on('message', (msg: ChildMessage) => {
      if (msg.type === type) seen.push(msg.data.role);
    });
    return seen;
  }

  async function runStatuses(child: ChildProcess): Promise<{ runId: string; status: string }[]> {
    child.send({ type: 'run-status' });
    return (await waitForMessage(child, 'run-status')).data;
  }

  async function kill(child: ChildProcess) {
    const exited = new Promise(r => child.once('exit', r));
    child.kill('SIGKILL');
    await exited;
  }

  it('finishes a run orphaned by a worker crash on the restarted worker process', async () => {
    // Phase 1: the worker dies mid-run.
    const first = await startPair(join(tempDir, 'pubsub-1.sock'), 'hang');
    const hung = waitForMessage(first.worker, 'model-called', 15_000);
    first.api.send({ type: 'stream' });
    await hung;

    const orphaned = await runStatuses(first.api);
    expect(orphaned).toHaveLength(1);
    expect(orphaned[0]!.status).toBe('running');
    const runId = orphaned[0]!.runId;

    await kill(first.worker);
    await kill(first.api);

    // Phase 2: both processes restart; the API process recovers the run.
    const second = await startPair(join(tempDir, 'pubsub-2.sock'), 'normal');
    const workerModels = record(second.worker, 'model-called');
    const workerTools = record(second.worker, 'tool-called');
    const apiModels = record(second.api, 'model-called');
    const apiTools = record(second.api, 'tool-called');

    // Until the killed process's claim lapses, the run still looks owned.
    second.api.send({ type: 'recover' });
    const skipped = await waitForMessage(second.api, 'recovered', 20_000);
    expect(skipped.data).toEqual({ succeeded: 0, failed: 0, runIds: [runId], statuses: ['skipped'], errors: [] });

    second.api.send({ type: 'lapse-claim', runId });
    await waitForMessage(second.api, 'claim-lapsed');

    second.api.send({ type: 'recover' });
    const recovered = await waitForMessage(second.api, 'recovered', 20_000);
    expect(recovered.data).toEqual({ succeeded: 1, failed: 0, runIds: [runId], statuses: ['success'], errors: [] });

    // A durable run deletes its snapshot once it finishes, so nothing is left `running`.
    let statuses = await runStatuses(second.api);
    const deadline = Date.now() + 10_000;
    while (statuses.length > 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 100));
      statuses = await runStatuses(second.api);
    }
    expect(statuses).toEqual([]);

    // The recovered loop ran in the new worker process, not the API process.
    expect(workerModels).toEqual(['worker', 'worker']);
    expect(workerTools).toEqual(['worker']);
    expect(apiModels).toEqual([]);
    expect(apiTools).toEqual([]);
  }, 90_000);
});
