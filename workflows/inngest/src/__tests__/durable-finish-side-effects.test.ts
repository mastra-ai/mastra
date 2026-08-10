import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DefaultStorage } from '@mastra/libsql';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { INNGEST_PORT, startConnectInngestDevServer, stopInngestDevServer } from './durable-agent.test.utils';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 120_000 });

const agentId = 'finish-side-effects-agent';
const dbUrl = pathToFileURL(path.join(tmpdir(), `mastra-finish-side-effects-${Date.now()}.db`)).href;
const workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'finish-side-effects-worker.ts');
const readerStorage = new DefaultStorage({ id: 'finish-side-effects-reader', url: dbUrl });

let worker: ChildProcess | undefined;
let devServer: ChildProcess | null = null;

async function terminateWorker(proc: ChildProcess | undefined): Promise<void> {
  if (!proc || proc.exitCode !== null) return;
  const exited = new Promise<void>(resolve => proc.once('exit', () => resolve()));
  proc.kill('SIGTERM');
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise<false>(resolve => setTimeout(() => resolve(false), 2000)),
  ]);
  if (!stopped && proc.exitCode === null) {
    proc.kill('SIGKILL');
    await exited;
  }
}

function startWorker(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['tsx', workerPath, dbUrl, agentId, String(INNGEST_PORT)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, INNGEST_DEV: '1', INNGEST_BASE_URL: `http://localhost:${INNGEST_PORT}` },
    });
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void terminateWorker(proc).then(() => reject(error), reject);
    };
    const onData = (buffer: Buffer) => {
      if (!settled && buffer.toString().includes('FINISH_SIDE_EFFECTS_WORKER_READY')) {
        settled = true;
        clearTimeout(timer);
        resolve(proc);
      }
    };
    const timer = setTimeout(() => fail(new Error('finish-side-effects worker did not become ready')), 90_000);
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.once('error', error => fail(error));
    proc.once('exit', code => fail(new Error(`finish-side-effects worker exited early with code ${code}`)));
  });
}

async function stopWorker(): Promise<void> {
  const proc = worker;
  worker = undefined;
  await terminateWorker(proc);
}

async function runTurn(prompt: string, threadId: string, resourceId: string): Promise<void> {
  const { buildFinishSideEffectsAgent } = await import('./fixtures/finish-side-effects-agent');
  const { durableAgent } = buildFinishSideEffectsAgent({ dbUrl, agentId, inngestPort: INNGEST_PORT });
  const result = await durableAgent.stream([{ role: 'user', content: prompt }], {
    memory: { thread: threadId, resource: resourceId },
  });
  try {
    for await (const _ of result.output.fullStream) {
      // Consume through the finish event.
    }
  } finally {
    result.cleanup();
  }
}

async function readMessages(threadId: string): Promise<any[]> {
  const store = await readerStorage.getStore('memory');
  return ((await store!.listMessages({ threadId } as never)) as any)?.messages ?? [];
}

const messageText = (message: any) =>
  (message?.content?.parts ?? [])
    .filter((part: any) => part.type === 'text')
    .map((part: any) => part.text)
    .join('');

describe('durable finish side effects on a connect worker', () => {
  beforeAll(async () => {
    devServer = await startConnectInngestDevServer();
    worker = await startWorker();
  });

  afterAll(async () => {
    await stopWorker();
    await stopInngestDevServer(devServer);
  });

  it('persists processed output, generates a title, and recalls it after a worker restart', async () => {
    const threadId = `finish-${Date.now()}`;
    const resourceId = `resource-${Date.now()}`;

    await runTurn('My name is Zebra. Remember it.', threadId, resourceId);
    let messages = await readMessages(threadId);
    expect(messageText(messages.find(message => message.role === 'assistant'))).toBe('RECALL:YES');

    const store = await readerStorage.getStore('memory');
    expect((await store!.getThreadById({ threadId }))?.title).toBe('Durable Thread Title');

    await stopWorker();
    worker = await startWorker();

    await runTurn('What is my name?', threadId, resourceId);
    messages = await readMessages(threadId);
    expect(messageText(messages.filter(message => message.role === 'assistant').at(-1))).toBe('RECALL:YES');
  });
});
