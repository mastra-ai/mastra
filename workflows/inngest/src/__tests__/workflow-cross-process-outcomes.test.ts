import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { TracingEvent } from '@mastra/core/observability';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  controlFlowResumeKinds,
  expectControlFlowSegments,
} from '../../../../observability/mastra/src/test-utils/workflow-outcomes';
import { INNGEST_PORT, startConnectInngestDevServer } from './durable-agent.test.utils';
import { buildOutcomeWorkflow } from './fixtures/workflow-outcome-worker';
import type { OutcomeWorkflowKind } from './fixtures/workflow-outcome-worker';

const directory = mkdtempSync(join(tmpdir(), 'mastra-native-process-'));
const workerPath = fileURLToPath(new URL('./fixtures/workflow-outcome-worker.ts', import.meta.url));
const tsxLoader = createRequire(import.meta.url).resolve('tsx');
let devServer: ChildProcess | null = null;

function readDiskEvents(eventsPath: string): Array<{ pid: number; event: TracingEvent }> {
  return existsSync(eventsPath)
    ? readFileSync(eventsPath, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line))
    : [];
}

async function stopProcess(proc: ChildProcess | null) {
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return;
  let timer: ReturnType<typeof setTimeout>;
  await new Promise<void>(resolve => {
    proc.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    proc.kill('SIGTERM');
    timer = setTimeout(() => proc.kill('SIGKILL'), 5000);
  });
}

async function startWorker(dbUrl: string, kind: OutcomeWorkflowKind, eventsPath: string) {
  const proc = spawn(
    process.execPath,
    ['--import', tsxLoader, workerPath, 'worker', dbUrl, String(INNGEST_PORT), kind, eventsPath],
    {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env, INNGEST_DEV: '1', INNGEST_BASE_URL: `http://localhost:${INNGEST_PORT}` },
    },
  );
  let output = '';
  proc.stdout?.on('data', data => {
    output = (output + data).slice(-8000);
  });
  proc.stderr?.on('data', data => {
    output = (output + data).slice(-8000);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Worker startup timed out: ${output}`)), 20000);
      const fail = () => {
        clearTimeout(timer);
        reject(new Error(`Worker exited before ready: ${output}`));
      };
      proc.once('error', fail);
      proc.once('exit', fail);
      proc.on('message', message => {
        if ((message as { type?: string }).type !== 'ready') return;
        clearTimeout(timer);
        proc.off('error', fail);
        proc.off('exit', fail);
        resolve();
      });
    });
    return proc;
  } catch (error) {
    await stopProcess(proc);
    throw error;
  }
}

beforeAll(async () => {
  devServer = await startConnectInngestDevServer();
}, 40000);
afterAll(async () => {
  await stopProcess(devServer);
  rmSync(directory, { recursive: true, force: true });
});

it.each(
  controlFlowResumeKinds.flatMap(kind => (['success', 'error', 'tripwire'] as const).map(action => ({ kind, action }))),
)(
  'preserves $kind $action outcomes across two worker replacements',
  async ({ kind, action: finalAction }) => {
    const dbUrl = pathToFileURL(join(directory, `${kind}-${finalAction}.db`)).href;
    const eventsPath = join(directory, `${kind}-${finalAction}.jsonl`);
    const readEvents = () => readDiskEvents(eventsPath);
    const ended = () =>
      readEvents()
        .filter(({ event }) => event.type === TracingEventType.SPAN_ENDED)
        .map(({ event }) => event.exportedSpan);
    const workerPids: number[] = [];
    let runId: string | undefined;
    let worker: ChildProcess | null = null;
    try {
      for (const [index, action] of [undefined, 'suspend', finalAction].entries()) {
        worker = await startWorker(dbUrl, kind, eventsPath);
        workerPids.push(worker.pid!);
        const client = buildOutcomeWorkflow(dbUrl, INNGEST_PORT, kind);
        try {
          const run = await client.workflow.createRun(runId ? { runId } : undefined);
          runId = run.runId;
          if (action === undefined) await run.startAsync({ inputData: {} });
          else await run.resumeAsync({ step: 'decision-suspend', resumeData: { action } });
          const store = await client.storage.getStore('workflows');
          await expect
            .poll(
              async () =>
                (await store!.loadWorkflowSnapshot({ workflowName: client.workflow.id, runId: run.runId }))?.status,
              { timeout: 20000 },
            )
            .toBe(
              action === 'error'
                ? 'failed'
                : action === 'tripwire'
                  ? 'tripwire'
                  : action === 'success'
                    ? 'success'
                    : 'suspended',
            );
          await expect
            .poll(
              () =>
                ended().filter(span => span.type === SpanType.WORKFLOW_RUN && span.metadata?.runId === runId).length,
              { timeout: 10000 },
            )
            .toBe(index + 1);
        } finally {
          await client.mastra.shutdown();
          await client.storage.close();
        }
        await stopProcess(worker);
        expect(worker.exitCode !== null || worker.signalCode !== null).toBe(true);
        worker = null;
      }
      expect(new Set(workerPids).size).toBe(3);
      const roots = readEvents().filter(
        ({ event }) =>
          event.type === TracingEventType.SPAN_ENDED &&
          event.exportedSpan.type === SpanType.WORKFLOW_RUN &&
          event.exportedSpan.metadata?.runId === runId,
      );
      const traceIds = new Set(roots.map(({ event }) => event.exportedSpan.traceId));
      const unrelated = ended().filter(span => !traceIds.has(span.traceId));
      expect(unrelated, 'exports outside the invocation traces').toEqual([]);
      const spans = ended().filter(span => traceIds.has(span.traceId));
      expectControlFlowSegments(spans, kind, true, [
        'suspend',
        'suspend',
        finalAction === 'tripwire' ? 'blocked' : finalAction,
      ]);
      expect(roots.map(({ pid }) => pid)).toEqual(workerPids);
      expect(new Set(spans.map(span => span.id)).size).toBe(spans.length);
    } finally {
      await stopProcess(worker);
    }
  },
  90000,
);

it.each(['cancel-wait', 'cancel-nested-wait'] as const)(
  'cancels %s after its worker exits, using only persisted checkpoints',
  async kind => {
    const dbUrl = pathToFileURL(join(directory, `${kind}.db`)).href;
    const eventsPath = join(directory, `${kind}.jsonl`);
    const readEvents = () => readDiskEvents(eventsPath);
    let worker: ChildProcess | null = null;
    const caller = buildOutcomeWorkflow(dbUrl, INNGEST_PORT, kind);
    try {
      worker = await startWorker(dbUrl, kind, eventsPath);
      const firstPid = worker.pid!;
      const run = await caller.workflow.createRun();
      await run.startAsync({ inputData: {} });
      const store = (await caller.storage.getStore('workflows'))!;
      const readWaitingSnapshot = () =>
        store.loadWorkflowSnapshot({ workflowName: caller.waitingWorkflowId, runId: run.runId });
      const readSnapshot = () => store.loadWorkflowSnapshot({ workflowName: caller.workflow.id, runId: run.runId });
      await expect
        .poll(
          async () =>
            Object.values((await readWaitingSnapshot())?.tracingSpans ?? {}).filter(
              span => span.type === SpanType.WORKFLOW_SLEEP,
            ).length,
          { timeout: 20000 },
        )
        .toBe(1);
      const started = readEvents().filter(({ event }) => event.type === TracingEventType.SPAN_STARTED);
      expect(started).toHaveLength(kind === 'cancel-wait' ? 3 : 5);
      const completed = readEvents().filter(({ event }) => event.type === TracingEventType.SPAN_ENDED);
      expect(completed).toEqual([
        expect.objectContaining({
          pid: firstPid,
          event: expect.objectContaining({
            exportedSpan: expect.objectContaining({ entityId: 'decision-success', outcome: 'success' }),
          }),
        }),
      ]);
      const completedIds = new Set(completed.map(({ event }) => event.exportedSpan.id));
      const pending = started.filter(({ event }) => !completedIds.has(event.exportedSpan.id));
      await stopProcess(worker);
      worker = null;
      await run.cancel();
      expect((await readSnapshot())?.status).toBe('canceled');
      worker = await startWorker(dbUrl, kind, eventsPath);
      const replacementPid = worker.pid!;
      expect(replacementPid).not.toBe(firstPid);
      await expect
        .poll(() => readEvents().filter(({ event }) => event.type === TracingEventType.SPAN_ENDED).length, {
          timeout: 20000,
        })
        .toBe(started.length);
      expect((await readWaitingSnapshot())?.status).toBe('canceled');
      const terminal = readEvents().filter(({ event }) => event.type === TracingEventType.SPAN_ENDED);
      for (const { event } of pending) {
        expect(terminal.filter(record => record.event.exportedSpan.id === event.exportedSpan.id)).toEqual([
          expect.objectContaining({
            pid: replacementPid,
            event: expect.objectContaining({
              exportedSpan: expect.objectContaining({ outcome: 'abort', stopReason: 'caller_cancelled' }),
            }),
          }),
        ]);
      }
      expect(terminal.filter(record => completedIds.has(record.event.exportedSpan.id))).toEqual(completed);
      expect(readEvents().filter(({ event }) => event.type === TracingEventType.SPAN_STARTED)).toEqual(started);
    } finally {
      await stopProcess(worker);
      await caller.mastra.shutdown();
      await caller.storage.close();
    }
  },
  60000,
);
