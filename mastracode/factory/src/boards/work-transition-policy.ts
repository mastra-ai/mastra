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
  // The stock planning handoff has a plan agent drive planning -> execute directly,
  // which queues the build. With plans not auto-approved (no per-item preapproval and
  // the project's Auto-approve plans off), that agent move must not stand in for the
  // human review: the item rests in Planning with the produced plan as the handoff
  // until a maintainer moves it into Building from the Factory UI.
  const planAgent = actor.type === 'agent' && actor.role === 'plan';
  if (planAgent && fromStage === 'planning' && toStage === 'execute' && !plansAutoApproved) {
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
