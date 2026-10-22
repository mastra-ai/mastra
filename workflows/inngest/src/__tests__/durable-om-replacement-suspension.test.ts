import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { INNGEST_PORT, startConnectInngestDevServer, stopInngestDevServer } from './durable-agent.test.utils';
import { buildOmReplacementAgent } from './fixtures/om-replacement-agent';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 120_000 });
const workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'om-replacement-worker.ts');
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
    const timer = setTimeout(() => {
      if (worker.exitCode === null && worker.signalCode === null) {
        try {
          process.kill(-worker.pid!, 'SIGTERM');
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
            reject(error);
            return;
          }
        }
      }
      reject(new Error('Inngest worker did not become ready'));
    }, 90_000);
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
  try {
    process.kill(-worker.pid!, 'SIGTERM');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
  await new Promise(resolve => setTimeout(resolve, 500));
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
      mock.clearFixtures();
      mock.clearRequests();
      mock.resetMatchCounts();
      const agentId = `om-replacement-${crypto.randomUUID()}`;
      const threadId = `thread-${agentId}`;
      const resourceId = `resource-${agentId}`;
      const dbUrl = `file:/tmp/${agentId}.db`;
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
      const createInstance = () =>
        buildOmReplacementAgent({ dbUrl, agentId, inngestPort: INNGEST_PORT, mockUrl: mock.url, observationalMemory });
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
        const getSuspended = async () => {
          const { messages } = await first.memory.recall({ threadId, resourceId, perPage: false });
          const delegation = messages.find(
            message =>
              message.role === 'assistant' &&
              message.content.parts?.some(
                part => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === 'call-delegate',
              ),
          );
          return JSON.stringify(delegation?.content.metadata?.suspendedTools);
        };
        await vi.waitFor(async () => expect(await getSuspended()).toContain('q1'), { timeout: 20_000 });
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
        await vi.waitFor(
          async () => {
            const saved = await getSuspended();
            expect(saved).toContain('q2');
            expect(saved).not.toContain('q1');
          },
          { timeout: 20_000 },
        );
      } finally {
        await stopWorker(worker);
        await first.mastra.stopWorkers();
      }
    },
  );
});
