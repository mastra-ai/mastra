/**
 * Regression test for issue #25154: an Inngest durable run waiting on tool approval must be listed by
 * `GET /api/agents/:agentId/suspended-runs` and accepted by `POST /api/agents/:agentId/approve-tool-call`.
 *
 * Inngest persists the loop snapshot under `inngest:durable-agentic-loop`. Before the fix the server
 * and `Agent.listSuspendedRuns()` only looked under core's `durable-agentic-loop`, so the run was
 * missing from suspended-runs and approve-tool-call answered 403 "durable run belongs to a different
 * resource".
 *
 * Runs against a real Inngest dev server, with the durable loop on a separate connect() worker, and
 * drives the real HTTP routes through `createHonoServer`.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SimpleAuth } from '@mastra/core/server';
import { createHonoServer } from '@mastra/deployer/server';
import { DefaultStorage } from '@mastra/libsql';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { INNGEST_PORT, startConnectInngestDevServer, stopInngestDevServer } from './durable-agent.test.utils';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 120_000 });
const AGENT_ID = 'approval-http-agent';
const DB_PATH = `/tmp/mastra-approval-http-${Date.now()}.db`;
const DB_URL = `file:${DB_PATH}`;
const OUT_DIR = mkdtempSync(path.join(tmpdir(), 'approval-http-out-'));
const LOOP_WORKFLOW = 'inngest:durable-agentic-loop';

const here = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(here, 'fixtures', 'approval-http-worker.ts');

let worker: ChildProcess | undefined;
let devServer: ChildProcess | null = null;

function startWorker(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['tsx', WORKER, DB_URL, AGENT_ID, String(INNGEST_PORT), OUT_DIR], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, INNGEST_DEV: '1', INNGEST_BASE_URL: `http://localhost:${INNGEST_PORT}` },
    });
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('worker did not become ready in 90s'));
    }, 90_000);
    // Chunks don't preserve line boundaries, so buffer each stream until the ready line is complete.
    const watch = (stream: NodeJS.ReadableStream | null) => {
      let buffered = '';
      stream?.on('data', (buf: Buffer) => {
        buffered += buf.toString();
        const lines = buffered.split('\n');
        buffered = lines.pop() ?? '';
        if (lines.some(line => line.includes('[worker] ready'))) {
          clearTimeout(timer);
          resolve(proc);
        }
      });
    };
    watch(proc.stdout);
    watch(proc.stderr);
    proc.on('exit', code => {
      clearTimeout(timer);
      reject(new Error(`worker exited early with code ${code}`));
    });
  });
}

describe('Inngest durable agent tool approval over HTTP (real Inngest dev server)', () => {
  beforeAll(async () => {
    devServer = await startConnectInngestDevServer();
    worker = await startWorker();
    // connect() returning doesn't mean the dev server has registered the loop function yet.
    await vi.waitFor(
      async () => {
        const data = await (await fetch(`http://localhost:${INNGEST_PORT}/dev`)).json();
        const registered = (data.functions ?? []).some((fn: { slug?: string }) =>
          fn.slug?.endsWith(`workflow.${LOOP_WORKFLOW}`),
        );
        if (!registered) throw new Error(`${LOOP_WORKFLOW} function not registered yet`);
      },
      { timeout: 60_000, interval: 500 },
    );
  });

  afterAll(async () => {
    worker?.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
    if (worker && !worker.killed) worker.kill('SIGKILL');
    await stopInngestDevServer(devServer);
    devServer = null;
    rmSync(OUT_DIR, { recursive: true, force: true });
    rmSync(DB_PATH, { force: true });
  });

  it('lists the pending approval in suspended-runs and approves it via approve-tool-call', async () => {
    const threadId = `thread-${Date.now()}`;
    const resourceId = `user-a-${Date.now()}`;

    // Resource-scoped callers, as in production: the server derives the caller's
    // resource from the authenticated user via mapUserToResourceId.
    const auth = new SimpleAuth({
      tokens: { 'token-a': { id: resourceId }, 'token-b': { id: 'user-b' } },
      mapUserToResourceId: (user: { id: string }) => user.id,
    });
    const asUser = (token: string, init: RequestInit = {}) => ({
      ...init,
      headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${token}` },
    });

    const { buildApprovalHttpAgent } = await import('./fixtures/approval-http-agent');
    const { mastra, durableAgent } = buildApprovalHttpAgent({
      dbUrl: DB_URL,
      agentId: AGENT_ID,
      inngestPort: INNGEST_PORT,
      outDir: OUT_DIR,
      auth,
    });
    const app = await createHonoServer(mastra);

    const res = await durableAgent.stream([{ role: 'user', content: 'Please save a note.' }], {
      memory: { thread: threadId, resource: resourceId },
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

    // Wait until the worker has persisted the suspended loop snapshot under the Inngest name.
    let snapshot: any;
    for (let i = 0; i < 60 && snapshot?.status !== 'suspended'; i++) {
      const wf = await new DefaultStorage({ id: `approval-http-reader-${i}`, url: DB_URL }).getStore('workflows');
      snapshot = await wf.loadWorkflowSnapshot({ workflowName: LOOP_WORKFLOW, runId }).catch(() => undefined);
      if (snapshot?.status !== 'suspended') await new Promise(r => setTimeout(r, 1000));
    }
    expect(snapshot?.status).toBe('suspended');

    // Discovery: the owner sees the run with its pending approval.
    const listRes = await app.request(`/api/agents/${AGENT_ID}/suspended-runs`, asUser('token-a'));
    expect(listRes.status).toBe(200);
    const listed = (await listRes.json()) as { runs: any[]; total: number };
    expect(listed.total).toBe(1);
    expect(listed.runs[0].runId).toBe(runId);
    expect(listed.runs[0].toolCalls).toEqual([
      expect.objectContaining({ toolCallId: 'call-1', toolName: 'save_note', requiresApproval: true }),
    ]);

    // Another resource neither sees nor approves it.
    const otherList = await app.request(`/api/agents/${AGENT_ID}/suspended-runs`, asUser('token-b'));
    expect(otherList.status).toBe(200);
    expect(((await otherList.json()) as { total: number }).total).toBe(0);

    const approveInit = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runId, toolCallId: 'call-1' }),
    };
    const otherApprove = await app.request(`/api/agents/${AGENT_ID}/approve-tool-call`, asUser('token-b', approveInit));
    expect(otherApprove.status).toBe(403);
    expect(existsSync(path.join(OUT_DIR, 'note.txt'))).toBe(false);

    // Approval by the owner: the guard accepts the run and the approved tool runs on the worker.
    const approveRes = await app.request(`/api/agents/${AGENT_ID}/approve-tool-call`, asUser('token-a', approveInit));
    const approveBody = approveRes.text();
    expect(approveRes.status, approveRes.status === 200 ? '' : await approveBody).toBe(200);
    void approveBody.catch(() => {});

    await vi.waitFor(
      () => {
        expect(existsSync(path.join(OUT_DIR, 'note.txt')), 'approved tool wrote its note').toBe(true);
      },
      { timeout: 30_000, interval: 500 },
    );
  });
});
