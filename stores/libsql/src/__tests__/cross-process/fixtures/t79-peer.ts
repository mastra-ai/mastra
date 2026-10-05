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

import { LibSQLStore } from '../../../storage';
import { DEFAULT_HANG_GUARD_MS, runPeer } from '../peer-runtime';
import { createStepAgent, gate } from '../step-agent';

export interface T79PeerArgs {
  engine: 'durable' | 'evented';
  agentId: string;
  runId: string;
}

runPeer<T79PeerArgs>(async peer => {
  const { engine, agentId, runId } = peer.args;
  const { agent } = createStepAgent({ id: agentId, steps: 0 });
  const runner = engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
  const storage = new LibSQLStore({ id: `t79-peer-${process.pid}`, url: peer.dbUrl });
  const mastra = new Mastra({ agents: { t79: runner }, storage, pubsub: peer.pubsub(), logger: false });
  if ((mastra.getAgent('t79') as unknown) !== runner) throw new Error('Mastra replaced the registered agent');

  const echoed = gate<void>();
  await peer.pubsub().subscribe(AGENT_CONTROL_TOPIC(runId), async (event, ack) => {
    if (event.type === AgentControlEventTypes.ABORT_REQUEST) echoed.resolve();
    await ack?.();
  });

  await peer.waitFor('abort-now');
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
  return { accepted, runId };
});
