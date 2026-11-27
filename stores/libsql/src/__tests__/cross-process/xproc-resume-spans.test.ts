/**
 * A durable run that suspends or crashes on one worker and is resumed or recovered from another
 * process must report each execution as its own AGENT_RUN + MODEL_GENERATION pair in one trace: the
 * earlier pair stays ended as it was, the next pair nests under it with that execution's own
 * outcome, and every span ends exactly once. Real OS processes: the API replica that streams, a
 * worker, and a fresh replica that resumes or recovers, all over one LibSQL file and one socket.
 */
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { createEventedAgent, DurableStepIds } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { afterEach, describe, expect, it } from 'vitest';

import { LibSQLStore } from '../../storage';
import type { ResumeSpansPeerArgs, ResumeSpansPeerResult } from './fixtures/resume-spans-peer';
import { createSpanEventsObservability, describeSpans, readSpanLifecycles } from './fixtures/span-events';
import type { SpanLifecycle } from './fixtures/span-events';
import { createXprocEnv, DEFAULT_HANG_GUARD_MS, PEER_TIMEOUT_MS } from './peer-helper';
import type { PeerHandle, XprocEnv } from './peer-helper';
import { createStepAgent } from './step-agent';

const PEER = new URL('./fixtures/resume-spans-peer.ts', import.meta.url);
const CELL_TIMEOUT_MS = PEER_TIMEOUT_MS * 2 + DEFAULT_HANG_GUARD_MS;
const ROOTS = new Set(['agent_run', 'model_generation']);

describe('durable run spans across processes', () => {
  let env: XprocEnv;
  let storage: LibSQLStore;
  let mastra: Mastra | undefined;
  let agentId: string;
  let eventsPath: string;
  let storageVersion: 1 | 2 | undefined;
  const peers: PeerHandle[] = [];

  afterEach(async () => {
    for (const peer of peers.splice(0)) await peer.kill().catch(() => {});
    try {
      await mastra?.shutdown();
    } finally {
      mastra = undefined;
      try {
        await storage.close();
      } finally {
        await env.cleanup();
      }
    }
  });

  async function setup(options: { workers: boolean; storageVersion?: 1 | 2 }) {
    env = await createXprocEnv({ workers: options.workers });
    agentId = `resume-spans-${randomUUID()}`;
    eventsPath = path.join(env.dir, 'span-events.jsonl');
    storageVersion = options.storageVersion;
    storage = new LibSQLStore({ id: 'resume-spans-api', url: env.dbUrl });
    const { agent } = createStepAgent({ id: agentId, steps: 1 });
    const runner = createEventedAgent({ agent, storageVersion });
    mastra = new Mastra({
      agents: { [agentId]: runner },
      storage,
      pubsub: env.pubsub(),
      logger: false,
      workers: options.workers ? undefined : false,
      observability: createSpanEventsObservability(eventsPath, 'api'),
    });
    return runner;
  }

  async function spawn(role: string, args: Omit<ResumeSpansPeerArgs, 'agentId' | 'eventsPath' | 'storageVersion'>) {
    const peer = await env.spawnPeer<ResumeSpansPeerArgs>(
      PEER,
      { agentId, eventsPath, storageVersion, ...args },
      { role, workers: args.mode !== 'resumer' },
    );
    peers.push(peer);
    return peer;
  }

  async function snapshot(runId: string) {
    const workflows = (await storage.getStore('workflows'))!;
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
      readSpanLifecycles(eventsPath, runId).filter(span => ROOTS.has(span.type) && span.endedBy.length === 0);
    const deadline = Date.now() + 5_000;
    while (open().length > 0 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    return readSpanLifecycles(eventsPath, runId);
  }

  function expectEndedOnce(spans: SpanLifecycle[]) {
    for (const span of spans.filter(span => ['agent_run', 'model_generation', 'model_step'].includes(span.type))) {
      expect(span.endedBy, `${span.type} ${span.spanId} ended exactly once\n${describeSpans(spans)}`).toHaveLength(1);
    }
  }

  it(
    'a resume from a fresh process ends the suspended pair once and records its own pair in the same trace',
    async () => {
      const runner = await setup({ workers: false });
      const workerPeer = await spawn('worker', { mode: 'worker' });
      await workerPeer.waitFor('worker-ready');

      const stream = await runner.stream('Perform the steps', { requireToolApproval: true, maxSteps: 2 });
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

      const resumer = await spawn('resumer', { mode: 'resumer', runId: stream.runId, toolCallId });
      const resumed = await resumer.result<ResumeSpansPeerResult>();
      expect(resumed.error, env.describe()).toBeNull();
      expect(resumed.chunkTypes).toContain('finish');

      const spans = await settledSpans(stream.runId);
      const [first, second, ...more] = spans.filter(span => span.type === 'agent_run');
      expect(more, `two agent runs, one per execution\n${describeSpans(spans)}`).toEqual([]);
      expect(first?.endedBy, describeSpans(spans)).toEqual([{ role: 'worker', outcome: 'suspend' }]);
      expect(second, `the resume opened its own AGENT_RUN\n${describeSpans(spans)}`).toMatchObject({
        startedBy: ['resumer'],
        resumed: true,
        parentSpanId: first!.spanId,
        endedBy: [{ role: 'worker', outcome: 'success' }],
      });
      const [firstGeneration, secondGeneration] = spans.filter(span => span.type === 'model_generation');
      expect(firstGeneration?.endedBy, describeSpans(spans)).toEqual([{ role: 'worker', outcome: 'suspend' }]);
      expect(secondGeneration, describeSpans(spans)).toMatchObject({
        parentSpanId: second!.spanId,
        endedBy: [{ role: 'worker', outcome: 'success' }],
      });
      expectEndedOnce(spans);

      workerPeer.send('finish');
      await workerPeer.result();
    },
    CELL_TIMEOUT_MS,
  );

  it(
    'a recovery of a run whose worker died right after saving the final step ends the recovered pair with the saved outcome',
    async () => {
      // Storage v2 stores every step as it completes, so a worker can die between the final step
      // and the run's status.
      const runner = await setup({ workers: false, storageVersion: 2 });
      const dying = await spawn('worker-1', { mode: 'worker', exitAfterFinalStep: true });
      await dying.waitFor('worker-ready');

      // The worker publishes FINISH and saves the final step, then dies before the run's status.
      const stream = await runner.stream('Perform the steps', { maxSteps: 3 });
      expect(await dying.exit({ timeoutMs: DEFAULT_HANG_GUARD_MS }), env.describe()).toEqual({ code: 0, signal: null });
      stream.cleanup?.();
      const saved = await snapshot(stream.runId);
      expect(saved?.status, 'the run is still active in storage').toBe('running');
      expect((saved?.context as Record<string, { status?: string }>)?.['map-final-output']?.status).toBe('success');

      const recoverer = await spawn('recoverer', { mode: 'recoverer', runId: stream.runId });
      const recovered = await recoverer.result<ResumeSpansPeerResult>();
      expect(recovered.error, env.describe()).toBeNull();
      expect(recovered.chunkTypes).toContain('finish');

      const spans = await settledSpans(stream.runId);
      const [first, second, ...more] = spans.filter(span => span.type === 'agent_run');
      expect(
        more,
        `two agent runs, one per execution
${describeSpans(spans)}`,
      ).toEqual([]);
      expect(first?.endedBy, describeSpans(spans)).toEqual([{ role: 'worker-1', outcome: 'success' }]);
      expect(
        second,
        `the recovery ends its own AGENT_RUN as the saved run did
${describeSpans(spans)}`,
      ).toMatchObject({
        startedBy: ['recoverer'],
        recovered: true,
        parentSpanId: first!.spanId,
        endedBy: [{ role: 'recoverer', outcome: 'success' }],
      });
      expect(spans.filter(span => span.type === 'model_generation').map(span => span.endedBy)).toEqual([
        [{ role: 'worker-1', outcome: 'success' }],
        [{ role: 'recoverer', outcome: 'success' }],
      ]);
      expectEndedOnce(spans);
    },
    CELL_TIMEOUT_MS,
  );
});
