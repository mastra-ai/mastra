/**
 * Two AgentController processes share one thread over RedisStreamsPubSub and a
 * LibSQL file. Process B takes a turn; shortly after it ends, a second process
 * A opens a session on the same thread and sends. A's message must reach the
 * model: B's finished run must not count as an active run that takes the
 * message.
 *
 * B is busy (a CPU-bound request) right after its turn, so its run still holds
 * the thread lease when A sends.
 *
 * Requires a Redis server at REDIS_URL. The model is served by AIMock in this
 * process; children reach it over HTTP.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { LLMock } from '@copilotkit/aimock';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { makeStorageDir, PACKAGE_DIR, REDIS_URL, TSX_BIN } from '../test-fixtures/harness';

const ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/controller-session.entry.ts');
const ROUNDS = 6;

type Sent = { type: 'sent'; threadId: string; ms: number; outcome: 'resolved' | 'rejected'; error?: string };

class ControllerNode {
  private readonly events: Array<Record<string, any>> = [];
  private buffer = '';
  private stderr = '';
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

  async next<T>(match: (event: Record<string, any>) => boolean, timeoutMs = 30_000): Promise<T> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = this.events.find(match);
      if (found) return found as T;
      if (this.proc.exitCode !== null) throw new Error(`node exited ${this.proc.exitCode}: ${this.stderr}`);
      await new Promise(r => setTimeout(r, 25));
    }
    throw new Error(`timed out waiting on node; events: ${JSON.stringify(this.events)}; stderr: ${this.stderr}`);
  }

  send(threadId: string, content: string, blockAfterMs?: number) {
    this.proc.stdin!.write(`${JSON.stringify({ cmd: 'send', threadId, content, blockAfterMs })}\n`);
    return this.next<Sent>(event => event.type === 'sent' && event.threadId === threadId && !event.seen).then(event => {
      (event as any).seen = true;
      return event;
    });
  }
}

describe('AgentController across processes sharing a thread', () => {
  let mock: LLMock;
  let storage: Awaited<ReturnType<typeof makeStorageDir>>;
  const nodes: ControllerNode[] = [];

  beforeAll(async () => {
    mock = new LLMock({ port: 0 });
    await mock.start();
    mock.on({ endpoint: 'chat' }, { content: 'pong' });
  });

  afterAll(async () => {
    await mock.stop();
  });

  afterEach(async () => {
    for (const node of nodes.splice(0)) node.proc.kill('SIGKILL');
    await storage?.cleanup();
  });

  const startNode = async (name: string, keyPrefix: string) => {
    const node = new ControllerNode(
      spawn(TSX_BIN, [ENTRY], {
        cwd: PACKAGE_DIR,
        env: {
          ...process.env,
          NODE_NAME: name,
          LLM_URL: mock.url,
          REDIS_URL,
          KEY_PREFIX: keyPrefix,
          STORAGE_URL: storage.storageUrl,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      }),
    );
    nodes.push(node);
    await node.next(event => event.type === 'ready');
    return node;
  };

  const userMessagesSeenByModel = () =>
    (mock.getRequests() as any[]).flatMap(request =>
      (request.body?.messages ?? [])
        .filter((message: any) => message.role === 'user')
        .map((message: any) =>
          typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
        ),
    );

  it("runs a message sent from another process right after this process's run ended", async () => {
    storage = await makeStorageDir('mastra-controller-xproc-');
    const keyPrefix = `xproc-${randomUUID().slice(0, 8)}`;
    const nodeB = await startNode('B', keyPrefix);
    const nodeA = await startNode('A', keyPrefix);

    const outcomes: string[] = [];
    for (let round = 0; round < ROUNDS; round++) {
      const threadId = `thread-${round}-${randomUUID().slice(0, 8)}`;
      const warm = await nodeB.send(threadId, `warm B ${round}`, 2500);
      expect(warm.outcome).toBe('resolved');
      await new Promise(r => setTimeout(r, 1000));
      const sent = await nodeA.send(threadId, `from A ${round}`);
      const reachedModel = userMessagesSeenByModel().some(content => content.includes(`from A ${round}`));
      outcomes.push(`round ${round}: ${sent.outcome} after ${sent.ms}ms, reached model: ${reachedModel}`);
    }

    // Every round's message reached the model; failures list the round outcome.
    expect(outcomes.filter(outcome => !/: resolved after \d+ms, reached model: true$/.test(outcome))).toEqual([]);
  }, 180_000);
});
