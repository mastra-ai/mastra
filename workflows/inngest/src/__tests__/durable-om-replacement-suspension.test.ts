import { execSync, spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LLMock } from '@copilotkit/aimock';
import { $ } from 'execa';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { INNGEST_PORT, startConnectInngestDevServer, stopInngestDevServer } from './durable-agent.test.utils';
import { buildOmReplacementAgent } from './fixtures/om-replacement-agent';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 120_000 });
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(__dirname, '..', '..');
const workerPath = path.join(__dirname, 'fixtures', 'om-replacement-worker.ts');
let devServer: ChildProcess | null = null;
let mock: LLMock;

async function startWorker(dbUrl: string, agentId: string, observationalMemory: boolean): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const worker = spawn(
      'npx',
      ['tsx', workerPath, dbUrl, agentId, String(INNGEST_PORT), mock.url, String(observationalMemory)],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
        env: { ...process.env, INNGEST_DEV: '1', INNGEST_BASE_URL: `http://localhost:${INNGEST_PORT}` },
      },
    );
    const timer = setTimeout(() => reject(new Error('Inngest worker did not become ready')), 90_000);
    const onData = (buffer: Buffer) => {
      const text = buffer.toString();
      if (text.includes('[worker] ready')) {
        clearTimeout(timer);
        resolve(worker);
      }
    };
    worker.stdout?.on('data', onData);
    worker.stderr?.on('data', onData);
    worker.on('exit', code => {
      clearTimeout(timer);
      reject(new Error(`Inngest worker exited with code ${code}`));
    });
  });
}

async function stopWorker(worker: ChildProcess | undefined) {
  if (!worker) return;
  process.kill(-worker.pid!, 'SIGTERM');
  await new Promise(resolve => setTimeout(resolve, 500));
}

type Instance = ReturnType<typeof buildOmReplacementAgent>;

/**
 * Run the #27971 replacement-worker scenario against one storage backend. The supervisor suspends on
 * the delegated `q1` tool call, the worker process is replaced, and a new instance resumes the run.
 * The sub-agent's second suspension (`q2`) must be the one persisted — a stale `q1` entry means the
 * cold resume recovered nothing.
 *
 * `storageUrl` is derived per test so each case gets its own agent-scoped database.
 */
async function runReplacementScenario(observationalMemory: boolean, storageUrl: (agentId: string) => string) {
  mock.clearFixtures();
  mock.clearRequests();
  mock.resetMatchCounts();
  const agentId = `om-replacement-${crypto.randomUUID()}`;
  const threadId = `thread-${agentId}`;
  const resourceId = `resource-${agentId}`;
  const dbUrl = storageUrl(agentId);
  mock.on(
    { endpoint: 'chat', model: 'supervisor' },
    {
      toolCalls: [
        {
          id: 'call-delegate',
          name: `agent-${agentId}-specialist`,
          arguments: JSON.stringify({ prompt: 'Ask both questions' }),
        },
      ],
    },
  );
  mock.on(
    { endpoint: 'chat', model: 'specialist', predicate: req => !JSON.stringify(req.messages).includes('call-q1') },
    {
      toolCalls: [{ id: 'call-q1', name: 'ask', arguments: JSON.stringify({ question: 'q1' }) }],
    },
  );
  mock.on(
    { endpoint: 'chat', model: 'specialist', predicate: req => JSON.stringify(req.messages).includes('call-q1') },
    {
      toolCalls: [{ id: 'call-q2', name: 'ask', arguments: JSON.stringify({ question: 'q2' }) }],
    },
  );
  const ledgers: Instance[] = [];
  const createInstance = () => {
    const instance = buildOmReplacementAgent({
      dbUrl,
      agentId,
      inngestPort: INNGEST_PORT,
      mockUrl: mock.url,
      observationalMemory,
    });
    ledgers.push(instance);
    return instance;
  };
  const readSuspendedTools = async (instance: Instance) => {
    const { messages } = await instance.memory.recall({ threadId, resourceId, perPage: false });
    const delegation = messages.find(
      message =>
        message.role === 'assistant' &&
        message.content.parts?.some(
          part => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === 'call-delegate',
        ),
    );
    return JSON.stringify(delegation?.content.metadata?.suspendedTools);
  };
  const first = createInstance();
  let worker: ChildProcess | undefined;
  try {
    worker = await startWorker(dbUrl, agentId, observationalMemory);
    await new Promise(resolve => setTimeout(resolve, 3000));
    const initial = await first.durableAgent.stream('Ask both questions', {
      memory: { thread: threadId, resource: resourceId },
      maxSteps: 5,
    });
    let firstSuspension: unknown;
    for await (const chunk of initial.fullStream) {
      if (chunk.type === 'tool-call-suspended') {
        firstSuspension = chunk.payload.suspendPayload;
        break;
      }
    }
    expect(JSON.stringify(firstSuspension)).toContain('q1');
    const runId = await initial.runId;
    await vi.waitFor(async () => expect(await readSuspendedTools(first)).toContain('q1'), { timeout: 20_000 });
    await vi.waitFor(
      async () => {
        const runs = await first.durableAgent.listSuspendedRuns({ threadId, resourceId });
        expect(runs.runs.some(run => run.runId === runId)).toBe(true);
      },
      { timeout: 20_000 },
    );
    await stopWorker(worker);
    worker = await startWorker(dbUrl, agentId, observationalMemory);
    await new Promise(resolve => setTimeout(resolve, 3000));
    const second = createInstance();
    const resumed = await second.durableAgent.resumeStream(
      { answer: 'first answer' },
      { runId, toolCallId: 'call-delegate', memory: { thread: threadId, resource: resourceId }, maxSteps: 5 },
    );
    let secondSuspension: unknown;
    for await (const chunk of resumed.fullStream) {
      if (chunk.type === 'tool-call-suspended') {
        secondSuspension = chunk.payload.suspendPayload;
        break;
      }
    }
    expect(JSON.stringify(secondSuspension)).toContain('q2');
    // Read the persisted snapshot back through a client that was never part of the run: the worker
    // process wrote it, so only storage that actually persisted it can show `q2`.
    const reader = createInstance();
    await vi.waitFor(
      async () => {
        const saved = await readSuspendedTools(reader);
        expect(saved).toContain('q2');
        expect(saved).not.toContain('q1');
      },
      { timeout: 20_000 },
    );
  } finally {
    await stopWorker(worker);
    for (const instance of ledgers) {
      await instance.mastra.stopWorkers();
      await instance.storage.close();
    }
  }
}

describe('Inngest: replacement worker resumes an OM delegation (#27971)', () => {
  beforeAll(async () => {
    mock = new LLMock({ port: 0 });
    await mock.start();
    devServer = await startConnectInngestDevServer();
  });
  afterAll(async () => {
    await stopInngestDevServer(devServer);
    await mock.stop();
  });

  it.each([false, true])(
    'persists q2 after worker replacement with observational memory %s',
    async observationalMemory => {
      await runReplacementScenario(observationalMemory, agentId => `file:/tmp/${agentId}.db`);
    },
  );

  // Native PostgreSQL storage with the same separate connect() worker (#28059). `DB_URL` points at an
  // existing database; otherwise a throwaway pgvector container is started from this package's
  // docker-compose.yaml. Without either, the cases report as skipped so the default lane keeps working.
  describe('PostgreSQL storage', () => {
    const postgresUrl = process.env.DB_URL ?? 'postgres://postgres:postgres@localhost:5436/mastra';
    const usesExternalPostgres = Boolean(process.env.DB_URL);
    const hasDocker = !usesExternalPostgres && dockerIsAvailable();

    describe.skipIf(!usesExternalPostgres && !hasDocker)('with a native Inngest worker', () => {
      let startedPostgres = false;

      beforeAll(async () => {
        if (usesExternalPostgres) return;
        await $({ cwd: packageRoot, stdio: 'inherit' })`docker compose up -d postgres --wait`;
        startedPostgres = true;
      }, 180_000);

      afterAll(async () => {
        if (!startedPostgres) return;
        await $({ cwd: packageRoot, stdio: 'inherit' })`docker compose down --volumes postgres`;
      }, 180_000);

      it.each([false, true])(
        'persists q2 after worker replacement with observational memory %s',
        async observationalMemory => {
          await runReplacementScenario(observationalMemory, () => postgresUrl);
        },
      );
    });
  });
});

function dockerIsAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
