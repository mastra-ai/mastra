/**
 * Plain (non-durable) Agent runs observed and aborted through a server that
 * does not execute them.
 *
 * Two Mastra servers share a LibSQL file, RedisStreamsPubSub and
 * RedisServerCache, each behind the real HTTP server from `createNodeServer`
 * with SimpleAuth mapping a bearer token to a resource. The `owner` server
 * executes the run; the test calls the `other` server. Ownership comes from
 * the run's shared record, so the run's resource can observe and abort it from
 * either server, while other tenants, anonymous callers, and unknown or
 * expired runs are refused.
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
  makeStorageDir,
  PACKAGE_DIR,
  REDIS_URL,
  TSX_BIN,
  waitForServerHttp,
} from '../test-fixtures/harness';

const ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/plain-run-node.entry.ts');
const AGENT_ID = 'plain-agent';
const OWNER = 'token-a';
const OTHER_TENANT = 'token-b';

type NodeEvent = { node: string; type: string; [key: string]: any };
type Frame = { type: string; payload?: any };

/** A live HTTP observation: frames arrive as the server writes them. */
type Observation = { status: number; frames: Frame[]; done: Promise<void>; cancel: () => Promise<void> };

class Node {
  readonly events: NodeEvent[] = [];
  private buffer = '';
  stderr = '';
  constructor(
    readonly proc: ChildProcess,
    readonly url: string,
  ) {
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

  private headers(token?: string) {
    return { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) };
  }

  async abort(runId: string, token?: string) {
    const res = await fetch(`${this.url}/api/agents/${AGENT_ID}/runs/${runId}/abort`, {
      method: 'POST',
      headers: this.headers(token),
    });
    return { status: res.status, body: await res.json().catch(() => undefined) };
  }

  async observe(runId: string, token?: string, offset?: number): Promise<Observation> {
    const controller = new AbortController();
    const res = await fetch(`${this.url}/api/agents/${AGENT_ID}/observe`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({ runId, offset }),
      signal: controller.signal,
    });
    const frames: Frame[] = [];
    if (!res.ok || !res.body) {
      await res.body?.cancel();
      return { status: res.status, frames, done: Promise.resolve(), cancel: async () => {} };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const done = (async () => {
      let text = '';
      try {
        for (;;) {
          const { value, done: ended } = await reader.read();
          if (ended) break;
          text += decoder.decode(value, { stream: true });
          let sep: number;
          // Server-sent events: `data: <json>` records separated by a blank line.
          while ((sep = text.indexOf('\n\n')) !== -1) {
            const record = text.slice(0, sep);
            text = text.slice(sep + 2);
            const data = record
              .split('\n')
              .filter(line => line.startsWith('data:'))
              .map(line => line.slice(5).trim())
              .join('');
            if (data && data !== '[DONE]') frames.push(JSON.parse(data));
          }
        }
      } catch {
        // cancelled
      }
    })();
    return {
      status: res.status,
      frames,
      done,
      cancel: async () => {
        controller.abort();
        await done;
      },
    };
  }

  // tsx runs the entry in a child node process, so signal the whole process group or the real server survives.
  async stop() {
    if (this.proc.exitCode === null && this.proc.signalCode === null) {
      const exited = new Promise(r => this.proc.once('exit', r));
      try {
        process.kill(-this.proc.pid!, 'SIGTERM');
        await Promise.race([exited, new Promise(r => setTimeout(r, 5_000))]);
      } catch {
        /* already gone */
      }
    }
    try {
      process.kill(-this.proc.pid!, 'SIGKILL');
    } catch {
      /* group already gone */
    }
  }
}

const within = <T>(promise: Promise<T>, ms: number, what: string) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${what} timed out`)), ms)),
  ]);

const types = (frames: Frame[]) => frames.map(frame => frame.type);
const text = (frames: Frame[]) =>
  frames
    .filter(frame => frame.type === 'text-delta')
    .map(frame => frame.payload?.text ?? '')
    .join('');

describe('plain Agent runs across two servers (LibSQL file + Redis)', () => {
  let llm: LLMock;
  let owner: Node;
  let other: Node;
  let redis: ReturnType<typeof createClient>;
  let cleanupStorage: (() => Promise<void>) | undefined;
  let keyPrefix: string;

  const recordKey = (runId: string) => `${keyPrefix}:cache:agent.run.${AGENT_ID}.${runId}`;

  const startNodes = async (extraEnv: Record<string, string> = {}) => {
    await flushRedis();
    const storage = await makeStorageDir('mastra-plain-run-');
    cleanupStorage = storage.cleanup;
    keyPrefix = `plain-${randomUUID()}`;
    const env = {
      REDIS_URL,
      KEY_PREFIX: keyPrefix,
      STORAGE_URL: storage.storageUrl,
      LLM_URL: llm.url.replace(/\/+$/, ''),
      ...extraEnv,
    };
    const start = async (nodeId: string) => {
      const port = await getFreePort();
      return new Node(
        spawn(TSX_BIN, [ENTRY], {
          cwd: PACKAGE_DIR,
          env: { ...process.env, ...env, NODE_ID: nodeId, PORT: String(port) },
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: true,
        }),
        `http://localhost:${port}`,
      );
    };
    owner = await start('owner');
    other = await start('other');
    await Promise.all([owner.next(e => e.type === 'ready'), other.next(e => e.type === 'ready')]);
    await Promise.all([waitForServerHttp(owner.url), waitForServerHttp(other.url)]);
  };

  /** Starts an approval run on the owner and waits until it is parked. */
  const startSuspendedRun = async () => {
    owner.send({ cmd: 'stream', tool: 'approve', resourceId: 'user-a' });
    const { runId } = await owner.next(e => e.type === 'run');
    const { toolCallId } = await owner.next(e => e.type === 'suspended' && e.runId === runId);
    await owner.next(e => e.type === 'stream-done' && e.runId === runId);
    // The record turns 'suspended' right after the suspended event is published.
    await within(
      (async () => {
        while (JSON.parse((await redis.get(recordKey(runId))) ?? '{}').status !== 'suspended') {
          await new Promise(r => setTimeout(r, 25));
        }
      })(),
      5_000,
      'suspended record',
    );
    return { runId, toolCallId };
  };

  /** Starts a run whose tool blocks until aborted. */
  const startWaitingRun = async () => {
    owner.send({ cmd: 'stream', tool: 'wait', resourceId: 'user-a' });
    const { runId } = await owner.next(e => e.type === 'run');
    await owner.next(e => e.type === 'tool-started');
    return runId;
  };

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

  beforeEach(() => {
    llm.clearFixtures();
    llm.clearRequests();
    llm.resetMatchCounts();
    llm.on(
      {
        endpoint: 'chat',
        predicate: req =>
          JSON.stringify(req.messages).includes('Wait, then reply.') &&
          !JSON.stringify(req.messages).includes('call-wait'),
      },
      { toolCalls: [{ id: 'call-wait', name: 'wait', arguments: '{}' }] },
    );
    llm.on(
      { endpoint: 'chat', predicate: req => JSON.stringify(req.messages).includes('call-wait') },
      { content: 'Done waiting.' },
    );
    llm.on(
      {
        endpoint: 'chat',
        predicate: req =>
          !JSON.stringify(req.messages).includes('call-approve') &&
          JSON.stringify(req.messages).includes('Ask for approval.'),
      },
      { toolCalls: [{ id: 'call-approve', name: 'approve', arguments: '{}' }] },
    );
    llm.on(
      { endpoint: 'chat', predicate: req => JSON.stringify(req.messages).includes('call-approve') },
      { content: 'Approved and done.' },
    );
  });

  afterEach(async () => {
    await Promise.allSettled([owner?.stop(), other?.stop()]);
    await cleanupStorage?.();
    cleanupStorage = undefined;
  });

  describe('with replay caching', () => {
    beforeEach(() => startNodes());

    it('lets the owner follow a suspended run from the other server through approval to its finish', async () => {
      const { runId, toolCallId } = await startSuspendedRun();

      // The record is shared and bounded by the run log's TTL while parked.
      const stored = JSON.parse((await redis.get(recordKey(runId)))!);
      expect(stored).toMatchObject({ agentId: AGENT_ID, runId, resourceId: 'user-a', status: 'suspended' });
      const ttl = await redis.pTTL(recordKey(runId));
      expect(ttl).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(ttl).toBeLessThanOrEqual(24 * 60 * 60 * 1000);

      const live = await other.observe(runId, OWNER);
      expect(live.status).toBe(200);
      // Replay of the first segment arrives; suspension does not end the observation.
      await within(
        (async () => {
          while (!types(live.frames).includes('tool-call-approval')) await new Promise(r => setTimeout(r, 50));
        })(),
        10_000,
        'replay of the approval request',
      );
      await new Promise(r => setTimeout(r, 500));
      expect(types(live.frames)).not.toContain('finish');

      owner.send({ cmd: 'approve', runId, toolCallId, resourceId: 'user-a' });
      const approved = await owner.next(e => e.type === 'approved-done' && e.runId === runId);
      expect(approved.toolRuns).toBe(1);

      await within(live.done, 10_000, 'live observation');
      expect(types(live.frames).at(-1)).toBe('finish');
      expect(types(live.frames)).toContain('tool-result');
      expect(text(live.frames)).toBe('Approved and done.');

      // A fresh replay from the other server holds both segments.
      const replay = await other.observe(runId, OWNER);
      await within(replay.done, 10_000, 'replay');
      expect(types(replay.frames)).toContain('tool-call-approval');
      expect(text(replay.frames)).toBe('Approved and done.');
      expect(types(replay.frames).at(-1)).toBe('finish');

      expect(JSON.parse((await redis.get(recordKey(runId)))!).status).toBe('finished');
      // A finished run cannot be aborted, and that is reported, not faked.
      expect(await other.abort(runId, OWNER)).toEqual({ status: 200, body: { aborted: false } });
    });

    it('refuses other tenants, anonymous callers and unknown runs on both servers', async () => {
      const { runId } = await startSuspendedRun();

      for (const node of [owner, other]) {
        expect((await node.observe(runId, OTHER_TENANT)).status).toBe(403);
        expect((await node.abort(runId, OTHER_TENANT)).status).toBe(403);
        expect((await node.observe(runId)).status).toBe(401);
        expect((await node.abort(runId)).status).toBe(401);
        expect((await node.observe(randomUUID(), OWNER)).status).toBe(404);
        expect((await node.abort(randomUUID(), OWNER)).status).toBe(404);
      }
    });

    it("aborts a running run through the other server once the owner's process confirms", async () => {
      const runId = await startWaitingRun();

      expect((await other.abort(runId, OTHER_TENANT)).status).toBe(403);
      expect(owner.events.some(e => e.type === 'tool-finished')).toBe(false);

      expect(await other.abort(runId, OWNER)).toEqual({ status: 200, body: { aborted: true } });
      const done = await owner.next(e => e.type === 'stream-done' && e.runId === runId, 15_000);
      expect(owner.events.find(e => e.type === 'tool-finished')?.aborted).toBe(true);
      expect(done.finishReason).not.toBe('stop');
      expect(llm.getRequests()).toHaveLength(1);
    });

    it('reports an unconfirmed abort of a run parked on another server as false', async () => {
      const { runId } = await startSuspendedRun();
      // Nothing executes a parked run, so nobody can confirm the request.
      expect(await other.abort(runId, OWNER)).toEqual({ status: 200, body: { aborted: false } });
    });

    it('treats a run whose record expired as unknown', async () => {
      const { runId } = await startSuspendedRun();
      // Redis drops the key when its TTL elapses; deleting it is the same state.
      await redis.del(recordKey(runId));
      for (const node of [owner, other]) {
        expect((await node.observe(runId, OWNER)).status).toBe(404);
        expect((await node.abort(runId, OWNER)).status).toBe(404);
      }
    });
  });

  describe('with a short cleanup timeout', () => {
    beforeEach(() => startNodes({ CLEANUP_MS: '300' }));

    it('drops the record with the replay history once the run is cleaned up', async () => {
      const { runId, toolCallId } = await startSuspendedRun();
      owner.send({ cmd: 'approve', runId, toolCallId, resourceId: 'user-a' });
      await owner.next(e => e.type === 'approved-done' && e.runId === runId);

      await within(
        (async () => {
          while (await redis.exists(recordKey(runId))) await new Promise(r => setTimeout(r, 50));
        })(),
        5_000,
        'record cleanup',
      );
      expect((await other.observe(runId, OWNER)).status).toBe(404);
      expect((await other.abort(runId, OWNER)).status).toBe(404);
    });
  });

  describe('with replay caching off', () => {
    beforeEach(() => startNodes({ STREAMS_CACHE: 'false' }));

    it('still authorizes the owner from the server cache and follows the run', async () => {
      const { runId, toolCallId } = await startSuspendedRun();
      expect(JSON.parse((await redis.get(recordKey(runId)))!).status).toBe('suspended');

      expect((await other.observe(runId, OTHER_TENANT)).status).toBe(403);
      const live = await other.observe(runId, OWNER);
      expect(live.status).toBe(200);
      await new Promise(r => setTimeout(r, 500));

      owner.send({ cmd: 'approve', runId, toolCallId, resourceId: 'user-a' });
      await owner.next(e => e.type === 'approved-done' && e.runId === runId);
      await within(live.done, 10_000, 'live observation');

      // No replay cache is written; whatever history the observer gets comes
      // from the transport itself (Redis Streams keeps its entries).
      expect(await redis.exists(`${keyPrefix}:cache:pubsub:agent.stream.${runId}`)).toBe(0);
      expect(text(live.frames)).toBe('Approved and done.');
      expect(types(live.frames).at(-1)).toBe('finish');
    });

    it("aborts a running run through the other server once the owner's process confirms", async () => {
      const runId = await startWaitingRun();
      expect(await other.abort(runId, OWNER)).toEqual({ status: 200, body: { aborted: true } });
      await owner.next(e => e.type === 'stream-done' && e.runId === runId, 15_000);
      expect(owner.events.find(e => e.type === 'tool-finished')?.aborted).toBe(true);
    });
  });
});
