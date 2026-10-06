import { canonicalizeKnowledgeScopeIds } from '../../storage/domains/knowledge';
import type { KnowledgeScopeGrant } from '../../storage/domains/knowledge';
import { combineKnowledgeCapabilities, NO_KNOWLEDGE_CAPABILITIES, resolveKnowledgeGrantCapabilities } from './grants';
import type { KnowledgeAccessFrontier, KnowledgeCapabilities, KnowledgeScopeAccess } from './types';

function capabilitiesEqual(left: KnowledgeCapabilities | undefined, right: KnowledgeCapabilities): boolean {
  if (!left) return false;
  return (
    left.read === right.read &&
    left.append === right.append &&
    left.edit === right.edit &&
    left.delete === right.delete &&
    left.createChildren === right.createChildren &&
    left.manageAccess === right.manageAccess &&
    left.suggest === right.suggest
  );
}

function freezeCapabilities(capabilities: KnowledgeCapabilities): Readonly<KnowledgeCapabilities> {
  return Object.freeze({ ...capabilities });
}

export function evaluateKnowledgeAccessFrontier(input: {
  vouchedScopeIds: readonly string[];
  grants: readonly KnowledgeScopeGrant[];
  accessEpoch: number;
}): KnowledgeAccessFrontier {
  const vouchedScopeIds = canonicalizeKnowledgeScopeIds([...input.vouchedScopeIds]);
  const seedScopeIds = new Set(vouchedScopeIds);
  const capabilitiesByScopeId = new Map<string, KnowledgeCapabilities>();
  const grantsByReference = new Map<string, KnowledgeScopeGrant[]>();
  const pending = new Set<string>(vouchedScopeIds);

  for (const grant of input.grants) {
    const referencing = grantsByReference.get(grant.scopeRefId) ?? [];
    referencing.push(grant);
    grantsByReference.set(grant.scopeRefId, referencing);
  }

  // Monotone fixed point: a scope is reprocessed whenever its capability set grows, so later owner or
  // suggest paths still reach every mirror dependent. Host vouching only makes a scope eligible to
  // activate ordinary grants that reference it; it never grants readability or owner by itself.
  // A scope's grant to itself is identity ownership: only vouching as that scope activates it.
  // Reaching a scope through another grant keeps the arriving role, so a readonly share of a
  // self-owned scope never escalates to owner.
  while (pending.size > 0) {
    const referencedScopeId = pending.values().next().value!;
    pending.delete(referencedScopeId);
    const referencedCapabilities = capabilitiesByScopeId.get(referencedScopeId) ?? NO_KNOWLEDGE_CAPABILITIES;
    const isSeed = seedScopeIds.has(referencedScopeId);
    const activatesRoleGrants = isSeed || referencedCapabilities.read;
    for (const grant of grantsByReference.get(referencedScopeId) ?? []) {
      if (grant.role !== 'mirror' && !activatesRoleGrants) continue;
      if (grant.scopeNodeId === referencedScopeId && !isSeed) continue;
      const grantedCapabilities = resolveKnowledgeGrantCapabilities(grant, referencedCapabilities);
      const current = capabilitiesByScopeId.get(grant.scopeNodeId);
      const combined = combineKnowledgeCapabilities(current ? [current, grantedCapabilities] : [grantedCapabilities]);
      if (capabilitiesEqual(current ?? NO_KNOWLEDGE_CAPABILITIES, combined)) continue;
      capabilitiesByScopeId.set(grant.scopeNodeId, combined);
      pending.add(grant.scopeNodeId);
    }
  }

  const scopes: Record<string, Readonly<KnowledgeCapabilities>> = Object.create(null);
  for (const [scopeId, capabilities] of [...capabilitiesByScopeId].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    scopes[scopeId] = freezeCapabilities(capabilities);
  }

  return Object.freeze({
    accessEpoch: input.accessEpoch,
    vouchedScopeIds: Object.freeze(vouchedScopeIds),
    scopes: Object.freeze(scopes),
  });
}

export function getKnowledgeScopeAccess(
  frontier: KnowledgeAccessFrontier,
  scopeId: string,
): KnowledgeScopeAccess | undefined {
  const [canonicalScopeId] = canonicalizeKnowledgeScopeIds([scopeId]);
  const capabilities = frontier.scopes[canonicalScopeId!];
  return capabilities ? { scopeId: canonicalScopeId!, capabilities } : undefined;
}

export function getKnowledgeNodeAccess(
  frontier: KnowledgeAccessFrontier,
  directScopeIds: readonly string[],
): KnowledgeCapabilities {
  const matches = canonicalizeKnowledgeScopeIds([...directScopeIds])
    .map(scopeId => frontier.scopes[scopeId])
    .filter((capabilities): capabilities is Readonly<KnowledgeCapabilities> => capabilities !== undefined);
  return matches.length > 0 ? combineKnowledgeCapabilities(matches) : { ...NO_KNOWLEDGE_CAPABILITIES };
}

export function canAccessKnowledgeNode(frontier: KnowledgeAccessFrontier, directScopeIds: readonly string[]): boolean {
  return getKnowledgeNodeAccess(frontier, directScopeIds).read;
}
