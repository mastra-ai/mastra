import type { BoardTransitionPolicy } from './transition-policy.js';

export const workTransitionPolicy: BoardTransitionPolicy = context => {
  const { item, requestedTriageType, actor, fromStage, toStage, isHumanTransition, plansAutoApproved } = context;
  const triageAgent = actor.type === 'agent' && actor.role === 'triage';
  if (triageAgent && requestedTriageType === undefined) {
    return {
      type: 'reject',
      code: 'invalid_transition',
      reason: 'Triage transitions must report a structured triage classification.',
    };
  }
  if (item.triageType && requestedTriageType && item.triageType !== requestedTriageType) {
    return {
      type: 'reject',
      code: 'forbidden',
      reason: 'The persisted triage classification cannot be changed by a later transition.',
    };
  }
  // Any agent can inherit a session that is currently parked in Planning. With plans
  // not auto-approved (no run-scoped preapproval and the project's switch off), an
  // agent move must not stand in for human review: the item rests in Planning until a
  // maintainer moves it into Building from the Factory UI.
  if (actor.type === 'agent' && fromStage === 'planning' && toStage === 'execute' && !plansAutoApproved) {
    return {
      type: 'reject',
      code: 'approval_required',
      reason:
        'Auto-approve plans is off: a maintainer must review the plan and move this work item into Building from the Factory UI.',
    };
  }
  const triageType = item.triageType ?? requestedTriageType;
  const entersWork = toStage === 'planning' || toStage === 'execute';
  // An intermediate phase is not evidence of human approval.
  if (triageType != null && triageType !== 'bug' && entersWork && !isHumanTransition && !item.acceptedAt) {
    return {
      type: 'reject',
      code: 'approval_required',
      reason: 'A maintainer must move this non-bug work item into Planning or Execute from the Factory UI.',
    };
  }
  return {
    type: 'allow',
    ...(triageAgent && requestedTriageType ? { triageType: requestedTriageType } : {}),
    ...(isHumanTransition && entersWork && !item.acceptedAt ? { accept: true as const } : {}),
  };
};
