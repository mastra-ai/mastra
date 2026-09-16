import { useMemo } from 'react';

import { useFactoryDecisionAction, useFactoryDecisionStatus } from '../../../../hooks/useFactoryDecisions';
import type { FactoryDecisionStatus, FactoryDecisionSummary } from '../services/decisions';

const BOARD_STATUSES: FactoryDecisionStatus[] = ['pending', 'proposed', 'leased', 'retry', 'failed'];

/** Per card: the run proposed on it, and the effect already in flight or failed behind it. */
export function useItemDecisions(factoryProjectId: string | undefined) {
  const status = useFactoryDecisionStatus(factoryProjectId, BOARD_STATUSES);
  return useMemo(() => {
    const proposalByItem = new Map<string, FactoryDecisionSummary>();
    const effectByItem = new Map<string, FactoryDecisionSummary>();
    for (const decision of status.data?.decisions ?? []) {
      if (!decision.workItemId) continue;
      const bucket = decision.status === 'proposed' ? proposalByItem : effectByItem;
      if (!bucket.has(decision.workItemId)) bucket.set(decision.workItemId, decision);
    }
    return { proposalByItem, effectByItem };
  }, [status.data]);
}

/** The board's decisions with the actions a person takes on them. */
export function useBoardDecisions(factoryProjectId: string) {
  const { proposalByItem, effectByItem } = useItemDecisions(factoryProjectId);
  const approve = useFactoryDecisionAction(factoryProjectId, 'approve');
  const dismiss = useFactoryDecisionAction(factoryProjectId, 'dismiss');
  const retry = useFactoryDecisionAction(factoryProjectId, 'retry');

  return {
    proposalByItem,
    effectByItem,
    approvingId: approve.isPending ? approve.variables : undefined,
    approve: (decisionId: string) => approve.mutate(decisionId),
    dismiss: (decisionId: string) => dismiss.mutate(decisionId),
    retryingId: retry.isPending ? retry.variables : undefined,
    retry: (decisionId: string) => retry.mutate(decisionId),
    error: [approve, dismiss, retry].find(mutation => mutation.isError)?.error,
  };
}
