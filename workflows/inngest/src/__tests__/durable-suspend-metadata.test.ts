/**
 * A suspended durable run must PERSIST its suspend metadata on the assistant message.
 *
 * `suspendedTools` on `message.content.metadata` is what a RELOADING client reads to re-render a
 * pending approval — the live `tool-call-suspended` chunk exists only in memory. Without it a
 * refreshed page shows no approval even though the run is parked and resumable.
 *
 * Why this test spawns a real connect worker: the durable tool-call step sources its `MessageList`
 * (and SaveQueueManager) from `globalRunRegistry`, which `createInngestAgent` populates in the
 * process that calls `stream()` — explicitly "so workflow steps running in the same process can
 * recover it". With `@mastra/inngest` the agentic loop runs on the `connect()` worker, a DIFFERENT
 * process whose registry is empty, so those dependencies are missing and the metadata write
 * silently no-ops. An in-process (serve-mode) test cannot reproduce that; only a separate worker
 * process can.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DefaultStorage } from '@mastra/libsql';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 120_000 });

const INNGEST_PORT = 4100;
const AGENT_ID = 'suspend-meta-agent';
const DB_PATH = `/tmp/mastra-suspend-meta-${Date.now()}.db`;
const DB_URL = `file:${DB_PATH}`;

const here = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(here, 'fixtures', 'suspend-metadata-worker.ts');

let worker: ChildProcess | undefined;

/** Start the connect worker and wait until it reports READY. */
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
      if (out.includes('WORKER_READY') || out.includes('[worker] ready')) {
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

describe('durable agent suspend metadata persistence (cross-process worker)', () => {
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

  it('persists suspendedTools when the loop runs on a separate worker process', async () => {
    const threadId = `thread-${Date.now()}`;
    const resourceId = `resource-${Date.now()}`;

    // Mirror production topology: THIS process is the "server" that calls stream() (so its own
    // registry entry is created here), while the durable loop executes on the worker process
    // started in beforeAll — whose registry is empty. Building an identical agent here is what a
    // second replica does; the runId is shared, the registry entry is not.
    const { buildSuspendMetaAgent } = await import('./fixtures/suspend-metadata-agent');
    const { durableAgent } = buildSuspendMetaAgent({ dbUrl: DB_URL, agentId: AGENT_ID, inngestPort: INNGEST_PORT });

    const res = await durableAgent.stream([{ role: 'user', content: 'Please proceed.' }], {
      memory: { thread: threadId, resource: resourceId },
    });
    void (async () => {
      try {
        for await (const _ of res.output.fullStream) {
          /* consume */
        }
      } catch {
        /* stream may tear down at suspend */
      } finally {
        res.cleanup();
      }
    })();

    // Poll the shared storage the worker writes to.
    const storage = new DefaultStorage({ id: 'suspend-meta-reader', url: DB_URL });
    const store = await storage.getStore('memory');

    let suspendedTools: Record<string, any> | undefined;
    for (let i = 0; i < 60 && !suspendedTools; i++) {
      try {
        const { messages } = (await store!.listMessages({ threadId } as never)) as any;
        const hit = (messages ?? []).find((m: any) => m?.content?.metadata?.suspendedTools);
        suspendedTools = hit?.content?.metadata?.suspendedTools;
      } catch {
        /* table may not exist until the worker's first write */
      }
      if (!suspendedTools) await new Promise(r => setTimeout(r, 1000));
    }

    expect(suspendedTools).toBeDefined();
    const entry = Object.values(suspendedTools!)[0] as any;
    expect(entry.toolName).toBe('request_approval');
    expect(entry.suspendPayload).toMatchObject({ question: 'Proceed?' });
  });
});
