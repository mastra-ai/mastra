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
 */
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { LLMock } from '@copilotkit/aimock';
import { createClient } from 'redis';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  flushRedis,
  getFreePort,
  killProcess,
  makeStorageDir,
  PACKAGE_DIR,
  REDIS_URL,
  spawnFixture,
  waitForLine,
  waitForServerHttp,
} from '../test-fixtures/harness';
import type { ManagedProcess } from '../test-fixtures/harness';

const ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/observe-index-restart.entry.ts');

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

describe.each(['durable', 'evented'] as const)('observe by index across an API restart (%s, Redis)', engine => {
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
        env: { ...env, ROLE: role, PORT: String(port), MASTRA_WORKERS: role === 'worker' ? 'orchestration' : 'false' },
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
      { toolCalls: [{ id: 'call_lookup', name: 'lookup', arguments: JSON.stringify({ n: 1 }) }] },
    );
    llm.on(
      { endpoint: 'chat', predicate: (req: any) => toolResults(req) === 1 },
      { toolCalls: [{ id: 'call_gate', name: 'wait_gate', arguments: '{}' }] },
    );
    llm.on({ endpoint: 'chat', predicate: (req: any) => toolResults(req) === 2 }, { content: 'Gate released.' });

    const worker = await launch('worker', `${engine}-worker`);
    const api = await launch('api', `${engine}-api-1`);
    try {
      const runId = randomUUID();
      const streamed = await open(api.url, '/api/agents/agent/stream', {
        messages: 'Look up 1, then wait for the gate.',
        runId,
        maxSteps: 4,
      });
      await waitForLine(engine === 'evented' ? worker.child : api.child, 'gate-entered', 30_000);
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
      const resumed = await open(restarted.url, '/api/agents/agent/observe', {
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
      const full = await open(replayUrl, '/api/agents/agent/observe', { runId, offset: 0 });
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
