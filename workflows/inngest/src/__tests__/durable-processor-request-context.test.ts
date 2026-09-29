/**
 * Regression test for issue #23904: requestContext values written by INPUT PROCESSORS must reach
 * the durable run on a cross-process engine.
 *
 * Preparation (including input processors) runs in the driver process; the durable loop and the
 * tool call run on a separate connect() worker whose globalRunRegistry is empty. The worker
 * rebuilds the run's RequestContext from the serialized `requestContextEntries` on the workflow
 * input. Before the fix, that snapshot was taken BEFORE input processors ran, so a processor's
 * `requestContext.set(...)` silently never reached tools on the worker — while the same code
 * stayed green in-process, where tools read the live RequestContext from the registry.
 *
 * The tool records the values it observed into `${outDir}/observed.json`; we assert it saw both
 * the caller-provided entry AND the processor-written entry.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RequestContext } from '@mastra/core/request-context';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { INNGEST_PORT, startConnectInngestDevServer, stopInngestDevServer } from './durable-agent.test.utils';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 120_000 });
const AGENT_ID = 'processor-ctx-agent';
const DB_PATH = `/tmp/mastra-processor-ctx-${Date.now()}.db`;
const DB_URL = `file:${DB_PATH}`;
const OUT_DIR = mkdtempSync(path.join(tmpdir(), 'processor-ctx-out-'));

const here = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(here, 'fixtures', 'processor-context-worker.ts');

let worker: ChildProcess | undefined;
let devServer: ChildProcess | null = null;

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

describe('durable agent input processor requestContext writes (cross-process worker)', () => {
  beforeAll(async () => {
    devServer = await startConnectInngestDevServer();
    worker = await startWorker();
    await new Promise(r => setTimeout(r, 3000)); // let Inngest register the worker's functions
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

  it('tool on the worker sees both caller-provided and processor-written entries', async () => {
    const { buildProcessorContextAgent } = await import('./fixtures/processor-context-agent');
    const { durableAgent } = buildProcessorContextAgent({
      dbUrl: DB_URL,
      agentId: AGENT_ID,
      inngestPort: INNGEST_PORT,
      outDir: OUT_DIR,
    });

    // Caller provides `tenant`; the input processor writes `route` during
    // preparation (in THIS process). Both must reach the tool on the worker.
    const requestContext = new RequestContext([['tenant', 'team-42']]);
    const res = await durableAgent.stream([{ role: 'user', content: 'Please record the context.' }], {
      requestContext,
    });
    void (async () => {
      try {
        for await (const _ of res.output.fullStream) {
          /* consume so the run progresses */
        }
      } catch {
        /* stream may tear down after completion */
      } finally {
        res.cleanup?.();
      }
    })();

    // The tool writes what it observed; assert on that instead of the stream so
    // the test is independent of finish-side-effect behavior.
    const observedPath = path.join(OUT_DIR, 'observed.json');
    await vi.waitFor(
      () => {
        expect(existsSync(observedPath), 'tool must have recorded its observed context').toBe(true);
      },
      { timeout: 60_000, interval: 500 },
    );

    const observed = JSON.parse(readFileSync(observedPath, 'utf8'));
    expect(observed).toEqual({
      route: 'processor-pinned', // written by the input processor — the #23904 regression
      tenant: 'team-42', // caller-provided — must keep working
    });
  });
});
