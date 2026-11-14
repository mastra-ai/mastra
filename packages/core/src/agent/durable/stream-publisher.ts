import type { PubSub } from '../../events/pubsub';
import type { Event } from '../../events/types';
import type { Mastra } from '../../mastra';
import { createRunScope, createRunScopeKey } from '../../mastra/run-scope';
import { RequestContext } from '../../request-context';
import type { Agent } from '../agent';
import { AGENT_STREAM_TOPIC } from '../streams/constants';
import { createAgentStreamPublisher } from '../streams/publisher';
import type { AgentStreamPublisher } from '../streams/publisher';
import {
  assertExecutionGenerationCurrent,
  assertExecutionNotSuperseded,
  DurableExecutionFenceError,
  EXECUTION_SUPERSEDED_ERROR_ID,
  isExecutionFenceError,
  setExecutionClaim,
} from './execution-fence';
import type { DurableExecutionClaim } from './execution-fence';
import { getRunRegistryEntry, setRunRegistryEntry } from './run-registry';
import type { RunRegistryEntry } from './types';

const publishersKey = createRunScopeKey<Map<string, AgentStreamPublisher>>('durable-stream-publishers');

/** Attach local producers to the current execution, without giving them lifecycle ownership. */
export function getDurableStreamPublisher({
  runId,
  agentId,
  mastra,
  agent,
  claim,
  role,
  entry = getRunRegistryEntry(runId, mastra),
}: {
  runId: string;
  agentId: string;
  mastra?: Mastra;
  agent?: Pick<Agent, '__getStreamBus' | '__getRunOwner'>;
  claim?: DurableExecutionClaim;
  role: 'producer' | 'lifecycle';
  entry?: RunRegistryEntry;
}): AgentStreamPublisher | undefined {
  if (!entry && !claim) return;
  if (!entry) {
    entry = { isPlaceholder: true } as RunRegistryEntry;
    if (!setRunRegistryEntry(runId, entry, mastra)) return;
  }
  const owner = agent ?? entry.agent ?? mastra?.getAgentById(agentId);
  const bus = owner?.__getStreamBus();
  if (!bus) return;
  claim ??= entry.executionFence?.claim;
  const executionClaim = claim;
  if (!executionClaim) return;
  const requestContext = new RequestContext();
  setExecutionClaim(requestContext, runId, executionClaim);
  const publisherId = executionClaim.executionId;
  const memoryInfo = owner?.__getRunOwner(runId);
  const scope = (entry.runScope ??= createRunScope());
  let publishers = scope.get(publishersKey);
  if (!publishers) {
    publishers = new Map();
    scope.set(publishersKey, publishers);
    const attachments = publishers;
    const previousCleanup = entry.cleanup;
    entry.cleanup = () => {
      try {
        previousCleanup?.();
      } finally {
        for (const publisher of attachments.values()) void publisher.detach();
      }
    };
  }
  const key = `${publisherId}:${role}`;
  const existing = publishers.get(key);
  if (existing) return existing;
  const fence = entry.executionFence;
  const publisher = createAgentStreamPublisher({
    pubsub: bus.pubsub,
    runId,
    role,
    publisherId,
    cleanupTimeoutMs: bus.cleanupTimeoutMs,
    logger: mastra?.getLogger(),
    abortSignal: entry.abortSignal,
    // ensureRemoteAbortListener owns the single execution-scoped listener on this worker.
    listenForAbort: false,
    assertOwnership: async () => {
      if (role === 'lifecycle') {
        if (fence?.executionId === publisherId) {
          fence.throwIfLost();
          if (fence.settlement !== undefined && fence.settlement !== 'owned') {
            throw new DurableExecutionFenceError(EXECUTION_SUPERSEDED_ERROR_ID, {
              runId,
              agentId,
              executionId: publisherId,
            });
          }
        }
        // Like the remote execution guard, check generation without poisoning a fence releasing its own lease.
        await assertExecutionGenerationCurrent({ runId, agentId, mastra, claim: executionClaim });
        return;
      }
      await assertExecutionNotSuperseded({ runId, agentId, mastra, requestContext });
    },
    assertCleanupOwnership: async () => {
      // Owned deadline settlement revokes execution writes but keeps the run's topics.
      if (fence?.executionId === publisherId && fence.ownsRunTopics()) return;
      await assertExecutionNotSuperseded({ runId, agentId, mastra, requestContext });
    },
    record: {
      cache: bus.runRecordCache,
      agentId,
      resourceId: executionClaim.resourceId ?? memoryInfo?.resourceId,
      threadId: executionClaim.threadId ?? memoryInfo?.threadId,
    },
  });
  publishers.set(key, publisher);
  return publisher;
}

/** Preserve durable event shaping and the workflow's existing publish-after-persist boundary. */
export function withDurableStreamPublisher(
  pubsub: PubSub,
  options: { runId: string; agentId: string; mastra?: Mastra; claim?: DurableExecutionClaim },
): PubSub {
  return new Proxy(pubsub, {
    get(target, property) {
      if (property === 'publish') {
        return async (
          topic: string,
          event: Omit<Event, 'id' | 'createdAt'>,
          publishOptions?: { localOnly?: boolean },
        ) => {
          if (topic === AGENT_STREAM_TOPIC(options.runId)) {
            const publisher = getDurableStreamPublisher({ ...options, role: 'producer' });
            if (publisher) {
              try {
                return await publisher.publishEvent(event);
              } catch (error) {
                // Like fencePubSub, a worker that lost ownership stops publishing without failing the run.
                if (isExecutionFenceError(error)) return;
                throw error;
              }
            }
          }
          return target.publish(topic, event, publishOptions);
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
