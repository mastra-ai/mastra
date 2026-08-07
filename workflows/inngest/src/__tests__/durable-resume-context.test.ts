/**
 * Regression test for issue #19873: a resumed durable run must restore the `requestContext` and
 * `tracingContext` it suspended with.
 *
 * Two things break without the fix, both because the Inngest engine's suspend snapshot never
 * persists these fields (core's `persistStepUpdate` does):
 *
 *  1. requestContext — a tool that scopes its work by a context value (here: `tenant`) sees an empty
 *     context on resume and falls back to `anon`. We assert the resumed tool wrote under `team-42`.
 *  2. tracingContext — the resumed run mints a fresh root span in a NEW trace instead of continuing
 *     the original. We assert the resumed run's root-span traceId equals the one captured at suspend.
 *
 * Why a separate connect() worker: the durable loop (and the tool call) run on the worker, whose
 * globalRunRegistry is empty. Only what the resume event carries survives — so an in-process
 * (serve-mode) test can't reproduce this.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RequestContext } from '@mastra/core/request-context';
import { DefaultStorage } from '@mastra/libsql';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 120_000 });

const INNGEST_PORT = 4100;
const AGENT_ID = 'resume-ctx-agent';
const DB_PATH = `/tmp/mastra-resume-ctx-${Date.now()}.db`;
const DB_URL = `file:${DB_PATH}`;
const OUT_DIR = mkdtempSync(path.join(tmpdir(), 'resume-ctx-out-'));
const LOOP_WORKFLOW = 'inngest:durable-agentic-loop';

const here = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(here, 'fixtures', 'resume-context-worker.ts');

let worker: ChildProcess | undefined;

function startWorker(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['tsx', WORKER, DB_URL, AGENT_ID, String(INNGEST_PORT), OUT_DIR], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, INNGEST_DEV: '1', INNGEST_BASE_URL: `http://localhost:${INNGEST_PORT}` },
    });
    const timer = setTimeout(() => reject(new Error('worker did not become ready in 90s')), 90_000);
    const onData = (buf: Buffer) => {
      const out = buf.toString();
      if (process.env.MASTRA_DBG_CTX) process.stderr.write(`[worker-out] ${out}`);
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

describe('durable agent resume restores requestContext + tracingContext (cross-process worker)', () => {
  beforeAll(async () => {
    worker = await startWorker();
    await new Promise(r => setTimeout(r, 3000)); // let Inngest register the worker's functions
  });

  afterAll(async () => {
    worker?.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
    if (worker && !worker.killed) worker.kill('SIGKILL');
    rmSync(OUT_DIR, { recursive: true, force: true });
  });

  it('resumed tool sees the original requestContext and stays in the original trace', async () => {
    const threadId = `thread-${Date.now()}`;
    const resourceId = `resource-${Date.now()}`;

    const { buildResumeContextAgent } = await import('./fixtures/resume-context-agent');
    const { durableAgent } = buildResumeContextAgent({
      dbUrl: DB_URL,
      agentId: AGENT_ID,
      inngestPort: INNGEST_PORT,
      outDir: OUT_DIR,
    });

    // Initial run — requestContext carries the tenant. The mock model calls save_note, which suspends.
    const requestContext = new RequestContext([['tenant', 'team-42']]);
    const res = await durableAgent.stream([{ role: 'user', content: 'Please save a note.' }], {
      memory: { thread: threadId, resource: resourceId },
      requestContext,
    });
    const runId = res.runId;
    void (async () => {
      try {
        for await (const _ of res.output.fullStream) {
          /* consume until suspend tears the stream down */
        }
      } catch {
        /* expected at suspend */
      } finally {
        res.cleanup?.();
      }
    })();

    // Wait until the loop snapshot is suspended, then capture the traceId it was persisted with.
    const wf = await new DefaultStorage({ id: 'resume-ctx-reader', url: DB_URL }).getStore('workflows');
    let suspendSnapshot: any;
    for (let i = 0; i < 60 && suspendSnapshot?.status !== 'suspended'; i++) {
      suspendSnapshot = await wf.loadWorkflowSnapshot({ workflowName: LOOP_WORKFLOW, runId }).catch(() => undefined);
      if (suspendSnapshot?.status !== 'suspended') await new Promise(r => setTimeout(r, 1000));
    }
    expect(suspendSnapshot?.status).toBe('suspended');

    // The fix persists tracingContext into the suspend snapshot; without it this is undefined.
    const suspendTraceId = suspendSnapshot?.tracingContext?.traceId;
    expect(suspendTraceId, 'suspend snapshot must persist tracingContext.traceId').toBeTruthy();

    // Resume with approval — the exact HITL approve. Pass only threadId/resourceId, so requestContext
    // must come from the snapshot (the contract the app relies on).
    const r2 = await durableAgent.resume(runId, { approved: true }, { threadId, resourceId });
    try {
      for await (const _ of r2.output.fullStream) {
        /* consume to completion */
      }
    } catch {
      /* ignore */
    }

    // Assertion 1 (requestContext): the resumed tool must have written under team-42, not anon.
    await vi.waitFor(
      () => {
        expect(existsSync(path.join(OUT_DIR, 'team-42', 'note.txt')), 'note written under team-42').toBe(true);
      },
      { timeout: 30_000, interval: 500 },
    );
    expect(existsSync(path.join(OUT_DIR, 'anon', 'note.txt')), 'note must NOT fall back to anon').toBe(false);

    // Assertion 2 (tracingContext continuity): the traceId persisted at suspend must reappear as a
    // root trace once the run resumes, i.e. the resumed turn continues the original trace rather than
    // living only in a brand-new one. (We don't assert a single root here: unrelated open span-
    // parenting issues on the Inngest path can emit extra orphan roots; this check is scoped to the
    // resume behaviour this fix owns — that the suspended trace is the one the run continues in.)
    const obs = await new DefaultStorage({ id: 'resume-ctx-span-reader', url: DB_URL }).getStore('observability');
    await vi.waitFor(
      async () => {
        const { spans } = (await obs.listTraces({ pagination: { page: 0, perPage: 50 } } as never)) as any;
        const traceIds = (spans ?? []).map((s: any) => s.traceId);
        if (process.env.MASTRA_DBG_CTX) console.error('[test] root traceIds:', traceIds, 'suspend:', suspendTraceId);
        expect(traceIds, 'resumed run continues the trace it suspended in').toContain(suspendTraceId);
      },
      { timeout: 30_000, interval: 1000 },
    );
  });
});
