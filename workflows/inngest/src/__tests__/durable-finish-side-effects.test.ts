/**
 * A durable run must PERSIST its conversation to memory and RECALL it on the next turn —
 * exactly like the non-durable agent.
 *
 * Why this test spawns a real connect worker: finish-time memory persistence in the durable
 * agentic workflow sources `saveQueueManager` / `memory` from `globalRunRegistry`, which
 * `createInngestAgent` populates only in the process that calls `stream()`. With `@mastra/inngest`
 * the loop executes on the `connect()` worker — a DIFFERENT process whose registry is empty — so
 * the guarded persistence block silently no-ops: no thread row, no messages, and the next turn
 * recalls nothing. An in-process (serve-mode) test cannot reproduce this.
 *
 * Recall proof: the mock model replies `recall:yes` iff its prompt contains "Zebra". Turn 1's user
 * message carries the marker; turn 2's doesn't — so a `recall:yes` on turn 2 can only come from
 * turn-1 history being loaded from memory.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DefaultStorage } from '@mastra/libsql';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 120_000 });

// Overridable so this file can run against a second dev server in parallel with suites that own 4100.
const INNGEST_PORT = Number(process.env.XPROC_INNGEST_PORT ?? 4100);
const AGENT_ID = 'msg-persist-agent';
const DB_PATH = `/tmp/mastra-msg-persist-${Date.now()}.db`;
const DB_URL = `file:${DB_PATH}`;

const here = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(here, 'fixtures', 'inngest-xproc-worker.ts');

let worker: ChildProcess | undefined;

/** Start the connect worker and wait until it reports ready. */
function startWorker(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['tsx', WORKER, DB_URL, AGENT_ID, String(INNGEST_PORT)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, INNGEST_DEV: '1', INNGEST_BASE_URL: `http://localhost:${INNGEST_PORT}` },
    });
    const timer = setTimeout(() => reject(new Error('worker did not become ready in 90s')), 90_000);
    const onData = (buf: Buffer) => {
      const out = buf.toString();
      if (process.env.MASTRA_DBG_META) process.stderr.write(`[worker-out] ${out}`);
      if (out.includes('[worker] ready')) {
        clearTimeout(timer);
        resolve(proc);
      }
    };
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.on('exit', code => {
      clearTimeout(timer);
      reject(new Error(`worker exited early with code ${code}`));
    });
  });
}

/** Run one turn through the durable agent and swallow the stream (assertions poll storage). */
async function runTurn(prompt: string, threadId: string, resourceId: string) {
  const { buildXprocTestAgent } = await import('./fixtures/inngest-xproc-agent');
  const { durableAgent } = buildXprocTestAgent({
    dbUrl: DB_URL,
    agentId: AGENT_ID,
    inngestPort: INNGEST_PORT,
  });
  const res = await durableAgent.stream([{ role: 'user', content: prompt }], {
    memory: { thread: threadId, resource: resourceId },
  });
  void (async () => {
    try {
      for await (const _ of res.output.fullStream) {
        /* consume */
      }
    } catch {
      /* stream may tear down when the run finishes remotely */
    } finally {
      res.cleanup();
    }
  })();
}

/** Poll storage until the thread has at least `min` messages (or time out). */
async function waitForMessages(threadId: string, min: number, timeoutMs = 60_000): Promise<any[]> {
  const storage = new DefaultStorage({ id: 'msg-persist-reader', url: DB_URL });
  const store = await storage.getStore('memory');
  const deadline = Date.now() + timeoutMs;
  let messages: any[] = [];
  while (Date.now() < deadline) {
    try {
      const res = (await store!.listMessages({ threadId } as never)) as any;
      messages = res?.messages ?? [];
      if (messages.length >= min) return messages;
    } catch {
      /* tables may not exist until the first write */
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return messages;
}

/** Extract plain text from a stored message's content (v2 parts or raw string). */
function messageText(m: any): string {
  const c = m?.content;
  if (typeof c === 'string') return c;
  const parts = c?.parts ?? c?.content ?? [];
  return JSON.stringify(parts);
}

describe('durable agent message persistence + recall (cross-process worker)', () => {
  beforeAll(async () => {
    worker = await startWorker();
    // Give Inngest a moment to register the worker's functions.
    await new Promise(r => setTimeout(r, 3000));
  });

  afterAll(async () => {
    worker?.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
    if (worker && !worker.killed) worker.kill('SIGKILL');
  });

  it('persists user + assistant messages when the loop runs on a separate worker process', async () => {
    const threadId = `thread-persist-${Date.now()}`;
    const resourceId = `resource-persist-${Date.now()}`;

    await runTurn('My name is Zebra. Remember it.', threadId, resourceId);

    const messages = await waitForMessages(threadId, 2);
    expect(messages.length).toBeGreaterThanOrEqual(2);

    const roles = messages.map((m: any) => m.role);
    expect(roles).toContain('user');
    expect(roles).toContain('assistant');

    // Thread row must exist too (preparation/persistence must create it).
    const storage = new DefaultStorage({ id: 'msg-persist-thread-reader', url: DB_URL });
    const store = await storage.getStore('memory');
    const thread = await (store as any).getThreadById({ threadId });
    expect(thread).toBeTruthy();
    expect(thread.resourceId).toBe(resourceId);

    // Thread TITLE must be generated too — `generateTitle` runs in the finish step,
    // which executes on the connect worker: it must rebuild agent + memory from the
    // Mastra instance (the registry closure only exists in the driver process).
    let title: string | undefined;
    for (let i = 0; i < 30 && !title; i++) {
      const t = await (store as any).getThreadById({ threadId });
      title = t?.title || undefined;
      if (!title) await new Promise(r => setTimeout(r, 1000));
    }
    expect(title).toBeTruthy();
  });

  it('recalls turn-1 history on turn 2 (parity with the non-durable agent)', async () => {
    const threadId = `thread-recall-${Date.now()}`;
    const resourceId = `resource-recall-${Date.now()}`;

    await runTurn('My name is Zebra. Remember it.', threadId, resourceId);
    await waitForMessages(threadId, 2);

    await runTurn('What is my name?', threadId, resourceId);
    const messages = await waitForMessages(threadId, 4);
    expect(messages.length).toBeGreaterThanOrEqual(4);

    // Last assistant message is turn 2's reply: `recall:yes` only if turn-1 history reached the model.
    const assistants = messages.filter((m: any) => m.role === 'assistant');
    const lastAssistant = assistants[assistants.length - 1];
    expect(messageText(lastAssistant)).toContain('recall:yes');
  });
});
