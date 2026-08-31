import { KnowledgeNotFoundError, type KnowledgeScopeIds } from '../../storage/domains/knowledge';
import type { KnowledgeAccessFrontier, KnowledgeCapabilities, KnowledgeCapability } from './types';

const EMPTY_CAPABILITIES: Readonly<KnowledgeCapabilities> = Object.freeze({
  read: false,
  append: false,
  edit: false,
  delete: false,
  createChildren: false,
  manageAccess: false,
  suggest: false,
});

export function getKnowledgeMutationCapabilities(
  frontier: KnowledgeAccessFrontier,
  scopeIds: KnowledgeScopeIds,
): Readonly<KnowledgeCapabilities> {
  const capabilities = { ...EMPTY_CAPABILITIES };
  for (const scopeId of scopeIds) {
    const granted = frontier.scopes[scopeId];
    if (!granted) continue;
    for (const capability of Object.keys(capabilities) as KnowledgeCapability[]) {
      capabilities[capability] ||= granted[capability];
    }
  }
  return Object.freeze(capabilities);
}

export function assertKnowledgeTargetCapability(input: {
  frontier: KnowledgeAccessFrontier;
  scopeIds: KnowledgeScopeIds;
  capability: KnowledgeCapability;
  targetType: string;
  targetId: string;
}): void {
  if (getKnowledgeMutationCapabilities(input.frontier, input.scopeIds)[input.capability]) return;
  throw new KnowledgeNotFoundError(input.targetType, input.targetId);
}

export function assertKnowledgeScopeCapabilities(input: {
  frontier: KnowledgeAccessFrontier;
  scopeIds: KnowledgeScopeIds;
  capability: KnowledgeCapability;
  targetType: string;
}): void {
  for (const scopeId of input.scopeIds) {
    if (input.frontier.scopes[scopeId]?.[input.capability]) continue;
    throw new KnowledgeNotFoundError(input.targetType, scopeId);
  }
}
