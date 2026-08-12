import { useMemo } from 'react';

import { useFactoryDecisionAction, useFactoryDecisionStatus } from '../../../../hooks/useFactoryDecisions';
import type { FactoryDecisionStatus, FactoryDecisionSummary } from '../services/decisions';

const BOARD_STATUSES: FactoryDecisionStatus[] = ['pending', 'proposed', 'leased', 'retry', 'failed'];

/**
 * What the board's cards owe a person: a run a rule proposed and nobody has
 * released yet, and the effects already in flight (or failed) behind them.
 */
export function useBoardDecisions(factoryProjectId: string) {
  const status = useFactoryDecisionStatus(factoryProjectId, BOARD_STATUSES);
  const approve = useFactoryDecisionAction(factoryProjectId, 'approve');
  const dismiss = useFactoryDecisionAction(factoryProjectId, 'dismiss');
  const retry = useFactoryDecisionAction(factoryProjectId, 'retry');

  const { proposalByItem, effectByItem } = useMemo(() => {
    const proposals = new Map<string, FactoryDecisionSummary>();
    const effects = new Map<string, FactoryDecisionSummary>();
    for (const decision of status.data?.decisions ?? []) {
      if (!decision.workItemId) continue;
      const bucket = decision.status === 'proposed' ? proposals : effects;
      if (!bucket.has(decision.workItemId)) bucket.set(decision.workItemId, decision);
    }
    return { proposalByItem: proposals, effectByItem: effects };
  }, [status.data]);

  return {
    proposalByItem,
    effectByItem,
    approvingId: approve.isPending ? approve.variables : undefined,
    approve: (decisionId: string) => approve.mutate(decisionId),
    dismiss: (decisionId: string) => dismiss.mutate(decisionId),
    retryingId: retry.isPending ? retry.variables : undefined,
    retry: (decisionId: string) => retry.mutate(decisionId),
  };
}
