/**
 * Schema-2 Knowledge helpers that published packages still import from `@mastra/core/storage`.
 * Published Memory, server and store adapters resolve these names when they load, so they stay
 * until the next major even though nothing in Knowledge uses them. Do not use them in new code.
 */

/** @deprecated Schema-2 scope tags; Knowledge now uses scope pages. */
export type KnowledgeScope = string[];
/** @deprecated Schema-2 scope levels; Knowledge now uses declared scope types. */
export type KnowledgeScopeLevel = 'org' | 'resource' | 'thread';
/** @deprecated Schema-2 semantic outbox document type. */
export type KnowledgeSemanticDocumentType = 'node' | 'record';
/** @deprecated Schema-2 semantic outbox operation. */
export type KnowledgeSemanticOperation = 'upsert' | 'delete';

/** @deprecated Not enforced. Kept so published packages that import it still load. */
export const MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH = 400;
/** @deprecated Not enforced. Kept so published packages that import it still load. */
export const MAX_KNOWLEDGE_RECORD_TEXT_LENGTH = 1000;

/** @deprecated Schema-2 node cursor. */
export interface KnowledgeNodeCursor {
  updatedAt: Date;
  name: string;
  id: string;
}

/** @deprecated Schema-2 node cursor. */
export function createKnowledgeNodeCursor(
  node: { updatedAt: Date; name: string; id: string },
  filters: { namePrefix?: string; kind?: string; hasContent?: boolean } = {},
): string {
  return encodeURIComponent(
    JSON.stringify({
      version: 1,
      type: 'node',
      updatedAt: node.updatedAt.toISOString(),
      name: node.name,
      id: node.id,
      namePrefix: filters.namePrefix?.toLocaleLowerCase() ?? null,
      kind: filters.kind ?? null,
      hasContent: filters.hasContent ?? null,
    }),
  );
}

/** @deprecated Schema-2 node cursor. */
export function parseKnowledgeNodeCursor(
  cursor: string,
  filters: { namePrefix?: string; kind?: string; hasContent?: boolean },
): KnowledgeNodeCursor {
  let value: unknown;
  try {
    value = JSON.parse(decodeURIComponent(cursor));
  } catch {
    throw new Error('Invalid knowledge node cursor.');
  }
  if (!value || typeof value !== 'object') throw new Error('Invalid knowledge node cursor.');
  const parsed = value as Record<string, unknown>;
  const updatedAt = typeof parsed.updatedAt === 'string' ? new Date(parsed.updatedAt) : new Date(Number.NaN);
  if (
    parsed.version !== 1 ||
    parsed.type !== 'node' ||
    typeof parsed.name !== 'string' ||
    typeof parsed.id !== 'string' ||
    Number.isNaN(updatedAt.getTime()) ||
    parsed.namePrefix !== (filters.namePrefix?.toLocaleLowerCase() ?? null) ||
    parsed.kind !== (filters.kind ?? null) ||
    parsed.hasContent !== (filters.hasContent ?? null)
  ) {
    throw new Error('Knowledge node cursor does not match the active browse filters.');
  }
  return { updatedAt, name: parsed.name, id: parsed.id };
}

const SCOPE_ORDER: Record<KnowledgeScopeLevel, number> = { org: 0, resource: 1, thread: 2 };

/**
 * Most tags one scope may hold. Visible-scope lookup enumerates every subset of the query scope
 * (8 tags = 255 keys in one `IN (...)`); past ~30 the subset loop hangs and `1 << n` wraps, so this
 * is a storage-safety limit, not a hierarchy rule.
 *
 * @experimental
 */
export const MAX_KNOWLEDGE_SCOPE_TAGS = 8;

const KNOWLEDGE_SCOPE_TYPE_PATTERN = /^[a-z][a-z0-9_-]*$/;

/** Orders by UTF-16 code unit, so keys are identical on every machine regardless of locale. */
function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Validates tag shape (`type:value`), dedupes and sorts by whole entry. Any tag type is accepted;
 * a value segment may not start with `$`, so a stored scope can never look like a scope pattern.
 */
export function canonicalizeKnowledgeScope(scope: KnowledgeScope): KnowledgeScope {
  if (scope.length === 0) {
    throw new Error('Knowledge scope cannot be empty');
  }
  for (const entry of scope) {
    const separator = entry.indexOf(':');
    const type = entry.slice(0, separator);
    const value = entry.slice(separator + 1);
    if (
      separator <= 0 ||
      !KNOWLEDGE_SCOPE_TYPE_PATTERN.test(type) ||
      !value ||
      entry.includes('\u001f') ||
      value.split(':').some(segment => segment.startsWith('$'))
    ) {
      throw new Error(`Invalid knowledge scope entry: ${entry}`);
    }
  }
  const unique = [...new Set(scope)].sort(compareCodeUnits);
  if (unique.length > MAX_KNOWLEDGE_SCOPE_TAGS) {
    throw new Error(`Knowledge scope holds at most ${MAX_KNOWLEDGE_SCOPE_TAGS} tags; got ${unique.length}`);
  }
  return unique;
}

export function knowledgeScopeKey(scope: KnowledgeScope): string {
  return canonicalizeKnowledgeScope(scope).join('\u001f');
}

export function isKnowledgeScopeVisible(recordScope: KnowledgeScope, queryScope: KnowledgeScope): boolean {
  const available = new Set(queryScope);
  return recordScope.every(entry => available.has(entry));
}

export function knowledgeVisibleScopeKeys(scope: KnowledgeScope): string[] {
  const canonical = canonicalizeKnowledgeScope(scope);
  const subsets: KnowledgeScope[] = [[]];
  for (const entry of canonical) subsets.push(...subsets.map(subset => [...subset, entry]));
  const keys = new Set<string>();
  for (const subset of subsets.slice(1)) {
    try {
      keys.add(knowledgeScopeKey(subset));
    } catch {
      // Invalid hierarchy fragments cannot be persisted scope keys.
    }
  }
  return [...keys];
}

export function expandKnowledgeScope(context: KnowledgeScope, level: KnowledgeScopeLevel): KnowledgeScope {
  const maxOrder = SCOPE_ORDER[level];
  const expanded = canonicalizeKnowledgeScope(context).filter(entry => {
    const namespace = entry.slice(0, entry.indexOf(':')) as KnowledgeScopeLevel;
    return (SCOPE_ORDER[namespace] ?? Number.MAX_SAFE_INTEGER) <= maxOrder;
  });
  if (!expanded.some(entry => entry.startsWith(`${level}:`))) {
    throw new Error(`Cannot expand knowledge scope to ${level}: context has no ${level} entry`);
  }
  return expanded;
}

/**
 * Knowledge v2 has no record scope ceilings: a write may target any scope level present in the
 * conversation. Grant-based write enforcement is not implemented yet. Kept only so published
 * `@mastra/memory` versions that import it still load; it never throws.
 *
 * @deprecated No longer enforced. Remove calls.
 */
export function assertKnowledgeScopeWithinCeiling(_scope: KnowledgeScope, _maxScope?: KnowledgeScopeLevel): void {}

/**
 * Knowledge v2 records have no scope ceiling to raise. Kept only so published store adapters
 * that import it still load; it never throws.
 *
 * @deprecated No longer enforced. Remove calls.
 */
export function assertKnowledgeCeilingRaised(
  _currentMaxScope: KnowledgeScopeLevel | undefined,
  _maxScope: KnowledgeScopeLevel | undefined,
): void {}

/** @deprecated Schema-2 semantic outbox id. */
export function knowledgeSemanticDocumentId(type: KnowledgeSemanticDocumentType, id: string): string {
  return `knowledge:${type}:${id}`;
}

export function knowledgeSemanticIdempotencyKey(
  documentId: string,
  operation: KnowledgeSemanticOperation,
  version: number | string,
): string {
  return `${documentId}:${operation}:${version}`;
}
