/**
 * observe() across two processes of one deploy: two Mastra instances share a
 * LibSQL file, RedisStreamsPubSub and a Redis server cache. One process owns
 * the durable run; the other only calls `observe(runId)`.
 *
 * Contract under test (the same one the in-process observe-lifecycle scenario
 * pins): an observation closes on its own once nothing will ever publish to
 * the run again (unknown run, finished run) and stays attached while the run
 * is live or suspended for approval, following it through the resume to its
 * finish.
 *
 * Requires a Redis server at REDIS_URL. The model is served by AIMock in this
 * process; children reach it over HTTP.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { LLMock } from '@copilotkit/aimock';
import { createClient } from 'redis';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  flushRedis,
  getFreePort,
  killProcess,
  makeStorageDir,
  PACKAGE_DIR,
  REDIS_URL,
  spawnFixture,
  TSX_BIN,
  waitForLine,
  waitForServerHttp,
} from '../test-fixtures/harness';
import type { ManagedProcess } from '../test-fixtures/harness';

const ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/observe-node.entry.ts');
/** Long enough that a hanging observation is unambiguous. */
const CLOSE_WITHIN_MS = 10_000;

type NodeEvent = { node: string; type: string; [key: string]: any };

class Node {
  readonly events: NodeEvent[] = [];
  private buffer = '';
  stderr = '';
  constructor(readonly proc: ChildProcess) {
    proc.stdout!.on('data', data => {
      this.buffer += data.toString();
      let newline: number;
      while ((newline = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, newline);
        this.buffer = this.buffer.slice(newline + 1);
        try {
          this.events.push(JSON.parse(line));
        } catch {
          // non-protocol output (warnings) is ignored
        }
      }
    });
    proc.stderr!.on('data', data => (this.stderr += data.toString()));
  }

  send(cmd: Record<string, unknown>) {
    this.proc.stdin!.write(`${JSON.stringify(cmd)}\n`);
  }

  async next(match: (event: NodeEvent) => boolean, timeoutMs = 30_000): Promise<NodeEvent> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const error = this.events.find(event => event.type === 'error');
      if (error) throw new Error(`${error.node} failed: ${error.message}`);
      const found = this.events.find(match);
      if (found) return found;
      if (this.proc.exitCode !== null) throw new Error(`node exited ${this.proc.exitCode}: ${this.stderr}`);
      await new Promise(r => setTimeout(r, 50));
    }
    throw new Error(`timed out waiting on node; events: ${JSON.stringify(this.events)}; stderr: ${this.stderr}`);
  }

  observed(id: string) {
    return this.events.filter(event => event.id === id && event.type === 'chunk').map(event => event.chunk as string);
  }

  textOf(id: string) {
    return this.events
      .filter(event => event.id === id && event.chunk === 'text-delta')
      .map(event => event.text)
      .join('');
  }

  isClosed(id: string) {
    return this.events.some(event => event.id === id && event.type === 'closed');
  }

  /** Observes `runId` and waits for the observation to close on its own. */
  async observeToClose(id: string, runId: string) {
    this.send({ cmd: 'observe', id, runId });
    await this.next(event => event.id === id && event.type === 'closed', CLOSE_WITHIN_MS);
    return this.observed(id);
  }

  async stop() {
    if (this.proc.exitCode !== null) return;
    const exited = new Promise(r => this.proc.once('exit', r));
    this.proc.kill('SIGTERM');
    await Promise.race([exited, new Promise(r => setTimeout(r, 5_000))]);
    if (this.proc.exitCode === null) this.proc.kill('SIGKILL');
  }
}

const skipRedis = !process.env.REDIS_URL && !process.env.CI && process.env.SKIP_REDIS_TESTS === '1';

for (const engine of ['durable', 'evented'] as const) {
  describe.skipIf(skipRedis)(`observe() across two Mastra processes (${engine}, LibSQL file + Redis)`, () => {
    let llm: LLMock;
    let producer: Node;
    let observer: Node;
    let cleanupStorage: () => Promise<void>;

    beforeAll(async () => {
      llm = new LLMock({ port: 0 });
      await llm.start();
    });

    afterAll(async () => {
      await llm.stop();
    });

    beforeEach(async () => {
      await flushRedis();
      const storage = await makeStorageDir('mastra-observe-');
      cleanupStorage = storage.cleanup;
      const env = {
        REDIS_URL,
        KEY_PREFIX: `observe-${randomUUID()}`,
        STORAGE_URL: storage.storageUrl,
        LLM_URL: llm.url.replace(/\/+$/, ''),
        ENGINE: engine,
        PREWRAPPED_PUBSUB: engine === 'evented' ? '1' : '0',
      };
      const start = (nodeId: string) =>
        new Node(
          spawn(TSX_BIN, [ENTRY], {
            cwd: PACKAGE_DIR,
            env: { ...process.env, ...env, NODE_ID: nodeId },
            stdio: ['pipe', 'pipe', 'pipe'],
          }),
        );
      producer = start('producer');
      observer = start('observer');
      await Promise.all([producer.next(e => e.type === 'ready'), observer.next(e => e.type === 'ready')]);
    });

    afterEach(async () => {
      llm.clearFixtures?.();
      llm.reset?.();
      await Promise.all([producer?.stop(), observer?.stop()]);
      await cleanupStorage?.();
    });

    it('closes an observation of a run no process knows', async () => {
      expect(await observer.observeToClose('unknown', `run-${randomUUID()}`)).toEqual([]);
    });

    it('replays a run the other process finished, then closes', async () => {
      llm.on({ endpoint: 'chat' }, { content: 'Finished elsewhere.' });
      producer.send({ cmd: 'stream', prompt: 'Go' });
      const { runId } = await producer.next(e => e.type === 'stream-done');

      const types = await observer.observeToClose('finished', runId);

      expect(observer.textOf('finished')).toBe('Finished elsewhere.');
      expect(types.filter(type => type === 'text-delta')).toHaveLength(1);
      expect(types.filter(type => type === 'finish')).toHaveLength(1);
      expect(types.at(-1)).toBe('finish');
    });

    it('follows a live run owned by the other process and closes on its finish', async () => {
      llm.on(
        { endpoint: 'chat', predicate: (req: any) => !req.messages.some((m: any) => m.role === 'tool') },
        { toolCalls: [{ id: 'call_gate', name: 'wait_gate', arguments: JSON.stringify({ step: 'one' }) }] },
      );
      llm.on(
        { endpoint: 'chat', predicate: (req: any) => req.messages.some((m: any) => m.role === 'tool') },
        { content: 'Gate released.' },
      );
      producer.send({ cmd: 'stream', prompt: 'Wait for the gate' });
      const { runId } = await producer.next(e => e.type === 'run');
      await producer.next(e => e.type === 'tool-started');

      observer.send({ cmd: 'observe', id: 'live', runId });
      await observer.next(e => e.id === 'live' && e.type === 'chunk' && e.chunk === 'tool-call');
      // Run is parked in a tool with no publishes pending: the observation must stay attached.
      expect(observer.isClosed('live')).toBe(false);

      producer.send({ cmd: 'release' });
      await producer.next(e => e.type === 'stream-done');
      await observer.next(e => e.id === 'live' && e.type === 'closed', CLOSE_WITHIN_MS);

      expect(observer.textOf('live')).toBe('Gate released.');
      expect(observer.observed('live').at(-1)).toBe('finish');
    });

    it('stays attached across an approval suspend and follows the resume to its finish', async () => {
      llm.on(
        { endpoint: 'chat', predicate: (req: any) => !req.messages.some((m: any) => m.role === 'tool') },
        { toolCalls: [{ id: 'call_approve', name: 'lookup_status', arguments: JSON.stringify({ query: 'alpha' }) }] },
      );
      llm.on(
        { endpoint: 'chat', predicate: (req: any) => req.messages.some((m: any) => m.role === 'tool') },
        { content: 'Approved: OK:alpha.' },
      );
      producer.send({ cmd: 'stream', prompt: 'Look up alpha', requireToolApproval: true });
      const { runId, toolCallId } = await producer.next(e => e.type === 'approval');

      observer.send({ cmd: 'observe', id: 'suspended', runId });
      await observer.next(e => e.id === 'suspended' && e.type === 'chunk' && e.chunk === 'tool-call-approval');
      expect(observer.isClosed('suspended')).toBe(false);

      producer.send({ cmd: 'approve', runId, toolCallId });
      await producer.next(e => e.type === 'resume-done');
      await observer.next(e => e.id === 'suspended' && e.type === 'closed', CLOSE_WITHIN_MS);

      expect(producer.events.filter(e => e.type === 'tool-executed')).toHaveLength(1);
      expect(observer.textOf('suspended')).toBe('Approved: OK:alpha.');
      expect(observer.observed('suspended').at(-1)).toBe('finish');
    });
  });
}

/**
 * Restarting the agents API mid-run must not break resuming by index
 * (COR-1506). In a split deploy the worker keeps executing the run while the
 * API process that served `/stream` dies. A client that kept the last frame's
 * `index` reconnects to the new API process and observes from `index + 1`: it
 * must get the rest of the run, live, with nothing repeated or missing, and
 * the observation must close on the run's finish.
 *
 * API and worker share a LibSQL file, RedisStreamsPubSub and a Redis server
 * cache. On the evented engine the orchestration worker executes the run and
 * the API that served `/stream` is killed. A durable agent executes in the API
 * process that started it, so that process stays up; the client drops its
 * connection and resumes on a freshly booted API process. Requires a Redis server at
 * REDIS_URL; the model is served by AIMock in this process.
 *
 * Runs observe-node.entry.ts in its split-deploy mode (ROLE=api / ROLE=worker).
 */

type Frame = { type: string; index?: number; payload?: any };

/** Reads frames as the server writes them; `done` settles when the response ends or the socket drops. */
async function open(url: string, path: string, body: unknown) {
  const controller = new AbortController();
  const res = await fetch(url + path, {
    method: 'POST',
    signal: controller.signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status !== 200) throw new Error(`${path} ${res.status}: ${await res.text()}`);
  const frames: Frame[] = [];
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const done = (async () => {
    let text = '';
    try {
      for (;;) {
        const { value, done: ended } = await reader.read();
        if (ended) return;
        text += decoder.decode(value, { stream: true });
        // SSE (`data: <json>\n\n`) or record-separated JSON (`<json>\x1E`).
        let sep: number;
        while ((sep = text.search(/\n\n|\x1E/)) !== -1) {
          const record = text.slice(0, sep);
          text = text.slice(sep + (text[sep] === '\x1E' ? 1 : 2));
          const data = record.startsWith('data:')
            ? record
                .split('\n')
                .filter(line => line.startsWith('data:'))
                .map(line => line.slice(5).trim())
                .join('')
            : record.trim();
          if (data && data !== '[DONE]') frames.push(JSON.parse(data));
        }
      }
    } catch {
      // connection dropped
    }
  })();
  return { frames, done, drop: () => controller.abort() };
}

const within = <T>(promise: Promise<T>, ms: number, what: string) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${what} timed out`)), ms)),
  ]);

for (const engine of ['durable', 'evented'] as const) {
  describe.skipIf(skipRedis)(`observe by index across an API restart (${engine}, Redis)`, () => {
    let llm: LLMock;
    let redis: ReturnType<typeof createClient>;
    const processes: ManagedProcess[] = [];
    let cleanupStorage: (() => Promise<void>) | undefined;

    beforeAll(async () => {
      llm = new LLMock({ port: 0 });
      await llm.start();
      redis = createClient({ url: REDIS_URL });
      await redis.connect();
    });

    afterAll(async () => {
      await llm.stop();
      await redis.quit().catch(() => {});
    });

    afterEach(async () => {
      await Promise.all(processes.splice(0).map(child => killProcess(child, 'SIGKILL')));
      await cleanupStorage?.();
      llm.reset();
    });

    it('resumes from the last received index + 1 on a new API process while the worker keeps running', async () => {
      await flushRedis();
      const storage = await makeStorageDir('mastra-observe-index-restart-');
      cleanupStorage = storage.cleanup;
      const keyPrefix = `observe-index-${randomUUID()}`;
      const env = {
        REDIS_URL,
        KEY_PREFIX: keyPrefix,
        STORAGE_URL: storage.storageUrl,
        LLM_URL: llm.url.replace(/\/+$/, ''),
        ENGINE: engine,
        // Plain node with the tsx loader, so a kill reaches the server itself.
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import tsx`,
      };
      const launch = async (role: 'api' | 'worker', label: string) => {
        const port = await getFreePort();
        const child = spawnFixture({
          entry: ENTRY,
          label,
          binary: process.execPath,
          env: {
            ...env,
            ROLE: role,
            PORT: String(port),
            MASTRA_WORKERS: role === 'worker' ? 'orchestration' : 'false',
          },
        });
        processes.push(child);
        await waitForLine(child, 'ready', 60_000);
        const url = `http://localhost:${port}`;
        if (role === 'api') await waitForServerHttp(url);
        return { child, url };
      };

      const toolResults = (req: any) => req.messages.filter((m: any) => m.role === 'tool').length;
      llm.on(
        { endpoint: 'chat', predicate: (req: any) => toolResults(req) === 0 },
        { toolCalls: [{ id: 'call_lookup', name: 'lookup_status', arguments: JSON.stringify({ query: '1' }) }] },
      );
      llm.on(
        { endpoint: 'chat', predicate: (req: any) => toolResults(req) === 1 },
        { toolCalls: [{ id: 'call_gate', name: 'wait_gate', arguments: JSON.stringify({ step: 'gate' }) }] },
      );
      llm.on({ endpoint: 'chat', predicate: (req: any) => toolResults(req) === 2 }, { content: 'Gate released.' });

      const worker = await launch('worker', `${engine}-worker`);
      const api = await launch('api', `${engine}-api-1`);
      try {
        const runId = randomUUID();
        const streamed = await open(api.url, '/api/agents/observerAgent/stream', {
          messages: 'Look up 1, then wait for the gate.',
          runId,
          maxSteps: 4,
        });
        await waitForLine(engine === 'evented' ? worker.child : api.child, '"type":"tool-started"', 30_000);
        // Let the gate's tool-call frame reach the client before the API dies.
        await within(
          (async () => {
            while (!streamed.frames.some(f => f.type === 'tool-call' && f.payload?.toolName === 'wait_gate')) {
              await new Promise(r => setTimeout(r, 25));
            }
          })(),
          10_000,
          'gate tool-call frame on /stream',
        );

        if (engine === 'evented') {
          // The orchestration worker executes evented runs, so the API can die mid-run.
          await killProcess(api.child, 'SIGKILL');
        } else {
          // A durable agent executes in the API process that started it; that
          // process stays up, and the client reconnects to a freshly booted one.
          streamed.drop();
        }
        await within(streamed.done, 10_000, '/stream closing');
        const received = streamed.frames;
        expect(received.every(f => typeof f.index === 'number')).toBe(true);
        expect(received.some(f => f.type === 'finish')).toBe(false);

        const restarted = await launch('api', `${engine}-api-2`);
        const resumed = await open(restarted.url, '/api/agents/observerAgent/observe', {
          runId,
          offset: received.at(-1)!.index! + 1,
        });
        // The run is parked in the gate: the resumed observation is attached and waiting.
        await new Promise(r => setTimeout(r, 500));
        expect(resumed.frames.filter(f => f.type === 'text-delta')).toEqual([]);

        await redis.set(`${keyPrefix}:gate`, '1');
        await within(resumed.done, 30_000, 'resumed /observe closing on finish');
        expect(resumed.frames.at(-1)?.type).toBe('finish');

        // A finished durable run is only authorized by the process that executed
        // it (a fresh API process answers 404), so replay it there.
        const replayUrl = engine === 'evented' ? restarted.url : api.url;
        const full = await open(replayUrl, '/api/agents/observerAgent/observe', { runId, offset: 0 });
        await within(full.done, 15_000, 'full /observe replay');
        expect([...received, ...resumed.frames]).toEqual(full.frames);
        expect(
          full.frames
            .filter(f => f.type === 'text-delta')
            .map(f => f.payload?.text)
            .join(''),
        ).toBe('Gate released.');
      } catch (error) {
        throw new Error(processes.map(child => `[${child.label}]\n${child.stdout}\n${child.stderr}`).join('\n'), {
          cause: error,
        });
      }
    }, 120_000);
  });
}
