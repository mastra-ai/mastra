import type { Mastra } from '../mastra';
import type { AgentSignalsStorage } from '../storage/domains/agent-signals/base';

type SignalQueueOwner = {
  __usesSharedRunLog?: () => boolean;
  getMastraInstance?: () => Mastra | undefined;
};

/**
 * The store that would hold the pending signals of a run this agent prepares
 * now, or `undefined` when they would stay in the thread runtime's in-process
 * queues.
 *
 * Runs on the evented engine can execute their steps in another process, so
 * their signals are kept in the host's `agentSignals` domain when the storage
 * has one. This only decides for a run being prepared: the run carries the
 * decision from then on, and every process that sends to it or executes its
 * steps reads the carried decision instead of the configuration.
 */
export function getAgentSignalsStore(agent: unknown): AgentSignalsStorage | undefined {
  const owner = agent as SignalQueueOwner | undefined;
  if (typeof owner?.__usesSharedRunLog !== 'function' || !owner.__usesSharedRunLog()) return undefined;
  return owner.getMastraInstance?.()?.getStorage()?.stores?.agentSignals;
}

/** The store of a run that carries `signalsStored`, from the storage of the host the agent is attached to. */
export function getRunSignalsStore(
  agent: unknown,
  signalsStored: boolean | undefined,
): AgentSignalsStorage | undefined {
  if (!signalsStored) return undefined;
  return (agent as SignalQueueOwner | undefined)?.getMastraInstance?.()?.getStorage()?.stores?.agentSignals;
}
