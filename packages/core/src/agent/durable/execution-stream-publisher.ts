import type { PubSub } from '../../events/pubsub';
import type { Event } from '../../events/types';
import type { Mastra } from '../../mastra';
import { createRunScope, createRunScopeKey } from '../../mastra/run-scope';
import { RequestContext } from '../../request-context';
import type { Agent } from '../agent';
import { AGENT_STREAM_TOPIC } from '../streams/constants';
import type { AgentStreamOutput, AgentStreamPublisher } from '../streams/publisher';
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
import { getRunStreamPublisher } from './run-stream-publisher';
import type { RunRegistryEntry } from './types';

const streamOwnerKey =
  createRunScopeKey<Pick<Agent, '__getStreamBus' | '__getRunOwner' | '__usesSharedRunLog'>>('execution-stream-owner');
// Proxies must forward this transport while retaining their fences, without re-entering a publisher's queue.
export const executionTransport = Symbol('execution-stream-publisher-transport');

interface ExecutionPublisherOptions {
  runId: string;
  agentId: string;
  mastra?: Mastra;
  agent?: Pick<Agent, '__getStreamBus' | '__getRunOwner' | '__usesSharedRunLog'>;
  claim?: DurableExecutionClaim;
  entry?: RunRegistryEntry;
}

function resolveExecutionPublisher({
  runId,
  mastra,
  agentId,
  agent,
  claim,
  entry = getRunRegistryEntry(runId, mastra),
}: ExecutionPublisherOptions) {
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

  const publisher = getRunStreamPublisher(runId, entry, mastra);
  return { publisher, publisherId, runBus, bus, usesSharedRunLog, executionClaim, requestContext, memoryInfo, entry };
}

/** Worker output keeps its captured execution authority and cannot settle or clean up the run. */
export function getExecutionStreamOutput(options: ExecutionPublisherOptions): AgentStreamOutput | undefined {
  const context = resolveExecutionPublisher(options);
  if (!context) return;
  const { publisher, publisherId, runBus, requestContext } = context;
  const { runId, agentId, mastra } = options;
  return publisher.attachOutput({
    publisherId,
    pubsub: runBus.pubsub,
    assertOwnership: () => assertExecutionNotSuperseded({ runId, agentId, mastra, requestContext }),
  });
}

/** Owning readers settle and clean up using the authority of their captured execution. */
export function getExecutionStreamLifecycle(options: ExecutionPublisherOptions): AgentStreamPublisher | undefined {
  const context = resolveExecutionPublisher(options);
  if (!context) return;
  const { publisher, publisherId, runBus, bus, usesSharedRunLog, executionClaim, requestContext, memoryInfo, entry } =
    context;
  const { runId, agentId, mastra } = options;
  const fence = entry.executionFence;
  return publisher.attachLifecycle({
    pubsub: runBus.pubsub,
    publisherId,
    cleanupTimeoutMs: bus.cleanupTimeoutMs,
    logger: mastra?.getLogger(),
    abortSignal: entry.abortSignal,
    // ensureRemoteAbortListener owns the single execution-scoped listener on this worker.
    listenForAbort: false,
    assertOwnership: async () => {
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
      // Check generation without poisoning a fence releasing its own lease.
      await assertExecutionGenerationCurrent({ runId, agentId, mastra, claim: executionClaim });
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
            const publisher = getExecutionStreamOutput(options);
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
