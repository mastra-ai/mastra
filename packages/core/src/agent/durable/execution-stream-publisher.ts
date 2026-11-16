import type { PubSub } from '../../events/pubsub';
import type { Event } from '../../events/types';
import type { Mastra } from '../../mastra';
import { createRunScope, createRunScopeKey } from '../../mastra/run-scope';
import { RequestContext } from '../../request-context';
import type { Agent } from '../agent';
import { AGENT_STREAM_TOPIC } from '../streams/constants';
import { createAgentStreamPublisher } from '../streams/publisher';
import type { AgentStreamPublisher } from '../streams/publisher';
import { durableReplayOwnerKey, readAgentRunRecord } from '../streams/run-records';
import {
  assertExecutionGenerationCurrent,
  assertExecutionNotSuperseded,
  DurableExecutionFenceError,
  EXECUTION_SUPERSEDED_ERROR_ID,
  EXECUTION_UNVERIFIED_ERROR_ID,
  isExecutionFenceError,
  setExecutionClaim,
} from './execution-fence';
import type { DurableExecutionClaim } from './execution-fence';
import { getRunRegistryEntry, setRunRegistryEntry } from './run-registry';
import type { RunRegistryEntry } from './types';

const publishersKey = createRunScopeKey<Map<string, AgentStreamPublisher>>('execution-stream-publishers');
const streamOwnerKey =
  createRunScopeKey<Pick<Agent, '__getStreamBus' | '__getRunOwner' | '__usesSharedRunLog'>>('execution-stream-owner');
// Proxies must forward this transport while retaining their fences, without re-entering a publisher's queue.
export const executionTransport = Symbol('execution-stream-publisher-transport');

/** Attach the shared publisher to an execution with explicit producer or lifecycle authority. */
export function getExecutionStreamPublisher({
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
  agent?: Pick<Agent, '__getStreamBus' | '__getRunOwner' | '__usesSharedRunLog'>;
  claim?: DurableExecutionClaim;
  role: 'producer' | 'lifecycle';
  entry?: RunRegistryEntry;
}): AgentStreamPublisher | undefined {
  // Workers can attach with a claim before a local reader registers the run.
  if (!entry && !claim) return;
  if (!entry) {
    entry = { isPlaceholder: true } as RunRegistryEntry;
    if (!setRunRegistryEntry(runId, entry, mastra)) return;
  }

  // Keep the captured wrapper ahead of registry lookups: the same agent ID can use another bus.
  const scope = (entry.runScope ??= createRunScope());
  if (agent) scope.set(streamOwnerKey, agent);
  const owner = agent ?? scope.get(streamOwnerKey) ?? mastra?.getAgentById(agentId) ?? entry.agent;
  const bus = owner?.__getStreamBus();
  if (!owner || !bus) return;

  const usesSharedRunLog = owner.__usesSharedRunLog();
  const runBus = bus.forRun(usesSharedRunLog);
  const executionClaim = claim ?? entry.executionFence?.claim;
  if (!executionClaim) return;

  const requestContext = new RequestContext();
  setExecutionClaim(requestContext, runId, executionClaim);
  const publisherId = executionClaim.executionId;
  const memoryInfo = owner.__getRunOwner(runId);

  // Each execution has separate producer/lifecycle attachments, detached with the registry entry.
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
    pubsub: runBus.pubsub,
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
    assertRecordOwnership: async () => {
      if (fence?.executionId !== publisherId || fence.settlement !== 'owned') return;
      let current;
      try {
        current = await readAgentRunRecord(
          bus.getRunRecordCache(usesSharedRunLog),
          agentId,
          runId,
          durableReplayOwnerKey(agentId, runId),
        );
      } catch {
        throw new DurableExecutionFenceError(EXECUTION_UNVERIFIED_ERROR_ID, {
          runId,
          agentId,
          executionId: publisherId,
        });
      }
      // Releasing a successor's lease does not give an older reader its record back.
      if (current?.publisherId && current.publisherId !== publisherId) {
        throw new DurableExecutionFenceError(EXECUTION_SUPERSEDED_ERROR_ID, {
          runId,
          agentId,
          executionId: publisherId,
        });
      }
    },
    assertCleanupOwnership: async () => {
      // Owned deadline settlement revokes execution writes but keeps the run's topics.
      if (fence?.executionId === publisherId && fence.ownsRunTopics()) return;
      await assertExecutionNotSuperseded({ runId, agentId, mastra, requestContext });
    },
    record: {
      cache: bus.getRunRecordCache(usesSharedRunLog),
      key: durableReplayOwnerKey(agentId, runId),
      agentId,
      resourceId: executionClaim.resourceId ?? memoryInfo?.resourceId,
      threadId: executionClaim.threadId ?? memoryInfo?.threadId,
    },
  });
  publishers.set(key, publisher);
  return publisher;
}

/** Preserve durable event shaping and the workflow's existing publish-after-persist boundary. */
export function withExecutionStreamPublisher(
  pubsub: PubSub,
  options: { runId: string; agentId: string; mastra?: Mastra; claim?: DurableExecutionClaim },
): PubSub {
  const transport: PubSub = Reflect.get(pubsub, executionTransport) ?? pubsub;
  return new Proxy(pubsub, {
    get(target, property) {
      if (property === executionTransport) return transport;
      if (property === 'publish') {
        return async (
          topic: string,
          event: Omit<Event, 'id' | 'createdAt'>,
          publishOptions?: { localOnly?: boolean },
        ) => {
          if (topic === AGENT_STREAM_TOPIC(options.runId)) {
            const publisher = getExecutionStreamPublisher({ ...options, role: 'producer' });
            if (publisher) {
              try {
                // Keep each step's fence and cache policy without chaining publishers or splitting their queue.
                return await publisher.publishEvent(event, transport);
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
