import { factoryProposalAttentionIdentity } from '../storage/domains/work-items/base.js';
import type { FactoryDeferredDecisionRecord } from '../storage/domains/work-items/base.js';
import type { DecisionAttentionSpec } from './attention-providers.js';
import { factoryDecisionType } from './attention-providers.js';

function proposedRole(decision: FactoryDeferredDecisionRecord): string {
  return typeof decision.decision.role === 'string' ? decision.decision.role.slice(0, 64) : 'automation';
}

export const proposedDecisionAttentionSpec: DecisionAttentionSpec = {
  kind: 'automation-proposed',
  status: 'proposed',
  identity: decision => factoryProposalAttentionIdentity(decision.id),
  occurredAt: decision => decision.updatedAt,
  title: (decision, item) => item?.title ?? `Waiting for approval to run ${proposedRole(decision)}`,
  detail: decision => `Waiting for approval to run ${proposedRole(decision)}`,
  matches: (decision, item, search) =>
    item?.title.toLowerCase().includes(search) === true ||
    proposedRole(decision).toLowerCase().includes(search) ||
    factoryDecisionType(decision).toLowerCase().includes(search),
};
