import { factoryProposalAttentionIdentity } from '../storage/domains/work-items/base.js';
import type { FactoryDeferredDecisionRecord } from '../storage/domains/work-items/base.js';
import type { DecisionAttentionSpec } from './attention-providers.js';
import { factoryDecisionType } from './attention-providers.js';

function proposedAction(decision: FactoryDeferredDecisionRecord): string {
  const { type, stage, role } = decision.decision;
  if (type === 'transition' && typeof stage === 'string') return `move to ${stage.slice(0, 64)}`;
  return `run ${typeof role === 'string' ? role.slice(0, 64) : 'automation'}`;
}

export const proposedDecisionAttentionSpec: DecisionAttentionSpec = {
  kind: 'automation-proposed',
  status: 'proposed',
  identity: decision => factoryProposalAttentionIdentity(decision.id),
  occurredAt: decision => decision.updatedAt,
  title: (decision, item) => item?.title ?? `Waiting for approval to ${proposedAction(decision)}`,
  detail: decision => `Waiting for approval to ${proposedAction(decision)}`,
  matches: (decision, item, search) =>
    item?.title.toLowerCase().includes(search) === true ||
    proposedAction(decision).toLowerCase().includes(search) ||
    factoryDecisionType(decision).toLowerCase().includes(search),
};
