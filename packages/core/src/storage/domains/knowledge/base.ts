import { randomBytes } from 'node:crypto';

import { StorageDomain } from '../base';

/** @experimental Knowledge APIs are experimental and may change without notice. */
export type KnowledgeScope = string[];
/** @experimental Knowledge APIs are experimental and may change without notice. */
export type KnowledgeScopeLevel = 'org' | 'resource' | 'thread';
/** @experimental Knowledge APIs are experimental and may change without notice. */
export type KnowledgeSemanticDocumentType = 'node' | 'record';
/** @experimental Knowledge APIs are experimental and may change without notice. */
export type KnowledgeSemanticOperation = 'upsert' | 'delete';
/** @experimental Knowledge APIs are experimental and may change without notice. */
export type KnowledgeActivityAction =
  | 'node-created'
  | 'node-updated'
  | 'node-merged'
  | 'record-created'
  | 'record-deleted'
  | 'record-restored'
  | 'record-rescoped';

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface KnowledgeNode {
  id: string;
  type: 'node';
  name: string;
  kind: string;
  content?: string;
  /**
   * Bounded synopsis for list/graph surfaces. The bound is part of the storage contract: every
   * adapter enforces {@link MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH} in `createNode` and `updateNode`
   * regardless of which writer performs the write; merge adoption only propagates a description
   * storage already accepted. Long-form detail belongs in {@link KnowledgeNode.content}.
   */
  description?: string;
  scope: KnowledgeScope;
  version: number;
  mergedInto?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** @experimental Knowledge APIs are experimental and may change without notice. */
export type KnowledgeNodeReference = KnowledgeNode | string;

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface KnowledgeRecord {
  id: string;
  node: string;
  text: string;
  scope: KnowledgeScope;
  sourceThreadId: string;
  capturedAt: Date;
  when?: Date;
  maxScope?: KnowledgeScopeLevel;
  /** Free-form provenance, e.g. the capture agent's reasoning for keeping or pinning the item. */
  metadata?: Record<string, unknown>;
  deletedAt?: Date;
  deletedBy?: string;
}

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface KnowledgeMention {
  sourceType: 'record' | 'node';
  source: string;
  node: string;
}

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface KnowledgeCurationCursor {
  sourceThreadId: string;
  agent: string;
  lastKnowledgeId: string;
  updatedAt: Date;
}

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface KnowledgeActivityEvent {
  id: string;
  action: KnowledgeActivityAction;
  recordType: KnowledgeSemanticDocumentType;
  recordId: string;
  scope: KnowledgeScope;
  sourceThreadId?: string;
  createdAt: Date;
}

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface KnowledgeSemanticOutboxEntry {
  id: string;
  idempotencyKey: string;
  documentId: string;
  documentType: KnowledgeSemanticDocumentType;
  operation: KnowledgeSemanticOperation;
  scope: KnowledgeScope;
  status: 'pending' | 'processing' | 'completed';
  attempts: number;
  availableAt: Date;
  claimedAt?: Date;
  claimedBy?: string;
  createdAt: Date;
  completedAt?: Date;
}

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface CreateKnowledgeNodeInput {
  id?: string;
  name: string;
  kind: string;
  content?: string;
  description?: string;
  scope: KnowledgeScope;
  resolutionScope?: KnowledgeScope;
}

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface UpdateKnowledgeNodeInput {
  id: string;
  version: number;
  name?: string;
  kind?: string;
  content?: string;
  description?: string;
  scope?: KnowledgeScope;
  resolutionScope?: KnowledgeScope;
}

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface AppendKnowledgeInput {
  id?: string;
  node: KnowledgeNodeReference;
  text: string;
  scope: KnowledgeScope;
  sourceThreadId: string;
  when?: Date;
  maxScope?: KnowledgeScopeLevel;
  metadata?: Record<string, unknown>;
  resolutionScope: KnowledgeScope;
  defaultScope: KnowledgeScope;
}

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface ListKnowledgeNodesInput {
  scope: KnowledgeScope;
  namePrefix?: string;
  kind?: string;
  hasContent?: boolean;
  cursor?: string;
  limit?: number;
}

/** @experimental Knowledge APIs are experimental and may change without notice. */

export interface KnowledgeNodeCursor {
  updatedAt: Date;
  name: string;
  id: string;
}

/** @experimental Knowledge APIs are experimental and may change without notice. */
export function createKnowledgeNodeCursor(
  node: Pick<KnowledgeNode, 'updatedAt' | 'name' | 'id'>,
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

/** @experimental Knowledge APIs are experimental and may change without notice. */
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

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface QueryKnowledgeInput {
  node: KnowledgeNodeReference;

  scope: KnowledgeScope;
  after?: string;
  limit?: number;
  includeDeleted?: boolean;
}

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface QueryKnowledgeOutput {
  records: KnowledgeRecord[];
  nextCursor?: string;
}

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface QueryKnowledgeBySourceInput {
  sourceThreadId: string;
  scope: KnowledgeScope;
  after?: string;
  limit?: number;
  includeDeleted?: boolean;
}

export interface SearchKnowledgeInput {
  query: string;
  scope: KnowledgeScope;
  limit?: number;
}

export interface SearchKnowledgeResult {
  type: KnowledgeSemanticDocumentType;
  id: string;
  recordId: string;
  name: string;
  text: string;
  scope: KnowledgeScope;
}

export interface ClaimKnowledgeSemanticOutboxInput {
  workerId: string;
  limit?: number;
  now?: Date;
  claimTimeoutMs?: number;
  scope?: KnowledgeScope;
}

export class KnowledgeConflictError extends Error {
  constructor(id: string) {
    super(`Knowledge record version conflict: ${id}`);
    this.name = 'KnowledgeConflictError';
  }
}

export class KnowledgeNotFoundError extends Error {
  constructor(type: string, id: string) {
    super(`Knowledge ${type} not found: ${id}`);
    this.name = 'KnowledgeNotFoundError';
  }
}

const SCOPE_ORDER: Record<KnowledgeScopeLevel, number> = { org: 0, resource: 1, thread: 2 };
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let lastUlidTime = -1;
let lastUlidRandom = 0n;

export function canonicalizeKnowledgeScope(scope: KnowledgeScope): KnowledgeScope {
  const entriesByLevel = new Map<KnowledgeScopeLevel, string>();
  for (const entry of scope) {
    const separator = entry.indexOf(':');
    const level = entry.slice(0, separator) as KnowledgeScopeLevel;
    const id = entry.slice(separator + 1);
    if (separator <= 0 || !id || id.includes('\u001f') || SCOPE_ORDER[level] === undefined) {
      throw new Error(`Invalid knowledge scope entry: ${entry}`);
    }
    const existing = entriesByLevel.get(level);
    if (existing && existing !== entry) {
      throw new Error(`Knowledge scope contains multiple ${level} entries`);
    }
    entriesByLevel.set(level, entry);
  }
  if (entriesByLevel.size === 0) {
    throw new Error('Knowledge scope cannot be empty');
  }
  if (entriesByLevel.has('thread') && (!entriesByLevel.has('resource') || !entriesByLevel.has('org'))) {
    throw new Error('Thread knowledge scope requires resource and org ancestors');
  }
  if (entriesByLevel.has('resource') && !entriesByLevel.has('org')) {
    throw new Error('Resource knowledge scope requires an org ancestor');
  }

  const unique = [...new Set(scope)];
  unique.sort((a, b) => {
    const aLevel = a.slice(0, a.indexOf(':')) as KnowledgeScopeLevel;
    const bLevel = b.slice(0, b.indexOf(':')) as KnowledgeScopeLevel;
    const aOrder = SCOPE_ORDER[aLevel] ?? Number.MAX_SAFE_INTEGER;
    const bOrder = SCOPE_ORDER[bLevel] ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder || a.localeCompare(b);
  });
  return unique;
}

export function knowledgeScopeKey(scope: KnowledgeScope): string {
  return canonicalizeKnowledgeScope(scope).join('\u001f');
}

export function isKnowledgeScopeVisible(recordScope: KnowledgeScope, queryScope: KnowledgeScope): boolean {
  const available = new Set(queryScope);
  return recordScope.every(entry => available.has(entry));
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
 * Maximum length of {@link KnowledgeNode.description}, counted in UTF-16 code units.
 *
 * `description` is a concise synopsis rendered into graph and list payloads, potentially across
 * hundreds of nodes at once, so the bound belongs to the storage contract rather than to any one
 * writer: every adapter enforces it in `createNode` and `updateNode` regardless of which tool
 * performs the write. Long-form detail stays in {@link KnowledgeNode.content}.
 *
 * @experimental
 */
export const MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH = 400;

/**
 * Rejects an over-long node description before any write occurs, so an oversized update leaves the
 * existing node untouched and does not increment its version.
 *
 * @experimental
 */
export function assertKnowledgeDescriptionWithinBound(description: string | undefined): void {
  if (description === undefined) return;
  if (description.length > MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH) {
    throw new Error(
      `Knowledge node description exceeds the ${MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH} UTF-16 code unit limit`,
    );
  }
}

export function assertKnowledgeScopeWithinCeiling(scope: KnowledgeScope, maxScope?: KnowledgeScopeLevel): void {
  if (!maxScope) return;
  const reservedLevels = scope
    .map(entry => SCOPE_ORDER[entry.slice(0, entry.indexOf(':')) as KnowledgeScopeLevel])
    .filter((value): value is number => value !== undefined);
  const narrowestLevel = reservedLevels.length > 0 ? Math.max(...reservedLevels) : Number.MAX_SAFE_INTEGER;
  if (narrowestLevel < SCOPE_ORDER[maxScope]) {
    throw new Error(`Knowledge scope exceeds ${maxScope} ceiling`);
  }
}

export function assertKnowledgeCeilingRaised(
  currentMaxScope: KnowledgeScopeLevel | undefined,
  maxScope: KnowledgeScopeLevel | undefined,
): void {
  if (currentMaxScope && maxScope && SCOPE_ORDER[maxScope] > SCOPE_ORDER[currentMaxScope]) {
    throw new Error(`Knowledge ceiling cannot be lowered from ${currentMaxScope} to ${maxScope}`);
  }
}

export function parseKnowledgeWikilinks(text: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  let contentStart = -1;

  for (let index = 0; index < text.length - 1; index++) {
    const pair = text.slice(index, index + 2);
    if (pair === '[[') {
      contentStart = index + 2;
      index++;
      continue;
    }
    if (pair !== ']]' || contentStart < 0) continue;

    const name = text.slice(contentStart, index).trim();
    const key = name.toLocaleLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
    contentStart = -1;
    index++;
  }

  return names;
}

function encodeCrockford(value: bigint, length: number): string {
  let encoded = '';
  for (let index = 0; index < length; index++) {
    encoded = CROCKFORD[Number(value & 31n)] + encoded;
    value >>= 5n;
  }
  return encoded;
}

export function createKnowledgeUlid(now = Date.now()): string {
  if (now <= lastUlidTime) {
    now = lastUlidTime;
    lastUlidRandom = (lastUlidRandom + 1n) & ((1n << 80n) - 1n);
  } else {
    lastUlidTime = now;
    lastUlidRandom = BigInt(`0x${randomBytes(10).toString('hex')}`);
  }
  return `${encodeCrockford(BigInt(now), 10)}${encodeCrockford(lastUlidRandom, 16)}`;
}

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

/** @experimental Knowledge APIs are experimental and may change without notice. */
export abstract class KnowledgeStorage extends StorageDomain {
  constructor() {
    super({ component: 'STORAGE', name: 'KNOWLEDGE' });
  }

  abstract createNode(input: CreateKnowledgeNodeInput): Promise<KnowledgeNode>;
  abstract getNode(id: string): Promise<KnowledgeNode | null>;
  abstract getNodeByName(input: { name: string; scope: KnowledgeScope }): Promise<KnowledgeNode | null>;
  abstract resolveNode(input: { name: string; scope: KnowledgeScope }): Promise<KnowledgeNode | null>;
  abstract listNodes(input: ListKnowledgeNodesInput): Promise<KnowledgeNode[]>;
  abstract updateNode(input: UpdateKnowledgeNodeInput): Promise<KnowledgeNode>;
  abstract mergeNodes(input: { sourceId: string; targetId: string; sourceVersion: number }): Promise<KnowledgeNode>;

  abstract appendKnowledge(input: AppendKnowledgeInput): Promise<KnowledgeRecord>;
  abstract getKnowledge(input: { id: string; includeDeleted?: boolean }): Promise<KnowledgeRecord | null>;
  abstract listKnowledgeAbout(input: QueryKnowledgeInput): Promise<QueryKnowledgeOutput>;
  abstract listKnowledgeMentioning(input: QueryKnowledgeInput): Promise<QueryKnowledgeOutput>;
  abstract listKnowledgeRelatedTo(input: QueryKnowledgeInput): Promise<QueryKnowledgeOutput>;
  abstract knowledgeBySource(input: QueryKnowledgeBySourceInput): Promise<QueryKnowledgeOutput>;
  abstract removeKnowledge(input: { id: string; deletedBy: string }): Promise<KnowledgeRecord>;
  abstract restoreKnowledge(input: { id: string }): Promise<KnowledgeRecord>;
  abstract rescopeKnowledge(input: { id: string; scope: KnowledgeScope }): Promise<KnowledgeRecord>;
  abstract raiseKnowledgeCeiling(input: { id: string; maxScope?: KnowledgeScopeLevel }): Promise<KnowledgeRecord>;

  abstract search(input: SearchKnowledgeInput): Promise<SearchKnowledgeResult[]>;
  abstract getCurationCursor(input: { sourceThreadId: string; agent: string }): Promise<KnowledgeCurationCursor | null>;
  abstract advanceCurationCursor(input: {
    sourceThreadId: string;
    agent: string;
    lastKnowledgeId: string;
  }): Promise<KnowledgeCurationCursor>;
  abstract listActivity(input: {
    scope: KnowledgeScope;
    after?: string;
    limit?: number;
  }): Promise<KnowledgeActivityEvent[]>;

  abstract listSemanticOutbox(input?: {
    status?: KnowledgeSemanticOutboxEntry['status'];
    scope?: KnowledgeScope;
    limit?: number;
  }): Promise<KnowledgeSemanticOutboxEntry[]>;
  abstract claimSemanticOutbox(input: ClaimKnowledgeSemanticOutboxInput): Promise<KnowledgeSemanticOutboxEntry[]>;
  abstract completeSemanticOutbox(input: { ids: string[]; workerId: string }): Promise<void>;
  abstract releaseSemanticOutbox(input: { ids: string[]; workerId: string; retryAt?: Date }): Promise<void>;
}
