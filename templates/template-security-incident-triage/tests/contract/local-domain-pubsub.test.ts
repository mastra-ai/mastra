import { InProcessDomainPubSub } from '../../src/workers/in-process-domain-pubsub.js';
import { defineDomainPubSubContract } from './domain-pubsub-contract.js';

defineDomainPubSubContract('in-process', async () => {
  const pubsub = new InProcessDomainPubSub({ retryDelayMs: 1 });
  return { pubsub, cleanup: () => pubsub.close() };
});
