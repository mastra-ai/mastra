/**
 * Cross-process regression test for #22543: InngestPubSub must route
 * `agent.control.<runId>` abort requests to the Inngest worker executing the
 * run. Before the fix, the control topic was silently dropped, the worker never
 * received the abort-request, and the stream ended with finishReason 'stop'.
 */
import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { INNGEST_PORT, startConnectInngestDevServer, stopInngestDevServer } from './durable-agent.test.utils';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 120_000 });

const agentId = 'durable-abort-agent';
const dbUrl = pathToFileURL(path.join(tmpdir(), `mastra-durable-abort-${Date.now()}.db`)).href;
const workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'abort-worker.ts');

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
      if (!settled && buffer.toString().includes('ABORT_WORKER_READY')) {
        settled = true;
        clearTimeout(timer);
        resolve(proc);
      }
    };
    const timer = setTimeout(() => fail(new Error('abort worker did not become ready')), 90_000);
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.once('error', error => fail(error));
    proc.once('exit', code => fail(new Error(`abort worker exited early with code ${code}`)));
  });
}

async function stopWorker(): Promise<void> {
  const proc = worker;
  worker = undefined;
  await terminateWorker(proc);
}

describe('durable agent abort on a connect worker', () => {
  beforeAll(async () => {
    devServer = await startConnectInngestDevServer();
    worker = await startWorker();
  });

  afterAll(async () => {
    await stopWorker();
    await stopInngestDevServer(devServer);
  });

  it('stops generation on the worker and terminates the stream with finishReason "abort"', async () => {
    const { buildAbortAgent } = await import('./fixtures/abort-agent');
    const { durableAgent } = buildAbortAgent({ dbUrl, agentId, inngestPort: INNGEST_PORT });

    let abortPayload: unknown;
    let finishReason: string | undefined;
    const result = await durableAgent.stream('Count slowly.', {
      onAbort: data => {
        abortPayload = data;
      },
      onFinish: data => {
        finishReason = data.finishReason;
      },
    });

    let aborted = false;
    try {
      for await (const chunk of result.output.fullStream as AsyncIterable<{ type: string }>) {
        if (!aborted && chunk.type === 'text-delta') {
          aborted = true;
          // Await dispatch: the run executes on the worker process, so only the
          // pubsub control message can actually stop it — the local
          // AbortController flipped by abort() reaches nothing here.
          await result.abort();
        }
      }
    } catch {
      // The ABORT bridge path may error the stream after firing onAbort.
    } finally {
      result.cleanup();
    }

    expect(aborted).toBe(true);
    // Discriminating assertion: when the control topic is dropped (#22543), the
    // worker never receives the abort-request, streams to natural completion,
    // and this resolves to 'stop'.
    const outcome = abortPayload !== undefined ? 'abort' : finishReason;
    expect(outcome).toBe('abort');
  });
});
