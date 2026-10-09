import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';

import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';
import { createStepAgent } from '../step-agent';

export interface T80PeerArgs {
  engine: 'durable' | 'evented';
  agentId: string;
  runId: string;
  finalText: string;
}

export interface T80PeerResult {
  runId: string;
  text: string | undefined;
  finishReason: string | undefined;
  object: unknown;
  chunkTypes: string[];
}

runPeer<T80PeerArgs>(async peer => {
  const { engine, agentId, runId, finalText } = peer.args;
  const { agent } = createStepAgent({ id: `${agentId}-observer`, steps: 2, finalText });
  const runner = engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
  const storage = new LibSQLStore({ id: `t80-peer-${process.pid}`, url: peer.dbUrl });
  const mastra = new Mastra({
    agents: { t80: runner },
    storage,
    pubsub: peer.pubsub(),
    logger: false,
    workers: false,
  });
  if ((mastra.getAgent('t80') as unknown) !== runner) throw new Error('Mastra replaced the registered agent');

  await peer.waitFor('run-live', { timeoutMs: 60_000 });
  const observed = await runner.observe(runId);
  const chunkTypes: string[] = [];
  const chunks = (async () => {
    for await (const chunk of observed.fullStream) chunkTypes.push(chunk.type);
  })();
  const fullOutput = observed.output.getFullOutput();
  await peer.signal('observer-attached', { runId });
  const output = await fullOutput;
  await chunks;

  return {
    runId,
    text: output.text,
    finishReason: output.finishReason,
    object: output.object,
    chunkTypes,
  } satisfies T80PeerResult;
});
