/**
 * Multi-process full-stack regression test for the multi-instance evented mode hang.
 *
 * This test models the original mastracode bug at the agent level rather than the
 * pubsub layer: two real Node processes each construct a Mastra + Agent and call
 * `agent.generate()` against a shared `UnixSocketPubSub`. Before the localOnly
 * publish fix, the second instance would either hang (silent deadlock) or fail
 * with `AGENT_GENERATE_MALFORMED_RESULT` because broker round-tripping stripped
 * the live `MastraModelOutput` from the workflow's terminal event.
 *
 * Assertions:
 * - Both processes return a populated `.text` from `agent.generate()`.
 * - Neither throws `AGENT_GENERATE_MALFORMED_RESULT`.
 * - Both complete inside a generous timeout.
 *
 * Notes:
 * - Uses `InMemoryStore` + `MockMemory` to keep the test hermetic (no libsql/no
 *   scheduler/no real LLM). The point is the evented workflow + pubsub plumbing.
 * - Uses `UnixSocketPubSub` directly (not `SignalsPubSub`) so the test doesn't
 *   depend on mastracode internals and the socket directory is short enough to
 *   stay under the macOS 104-byte sun_path limit even in CI tempdirs.
 */
import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

interface WorkerMessage {
  type: 'ready' | 'turn-done' | 'error' | 'status';
  data?: any;
}

function waitForMessage(child: ChildProcess, type: string, timeoutMs: number): Promise<WorkerMessage> {
  return new Promise((resolve, reject) => {
    const stderrChunks: string[] = [];
    const stderrHandler = (buf: Buffer) => stderrChunks.push(buf.toString());
    child.stderr?.on('data', stderrHandler);

    const handler = (msg: WorkerMessage) => {
      if (msg.type === type) {
        cleanup();
        resolve(msg);
      } else if (msg.type === 'error') {
        cleanup();
        reject(new Error(`Worker error: ${msg.data?.message ?? 'unknown'}\n${msg.data?.stack ?? ''}`));
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      child.off('message', handler);
      child.stderr?.off('data', stderrHandler);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(`Timeout waiting for "${type}" from worker after ${timeoutMs}ms.\nstderr:\n${stderrChunks.join('')}`),
      );
    }, timeoutMs);
    child.on('message', handler);
  });
}

describe('multi-instance evented mode - real agent.generate across processes', () => {
  let tempDir: string;
  let workerScript: string;
  const children: ChildProcess[] = [];

  beforeEach(async () => {
    // Keep tempdir short to leave headroom under the 104-byte sun_path limit.
    tempDir = await mkdtemp(join(tmpdir(), 'mc-mp-'));
    workerScript = join(tempDir, 'worker.mjs');
    const coreDist = join(__dirname, '../../../dist').replace(/\\/g, '/');
    await writeFile(
      workerScript,
      `
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { UnixSocketPubSub } from '${coreDist}/events/index.js';
import { Mastra } from '${coreDist}/mastra/index.js';
import { Agent } from '${coreDist}/agent/index.js';
import { InMemoryStore } from '${coreDist}/storage/index.js';
import { MockMemory } from '${coreDist}/memory/index.js';
import { createMockModel } from '${coreDist}/test-utils/llm-mock.js';

const socketPath = process.argv[2];
const workerId = process.argv[3];
const prompt = process.argv[4];
const expectedReply = process.argv[5];

await mkdir(dirname(socketPath), { recursive: true });

const pubsub = new UnixSocketPubSub(socketPath);
const storage = new InMemoryStore();
const memory = new MockMemory();
const model = createMockModel({ mockText: expectedReply });
const agent = new Agent({
  id: 'name-agent-' + workerId,
  name: 'Name Agent ' + workerId,
  instructions: 'Answer the user.',
  model,
  memory,
});
const mastra = new Mastra({
  storage,
  pubsub,
  agents: { ['name-agent-' + workerId]: agent },
});

await mastra.startWorkers();

process.send({ type: 'ready' });

process.on('message', async (msg) => {
  try {
    if (msg.type === 'go') {
      const result = await agent.generate(prompt, {
        memory: { thread: 'thread-' + workerId, resource: 'resource-' + workerId },
      });
      process.send({
        type: 'turn-done',
        data: {
          text: typeof result?.text === 'string' ? result.text : null,
          hasResult: !!result,
          resultKind: result?.constructor?.name ?? typeof result,
        },
      });
    } else if (msg.type === 'shutdown') {
      try { await pubsub.close?.(); } catch {}
      try { await mastra.shutdown?.(); } catch {}
      process.exit(0);
    }
  } catch (err) {
    process.send({
      type: 'error',
      data: { message: err?.message ?? String(err), stack: err?.stack },
    });
  }
});
`,
    );
  });

  afterEach(async () => {
    for (const child of children.splice(0)) {
      try {
        child.kill('SIGKILL');
      } catch {}
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  function spawnWorker(socketPath: string, workerId: string, prompt: string, expectedReply: string): ChildProcess {
    const child = fork(workerScript, [socketPath, workerId, prompt, expectedReply], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env, MASTRA_EVENTED_EXECUTION: 'true' },
    });
    children.push(child);
    return child;
  }

  it('both processes complete agent.generate() without AGENT_GENERATE_MALFORMED_RESULT under shared broker', async () => {
    const socketPath = join(tempDir, 'pub.sock');

    // Spawn broker first, wait until it's listening.
    const broker = spawnWorker(socketPath, 'w0', 'hello from w0', 'reply-from-w0');
    await waitForMessage(broker, 'ready', 30_000);

    // Spawn second instance as a client of the broker.
    const client = spawnWorker(socketPath, 'w1', 'hello from w1', 'reply-from-w1');
    await waitForMessage(client, 'ready', 30_000);

    // Fire both agent.generate() concurrently — this is the scenario that used
    // to silently hang or throw AGENT_GENERATE_MALFORMED_RESULT on w1.
    const brokerDone = waitForMessage(broker, 'turn-done', 60_000);
    const clientDone = waitForMessage(client, 'turn-done', 60_000);
    broker.send({ type: 'go' });
    client.send({ type: 'go' });

    const [brokerResult, clientResult] = await Promise.all([brokerDone, clientDone]);

    expect(brokerResult.data.hasResult).toBe(true);
    expect(clientResult.data.hasResult).toBe(true);
    // The mocked model returns the exact expectedReply via createMockModel.
    expect(brokerResult.data.text).toBe('reply-from-w0');
    expect(clientResult.data.text).toBe('reply-from-w1');

    broker.send({ type: 'shutdown' });
    client.send({ type: 'shutdown' });
  }, 90_000);
});
