/**
 * A run's total deadline must stop work running on a different worker.
 *
 * Two serve() workers run as separate processes behind a round-robin proxy, so the run's steps
 * are spread across them and none runs in the process that called `stream()`. At the deadline
 * the caller publishes an abort request carrying the timeout, the worker running the slow tool
 * stops it as a timeout, and the caller sees one timeout error.
 *
 * The deadline's abort request goes out once, live, so the tests also cover a worker that first
 * sees the run after it went out (a step held at the proxy, then served by a worker that never
 * saw the run): the deadline carried on the run's request context stops it there.
 *
 * Runs against a real Inngest dev server with the model served by aimock.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, request } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { INNGEST_PORT, startServeInngestDevServer, stopInngestDevServer } from './durable-agent.test.utils';
import { DEADLINE_TOOL_MS, buildDeadlineCrossWorkerAgent } from './fixtures/deadline-cross-worker-agent';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 120_000 });

const AGENT_ID = 'deadline-cross-worker-agent';
const DB_PATH = `/tmp/mastra-deadline-cross-worker-${Date.now()}.db`;
const DB_URL = `file:${DB_PATH}`;
const OUT_DIR = mkdtempSync(path.join(tmpdir(), 'deadline-cross-worker-out-'));
const EVENTS = path.join(OUT_DIR, 'events.jsonl');
const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'deadline-cross-worker-worker.ts');
const DEADLINE_MS = 4_000;

type ToolEvent = {
  worker: string;
  event: 'tool-started' | 'tool-aborted' | 'output-pass';
  reason?: string;
  finishReason?: string;
};

let mock: LLMock;
let devServer: ChildProcess | null = null;
let proxy: Server;
const workers: ChildProcess[] = [];
let ports: { a: number; b: number; c: number };
/** Where the proxy sends requests. `hold`, while set, delays every request until it resolves. */
const routing: { targets: number[]; hold?: Promise<void> } = { targets: [] };
let driver: ReturnType<typeof buildDeadlineCrossWorkerAgent>;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function killGroup(proc: ChildProcess, signal: NodeJS.Signals) {
  try {
    process.kill(-proc.pid!, signal);
  } catch {
    // already exited
  }
}

function startWorker(port: number, name: string): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'npx',
      ['tsx', WORKER, DB_URL, AGENT_ID, String(INNGEST_PORT), mock.url, OUT_DIR, String(port), name],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        // Own process group, so teardown also stops the node process tsx starts.
        detached: true,
        env: { ...process.env, INNGEST_DEV: '1', INNGEST_BASE_URL: `http://localhost:${INNGEST_PORT}` },
      },
    );
    const timer = setTimeout(() => {
      killGroup(proc, 'SIGKILL');
      reject(new Error(`worker ${name} did not become ready in 90s`));
    }, 90_000);
    const onData = (buf: Buffer) => {
      if (buf.toString().includes('[worker] ready')) {
        clearTimeout(timer);
        resolve(proc);
      }
    };
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.on('exit', code => {
      clearTimeout(timer);
      reject(new Error(`worker ${name} exited early with code ${code}`));
    });
  });
}

/** Forward each request to the next worker in turn, keeping the Host header so the app registers the proxy URL. */
function startRoundRobinProxy(port: number): Promise<Server> {
  let next = 0;
  const server = createServer(async (req, res) => {
    req.pause();
    await routing.hold;
    const target = routing.targets[next++ % routing.targets.length]!;
    const upstream = request(
      { host: '127.0.0.1', port: target, path: req.url, method: req.method, headers: req.headers },
      upstreamRes => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );
    upstream.on('error', () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });
  return new Promise(resolve => server.listen(port, () => resolve(server)));
}

async function drain(res: Awaited<ReturnType<typeof driver.durableAgent.stream>>) {
  const chunks: { type: string; payload?: any }[] = [];
  try {
    for await (const chunk of res.output.fullStream as AsyncIterable<{ type: string; payload?: any }>) {
      chunks.push(chunk);
    }
  } catch {
    // The run ends with the timeout error.
  } finally {
    res.cleanup?.();
  }
  return chunks;
}

const modelCalls = () => mock.getRequests().filter(entry => entry.path.includes('/chat/completions')).length;

const toolEvents = (): ToolEvent[] =>
  existsSync(EVENTS)
    ? readFileSync(EVENTS, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line))
    : [];

describe('Inngest durable agent total deadline across workers (real Inngest dev server)', () => {
  beforeAll(async () => {
    mock = new LLMock({ port: 0 });
    await mock.start();

    const proxyPort = await freePort();
    ports = { a: await freePort(), b: await freePort(), c: await freePort() };
    workers.push(await startWorker(ports.a, 'a'));
    workers.push(await startWorker(ports.b, 'b'));
    // Serves no step until a test routes one to it, so it first sees a run when that step arrives.
    workers.push(await startWorker(ports.c, 'c'));
    routing.targets = [ports.a, ports.b];
    proxy = await startRoundRobinProxy(proxyPort);
    devServer = await startServeInngestDevServer(`http://localhost:${proxyPort}/inngest/api`);
    await vi.waitFor(
      async () => {
        const data = await (await fetch(`http://localhost:${INNGEST_PORT}/dev`)).json();
        const registered = (data.functions ?? []).some((fn: { slug?: string }) =>
          fn.slug?.endsWith('workflow.inngest:durable-agentic-loop'),
        );
        if (!registered) throw new Error('durable loop function not registered yet');
      },
      { timeout: 60_000, interval: 500 },
    );

    // The driver only calls stream(); it serves no steps.
    driver = buildDeadlineCrossWorkerAgent({
      dbUrl: DB_URL,
      agentId: AGENT_ID,
      inngestPort: INNGEST_PORT,
      mockUrl: mock.url,
      outDir: OUT_DIR,
      workerName: 'driver',
    });
  });

  beforeEach(() => {
    routing.targets = [ports.a, ports.b];
    routing.hold = undefined;
    rmSync(EVENTS, { force: true });
    mock.clearFixtures();
    mock.clearRequests();
    mock.resetMatchCounts();
    mock.on(
      { endpoint: 'chat', predicate: req => !JSON.stringify(req.messages).includes('call-slow') },
      { toolCalls: [{ id: 'call-slow', name: 'slow', arguments: '{}' }] },
    );
    mock.on(
      { endpoint: 'chat', predicate: req => JSON.stringify(req.messages).includes('call-slow') },
      { content: 'Must not reach the model again.' },
    );
  });

  afterAll(async () => {
    for (const worker of workers) killGroup(worker, 'SIGTERM');
    await new Promise(r => setTimeout(r, 500));
    for (const worker of workers) killGroup(worker, 'SIGKILL');
    await new Promise<void>(resolve => (proxy ? proxy.close(() => resolve()) : resolve()));
    await stopInngestDevServer(devServer);
    await mock?.stop();
    rmSync(OUT_DIR, { recursive: true, force: true });
    rmSync(DB_PATH, { force: true });
  });

  it('stops a tool on another worker at the deadline and reports one timeout', async () => {
    const res = await driver.durableAgent.stream([{ role: 'user', content: 'Do the slow work.' }], {
      memory: { thread: `thread-${crypto.randomUUID()}`, resource: 'user-a' },
      maxSteps: 3,
      modelSettings: { timeout: { totalMs: DEADLINE_MS } },
    });
    const chunks = await drain(res);

    const errors = chunks.filter(chunk => chunk.type === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.payload.error).toMatchObject({ name: 'MastraTimeoutError' });

    // The tool ran on a worker, never the driver, and stopped there as a timeout.
    await vi.waitFor(() => expect(toolEvents().some(event => event.event === 'tool-aborted')).toBe(true), {
      timeout: 5_000,
      interval: 100,
    });
    const events = toolEvents();
    const started = events.filter(event => event.event === 'tool-started');
    expect(started).toHaveLength(1);
    expect(started[0]!.worker).not.toBe('driver');
    expect(events).toContainEqual({ worker: started[0]!.worker, event: 'tool-aborted', reason: 'MastraTimeoutError' });

    // Give a run the deadline did not stop time to finish the tool and call the model again.
    await new Promise(r => setTimeout(r, DEADLINE_TOOL_MS + 2_000));
    expect(modelCalls()).toBe(1);
  });

  it('abort() still stops a tool on another worker as a user abort', async () => {
    const threadId = `thread-${crypto.randomUUID()}`;
    const res = await driver.durableAgent.stream([{ role: 'user', content: 'Do the slow work.' }], {
      memory: { thread: threadId, resource: 'user-a' },
      maxSteps: 3,
    });
    const consumed = (async () => {
      try {
        for await (const _chunk of res.output.fullStream) {
          // Drain the stream until the run ends.
        }
      } catch {
        // The abort path may error the stream.
      } finally {
        res.cleanup?.();
      }
    })();
    await vi.waitFor(() => expect(toolEvents().some(event => event.event === 'tool-started')).toBe(true), {
      timeout: 60_000,
      interval: 200,
    });

    await res.abort();
    await consumed;

    await expect(res.output.finishReason).resolves.toBe('aborted');
    const aborted = toolEvents().filter(event => event.event === 'tool-aborted');
    expect(aborted).toHaveLength(1);
    expect(aborted[0]!.reason).not.toBe('MastraTimeoutError');
    await new Promise(r => setTimeout(r, DEADLINE_TOOL_MS + 2_000));
    expect(modelCalls()).toBe(1);
  });

  it('ends an aborted run on a fresh worker that never heard the abort', async () => {
    const res = await driver.durableAgent.stream([{ role: 'user', content: 'Do the slow work.' }], {
      memory: { thread: `thread-${crypto.randomUUID()}`, resource: 'user-a' },
      maxSteps: 3,
    });
    const consumed = drain(res);
    await vi.waitFor(() => expect(toolEvents().some(event => event.event === 'tool-started')).toBe(true), {
      timeout: 60_000,
      interval: 200,
    });

    // Send the steps after the tool to worker c, which has never seen the run and subscribes too late
    // to hear the abort: only the stop the tool step returns tells it the run was aborted.
    routing.targets = [ports.c];
    await res.abort();
    await consumed;

    await vi.waitFor(() => expect(toolEvents().find(event => event.event === 'output-pass')).toBeDefined(), {
      timeout: DEADLINE_TOOL_MS + 10_000,
      interval: 200,
    });
    expect(toolEvents().filter(event => event.event === 'output-pass')).toEqual([
      { worker: 'c', event: 'output-pass', finishReason: 'abort' },
    ]);
    expect(modelCalls()).toBe(1);
  });

  it('stops a step that first reaches a worker after the deadline was published', async () => {
    // Hold the run's first step past the deadline, then send it to worker c, which has never seen the
    // run: it subscribes to the run's abort requests after the deadline's went out.
    routing.targets = [ports.c];
    routing.hold = new Promise(resolve => setTimeout(resolve, DEADLINE_MS + 1_000));
    const res = await driver.durableAgent.stream([{ role: 'user', content: 'Do the slow work.' }], {
      memory: { thread: `thread-${crypto.randomUUID()}`, resource: 'user-a' },
      maxSteps: 3,
      modelSettings: { timeout: { totalMs: DEADLINE_MS } },
    });
    const chunks = await drain(res);

    const errors = chunks.filter(chunk => chunk.type === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.payload.error).toMatchObject({ name: 'MastraTimeoutError' });

    // A worker that missed the deadline would call the model and run the tool.
    await new Promise(r => setTimeout(r, DEADLINE_TOOL_MS + 2_000));
    expect(modelCalls()).toBe(0);
    expect(toolEvents().filter(event => event.event === 'tool-started')).toEqual([]);
  });

  it('ends the run as the timeout when its last step reaches a fresh worker after the deadline', async () => {
    // The model answers at once. As it does, hold the run's remaining steps past the deadline and send
    // them to worker c, which has no state for the run: only the deadline carried on the request
    // context tells it the run timed out.
    mock.clearFixtures();
    let routed = false;
    mock.on(
      {
        endpoint: 'chat',
        predicate: () => {
          if (!routed) {
            routed = true;
            routing.targets = [ports.c];
            routing.hold = new Promise(resolve => setTimeout(resolve, DEADLINE_MS + 1_000));
          }
          return true;
        },
      },
      { content: 'Answered just before the deadline.' },
    );
    const chunks = await drain(
      await driver.durableAgent.stream([{ role: 'user', content: 'Answer quickly.' }], {
        memory: { thread: `thread-${crypto.randomUUID()}`, resource: 'user-a' },
        maxSteps: 3,
        modelSettings: { timeout: { totalMs: DEADLINE_MS } },
      }),
    );

    const errors = chunks.filter(chunk => chunk.type === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.payload.error).toMatchObject({ name: 'MastraTimeoutError' });
    expect(modelCalls()).toBe(1);

    // The caller reports the timeout at the deadline either way; worker c must end the run as that
    // timeout too, not as a normal finish.
    await vi.waitFor(() => expect(toolEvents().find(event => event.event === 'output-pass')).toBeDefined(), {
      timeout: 10_000,
      interval: 200,
    });
    expect(toolEvents().filter(event => event.event === 'output-pass')).toEqual([
      { worker: 'c', event: 'output-pass', finishReason: 'error' },
    ]);
  });
});
