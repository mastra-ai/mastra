/**
 * Regression test for #28495: `POST /api/agents/:agentId/runs/:runId/abort` sent to a server that
 * does not own the run must answer `{ aborted: true }`.
 *
 * Two Mastra servers share a LibSQL file and RedisStreamsPubSub, each with the real HTTP server from
 * `createNodeServer`. The owner streams a run whose tool blocks until aborted; the test sends the
 * abort to the other server. Before the fix the run stopped (the abort crossed over pubsub) but the
 * route answered `{ aborted: false }`, because the agent only consulted its own process. The client
 * SDK retries a false answer every 100 ms for 10 s and then errors the stream.
 *
 * The answer must also stay honest: when the owner is gone, its stored run is still live but nothing
 * executes it, so the route must keep answering `{ aborted: false }`.
 *
 * Requires a Redis server at REDIS_URL. The model is served by AIMock in this process; children
 * reach it over HTTP.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { LLMock } from '@copilotkit/aimock';
import { LibSQLStore } from '@mastra/libsql';
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

const ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/abort-node.entry.ts');
const AGENT_ID = 'abort-agent';

type NodeEvent = { node: string; type: string; [key: string]: any };

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

  async abort(runId: string) {
    const res = await fetch(`${this.url}/api/agents/${AGENT_ID}/runs/${runId}/abort`, { method: 'POST' });
    return { status: res.status, body: await res.json() };
  }

  // tsx runs the entry in a child node process, so signal the whole process group or the real server survives.
  async kill(signal: NodeJS.Signals) {
    if (this.proc.exitCode !== null || this.proc.signalCode !== null) return;
    const exited = new Promise(r => this.proc.once('exit', r));
    try {
      process.kill(-this.proc.pid!, signal);
    } catch {
      return;
    }
    await Promise.race([exited, new Promise(r => setTimeout(r, 5_000))]);
  }

  async stop() {
    await this.kill('SIGTERM');
    try {
      process.kill(-this.proc.pid!, 'SIGKILL');
    } catch {
      /* group already gone */
    }
  }
}

for (const engine of ['durable', 'evented'] as const) {
  describe(`run abort route across two servers (${engine}, LibSQL file + Redis)`, () => {
    let llm: LLMock;
    let owner: Node;
    let other: Node;
    let cleanupStorage: () => Promise<void>;

    let storageUrl: string;
    const modelCalls = () => llm.getRequests().length;
    const storedStatuses = async (runId: string) => {
      const store = new LibSQLStore({ id: 'abort-test-reader', url: storageUrl });
      await store.init();
      const workflows = await store.getStore('workflows');
      const { runs } = await workflows!.listWorkflowRuns({});
      return runs
        .filter(run => run.runId === runId)
        .map(run => (typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot).status);
    };

    beforeAll(async () => {
      llm = new LLMock({ port: 0 });
      await llm.start();
    });

    afterAll(async () => {
      await llm.stop();
    });

    beforeEach(async () => {
      llm.clearFixtures();
      llm.clearRequests();
      llm.resetMatchCounts();
      llm.on(
        { endpoint: 'chat', predicate: req => !JSON.stringify(req.messages).includes('call-wait') },
        { toolCalls: [{ id: 'call-wait', name: 'wait', arguments: '{}' }] },
      );
      llm.on(
        { endpoint: 'chat', predicate: req => JSON.stringify(req.messages).includes('call-wait') },
        { content: 'Done waiting.' },
      );

      await flushRedis();
      const storage = await makeStorageDir('mastra-abort-');
      cleanupStorage = storage.cleanup;
      storageUrl = storage.storageUrl;
      const env = {
        REDIS_URL,
        KEY_PREFIX: `abort-${randomUUID()}`,
        STORAGE_URL: storage.storageUrl,
        LLM_URL: llm.url.replace(/\/+$/, ''),
        ENGINE: engine,
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
    });

    afterEach(async () => {
      await Promise.allSettled([owner?.stop(), other?.stop()]);
      await cleanupStorage?.();
    });

    it('answers aborted: true from the server that does not own the run, and the run ends aborted', async () => {
      owner.send({ cmd: 'stream' });
      const { runId } = await owner.next(e => e.type === 'run');
      await owner.next(e => e.type === 'tool-started');

      const first = await other.abort(runId);
      expect(first).toEqual({ status: 200, body: { aborted: true } });

      const done = await owner.next(e => e.type === 'stream-done', 15_000);
      const finished = owner.events.find(e => e.type === 'tool-finished');
      expect(finished?.aborted).toBe(true);
      expect(done.finishReason).not.toBe('stop');
      // The run never reached its second model call.
      expect(modelCalls()).toBe(1);
    });

    it('answers aborted: false when the run is still stored as live but its owner is gone', async () => {
      owner.send({ cmd: 'stream' });
      const { runId } = await owner.next(e => e.type === 'run');
      await owner.next(e => e.type === 'tool-started');

      // The owner dies without unwinding: nothing executes the run any more, but its row stays live.
      await owner.kill('SIGKILL');
      const statuses = await storedStatuses(runId);
      expect(statuses.length).toBeGreaterThan(0);
      for (const status of statuses) expect(['running', 'pending', 'waiting']).toContain(status);

      const answer = await other.abort(runId);
      expect(answer).toEqual({ status: 200, body: { aborted: false } });
    });
  });
}
