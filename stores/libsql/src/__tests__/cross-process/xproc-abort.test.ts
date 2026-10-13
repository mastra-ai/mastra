/**
 * Port of validation-harness case T79 (`xproc-abort`): abort a run from
 * another OS process, against the in-process controls it is compared to.
 *
 * The harness runs T79 under five conditions:
 *
 *   plain          base `Agent`,        `abortRunStream` from this process
 *   durable        `DurableAgent`,      `abortRunStream` from this process
 *   evented        `EventedAgent`,      `abortRunStream` from this process
 *   xproc-durable  `DurableAgent`,      `abortRunStream` from a second process
 *   xproc-evented  `EventedAgent`,      `abortRunStream` from a second process
 *
 * and pairs each cross-process condition with the in-process condition of the
 * same engine (`compareTo`). All five are ported here 1:1, in the harness's
 * order, and the last `it` in this file makes that pairing.
 *
 * Every condition runs the same shape: the script calls the `step` tool for
 * 1, 2, 3 and the tool parks at step 2. The parked gate is released only at
 * teardown, so a green cell proves the run stopped *because of the abort* — an
 * abort that never crosses the process boundary, or is never processed, sends
 * the run on to step 3 and the cell fails. The cross-process cells need two
 * real OS processes: the run registry is module-level, so both runs in one
 * process would share it and the abort would look delivered for the wrong
 * reason; they also need one shared `UnixSocketPubSub` socket and one shared
 * LibSQL file, which is what the peer helper sets up.
 *
 * Judged, exactly as the harness judges them: the stream settled after the
 * abort, no model call after the abort, step 3 never started, no error chunk,
 * and for the cross-process cells that the peer process exited cleanly and
 * reported a result with no error.
 *
 * Recorded, as the harness only records them: `accepted` and which process
 * accepted it (a process owning no local run reports `false` while the run
 * stops anyway, so asserting either polarity would bake a product call into
 * the case), the chunk types and whether `onAbort`/`onFinish` fired (the
 * in-process abort surface itself is harness case T14's measurement), the
 * run's snapshot status, the parked tool's own `aborted` flag, and the control
 * -topic traffic each side saw. The comparison test at the bottom then asserts
 * only that a cross-process cell and its in-process control reached the same
 * judged outcome — the harness's `compareTo` pairing — plus that the two
 * engines agree with each other (the port's own addition; the harness does not
 * pair the engines with each other because their abort surfaces differ).
 *
 * Budgets are the harness's: `DEFAULT_HANG_GUARD_MS` (20s) is its `GUARD_MS` for
 * the run under test, `PEER_TIMEOUT_MS` (45s) is its `PEER_MS` for a peer
 * process's whole lifetime, and the peer waits up to 60s for the abort signal
 * exactly as the harness's does. Callback recording matches too: the harness
 * injects `onStepFinish`/`onFinish`/`onError` on every stream it drives
 * (`harness/case-worker.mjs`), so the cells do the same.
 *
 * Deliberate deviations from the harness:
 * - No sleeps anywhere. The harness sleeps 1000ms after the stream settles "to
 *   let a run that ignored the abort make its next call", lingers 250ms after
 *   `flush()` and polls its signal files every 50ms; here the parked-step and
 *   abort-processed gates carry that weight instead.
 * - The peer does not rely on `flush()`: `abortRunStream` publishes
 *   fire-and-forget and a client's `flush()` awaits only writes already queued,
 *   so a peer that exits right after the call loses the frame (measured 0/10
 *   delivered). The peer instead waits for its own abort request to come back
 *   through the broker, which is also what lets it report `control-receive`.
 * - The harness's `xproc-selfcheck` is a recorded ping nobody asserts; here the
 *   ping is what proves at spawn time that the peer reached *this* process's
 *   broker (the spawn fails without it) and its receipt is recorded as well.
 * - A snapshot read failure is recorded next to the outcome rather than
 *   replacing a behaviour failure, so the behaviour message survives.
 * - The agent is model-free in both (the harness marks the case
 *   `modelFree: true`).
 * - Memory: the harness gives its script agent the real `Memory` (from
 *   `@mastra/memory`) bound to the case's storage. These agents carry none.
 *   What makes a run abortable is the thread id on the *call* — the stream's
 *   `memory: { thread, resource }` — which registers the run's abort controller
 *   in the thread-stream runtime. Agent-level memory neither registers a run
 *   nor is required to, so dropping it changes no assertion here (verified 5/5
 *   for the plain cell, which is the one whose abort depended on it). No check
 *   in this case reads memory contents.
 */
import { randomUUID } from 'node:crypto';

import {
  AGENT_CONTROL_TOPIC,
  DurableStepIds,
  createDurableAgent,
  createEventedAgent,
} from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LibSQLStore } from '../../storage';
import type { T79PeerArgs, T79PeerResult } from './fixtures/t79-peer';
import { createXprocEnv, DEFAULT_HANG_GUARD_MS, PEER_TIMEOUT_MS } from './peer-helper';
import type { XprocEnv } from './peer-helper';
import { createStepAgent, gate } from './step-agent';
import type { Gate, StepToolEvent } from './step-agent';

const PEER_FIXTURE = new URL('./fixtures/t79-peer.ts', import.meta.url);

/**
 * Vitest budget for one cell, built from the harness's own two budgets (see
 * peer-helper.ts): `DEFAULT_HANG_GUARD_MS` (20s, the harness's `GUARD_MS`) for
 * waiting on the run, `PEER_TIMEOUT_MS` (45s, the harness's `PEER_MS`) for
 * waiting on a peer process.
 *
 * The widest failure path a cell can produce is one peer-side wait that expires
 * plus the teardown drain (the first wait to expire throws out of the body, so
 * the waits after it are never awaited): 45s + 20s, plus setup. The budget is
 * not what makes a cell correct — a green cell never approaches it — it is what
 * lets a red cell report its own hang-guard message and teardown note instead
 * of the runner's bare "Test timed out". Guards that nearly expire before
 * succeeding can accumulate past any finite budget, so this is measured
 * headroom for the paths this cell actually produces, not a proven bound.
 */
const CELL_TIMEOUT_MS = PEER_TIMEOUT_MS + DEFAULT_HANG_GUARD_MS + 10_000;

type Engine = 'plain' | 'durable' | 'evented';

/**
 * One condition, spelled with the harness's condition names. The cross-process
 * ones are narrowed to engines that have a durable execution path to abort.
 */
type CellSpec =
  | { condition: string; engine: Engine; xproc: false }
  | { condition: string; engine: 'durable' | 'evented'; xproc: true };

const CELLS: CellSpec[] = [
  { condition: 'plain', engine: 'plain', xproc: false },
  { condition: 'durable', engine: 'durable', xproc: false },
  { condition: 'evented', engine: 'evented', xproc: false },
  { condition: 'xproc-durable', engine: 'durable', xproc: true },
  { condition: 'xproc-evented', engine: 'evented', xproc: true },
];

interface CellOutcome {
  condition: string;
  engine: Engine;
  xproc: boolean;
  /** Recorded, not judged: the value a caller that may own no run gets back. */
  accepted: boolean | null;
  acceptedBy: 'this process' | 'peer process';
  /** What the harness judges (and the comparison below compares). */
  judged: {
    settled: true;
    requestsAfterAbort: number;
    step3Started: boolean;
    errorChunks: number;
  };
  /** Recorded, not judged: the parked tool's own view of the abort. */
  toolSawAbort: boolean | null;
  /** Recorded, not judged: the run's snapshot status (null for `plain`). */
  snapshot: { status?: string } | null;
  snapshotError?: string;
  /** Cross-process only: the harness's `xproc-selfcheck` equivalent. */
  selfCheck?: { startupMs: number; remoteClientCount: number };
  /** Cross-process only: control-topic frames each side saw. */
  controlReceivedByMain?: number;
  receivedByPeer?: number;
  /** Recorded, not judged: T14 measures the abort surface (see the header). */
  abortChunk: boolean;
  onAbort: boolean;
  onFinish: boolean;
  callbacks: string[];
  chunkTypes: string[];
}

/** Filled by each passing cell; read by the comparison test at the bottom. */
const outcomes = new Map<string, CellOutcome>();

function hangGuard<T>(promise: Promise<T>, what: string, describeCell: () => string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${what} within ${DEFAULT_HANG_GUARD_MS}ms (hang guard)\n${describeCell()}`)),
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
  let timer: ReturnType<typeof setTimeout> | undefined;
  const drained = await Promise.race([
    settled.then(
      () => ({ settled: true as const, streamError: undefined }),
      (streamError: unknown) => ({ settled: false as const, streamError }),
    ),
    new Promise<{ settled: false; streamError: undefined }>(resolve => {
      timer = setTimeout(() => resolve({ settled: false, streamError: undefined }), DEFAULT_HANG_GUARD_MS);
    }),
  ]).finally(() => clearTimeout(timer));
  if (drained.settled) return '';
  if (drained.streamError) {
    return `\n(teardown: the run's stream rejected instead of completing: ${String(
      (drained.streamError as Error)?.message ?? drained.streamError,
    )})`;
  }
  return `\n(teardown: the run never settled within ${DEFAULT_HANG_GUARD_MS}ms after the parked tool was released — this cell failed while a run was still live, so it reports less than a settled run would)`;
}

/**
 * Snapshot status of the run, read the way the harness reads it. Recorded, not
 * judged: the harness records the status without asserting it. A failure to
 * read is returned rather than thrown so it cannot replace a behaviour failure.
 */
async function readSnapshotStatus(
  storage: LibSQLStore,
  runId: string,
): Promise<{ status?: string } | { error: string } | null> {
  try {
    const workflows = await storage.getStore('workflows');
    const run = await workflows?.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
    const snapshot = typeof run?.snapshot === 'string' ? JSON.parse(run.snapshot) : run?.snapshot;
    return snapshot ? { status: (snapshot as { status?: string }).status } : null;
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** Drain a stream to its end, collecting the chunks it emitted. */
async function collectChunks(fullStream: ReadableStream<any>, out: Array<{ type: string }>): Promise<void> {
  const reader = fullStream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    out.push(value);
  }
}

for (const spec of CELLS) {
  describe(`T79 ${spec.condition}: abort a run ${spec.xproc ? 'from another process' : 'in this process'}`, () => {
    let env: XprocEnv | undefined;
    let storage: LibSQLStore | undefined;
    let mastra: Mastra | undefined;

    beforeEach(async () => {
      // The in-process controls deliberately have no socket: the default
      // in-process transport is part of what they control for.
      env = spec.xproc ? await createXprocEnv() : undefined;
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
          await env?.cleanup();
          env = undefined;
        }
      }
    });

    it(
      'stops the run before step 3 with no model call after the abort',
      async () => {
        const id = randomUUID();
        const { condition, engine } = spec;
        const agentId = `t79-${condition}-${id}`;
        const runId = `t79-run-${id}`;

        // `spec.xproc` and a missing environment would silently run the
        // in-process shape under a cross-process name; fail instead.
        const xprocEnv = env;
        if (spec.xproc && !xprocEnv) {
          throw new Error(`${condition}: cross-process cell started without a socket environment`);
        }

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
        // `plain` is the base agent with no durable wrapper: the harness's third
        // in-process control, and the one whose abort surface differs (it emits
        // an abort chunk and fires only `onAbort`), which is why the harness
        // pairs controls with their own engine only.
        const runner =
          spec.engine === 'plain'
            ? agent
            : spec.engine === 'durable'
              ? createDurableAgent({ agent })
              : createEventedAgent({ agent });

        // Cross-process only: claim the broker role before any peer connects,
        // and count the control-topic frames that arrive here (the harness's
        // `control-receive` by main).
        let controlReceivedByMain = 0;
        if (xprocEnv) {
          await xprocEnv.pubsub().subscribe(AGENT_CONTROL_TOPIC(runId), () => {
            controlReceivedByMain++;
          });
        }

        storage = new LibSQLStore({
          id: `t79-${condition}-main-${id}`,
          // The cross-process cells share one on-disk database with the peer;
          // the controls use an in-memory one.
          url: xprocEnv ? xprocEnv.dbUrl : ':memory:',
        });
        mastra = new Mastra({
          agents: { t79: runner },
          storage,
          logger: false,
          ...(xprocEnv ? { pubsub: xprocEnv.pubsub() } : {}),
        });
        expect(mastra.getAgent('t79') as unknown).toBe(runner);

        // Spawned before the run starts, as in the harness: the peer is idle
        // until it is told to abort. It consumes no workflow events — it only
        // aborts — so it declares `workers: false`, and the peer runtime fails
        // a peer whose declaration and boot state disagree.
        const peer =
          spec.xproc && xprocEnv
            ? await xprocEnv.spawnPeer<T79PeerArgs>(
                PEER_FIXTURE,
                { engine: spec.engine, agentId, runId },
                { role: `peer-${engine}`, workers: false },
              )
            : undefined;

        const callbacks: string[] = [];
        // Declared with no parameters so the same options object satisfies all
        // three runners, whose callback payload types differ.
        // The harness injects this callback set on every stream it drives
        // (harness/case-worker.mjs:195), so the recorded `callbacks` list is
        // comparable; which of them fire is T14's measurement, not this cell's.
        const onStepFinish = () => {
          callbacks.push('onStepFinish');
        };
        const onError = () => {
          callbacks.push('onError');
        };
        const onAbort = () => {
          callbacks.push('onAbort');
        };
        const onFinish = () => {
          callbacks.push('onFinish');
        };
        const result = await runner.stream('Go', {
          runId,
          maxSteps: 6,
          onStepFinish,
          onError,
          onAbort,
          onFinish,
          // The harness's memory scope. This is what makes every cell
          // abortable, whatever the engine: `abortRunStream(runId)` finds the
          // run through the call's thread id (the thread-stream runtime
          // registers the run's abort controller for it), not through anything
          // on the agent.
          memory: { thread: `t79-thread-${id}`, resource: `t79-resource-${id}` },
        });
        const chunks: Array<{ type: string }> = [];
        const settled = collectChunks(result.fullStream, chunks);

        const record = () =>
          JSON.stringify({
            condition,
            engine,
            runId,
            modelCalls: modelCalls(),
            toolLog,
            chunkTypes: chunks.map(c => c.type),
            callbacks,
            controlReceivedByMain,
          });
        const context = () => (xprocEnv ? `${record()}\n${xprocEnv.describe()}` : record());

        let failure: unknown;
        let teardownNote = '';
        let accepted: boolean | null = null;
        let peerResult: T79PeerResult | undefined;
        let peerExit: { code: number | null; signal: string | null } | undefined;

        try {
          // Not-exercised guard: the case only means something once step 2 is parked.
          await hangGuard(reached.promise, 'step 2 never reached its gate (case not exercised)', context);
          const callsAtAbort = modelCalls();

          if (peer) {
            peer.send('abort-now');
            peerResult = await peer.result<T79PeerResult>();
            peerExit = await peer.exit();
            accepted = peerResult.accepted;
            // The peer's echo only proves the broker delivered the frame. Wait
            // for this process to act on it before anything releases the parked
            // tool.
            await hangGuard(
              abortProcessed.promise,
              'this process never processed the remote abort (the parked step was not aborted)',
              context,
            );
          } else {
            // Synchronous on purpose: the tri-state return value is a product
            // call, so it is recorded (and asserted only where the caller owns
            // the run — see below).
            accepted = runner.abortRunStream(runId);
            await hangGuard(
              abortProcessed.promise,
              'this process never processed the abort (the parked step was not aborted)',
              context,
            );
          }
          await hangGuard(settled, 'stream did not settle after the abort', context);

          const snapshotRead = spec.engine === 'plain' ? null : await readSnapshotStatus(storage, runId);
          const snapshot = snapshotRead && !('error' in snapshotRead) ? snapshotRead : null;
          const snapshotError = snapshotRead && 'error' in snapshotRead ? snapshotRead.error : undefined;

          const judged = {
            settled: true as const,
            requestsAfterAbort: modelCalls() - callsAtAbort,
            step3Started: toolLog.some(e => e.event === 'start' && e.n === 3),
            errorChunks: chunks.filter(c => c.type === 'error').length,
          };
          // The parked tool's own view, as the harness records it: `released`
          // is only emitted for the blocked call.
          const toolSawAbort =
            toolLog.find((e): e is Extract<StepToolEvent, { event: 'released' }> => e.event === 'released')?.aborted ??
            null;
          const diagnostics = `condition=${condition} accepted=${String(
            accepted,
          )} toolSawAbort=${String(toolSawAbort)}\npeerResult=${JSON.stringify(
            peerResult ?? null,
          )} peerExit=${JSON.stringify(peerExit ?? null)}\nsnapshot=${JSON.stringify(
            snapshot ?? snapshotError,
          )}\n${context()}`;

          if (spec.xproc) {
            expect(peerExit, `peer process exited cleanly\n${diagnostics}`).toEqual({ code: 0, signal: null });
            expect(peerResult?.runId, `peer reported a result with no error\n${diagnostics}`).toBe(runId);
            // The harness records `xproc-selfcheck` without asserting it; the
            // spawn here already failed if the ping never arrived, so this
            // records the receipt itself.
            expect(peer?.selfCheck, `the peer's startup self-check reached this process\n${diagnostics}`).toBeDefined();
            expect(
              peer?.selfCheck?.remoteClientCount,
              `this process's broker counted the peer as a client when its ping arrived\n${diagnostics}`,
            ).toBeGreaterThanOrEqual(1);
          } else {
            // The in-process caller is the one case where the return value is a
            // documented product answer rather than a transport detail: the
            // harness records it either way.
            expect(accepted, `the in-process abort was accepted\n${diagnostics}`).toBe(true);
          }

          expect(judged.requestsAfterAbort, `no model call after the abort\n${diagnostics}`).toBe(0);
          expect(toolSawAbort, `the parked step saw the abort\n${diagnostics}`).toBe(true);
          expect(judged.step3Started, `step 3 never started\n${diagnostics}`).toBe(false);
          expect(judged.errorChunks, `no error chunk\n${diagnostics}`).toBe(0);

          outcomes.set(condition, {
            condition,
            engine: spec.engine,
            xproc: spec.xproc,
            accepted,
            acceptedBy: spec.xproc ? 'peer process' : 'this process',
            judged,
            toolSawAbort,
            snapshot,
            snapshotError,
            selfCheck: peer?.selfCheck,
            controlReceivedByMain: spec.xproc ? controlReceivedByMain : undefined,
            receivedByPeer: peerResult?.receivedByPeer,
            abortChunk: chunks.some(c => c.type === 'abort'),
            onAbort: callbacks.includes('onAbort'),
            onFinish: callbacks.includes('onFinish'),
            callbacks,
            chunkTypes: chunks.map(c => c.type),
          });
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
}

/**
 * The comparison the harness makes with `compareTo`: a cross-process cell and
 * its in-process control must reach the same judged outcome. `accepted` is
 * deliberately outside it — it differs by design between the two, and the
 * harness records it without comparing or asserting it.
 *
 * The durable-vs-evented pairing is the port's own addition: the harness does
 * not pair the engines with each other because their abort surfaces differ
 * (T14's measurement), but the run outcome this case judges must agree, and
 * recording the result in one place makes a disagreement between two green
 * cells visible instead of silent.
 */
describe('T79 parity: cross-process cells match their in-process controls', () => {
  it('reached the same judged outcome', ctx => {
    const compared = ['durable', 'evented', 'xproc-durable', 'xproc-evented'];
    const missing = compared.filter(condition => !outcomes.has(condition));
    if (missing.length) {
      // Nothing to compare. Either the run was filtered down to this test and
      // the cells never executed, or a cell failed and reported that itself —
      // with a better message than a second assertion here could give.
      ctx.skip(`${missing.join(', ')} recorded no outcome`);
    }

    const judged = (condition: string) => outcomes.get(condition)?.judged;

    for (const [xprocCondition, controlCondition] of [
      ['xproc-durable', 'durable'],
      ['xproc-evented', 'evented'],
    ]) {
      expect(judged(xprocCondition), `${xprocCondition} vs in-process ${controlCondition}`).toEqual(
        judged(controlCondition),
      );
    }
    expect(judged('xproc-evented'), 'the two engines agree cross-process').toEqual(judged('xproc-durable'));
    expect(judged('evented'), 'the two engines agree in-process').toEqual(judged('durable'));
  });
});
