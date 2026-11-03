/**
 * A durable run that suspends on one worker and is resumed or recovered from another process must
 * report each execution segment as its own AGENT_RUN + MODEL_GENERATION pair in one trace: the
 * suspended pair stays ended `suspend`, the next pair nests under it with the resume's own outcome,
 * and every span id ends exactly once. Real OS processes: the API replica that streams, a worker
 * pool, and a fresh replica that resumes or recovers, all over one LibSQL file and one socket.
 */
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { createEventedAgent, DurableStepIds } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LibSQLStore } from '../../storage';
import type { ResumeSegmentPeerArgs, ResumeSegmentPeerResult } from './fixtures/resume-segment-peer';
import { createSegmentObservability, readSegmentEvents, spanLifecycles } from './fixtures/segment-events';
import type { SpanLifecycle } from './fixtures/segment-events';
import { createXprocEnv, DEFAULT_HANG_GUARD_MS, PEER_TIMEOUT_MS } from './peer-helper';
import type { PeerHandle, XprocEnv } from './peer-helper';
import { createStepAgent } from './step-agent';

const PEER = new URL('./fixtures/resume-segment-peer.ts', import.meta.url);
const CELL_TIMEOUT_MS = PEER_TIMEOUT_MS * 3 + DEFAULT_HANG_GUARD_MS;
const ROOTS = new Set(['agent_run', 'model_generation']);
const SEGMENTS_KEY = 'mastra__durableSegments';

describe('resumed and recovered durable runs keep one span pair per segment across processes', () => {
  let env: XprocEnv;
  let storage: LibSQLStore;
  let reader: LibSQLStore;
  let mastra: Mastra | undefined;
  let agentId: string;
  let eventsPath: string;
  const peers: PeerHandle[] = [];

  beforeEach(async () => {
    env = await createXprocEnv({ workers: false });
    agentId = `resume-segments-${randomUUID()}`;
    eventsPath = path.join(env.dir, 'span-events.jsonl');
    storage = new LibSQLStore({ id: 'resume-segments-api', url: env.dbUrl });
    reader = new LibSQLStore({ id: 'resume-segments-reader', url: env.dbUrl });
  });

  afterEach(async () => {
    for (const peer of peers.splice(0)) await peer.kill().catch(() => {});
    try {
      await mastra?.shutdown();
    } finally {
      mastra = undefined;
      try {
        await storage.close();
      } finally {
        try {
          await reader.close();
        } finally {
          await env.cleanup();
        }
      }
    }
  });

  function api(steps: number) {
    const { agent, modelCalls } = createStepAgent({ id: agentId, steps, perRun: true });
    const runner = createEventedAgent({ agent });
    mastra = new Mastra({
      agents: { [agentId]: runner },
      storage,
      pubsub: env.pubsub(),
      logger: false,
      workers: false,
      observability: createSegmentObservability(eventsPath, 'api'),
    });
    return { runner, modelCalls };
  }

  async function spawn(role: string, args: Omit<ResumeSegmentPeerArgs, 'agentId' | 'eventsPath'>) {
    const peer = await env.spawnPeer<ResumeSegmentPeerArgs>(
      PEER,
      { agentId, eventsPath, ...args },
      { role, workers: args.mode === 'worker' },
    );
    peers.push(peer);
    return peer;
  }

  async function worker(role: string, steps: number, blockAt?: number) {
    const peer = await spawn(role, { mode: 'worker', steps, blockAt });
    await peer.waitFor('worker-ready');
    return peer;
  }

  async function finishWorkers(...workers: PeerHandle[]) {
    for (const peer of workers) peer.send('finish');
    for (const peer of workers) await peer.result();
  }

  /** Streams until the first approval request, which a worker answers by suspending the run. */
  async function streamUntilApproval(runner: ReturnType<typeof createEventedAgent>, steps: number) {
    const stream = await runner.stream('Perform the steps', { requireToolApproval: true, maxSteps: steps + 1 });
    let toolCallId: string | undefined;
    for await (const chunk of stream.fullStream as AsyncIterable<any>) {
      if (chunk.type === 'tool-call-approval') {
        toolCallId = chunk.payload?.toolCallId;
        break;
      }
    }
    stream.cleanup?.();
    expect(toolCallId, env.describe()).toBeDefined();
    await waitForSnapshotStatus(stream.runId, 'suspended');
    return { runId: stream.runId, toolCallId: toolCallId! };
  }

  async function snapshot(runId: string) {
    const workflows = (await reader.getStore('workflows'))!;
    return workflows.loadWorkflowSnapshot({ workflowName: DurableStepIds.AGENTIC_LOOP, runId });
  }

  async function waitForSnapshotStatus(runId: string, status: string) {
    await expect
      .poll(async () => (await snapshot(runId))?.status, { timeout: DEFAULT_HANG_GUARD_MS, interval: 100 })
      .toBe(status);
  }

  /** The run's spans once no root span is still open, or as they stand when the guard fires. */
  async function settledSpans(runId: string): Promise<SpanLifecycle[]> {
    await mastra?.observability?.flush?.();
    const open = () =>
      spanLifecycles(readSegmentEvents(eventsPath), runId).filter(
        span => ROOTS.has(span.type) && span.endedBy.length === 0,
      );
    const deadline = Date.now() + 5_000;
    while (open().length > 0 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    return spanLifecycles(readSegmentEvents(eventsPath), runId);
  }

  function describeSpans(spans: SpanLifecycle[]): string {
    return spans
      .map(
        span =>
          `${span.type} ${span.spanId.slice(0, 8)} parent=${span.parentSpanId?.slice(0, 8) ?? '-'} ` +
          `started=${span.startedBy.join(',')} ended=${span.endedBy.map(end => `${end.role}:${end.outcome}`).join(',')}` +
          `${span.resumed ? ' resumed' : ''}${span.recovered ? ' recovered' : ''}`,
      )
      .join('\n');
  }

  function expectEndedOnce(spans: SpanLifecycle[]) {
    for (const span of spans.filter(span => ['agent_run', 'model_generation', 'model_step'].includes(span.type))) {
      expect(span.startedBy, `${span.type} ${span.spanId} started once\n${describeSpans(spans)}`).toHaveLength(1);
      expect(span.endedBy, `${span.type} ${span.spanId} ended exactly once\n${describeSpans(spans)}`).toHaveLength(1);
    }
  }

  function roots(spans: SpanLifecycle[], type: 'agent_run' | 'model_generation') {
    return spans.filter(span => span.type === type);
  }

  it(
    'a resume from a fresh process ends the suspended pair once and records its own pair in the same trace',
    async () => {
      const { runner, modelCalls } = api(1);
      const workerPeer = await worker('worker', 1);
      const { runId, toolCallId } = await streamUntilApproval(runner, 1);

      const resumer = await spawn('resumer', { mode: 'resumer', steps: 1, runId, toolCallId });
      const resumed = await resumer.result<ResumeSegmentPeerResult>();
      expect(resumed.chunkTypes, env.describe()).toContain('finish');
      expect(resumed.error).toBeNull();
      expect(modelCalls(), 'only the worker calls the model').toBe(0);

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
      expect(await snapshot(runId), 'the finished run keeps no snapshot').toBeNull();

      await finishWorkers(workerPeer);
    },
    CELL_TIMEOUT_MS,
  );

  it(
    'a second suspension and a second fresh-process resume chain the pairs: parent is the previous segment',
    async () => {
      const { runner } = api(2);
      const workerPeer = await worker('worker', 2);
      const { runId, toolCallId } = await streamUntilApproval(runner, 2);

      const firstResumer = await spawn('resumer-1', { mode: 'resumer', steps: 2, runId, toolCallId });
      const firstResume = await firstResumer.result<ResumeSegmentPeerResult>();
      expect(firstResume.approvals, env.describe()).toHaveLength(1);
      await waitForSnapshotStatus(runId, 'suspended');

      let spans = await settledSpans(runId);
      const [first, second] = roots(spans, 'agent_run');
      expect(second, describeSpans(spans)).toMatchObject({
        startedBy: ['resumer-1'],
        parentSpanId: first!.spanId,
        endedBy: [{ role: 'worker', outcome: 'suspend', error: null }],
      });
      // The persisted suspension names the segment a later resume continues from.
      const carried = (await snapshot(runId))?.requestContext?.[SEGMENTS_KEY] as
        | Record<string, { agent?: { id?: string } }>
        | undefined;
      expect(carried?.[runId]?.agent?.id, 'the suspended snapshot carries the resumed segment').toBe(second!.spanId);

      const secondResumer = await spawn('resumer-2', {
        mode: 'resumer',
        steps: 2,
        runId,
        toolCallId: firstResume.approvals[0],
      });
      const secondResume = await secondResumer.result<ResumeSegmentPeerResult>();
      expect(secondResume.chunkTypes, env.describe()).toContain('finish');

      spans = await settledSpans(runId);
      const [, , third, ...more] = roots(spans, 'agent_run');
      expect(more, describeSpans(spans)).toEqual([]);
      expect(third, describeSpans(spans)).toMatchObject({
        startedBy: ['resumer-2'],
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

      await finishWorkers(workerPeer);
    },
    CELL_TIMEOUT_MS,
  );

  it(
    'a resume whose dispatch fails ends only its own pair, with the error, and leaves the suspended pair alone',
    async () => {
      const { runner } = api(1);
      const workerPeer = await worker('worker', 1);
      const { runId, toolCallId } = await streamUntilApproval(runner, 1);

      const resumer = await spawn('resumer', { mode: 'resumer', steps: 1, runId, toolCallId, failDispatch: true });
      const resumed = await resumer.result<ResumeSegmentPeerResult>();
      expect(resumed.error, env.describe()).toContain('dispatch failed on purpose');

      const spans = await settledSpans(runId);
      const [first, second, ...more] = roots(spans, 'agent_run');
      expect(more, describeSpans(spans)).toEqual([]);
      expect(first?.endedBy).toEqual([{ role: 'worker', outcome: 'suspend', error: null }]);
      expect(second, describeSpans(spans)).toMatchObject({
        startedBy: ['resumer'],
        resumed: true,
        endedBy: [{ role: 'resumer', outcome: 'error', error: expect.stringContaining('dispatch failed on purpose') }],
      });
      expect(roots(spans, 'model_generation').map(span => span.endedBy.map(end => end.outcome))).toEqual([
        ['suspend'],
        ['error'],
      ]);

      await finishWorkers(workerPeer);
    },
    CELL_TIMEOUT_MS,
  );

  it(
    'a forced recovery from a fresh process ends the crashed pair once, and the recovered pair once on the new worker',
    async () => {
      const { runner } = api(1);
      const original = await worker('worker-1', 1, 1);
      const stream = await runner.stream('Perform the steps', { maxSteps: 3 });
      const blocked = await original.waitFor<{ pid: number; n: number }>('blocked');
      expect(blocked.n).toBe(1);
      await waitForSnapshotStatus(stream.runId, 'running');
      await original.pause();

      const replacement = await worker('worker-2', 1);
      const recoverer = await spawn('recoverer', { mode: 'recoverer', steps: 1, runId: stream.runId });
      const recovered = await recoverer.result<ResumeSegmentPeerResult>();
      expect(recovered.chunkTypes, env.describe()).toContain('finish');
      expect(recovered.error).toBeNull();
      stream.cleanup?.();

      // The stopped worker finishes its tool and loses every later step to the takeover.
      await original.resume();
      original.send('release');
      await new Promise(resolve => setTimeout(resolve, 2_000));

      const spans = await settledSpans(stream.runId);
      const [crashed, recoveredRun, ...more] = roots(spans, 'agent_run');
      expect(more, describeSpans(spans)).toEqual([]);
      expect(crashed?.endedBy, describeSpans(spans)).toEqual([
        { role: 'recoverer', outcome: 'interrupted', error: null },
      ]);
      expect(recoveredRun, describeSpans(spans)).toMatchObject({
        startedBy: ['recoverer'],
        recovered: true,
        recoveredFromSpanId: crashed!.spanId,
        parentSpanId: crashed!.spanId,
        endedBy: [{ role: 'worker-2', outcome: 'success', error: null }],
      });
      expect(
        roots(spans, 'model_generation').map(span => span.endedBy.map(end => `${end.role}:${end.outcome}`)),
      ).toEqual([['recoverer:interrupted'], ['worker-2:success']]);
      expect(
        spans.filter(span => ROOTS.has(span.type)).flatMap(span => span.endedBy.map(end => end.role)),
        `the superseded worker ends no root span\n${describeSpans(spans)}`,
      ).not.toContain('worker-1');
      expectEndedOnce(spans);

      await finishWorkers(original, replacement);
    },
    CELL_TIMEOUT_MS,
  );
});
