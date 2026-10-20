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

/** A structural scope node with its address and containing scope nodes. @experimental */
export interface KnowledgeScopeNodeSummary {
  /** UUID of the `isScope` node. */
  id: string;
  /** Canonical structural address of the scope (for example `org:acme` or `features:memory`). */
  address: string;
  name: string;
  kind?: string;
  description?: string;
  /** UUIDs of the scope nodes that contain this scope (membership edges), sorted ascending. */
  parentIds: string[];
}

/** Hard cap on scope nodes returned by one `listScopeNodes` read. */
export const MAX_KNOWLEDGE_SCOPE_NODES = 1000;

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface ListKnowledgeScopeNodesInput {
  /** Only the scope at this address and the scopes beneath it, following membership edges transitively. */
  withinAddress?: string;
  /** Only the scopes at these exact addresses. */
  addresses?: string[];
  /** Only the scope nodes with these UUIDs. Combines with the other filters, so `{ withinAddress, ids: [id] }` checks one scope's membership in a subtree. */
  ids?: string[];
  /** `nextCursor` from the previous page of the same query. */
  cursor?: string;
  /** Page size, from 1 to `MAX_KNOWLEDGE_SCOPE_NODES` (the default). */
  limit?: number;
}

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface ListKnowledgeScopeNodesOutput {
  /** Scope nodes ordered by name, then id, comparing characters by code (case-sensitive, not locale-aware). */
  scopes: KnowledgeScopeNodeSummary[];
  /** Pass back as `cursor` for the next page; `null` when this is the last page. */
  nextCursor: string | null;
}

function knowledgeScopeNodeFilterKey(input: ListKnowledgeScopeNodesInput): string {
  return JSON.stringify([
    input.withinAddress ?? null,
    input.addresses ? [...input.addresses].sort() : null,
    input.ids ? [...input.ids].sort() : null,
  ]);
}

/** Validates the page size and cursor of a `listScopeNodes` query; throws on a cursor from a different query. */
export function parseListKnowledgeScopeNodesInput(input: ListKnowledgeScopeNodesInput = {}): {
  limit: number;
  after: { name: string; id: string } | null;
} {
  const requested = Number.isFinite(input.limit) ? Math.trunc(input.limit!) : MAX_KNOWLEDGE_SCOPE_NODES;
  const limit = Math.min(Math.max(requested, 1), MAX_KNOWLEDGE_SCOPE_NODES);
  if (!input.cursor) return { limit, after: null };
  let value: unknown;
  try {
    value = JSON.parse(decodeURIComponent(input.cursor));
  } catch {
    throw new Error('Invalid Knowledge scope node cursor.');
  }
  const parsed = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  if (
    parsed.version !== 1 ||
    parsed.type !== 'scope' ||
    typeof parsed.name !== 'string' ||
    typeof parsed.id !== 'string' ||
    parsed.filter !== knowledgeScopeNodeFilterKey(input)
  ) {
    throw new Error('Knowledge scope node cursor does not match this query.');
  }
  return { limit, after: { name: parsed.name, id: parsed.id } };
}

/** Builds a page from up to `limit + 1` name/id-ordered scope nodes. */
export function pageKnowledgeScopeNodes(
  rows: KnowledgeScopeNodeSummary[],
  limit: number,
  input: ListKnowledgeScopeNodesInput,
): ListKnowledgeScopeNodesOutput {
  const scopes = rows.slice(0, limit);
  const last = scopes.at(-1);
  const nextCursor =
    rows.length > limit && last
      ? encodeURIComponent(
          JSON.stringify({
            version: 1,
            type: 'scope',
            name: last.name,
            id: last.id,
            filter: knowledgeScopeNodeFilterKey(input),
          }),
        )
      : null;
  return { scopes, nextCursor };
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

/** An importer binding writing on behalf of one source. Claims and ownership are tracked per claimant. */
export interface KnowledgeImportClaimant {
  importerId: string;
  binding: string;
  source: string;
}

/**
 * What one importer binding contributed to a node's memberships or a record. A target's scopes are the
 * union of its claims (plus memberships nobody claims), so one binding never drops another's. `version`
 * is the target's version right after this claimant's last write: a target whose version is above every
 * same-source claim was changed outside the importer.
 */
export interface KnowledgeImportClaim extends KnowledgeImportClaimant {
  targetType: KnowledgeSemanticDocumentType;
  targetId: string;
  scopeIds: KnowledgeScopeIds;
  version: number;
}

/** Import-state key holding one claimant's claim on a target. Claims share the binding's import state. */
export function knowledgeImportClaimKey(targetType: KnowledgeSemanticDocumentType, targetId: string): string {
  return `__mastra_internal/claim/${targetType}/${targetId}`;
}

export function parseKnowledgeImportClaim(state: KnowledgeImportState): KnowledgeImportClaim | null {
  const match = /^__mastra_internal\/claim\/(node|record)\/(.+)$/.exec(state.key);
  if (!match) return null;
  try {
    const value = JSON.parse(state.value) as { source?: unknown; scopeIds?: unknown; version?: unknown };
    if (
      typeof value.source !== 'string' ||
      !Array.isArray(value.scopeIds) ||
      !value.scopeIds.every(id => typeof id === 'string') ||
      !Number.isSafeInteger(value.version)
    ) {
      return null;
    }
    return {
      importerId: state.importerId,
      binding: state.binding,
      source: value.source,
      targetType: match[1] as KnowledgeSemanticDocumentType,
      targetId: match[2]!,
      scopeIds: canonicalizeKnowledgeScopeIds(value.scopeIds as string[]),
      version: Number(value.version),
    };
  } catch {
    return null;
  }
}

export function serializeKnowledgeImportClaim(claim: { source: string; scopeIds: KnowledgeScopeIds; version: number }) {
  return JSON.stringify({
    source: claim.source,
    scopeIds: canonicalizeKnowledgeScopeIds(claim.scopeIds),
    version: claim.version,
  });
}

/**
 * Memberships after one claimant replaces its claim: drop what only it claimed before, add what it
 * claims now, and keep everything other claimants (or no claim at all) hold.
 */
export function reconcileKnowledgeClaimScopes(input: {
  current: KnowledgeScopeIds;
  previous: KnowledgeScopeIds;
  next: KnowledgeScopeIds;
  others: KnowledgeScopeIds;
}): KnowledgeScopeIds {
  const keep = new Set([...input.next, ...input.others]);
  const dropped = new Set(input.previous.filter(id => !keep.has(id)));
  return canonicalizeKnowledgeScopeIds([...input.current.filter(id => !dropped.has(id)), ...input.next]);
}

/**
 * True when no write since this importer's last write: the target's version is the highest claim held by the
 * same importer and source. Sibling bindings of one importer share ownership; another importer that names the
 * same source does not, so it can never take over or rewrite targets this importer created.
 */
export function isKnowledgeTargetImporterOwned(
  targetVersion: number,
  claims: readonly Pick<KnowledgeImportClaim, 'importerId' | 'source' | 'version'>[],
  importer: Pick<KnowledgeImportClaimant, 'importerId' | 'source'>,
): boolean {
  const versions = claims
    .filter(claim => claim.importerId === importer.importerId && claim.source === importer.source)
    .map(claim => claim.version);
  return versions.length > 0 && Math.max(...versions) === targetVersion;
}

/**
 * Version for the scope-less claim a release leaves on a node when no claim from the same importer and source
 * remains, or `null` when one does. While the importer still owned the node, the marker follows the node so a moved
 * or re-added binding can adopt it; after an outside edit it keeps the importer's last version, so the edit is still
 * detected and never becomes importer-owned by being released.
 */
export function knowledgeReleaseMarkerVersion(
  released: { importerId: string; source: string; version: number },
  remaining: readonly { importerId: string; source: string }[],
  versionBefore: number,
  versionAfter: number,
): number | null {
  if (remaining.some(claim => claim.importerId === released.importerId && claim.source === released.source)) {
    return null;
  }
  return released.version === versionBefore ? versionAfter : released.version;
}

export interface SetKnowledgeNodeScopesInput {
  id: string;
  version: number;
  claimant: KnowledgeImportClaimant;
  scopeIds: KnowledgeScopeIds;
  contextScopeId?: string;
  importRunId?: string;
}

export interface ClaimKnowledgeRecordInput {
  id: string;
  version: number;
  claimant: KnowledgeImportClaimant;
  scopeIds: KnowledgeScopeIds;
  contextScopeId?: string;
  importRunId?: string;
}

export interface ReleaseKnowledgeRecordClaimInput {
  id: string;
  version: number;
  claimant: KnowledgeImportClaimant;
  importRunId?: string;
}

export interface ReleaseKnowledgeRecordClaimResult {
  record: KnowledgeRecord;
  deleted: boolean;
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
  /**
   * Opaque scope address. Colon-separated segments do not create hierarchy;
   * declare every relationship through `parentAddresses`.
   *
   * Avoid identity-style addresses such as `org:*`, `resource:*`, and
   * `thread:*` for unrelated structural scopes. They remain distinct unless
   * the full address matches, but clients may present them beside identity
   * scopes with similar names.
   */
  address: string;
  name: string;
  kind?: string;
  metadata?: Record<string, unknown>;
  parentAddresses?: string[];
  grants?: KnowledgeStructureGrant[];
}
export interface KnowledgeStructurePlan {
  scopes: KnowledgeStructureScope[];
  /**
   * Whether scopes that already exist gain newly declared parents and grants. Defaults to true;
   * lazily materialized scopes pass false so they keep the shape they were created with.
   */
  retrofit?: boolean;
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
/**
 * @deprecated Curation cursors were removed. Observation-time curate is the only Knowledge writer and needs no cursor.
 */
export interface KnowledgeCurationCursor {
  sourceThreadId: string;
  agent: string;
  lastKnowledgeId: string;
  updatedAt: Date;
}
export type KnowledgeActivityAction =
  'create' | 'edit' | 'delete' | 'restore' | 'move' | 'merge' | 'promote' | 'demote' | 'stamp' | 'rebind' | 'skip';
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
  /** Durable payload key deleted, with the lease, once the run is terminal. */
  payloadKey?: string;
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
  /** Importer binding to record as claimant of this write, atomically with it. */
  claimant?: KnowledgeImportClaimant;
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
  /** Importer binding to record as claimant of this write, atomically with it. */
  claimant?: KnowledgeImportClaimant;
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
  /** Importer binding to record as claimant of this write, atomically with it. */
  claimant?: KnowledgeImportClaimant;
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
/** Most sources one {@link KnowledgeStorage.listSourcesWithVisibleRecords} call may ask about. */
export const KNOWLEDGE_SOURCE_PROBE_LIMIT = 1000;
export interface KnowledgeSourceProbe {
  source: string;
  /** Extra scope visible for this source only (e.g. a session's own scope), added to the shared `scopeIds`. */
  scopeId?: string;
}
export interface ListKnowledgeSourcesWithVisibleRecordsInput {
  /** Sources to test; at most {@link KNOWLEDGE_SOURCE_PROBE_LIMIT}. */
  sources: KnowledgeSourceProbe[];
  scopeIds: KnowledgeScopeIds;
}
export function assertKnowledgeSourceProbeLimit(sources: unknown[]): void {
  if (sources.length > KNOWLEDGE_SOURCE_PROBE_LIMIT)
    throw new Error(`listSourcesWithVisibleRecords accepts at most ${KNOWLEDGE_SOURCE_PROBE_LIMIT} sources`);
}
/** Most node plus record ids one {@link KnowledgeStorage.listVisibleKnowledgeIds} call may ask about. */
export const KNOWLEDGE_VISIBILITY_PROBE_LIMIT = 1000;
export interface ListVisibleKnowledgeIdsInput {
  nodeIds: string[];
  recordIds: string[];
  scopeIds: KnowledgeScopeIds;
  /** Judge `recordIds` as if they were scoped to these ids instead of their stored scopes; node and mention rules are unchanged. */
  recordScopeIds?: KnowledgeScopeIds;
}
export interface ListVisibleKnowledgeIdsOutput {
  nodeIds: string[];
  recordIds: string[];
  /** Set by adapters that honour `recordScopeIds`. */
  recordScopeIdsApplied?: true;
}
export function assertKnowledgeVisibilityProbeLimit(
  input: Pick<ListVisibleKnowledgeIdsInput, 'nodeIds' | 'recordIds'>,
): void {
  if (input.nodeIds.length + input.recordIds.length > KNOWLEDGE_VISIBILITY_PROBE_LIMIT)
    throw new Error(`listVisibleKnowledgeIds accepts at most ${KNOWLEDGE_VISIBILITY_PROBE_LIMIT} ids`);
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
export class KnowledgeInvisibleRecordError extends Error {
  constructor(nodeId: string, scopeIds: KnowledgeScopeIds) {
    super(`Knowledge record scopes ${scopeIds.join(', ')} would hide the record from every viewer of node ${nodeId}`);
    this.name = 'KnowledgeInvisibleRecordError';
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
/** Canonicalizes a record's scope list; a record with no scopes is unreachable, so use deleteRecord instead. */
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

/**
 * Stored address of a node an importer binding created. Imported identity is per destination: the same provider
 * item bound into two scopes becomes two nodes, so no binding can rewrite another destination's node. The source
 * stays the provider's, so source-wide listings and provenance are unchanged.
 */
export function knowledgeImportNodeAddress(scope: string, address: string): string {
  return JSON.stringify([scope, address]);
}

/** The binding scope and provider address of a stored importer node address, or `null` for any other address. */
export function parseKnowledgeImportNodeAddress(stored: string): { scope: string; address: string } | null {
  if (!stored.startsWith('["')) return null;
  try {
    const value = JSON.parse(stored) as unknown;
    if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && typeof value[1] === 'string') {
      return { scope: value[0], address: value[1] };
    }
  } catch {
    // not an importer address
  }
  return null;
}

/** Suffix that qualifies an importer's own record ids with its binding (FNV-1a, 2 × 32 bits). */
function knowledgeImportRecordTag(input: { importerId: string; binding: string }): string {
  const text = JSON.stringify([input.importerId, canonicalizeKnowledgeImporterBindingKey(input.binding)]);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ text.length;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ code, 0x5bd1e995) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

/**
 * Stored id for a record an importer names with its own id. Two bindings that import the same item store
 * separate records; the importer still sees and passes its own id (see {@link knowledgeImporterRecordId}).
 */
export function knowledgeImportStoredRecordId(input: { importerId: string; binding: string }, id: string): string {
  // Always suffixed, so distinct importer ids never share a stored id, even one that already ends in the suffix.
  return `${id}~${knowledgeImportRecordTag(input)}`;
}

/** The importer's own id for a stored record of this binding, or the stored id when it isn't one. */
export function knowledgeImporterRecordId(input: { importerId: string; binding: string }, storedId: string): string {
  const suffix = `~${knowledgeImportRecordTag(input)}`;
  return storedId.endsWith(suffix) ? storedId.slice(0, -suffix.length) : storedId;
}

export function isKnowledgeScopeVisible(
  recordScopeIds: KnowledgeScopeIds,
  visibleScopeIds: KnowledgeScopeIds,
): boolean {
  const available = new Set(visibleScopeIds);
  return recordScopeIds.some(id => available.has(id));
}

/** Scope nodes are visible through their own identity as well as their direct parent memberships. */
export function isKnowledgeNodeVisible(
  node: Pick<KnowledgeNode, 'id' | 'isScope'>,
  nodeScopeIds: KnowledgeScopeIds,
  visibleScopeIds: KnowledgeScopeIds,
): boolean {
  return (node.isScope && visibleScopeIds.includes(node.id)) || isKnowledgeScopeVisible(nodeScopeIds, visibleScopeIds);
}

/**
 * Rejects a record placement no reader could see. A reader holds a scope plus its parent chain. Storage decides
 * whether the record (its subject node and, for an existing record, every node it mentions) is visible under a
 * chain, judging the record as if it already had the requested scopes. The chains tried are those of the
 * requested scopes, the subject's scopes and, for an existing record, its current scopes, where its mentions
 * were resolved. A missing subject is left to the write, which reports it.
 */
export async function assertKnowledgeRecordScopesVisible(
  storage: KnowledgeStorage,
  input: { node: KnowledgeNodeReference; scopeIds: KnowledgeScopeIds; recordId?: string },
): Promise<void> {
  const nodeId = typeof input.node === 'string' ? input.node : input.node.id;
  const recordScopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
  const node = await storage.getNode(nodeId);
  if (!node || node.deletedAt || recordScopeIds.length === 0) return;
  const record = input.recordId ? await storage.getRecord({ id: input.recordId }) : null;
  const readers = new Set([
    ...recordScopeIds,
    ...(await storage.getNodeScopeIds(nodeId)),
    ...(node.isScope ? [node.id] : []),
    ...(record ? await storage.getRecordScopeIds(record.id) : []),
  ]);
  for (const reader of readers) {
    const chain = await knowledgeScopeChain(storage, reader);
    if (!isKnowledgeScopeVisible(recordScopeIds, chain)) continue;
    const visible = await storage.listVisibleKnowledgeIds({
      nodeIds: [nodeId],
      recordIds: record ? [record.id] : [],
      scopeIds: chain,
      recordScopeIds,
    });
    const sees = record && visible.recordScopeIdsApplied ? visible.recordIds.length > 0 : visible.nodeIds.length > 0;
    if (sees) return;
  }
  throw new KnowledgeInvisibleRecordError(nodeId, recordScopeIds);
}

async function knowledgeScopeChain(storage: KnowledgeStorage, scopeId: string): Promise<KnowledgeScopeIds> {
  const chain = new Set<string>();
  const stack = [scopeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (chain.has(current)) continue;
    chain.add(current);
    stack.push(...(await storage.getNodeScopeIds(current)));
  }
  return canonicalizeKnowledgeScopeIds([...chain]);
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
    lastUlidRandom = globalThis.crypto
      .getRandomValues(new Uint8Array(10))
      .reduce((value, byte) => (value << 8n) | BigInt(byte), 0n);
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

const KNOWLEDGE_CURATION_CURSOR_REMOVED_MESSAGE =
  'Knowledge curation cursors were removed: observation-time curate is the only Knowledge writer and needs no cursor.';

/** @experimental Knowledge APIs are experimental and may change without notice. */
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
  async listScopeAddresses(_input: { after?: string; limit?: number } = {}): Promise<KnowledgeScopeAddress[]> {
    throw new KnowledgeUnsupportedError();
  }
  /** Scope nodes with their addresses, filtered and paged in storage. Use `withinAddress` to stay inside one tenant's subtree. */
  async listScopeNodes(_input?: ListKnowledgeScopeNodesInput): Promise<ListKnowledgeScopeNodesOutput> {
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
  async listImportClaims(_input: {
    targetType: KnowledgeSemanticDocumentType;
    targetId: string;
  }): Promise<KnowledgeImportClaim[]> {
    throw new KnowledgeUnsupportedError();
  }
  /**
   * Replaces one claimant's membership claim on a node, keeping every other claim. Fenced by node version;
   * bumps the node version only when membership changes and never touches its records.
   */
  async setNodeScopes(_input: SetKnowledgeNodeScopesInput): Promise<KnowledgeNode> {
    throw new KnowledgeUnsupportedError();
  }
  /** Adds or replaces one claimant's claim on an existing record; record scopes become the union of claims. */
  async claimRecord(_input: ClaimKnowledgeRecordInput): Promise<KnowledgeRecord> {
    throw new KnowledgeUnsupportedError();
  }
  /** Drops one claimant's record claim; deletes the record once no claim is left. */
  async releaseRecordClaim(_input: ReleaseKnowledgeRecordClaimInput): Promise<ReleaseKnowledgeRecordClaimResult> {
    throw new KnowledgeUnsupportedError();
  }
  /** Drops every claim one importer binding holds, removing only what no other claim keeps. */
  async releaseImportClaims(_input: { importerId: string; binding: string; importRunId?: string }): Promise<void> {
    throw new KnowledgeUnsupportedError();
  }
  async deleteRecordBySource(_input: {
    id: string;
    source: string;
    version: number;
    importRunId?: string;
  }): Promise<KnowledgeRecord> {
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
  async createNodeWithRecord(_input: {
    node: CreateKnowledgeNodeInput;
    record: Omit<CreateKnowledgeRecordInput, 'node'>;
  }): Promise<{ node: KnowledgeNode; record: KnowledgeRecord }> {
    throw new KnowledgeUnsupportedError();
  }
  async replaceNodeRecords(_input: {
    node: UpdateKnowledgeNodeInput;
    record: Omit<CreateKnowledgeRecordInput, 'node'> & { source: string };
    visibilityScopeIds: KnowledgeScopeIds;
  }): Promise<KnowledgeRecord> {
    throw new KnowledgeUnsupportedError();
  }
  async createRecord(_input: CreateKnowledgeRecordInput): Promise<KnowledgeRecord> {
    throw new KnowledgeUnsupportedError();
  }
  async getRecord(_input: { id: string; includeDeleted?: boolean }): Promise<KnowledgeRecord | null> {
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
  /**
   * Returns the sources that own at least one live record visible in `scopeIds` plus that source's own `scopeId`,
   * using the same record visibility rule as every other record read. One bounded query regardless of how many records each source holds.
   */
  async listSourcesWithVisibleRecords(_input: ListKnowledgeSourcesWithVisibleRecordsInput): Promise<string[]> {
    throw new KnowledgeUnsupportedError();
  }
  /**
   * Returns which of the given live nodes and records are visible in `scopeIds`, using the same node and record
   * visibility rules as every other read. One bounded query; ids that are missing, deleted or invisible are omitted.
   */
  async listVisibleKnowledgeIds(_input: ListVisibleKnowledgeIdsInput): Promise<ListVisibleKnowledgeIdsOutput> {
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
    version: number;
    scopeIds: KnowledgeScopeIds;
    importRunId?: string;
    contextScopeId?: string;
  }): Promise<KnowledgeRecord> {
    throw new KnowledgeUnsupportedError();
  }
  async search(_input: SearchKnowledgeInput): Promise<SearchKnowledgeResult[]> {
    throw new KnowledgeUnsupportedError();
  }
  /**
   * @deprecated Curation cursors were removed. Observation-time curate is the only Knowledge writer and needs no
   * cursor. Always throws.
   */
  async getCurationCursor(_input: { sourceThreadId: string; agent: string }): Promise<KnowledgeCurationCursor | null> {
    throw new Error(KNOWLEDGE_CURATION_CURSOR_REMOVED_MESSAGE);
  }
  /**
   * @deprecated Curation cursors were removed. Observation-time curate is the only Knowledge writer and needs no
   * cursor. Always throws.
   */
  async advanceCurationCursor(_input: {
    sourceThreadId: string;
    agent: string;
    lastKnowledgeId: string;
  }): Promise<KnowledgeCurationCursor> {
    throw new Error(KNOWLEDGE_CURATION_CURSOR_REMOVED_MESSAGE);
  }
  /**
   * Drops every Knowledge table, including retired ones, then initializes an empty canonical schema.
   * Leaves all non-Knowledge storage untouched. Use only after `init()` reports an incompatible Knowledge schema.
   */
  async dangerouslyReset(): Promise<void> {
    throw new KnowledgeUnsupportedError();
  }
  async recordImportSkip(_input: {
    targetType: KnowledgeSemanticDocumentType;
    targetId: string;
    contextScopeId: string;
    importRunId: string;
    details: Record<string, unknown>;
  }): Promise<void> {
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
  /** Returns the ids this worker actually completed; ids whose claim expired and moved to another worker are omitted. */
  async completeSemanticOutbox(_input: { ids: string[]; workerId: string }): Promise<string[]> {
    throw new KnowledgeUnsupportedError();
  }
  async releaseSemanticOutbox(_input: { ids: string[]; workerId: string; retryAt?: Date }): Promise<void> {
    throw new KnowledgeUnsupportedError();
  }
}

/**
 * Hierarchical scope entries (`org:<id>`, `resource:<id>`, `thread:<id>`) used by published
 * `@mastra/memory` versions before Knowledge scopes became scope nodes.
 *
 * @deprecated Knowledge scopes are scope-node IDs. Kept only so published `@mastra/memory`
 * versions that import the helpers below still load.
 */
type LegacyKnowledgeScopeLevel = 'org' | 'resource' | 'thread';

const LEGACY_SCOPE_ORDER: Record<LegacyKnowledgeScopeLevel, number> = { org: 0, resource: 1, thread: 2 };

/**
 * Maximum length of a Knowledge node description, counted in UTF-16 code units.
 *
 * @deprecated Kept only so published `@mastra/memory` versions that import it still load.
 */
export const MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH = 400;

/**
 * Knowledge has no record scope ceilings. Never throws.
 *
 * @deprecated No longer enforced. Kept only so published `@mastra/memory` versions that import it still load.
 */
export function assertKnowledgeScopeWithinCeiling(_scope: string[], _maxScope?: LegacyKnowledgeScopeLevel): void {}

/**
 * Knowledge has no record scope ceilings to raise. Never throws.
 *
 * @deprecated No longer enforced. Kept only so published store adapters that import it still load.
 */
export function assertKnowledgeCeilingRaised(
  _currentMaxScope: LegacyKnowledgeScopeLevel | undefined,
  _maxScope: LegacyKnowledgeScopeLevel | undefined,
): void {}

/**
 * @deprecated Knowledge scopes are scope-node IDs; use {@link canonicalizeKnowledgeScopeIds}. Kept only
 * so published `@mastra/memory` versions that import it still load.
 */
export function canonicalizeKnowledgeScope(scope: string[]): string[] {
  const entriesByLevel = new Map<LegacyKnowledgeScopeLevel, string>();
  for (const entry of scope) {
    const separator = entry.indexOf(':');
    const level = entry.slice(0, separator) as LegacyKnowledgeScopeLevel;
    const id = entry.slice(separator + 1);
    const isUncuratedCompanion =
      (level === 'resource' || level === 'thread') && id.endsWith(':uncurated') && id.length > ':uncurated'.length;
    if (separator <= 0 || !id || id.includes('\u001f') || LEGACY_SCOPE_ORDER[level] === undefined) {
      throw new Error(`Invalid knowledge scope entry: ${entry}`);
    }
    if (isUncuratedCompanion) continue;
    const existing = entriesByLevel.get(level);
    if (existing && existing !== entry) {
      throw new Error(`Knowledge scope contains multiple ${level} entries`);
    }
    entriesByLevel.set(level, entry);
  }
  if (scope.length === 0) {
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
    const aOrder = LEGACY_SCOPE_ORDER[a.slice(0, a.indexOf(':')) as LegacyKnowledgeScopeLevel];
    const bOrder = LEGACY_SCOPE_ORDER[b.slice(0, b.indexOf(':')) as LegacyKnowledgeScopeLevel];
    return aOrder - bOrder || a.localeCompare(b);
  });
  return unique;
}

/**
 * @deprecated Knowledge scopes are scope-node IDs; use {@link knowledgeScopeIdsKey}. Kept only so
 * published `@mastra/memory` versions that import it still load.
 */
export function knowledgeScopeKey(scope: string[]): string {
  return canonicalizeKnowledgeScope(scope).join('\u001f');
}

/**
 * @deprecated Knowledge scopes are scope-node IDs. Kept only so published `@mastra/memory` versions
 * that import it still load.
 */
export function expandKnowledgeScope(context: string[], level: LegacyKnowledgeScopeLevel): string[] {
  const maxOrder = LEGACY_SCOPE_ORDER[level];
  const expanded = canonicalizeKnowledgeScope(context).filter(
    entry => LEGACY_SCOPE_ORDER[entry.slice(0, entry.indexOf(':')) as LegacyKnowledgeScopeLevel] <= maxOrder,
  );
  if (!expanded.some(entry => entry.startsWith(`${level}:`))) {
    throw new Error(`Cannot expand knowledge scope to ${level}: context has no ${level} entry`);
  }
  return expanded;
}
