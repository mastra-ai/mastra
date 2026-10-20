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
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { flushRedis, makeStorageDir, PACKAGE_DIR, REDIS_URL, TSX_BIN } from '../test-fixtures/harness';

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

for (const engine of ['durable', 'evented'] as const) {
  describe.skipIf(!process.env.REDIS_URL && !process.env.CI && process.env.SKIP_REDIS_TESTS === '1')(
    `observe() across two Mastra processes (${engine}, LibSQL file + Redis)`,
    () => {
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
    },
  );
}
