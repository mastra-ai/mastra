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
  // A signal-terminated child has exitCode null but signalCode set; either one
  // means the process is already dead and `exit` will never fire again.
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return;
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

// Exposes `proc` before readiness so tests can exercise pre-readiness failure
// paths; regular callers go through startWorker() and only see the handle.
function spawnWorker(): { proc: ChildProcess; whenReady: Promise<WorkerHandle> } {
  const proc = spawn('npx', ['tsx', workerPath, dbUrl, agentId, String(INNGEST_PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, INNGEST_DEV: '1', INNGEST_BASE_URL: `http://localhost:${INNGEST_PORT}` },
  });
  const whenReady = new Promise<WorkerHandle>((resolve, reject) => {
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
    const READY_MARKER = 'ABORT_WORKER_READY';
    // Pipe chunk boundaries are arbitrary: the marker can be split across two
    // `data` events. Keep a rolling tail per stream so a split marker still
    // matches; retain only marker.length - 1 chars so the buffer stays bounded.
    const watchForReady = (stream: NodeJS.ReadableStream | null | undefined) => {
      let tail = '';
      stream?.on('data', (buffer: Buffer) => {
        if (ready) return;
        tail += buffer.toString();
        if (tail.includes(READY_MARKER)) {
          ready = true;
          clearTimeout(timer);
          resolve({
            proc,
            exited,
            disarm: () => {
              disarmed = true;
            },
          });
          return;
        }
        tail = tail.slice(-(READY_MARKER.length - 1));
      });
    };
    const timer = setTimeout(() => fail(new Error('abort worker did not become ready')), 90_000);
    watchForReady(proc.stdout);
    watchForReady(proc.stderr);
    proc.once('error', error => fail(error));
    proc.once('exit', (code, signal) =>
      fail(new Error(`abort worker exited unexpectedly (code ${code}, signal ${signal})`)),
    );
  });
  return { proc, whenReady };
}

function startWorker(): Promise<WorkerHandle> {
  return spawnWorker().whenReady;
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

  // #25156: aborting through the agent (as `POST /agents/:id/threads/abort` and
  // Studio do) must reach the worker too, not only the stream result's abort().
  async function streamAndAbortThroughAgent(
    abort: (
      durableAgent: ReturnType<typeof import('./fixtures/abort-agent').buildAbortAgent>['durableAgent'],
      runId: string,
      scope: { threadId: string; resourceId: string },
    ) => boolean,
  ) {
    const { buildAbortAgent } = await import('./fixtures/abort-agent');
    const { durableAgent } = buildAbortAgent({ dbUrl, agentId, inngestPort: INNGEST_PORT });
    const scope = { threadId: `abort-thread-${Date.now()}`, resourceId: 'abort-resource' };

    let abortPayload: unknown;
    let finishReason: string | undefined;
    const result = await durableAgent.stream('Count slowly.', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      onAbort: data => {
        abortPayload = data;
      },
      onFinish: data => {
        finishReason = data.finishReason;
      },
    });

    let acknowledged: boolean | undefined;
    const consume = async () => {
      try {
        for await (const chunk of result.output.fullStream as AsyncIterable<{ type: string }>) {
          if (acknowledged === undefined && chunk.type === 'text-delta') {
            acknowledged = abort(durableAgent, result.runId, scope);
          }
        }
      } catch {
        // The ABORT bridge path may error the stream after firing onAbort.
      } finally {
        result.cleanup();
      }
    };
    await Promise.race([consume(), workerHandle!.exited]);

    expect(acknowledged).toBe(true);
    expect(abortPayload).toBeDefined();
    expect(finishReason).toBe('abort');
    await expect(result.output.finishReason).resolves.toBe('abort');
  }

  it('abortThreadStream stops the run on the worker', async () => {
    await streamAndAbortThroughAgent((durableAgent, _runId, scope) => durableAgent.abortThreadStream(scope));
  });

  it('abortRunStream stops the run on the worker', async () => {
    await streamAndAbortThroughAgent((durableAgent, runId) => durableAgent.abortRunStream(runId));
  });

  it('fails fast when the worker dies after readiness', async () => {
    const handle = await startWorker();
    // No disarm — any post-readiness exit must reject `exited`. SIGTERM (unlike
    // SIGKILL) is forwarded by the npx wrapper to the tsx child, so the worker
    // process tree actually dies instead of leaving an orphan behind.
    handle.proc.kill('SIGTERM');
    await expect(handle.exited).rejects.toThrow(/exited unexpectedly/);
  });

  // Per-test timeout encodes "promptly": before the signalCode guard in
  // terminateWorker, a pre-readiness signal exit made cleanup await an `exit`
  // event that had already fired, so the readiness promise never settled and
  // only the suite timeout caught it.
  it('rejects readiness promptly when the worker is signal-killed before readiness', { timeout: 15_000 }, async () => {
    const { proc, whenReady } = spawnWorker();
    proc.kill('SIGTERM');
    await expect(whenReady).rejects.toThrow(/exited unexpectedly/);
  });
});
