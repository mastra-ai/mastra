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

interface WorkerHandle {
  proc: ChildProcess;
  /** Rejects if the worker exits or errors after readiness. Never resolves. */
  exited: Promise<never>;
  /** Call before intentional shutdown so SIGTERM in afterAll isn't a failure. */
  disarm(): void;
}

let workerHandle: WorkerHandle | undefined;
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

function startWorker(): Promise<WorkerHandle> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['tsx', workerPath, dbUrl, agentId, String(INNGEST_PORT)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, INNGEST_DEV: '1', INNGEST_BASE_URL: `http://localhost:${INNGEST_PORT}` },
    });
    let ready = false;
    let disarmed = false;
    let rejectExited!: (error: Error) => void;
    const exited = new Promise<never>((_, rejectExit) => {
      rejectExited = rejectExit;
    });
    // A pre-readiness crash is already reported via the readiness rejection;
    // avoid an unhandled-rejection warning when nothing races `exited` yet.
    exited.catch(() => {});
    const fail = (error: Error) => {
      if (disarmed) return;
      if (!ready) {
        clearTimeout(timer);
        void terminateWorker(proc).then(() => reject(error), reject);
      }
      // Idempotent: a settled promise ignores later rejections.
      rejectExited(error);
    };
    const onData = (buffer: Buffer) => {
      if (!ready && buffer.toString().includes('ABORT_WORKER_READY')) {
        ready = true;
        clearTimeout(timer);
        resolve({
          proc,
          exited,
          disarm: () => {
            disarmed = true;
          },
        });
      }
    };
    const timer = setTimeout(() => fail(new Error('abort worker did not become ready')), 90_000);
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.once('error', error => fail(error));
    proc.once('exit', (code, signal) =>
      fail(new Error(`abort worker exited unexpectedly (code ${code}, signal ${signal})`)),
    );
  });
}

async function stopWorker(): Promise<void> {
  const handle = workerHandle;
  workerHandle = undefined;
  handle?.disarm();
  await terminateWorker(handle?.proc);
}

describe('durable agent abort on a connect worker', () => {
  beforeAll(async () => {
    devServer = await startConnectInngestDevServer();
    workerHandle = await startWorker();
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
    const consume = async () => {
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
    };
    // Fail fast if the worker dies mid-test instead of waiting for the vitest
    // timeout: `exited` rejects on any post-readiness exit/error.
    await Promise.race([consume(), workerHandle!.exited]);

    expect(aborted).toBe(true);
    // When the control topic is dropped (#22543), the worker never receives the
    // abort-request, streams to natural completion, and finishReason resolves to
    // 'stop' with onAbort never firing. All three signals derive from the FINISH
    // event the worker publishes after gracefully catching the AbortError.
    expect(abortPayload).toBeDefined();
    expect(finishReason).toBe('abort');
    await expect(result.output.finishReason).resolves.toBe('abort');
  });

  it('fails fast when the worker dies after readiness', async () => {
    const handle = await startWorker();
    // No disarm — any post-readiness exit must reject `exited`. SIGTERM (unlike
    // SIGKILL) is forwarded by the npx wrapper to the tsx child, so the worker
    // process tree actually dies instead of leaving an orphan behind.
    handle.proc.kill('SIGTERM');
    await expect(handle.exited).rejects.toThrow(/exited unexpectedly/);
  });
});
