/**
 * Port of validation-harness case T79 (xproc-abort): abort a durable run from
 * another OS process.
 *
 * The run belongs to this process: the script calls `step` 1, 2, 3 and the
 * tool parks at step 2. A peer process that owns no local run, sharing only
 * the UnixSocketPubSub socket and the LibSQL file, calls
 * `abortRunStream(runId)`. The tool's gate is released only after the peer
 * has reported, so if the abort never crosses the process boundary the run
 * goes on to step 3 and the test fails.
 */
import { randomUUID } from 'node:crypto';

import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LibSQLStore } from '../../storage';
import type { T79PeerArgs } from './fixtures/t79-peer';
import { createXprocEnv, DEFAULT_HANG_GUARD_MS } from './peer-helper';
import type { XprocEnv } from './peer-helper';
import { createStepAgent, gate } from './step-agent';
import type { Gate, StepToolEvent } from './step-agent';

const PEER_FIXTURE = new URL('./fixtures/t79-peer.ts', import.meta.url);

/**
 * A failing cell can wait out two hang guards before it reports: one for the
 * step the case is built on (the parked tool, or the abort reaching this
 * process) and one for teardown, which releases the parked tool and gives the
 * run a bounded chance to settle so a failure can say whether the run was still
 * live. A passing cell only ever waits for the first, and normally for neither.
 */
const CELL_TIMEOUT_MS = DEFAULT_HANG_GUARD_MS * 2 + 5_000;

function hangGuard<T>(promise: Promise<T>, what: string, describeEnv: () => string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${what} within ${DEFAULT_HANG_GUARD_MS}ms (hang guard)\n${describeEnv()}`)),
        DEFAULT_HANG_GUARD_MS,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Release the parked tool and wait a bounded time for the stream to settle, so
 * teardown is not racing a live run (shutdown does not wait for one: it
 * abandons pending runs after its drain timeout). Returns a note to append to
 * a failure, or `''` when the run settled. Never throws — the cell's own
 * failure is the one that gets reported, and an unsettled run is appended to
 * it rather than replacing it.
 */
async function drainRun(release: Gate, settled: Promise<void>): Promise<string> {
  release.resolve();
  const drained = await Promise.race([
    settled.then(
      () => ({ settled: true as const, streamError: undefined }),
      (streamError: unknown) => ({ settled: false as const, streamError }),
    ),
    new Promise<{ settled: false; streamError: undefined }>(resolve =>
      setTimeout(() => resolve({ settled: false, streamError: undefined }), DEFAULT_HANG_GUARD_MS),
    ),
  ]);
  if (drained.settled) return '';
  if (drained.streamError) {
    return `\n(teardown: the run's stream rejected instead of completing: ${String(
      (drained.streamError as Error)?.message ?? drained.streamError,
    )})`;
  }
  return `\n(teardown: the run never settled within ${DEFAULT_HANG_GUARD_MS}ms after the parked tool was released — this cell failed while a run was still live, so it reports less than a settled run would)`;
}

describe.each(['durable', 'evented'] as const)('T79 xproc-%s: abort a run from another process', engine => {
  let env: XprocEnv;
  let storage: LibSQLStore | undefined;
  let mastra: Mastra | undefined;

  beforeEach(async () => {
    env = await createXprocEnv();
  });

  afterEach(async () => {
    // Shutdown before closing storage, and never close storage without it: the
    // owning instance is what finalizes a run that is still in flight, and
    // Mastra closes the stores it owns. The evented engine deletes a finished
    // run's snapshots in a fire-and-forget continuation, so that cleanup can
    // instead land during shutdown and lose the race against the store closing;
    // the store then logs `deleteWorkflowRunById ... CLIENT_CLOSED` and the
    // agent swallows it (no unhandled rejection, nothing asserted after here).
    // Nested so a shutdown failure still closes the store, and either still
    // cleans up the peers: teardown is what contains a failed cell.
    try {
      await mastra?.shutdown();
      mastra = undefined;
    } finally {
      try {
        await storage?.close();
        storage = undefined;
      } finally {
        await env.cleanup();
      }
    }
  });

  it(
    'stops the run before step 3 with no model call after the abort',
    async () => {
      const id = randomUUID();
      const agentId = `t79-${engine}-${id}`;
      const runId = `t79-run-${id}`;

      const toolLog: StepToolEvent[] = [];
      const reached = gate();
      const release = gate();
      // Resolved from the parked tool itself, so the test can wait for this
      // process to *process* the abort rather than only for the broker to have
      // delivered it. Releasing the gate first would unpark the tool un-aborted
      // and send the run to step 3 — the shape of the failure this test exists
      // to catch.
      const abortProcessed = gate();
      const { agent, modelCalls } = createStepAgent({
        id: agentId,
        steps: 3,
        blockAt: 2,
        release: release.promise,
        onToolEvent: event => {
          toolLog.push(event);
          if (event.event === 'reached') reached.resolve();
          if (event.event === 'released' && event.aborted) abortProcessed.resolve();
        },
      });
      const runner = engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });

      // Main claims the broker role before any peer connects.
      const pubsub = env.pubsub();
      let controlReceivedByMain = 0;
      await pubsub.subscribe(`agent.control.${runId}`, () => {
        controlReceivedByMain++;
      });
      storage = new LibSQLStore({ id: `t79-main-${id}`, url: env.dbUrl });
      mastra = new Mastra({ agents: { t79: runner }, storage, pubsub, logger: false });
      expect(mastra.getAgent('t79') as unknown).toBe(runner);

      // Spawned first, as in the harness: it is idle until told to abort. It
      // consumes no workflow events (it only aborts), so it declares
      // `workers: false` — the peer runtime fails a peer whose declaration and
      // boot state disagree.
      const peerArgs: T79PeerArgs = { engine, agentId, runId };
      const peer = await env.spawnPeer(PEER_FIXTURE, peerArgs, { role: `peer-${engine}`, workers: false });

      const callbacks: string[] = [];
      const result = await runner.stream('Go', {
        runId,
        maxSteps: 6,
        onAbort: () => {
          callbacks.push('onAbort');
        },
        onFinish: () => {
          callbacks.push('onFinish');
        },
      });
      const chunks: Array<{ type: string }> = [];
      const settled = (async () => {
        const reader = result.fullStream.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) return;
          chunks.push(value);
        }
      })();

      const record = () =>
        JSON.stringify({
          engine,
          runId,
          modelCalls: modelCalls(),
          toolLog,
          chunkTypes: chunks.map(c => c.type),
          callbacks,
          controlReceivedByMain,
        });
      const context = () => `${record()}\n${env.describe()}`;

      let failure: unknown;
      let teardownNote = '';

      try {
        // Not-exercised guard: the case only means something once step 2 is parked.
        await hangGuard(reached.promise, 'step 2 never reached its gate (case not exercised)', context);
        const callsAtAbort = modelCalls();

        peer.send('abort-now');
        const peerResult = await peer.result<{ accepted: boolean; runId: string }>();
        const peerExit = await peer.exit();
        // The peer's echo only proves the broker delivered the frame. Wait for
        // this process to act on it before anything releases the parked tool.
        await hangGuard(
          abortProcessed.promise,
          'this process never processed the remote abort (the parked step was not aborted)',
          context,
        );
        await hangGuard(settled, 'stream did not settle after the abort', context);
        // Recorded, not asserted (tri-state / product calls): accepted, abort chunk, onAbort vs onFinish.
        const diagnostics = `peer=${JSON.stringify({ peerResult, peerExit })}\n${context()}`;

        expect(peerExit, `peer process exited cleanly\n${diagnostics}`).toEqual({ code: 0, signal: null });
        expect(peerResult.runId, `peer reported a result with no error\n${diagnostics}`).toBe(runId);
        expect(modelCalls() - callsAtAbort, `no model call after the abort\n${diagnostics}`).toBe(0);
        const parked = toolLog.find(
          (e): e is Extract<StepToolEvent, { event: 'released' }> => e.event === 'released' && e.n === 2,
        );
        expect(parked?.aborted, `the parked step saw the abort\n${diagnostics}`).toBe(true);
        expect(
          toolLog.filter(e => e.event === 'start' && e.n === 3),
          `step 3 never started\n${diagnostics}`,
        ).toEqual([]);
        expect(
          chunks.filter(c => c.type === 'error'),
          `no error chunk\n${diagnostics}`,
        ).toEqual([]);
      } catch (error) {
        failure = error;
      } finally {
        // Whatever happens from here on, the run must not outlive the test.
        teardownNote = await drainRun(release, settled);
      }

      if (failure) {
        if (teardownNote && failure instanceof Error) failure.message += teardownNote;
        throw failure;
      }
    },
    CELL_TIMEOUT_MS,
  );
});

/**
 * In-process control cells, ported from the same harness case: the abort comes
 * from this process, so nothing crosses a process boundary. The harness pairs
 * each condition with its own in-process `compareTo`, and these are that
 * control for the engines the xproc cells run: the same run shape, parked at
 * the same step, stopped by `abortRunStream` without a transport in between.
 * The harness's `plain` condition is not ported — it has no durable engine, and
 * T14 owns the in-process abort surface (`abort chunk`, `onAbort` vs
 * `onFinish`).
 */
describe.each(['durable', 'evented'] as const)('T79 in-process %s: abort a run in this process', engine => {
  let storage: LibSQLStore | undefined;
  let mastra: Mastra | undefined;

  afterEach(async () => {
    // Same order as the xproc cells: the owning instance finalizes a run that
    // is still in flight, and Mastra closes the stores it owns.
    try {
      await mastra?.shutdown();
      mastra = undefined;
    } finally {
      await storage?.close();
      storage = undefined;
    }
  });

  it(
    'stops the run before step 3 with no model call after the abort',
    async () => {
      const id = randomUUID();
      const runId = `t79-inproc-run-${id}`;

      const toolLog: StepToolEvent[] = [];
      const reached = gate();
      const release = gate();
      const abortProcessed = gate();
      const { agent, modelCalls } = createStepAgent({
        id: `t79-inproc-${engine}-${id}`,
        steps: 3,
        blockAt: 2,
        release: release.promise,
        onToolEvent: event => {
          toolLog.push(event);
          if (event.event === 'reached') reached.resolve();
          if (event.event === 'released' && event.aborted) abortProcessed.resolve();
        },
      });
      const runner = engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });

      storage = new LibSQLStore({ id: `t79-inproc-main-${id}`, url: ':memory:' });
      // No `pubsub` option: this is the in-process control, so the default
      // in-process transport is the point.
      mastra = new Mastra({ agents: { t79: runner }, storage, logger: false });
      expect(mastra.getAgent('t79') as unknown).toBe(runner);

      const callbacks: string[] = [];
      const result = await runner.stream('Go', {
        runId,
        maxSteps: 6,
        onAbort: () => {
          callbacks.push('onAbort');
        },
        onFinish: () => {
          callbacks.push('onFinish');
        },
      });
      const chunks: Array<{ type: string }> = [];
      const settled = (async () => {
        const reader = result.fullStream.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) return;
          chunks.push(value);
        }
      })();

      const record = () =>
        JSON.stringify({
          engine,
          runId,
          modelCalls: modelCalls(),
          toolLog,
          chunkTypes: chunks.map(c => c.type),
          callbacks,
        });
      const context = () => record();

      let failure: unknown;
      let teardownNote = '';

      try {
        // Not-exercised guard: the case only means something once step 2 is parked.
        await hangGuard(reached.promise, 'step 2 never reached its gate (case not exercised)', context);
        const callsAtAbort = modelCalls();

        const accepted = runner.abortRunStream(runId);
        await hangGuard(
          abortProcessed.promise,
          'this process never processed the abort (the parked step was not aborted)',
          context,
        );
        await hangGuard(settled, 'stream did not settle after the abort', context);
        const diagnostics = `accepted=${String(accepted)}\n${context()}`;

        // The harness records `accepted` and lets the gate decide; here the
        // caller is in-process, which is the one case where the return value is
        // a documented product answer rather than a transport detail.
        expect(accepted, `the in-process abort was accepted\n${diagnostics}`).toBe(true);
        expect(modelCalls() - callsAtAbort, `no model call after the abort\n${diagnostics}`).toBe(0);
        const parked = toolLog.find(
          (e): e is Extract<StepToolEvent, { event: 'released' }> => e.event === 'released' && e.n === 2,
        );
        expect(parked?.aborted, `the parked step saw the abort\n${diagnostics}`).toBe(true);
        expect(
          toolLog.filter(e => e.event === 'start' && e.n === 3),
          `step 3 never started\n${diagnostics}`,
        ).toEqual([]);
        expect(
          chunks.filter(c => c.type === 'error'),
          `no error chunk\n${diagnostics}`,
        ).toEqual([]);
      } catch (error) {
        failure = error;
      } finally {
        teardownNote = await drainRun(release, settled);
      }

      if (failure) {
        if (teardownNote && failure instanceof Error) failure.message += teardownNote;
        throw failure;
      }
    },
    CELL_TIMEOUT_MS,
  );
});
