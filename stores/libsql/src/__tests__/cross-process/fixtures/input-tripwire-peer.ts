import { createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';

import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';
import { bootWorkers } from '../process-workers';
import { createStepAgent } from '../step-agent';

export interface InputTripwirePeerArgs {
  agentId: string;
  finalText: string;
  tripwire: {
    reason: string;
    retry: boolean;
    processorId: string;
    metadata: Record<string, unknown>;
  };
}

export interface InputTripwirePeerCounts {
  pid: number;
  modelCalls: number;
  inputCalls: number;
}

runPeer<InputTripwirePeerArgs>(async peer => {
  const { agentId, finalText, tripwire } = peer.args;
  let inputCalls = 0;
  const { agent, modelCalls } = createStepAgent({
    id: agentId,
    steps: 0,
    finalText,
    inputProcessors: [
      {
        id: tripwire.processorId,
        processInput: ({ messages, requestContext, abort }) => {
          inputCalls++;
          if (requestContext?.get('blocked')) {
            abort(tripwire.reason, { retry: tripwire.retry, metadata: tripwire.metadata });
          }
          return messages;
        },
      },
    ],
  });
  const runner = createEventedAgent({ agent });
  const storage = new LibSQLStore({ id: 'input-tripwire-worker', url: peer.dbUrl });
  const mastra = new Mastra({
    agents: { [agentId]: runner },
    storage,
    pubsub: peer.pubsub(),
    logger: false,
    workers: peer.workers ? undefined : false,
  });
  try {
    await bootWorkers(mastra, peer.workers);
    await peer.signal('worker-ready');
    for (let run = 0; run < 3; run++) {
      await peer.waitFor(`inspect-${run}`);
      await peer.signal(`counts-${run}`, {
        pid: process.pid,
        modelCalls: modelCalls(),
        inputCalls,
      } satisfies InputTripwirePeerCounts);
    }
    await peer.waitFor('finish');
  } finally {
    await mastra.shutdown();
    await storage.close();
  }
});
