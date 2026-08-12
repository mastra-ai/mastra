import { useMemo } from 'react';

import {
  useApproveFactoryDecision,
  useFactoryDecisionStatus,
  useRetryFactoryDecision,
} from '../../../../hooks/useFactoryDecisions';
import type { FactoryDecisionStatus, FactoryDecisionSummary } from '../services/decisions';

const ACTIVE_STATUSES: FactoryDecisionStatus[] = ['pending', 'proposed', 'leased', 'retry', 'failed'];

/** Rule effects still in flight for the board's cards, plus approving a proposed run and retrying a failed effect. */
export function useBoardDecisions(factoryProjectId: string) {
  const status = useFactoryDecisionStatus(factoryProjectId, ACTIVE_STATUSES);
  const retry = useRetryFactoryDecision(factoryProjectId);
  const approve = useApproveFactoryDecision(factoryProjectId);

  const byItem = useMemo(() => {
    const decisions = new Map<string, FactoryDecisionSummary>();
    for (const decision of status.data?.decisions ?? []) {
      if (decision.workItemId && !decisions.has(decision.workItemId)) decisions.set(decision.workItemId, decision);
    }
    return decisions;
  }, [status.data]);

  return {
    byItem,
    retryingId: retry.isPending ? retry.variables : undefined,
    retry: (decisionId: string) => retry.mutate(decisionId),
    approvingId: approve.isPending ? approve.variables : undefined,
    approve: (decisionId: string) => approve.mutate(decisionId),
  };
}
