import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { INNGEST_PORT, startConnectInngestDevServer, stopInngestDevServer } from './durable-agent.test.utils';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 120_000 });

// Regression for #29766: when the process that started a run dies, the run keeps executing on the Inngest worker.
// A second message on the same thread must not start a run that executes beside it.

const agentId = 'thread-lease-agent';
const workDir = mkdtempSync(path.join(tmpdir(), 'mastra-thread-lease-'));
const dbUrl = pathToFileURL(path.join(workDir, 'mastra.db')).href;
const socketPath = path.join(workDir, 'pubsub.sock');
const logPath = path.join(workDir, 'tools.log');
const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

let worker: ChildProcess | undefined;
let devServer: ChildProcess | null = null;
let builtAgent: ReturnType<typeof import('./fixtures/thread-lease-agent').buildThreadLeaseAgent> | undefined;

function spawnFixture(file: string, args: string[], readyMarker: string): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'npx',
      ['tsx', path.join(fixtures, file), dbUrl, agentId, String(INNGEST_PORT), socketPath, logPath, ...args],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, INNGEST_DEV: '1', INNGEST_BASE_URL: `http://localhost:${INNGEST_PORT}` },
      },
    );
    let settled = false;
    const timer = setTimeout(() => fail(new Error(`${file} did not print ${readyMarker}`)), 90_000);
    function fail(error: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      proc.kill('SIGKILL');
      reject(error);
    }
    const onData = (buffer: Buffer) => {
      if (!settled && buffer.toString().includes(readyMarker)) {
        settled = true;
        clearTimeout(timer);
        resolve(proc);
      }
    };
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.once('error', error => fail(error));
    proc.once('exit', code => fail(new Error(`${file} exited early with code ${code}`)));
  });
}

async function kill(proc: ChildProcess | undefined, signal: NodeJS.Signals): Promise<void> {
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return;
  const exited = new Promise<void>(resolve => proc.once('exit', () => resolve()));
  proc.kill(signal);
  await exited;
}

type ToolEvent = { event: string; tag: string; at: number };

function toolEvents(): ToolEvent[] {
  if (!existsSync(logPath)) return [];
  return readFileSync(logPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

async function waitForToolEvent(event: string, tag: string, timeoutMs: number): Promise<ToolEvent> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = toolEvents().find(entry => entry.event === event && entry.tag === tag);
    if (found) return found;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${event}:${tag}; saw ${JSON.stringify(toolEvents())}`);
}

describe('thread lease when the calling process dies (#29766)', () => {
  beforeAll(async () => {
    devServer = await startConnectInngestDevServer();
    worker = await spawnFixture('thread-lease-worker.ts', [], 'THREAD_LEASE_WORKER_READY');
  });

  afterAll(async () => {
    await kill(worker, 'SIGTERM');
    await builtAgent?.pubsub.close();
    await stopInngestDevServer(devServer);
  });

  it('does not run a second message beside a run whose caller was killed', async () => {
    const threadId = `thread-${Date.now()}`;
    const resourceId = `resource-${Date.now()}`;

    const callerA = await spawnFixture(
      'thread-lease-caller.ts',
      [threadId, resourceId, 'first'],
      'THREAD_LEASE_CALLER_STREAMING',
    );
    await waitForToolEvent('wait-start', 'first', 60_000);
    await kill(callerA, 'SIGKILL');
    // Give the worker a renewal interval to hold the lease the dead caller no longer renews.
    await new Promise(resolve => setTimeout(resolve, 7_000));

    const { buildThreadLeaseAgent } = await import('./fixtures/thread-lease-agent');
    builtAgent = buildThreadLeaseAgent({ dbUrl, agentId, inngestPort: INNGEST_PORT, socketPath, logPath });
    const result = await builtAgent.durableAgent.stream([{ role: 'user', content: 'second' }], {
      memory: { thread: threadId, resource: resourceId },
    });
    try {
      for await (const _ of result.output.fullStream) {
        // Consume through the finish event.
      }
    } finally {
      result.cleanup();
    }

    const firstSideEffect = await waitForToolEvent('side-effect', 'first', 60_000);
    const secondWaitStart = await waitForToolEvent('wait-start', 'second', 1_000);
    await waitForToolEvent('side-effect', 'second', 1_000);
    expect(secondWaitStart.at).toBeGreaterThanOrEqual(firstSideEffect.at);
    expect(toolEvents().filter(entry => entry.event === 'side-effect')).toHaveLength(2);
  });
});
