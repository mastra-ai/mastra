/**
 * Durable tool execution must carry a tracing context so spans created INSIDE tool
 * execution — workspace WORKSPACE_ACTION filesystem spans, client-tool spans — nest
 * under a live TOOL_CALL span, exactly like the non-durable agent.
 *
 * Previously the Inngest engine's extract-tool-calls map did not forward stepSpanData
 * onto each tool call (core's engine does), so tools executed with no tracing context
 * and their in-execution spans were silently skipped; the collect step then created
 * retroactive, childless TOOL_CALL spans — duplicating the live ones once the context
 * was supplied.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DefaultStorage } from '@mastra/libsql';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 120_000 });

const INNGEST_PORT = Number(process.env.XPROC_INNGEST_PORT ?? 4100);
const AGENT_ID = 'tool-span-agent';
const DB_PATH = `/tmp/mastra-tool-span-${Date.now()}.db`;
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

describe('Inngest durable tool-execution tracing (cross-process worker)', () => {
  beforeAll(async () => {
    worker = await startWorker();
    await new Promise(r => setTimeout(r, 3000));
  });

  afterAll(async () => {
    worker?.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
    if (worker && !worker.killed) worker.kill('SIGKILL');
  });

  it('creates exactly one tool_call span per tool, with workspace_action nested under it', async () => {
    const threadId = `thread-tools-${Date.now()}`;
    const resourceId = `resource-tools-${Date.now()}`;
    // The fixture model reacts to this prompt by calling `add` and `mastra_workspace_write_file`.
    const prompt = 'Please use the tools: add 2 and 3, then write the result to result.txt.';

    await runTurn(prompt, threadId, resourceId);
    // NOTE: not waiting on persisted messages — on main they never persist (separate
    // finish-side-effects bug). Fixed settle wait for the run to complete instead.
    await new Promise(r => setTimeout(r, 15_000));

    const storage = new DefaultStorage({ id: 'tool-span-reader', url: DB_URL });
    const store: any = await storage.getStore('observability');

    let spans: any[] = [];
    for (let i = 0; i < 30; i++) {
      try {
        const { spans: roots } = (await store.listTraces({ pagination: { page: 0, perPage: 50 } })) ?? {};
        for (const root of roots ?? []) {
          const trace = await store.getTrace({ traceId: root.traceId });
          const all = trace?.spans ?? [];
          if (all.some((s: any) => s.spanType === 'tool_call')) {
            spans = all;
            break;
          }
        }
        if (spans.length) break;
      } catch {
        /* tables appear on first export */
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    expect(spans.length).toBeGreaterThan(0);

    // FAILS on main (half 2, after forwarding stepSpanData): TWO tool_call spans per
    // tool — one live (builder) + one retroactive childless duplicate (collect map).
    const toolSpans = spans.filter((s: any) => s.spanType === 'tool_call');
    expect(toolSpans.map((s: any) => s.name).sort()).toEqual(["tool: 'add'", "tool: 'mastra_workspace_write_file'"]);

    // FAILS on main (half 1): no workspace_action span exists at all — the tool executed
    // with no tracingContext, so startWorkspaceSpan() silently no-ops.
    const wsAction = spans.find((s: any) => s.spanType === 'workspace_action');
    expect(wsAction).toBeDefined();
    const byId = new Map(spans.map((s: any) => [s.spanId, s]));
    const wsParent = byId.get(wsAction.parentSpanId);
    expect(wsParent?.spanType).toBe('tool_call');
    expect(wsParent?.name).toBe("tool: 'mastra_workspace_write_file'");
  });
});
