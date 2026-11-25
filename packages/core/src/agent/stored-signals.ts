import type { Mastra } from '../mastra';
import type { AgentSignalsStorage } from '../storage/domains/agent-signals/base';

type SignalQueueOwner = {
  __usesSharedRunLog?: () => boolean;
  getMastraInstance?: () => Mastra | undefined;
};

/**
 * The store that holds the pending signals of this agent's runs, or `undefined`
 * when they stay in the thread runtime's in-process queues.
 *
 * Runs on the evented engine can execute their steps in another process, so
 * their signals are kept in the host's `agentSignals` domain when the storage
 * has one. The sender and the worker both decide from the agent's
 * configuration, so they agree about every run.
 */
export function getAgentSignalsStore(agent: unknown): AgentSignalsStorage | undefined {
  const owner = agent as SignalQueueOwner | undefined;
  if (typeof owner?.__usesSharedRunLog !== 'function' || !owner.__usesSharedRunLog()) return undefined;
  return owner.getMastraInstance?.()?.getStorage()?.stores?.agentSignals;
}
