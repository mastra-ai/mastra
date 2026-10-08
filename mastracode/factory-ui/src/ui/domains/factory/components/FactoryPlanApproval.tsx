import { useFactoryDecision, useFactoryDecisionAction } from '../../../../hooks/useFactoryDecisions';
import { SubmitPlanCard } from '../../chat/components/SubmitPlanCard';
import type { FactoryDecisionDetail } from '../services/decisions';

/** Both the board and transcript review the same immutable server-side submission. */
export function FactoryPlanApproval({
  factoryProjectId,
  decisionId,
}: {
  factoryProjectId: string;
  decisionId: string;
}) {
  const query = useFactoryDecision(factoryProjectId, decisionId);
  const approve = useFactoryDecisionAction(factoryProjectId, 'approve');
  const reject = useFactoryDecisionAction(factoryProjectId, 'dismiss');
  if (query.isPending) return <p role="status">Loading plan…</p>;
  if (query.isError) return <p role="alert">The plan could not be loaded. {query.error.message}</p>;
  const decision = query.data;
  if (!decision.plan) return <p role="alert">This decision has no submitted plan.</p>;
  const error = approve.error ?? reject.error;
  const reviewing = decision.canApprovePlan === true;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p role="status">{planStatus(decision)}</p>
      {error && <p role="alert">{error.message}</p>}
      <SubmitPlanCard
        toolCallId={decision.id}
        input={{ title: decision.plan.title, plan: decision.plan.content, path: decision.plan.path }}
        isSubmitting={approve.isPending || reject.isPending}
        onRespond={
          reviewing
            ? response => {
                if (response.action === 'approved') approve.mutate(decision.id);
                else reject.mutate(decision.id);
              }
            : undefined
        }
      />
    </div>
  );
}

function planStatus(decision: FactoryDecisionDetail): string {
  if (decision.status === 'dismissed') return 'Plan rejected.';
  if (decision.status === 'superseded' || (decision.status === 'proposed' && !decision.canApprovePlan)) {
    return 'This plan is no longer current. Review the latest plan before building.';
  }
  if (decision.status === 'failed') return decision.lastError ?? 'The build could not be queued.';
  if (decision.approvedAt || decision.status === 'succeeded') return 'Plan approved. Build queued.';
  if (decision.canApprovePlan) return 'Awaiting plan approval.';
  return 'Preparing plan review…';
}
