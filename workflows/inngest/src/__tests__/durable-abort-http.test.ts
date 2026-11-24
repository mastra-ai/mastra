/**
 * Regression test for #28483: `POST /api/agents/:agentId/runs/:runId/abort` must stop an Inngest
 * durable agent run while its tool is executing.
 *
 * The Inngest engine only persists suspended and terminal loop snapshots, so before the fix an
 * in-flight run had no storage row. The route found nothing to verify ownership against, answered
 * `{ aborted: false }`, and the run went on to its next model call.
 *
 * Runs against a real Inngest dev server, with the durable loop on a separate connect() worker, the
 * model served by aimock, and the real HTTP route through `createHonoServer`.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LLMock } from '@copilotkit/aimock';
import { SimpleAuth } from '@mastra/core/server';
import { createHonoServer } from '@mastra/deployer/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { InngestDurableStepIds } from '../durable-agent/create-inngest-agentic-workflow';
import { INNGEST_PORT, startConnectInngestDevServer, stopInngestDevServer } from './durable-agent.test.utils';
import { ABORT_HTTP_TOOL_MS, buildAbortHttpAgent } from './fixtures/abort-http-agent';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 120_000 });

const AGENT_ID = 'abort-http-agent';
const DB_PATH = `/tmp/mastra-abort-http-${Date.now()}.db`;
const DB_URL = `file:${DB_PATH}`;
const OUT_DIR = mkdtempSync(path.join(tmpdir(), 'abort-http-out-'));
const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'abort-http-worker.ts');
const OWNER = 'user-a';
const LOOP_WORKFLOW = InngestDurableStepIds.AGENTIC_LOOP;

let mock: LLMock;
let devServer: ChildProcess | null = null;
let worker: ChildProcess | undefined;
let driver: ReturnType<typeof buildAbortHttpAgent>;
let app: Awaited<ReturnType<typeof createHonoServer>>;

function startWorker(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['tsx', WORKER, DB_URL, AGENT_ID, String(INNGEST_PORT), mock.url, OUT_DIR], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, INNGEST_DEV: '1', INNGEST_BASE_URL: `http://localhost:${INNGEST_PORT}` },
    });
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('worker did not become ready in 90s'));
    }, 90_000);
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

const asUser = (token: string) => ({ method: 'POST', headers: { authorization: `Bearer ${token}` } });

const modelCalls = () => mock.getRequests().filter(entry => entry.path.includes('/chat/completions')).length;

/** Start a run and wait until its tool is executing on the worker. */
async function startRunMidTool() {
  rmSync(path.join(OUT_DIR, 'tool-started'), { force: true });
  const threadId = `thread-${crypto.randomUUID()}`;
  const callbacks = { aborted: false, finished: false };
  const res = await driver.durableAgent.stream([{ role: 'user', content: 'Wait, then reply.' }], {
    memory: { thread: threadId, resource: OWNER },
    maxSteps: 3,
    onAbort: () => {
      callbacks.aborted = true;
    },
    onFinish: () => {
      callbacks.finished = true;
    },
  });
  const consumed = (async () => {
    try {
      for await (const _chunk of res.output.fullStream) {
        // Drain the stream until the run ends.
      }
    } catch {
      // The abort path may error the stream after firing onAbort.
    } finally {
      res.cleanup?.();
    }
  })();
  await vi.waitFor(() => expect(existsSync(path.join(OUT_DIR, 'tool-started'))).toBe(true), {
    timeout: 60_000,
    interval: 200,
  });
  return { runId: res.runId, callbacks, finishReason: res.output.finishReason, consumed };
}

describe('Inngest durable agent run abort over HTTP (real Inngest dev server)', () => {
  beforeAll(async () => {
    mock = new LLMock({ port: 0 });
    await mock.start();
    devServer = await startConnectInngestDevServer();
    worker = await startWorker();
    await vi.waitFor(
      async () => {
        const data = await (await fetch(`http://localhost:${INNGEST_PORT}/dev`)).json();
        const registered = (data.functions ?? []).some((fn: { slug?: string }) =>
          fn.slug?.endsWith('workflow.inngest:durable-agentic-loop'),
        );
        if (!registered) throw new Error('durable loop function not registered yet');
      },
      { timeout: 60_000, interval: 500 },
    );

    // Resource-scoped callers, as in production: the server derives the caller's
    // resource from the authenticated user via mapUserToResourceId.
    const auth = new SimpleAuth({
      tokens: { 'token-a': { id: OWNER }, 'token-b': { id: 'user-b' } },
      mapUserToResourceId: (user: { id: string }) => user.id,
    });
    driver = buildAbortHttpAgent({
      dbUrl: DB_URL,
      agentId: AGENT_ID,
      inngestPort: INNGEST_PORT,
      mockUrl: mock.url,
      outDir: OUT_DIR,
      auth,
    });
    app = await createHonoServer(driver.mastra);
  });

  beforeEach(() => {
    mock.clearFixtures();
    mock.clearRequests();
    mock.resetMatchCounts();
    mock.on(
      { endpoint: 'chat', predicate: req => !JSON.stringify(req.messages).includes('call-wait') },
      { toolCalls: [{ id: 'call-wait', name: 'wait', arguments: '{}' }] },
    );
    mock.on(
      { endpoint: 'chat', predicate: req => JSON.stringify(req.messages).includes('call-wait') },
      { content: 'Done waiting.' },
    );
  });

  afterAll(async () => {
    worker?.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
    if (worker && !worker.killed) worker.kill('SIGKILL');
    await stopInngestDevServer(devServer);
    await mock?.stop();
    rmSync(OUT_DIR, { recursive: true, force: true });
    rmSync(DB_PATH, { force: true });
  });

  it('aborts a run mid-tool and stops it before the next model call', async () => {
    const { runId, callbacks, finishReason, consumed } = await startRunMidTool();

    const res = await app.request(`/api/agents/${AGENT_ID}/runs/${runId}/abort`, asUser('token-a'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ aborted: true });

    await consumed;
    // An aborted run ends through onAbort, never onFinish.
    expect(callbacks.aborted).toBe(true);
    expect(callbacks.finished).toBe(false);
    await expect(finishReason).resolves.toBe('aborted');
    // Give an un-aborted run time to finish the tool and make its second call.
    await new Promise(r => setTimeout(r, ABORT_HTTP_TOOL_MS + 2_000));
    expect(modelCalls()).toBe(1);
  });

  it('rejects an abort from a caller that does not own the run', async () => {
    const { runId, callbacks, finishReason, consumed } = await startRunMidTool();

    const res = await app.request(`/api/agents/${AGENT_ID}/runs/${runId}/abort`, asUser('token-b'));
    expect(res.status).toBe(403);

    // The run is untouched and completes normally.
    await consumed;
    expect(callbacks.finished).toBe(true);
    expect(callbacks.aborted).toBe(false);
    await expect(finishReason).resolves.toBe('stop');
    expect(modelCalls()).toBe(2);

    // The engine's terminal row replaces the provisional running row and keeps the ownership fields.
    const workflows = await driver.storage.getStore('workflows');
    await vi.waitFor(
      async () => {
        const run = await workflows!.getWorkflowRunById({ workflowName: LOOP_WORKFLOW, runId });
        expect(run?.resourceId).toBe(OWNER);
        const snapshot = typeof run?.snapshot === 'string' ? JSON.parse(run.snapshot) : run?.snapshot;
        expect(snapshot?.status).toBe('success');
        expect(snapshot?.context?.input?.agentId).toBe(AGENT_ID);
        expect(snapshot?.context?.input?.state?.resourceId).toBe(OWNER);
      },
      { timeout: 15_000, interval: 250 },
    );
  });

  it('removes the running row when the run cannot be triggered', async () => {
    // Fail only the trigger event; the dev server and its realtime stream stay up.
    const send = vi.spyOn(driver.inngest, 'send').mockRejectedValueOnce(new Error('inngest send failed'));
    const res = await driver.durableAgent.stream([{ role: 'user', content: 'Wait, then reply.' }], {
      memory: { thread: `thread-${crypto.randomUUID()}`, resource: OWNER },
    });
    const chunkTypes: string[] = [];
    try {
      for await (const chunk of res.output.fullStream) chunkTypes.push((chunk as { type: string }).type);
    } catch {
      // The trigger failure may surface as a stream error.
    } finally {
      res.cleanup?.();
    }
    expect(send).toHaveBeenCalledTimes(1);
    send.mockRestore();
    expect(chunkTypes).toContain('error');

    const workflows = await driver.storage.getStore('workflows');
    expect(await workflows!.loadWorkflowSnapshot({ workflowName: LOOP_WORKFLOW, runId: res.runId })).toBeNull();
    expect(modelCalls()).toBe(0);
  });
});
