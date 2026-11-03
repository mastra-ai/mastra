/**
 * A resumed durable run must restore the `requestContext` it suspended with (#19873) and record the
 * resumed execution as its own AGENT_RUN + MODEL_GENERATION pair under the suspended one (OBS-754):
 * the suspended pair stays ended `suspend`, the resumed pair ends once with its own outcome, and
 * every span id ends exactly once.
 *
 * Why separate processes: the durable loop (and the tool call) run on a connect() worker whose
 * globalRunRegistry is empty, and the resume comes from a fresh API replica with an empty registry
 * too. Only what the resume event carries survives — an in-process (serve-mode) test can't
 * reproduce either half.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RequestContext } from '@mastra/core/request-context';
import { DefaultStorage } from '@mastra/libsql';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { INNGEST_PORT, startConnectInngestDevServer, stopInngestDevServer } from './durable-agent.test.utils';
import { buildResumeContextAgent, SPAN_EVENTS_FILE } from './fixtures/resume-context-agent';
import { describeSpans, readSpanEvents, spanLifecycles } from './fixtures/span-events';
import type { SpanLifecycle } from './fixtures/span-events';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 120_000 });
const AGENT_ID = 'resume-ctx-agent';
const DB_PATH = `/tmp/mastra-resume-ctx-${Date.now()}.db`;
const DB_URL = `file:${DB_PATH}`;
const OUT_DIR = mkdtempSync(path.join(tmpdir(), 'resume-ctx-out-'));
const EVENTS = path.join(OUT_DIR, SPAN_EVENTS_FILE);
const LOOP_WORKFLOW = 'inngest:durable-agentic-loop';
const ROOTS = new Set(['agent_run', 'model_generation']);

const here = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(here, 'fixtures', 'resume-context-worker.ts');
const RESUMER = path.join(here, 'fixtures', 'resume-context-resumer.ts');

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

async function stopWorker(): Promise<void> {
  const proc = worker;
  worker = undefined;
  if (!proc || proc.exitCode !== null) return;

  const exited = new Promise<void>(resolve => proc.once('exit', () => resolve()));
  proc.kill('SIGTERM');
  await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 500))]);
  if (proc.exitCode === null) {
    proc.kill('SIGKILL');
    await exited;
  }
}

interface ResumerResult {
  chunkTypes: string[];
  error: string | null;
}

/** Approve the parked run from a fresh process and wait for it to finish or park again. */
function resumeFromFreshProcess(runId: string, threadId: string, resourceId: string): Promise<ResumerResult> {
  return new Promise((resolve, reject) => {
    const args = [RESUMER, DB_URL, AGENT_ID, String(INNGEST_PORT), OUT_DIR, runId, threadId, resourceId];
    const proc = spawn('npx', ['tsx', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, INNGEST_DEV: '1', INNGEST_BASE_URL: `http://localhost:${INNGEST_PORT}` },
    });
    let output = '';
    const onData = (buf: Buffer) => {
      output += buf.toString();
      if (process.env.MASTRA_DBG_CTX) process.stderr.write(`[resumer-out] ${buf.toString()}`);
    };
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.on('exit', code => {
      const line = output.split('\n').find(l => l.startsWith('RESULT '));
      if (!line) return reject(new Error(`resumer exited with code ${code} without a result:\n${output}`));
      resolve(JSON.parse(line.slice('RESULT '.length)));
    });
  });
}

async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  await new Promise<void>(resolve => server.close(() => resolve()));
  return port;
}

async function loadLoopSnapshot(runId: string, id: string) {
  const wf = await new DefaultStorage({ id, url: DB_URL }).getStore('workflows');
  return wf.loadWorkflowSnapshot({ workflowName: LOOP_WORKFLOW, runId }).catch(() => undefined);
}

async function waitForSuspended(runId: string) {
  let suspendSnapshot: any;
  for (let i = 0; i < 60 && suspendSnapshot?.status !== 'suspended'; i++) {
    suspendSnapshot = await loadLoopSnapshot(runId, `resume-ctx-reader-${i}`);
    if (suspendSnapshot?.status !== 'suspended') await new Promise(r => setTimeout(r, 1000));
  }
  expect(suspendSnapshot?.status).toBe('suspended');
  return suspendSnapshot;
}

/** Streams until the worker parks the run, then discards this process's view of it. */
async function streamUntilSuspended(
  durableAgent: ReturnType<typeof buildResumeContextAgent>['durableAgent'],
  prompt: string,
  options: { threadId: string; resourceId: string; requestContext?: RequestContext },
) {
  const res = await durableAgent.stream([{ role: 'user', content: prompt }], {
    memory: { thread: options.threadId, resource: options.resourceId },
    requestContext: options.requestContext,
  });
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
  const snapshot = await waitForSuspended(res.runId);
  return { runId: res.runId, snapshot };
}

/** The run's spans once no root span is still open, or as they stand when the guard fires. */
async function settledSpans(runId: string): Promise<SpanLifecycle[]> {
  const open = () =>
    spanLifecycles(readSpanEvents(EVENTS), runId).filter(span => ROOTS.has(span.type) && span.endedBy.length === 0);
  const deadline = Date.now() + 10_000;
  while (open().length > 0 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 200));
  return spanLifecycles(readSpanEvents(EVENTS), runId);
}

function roots(spans: SpanLifecycle[], type: 'agent_run' | 'model_generation') {
  return spans.filter(span => span.type === type);
}

function expectEndedOnce(spans: SpanLifecycle[]) {
  for (const span of spans.filter(span => ['agent_run', 'model_generation', 'model_step'].includes(span.type))) {
    expect(span.startedBy, `${span.type} ${span.spanId} started once\n${describeSpans(spans)}`).toHaveLength(1);
    expect(span.endedBy, `${span.type} ${span.spanId} ended exactly once\n${describeSpans(spans)}`).toHaveLength(1);
  }
}

describe('durable agent resume restores requestContext + tracingContext (cross-process worker)', () => {
  beforeAll(async () => {
    devServer = await startConnectInngestDevServer();
    worker = await startWorker();
    await new Promise(r => setTimeout(r, 3000)); // let Inngest register the worker's functions
  });

  afterAll(async () => {
    await stopWorker();
    await stopInngestDevServer(devServer);
    devServer = null;
    rmSync(OUT_DIR, { recursive: true, force: true });
    if (existsSync(DB_PATH)) rmSync(DB_PATH, { force: true });
  });

  it('resumed tool sees the original requestContext, stays in the original trace, and gets its own AGENT_RUN', async () => {
    const threadId = `thread-${Date.now()}`;
    const resourceId = `resource-${Date.now()}`;

    const { durableAgent } = buildResumeContextAgent({
      dbUrl: DB_URL,
      agentId: AGENT_ID,
      inngestPort: INNGEST_PORT,
      outDir: OUT_DIR,
      role: 'api',
    });

    // Initial run — requestContext carries the tenant. The mock model calls save_note, which suspends.
    const { runId, snapshot: suspendSnapshot } = await streamUntilSuspended(durableAgent, 'Please save 1 note.', {
      threadId,
      resourceId,
      requestContext: new RequestContext([['tenant', 'team-42']]),
    });

    // The fix persists tracingContext into the suspend snapshot; without it this is undefined.
    const suspendTraceId = suspendSnapshot?.tracingContext?.traceId;
    expect(suspendTraceId, 'suspend snapshot must persist tracingContext.traceId').toBeTruthy();

    // Restart the worker so the resume runs with an empty process-local registry, matching a deploy,
    // crash recovery, or a resume after cleanup().
    await stopWorker();
    worker = await startWorker();
    await new Promise(r => setTimeout(r, 3000));

    // Resume with approval from a fresh process — the exact HITL approve. It passes only
    // threadId/resourceId, so requestContext must come from the snapshot (the contract the app relies on).
    const resumed = await resumeFromFreshProcess(runId, threadId, resourceId);
    expect(resumed.error).toBeNull();
    expect(resumed.chunkTypes.slice(0, 2)).toEqual(['tool-call-resumed', 'tool-result']);
    expect(resumed.chunkTypes).toContain('finish');

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
    // living only in a brand-new one.
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

    // Assertion 3 (OBS-754): one pair per segment, each ended once, by the worker.
    const spans = await settledSpans(runId);
    const [first, second, ...more] = roots(spans, 'agent_run');
    expect(more, `two agent runs, one per segment\n${describeSpans(spans)}`).toEqual([]);
    expect(first?.endedBy).toEqual([{ role: 'worker', outcome: 'suspend', error: null }]);
    expect(second, `the resume opened its own AGENT_RUN\n${describeSpans(spans)}`).toMatchObject({
      startedBy: ['resumer'],
      resumed: true,
      resumedFromSpanId: first!.spanId,
      parentSpanId: first!.spanId,
      endedBy: [{ role: 'worker', outcome: 'success', error: null }],
    });
    const [firstGeneration, secondGeneration] = roots(spans, 'model_generation');
    expect(firstGeneration).toMatchObject({
      parentSpanId: first!.spanId,
      endedBy: [{ role: 'worker', outcome: 'suspend', error: null }],
    });
    expect(secondGeneration).toMatchObject({
      parentSpanId: second!.spanId,
      endedBy: [{ role: 'worker', outcome: 'success', error: null }],
    });
    const suspendedStep = spans.find(
      span => span.type === 'model_step' && span.parentSpanId === firstGeneration!.spanId,
    );
    expect(suspendedStep?.endedBy, `the suspended MODEL_STEP ends once\n${describeSpans(spans)}`).toEqual([
      { role: 'worker', outcome: 'suspend', error: null },
    ]);
    expectEndedOnce(spans);
  });

  it('a second suspension and a second fresh-process resume chain the pairs under the previous segment', async () => {
    const threadId = `thread-chain-${Date.now()}`;
    const resourceId = `resource-chain-${Date.now()}`;
    const { durableAgent } = buildResumeContextAgent({
      dbUrl: DB_URL,
      agentId: AGENT_ID,
      inngestPort: INNGEST_PORT,
      outDir: OUT_DIR,
      role: 'api',
    });
    const { runId } = await streamUntilSuspended(durableAgent, 'Please save 2 notes.', { threadId, resourceId });

    const firstResume = await resumeFromFreshProcess(runId, threadId, resourceId);
    expect(firstResume.error).toBeNull();
    expect(firstResume.chunkTypes).toContain('tool-call-suspended');
    await waitForSuspended(runId);

    let spans = await settledSpans(runId);
    const [first, second] = roots(spans, 'agent_run');
    expect(second, describeSpans(spans)).toMatchObject({
      startedBy: ['resumer'],
      parentSpanId: first!.spanId,
      endedBy: [{ role: 'worker', outcome: 'suspend', error: null }],
    });

    const secondResume = await resumeFromFreshProcess(runId, threadId, resourceId);
    expect(secondResume.error).toBeNull();
    expect(secondResume.chunkTypes).toContain('finish');

    spans = await settledSpans(runId);
    const [, , third, ...more] = roots(spans, 'agent_run');
    expect(more, describeSpans(spans)).toEqual([]);
    expect(third, describeSpans(spans)).toMatchObject({
      startedBy: ['resumer'],
      resumed: true,
      resumedFromSpanId: first!.spanId,
      parentSpanId: second!.spanId,
      endedBy: [{ role: 'worker', outcome: 'success', error: null }],
    });
    expect(roots(spans, 'model_generation').map(span => span.endedBy[0]?.outcome)).toEqual([
      'suspend',
      'suspend',
      'success',
    ]);
    expectEndedOnce(spans);
  });

  it('a resume whose event cannot reach Inngest ends its own pair with the error and leaves the run resumable', async () => {
    const threadId = `thread-dispatch-${Date.now()}`;
    const resourceId = `resource-dispatch-${Date.now()}`;
    const { durableAgent } = buildResumeContextAgent({
      dbUrl: DB_URL,
      agentId: AGENT_ID,
      inngestPort: INNGEST_PORT,
      outDir: OUT_DIR,
      role: 'api',
    });
    const { runId } = await streamUntilSuspended(durableAgent, 'Please save 1 note.', { threadId, resourceId });

    // The same app, pointed at a port nothing listens on: `inngest.send` fails after the spans opened.
    const { durableAgent: unreachable, mastra: unreachableMastra } = buildResumeContextAgent({
      dbUrl: DB_URL,
      agentId: AGENT_ID,
      inngestPort: await closedPort(),
      outDir: OUT_DIR,
      role: 'api-closed-port',
    });
    await expect(unreachable.resume(runId, { approved: true }, { threadId, resourceId })).rejects.toThrow();
    await unreachableMastra.observability?.flush?.();

    let spans = spanLifecycles(readSpanEvents(EVENTS), runId);
    const [first, failed, ...more] = roots(spans, 'agent_run');
    expect(more, describeSpans(spans)).toEqual([]);
    expect(first?.endedBy, describeSpans(spans)).toEqual([{ role: 'worker', outcome: 'suspend', error: null }]);
    expect(failed, `the failed resume ended its own pair\n${describeSpans(spans)}`).toMatchObject({
      startedBy: ['api-closed-port'],
      resumed: true,
      resumedFromSpanId: first!.spanId,
      endedBy: [{ role: 'api-closed-port', outcome: 'error' }],
    });
    expect(roots(spans, 'model_generation').map(span => span.endedBy.map(end => end.outcome))).toEqual([
      ['suspend'],
      ['error'],
    ]);
    expect((await loadLoopSnapshot(runId, 'resume-ctx-dispatch-reader'))?.status).toBe('suspended');

    const resumed = await resumeFromFreshProcess(runId, threadId, resourceId);
    expect(resumed.error).toBeNull();
    expect(resumed.chunkTypes).toContain('finish');
    spans = await settledSpans(runId);
    const third = roots(spans, 'agent_run')[2];
    expect(third, describeSpans(spans)).toMatchObject({
      startedBy: ['resumer'],
      parentSpanId: first!.spanId,
      endedBy: [{ role: 'worker', outcome: 'success', error: null }],
    });
    expectEndedOnce(spans);
  });
});
