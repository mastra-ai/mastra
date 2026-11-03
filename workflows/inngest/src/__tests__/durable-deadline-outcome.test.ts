/**
 * A run's `modelSettings.timeout.totalMs` is armed in the process that called `stream()`, but the
 * steps run on a connect worker pool. The worker has to stop at the deadline too: finish only the
 * tool it is in, call the model no more, end the run's root spans once as `limit / timeout`, and
 * leave the snapshot the caller deleted at the deadline deleted.
 *
 * The scenario needs the first model call to land before the deadline, so the tool is running when
 * it passes. Inngest's dispatch to a worker eats into the budget, so the budget is generous and the
 * test checks that precondition with its own message rather than letting a stalled dispatch look
 * like a worker that never called the model.
 */
import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DefaultStorage } from '@mastra/libsql';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { InngestDurableStepIds } from '../durable-agent/create-inngest-agentic-workflow';
import { INNGEST_PORT, startConnectInngestDevServer, stopInngestDevServer } from './durable-agent.test.utils';
import {
  buildDeadlineAgent,
  modelLogPath,
  spanLogPath,
  TOOL_AFTER_DEADLINE_MS,
  TOOL_CAP_MS,
  TOTAL_TIMEOUT_MS,
} from './fixtures/deadline-agent';
import type { ModelCallRow, SpanRow } from './fixtures/deadline-agent';

vi.setConfig({ testTimeout: 240_000, hookTimeout: 120_000 });

const agentId = `deadline-${randomUUID()}`;
const logDir = path.join(tmpdir(), `mastra-deadline-${Date.now()}`);
mkdirSync(logDir, { recursive: true });
const dbUrl = pathToFileURL(path.join(logDir, 'store.db')).href;
const workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'deadline-worker.ts');
const readerStorage = new DefaultStorage({ id: 'deadline-reader', url: dbUrl });
/** Which worker gets each step execution is up to the dev server, so the case runs a few times. */
const REPEATS = 3;

let workers: ChildProcess[] = [];
let devServer: ChildProcess | null = null;

const readRows = <T>(file: string): T[] =>
  existsSync(file)
    ? readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as T)
    : [];

async function terminateWorker(proc: ChildProcess): Promise<void> {
  if (proc.exitCode !== null) return;
  const exited = new Promise<void>(resolve => proc.once('exit', () => resolve()));
  proc.kill('SIGTERM');
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise<false>(resolve => setTimeout(() => resolve(false), 2000)),
  ]);
  if (!stopped && proc.exitCode === null) {
    proc.kill('SIGKILL');
    await exited;
  }
}

function startWorker(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['tsx', workerPath, dbUrl, agentId, String(INNGEST_PORT), logDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, INNGEST_DEV: '1', INNGEST_BASE_URL: `http://localhost:${INNGEST_PORT}` },
    });
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void terminateWorker(proc).then(() => reject(error), reject);
    };
    const onData = (buffer: Buffer) => {
      if (!settled && buffer.toString().includes('[worker] ready')) {
        settled = true;
        clearTimeout(timer);
        resolve(proc);
      }
    };
    const timer = setTimeout(() => fail(new Error('deadline worker did not become ready')), 90_000);
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.once('error', error => fail(error));
    proc.once('exit', code => fail(new Error(`deadline worker exited early with code ${code}`)));
  });
}

describe('a run whose budget expires while a worker runs its tool', () => {
  beforeAll(async () => {
    devServer = await startConnectInngestDevServer();
    workers = await Promise.all([startWorker(), startWorker()]);
    await new Promise(resolve => setTimeout(resolve, 3000)); // let Inngest register the workers' functions
  });

  afterAll(async () => {
    await Promise.all(workers.map(terminateWorker));
    await stopInngestDevServer(devServer);
    devServer = null;
  });

  it('stops on the worker at the deadline and ends the root spans once as limit / timeout', async () => {
    const { durableAgent } = buildDeadlineAgent({ dbUrl, agentId, inngestPort: INNGEST_PORT, logDir });
    const workflows = await readerStorage.getStore('workflows');

    for (let attempt = 0; attempt < REPEATS; attempt++) {
      const label = `attempt #${attempt}`;
      const modelCallsBefore = readRows(modelLogPath(logDir)).length;
      const startedAt = Date.now();
      const result = await durableAgent.stream([{ role: 'user', content: 'Call the slow tool' }], {
        modelSettings: { timeout: { totalMs: TOTAL_TIMEOUT_MS } },
      });
      const errors: string[] = [];
      try {
        for await (const chunk of result.output.fullStream) {
          if (chunk.type === 'error') errors.push(String((chunk.payload as any)?.error?.message ?? chunk.payload));
        }
      } finally {
        result.cleanup?.();
      }
      // The caller sees the deadline as before.
      expect(errors, `${label}: caller-visible error`).toEqual([
        `Agent execution timed out after ${TOTAL_TIMEOUT_MS}ms (modelSettings.timeout.totalMs)`,
      ]);

      const rowsOf = () => readRows<SpanRow>(spanLogPath(logDir)).filter(row => row.runId === result.runId);
      const rootEnds = () =>
        rowsOf().filter(row => row.event === 'span_ended' && ['agent_run', 'model_generation'].includes(row.type));
      // The worker ends the roots once its in-flight tool returns.
      await vi.waitFor(() => expect(rootEnds().map(row => row.type)).toContain('agent_run'), {
        timeout: TOOL_CAP_MS + 30_000,
        interval: 250,
      });
      // Give a worker that would call the model again, or persist again, time to do so.
      await new Promise(resolve => setTimeout(resolve, 4000));

      const endsBySpan = new Map<string, SpanRow[]>();
      for (const row of rootEnds()) endsBySpan.set(row.spanId, [...(endsBySpan.get(row.spanId) ?? []), row]);
      expect(
        [...endsBySpan.values()].map(ends => ({ type: ends[0]!.type, ends: ends.length })),
        `${label}: one end per root span`,
      ).toEqual(
        expect.arrayContaining([
          { type: 'agent_run', ends: 1 },
          { type: 'model_generation', ends: 1 },
        ]),
      );
      for (const [spanId, ends] of endsBySpan) {
        expect(ends[0], `${label}: ${ends[0]!.type} ${spanId}`).toMatchObject({
          outcome: 'limit',
          stopReason: 'timeout',
        });
      }
      // The worker finished the tool it was in and made no further model call. The one call
      // landed before the deadline, or the run never reached the scenario this test is about.
      const modelCalls = readRows<ModelCallRow>(modelLogPath(logDir)).slice(modelCallsBefore);
      expect(
        modelCalls.map(call => (call.at < startedAt + TOTAL_TIMEOUT_MS ? 'before deadline' : 'after deadline')),
        `${label}: model calls (one before the deadline: budget ${TOTAL_TIMEOUT_MS}ms, tool runs ${TOOL_AFTER_DEADLINE_MS}ms past it)`,
      ).toEqual(['before deadline']);
      // The snapshot deleted at the deadline stays deleted.
      const loopSnapshot = await workflows!.loadWorkflowSnapshot({
        workflowName: InngestDurableStepIds.AGENTIC_LOOP,
        runId: result.runId,
      });
      expect(loopSnapshot, `${label}: loop snapshot ${JSON.stringify(loopSnapshot)?.slice(0, 600)}`).toBeNull();
    }
  });
});
