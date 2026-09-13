import type { KnowledgeAccessFrontier } from './types';

export function getKnowledgeReadableScopeIds(frontier: KnowledgeAccessFrontier): string[] {
  return Object.entries(frontier.scopes)
    .filter(([, capabilities]) => capabilities.read)
    .map(([scopeId]) => scopeId);
}

export function isKnowledgeReadVisible(
  directScopeIds: readonly string[],
  readableScopeIds: readonly string[],
): boolean {
  const readable = new Set(readableScopeIds);
  return directScopeIds.some(scopeId => readable.has(scopeId));
}
