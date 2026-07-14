import { randomBytes } from 'node:crypto';

import { StorageDomain } from '../base';

export type KnowledgeScope = string[];
export type KnowledgeScopeLevel = 'org' | 'resource' | 'thread';
export type KnowledgeRecordType = 'entity' | 'page';
export type KnowledgeSemanticDocumentType = KnowledgeRecordType | 'fact';
export type KnowledgeSemanticOperation = 'upsert' | 'delete';
export type KnowledgeActivityAction =
  | 'entity-created'
  | 'entity-updated'
  | 'entity-merged'
  | 'page-created'
  | 'page-updated'
  | 'fact-created'
  | 'fact-deleted'
  | 'fact-restored'
  | 'fact-rescoped';

export interface KnowledgeRecordBase {
  id: string;
  name: string;
  scope: KnowledgeScope;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeEntity extends KnowledgeRecordBase {
  type: 'entity';
  kind: string;
  mergedInto?: string;
}

export interface KnowledgePage extends KnowledgeRecordBase {
  type: 'page';
  body: string;
}

export type KnowledgeRecord = KnowledgeEntity | KnowledgePage;

export interface KnowledgeFact {
  id: string;
  parentEntityId: string;
  text: string;
  scope: KnowledgeScope;
  sourceThreadId: string;
  capturedAt: Date;
  when?: Date;
  maxScope?: KnowledgeScopeLevel;
  deletedAt?: Date;
  deletedBy?: string;
}

export interface KnowledgeMention {
  sourceType: 'fact' | 'page';
  sourceId: string;
  recordId: string;
}

export interface KnowledgeCurationCursor {
  sourceThreadId: string;
  agent: string;
  lastFactId: string;
  updatedAt: Date;
}

export interface KnowledgeActivityEvent {
  id: string;
  action: KnowledgeActivityAction;
  recordType: KnowledgeSemanticDocumentType;
  recordId: string;
  scope: KnowledgeScope;
  sourceThreadId?: string;
  createdAt: Date;
}

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

export interface CreateKnowledgeEntityInput {
  id?: string;
  name: string;
  kind: string;
  scope: KnowledgeScope;
}

export interface UpdateKnowledgeEntityInput {
  id: string;
  version: number;
  name?: string;
  kind?: string;
  scope?: KnowledgeScope;
}

export interface CreateKnowledgePageInput {
  id?: string;
  name: string;
  body: string;
  scope: KnowledgeScope;
}

export interface UpdateKnowledgePageInput {
  id: string;
  version: number;
  name?: string;
  body?: string;
  scope?: KnowledgeScope;
  resolutionScope?: KnowledgeScope;
}

export interface AppendKnowledgeFactInput {
  id?: string;
  parentEntityId: string;
  text: string;
  scope: KnowledgeScope;
  sourceThreadId: string;
  when?: Date;
  maxScope?: KnowledgeScopeLevel;
  resolutionScope: KnowledgeScope;
  defaultScope: KnowledgeScope;
}

export interface ListKnowledgeRecordsInput {
  scope: KnowledgeScope;
  namePrefix?: string;
  kind?: string;
  limit?: number;
}

export interface ListKnowledgeFactsInput {
  entityId: string;
  scope: KnowledgeScope;
  after?: string;
  limit?: number;
  includeDeleted?: boolean;
}

export interface ListKnowledgeFactsOutput {
  facts: KnowledgeFact[];
  nextCursor?: string;
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
    if (separator <= 0 || !id || SCOPE_ORDER[level] === undefined) {
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

export function parseKnowledgeWikilinks(text: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(/\[\[\s*([^\[\]]+?)\s*\]\]/g)) {
    const name = match[1]!.trim();
    const key = name.toLocaleLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
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
  if (now === lastUlidTime) {
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

export abstract class KnowledgeStorage extends StorageDomain {
  constructor() {
    super({ component: 'STORAGE', name: 'KNOWLEDGE' });
  }

  abstract createEntity(input: CreateKnowledgeEntityInput): Promise<KnowledgeEntity>;
  abstract getEntity(id: string): Promise<KnowledgeEntity | null>;
  abstract getEntityByName(input: { name: string; scope: KnowledgeScope }): Promise<KnowledgeEntity | null>;
  abstract resolveEntity(input: { name: string; scope: KnowledgeScope }): Promise<KnowledgeEntity | null>;
  abstract listEntities(input: ListKnowledgeRecordsInput): Promise<KnowledgeEntity[]>;
  abstract updateEntity(input: UpdateKnowledgeEntityInput): Promise<KnowledgeEntity>;
  abstract mergeEntities(input: {
    sourceId: string;
    targetId: string;
    sourceVersion: number;
  }): Promise<KnowledgeEntity>;

  abstract createPage(input: CreateKnowledgePageInput): Promise<KnowledgePage>;
  abstract getPage(id: string): Promise<KnowledgePage | null>;
  abstract getPageByName(input: { name: string; scope: KnowledgeScope }): Promise<KnowledgePage | null>;
  abstract listPages(input: Omit<ListKnowledgeRecordsInput, 'kind'>): Promise<KnowledgePage[]>;
  abstract updatePage(input: UpdateKnowledgePageInput): Promise<KnowledgePage>;

  abstract appendFact(input: AppendKnowledgeFactInput): Promise<KnowledgeFact>;
  abstract getFact(input: { id: string; includeDeleted?: boolean }): Promise<KnowledgeFact | null>;
  abstract factsAbout(input: ListKnowledgeFactsInput): Promise<ListKnowledgeFactsOutput>;
  abstract factsTouching(input: ListKnowledgeFactsInput): Promise<ListKnowledgeFactsOutput>;
  abstract removeFact(input: { id: string; deletedBy: string }): Promise<KnowledgeFact>;
  abstract restoreFact(input: { id: string }): Promise<KnowledgeFact>;
  abstract rescopeFact(input: { id: string; scope: KnowledgeScope }): Promise<KnowledgeFact>;
  abstract raiseCeiling(input: { id: string; maxScope?: KnowledgeScopeLevel }): Promise<KnowledgeFact>;

  abstract search(input: SearchKnowledgeInput): Promise<SearchKnowledgeResult[]>;
  abstract getCurationCursor(input: { sourceThreadId: string; agent: string }): Promise<KnowledgeCurationCursor | null>;
  abstract advanceCurationCursor(input: {
    sourceThreadId: string;
    agent: string;
    lastFactId: string;
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
