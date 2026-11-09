/**
 * T79 peer: a separate OS process that owns no local run. It registers the
 * same agent against the shared socket and LibSQL file, waits for the test to
 * say `abort-now`, and asks the owner to abort `runId` via `abortRunStream`.
 *
 * `abortRunStream` is synchronous and dispatches its publish fire-and-forget,
 * so when it returns the frame is not yet queued on the socket and
 * `pubsub.flush()` alone can return before it is written. The peer therefore
 * subscribes to the run's control topic first and waits for its own request
 * to come back through the broker — proof the frame left this process —
 * before `runPeer` flushes and exits.
 */
import {
  AGENT_CONTROL_TOPIC,
  AgentControlEventTypes,
  createDurableAgent,
  createEventedAgent,
} from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';

import { LibSQLStore } from '../../../storage';
import { DEFAULT_HANG_GUARD_MS, runPeer } from '../peer-runtime';
import { createStepAgent, gate } from '../step-agent';

export interface T79PeerArgs {
  engine: 'durable' | 'evented';
  agentId: string;
  runId: string;
}

export interface T79PeerResult {
  /** What `abortRunStream` returned in the peer: false for a run it does not own. */
  accepted: boolean;
  runId: string;
  /** Control-topic frames this peer received (the harness's `control-receive`). */
  receivedByPeer: number;
}

runPeer<T79PeerArgs>(async peer => {
  const { engine, agentId, runId } = peer.args;
  // Memory-configured like the harness's peer agent (`@mastra/memory`'s real
  // `Memory` there, core's `MockMemory` here), kept for shape parity. Inert
  // here: this process streams no run of its own, it only aborts one, and
  // agent-level memory has no bearing on `abortRunStream` — a run is found
  // through the call's thread id, not through the agent.
  const { agent } = createStepAgent({ id: agentId, steps: 0, memory: new MockMemory() });
  const runner = engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
  const storage = new LibSQLStore({ id: `t79-peer-${process.pid}`, url: peer.dbUrl });
  // `workers` matches this peer's declared setting (see ../process-workers.ts).
  // This peer never boots workers, which is what makes it a pure abort source.
  const mastra = new Mastra({
    agents: { t79: runner },
    storage,
    pubsub: peer.pubsub(),
    logger: false,
    workers: peer.workers ? undefined : false,
  });
  if ((mastra.getAgent('t79') as unknown) !== runner) throw new Error('Mastra replaced the registered agent');

  // Its own reception count is the harness's `control-receive` by this role:
  // recorded by the test, so a delivery failure is distinguishable from a run
  // that ignored the abort.
  let receivedByPeer = 0;
  const echoed = gate<void>();
  await peer.pubsub().subscribe(AGENT_CONTROL_TOPIC(runId), async (event, ack) => {
    receivedByPeer++;
    if (event.type === AgentControlEventTypes.ABORT_REQUEST) echoed.resolve();
    await ack?.();
  });

  // The harness waits up to 60s for this signal (its `waitFor` default), which
  // is longer than the peer-process budget: the run's own hang guard is what
  // fires when the test never reaches the signal.
  await peer.waitFor('abort-now', { timeoutMs: 60_000 });
  // Tri-state on purpose: a process owning no local run may report false while the run stops anyway.
  const accepted = runner.abortRunStream(runId);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      echoed.promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`abort request for ${runId} never echoed back through the broker (hang guard)`)),
          DEFAULT_HANG_GUARD_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  // No `mastra.shutdown()` here on purpose: aborting a run this process does not
  // own leaves a phantom entry in `globalRunRegistry`, and shutdown throws on it
  // (COR-1391). The test process shuts down its own instance instead.
  return { accepted, runId, receivedByPeer } satisfies T79PeerResult;
});
