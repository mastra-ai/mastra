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
import type { StepToolEvent } from './step-agent';

const PEER_FIXTURE = new URL('./fixtures/t79-peer.ts', import.meta.url);

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
      const { agent, modelCalls } = createStepAgent({
        id: agentId,
        steps: 3,
        blockAt: 2,
        release: release.promise,
        onToolEvent: event => {
          toolLog.push(event);
          if (event.event === 'reached') reached.resolve();
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

      // Spawned first, as in the harness: it is idle until told to abort.
      const peerArgs: T79PeerArgs = { engine, agentId, runId };
      const peer = await env.spawnPeer(PEER_FIXTURE, peerArgs, { role: `peer-${engine}` });

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

      // Whatever happens from here on, the run must not outlive the test:
      // release the parked tool, then wait a bounded time for the stream to
      // settle so teardown is not racing a live run (shutdown does not wait for
      // one — it abandons pending runs after its drain timeout). Never throws:
      // the test's own failure is the one that gets reported.
      const releaseAndSettle = async () => {
        release.resolve();
        await Promise.race([
          settled.catch(() => {}),
          new Promise<void>(resolve => setTimeout(resolve, DEFAULT_HANG_GUARD_MS)),
        ]);
      };

      try {
        // Not-exercised guard: the case only means something once step 2 is parked.
        await hangGuard(reached.promise, 'step 2 never reached its gate (case not exercised)', context);
        const callsAtAbort = modelCalls();

        const { result: peerResult, exit: peerExit } = await (async () => {
          try {
            peer.send('abort-now');
            const result = await peer.result<{ accepted: boolean; runId: string }>();
            const exit = await peer.exit();
            return { result, exit };
          } finally {
            // The success path releases the gate only after the peer has
            // reported, so the run cannot unpark before the abort arrived.
            release.resolve();
          }
        })();
        await hangGuard(settled, 'stream did not settle after the abort', context);
        // Recorded, not asserted (tri-state / product calls): accepted, abort chunk, onAbort vs onFinish.
        const diagnostics = `peer=${JSON.stringify({ peerResult, peerExit })}\n${context()}`;

        expect(peerExit, `peer process exited cleanly\n${diagnostics}`).toEqual({ code: 0, signal: null });
        expect(peerResult.runId, `peer reported a result with no error\n${diagnostics}`).toBe(runId);
        expect(modelCalls() - callsAtAbort, `no model call after the abort\n${diagnostics}`).toBe(0);
        expect(
          toolLog.filter(e => e.event === 'start' && e.n === 3),
          `step 3 never started\n${diagnostics}`,
        ).toEqual([]);
        expect(
          chunks.filter(c => c.type === 'error'),
          `no error chunk\n${diagnostics}`,
        ).toEqual([]);
      } finally {
        await releaseAndSettle();
      }
    },
    DEFAULT_HANG_GUARD_MS + 5_000,
  );
});
