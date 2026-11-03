import { createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';

import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';
import { bootWorkers } from '../process-workers';
import { createSpanOutcomeAgent, createSpanOutcomeObservability } from './span-outcome-agent';
import type { SpanOutcomeTripwire } from './span-outcome-agent';

export interface SpanOutcomePeerArgs {
  agentId: string;
  tripwire: SpanOutcomeTripwire;
}

/** Workers join one consumer group, so each run goes to a single worker, as a queue transport does. */
const WORKER_GROUP = 'span-outcome-workers';

runPeer<SpanOutcomePeerArgs>(async peer => {
  const { agentId, tripwire } = peer.args;
  const { agent } = createSpanOutcomeAgent(agentId, tripwire);
  const storage = new LibSQLStore({ id: 'span-outcome-worker', url: peer.dbUrl });
  const pubsub = peer.pubsub();
  const subscribe = pubsub.subscribe.bind(pubsub);
  pubsub.subscribe = (topic, cb, options) =>
    subscribe(topic, cb, topic === 'workflows' ? { ...options, group: WORKER_GROUP } : options);
  const mastra = new Mastra({
    agents: { [agentId]: createEventedAgent({ agent }) },
    storage,
    pubsub,
    logger: false,
    workers: peer.workers ? undefined : false,
    observability: createSpanOutcomeObservability(),
  });
  try {
    await bootWorkers(mastra, peer.workers);
    await peer.signal('worker-ready');
    await peer.waitFor('finish');
  } finally {
    await mastra.shutdown();
    await storage.close();
  }
});
