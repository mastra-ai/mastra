/**
 * The Inngest durable engine must execute the agent's configured scorers after a run
 * completes, exactly like core's durable engine and the non-durable agent.
 *
 * Previously the Inngest agentic workflow ended at `map-final-output` — the
 * `execute-scorers` step from core's `createDurableAgenticWorkflow` was never ported,
 * so `initData.scorers` was populated on the workflow input and then silently ignored:
 * no scorer runs, no persisted scores, no scorer spans.
 *
 * Why a real connect() worker: scorer execution happens in the workflow's post-finish
 * step on the worker; scorers are serialized by name and resolved from the Mastra
 * instance there, so this exercises the cross-process resolution path end to end.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DefaultStorage } from '@mastra/libsql';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 120_000 });

const INNGEST_PORT = Number(process.env.XPROC_INNGEST_PORT ?? 4100);
const AGENT_ID = 'scorer-exec-agent';
const DB_PATH = `/tmp/mastra-scorer-exec-${Date.now()}.db`;
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
      if (buf.toString().includes('[worker] ready')) {
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

describe('Inngest durable scorer execution (cross-process worker)', () => {
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

  it('runs configured scorers after the run completes and persists their scores', async () => {
    const threadId = `thread-scorer-${Date.now()}`;
    const resourceId = `resource-scorer-${Date.now()}`;

    const { buildXprocTestAgent } = await import('./fixtures/inngest-xproc-agent');
    const { durableAgent } = buildXprocTestAgent({
      dbUrl: DB_URL,
      agentId: AGENT_ID,
      inngestPort: INNGEST_PORT,
    });

    const res = await durableAgent.stream([{ role: 'user', content: 'My name is Zebra. Remember it.' }], {
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

    // Scorers are fire-and-forget after the finish event; poll the scores store the
    // worker's hooks write to. The fixture's probe scorer always scores 0.95, so any
    // persisted score for this agent proves the execute-scorers step ran.
    const storage = new DefaultStorage({ id: 'scorer-reader', url: DB_URL });
    const store: any = await storage.getStore('scores');
    let scores: any[] = [];
    for (let i = 0; i < 60 && !scores.length; i++) {
      try {
        const resp = await store.listScoresByEntityId({
          entityId: AGENT_ID,
          entityType: 'AGENT',
          pagination: { page: 0, perPage: 10 },
        });
        scores = resp?.scores ?? [];
      } catch {
        /* tables appear on first write */
      }
      if (!scores.length) await new Promise(r => setTimeout(r, 1000));
    }

    expect(scores.length).toBeGreaterThan(0);
    expect(scores[0].score).toBe(0.95);
  });
});
