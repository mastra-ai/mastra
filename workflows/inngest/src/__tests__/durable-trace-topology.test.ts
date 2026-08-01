/**
 * Every Inngest durable run must produce ONE trace, with the preparation-phase
 * processor spans (custom processInput processors, message-history recall) parented
 * under the run's AGENT_RUN root — parity with the non-durable agent.
 *
 * Previously InngestAgent called prepareForDurableExecution without `mastra` (so
 * preparation could not create the AGENT_RUN span and its processor spans exported
 * parentless into a rootless second trace) and then minted its own duplicate
 * AGENT_RUN/MODEL_GENERATION spans as a separate trace root. The AGENT_RUN input
 * was also the serialized MessageList blob instead of the caller's messages.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DefaultStorage } from '@mastra/libsql';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 120_000 });

const INNGEST_PORT = Number(process.env.XPROC_INNGEST_PORT ?? 4100);
const AGENT_ID = 'trace-topology-agent';
const DB_PATH = `/tmp/mastra-trace-topology-${Date.now()}.db`;
const DB_URL = `file:${DB_PATH}`;

const here = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(here, 'fixtures', 'inngest-xproc-worker.ts');

let worker: ChildProcess | undefined;

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

describe('Inngest durable trace topology (cross-process worker)', () => {
  beforeAll(async () => {
    worker = await startWorker();
    await new Promise(r => setTimeout(r, 3000));
  });

  afterAll(async () => {
    worker?.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
    if (worker && !worker.killed) worker.kill('SIGKILL');
  });

  it('produces ONE trace with all preparation-phase processor spans parented under agent_run', async () => {
    const threadId = `thread-trace-${Date.now()}`;
    const resourceId = `resource-trace-${Date.now()}`;
    const prompt = 'My name is Zebra. Remember it.';

    await runTurn(prompt, threadId, resourceId);
    // NOTE: not waiting on persisted messages — on main they never persist (separate
    // finish-side-effects bug). Fixed settle wait for the run to complete instead.
    await new Promise(r => setTimeout(r, 15_000));

    const storage = new DefaultStorage({ id: 'trace-reader', url: DB_URL });
    const store: any = await storage.getStore('observability');

    // Collect ALL spans across ALL traces (poll until exports settle).
    let allSpans: any[] = [];
    for (let i = 0; i < 30; i++) {
      try {
        const { spans: roots } = (await store.listTraces({ pagination: { page: 0, perPage: 50 } })) ?? {};
        const collected: any[] = [];
        for (const root of roots ?? []) {
          const trace = await store.getTrace({ traceId: root.traceId });
          collected.push(...(trace?.spans ?? []));
        }
        allSpans = collected;
        if (allSpans.some((s: any) => s.spanType === 'agent_run')) break;
      } catch {
        /* tables appear on first export */
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    expect(allSpans.length).toBeGreaterThan(0);

    // FAILS on main: the run's spans are split across TWO traceIds.
    const traceIds = new Set(allSpans.map((s: any) => s.traceId));
    expect(traceIds.size).toBe(1);

    // FAILS on main: `input processor: *` spans exist in a trace with NO agent_run root,
    // with parentSpanId = null. Expected: parented under the run's agent_run.
    const byId = new Map(allSpans.map((s: any) => [s.spanId, s]));
    const inputProcessorSpans = allSpans.filter((s: any) => String(s.name).startsWith('input processor:'));
    expect(inputProcessorSpans.length).toBeGreaterThan(0);
    for (const s of inputProcessorSpans) {
      expect(s.parentSpanId).toBeTruthy();
      expect(byId.get(s.parentSpanId)).toBeDefined();
    }

    // Roots must be agent_run only.
    for (const root of allSpans.filter((s: any) => s.parentSpanId == null)) {
      expect(root.spanType).toBe('agent_run');
    }

    // FAILS on main: agent_run input is the serialized MessageList state
    // (memoryMessages / taggedSystemMessages buckets), not the caller's messages.
    const agentRun = allSpans.find((s: any) => s.spanType === 'agent_run');
    const inputStr = JSON.stringify(agentRun?.input ?? null);
    expect(inputStr).toContain(prompt);
    expect(inputStr).not.toContain('memoryMessages');
    expect(inputStr).not.toContain('taggedSystemMessages');
  });
});
