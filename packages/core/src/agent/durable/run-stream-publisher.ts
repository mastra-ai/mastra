import type { Mastra } from '../../mastra';
import { createRunScope, createRunScopeKey } from '../../mastra/run-scope';
import { createAgentStreamPublisherCoordinator } from '../streams/publisher';
import type { AgentStreamPublisherCoordinator } from '../streams/publisher';
import type { RunRegistryEntry } from './types';

const publisherKey = createRunScopeKey<AgentStreamPublisherCoordinator>('agent-stream-publisher');

/** Bootstrap and execution attachments share the publisher even before the worker has an agent or claim. */
export function getRunStreamPublisher(runId: string, entry: RunRegistryEntry, mastra?: Mastra) {
  const scope = (entry.runScope ??= createRunScope());
  let publisher = scope.get(publisherKey);
  if (!publisher) {
    publisher = createAgentStreamPublisherCoordinator(runId, mastra?.getLogger());
    scope.set(publisherKey, publisher);
    const attached = publisher;
    const previousCleanup = entry.cleanup;
    entry.cleanup = () => {
      try {
        previousCleanup?.();
      } finally {
        void attached.detach();
      }
    };
  }
  return publisher;
}
