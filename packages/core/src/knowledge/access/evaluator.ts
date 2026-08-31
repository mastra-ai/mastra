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
  const capabilitiesByScopeId = new Map<string, KnowledgeCapabilities>();
  const grantsByReference = new Map<string, KnowledgeScopeGrant[]>();
  const worklist: string[] = [];

  for (const scopeId of vouchedScopeIds) {
    capabilitiesByScopeId.set(scopeId, { ...NO_KNOWLEDGE_CAPABILITIES, read: true });
    worklist.push(scopeId);
  }
  for (const grant of input.grants) {
    const referencing = grantsByReference.get(grant.scopeRefId) ?? [];
    referencing.push(grant);
    grantsByReference.set(grant.scopeRefId, referencing);
  }

  for (let index = 0; index < worklist.length; index += 1) {
    const referencedScopeId = worklist[index]!;
    const referencedCapabilities = capabilitiesByScopeId.get(referencedScopeId)!;
    for (const grant of grantsByReference.get(referencedScopeId) ?? []) {
      const grantedCapabilities = resolveKnowledgeGrantCapabilities(grant, referencedCapabilities);
      const current = capabilitiesByScopeId.get(grant.scopeNodeId);
      const combined = combineKnowledgeCapabilities(current ? [current, grantedCapabilities] : [grantedCapabilities]);
      if (capabilitiesEqual(current, combined)) continue;
      capabilitiesByScopeId.set(grant.scopeNodeId, combined);
      worklist.push(grant.scopeNodeId);
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
