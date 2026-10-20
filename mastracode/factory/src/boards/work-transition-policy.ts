import type { BoardTransitionPolicy } from './transition-policy.js';

export const workTransitionPolicy: BoardTransitionPolicy = context => {
  const { item, requestedTriageType, actor, fromStage, toStage, isHumanTransition, plansAutoApproved, planApproved } =
    context;
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
  // Planning is the approval boundary. When project auto-approval is off, only a
  // person or a successfully approved `submit_plan` result may move the card into Building.
  // An agent cannot skip Planning from Intake or Triage either; maintainer-configured
  // system rules may still route cards there.
  const skipsPlanning = (fromStage === 'intake' || fromStage === 'triage') && actor.type === 'agent';
  if (
    (fromStage === 'planning' || skipsPlanning) &&
    toStage === 'execute' &&
    actor.type !== 'human' &&
    !plansAutoApproved &&
    !planApproved
  ) {
    return {
      type: 'reject',
      code: 'approval_required',
      reason:
        'Auto-approve plans is off: a maintainer must approve the plan or move this work item into Building from the Factory UI.',
    };
  }
  // A Factory review requested changes on this item's pull request. Closing the
  // work now would bury the finding; the next push re-reviews and updates it.
  if (toStage === 'done' && actor.type === 'agent' && item.metadata?.reviewVerdict === 'request changes') {
    return {
      type: 'reject',
      code: 'invalid_transition',
      reason:
        'The latest Factory review requested changes on this pull request. Address them and push; the re-review updates the verdict. A merge or a maintainer can still close the work.',
    };
  }
  // The work ships when its pull request merges, and the merge closes the card.
  if (toStage === 'done' && actor.type === 'agent' && typeof item.metadata?.openPullRequestNumber === 'number') {
    return {
      type: 'reject',
      code: 'invalid_transition',
      reason: `Pull request #${item.metadata.openPullRequestNumber} is still open. The card moves to Done when it merges; a maintainer can still close the work.`,
    };
  }
  // Self-review hit its round limit and parked the card for a person.
  if (fromStage === 'intake' && actor.type === 'agent' && item.metadata?.selfReviewNeedsHuman === true) {
    return {
      type: 'reject',
      code: 'approval_required',
      reason:
        'Self-review requested changes too many times and parked this work item for a maintainer. A maintainer must move it on from the Factory UI.',
    };
  }
  // In Review without a change request, the card is waiting on self-review; an agent cannot close it from there.
  if (
    fromStage === 'review' &&
    toStage === 'done' &&
    actor.type === 'agent' &&
    typeof item.metadata?.openPullRequestNumber !== 'number' &&
    item.metadata?.reviewVerdict === undefined &&
    item.metadata?.selfReviewVerdict !== 'approve'
  ) {
    return {
      type: 'reject',
      code: 'invalid_transition',
      reason:
        'This work item is in self-review and has no open change request yet. Record a self-review verdict instead; a maintainer can still close the work.',
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
