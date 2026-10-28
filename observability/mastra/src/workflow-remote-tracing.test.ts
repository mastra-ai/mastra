import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { TracingEvent } from '@mastra/core/observability';
import { expect, it } from 'vitest';
import {
  buildEventedOutcomeHost,
  remoteControlFlowModes,
  remotePredicateModes,
  remoteNestedModes,
} from './test-utils/evented-outcome-worker';
import type { RemoteOutcomeMode } from './test-utils/evented-outcome-worker';
import { expectWorkflowOutcome } from './test-utils/workflow-outcomes';

const loader = createRequire(import.meta.url).resolve('tsx');
const workerPath = fileURLToPath(new URL('./test-utils/evented-outcome-worker.ts', import.meta.url));

async function stopWorker(worker: ChildProcess | undefined, force = false) {
  if (!worker || worker.exitCode !== null || worker.signalCode !== null) return;
  await new Promise<void>(resolve => {
    const timer = setTimeout(() => worker.kill('SIGKILL'), 5000);
    worker.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    worker.kill(force ? 'SIGKILL' : 'SIGTERM');
  });
}

async function startWorker(
  dbUrl: string,
  socketPath: string,
  eventsPath: string,
  mode: RemoteOutcomeMode,
  role = 'worker',
  runId = '',
  gatePath = '',
) {
  const worker = spawn(
    process.execPath,
    ['--import', loader, workerPath, role, dbUrl, socketPath, eventsPath, mode, runId, gatePath],
    { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
  );
  let output = '';
  worker.stdout?.on('data', data => {
    output += data;
  });
  worker.stderr?.on('data', data => {
    output += data;
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Worker startup timeout: ${output}`)), 15000);
      const failed = () => {
        clearTimeout(timer);
        reject(new Error(`Worker startup failed: ${output}`));
      };
      worker.once('exit', failed);
      worker.once('error', failed);
      worker.on('message', message => {
        if ((message as { type?: string }).type !== 'ready') return;
        clearTimeout(timer);
        worker.off('exit', failed);
        worker.off('error', failed);
        resolve();
      });
    });
    return worker;
  } catch (error) {
    await stopWorker(worker);
    throw error;
  }
}

it.each(
  (['start', 'startAsync'] as const).flatMap(start =>
    (['success', 'error', 'tripwire', 'bail', 'suspend'] as const).map(mode => ({ start, mode })),
  ),
)(
  'keeps $mode outcomes across real evented processes ($start)',
  async ({ start, mode }) => {
    const directory = mkdtempSync(join(tmpdir(), 'evented-outcomes-'));
    const dbUrl = pathToFileURL(join(directory, 'runs.db')).href;
    const socketPath = join(directory, 'pubsub.sock');
    const eventsPath = join(directory, 'events.jsonl');
    const caller = buildEventedOutcomeHost(dbUrl, socketPath, eventsPath, mode);
    const records = (): { pid: number; event: TracingEvent }[] =>
      existsSync(eventsPath)
        ? readFileSync(eventsPath, 'utf8')
            .trim()
            .split('\n')
            .filter(Boolean)
            .map(line => JSON.parse(line))
        : [];
    const ended = () => records().filter(record => record.event.type === TracingEventType.SPAN_ENDED);
    let worker: ChildProcess | undefined;
    try {
      await caller.storage.init();
      // Keep the socket broker on the caller so replacing a worker cannot replace the transport.
      await caller.pubsub.publish('test.bootstrap', { type: 'bootstrap', runId: 'bootstrap', data: {} });
      worker = await startWorker(dbUrl, socketPath, eventsPath, mode);
      const firstPid = worker.pid!;
      const run = await caller.workflow.createRun();
      await run[start]({ inputData: {} });
      await expect
        .poll(() => ended().filter(record => record.event.exportedSpan.type === SpanType.WORKFLOW_RUN).length, {
          timeout: 10000,
        })
        .toBe(1);
      expectWorkflowOutcome(
        ended().map(record => record.event.exportedSpan),
        mode,
      );
      const root = ended().find(record => record.event.exportedSpan.type === SpanType.WORKFLOW_RUN)!;
      const step = ended().find(record => record.event.exportedSpan.type === SpanType.WORKFLOW_STEP)!;
      expect(root.pid).toBe(firstPid);
      expect(step.pid).toBe(firstPid);
      expect(step.event.exportedSpan).toMatchObject({
        traceId: root.event.exportedSpan.traceId,
        parentSpanId: root.event.exportedSpan.id,
      });
      if (mode === 'suspend') {
        await stopWorker(worker);
        worker = await startWorker(dbUrl, socketPath, eventsPath, mode);
        expect(worker.pid).not.toBe(firstPid);
        await run.resume({ step: 'decision-suspend', resumeData: {} });
        await expect.poll(() => ended().length, { timeout: 10000 }).toBe(4);
        const resumed = ended().find(
          record =>
            record.event.exportedSpan.type === SpanType.WORKFLOW_RUN &&
            record.event.exportedSpan.id !== root.event.exportedSpan.id,
        )!;
        expect(resumed.event.exportedSpan).toMatchObject({
          outcome: 'success',
          resumedFromSpanId: root.event.exportedSpan.id,
        });
        expect(
          ended().filter(
            record =>
              record.event.exportedSpan.type === SpanType.WORKFLOW_STEP &&
              record.event.exportedSpan.outcome === 'success',
          ),
        ).toEqual([
          expect.objectContaining({
            pid: worker.pid,
            event: expect.objectContaining({
              exportedSpan: expect.objectContaining({
                traceId: resumed.event.exportedSpan.traceId,
                parentSpanId: resumed.event.exportedSpan.id,
              }),
            }),
          }),
        ]);
        expect(ended().find(record => record.event.exportedSpan.id === root.event.exportedSpan.id)).toEqual(root);
      }
      const starts = records().filter(record => record.event.type === TracingEventType.SPAN_STARTED);
      expect(starts.filter(record => record.event.exportedSpan.type === SpanType.WORKFLOW_RUN)).toHaveLength(
        mode === 'suspend' ? 2 : 1,
      );
      expect(ended()).toHaveLength(mode === 'suspend' ? 4 : 2);
      const store = (await caller.storage.getStore('workflows'))!;
      await expect
        .poll(
          async () =>
            (await store.loadWorkflowSnapshot({ workflowName: caller.workflow.id, runId: run.runId }))?.tracingSpans?.[
              `${root.event.exportedSpan.traceId}:${root.event.exportedSpan.id}`
            ],
        )
        .toMatchObject({ outcome: root.event.exportedSpan.outcome, observabilityInstanceName: 'worker-alias' });
    } finally {
      await stopWorker(worker);
      await caller.mastra.shutdown();
      await caller.pubsub.close();
      await caller.storage.close();
      rmSync(directory, { recursive: true, force: true });
    }
  },
  30000,
);

it.each(
  (['start', 'startAsync'] as const).flatMap(start =>
    (['success', 'error', 'tripwire', 'bail', 'suspend'] as const).map(mode => ({ start, mode })),
  ),
)(
  'completes $mode root after the caller process exits ($start)',
  async ({ start: startMethod, mode }) => {
    const directory = mkdtempSync(join(tmpdir(), 'evented-caller-loss-'));
    const dbUrl = pathToFileURL(join(directory, 'runs.db')).href;
    const socketPath = join(directory, 'pubsub.sock');
    const eventsPath = join(directory, 'events.jsonl');
    // The broker stays alive independently of both execution processes.
    const broker = buildEventedOutcomeHost(dbUrl, socketPath, eventsPath, mode);
    const runId = randomUUID();
    const gatePath = join(directory, 'release');
    const records = (): { pid: number; event: TracingEvent }[] =>
      existsSync(eventsPath)
        ? readFileSync(eventsPath, 'utf8')
            .trim()
            .split('\n')
            .filter(Boolean)
            .map(line => JSON.parse(line))
        : [];
    let caller: ChildProcess | undefined;
    let worker: ChildProcess | undefined;
    try {
      await broker.storage.init();
      await broker.pubsub.publish('test.bootstrap', { type: 'bootstrap', runId: 'bootstrap', data: {} });
      worker = await startWorker(dbUrl, socketPath, eventsPath, mode, 'worker', '', gatePath);
      caller = await startWorker(
        dbUrl,
        socketPath,
        eventsPath,
        mode,
        startMethod === 'start' ? 'caller-start' : 'caller',
        runId,
      );
      await expect.poll(() => existsSync(`${gatePath}.started`), { timeout: 10000 }).toBe(true);
      const start = records().find(
        record =>
          record.event.type === TracingEventType.SPAN_STARTED &&
          record.event.exportedSpan.type === SpanType.WORKFLOW_RUN,
      )!;
      expect(start.pid).toBe(caller.pid);
      expect(start.event.exportedSpan.outcome).toBeNull();
      await stopWorker(caller, true);
      writeFileSync(gatePath, 'release');
      const store = (await broker.storage.getStore('workflows'))!;
      await expect
        .poll(async () => (await store.loadWorkflowSnapshot({ workflowName: broker.workflow.id, runId }))?.status, {
          timeout: 10000,
        })
        .toBe(mode === 'suspend' ? 'suspended' : mode === 'error' || mode === 'tripwire' ? 'failed' : 'success');
      const ended = () => records().filter(record => record.event.type === TracingEventType.SPAN_ENDED);
      await expect
        .poll(() => ended().filter(record => record.event.exportedSpan.type === SpanType.WORKFLOW_RUN).length, {
          timeout: 2000,
        })
        .toBe(1);
      expectWorkflowOutcome(
        ended().map(record => record.event.exportedSpan),
        mode,
      );
      const root = ended().find(record => record.event.exportedSpan.type === SpanType.WORKFLOW_RUN)!;
      expect(root.pid).toBe(worker.pid);
      expect(root.event.exportedSpan.id).toBe(start.event.exportedSpan.id);
      expect(
        records().filter(
          record =>
            record.event.type === TracingEventType.SPAN_STARTED &&
            record.event.exportedSpan.type === SpanType.WORKFLOW_RUN,
        ),
      ).toHaveLength(1);
      expect(ended()).toHaveLength(2);
      const snapshot = await store.loadWorkflowSnapshot({ workflowName: broker.workflow.id, runId });
      const saved = snapshot?.tracingSpans?.[`${root.event.exportedSpan.traceId}:${root.event.exportedSpan.id}`];
      expect(saved).toMatchObject({
        outcome: root.event.exportedSpan.outcome,
        stopReason: root.event.exportedSpan.stopReason,
        stopReasonContext: root.event.exportedSpan.stopReasonContext,
        observabilityInstanceName: 'worker-alias',
      });
      expect(new Date(saved!.endTime!).getTime()).toBe(new Date(root.event.exportedSpan.endTime!).getTime());
      expect(
        ended().find(record => record.event.exportedSpan.type === SpanType.WORKFLOW_STEP)?.event.exportedSpan,
      ).toMatchObject({
        traceId: root.event.exportedSpan.traceId,
        parentSpanId: root.event.exportedSpan.id,
      });
    } finally {
      writeFileSync(gatePath, 'release');
      await stopWorker(caller, true);
      await stopWorker(worker);
      await broker.mastra.shutdown();
      await broker.pubsub.close();
      await broker.storage.close();
      rmSync(directory, { recursive: true, force: true });
    }
  },
  30000,
);

it.each([
  'sleep',
  'sleep-until',
  'step',
  ...remoteNestedModes,
  ...remoteControlFlowModes,
  ...remotePredicateModes,
] as const)(
  'cancels the original %s span after its worker exits',
  async mode => {
    const directory = mkdtempSync(join(tmpdir(), 'evented-wait-recovery-'));
    const dbUrl = pathToFileURL(join(directory, 'runs.db')).href;
    const socketPath = join(directory, 'pubsub.sock');
    const eventsPath = join(directory, 'events.jsonl');
    const predicate = remotePredicateModes.includes(mode as (typeof remotePredicateModes)[number]);
    const nested = remoteNestedModes.includes(mode as (typeof remoteNestedModes)[number]);
    const control =
      nested || predicate || remoteControlFlowModes.includes(mode as (typeof remoteControlFlowModes)[number]);
    const targetType = nested
      ? SpanType.WORKFLOW_RUN
      : predicate
        ? SpanType.WORKFLOW_CONDITIONAL_EVAL
        : mode === 'parallel'
          ? SpanType.WORKFLOW_PARALLEL
          : mode === 'conditional'
            ? SpanType.WORKFLOW_CONDITIONAL
            : control
              ? SpanType.WORKFLOW_LOOP
              : mode === 'step'
                ? SpanType.WORKFLOW_STEP
                : SpanType.WORKFLOW_SLEEP;
    const gatePath = mode === 'step' || control ? join(directory, 'release-step') : undefined;
    const caller = buildEventedOutcomeHost(dbUrl, socketPath, eventsPath, mode, gatePath);
    const canceller = buildEventedOutcomeHost(dbUrl, socketPath, eventsPath, mode, undefined, false);
    const records = (): { pid: number; event: TracingEvent }[] =>
      existsSync(eventsPath)
        ? readFileSync(eventsPath, 'utf8')
            .trim()
            .split('\n')
            .filter(Boolean)
            .map(line => JSON.parse(line))
        : [];
    const ended = () => records().filter(record => record.event.type === TracingEventType.SPAN_ENDED);
    let worker: ChildProcess | undefined;
    try {
      await caller.storage.init();
      await caller.pubsub.publish('test.bootstrap', { type: 'bootstrap', runId: 'bootstrap', data: {} });
      worker = await startWorker(dbUrl, socketPath, eventsPath, mode, 'worker', '', gatePath);
      const originalPid = worker.pid;
      const run = await caller.workflow.createRun();
      await run.startAsync({ inputData: {} });
      const store = (await caller.storage.getStore('workflows'))!;
      const waits = () =>
        records().filter(
          record =>
            record.event.type === TracingEventType.SPAN_STARTED && record.event.exportedSpan.type === targetType,
        );
      if (gatePath) await expect.poll(() => existsSync(`${gatePath}.started`), { timeout: 10000 }).toBe(true);
      else await expect.poll(() => waits().length, { timeout: 10000 }).toBe(2);
      if (mode === 'nested-foreach')
        await expect
          .poll(
            () =>
              readdirSync(directory).filter(
                name =>
                  name.startsWith('release-step.') && name !== 'release-step.started' && name.endsWith('.started'),
              ).length,
          )
          .toBe(2);
      const wait = waits().at(-1)!;
      if (gatePath) await expect.poll(() => existsSync(`${gatePath}.started`)).toBe(true);
      else
        await expect
          .poll(
            async () =>
              (await store.loadWorkflowSnapshot({ workflowName: caller.workflow.id, runId: run.runId }))
                ?.tracingSpans?.[`${wait.event.exportedSpan.traceId}:${wait.event.exportedSpan.id}`]?.outcome,
          )
          .toBeNull();
      expect(wait.pid).toBe(originalPid);
      const completed = ended();
      expect(completed.length).toBeGreaterThanOrEqual(2);
      const starts = records().filter(record => record.event.type === TracingEventType.SPAN_STARTED);
      for (const record of completed) expect(record.event.exportedSpan.outcome).toBe('success');
      await stopWorker(worker, true);
      worker = await startWorker(dbUrl, socketPath, eventsPath, mode);
      expect(worker.pid).not.toBe(originalPid);
      await canceller.storage.init();
      const remoteRun = await canceller.workflow.createRun({ runId: run.runId });
      await remoteRun.cancel();
      await expect.poll(() => ended().length, { timeout: 2500 }).toBe(starts.length);
      expect(
        ended()
          .map(record => record.event.exportedSpan.id)
          .sort(),
      ).toEqual(starts.map(record => record.event.exportedSpan.id).sort());
      const completedIds = new Set(completed.map(record => record.event.exportedSpan.id));
      for (const record of ended()) {
        if (!completedIds.has(record.event.exportedSpan.id))
          expect(record.event.exportedSpan).toMatchObject({ outcome: 'abort', stopReason: 'caller_cancelled' });
      }
      const recovered = ended().find(record => record.event.exportedSpan.id === wait.event.exportedSpan.id)!;
      expect(recovered).toMatchObject({
        pid: worker.pid,
        event: {
          exportedSpan: {
            isRootSpan: false,
            outcome: 'abort',
            stopReason: 'caller_cancelled',
            stopReasonContext: null,
          },
        },
      });
      expect(ended().filter(record => record.event.exportedSpan.isRootSpan)).toHaveLength(1);
      for (const original of completed)
        expect(ended().find(record => record.event.exportedSpan.id === original.event.exportedSpan.id)).toEqual(
          original,
        );
      expect(
        records().filter(
          record =>
            record.event.type === TracingEventType.SPAN_STARTED &&
            record.event.exportedSpan.id === wait.event.exportedSpan.id,
        ),
      ).toHaveLength(1);
      const saved = await store.loadWorkflowSnapshot({ workflowName: caller.workflow.id, runId: run.runId });
      expect(saved?.status).toBe('canceled');
      const childRoots = starts.filter(
        record => record.event.exportedSpan.type === SpanType.WORKFLOW_RUN && !record.event.exportedSpan.isRootSpan,
      );
      const childSnapshots = await Promise.all(
        childRoots.map(async record => {
          const root = record.event.exportedSpan;
          const snapshot = await store.loadWorkflowSnapshot({
            workflowName: root.entityId!,
            runId: root.metadata!.runId as string,
          });
          expect(snapshot?.status).toBe(completedIds.has(root.id) ? 'success' : 'canceled');
          return snapshot;
        }),
      );
      for (const record of completed) {
        const peer = record.event.exportedSpan;
        const checkpoint = [saved, ...childSnapshots]
          .map(snapshot => snapshot?.tracingSpans?.[`${peer.traceId}:${peer.id}`])
          .find(Boolean);
        expect(checkpoint?.outcome).toBe('success');
        expect(new Date(checkpoint!.endTime!).getTime()).toBe(new Date(peer.endTime!).getTime());
      }
      const targetSnapshot = nested
        ? await store.loadWorkflowSnapshot({
            workflowName: wait.event.exportedSpan.entityId!,
            runId: wait.event.exportedSpan.metadata!.runId as string,
          })
        : saved;
      expect(targetSnapshot?.status).toBe('canceled');
      expect(
        targetSnapshot?.tracingSpans?.[`${wait.event.exportedSpan.traceId}:${wait.event.exportedSpan.id}`],
      ).toMatchObject({
        outcome: 'abort',
        stopReason: 'caller_cancelled',
        observabilityInstanceName: 'worker-alias',
      });
    } finally {
      await stopWorker(worker, true);
      await canceller.mastra.shutdown();
      await canceller.pubsub.close();
      await canceller.storage.close();
      await caller.mastra.shutdown();
      await caller.pubsub.close();
      await caller.storage.close();
      rmSync(directory, { recursive: true, force: true });
    }
  },
  30000,
);
