import type { BoardTransitionPolicy } from './transition-policy.js';

export const workTransitionPolicy: BoardTransitionPolicy = context => {
  const { item, requestedTriageType, actor, fromStage, toStage, isHumanTransition } = context;
  const pullRequestCard = context.source === 'pullRequest' || context.source === 'gitlabPullRequest';
  const triageAgent = actor.type === 'agent' && context.fromPhaseTools.includes('triage');
  if (triageAgent && !pullRequestCard && requestedTriageType === undefined) {
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
  // A pull request's own card is done when the pull request merges. A review agent records its
  // verdict and leaves the card in Review, so a blocking finding never reads as finished work.
  if (toStage === 'done' && actor.type === 'agent' && pullRequestCard) {
    return {
      type: 'reject',
      code: 'invalid_transition',
      reason:
        'Done is reserved for merged pull requests. Record the verdict with factory_record_review_verdict; the card stays in Reviewing.',
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
  if (
    (fromStage === 'intake' || (fromStage === 'review' && toStage !== 'intake')) &&
    actor.type === 'agent' &&
    item.metadata?.selfReviewNeedsHuman === true
  ) {
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
  const entersWork = toStage === 'planning' || toStage === 'execute';
  return {
    type: 'allow',
    ...(triageAgent && requestedTriageType ? { triageType: requestedTriageType } : {}),
    ...(isHumanTransition && entersWork && !item.acceptedAt ? { accept: true as const } : {}),
  };
};
