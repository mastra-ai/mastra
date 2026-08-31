import { randomBytes } from 'node:crypto';

import { StorageDomain } from '../base';

export type KnowledgeScopeIds = string[];
export type KnowledgeSemanticDocumentType = 'node' | 'record';
export type KnowledgeSemanticOperation = 'upsert' | 'delete';
export const KNOWLEDGE_STORAGE_CONTRACT_VERSION = 1 as const;
export const KNOWLEDGE_STORAGE_SCHEMA_VERSION = 1 as const;

export interface KnowledgeStorageCapabilities {
  contractVersion: typeof KNOWLEDGE_STORAGE_CONTRACT_VERSION;
  schemaVersion: typeof KNOWLEDGE_STORAGE_SCHEMA_VERSION | null;
  supported: boolean;
}

export type KnowledgeConcreteRole = 'readonly' | 'append' | 'edit' | 'owner';
export type KnowledgeGrantRole = KnowledgeConcreteRole | 'mirror';
export interface KnowledgeScopeGrant {
  scopeNodeId: string;
  scopeRefId: string;
  role: KnowledgeGrantRole;
  canSuggest?: boolean;
}
export interface KnowledgeNodeScope {
  nodeId: string;
  scopeNodeId: string;
  addedAt: Date;
}
export interface KnowledgeRecordScope {
  recordId: string;
  scopeNodeId: string;
  addedAt: Date;
}
export interface KnowledgeScopeAddress {
  address: string;
  scopeNodeId: string;
}
export interface KnowledgeNodeAddress {
  source: string;
  address: string;
  nodeId: string;
}
export interface DeleteKnowledgeNodeAddressResult {
  node: KnowledgeNode;
  deleted: boolean;
}

export interface KnowledgeImporterBinding {
  source: string;
  scope: string;
}

export interface KnowledgeImportState {
  importerId: string;
  binding: string;
  key: string;
  value: string;
}
export type KnowledgeImportKind = 'static' | 'agentic';
export type KnowledgeImportTriggerKind = 'cron' | 'webhook' | 'programmatic';
export type KnowledgeImportRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'interrupted';
export interface KnowledgeImportRun {
  id: string;
  importerId: string;
  binding: string;
  importKind: KnowledgeImportKind;
  triggerKind: KnowledgeImportTriggerKind;
  status: KnowledgeImportRunStatus;
  error?: string;
  transcriptThreadId?: string;
  traceId?: string;
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export type KnowledgeProposalStatus = 'pending' | 'approved' | 'rejected' | 'conflicted';
export interface KnowledgeProposal {
  id: string;
  targetType: 'node' | 'record';
  targetId: string;
  expectedVersion: number;
  operation: string;
  payload: Record<string, unknown>;
  scopeIds: string[];
  status: KnowledgeProposalStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeNode {
  id: string;
  type: 'node';
  name: string;
  kind?: string;
  isScope: boolean;
  metadata?: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  deletedBy?: string;
}

export type KnowledgeNodeReference = KnowledgeNode | string;

export interface KnowledgeRecord {
  id: string;
  nodeId: string;
  text: string;
  metadata?: Record<string, unknown>;
  source?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  deletedBy?: string;
}

export interface KnowledgeStructureGrant {
  scopeRefAddress: string;
  role: KnowledgeGrantRole;
  canSuggest?: boolean;
}
export interface KnowledgeStructureScope {
  address: string;
  name: string;
  kind?: string;
  metadata?: Record<string, unknown>;
  parentAddresses?: string[];
  grants?: KnowledgeStructureGrant[];
}
export interface KnowledgeStructurePlan {
  scopes: KnowledgeStructureScope[];
}
export interface KnowledgeStructureReconcileResult {
  scopes: Record<string, string>;
  createdScopeIds: string[];
  deletedScopeAddresses?: string[];
  changed: boolean;
  accessEpoch: number;
}

export interface KnowledgeMention {
  recordId: string;
  targetNodeId: string;
}
export interface KnowledgeCurationCursor {
  sourceThreadId: string;
  agent: string;
  lastKnowledgeId: string;
  updatedAt: Date;
}
export type KnowledgeActivityAction =
  | 'create'
  | 'edit'
  | 'delete'
  | 'restore'
  | 'move'
  | 'merge'
  | 'promote'
  | 'demote'
  | 'stamp'
  | 'rebind';
export interface KnowledgeActivityEvent {
  id: string;
  action: KnowledgeActivityAction;
  targetType: KnowledgeSemanticDocumentType;
  targetId: string;
  contextScopeId?: string;
  importRunId?: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateKnowledgeImportRunInput {
  id?: string;
  importerId: string;
  binding: string;
  importKind: KnowledgeImportKind;
  triggerKind: KnowledgeImportTriggerKind;
  status?: 'queued' | 'skipped';
  queuedAt?: Date;
}
/** @internal Durable enqueue payload written atomically with its run header. */
export interface EnqueueKnowledgeImportRunInput extends CreateKnowledgeImportRunInput {
  id: string;
  payloadKey: string;
  payload: string;
  skipIfActiveCron?: boolean;
}

/** @internal Durable queue claim scoped to one importer binding. */
export interface ClaimKnowledgeImportRunInput {
  importerId: string;
  binding: string;
  workerId: string;
  leaseKey: string;
  timestamp?: Date;
}

/** @internal Heartbeat for an owned running import. */
export interface HeartbeatKnowledgeImportRunInput {
  id: string;
  importerId: string;
  binding: string;
  workerId: string;
  leaseKey: string;
  timestamp?: Date;
  transcriptThreadId?: string;
}

/** @internal Atomically commit importer state and finalize an owned running import. */
export interface FinalizeKnowledgeImportRunInput {
  id: string;
  importerId: string;
  binding: string;
  workerId: string;
  leaseKey: string;
  status: 'succeeded' | 'failed';
  error?: string;
  transcriptThreadId?: string;
  state: Array<{ key: string; value: string }>;
  timestamp?: Date;
}

/** @internal Requeue a stale running import without losing its durable payload. */
export interface RecoverKnowledgeImportRunInput {
  id: string;
  replacementId: string;
  payloadKey: string;
  replacementPayloadKey: string;
  leaseKey: string;
  staleBefore: Date;
  queuedAt?: Date;
}

const MAX_KNOWLEDGE_IMPORT_ERROR_LENGTH = 1_000;
export function sanitizeKnowledgeImportError(error: unknown): string {
  const value =
    error instanceof Error ? `${error.name}: ${error.message}` : typeof error === 'string' ? error : 'Import failed';
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, MAX_KNOWLEDGE_IMPORT_ERROR_LENGTH);
}
export interface UpdateKnowledgeImportRunInput {
  id: string;
  status: Exclude<KnowledgeImportRunStatus, 'queued'>;
  error?: string;
  transcriptThreadId?: string;
  traceId?: string;
  timestamp?: Date;
}
export interface ListKnowledgeImportRunsInput {
  importerId?: string;
  binding?: string;
  status?: KnowledgeImportRunStatus;
  after?: string;
  limit?: number;
}
export interface ListKnowledgeImportRunsOutput {
  runs: KnowledgeImportRun[];
  nextCursor?: string;
}

export interface KnowledgeSemanticOutboxEntry {
  id: string;
  idempotencyKey: string;
  documentId: string;
  documentType: KnowledgeSemanticDocumentType;
  operation: KnowledgeSemanticOperation;
  scopeIds: string[];
  status: 'pending' | 'processing' | 'completed';
  attempts: number;
  availableAt: Date;
  claimedAt?: Date;
  claimedBy?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface CreateKnowledgeNodeInput {
  id?: string;
  importRunId?: string;
  name: string;
  kind?: string;
  isScope?: boolean;
  metadata?: Record<string, unknown>;
  scopeIds: KnowledgeScopeIds;
  contextScopeId?: string;
}
export interface UpdateKnowledgeNodeInput {
  id: string;
  version: number;
  importRunId?: string;
  name?: string;
  kind?: string;
  isScope?: boolean;
  metadata?: Record<string, unknown>;
  scopeIds?: KnowledgeScopeIds;
  contextScopeId?: string;
}
export interface CreateKnowledgeRecordInput {
  id?: string;
  importRunId?: string;
  node: KnowledgeNodeReference;
  text: string;
  metadata?: Record<string, unknown>;
  source?: string;
  scopeIds: KnowledgeScopeIds;
  resolutionScopeIds?: KnowledgeScopeIds;
  contextScopeId?: string;
}
export interface ListKnowledgeNodesInput {
  scopeIds: KnowledgeScopeIds;
  namePrefix?: string;
  kind?: string;
  isScope?: boolean;
  cursor?: string;
  limit?: number;
}
export interface KnowledgeNodeCursor {
  updatedAt: Date;
  name: string;
  id: string;
}
export function createKnowledgeNodeCursor(
  node: Pick<KnowledgeNode, 'updatedAt' | 'name' | 'id'>,
  filters: { namePrefix?: string; kind?: string; isScope?: boolean } = {},
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
      isScope: filters.isScope ?? null,
    }),
  );
}
export function parseKnowledgeNodeCursor(
  cursor: string,
  filters: { namePrefix?: string; kind?: string; isScope?: boolean },
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
    parsed.isScope !== (filters.isScope ?? null)
  ) {
    throw new Error('Knowledge node cursor does not match the active browse filters.');
  }
  return { updatedAt, name: parsed.name, id: parsed.id };
}

export interface QueryKnowledgeRecordsInput {
  node: KnowledgeNodeReference;
  scopeIds: KnowledgeScopeIds;
  membershipScopeIds?: KnowledgeScopeIds;
  after?: string;
  limit?: number;
  includeDeleted?: boolean;
}
export interface QueryKnowledgeRecordsOutput {
  records: KnowledgeRecord[];
  nextCursor?: string;
}
export interface QueryKnowledgeRecordsBySourceInput {
  source: string;
  scopeIds: KnowledgeScopeIds;
  after?: string;
  limit?: number;
  includeDeleted?: boolean;
}
export interface SearchKnowledgeInput {
  query: string;
  scopeIds: KnowledgeScopeIds;
  limit?: number;
}
export interface SearchKnowledgeResult {
  type: KnowledgeSemanticDocumentType;
  id: string;
  recordId: string;
  name: string;
  text: string;
  scopeIds: KnowledgeScopeIds;
}
export interface ClaimKnowledgeSemanticOutboxInput {
  workerId: string;
  limit?: number;
  now?: Date;
  claimTimeoutMs?: number;
  scopeIds?: KnowledgeScopeIds;
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
export class KnowledgeUnsupportedError extends Error {
  constructor(adapter?: string) {
    super(`${adapter ?? 'This storage adapter'} does not support Knowledge.`);
    this.name = 'KnowledgeUnsupportedError';
  }
}
export class KnowledgeSchemaError extends Error {
  constructor(message: string) {
    super(`${message} Reset the Knowledge domain explicitly before retrying.`);
    this.name = 'KnowledgeSchemaError';
  }
}
const KNOWLEDGE_NODE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Canonicalizes a node UUID. */
export function canonicalizeKnowledgeNodeId(id: string): string {
  const normalized = id.trim().toLowerCase();
  if (!KNOWLEDGE_NODE_ID_PATTERN.test(normalized)) throw new Error('Knowledge node IDs must be UUIDs.');
  return normalized;
}

/** Canonicalizes a set of scope-node UUIDs. */
export function canonicalizeKnowledgeScopeIds(scopeIds: KnowledgeScopeIds): KnowledgeScopeIds {
  return [...new Set(scopeIds.map(canonicalizeKnowledgeNodeId))].sort();
}
export function knowledgeScopeIdsKey(scopeIds: KnowledgeScopeIds): string {
  return canonicalizeKnowledgeScopeIds(scopeIds).join('\u001f');
}

export function knowledgeImporterBindingKey(binding: KnowledgeImporterBinding): string {
  const source = binding.source?.trim();
  const scope = binding.scope?.trim();
  if (!source) throw new Error('Knowledge importer binding source is required');
  if (!scope) throw new Error('Knowledge importer binding scope is required');
  return JSON.stringify([source, scope]);
}

export function parseKnowledgeImporterBindingKey(binding: string): KnowledgeImporterBinding {
  try {
    const parsed: unknown = JSON.parse(binding);
    if (!Array.isArray(parsed) || parsed.length !== 2 || parsed.some(value => typeof value !== 'string')) {
      throw new Error();
    }
    const canonical = knowledgeImporterBindingKey({ source: parsed[0], scope: parsed[1] });
    const [source, scope] = JSON.parse(canonical) as [string, string];
    return { source, scope };
  } catch {
    throw new Error('Knowledge importer binding must encode a [source, scope] tuple');
  }
}

export function canonicalizeKnowledgeImporterBindingKey(binding: string): string {
  return knowledgeImporterBindingKey(parseKnowledgeImporterBindingKey(binding));
}

export function isKnowledgeScopeVisible(
  recordScopeIds: KnowledgeScopeIds,
  visibleScopeIds: KnowledgeScopeIds,
): boolean {
  const available = new Set(visibleScopeIds);
  return recordScopeIds.some(id => available.has(id));
}

export function areKnowledgeScopesVisible(
  recordScopeIds: KnowledgeScopeIds,
  visibleScopeIds: KnowledgeScopeIds,
): boolean {
  const available = new Set(visibleScopeIds);
  return recordScopeIds.length > 0 && recordScopeIds.every(id => available.has(id));
}

export function isKnowledgeNodeVisible(
  _node: Pick<KnowledgeNode, 'id' | 'isScope'>,
  nodeScopeIds: KnowledgeScopeIds,
  visibleScopeIds: KnowledgeScopeIds,
): boolean {
  return isKnowledgeScopeVisible(nodeScopeIds, visibleScopeIds);
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

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let lastUlidTime = -1;
let lastUlidRandom = 0n;
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

export abstract class KnowledgeStorage extends StorageDomain {
  readonly #storageIsolationKey: unknown;
  constructor(config: { storageIsolationKey?: unknown } = {}) {
    super({ component: 'STORAGE', name: 'KNOWLEDGE' });
    this.#storageIsolationKey = config.storageIsolationKey ?? this;
  }
  getStorageIsolationKey(): unknown {
    return this.#storageIsolationKey;
  }
  getCapabilities(): KnowledgeStorageCapabilities {
    return {
      contractVersion: KNOWLEDGE_STORAGE_CONTRACT_VERSION,
      schemaVersion: null,
      supported: false,
    };
  }
  async reconcileStructure(_plan: KnowledgeStructurePlan): Promise<KnowledgeStructureReconcileResult> {
    throw new KnowledgeUnsupportedError();
  }
  async getAccessEpoch(): Promise<number> {
    throw new KnowledgeUnsupportedError();
  }
  async listScopeGrants(): Promise<KnowledgeScopeGrant[]> {
    throw new KnowledgeUnsupportedError();
  }
  async getImportState(_input: {
    importerId: string;
    binding: string;
    key: string;
  }): Promise<KnowledgeImportState | null> {
    throw new KnowledgeUnsupportedError();
  }
  async setImportState(_input: {
    importerId: string;
    binding: string;
    key: string;
    value: string;
  }): Promise<KnowledgeImportState> {
    throw new KnowledgeUnsupportedError();
  }
  async createImportRun(_input: CreateKnowledgeImportRunInput): Promise<KnowledgeImportRun> {
    throw new KnowledgeUnsupportedError();
  }
  async enqueueImportRun(_input: EnqueueKnowledgeImportRunInput): Promise<KnowledgeImportRun> {
    throw new Error('This Knowledge storage adapter does not support durable import queues.');
  }

  async claimImportRun(_input: ClaimKnowledgeImportRunInput): Promise<KnowledgeImportRun | null> {
    throw new Error('This Knowledge storage adapter does not support durable import queues.');
  }

  async heartbeatImportRun(_input: HeartbeatKnowledgeImportRunInput): Promise<boolean> {
    throw new Error('This Knowledge storage adapter does not support durable import queues.');
  }

  async finalizeImportRun(_input: FinalizeKnowledgeImportRunInput): Promise<KnowledgeImportRun | null> {
    throw new Error('This Knowledge storage adapter does not support durable import queues.');
  }

  async recoverImportRun(_input: RecoverKnowledgeImportRunInput): Promise<KnowledgeImportRun | null> {
    throw new Error('This Knowledge storage adapter does not support durable import queues.');
  }

  async getImportRun(_id: string): Promise<KnowledgeImportRun | null> {
    throw new KnowledgeUnsupportedError();
  }
  async listImportRuns(_input: ListKnowledgeImportRunsInput = {}): Promise<ListKnowledgeImportRunsOutput> {
    throw new KnowledgeUnsupportedError();
  }
  async updateImportRun(_input: UpdateKnowledgeImportRunInput): Promise<KnowledgeImportRun> {
    throw new KnowledgeUnsupportedError();
  }
  async getScopeAddress(_address: string): Promise<KnowledgeScopeAddress | null> {
    throw new KnowledgeUnsupportedError();
  }
  async getNodeAddress(_input: { source: string; address: string }): Promise<KnowledgeNodeAddress | null> {
    throw new KnowledgeUnsupportedError();
  }
  async listNodeAddresses(_input: { source: string }): Promise<KnowledgeNodeAddress[]> {
    throw new KnowledgeUnsupportedError();
  }
  async setNodeAddress(_input: KnowledgeNodeAddress): Promise<KnowledgeNodeAddress> {
    throw new KnowledgeUnsupportedError();
  }
  async createNodeWithAddress(_input: {
    source: string;
    address: string;
    node: CreateKnowledgeNodeInput;
  }): Promise<KnowledgeNode> {
    throw new KnowledgeUnsupportedError();
  }
  async removeNodeAddress(_input: { source: string; address: string; nodeId: string }): Promise<void> {
    throw new KnowledgeUnsupportedError();
  }
  async rebindNodeAddress(_input: {
    source: string;
    address: string;
    newAddress: string;
    nodeId: string;
    importRunId?: string;
  }): Promise<KnowledgeNodeAddress> {
    throw new KnowledgeUnsupportedError();
  }
  async deleteNodeByAddress(_input: {
    source: string;
    address: string;
    scopeId: string;
    importRunId?: string;
  }): Promise<DeleteKnowledgeNodeAddressResult> {
    throw new KnowledgeUnsupportedError();
  }
  async deleteRecordBySource(_input: { id: string; source: string; importRunId?: string }): Promise<KnowledgeRecord> {
    throw new KnowledgeUnsupportedError();
  }

  async createNode(_input: CreateKnowledgeNodeInput): Promise<KnowledgeNode> {
    throw new KnowledgeUnsupportedError();
  }
  async getNode(_id: string): Promise<KnowledgeNode | null> {
    throw new KnowledgeUnsupportedError();
  }
  async getNodeScopeIds(_nodeId: string): Promise<KnowledgeScopeIds> {
    throw new KnowledgeUnsupportedError();
  }
  async getNodeByName(_input: { name: string; scopeIds: KnowledgeScopeIds }): Promise<KnowledgeNode | null> {
    throw new KnowledgeUnsupportedError();
  }
  async resolveNode(_input: { name: string; scopeIds: KnowledgeScopeIds }): Promise<KnowledgeNode | null> {
    throw new KnowledgeUnsupportedError();
  }
  async listNodes(_input: ListKnowledgeNodesInput): Promise<KnowledgeNode[]> {
    throw new KnowledgeUnsupportedError();
  }
  async updateNode(_input: UpdateKnowledgeNodeInput): Promise<KnowledgeNode> {
    throw new KnowledgeUnsupportedError();
  }
  async mergeNodes(_input: {
    sourceId: string;
    targetId: string;
    sourceVersion: number;
    importRunId?: string;
  }): Promise<KnowledgeNode> {
    throw new KnowledgeUnsupportedError();
  }
  async createRecord(_input: CreateKnowledgeRecordInput): Promise<KnowledgeRecord> {
    throw new KnowledgeUnsupportedError();
  }
  async getRecord(_input: { id: string; includeDeleted?: boolean }): Promise<KnowledgeRecord | null> {
    throw new KnowledgeUnsupportedError();
  }
  async getVisibleRecord(_input: {
    id: string;
    scopeIds: KnowledgeScopeIds;
    includeDeleted?: boolean;
  }): Promise<KnowledgeRecord | null> {
    throw new KnowledgeUnsupportedError();
  }
  async getRecordScopeIds(_recordId: string): Promise<KnowledgeScopeIds> {
    throw new KnowledgeUnsupportedError();
  }
  async listRecords(_input: QueryKnowledgeRecordsInput): Promise<QueryKnowledgeRecordsOutput> {
    throw new KnowledgeUnsupportedError();
  }
  async listMentioningRecords(_input: QueryKnowledgeRecordsInput): Promise<QueryKnowledgeRecordsOutput> {
    throw new KnowledgeUnsupportedError();
  }
  async listRelatedRecords(_input: QueryKnowledgeRecordsInput): Promise<QueryKnowledgeRecordsOutput> {
    throw new KnowledgeUnsupportedError();
  }
  async listRecordsBySource(_input: QueryKnowledgeRecordsBySourceInput): Promise<QueryKnowledgeRecordsOutput> {
    throw new KnowledgeUnsupportedError();
  }
  async deleteRecord(_input: { id: string; deletedBy: string; importRunId?: string }): Promise<KnowledgeRecord> {
    throw new KnowledgeUnsupportedError();
  }
  async restoreRecord(_input: { id: string; importRunId?: string }): Promise<KnowledgeRecord> {
    throw new KnowledgeUnsupportedError();
  }
  async setRecordScopes(_input: {
    id: string;
    scopeIds: KnowledgeScopeIds;
    importRunId?: string;
    contextScopeId?: string;
  }): Promise<KnowledgeRecord> {
    throw new KnowledgeUnsupportedError();
  }
  async search(_input: SearchKnowledgeInput): Promise<SearchKnowledgeResult[]> {
    throw new KnowledgeUnsupportedError();
  }
  async getCurationCursor(_input: { sourceThreadId: string; agent: string }): Promise<KnowledgeCurationCursor | null> {
    throw new KnowledgeUnsupportedError();
  }
  async advanceCurationCursor(_input: {
    sourceThreadId: string;
    agent: string;
    lastKnowledgeId: string;
  }): Promise<KnowledgeCurationCursor> {
    throw new KnowledgeUnsupportedError();
  }
  async listActivity(_input: {
    scopeIds: KnowledgeScopeIds;
    importRunId?: string;
    after?: string;
    limit?: number;
  }): Promise<KnowledgeActivityEvent[]> {
    throw new KnowledgeUnsupportedError();
  }
  async listSemanticOutbox(_input?: {
    status?: KnowledgeSemanticOutboxEntry['status'];
    scopeIds?: KnowledgeScopeIds;
    limit?: number;
  }): Promise<KnowledgeSemanticOutboxEntry[]> {
    throw new KnowledgeUnsupportedError();
  }
  async claimSemanticOutbox(_input: ClaimKnowledgeSemanticOutboxInput): Promise<KnowledgeSemanticOutboxEntry[]> {
    throw new KnowledgeUnsupportedError();
  }
  async completeSemanticOutbox(_input: { ids: string[]; workerId: string }): Promise<void> {
    throw new KnowledgeUnsupportedError();
  }
  async releaseSemanticOutbox(_input: { ids: string[]; workerId: string; retryAt?: Date }): Promise<void> {
    throw new KnowledgeUnsupportedError();
  }
}
