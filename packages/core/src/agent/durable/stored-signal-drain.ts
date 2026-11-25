import type { Mastra } from '../../mastra';
import type { AgentSignalScope, AgentSignalsStorage } from '../../storage/domains/agent-signals/base';
import type { MessageList } from '../message-list';
import type { CreatedAgentSignal } from '../signals';
import { fromStoredSignalPayload } from '../stored-signal-payload';
import { getAgentSignalsStore } from '../stored-signals';
import { agentThreadStreamKey } from '../thread-stream-topic';
import type { DurableExecutionClaim } from './execution-fence';

/**
 * Workflow-state key of the signal ids a storage-backed run took into its
 * transcript since its last drain. The next drain deletes those rows: by then
 * the step that took them has saved its result, so they can't be lost.
 */
export const CONSUMED_SIGNAL_IDS_KEY = 'consumedSignalIds';

/** The consumed set in workflow state. A run started before the set existed has consumed nothing. */
export function readConsumedSignalIds(state: unknown): string[] {
  const ids = (state as { [CONSUMED_SIGNAL_IDS_KEY]?: unknown } | undefined)?.[CONSUMED_SIGNAL_IDS_KEY];
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
}

type DurableRunInput = {
  agentId?: string;
  state?: { threadId?: string; resourceId?: string };
  messageListState?: { memoryInfo?: { threadId?: string; resourceId?: string } };
};

/**
 * The thread key of a durable run, from the values its thread lease uses: the
 * execution claim's thread when the run carries one, else the run input the
 * claim was built from.
 */
export function durableRunThreadKey(
  input: DurableRunInput | undefined,
  claim: Pick<DurableExecutionClaim, 'threadId' | 'resourceId'> | undefined,
): string | undefined {
  const memoryInfo = input?.messageListState?.memoryInfo;
  const threadId = claim?.threadId ?? input?.state?.threadId ?? memoryInfo?.threadId;
  if (!threadId) return undefined;
  const resourceId = claim?.threadId ? claim.resourceId : (input?.state?.resourceId ?? memoryInfo?.resourceId);
  return agentThreadStreamKey(resourceId, threadId);
}

/** The signals store of a durable run's agent, resolved through the host the step runs on. */
export function durableRunSignalsStore(
  mastra: Mastra | undefined,
  agentId: string | undefined,
): AgentSignalsStorage | undefined {
  if (!mastra || !agentId) return undefined;
  let agent: unknown;
  try {
    agent = mastra.getAgentById(agentId);
  } catch {
    return undefined;
  }
  return getAgentSignalsStore(agent);
}

/** Ids of the signals the run was started with. They reach the transcript as input, not through a drain. */
export function inputSignalIds(messageList: MessageList): string[] {
  return messageList.get.input
    .db()
    .filter(message => message.role === 'signal')
    .map(message => message.id);
}

export type StoredSignalDrain = {
  signals: CreatedAgentSignal[];
  /** The consumed set to save with the transcript that holds `signals`. */
  consumedSignalIds: string[];
};

/**
 * One drain of a storage-backed run: delete the rows its saved state lists as
 * consumed, then claim. Claimed rows stay in the store until the next drain
 * deletes them, so a step that fails before saving its result gets the same
 * rows again from its retry.
 */
export async function claimStoredSignals({
  store,
  threadKey,
  runId,
  scope,
  leftovers,
  consumed,
}: {
  store: AgentSignalsStorage;
  threadKey: string;
  runId: string;
  scope: AgentSignalScope;
  /** Take over the thread first: its leftovers and other open runs' rows. Only for the run's first model request. */
  leftovers?: boolean;
  consumed: readonly string[];
}): Promise<StoredSignalDrain> {
  if (consumed.length) await store.delete({ ids: [...consumed] });
  const rows =
    scope === 'pre-run'
      ? await store.claim({ threadKey, runId, scope, leftovers })
      : await store.claim({ threadKey, runId, scope });
  // A seeded id (the run's own input signal) is already in the transcript.
  const skip = new Set(consumed);
  const taken = rows.filter(row => !skip.has(row.id));
  return {
    signals: taken.map(row => fromStoredSignalPayload(row.signal)),
    consumedSignalIds: taken.map(row => row.id),
  };
}
