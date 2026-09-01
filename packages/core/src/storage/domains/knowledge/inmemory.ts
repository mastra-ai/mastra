import type { InMemoryDB } from '../inmemory-db';
import {
  canonicalizeKnowledgeImporterBindingKey,
  canonicalizeKnowledgeNodeId,
  canonicalizeKnowledgeScopeIds,
  createKnowledgeUlid,
  isKnowledgeNodeVisible,
  isKnowledgeScopeVisible,
  knowledgeScopeIdsKey,
  knowledgeSemanticDocumentId,
  knowledgeSemanticIdempotencyKey,
  KnowledgeConflictError,
  KnowledgeNotFoundError,
  KnowledgeStorage,
  KNOWLEDGE_STORAGE_CONTRACT_VERSION,
  KNOWLEDGE_STORAGE_SCHEMA_VERSION,
  parseKnowledgeImporterBindingKey,
  parseKnowledgeNodeCursor,
  parseKnowledgeWikilinks,
  sanitizeKnowledgeImportError,
} from './base';
import type {
  ApplyKnowledgeProposalInput,
  ClaimKnowledgeImportRunInput,
  CreateKnowledgeProposalInput,
  CreateKnowledgeRecordInput,
  ClaimKnowledgeSemanticOutboxInput,
  CreateKnowledgeNodeInput,
  DeleteKnowledgeNodeInput,
  KnowledgeActivityAction,
  KnowledgeActivityEvent,
  CreateKnowledgeImportRunInput,
  EnqueueKnowledgeImportRunInput,
  FinalizeKnowledgeImportRunInput,
  HeartbeatKnowledgeImportRunInput,
  KnowledgeCurationCursor,
  KnowledgeImportRun,
  KnowledgeImportState,
  KnowledgeNode,
  KnowledgeNodeAddress,
  KnowledgeProposal,
  KnowledgeRecord,
  KnowledgeScopeAddress,
  KnowledgeScopeGrant,
  KnowledgeScopeIds,
  KnowledgeSemanticDocumentType,
  KnowledgeSemanticOperation,
  KnowledgeSemanticOutboxEntry,
  KnowledgeStructurePlan,
  KnowledgeStructureReconcileResult,
  QueryKnowledgeRecordsBySourceInput,
  QueryKnowledgeRecordsInput,
  QueryKnowledgeRecordsOutput,
  RecoverKnowledgeImportRunInput,
  ListKnowledgeImportRunsInput,
  ListKnowledgeImportRunsOutput,
  ListKnowledgeNodesInput,
  ListKnowledgeProposalsInput,
  ListKnowledgeProposalsOutput,
  SearchKnowledgeInput,
  SearchKnowledgeResult,
  ReviewKnowledgeProposalInput,
  RestoreKnowledgeNodeInput,
  UpdateKnowledgeImportRunInput,
  UpdateKnowledgeNodeInput,
} from './base';

const ACTIVITY_VISIBILITY_SCOPE_IDS = '__visibilityScopeIds';

function activityVisibilityScopeIds(details?: Record<string, unknown>): string[] {
  const value = details?.[ACTIVITY_VISIBILITY_SCOPE_IDS];
  return Array.isArray(value) ? value.filter(scopeId => typeof scopeId === 'string') : [];
}

function publicActivityDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const { [ACTIVITY_VISIBILITY_SCOPE_IDS]: _, ...visibleDetails } = details;
  return Object.keys(visibleDetails).length ? visibleDetails : undefined;
}

function cloneNode(node: KnowledgeNode): KnowledgeNode {
  return {
    ...node,
    createdAt: new Date(node.createdAt),
    updatedAt: new Date(node.updatedAt),
    deletedAt: node.deletedAt ? new Date(node.deletedAt) : undefined,
  };
}

function nodeReferenceId(node: KnowledgeNode | string): string {
  return typeof node === 'string' ? node : node.id;
}

function cloneProposal(proposal: KnowledgeProposal): KnowledgeProposal {
  return {
    ...structuredClone(proposal),
    createdAt: new Date(proposal.createdAt),
    reviewedAt: proposal.reviewedAt ? new Date(proposal.reviewedAt) : undefined,
  };
}

function cloneRecord(record: KnowledgeRecord): KnowledgeRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    deletedAt: record.deletedAt ? new Date(record.deletedAt) : undefined,
  };
}

function cloneSemanticOutboxEntry(entry: KnowledgeSemanticOutboxEntry): KnowledgeSemanticOutboxEntry {
  return {
    ...entry,
    scopeIds: [...entry.scopeIds],
    availableAt: new Date(entry.availableAt),
    createdAt: new Date(entry.createdAt),
    claimedAt: entry.claimedAt ? new Date(entry.claimedAt) : undefined,
    completedAt: entry.completedAt ? new Date(entry.completedAt) : undefined,
  };
}

function recordKey(name: string, scopeIds: KnowledgeScopeIds): string {
  return `${knowledgeScopeIdsKey(scopeIds)}\u0000${name.trim().toLocaleLowerCase()}`;
}

export class InMemoryKnowledgeStorage extends KnowledgeStorage {
  readonly #db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.#db = db;
  }

  override getCapabilities() {
    return {
      contractVersion: KNOWLEDGE_STORAGE_CONTRACT_VERSION,
      schemaVersion: KNOWLEDGE_STORAGE_SCHEMA_VERSION,
      supported: true,
    } as const;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.#db.knowledgeNodes.clear();
    this.#db.knowledgeNodeKeys.clear();
    this.#db.knowledgeNodeAddresses.clear();
    this.#db.knowledgeScopeAddresses.clear();
    this.#db.knowledgeScopeGrants.clear();
    this.#db.knowledgeNodeScopes.clear();
    this.#db.knowledgeRecords.clear();
    this.#db.knowledgeRecordScopes.clear();
    this.#db.knowledgeMentions.clear();
    this.#db.knowledgeCursors.clear();
    this.#db.knowledgeActivity.length = 0;
    this.#db.knowledgeImportState.clear();
    this.#db.knowledgeImportRuns.clear();
    this.#db.knowledgeSemanticOutbox.clear();
    this.#db.knowledgeSemanticIdempotency.clear();
    this.#db.knowledgeAccessEpoch = 0;
  }

  override async getAccessEpoch(): Promise<number> {
    return this.#db.knowledgeAccessEpoch;
  }

  override async listScopeGrants(input: { includeDeleted?: boolean } = {}): Promise<KnowledgeScopeGrant[]> {
    return [...this.#db.knowledgeScopeGrants.values()]
      .filter(grant => {
        if (input.includeDeleted) return true;
        const scopeNode = this.#db.knowledgeNodes.get(grant.scopeNodeId);
        const scopeRef = this.#db.knowledgeNodes.get(grant.scopeRefId);
        return Boolean(scopeNode?.isScope && !scopeNode.deletedAt && scopeRef?.isScope && !scopeRef.deletedAt);
      })
      .map(grant => ({ ...grant }))
      .sort(
        (left, right) =>
          left.scopeNodeId.localeCompare(right.scopeNodeId) || left.scopeRefId.localeCompare(right.scopeRefId),
      );
  }

  override async upsertScopeGrant(
    grant: KnowledgeScopeGrant,
    fence: { expectedAccessEpoch?: number } = {},
  ): Promise<{ changed: boolean; accessEpoch: number }> {
    return this.#runAtomicMutation(() => {
      this.#assertExpectedAccessEpoch(fence.expectedAccessEpoch);
      const scopeNode = this.#db.knowledgeNodes.get(grant.scopeNodeId);
      const scopeRef = this.#db.knowledgeNodes.get(grant.scopeRefId);
      if (!scopeNode || scopeNode.deletedAt || !scopeNode.isScope)
        throw new KnowledgeNotFoundError('scope', grant.scopeNodeId);
      if (!scopeRef || scopeRef.deletedAt || !scopeRef.isScope)
        throw new KnowledgeNotFoundError('scope', grant.scopeRefId);
      const key = JSON.stringify([grant.scopeNodeId, grant.scopeRefId]);
      const existing = this.#db.knowledgeScopeGrants.get(key);
      if (existing?.role === grant.role && existing.canSuggest === grant.canSuggest) {
        return { changed: false, accessEpoch: this.#db.knowledgeAccessEpoch };
      }
      this.#db.knowledgeScopeGrants.set(key, { ...grant });
      this.#db.knowledgeAccessEpoch += 1;
      return { changed: true, accessEpoch: this.#db.knowledgeAccessEpoch };
    });
  }

  override async removeScopeGrant(input: {
    scopeNodeId: string;
    scopeRefId: string;
    expectedAccessEpoch?: number;
  }): Promise<{ changed: boolean; accessEpoch: number }> {
    return this.#runAtomicMutation(() => {
      this.#assertExpectedAccessEpoch(input.expectedAccessEpoch);
      const changed = this.#db.knowledgeScopeGrants.delete(JSON.stringify([input.scopeNodeId, input.scopeRefId]));
      if (changed) this.#db.knowledgeAccessEpoch += 1;
      return { changed, accessEpoch: this.#db.knowledgeAccessEpoch };
    });
  }

  override async reconcileStructure(
    plan: KnowledgeStructurePlan,
    options: { expectedAccessEpoch?: number; expectedAbsentScopeAddresses?: string[] } = {},
  ): Promise<KnowledgeStructureReconcileResult> {
    return this.#runAtomicMutation(() => {
      this.#assertExpectedAccessEpoch(options.expectedAccessEpoch);
      for (const address of options.expectedAbsentScopeAddresses ?? []) {
        if (this.#db.knowledgeScopeAddresses.has(address)) {
          throw new KnowledgeConflictError(`Knowledge scope address already exists: ${address}`);
        }
      }
      const scopes: Record<string, string> = {};
      const createdScopeIds: string[] = [];
      let changed = false;

      for (const scope of plan.scopes) {
        const existingId = this.#db.knowledgeScopeAddresses.get(scope.address);
        if (existingId) {
          scopes[scope.address] = existingId;
          continue;
        }
        const now = new Date();
        const id = crypto.randomUUID();
        this.#db.knowledgeNodes.set(id, {
          id,
          type: 'node',
          name: scope.name,
          kind: scope.kind,
          isScope: true,
          metadata: scope.metadata,
          version: 1,
          createdAt: now,
          updatedAt: now,
        });
        this.#db.knowledgeNodeScopes.set(id, new Set());
        this.#db.knowledgeScopeAddresses.set(scope.address, id);
        scopes[scope.address] = id;
        createdScopeIds.push(id);
        changed = true;
      }

      for (const scope of plan.scopes) {
        const scopeNodeId = scopes[scope.address]!;
        const node = this.#db.knowledgeNodes.get(scopeNodeId)!;
        if (node.deletedAt) continue;
        const parentIds = (scope.parentAddresses ?? []).map(address => {
          const parentId = this.#db.knowledgeScopeAddresses.get(address);
          const parent = parentId ? this.#db.knowledgeNodes.get(parentId) : undefined;
          if (!parent || parent.deletedAt || !parent.isScope) {
            throw new Error(`Knowledge parent scope does not exist: ${address}`);
          }
          return parentId!;
        });
        const memberships = this.#db.knowledgeNodeScopes.get(scopeNodeId)!;
        const desiredMemberships = new Set(parentIds);
        for (const parentId of desiredMemberships) {
          if (!memberships.has(parentId)) {
            memberships.add(parentId);
            changed = true;
          }
        }
        for (const parentId of memberships) {
          if (!desiredMemberships.has(parentId)) {
            memberships.delete(parentId);
            changed = true;
          }
        }

        const desiredGrantKeys = new Set<string>();
        for (const grant of scope.grants ?? []) {
          const scopeRefId = this.#db.knowledgeScopeAddresses.get(grant.scopeRefAddress);
          const scopeRef = scopeRefId ? this.#db.knowledgeNodes.get(scopeRefId) : undefined;
          if (!scopeRef || scopeRef.deletedAt || !scopeRef.isScope) {
            throw new Error(`Knowledge grant scope does not exist: ${grant.scopeRefAddress}`);
          }
          const grantKey = JSON.stringify([scopeNodeId, scopeRefId]);
          desiredGrantKeys.add(grantKey);
          const existing = this.#db.knowledgeScopeGrants.get(grantKey);
          if (existing?.role !== grant.role || existing.canSuggest !== grant.canSuggest) {
            this.#db.knowledgeScopeGrants.set(grantKey, {
              scopeNodeId,
              scopeRefId: scopeRef.id,
              role: grant.role,
              canSuggest: grant.canSuggest,
            });
            changed = true;
          }
        }
        for (const [grantKey, grant] of this.#db.knowledgeScopeGrants) {
          if (grant.scopeNodeId === scopeNodeId && !desiredGrantKeys.has(grantKey)) {
            this.#db.knowledgeScopeGrants.delete(grantKey);
            changed = true;
          }
        }
      }

      if (changed) this.#db.knowledgeAccessEpoch += 1;
      return {
        scopes,
        createdScopeIds,
        deletedScopeAddresses: plan.scopes
          .filter(scope => this.#db.knowledgeNodes.get(scopes[scope.address]!)?.deletedAt)
          .map(scope => scope.address),
        changed,
        accessEpoch: this.#db.knowledgeAccessEpoch,
      };
    });
  }

  async createNode(input: CreateKnowledgeNodeInput): Promise<KnowledgeNode> {
    return this.#runAtomicMutation(() => this.#createNode(input));
  }

  #createNode(input: CreateKnowledgeNodeInput): KnowledgeNode {
    this.#assertExpectedAccessEpoch(input.expectedAccessEpoch);
    this.#assertImportRunExists(input.importRunId);
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    this.#assertScopeNodes(scopeIds);
    const key = recordKey(input.name, scopeIds);
    const existingId = this.#db.knowledgeNodeKeys.get(key);
    if (existingId) {
      const existing = this.#db.knowledgeNodes.get(existingId);
      if (!existing) throw new KnowledgeNotFoundError('node', existingId);
      if (existing.deletedAt) throw new KnowledgeConflictError(existing.id);
      return cloneNode(existing);
    }
    const collision = this.#findSiblingNameCollision(input.name, scopeIds);
    if (collision) throw new KnowledgeConflictError(collision.id);

    const now = new Date();
    const node: KnowledgeNode = {
      id: input.id ? canonicalizeKnowledgeNodeId(input.id) : crypto.randomUUID(),
      type: 'node',
      name: input.name.trim(),
      kind: input.kind,
      isScope: input.isScope ?? false,
      metadata: input.metadata,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    if (this.#db.knowledgeNodes.has(node.id)) throw new KnowledgeConflictError(node.id);
    this.#db.knowledgeNodes.set(node.id, node);
    this.#db.knowledgeNodeScopes.set(node.id, new Set(scopeIds));
    this.#db.knowledgeNodeKeys.set(key, node.id);
    this.#recordActivity('create', 'node', node.id, input.contextScopeId, input.importRunId);
    this.#enqueue('node', node.id, 'upsert', node.version, scopeIds);
    return cloneNode(node);
  }

  async getNode(id: string): Promise<KnowledgeNode | null> {
    const node = this.#db.knowledgeNodes.get(id);
    return node && !node.deletedAt ? cloneNode(node) : null;
  }

  async getNodeIncludingDeleted(id: string): Promise<KnowledgeNode | null> {
    const node = this.#db.knowledgeNodes.get(id);
    return node ? cloneNode(node) : null;
  }

  async getNodeScopeIds(nodeId: string): Promise<KnowledgeScopeIds> {
    return this.#nodeScopeIds(nodeId);
  }

  async getScopeAddress(address: string): Promise<KnowledgeScopeAddress | null> {
    const scopeNodeId = this.#db.knowledgeScopeAddresses.get(address);
    if (!scopeNodeId) return null;
    const scope = this.#db.knowledgeNodes.get(scopeNodeId);
    return scope && !scope.deletedAt && scope.isScope ? { address, scopeNodeId } : null;
  }

  async getNodeAddress(input: { source: string; address: string }): Promise<KnowledgeNodeAddress | null> {
    const entry = this.#db.knowledgeNodeAddresses.get(JSON.stringify([input.source, input.address]));
    if (!entry) return null;
    const node = this.#db.knowledgeNodes.get(entry.nodeId);
    return node && !node.deletedAt ? { ...entry } : null;
  }

  async listNodeAddresses(input: { source: string }): Promise<KnowledgeNodeAddress[]> {
    return [...this.#db.knowledgeNodeAddresses.values()]
      .filter(entry => entry.source === input.source)
      .filter(entry => {
        const node = this.#db.knowledgeNodes.get(entry.nodeId);
        return Boolean(node && !node.deletedAt);
      })
      .sort((left, right) => left.address.localeCompare(right.address))
      .map(entry => ({ ...entry }));
  }

  async setNodeAddress(input: KnowledgeNodeAddress & { expectedAccessEpoch?: number }): Promise<KnowledgeNodeAddress> {
    return this.#runAtomicMutation(() => {
      this.#assertExpectedAccessEpoch(input.expectedAccessEpoch);
      const node = this.#db.knowledgeNodes.get(input.nodeId);
      if (!node || node.deletedAt) throw new KnowledgeNotFoundError('node', input.nodeId);
      const key = JSON.stringify([input.source, input.address]);
      const existing = this.#db.knowledgeNodeAddresses.get(key);
      if (existing && existing.nodeId !== input.nodeId) {
        throw new KnowledgeConflictError(`Knowledge node address already belongs to another node: ${input.address}`);
      }
      const entry = { source: input.source, address: input.address, nodeId: input.nodeId };
      this.#db.knowledgeNodeAddresses.set(key, entry);
      return { ...entry };
    });
  }

  async createNodeWithAddress(input: {
    source: string;
    address: string;
    node: CreateKnowledgeNodeInput;
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeNode> {
    return this.#runAtomicMutation(() => {
      this.#assertExpectedAccessEpoch(input.expectedAccessEpoch);
      const key = JSON.stringify([input.source, input.address]);
      const existing = this.#db.knowledgeNodeAddresses.get(key);
      if (existing) {
        const node = this.#db.knowledgeNodes.get(existing.nodeId);
        if (!node || node.deletedAt) throw new KnowledgeNotFoundError('node', existing.nodeId);
        return cloneNode(node);
      }
      const node = this.#createNode(input.node);
      this.#db.knowledgeNodeAddresses.set(key, { source: input.source, address: input.address, nodeId: node.id });
      return node;
    });
  }

  async removeNodeAddress(input: {
    source: string;
    address: string;
    nodeId: string;
    expectedAccessEpoch?: number;
  }): Promise<void> {
    return this.#runAtomicMutation(() => {
      this.#assertExpectedAccessEpoch(input.expectedAccessEpoch);
      const key = JSON.stringify([input.source, input.address]);
      const existing = this.#db.knowledgeNodeAddresses.get(key);
      if (existing?.nodeId === input.nodeId) this.#db.knowledgeNodeAddresses.delete(key);
    });
  }

  async rebindNodeAddress(input: {
    source: string;
    address: string;
    newAddress: string;
    nodeId: string;
    importRunId?: string;
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeNodeAddress> {
    this.#assertImportRunExists(input.importRunId);
    return this.#runAtomicMutation(() => {
      this.#assertExpectedAccessEpoch(input.expectedAccessEpoch);
      const oldKey = JSON.stringify([input.source, input.address]);
      const newKey = JSON.stringify([input.source, input.newAddress]);
      const node = this.#db.knowledgeNodes.get(input.nodeId);
      if (!node || node.deletedAt) throw new KnowledgeNotFoundError('node', input.nodeId);
      const existing = this.#db.knowledgeNodeAddresses.get(oldKey);
      const collision = this.#db.knowledgeNodeAddresses.get(newKey);
      if (!existing) {
        if (collision?.nodeId === input.nodeId) return { ...collision };
        throw new KnowledgeNotFoundError('node address', input.address);
      }
      if (existing.nodeId !== input.nodeId) throw new KnowledgeNotFoundError('node address', input.address);
      if (oldKey === newKey) return { ...existing };

      if (collision && collision.nodeId !== input.nodeId) {
        throw new KnowledgeConflictError(`Knowledge node address already belongs to another node: ${input.newAddress}`);
      }
      const rebound = { source: input.source, address: input.newAddress, nodeId: input.nodeId };
      this.#db.knowledgeNodeAddresses.set(newKey, rebound);
      this.#db.knowledgeNodeAddresses.delete(oldKey);
      this.#recordActivity('rebind', 'node', node.id, this.#nodeScopeIds(node.id)[0], input.importRunId);
      return { ...rebound };
    });
  }

  async deleteNodeByAddress(input: {
    source: string;
    address: string;
    scopeId: string;
    importRunId?: string;
    expectedAccessEpoch?: number;
  }): Promise<{ node: KnowledgeNode; deleted: boolean }> {
    this.#assertImportRunExists(input.importRunId);
    return this.#runAtomicMutation(() => {
      this.#assertExpectedAccessEpoch(input.expectedAccessEpoch);
      const key = JSON.stringify([input.source, input.address]);
      const binding = this.#db.knowledgeNodeAddresses.get(key);
      if (!binding) throw new KnowledgeNotFoundError('node address', input.address);
      const node = this.#db.knowledgeNodes.get(binding.nodeId);
      if (!node) throw new KnowledgeNotFoundError('node', binding.nodeId);
      if (node.isScope) throw new KnowledgeConflictError(`Knowledge scopes cannot be permanently deleted: ${node.id}`);
      this.#db.knowledgeNodeAddresses.delete(key);
      for (const record of [...this.#db.knowledgeRecords.values()]) {
        if (record.nodeId !== node.id || record.source !== input.source) continue;
        const recordScopeIds = this.#recordScopeIds(record.id);
        if (recordScopeIds.length !== 1 || recordScopeIds[0] !== input.scopeId) continue;
        const visibilityDetails = this.#db.knowledgeMentions.get(`record:${record.id}`)?.size
          ? undefined
          : { [ACTIVITY_VISIBILITY_SCOPE_IDS]: recordScopeIds };
        this.#recordActivity('delete', 'record', record.id, undefined, input.importRunId, visibilityDetails);
        this.#deleteSemanticOutboxDocument(knowledgeSemanticDocumentId('record', record.id));
        this.#enqueue('record', record.id, 'delete', record.version + 1, visibilityDetails ? recordScopeIds : []);
        this.#db.knowledgeMentions.delete(`record:${record.id}`);
        this.#db.knowledgeRecordScopes.delete(record.id);
        this.#db.knowledgeRecords.delete(record.id);
      }
      if (
        [...this.#db.knowledgeNodeAddresses.values()].some(entry => entry.nodeId === node.id) ||
        [...this.#db.knowledgeRecords.values()].some(record => record.nodeId === node.id)
      ) {
        return { node: cloneNode(node), deleted: false };
      }
      const nodeScopeIds = this.#nodeScopeIds(node.id);
      this.#recordActivity('delete', 'node', node.id, undefined, input.importRunId, {
        [ACTIVITY_VISIBILITY_SCOPE_IDS]: nodeScopeIds,
      });
      this.#enqueue('node', node.id, 'delete', node.version + 1, nodeScopeIds);
      this.#db.knowledgeNodeKeys.delete(recordKey(node.name, nodeScopeIds));
      const deletedAt = new Date();
      this.#db.knowledgeNodeScopes.delete(node.id);
      this.#db.knowledgeNodes.set(node.id, {
        ...node,
        version: node.version + 1,
        updatedAt: deletedAt,
        deletedAt,
        deletedBy: `importer:${input.source}`,
      });
      return { node: cloneNode(node), deleted: true };
    });
  }

  async deleteRecordBySource(input: {
    id: string;
    version: number;
    source: string;
    importRunId?: string;
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeRecord> {
    this.#assertImportRunExists(input.importRunId);
    return this.#runAtomicMutation(() => {
      this.#assertExpectedAccessEpoch(input.expectedAccessEpoch);
      const record = this.#db.knowledgeRecords.get(input.id);
      if (!record || record.source !== input.source) throw new KnowledgeNotFoundError('record', input.id);
      if (record.version !== input.version) throw new KnowledgeConflictError(input.id);
      const scopeIds = this.#recordScopeIds(record.id);
      const visibilityDetails = this.#db.knowledgeMentions.get(`record:${record.id}`)?.size
        ? undefined
        : { [ACTIVITY_VISIBILITY_SCOPE_IDS]: scopeIds };
      this.#recordActivity('delete', 'record', record.id, undefined, input.importRunId, visibilityDetails);
      this.#deleteSemanticOutboxDocument(knowledgeSemanticDocumentId('record', record.id));
      this.#enqueue('record', record.id, 'delete', record.version + 1, visibilityDetails ? scopeIds : []);
      this.#db.knowledgeMentions.delete(`record:${record.id}`);
      this.#db.knowledgeRecordScopes.delete(record.id);
      this.#db.knowledgeRecords.delete(record.id);
      return cloneRecord(record);
    });
  }

  async getNodeByName({
    name,
    scopeIds,
  }: {
    name: string;
    scopeIds: KnowledgeScopeIds;
  }): Promise<KnowledgeNode | null> {
    const id = this.#db.knowledgeNodeKeys.get(recordKey(name, scopeIds));
    if (!id) return null;
    const node = this.#db.knowledgeNodes.get(id);
    return node && !node.deletedAt ? cloneNode(node) : null;
  }

  async resolveNode(input: { name: string; scopeIds: KnowledgeScopeIds }): Promise<KnowledgeNode | null> {
    return this.#resolveNode(input);
  }

  #resolveNode({ name, scopeIds }: { name: string; scopeIds: KnowledgeScopeIds }): KnowledgeNode | null {
    const canonical = canonicalizeKnowledgeScopeIds(scopeIds);
    const canonicalName = name.trim().toLocaleLowerCase();
    const visible = [...this.#db.knowledgeNodes.values()]
      .filter(node => !node.deletedAt && node.name.trim().toLocaleLowerCase() === canonicalName)
      .map(node => this.#resolveTerminalNode(node.id)!)
      .filter(node => isKnowledgeNodeVisible(node, this.#nodeScopeIds(node.id), canonical))
      .sort((left, right) => this.#nodeScopeIds(right.id).length - this.#nodeScopeIds(left.id).length);
    return visible[0] ? cloneNode(visible[0]) : null;
  }

  async listNodes(input: ListKnowledgeNodesInput): Promise<KnowledgeNode[]> {
    const queryScope = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const cursor = input.cursor
      ? parseKnowledgeNodeCursor(input.cursor, {
          namePrefix: input.namePrefix,
          kind: input.kind,
          isScope: input.isScope,
        })
      : undefined;
    return [...this.#db.knowledgeNodes.values()]
      .filter(node => !node.deletedAt)
      .filter(node => isKnowledgeNodeVisible(node, this.#nodeScopeIds(node.id), queryScope))
      .filter(
        node =>
          !input.membershipScopeIds || isKnowledgeScopeVisible(this.#nodeScopeIds(node.id), input.membershipScopeIds),
      )
      .filter(
        node => !input.namePrefix || node.name.toLocaleLowerCase().startsWith(input.namePrefix.toLocaleLowerCase()),
      )
      .filter(node => !input.kind || node.kind === input.kind)
      .filter(node => input.isScope === undefined || node.isScope === input.isScope)
      .sort(
        (a, b) =>
          b.updatedAt.getTime() - a.updatedAt.getTime() ||
          (a.name === b.name ? a.id.localeCompare(b.id) : a.name.localeCompare(b.name)),
      )
      .filter(
        node =>
          !cursor ||
          node.updatedAt < cursor.updatedAt ||
          (node.updatedAt.getTime() === cursor.updatedAt.getTime() &&
            (node.name > cursor.name || (node.name === cursor.name && node.id > cursor.id))),
      )
      .slice(0, input.limit ?? 100)
      .map(cloneNode);
  }

  async updateNode(input: UpdateKnowledgeNodeInput): Promise<KnowledgeNode> {
    this.#assertImportRunExists(input.importRunId);
    return this.#runAtomicMutation(() => {
      this.#assertExpectedAccessEpoch(input.expectedAccessEpoch);
      return this.#updateNode(input);
    });
  }

  #updateNode(input: UpdateKnowledgeNodeInput): KnowledgeNode {
    const existing = this.#db.knowledgeNodes.get(input.id);
    if (!existing) throw new KnowledgeNotFoundError('node', input.id);
    if (existing.version !== input.version) throw new KnowledgeConflictError(input.id);

    const oldScopeIds = this.#nodeScopeIds(existing.id);
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds ?? oldScopeIds);
    this.#assertScopeNodes(scopeIds);
    const name = (input.name ?? existing.name).trim();
    const oldKey = recordKey(existing.name, oldScopeIds);
    const newKey = recordKey(name, scopeIds);
    const collision = this.#db.knowledgeNodeKeys.get(newKey);
    if (collision && collision !== input.id) throw new KnowledgeConflictError(collision);
    const siblingCollision = this.#findSiblingNameCollision(name, scopeIds, input.id);
    if (siblingCollision) throw new KnowledgeConflictError(siblingCollision.id);
    if (existing.isScope && input.isScope === false) this.#assertScopeHasNoDependents(existing.id);

    const updated: KnowledgeNode = {
      ...existing,
      name,
      kind: input.kind ?? existing.kind,
      isScope: input.isScope ?? existing.isScope,
      metadata: input.metadata ?? existing.metadata,
      version: existing.version + 1,
      updatedAt: new Date(),
    };
    if (oldKey !== newKey) {
      this.#db.knowledgeNodeKeys.delete(oldKey);
      this.#db.knowledgeNodeKeys.set(newKey, input.id);
    }
    this.#db.knowledgeNodes.set(input.id, updated);
    this.#db.knowledgeNodeScopes.set(input.id, new Set(scopeIds));
    this.#recordActivity('edit', 'node', input.id, input.contextScopeId, input.importRunId);
    const scopeChanged = knowledgeScopeIdsKey(oldScopeIds) !== knowledgeScopeIdsKey(scopeIds);
    if (scopeChanged) this.#enqueue('node', input.id, 'delete', updated.version, oldScopeIds);
    for (const record of this.#db.knowledgeRecords.values()) {
      if (record.nodeId !== input.id) continue;
      const updatedRecord = { ...record, version: record.version + 1, updatedAt: updated.updatedAt };
      this.#db.knowledgeRecords.set(record.id, updatedRecord);
      this.#enqueue(
        'record',
        record.id,
        record.deletedAt ? 'delete' : 'upsert',
        updatedRecord.version,
        this.#recordScopeIds(record.id),
      );
    }
    this.#enqueue('node', input.id, 'upsert', updated.version, scopeIds);
    return cloneNode(updated);
  }

  async deleteNode(input: DeleteKnowledgeNodeInput): Promise<KnowledgeNode> {
    return this.#runAtomicMutation(() => {
      this.#assertExpectedAccessEpoch(input.expectedAccessEpoch);
      const existing = this.#db.knowledgeNodes.get(input.id);
      if (!existing || existing.deletedAt) throw new KnowledgeNotFoundError('node', input.id);
      if (existing.version !== input.version) throw new KnowledgeConflictError(input.id);
      if (existing.isScope) this.#assertScopeIsEmpty(existing.id);
      const scopeIds = this.#nodeScopeIds(existing.id);
      const now = new Date();
      const deleted = {
        ...existing,
        version: existing.version + 1,
        updatedAt: now,
        deletedAt: now,
        deletedBy: input.deletedBy,
      };
      this.#db.knowledgeNodes.set(existing.id, deleted);
      if (existing.isScope) this.#db.knowledgeAccessEpoch += 1;
      this.#recordActivity('delete', 'node', existing.id, scopeIds[0], undefined, {
        [ACTIVITY_VISIBILITY_SCOPE_IDS]: scopeIds,
      });
      this.#enqueue('node', existing.id, 'delete', deleted.version, scopeIds);
      for (const record of this.#db.knowledgeRecords.values()) {
        if (record.nodeId === existing.id && !record.deletedAt) {
          this.#enqueue('record', record.id, 'delete', record.version, this.#recordScopeIds(record.id));
        }
      }
      return cloneNode(deleted);
    });
  }

  async restoreNode(input: RestoreKnowledgeNodeInput): Promise<KnowledgeNode> {
    return this.#runAtomicMutation(() => {
      this.#assertExpectedAccessEpoch(input.expectedAccessEpoch);
      const existing = this.#db.knowledgeNodes.get(input.id);
      if (!existing?.deletedAt) throw new KnowledgeNotFoundError('node', input.id);
      if (existing.version !== input.version) throw new KnowledgeConflictError(input.id);
      const scopeIds = this.#nodeScopeIds(existing.id);
      this.#assertScopeNodes(scopeIds);
      const now = new Date();
      const restored = {
        ...existing,
        version: existing.version + 1,
        updatedAt: now,
        deletedAt: undefined,
        deletedBy: undefined,
      };
      this.#db.knowledgeNodes.set(existing.id, restored);
      if (existing.isScope) this.#db.knowledgeAccessEpoch += 1;
      this.#recordActivity('restore', 'node', existing.id, scopeIds[0], undefined, {
        [ACTIVITY_VISIBILITY_SCOPE_IDS]: scopeIds,
      });
      this.#enqueue('node', existing.id, 'upsert', restored.version, scopeIds);
      for (const record of this.#db.knowledgeRecords.values()) {
        if (record.nodeId === existing.id && !record.deletedAt) {
          this.#enqueue('record', record.id, 'upsert', record.version, this.#recordScopeIds(record.id));
        }
      }
      return cloneNode(restored);
    });
  }

  async mergeNodes(input: {
    sourceId: string;
    targetId: string;
    sourceVersion: number;
    importRunId?: string;
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeNode> {
    this.#assertImportRunExists(input.importRunId);
    return this.#runAtomicMutation(() => {
      this.#assertExpectedAccessEpoch(input.expectedAccessEpoch);
      if (input.sourceId === input.targetId) throw new Error('Cannot merge a knowledge node into itself');
      const source = this.#db.knowledgeNodes.get(input.sourceId);
      if (!source) throw new KnowledgeNotFoundError('node', input.sourceId);
      if (source.version !== input.sourceVersion) throw new KnowledgeConflictError(input.sourceId);
      const target = this.#db.knowledgeNodes.get(input.targetId);
      if (!target) throw new KnowledgeNotFoundError('node', input.targetId);

      for (const [id, record] of this.#db.knowledgeRecords) {
        if (record.nodeId !== source.id) continue;
        this.#db.knowledgeRecords.set(id, {
          ...record,
          nodeId: target.id,
          version: record.version + 1,
          updatedAt: new Date(),
        });
        this.#enqueue(
          'record',
          id,
          record.deletedAt ? 'delete' : 'upsert',
          record.version + 1,
          this.#recordScopeIds(record.id),
        );
      }
      for (const address of this.#db.knowledgeNodeAddresses.values()) {
        if (address.nodeId === source.id) address.nodeId = target.id;
      }
      const sourceScopeIds = this.#nodeScopeIds(source.id);
      this.#db.knowledgeNodeKeys.delete(recordKey(source.name, sourceScopeIds));
      this.#db.knowledgeNodes.delete(source.id);
      this.#recordActivity('merge', 'node', source.id, sourceScopeIds[0], input.importRunId, {
        targetId: target.id,
      });
      this.#enqueue('node', source.id, 'delete', source.version + 1, sourceScopeIds);
      this.#db.knowledgeNodeScopes.delete(source.id);
      return cloneNode(target);
    });
  }

  async createRecord(input: CreateKnowledgeRecordInput): Promise<KnowledgeRecord> {
    this.#assertImportRunExists(input.importRunId);
    return this.#runAtomicMutation(() => {
      this.#assertExpectedAccessEpoch(input.expectedAccessEpoch);
      return this.#createRecord(input);
    });
  }

  #createRecord(input: CreateKnowledgeRecordInput): KnowledgeRecord {
    const nodeId = nodeReferenceId(input.node);
    const parent = this.#db.knowledgeNodes.get(nodeId);
    if (!parent || parent.deletedAt) throw new KnowledgeNotFoundError('node', nodeId);
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    if (scopeIds.length === 0) throw new KnowledgeNotFoundError('scope', 'root');
    this.#assertScopeNodes(scopeIds);
    this.#assertScopeNodes(input.resolutionScopeIds ?? scopeIds);
    const now = new Date();
    const record: KnowledgeRecord = {
      id: input.id ?? createKnowledgeUlid(),
      nodeId: parent.id,
      text: input.text,
      metadata: input.metadata,
      source: input.source,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    if (this.#db.knowledgeRecords.has(record.id)) throw new KnowledgeConflictError(record.id);
    this.#db.knowledgeRecords.set(record.id, record);
    this.#db.knowledgeRecordScopes.set(record.id, new Set(scopeIds));
    this.#replaceMentions(
      record.id,
      record.text,
      record.source,
      input.resolutionScopeIds ?? input.scopeIds,
      input.scopeIds,
      input.importRunId,
    );
    parent.updatedAt = now;
    this.#recordActivity('create', 'record', record.id, input.contextScopeId, input.importRunId);
    this.#enqueue('record', record.id, 'upsert', record.version, scopeIds);
    return cloneRecord(record);
  }

  async getRecordScopeIds(recordId: string): Promise<KnowledgeScopeIds> {
    return this.#recordScopeIds(recordId);
  }

  async getRecord({
    id,
    includeDeleted = false,
  }: {
    id: string;
    includeDeleted?: boolean;
  }): Promise<KnowledgeRecord | null> {
    const record = this.#db.knowledgeRecords.get(id);
    if (!record || (record.deletedAt && !includeDeleted)) return null;
    return cloneRecord(record);
  }

  async getVisibleRecord(input: {
    id: string;
    scopeIds: KnowledgeScopeIds;
    includeDeleted?: boolean;
  }): Promise<KnowledgeRecord | null> {
    const record = this.#db.knowledgeRecords.get(input.id);
    if (!record || (record.deletedAt && !input.includeDeleted) || !this.#isRecordVisible(record, input.scopeIds))
      return null;
    return cloneRecord(record);
  }

  async listRecords(input: QueryKnowledgeRecordsInput): Promise<QueryKnowledgeRecordsOutput> {
    return this.#queryKnowledge(input, 'about');
  }

  async listMentioningRecords(input: QueryKnowledgeRecordsInput): Promise<QueryKnowledgeRecordsOutput> {
    return this.#queryKnowledge(input, 'mentioning');
  }

  async listRelatedRecords(input: QueryKnowledgeRecordsInput): Promise<QueryKnowledgeRecordsOutput> {
    return this.#queryKnowledge(input, 'related');
  }

  async listRecordsBySource(input: QueryKnowledgeRecordsBySourceInput): Promise<QueryKnowledgeRecordsOutput> {
    const scope = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const limit = input.limit ?? 100;
    const records = [...this.#db.knowledgeRecords.values()]
      .filter(
        record =>
          record.source === input.source &&
          this.#isRecordVisible(record, scope) &&
          (input.includeDeleted || !record.deletedAt) &&
          (!input.after || record.id > input.after),
      )
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, limit + 1);
    return {
      records: records.slice(0, limit).map(cloneRecord),
      nextCursor: records.length > limit ? records[limit - 1]?.id : undefined,
    };
  }

  async deleteRecord({
    id,
    version,
    deletedBy,
    importRunId,
    expectedAccessEpoch,
  }: {
    id: string;
    version: number;
    deletedBy: string;
    importRunId?: string;
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeRecord> {
    this.#assertImportRunExists(importRunId);
    return this.#runAtomicMutation(() => {
      this.#assertExpectedAccessEpoch(expectedAccessEpoch);
      const record = this.#db.knowledgeRecords.get(id);
      if (!record) throw new KnowledgeNotFoundError('record', id);
      if (record.version !== version) throw new KnowledgeConflictError(id);
      if (record.deletedAt) return cloneRecord(record);
      const updated = {
        ...record,
        version: record.version + 1,
        updatedAt: new Date(),
        deletedAt: new Date(),
        deletedBy,
      };
      this.#db.knowledgeRecords.set(id, updated);
      const scopeIds = this.#recordScopeIds(record.id);
      this.#recordActivity('delete', 'record', id, scopeIds[0], importRunId);
      this.#enqueue('record', id, 'delete', updated.version, scopeIds);
      return cloneRecord(updated);
    });
  }

  async restoreRecord({
    id,
    version,
    importRunId,
    expectedAccessEpoch,
  }: {
    id: string;
    version: number;
    importRunId?: string;
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeRecord> {
    this.#assertImportRunExists(importRunId);
    return this.#runAtomicMutation(() => {
      this.#assertExpectedAccessEpoch(expectedAccessEpoch);
      const record = this.#db.knowledgeRecords.get(id);
      if (!record) throw new KnowledgeNotFoundError('record', id);
      if (record.version !== version) throw new KnowledgeConflictError(id);
      if (!record.deletedAt) return cloneRecord(record);
      const updated = {
        ...record,
        version: record.version + 1,
        updatedAt: new Date(),
        deletedAt: undefined,
        deletedBy: undefined,
      };
      this.#db.knowledgeRecords.set(id, updated);
      this.#recordActivity('restore', 'record', id, this.#recordScopeIds(record.id)[0], importRunId);
      this.#enqueue('record', id, 'upsert', updated.version, this.#recordScopeIds(record.id));
      return cloneRecord(updated);
    });
  }

  async setRecordScopes({
    id,
    version,
    scopeIds,
    importRunId,
    contextScopeId,
    expectedAccessEpoch,
  }: {
    id: string;
    version: number;
    scopeIds: KnowledgeScopeIds;
    importRunId?: string;
    contextScopeId?: string;
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeRecord> {
    this.#assertImportRunExists(importRunId);
    return this.#runAtomicMutation(() => {
      this.#assertExpectedAccessEpoch(expectedAccessEpoch);
      const record = this.#db.knowledgeRecords.get(id);
      if (!record) throw new KnowledgeNotFoundError('record', id);
      if (record.version !== version) throw new KnowledgeConflictError(id);
      const canonical = canonicalizeKnowledgeScopeIds(scopeIds);
      if (canonical.length === 0) throw new KnowledgeNotFoundError('scope', 'root');
      this.#assertScopeNodes(canonical);
      const oldScopeIds = this.#recordScopeIds(record.id);
      const updated = { ...record, version: record.version + 1, updatedAt: new Date() };
      this.#db.knowledgeRecords.set(id, updated);
      this.#db.knowledgeRecordScopes.set(id, new Set(canonical));
      this.#recordActivity('move', 'record', id, contextScopeId ?? canonical[0], importRunId);
      if (knowledgeScopeIdsKey(oldScopeIds) !== knowledgeScopeIdsKey(canonical)) {
        this.#enqueue('record', id, 'delete', updated.version, oldScopeIds);
      }
      if (!record.deletedAt) {
        this.#enqueue('record', id, 'upsert', updated.version, canonical);
      }
      return cloneRecord(updated);
    });
  }

  async search(input: SearchKnowledgeInput): Promise<SearchKnowledgeResult[]> {
    const queryScope = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const query = input.query.trim().toLocaleLowerCase();
    if (!query) return [];
    const results: SearchKnowledgeResult[] = [];
    for (const node of await this.listNodes({ scopeIds: queryScope, limit: Number.MAX_SAFE_INTEGER })) {
      const searchable = [node.name, node.kind, node.metadata ? JSON.stringify(node.metadata) : undefined]
        .filter(Boolean)
        .join('\n');
      if (searchable.toLocaleLowerCase().includes(query)) {
        results.push({
          type: 'node',
          id: node.id,
          recordId: node.id,
          name: node.name,
          text: searchable,
          scopeIds: [...this.#nodeScopeIds(node.id)],
        });
      }
    }
    for (const record of this.#db.knowledgeRecords.values()) {
      if (
        record.deletedAt ||
        !this.#isRecordVisible(record, queryScope) ||
        !record.text.toLocaleLowerCase().includes(query)
      ) {
        continue;
      }
      const parent = this.#resolveTerminalNode(record.nodeId);
      if (!parent) continue;
      const parentVisible = isKnowledgeNodeVisible(parent, this.#nodeScopeIds(parent.id), queryScope);
      results.push({
        type: 'record',
        id: record.id,
        recordId: parentVisible ? parent.id : record.id,
        name: parentVisible ? parent.name : '(private node)',
        text: record.text,
        scopeIds: [...this.#recordScopeIds(record.id)],
      });
    }
    return results.slice(0, input.limit ?? 20);
  }

  async getCurationCursor(input: { sourceThreadId: string; agent: string }): Promise<KnowledgeCurationCursor | null> {
    const cursor = this.#db.knowledgeCursors.get(`${input.sourceThreadId}\u0000${input.agent}`);
    return cursor ? { ...cursor, updatedAt: new Date(cursor.updatedAt) } : null;
  }

  async advanceCurationCursor(input: {
    sourceThreadId: string;
    agent: string;
    lastKnowledgeId: string;
  }): Promise<KnowledgeCurationCursor> {
    const key = `${input.sourceThreadId}\u0000${input.agent}`;
    const existing = this.#db.knowledgeCursors.get(key);
    if (existing && input.lastKnowledgeId < existing.lastKnowledgeId)
      throw new Error('Knowledge curation cursor cannot move backwards');
    const cursor = { ...input, updatedAt: new Date() };
    this.#db.knowledgeCursors.set(key, cursor);
    return { ...cursor };
  }

  async getImportState(input: {
    importerId: string;
    binding: string;
    key: string;
  }): Promise<KnowledgeImportState | null> {
    const binding = canonicalizeKnowledgeImporterBindingKey(input.binding);
    const state = this.#db.knowledgeImportState.get(JSON.stringify([input.importerId, binding, input.key]));
    return state ? { ...state } : null;
  }

  async setImportState(input: {
    importerId: string;
    binding: string;
    key: string;
    value: string;
  }): Promise<KnowledgeImportState> {
    const state = { ...input, binding: canonicalizeKnowledgeImporterBindingKey(input.binding) };
    this.#db.knowledgeImportState.set(JSON.stringify([state.importerId, state.binding, state.key]), state);
    return { ...state };
  }

  async createImportRun(input: CreateKnowledgeImportRunInput): Promise<KnowledgeImportRun> {
    if (input.status === 'skipped' && input.triggerKind !== 'cron') {
      throw new Error('Only cron-triggered Knowledge import runs can be created as skipped');
    }
    const queuedAt = input.queuedAt ? new Date(input.queuedAt) : new Date();
    const status = input.status ?? 'queued';
    const run: KnowledgeImportRun = {
      id: input.id ?? createKnowledgeUlid(),
      importerId: input.importerId,
      binding: canonicalizeKnowledgeImporterBindingKey(input.binding),
      importKind: input.importKind,
      triggerKind: input.triggerKind,
      status,
      queuedAt,
      completedAt: status === 'skipped' ? queuedAt : undefined,
    };
    if (this.#db.knowledgeImportRuns.has(run.id))
      throw new KnowledgeConflictError(`Import run ${run.id} already exists`);
    this.#db.knowledgeImportRuns.set(run.id, run);
    return this.#cloneImportRun(run);
  }

  async enqueueImportRun(input: EnqueueKnowledgeImportRunInput): Promise<KnowledgeImportRun> {
    const binding = canonicalizeKnowledgeImporterBindingKey(input.binding);
    const hasActive = [...this.#db.knowledgeImportRuns.values()].some(
      run =>
        run.importerId === input.importerId &&
        run.binding === binding &&
        (run.status === 'queued' || run.status === 'running'),
    );
    const status = input.skipIfActiveCron && hasActive ? 'skipped' : (input.status ?? 'queued');
    const queuedAt = input.queuedAt ? new Date(input.queuedAt) : new Date();
    const run: KnowledgeImportRun = {
      id: input.id,
      importerId: input.importerId,
      binding,
      importKind: input.importKind,
      triggerKind: input.triggerKind,
      status,
      queuedAt,
      completedAt: status === 'skipped' ? queuedAt : undefined,
    };
    if (this.#db.knowledgeImportRuns.has(run.id)) {
      throw new KnowledgeConflictError(`Import run ${run.id} already exists`);
    }
    this.#db.knowledgeImportRuns.set(run.id, run);
    if (run.status !== 'skipped') {
      this.#db.knowledgeImportState.set(JSON.stringify([input.importerId, binding, input.payloadKey]), {
        importerId: input.importerId,
        binding,
        key: input.payloadKey,
        value: input.payload,
      });
    }
    return this.#cloneImportRun(run);
  }

  async claimImportRun(input: ClaimKnowledgeImportRunInput): Promise<KnowledgeImportRun | null> {
    const binding = canonicalizeKnowledgeImporterBindingKey(input.binding);
    const hasRunning = [...this.#db.knowledgeImportRuns.values()].some(
      run => run.importerId === input.importerId && run.binding === binding && run.status === 'running',
    );
    if (hasRunning) return null;
    const run = [...this.#db.knowledgeImportRuns.values()]
      .filter(run => run.importerId === input.importerId && run.binding === binding && run.status === 'queued')
      .sort((left, right) => left.queuedAt.getTime() - right.queuedAt.getTime() || left.id.localeCompare(right.id))[0];
    if (!run) return null;
    const timestamp = input.timestamp ? new Date(input.timestamp) : new Date();
    run.status = 'running';
    run.startedAt = timestamp;
    const key = `${input.leaseKey}${run.id}`;
    this.#db.knowledgeImportState.set(JSON.stringify([input.importerId, binding, key]), {
      importerId: input.importerId,
      binding,
      key,
      value: JSON.stringify({ workerId: input.workerId, heartbeatAt: timestamp.toISOString() }),
    });
    return this.#cloneImportRun(run);
  }

  async heartbeatImportRun(input: HeartbeatKnowledgeImportRunInput): Promise<boolean> {
    const binding = canonicalizeKnowledgeImporterBindingKey(input.binding);
    const run = this.#db.knowledgeImportRuns.get(input.id);
    if (!run || run.importerId !== input.importerId || run.binding !== binding || run.status !== 'running')
      return false;
    const stateKey = JSON.stringify([input.importerId, binding, input.leaseKey]);
    const lease = this.#db.knowledgeImportState.get(stateKey);
    if (!lease) return false;
    try {
      if ((JSON.parse(lease.value) as { workerId?: string }).workerId !== input.workerId) return false;
    } catch {
      return false;
    }
    const timestamp = input.timestamp ? new Date(input.timestamp) : new Date();
    this.#db.knowledgeImportState.set(stateKey, {
      importerId: input.importerId,
      binding,
      key: input.leaseKey,
      value: JSON.stringify({ workerId: input.workerId, heartbeatAt: timestamp.toISOString() }),
    });
    return true;
  }

  async finalizeImportRun(input: FinalizeKnowledgeImportRunInput): Promise<KnowledgeImportRun | null> {
    const binding = canonicalizeKnowledgeImporterBindingKey(input.binding);
    const run = this.#db.knowledgeImportRuns.get(input.id);
    if (!run || run.importerId !== input.importerId || run.binding !== binding || run.status !== 'running') return null;
    const lease = this.#db.knowledgeImportState.get(JSON.stringify([input.importerId, binding, input.leaseKey]));
    if (!lease) return null;
    try {
      if ((JSON.parse(lease.value) as { workerId?: string }).workerId !== input.workerId) return null;
    } catch {
      return null;
    }
    for (const state of input.state) {
      this.#db.knowledgeImportState.set(JSON.stringify([input.importerId, binding, state.key]), {
        importerId: input.importerId,
        binding,
        ...state,
      });
    }
    const timestamp = input.timestamp ? new Date(input.timestamp) : new Date();
    run.status = input.status;
    run.error = input.status === 'failed' ? sanitizeKnowledgeImportError(input.error) : undefined;
    run.transcriptThreadId = input.transcriptThreadId ?? run.transcriptThreadId;
    run.completedAt = timestamp;
    return this.#cloneImportRun(run);
  }

  async recoverImportRun(input: RecoverKnowledgeImportRunInput): Promise<KnowledgeImportRun | null> {
    const run = this.#db.knowledgeImportRuns.get(input.id);
    if (!run || run.status !== 'running') return null;
    const lease = this.#db.knowledgeImportState.get(JSON.stringify([run.importerId, run.binding, input.leaseKey]));
    if (lease) {
      try {
        const heartbeatAt = new Date((JSON.parse(lease.value) as { heartbeatAt: string }).heartbeatAt);
        if (heartbeatAt >= input.staleBefore) return null;
      } catch {
        // Malformed internal leases are treated as stale and recovered.
      }
    }
    const payload = this.#db.knowledgeImportState.get(JSON.stringify([run.importerId, run.binding, input.payloadKey]));
    run.status = payload ? 'interrupted' : 'failed';
    run.error = payload ? undefined : 'Import failed: durable payload is missing';
    run.completedAt = input.queuedAt ? new Date(input.queuedAt) : new Date();
    if (!payload) return null;
    const replacement: KnowledgeImportRun = {
      id: input.replacementId,
      importerId: run.importerId,
      binding: run.binding,
      importKind: run.importKind,
      triggerKind: run.triggerKind,
      status: 'queued',
      queuedAt: new Date(run.queuedAt.getTime() - 1),
    };
    this.#db.knowledgeImportRuns.set(replacement.id, replacement);
    this.#db.knowledgeImportState.set(JSON.stringify([run.importerId, run.binding, input.replacementPayloadKey]), {
      ...payload,
      key: input.replacementPayloadKey,
    });
    return this.#cloneImportRun(replacement);
  }

  async getImportRun(id: string): Promise<KnowledgeImportRun | null> {
    const run = this.#db.knowledgeImportRuns.get(id);
    return run ? this.#cloneImportRun(run) : null;
  }

  async listImportRuns(input: ListKnowledgeImportRunsInput = {}): Promise<ListKnowledgeImportRunsOutput> {
    const cursor = input.after ? this.#db.knowledgeImportRuns.get(input.after) : undefined;
    const binding = input.binding ? canonicalizeKnowledgeImporterBindingKey(input.binding) : undefined;
    const limit = input.limit ?? 100;
    if (input.after && !cursor) return { runs: [], nextCursor: undefined };
    const runs = [...this.#db.knowledgeImportRuns.values()]
      .filter(run => !input.importerId || run.importerId === input.importerId)
      .filter(run => !input.importerIds || input.importerIds.includes(run.importerId))
      .filter(run => !binding || run.binding === binding)
      .filter(run => {
        if (!input.scopeIds) return true;
        const { scope } = parseKnowledgeImporterBindingKey(run.binding);
        const scopeNodeId = this.#db.knowledgeScopeAddresses.get(scope);
        return scopeNodeId ? input.scopeIds.includes(scopeNodeId) : false;
      })
      .filter(run => !input.status || run.status === input.status)
      .filter(
        run =>
          !cursor ||
          run.queuedAt < cursor.queuedAt ||
          (run.queuedAt.getTime() === cursor.queuedAt.getTime() && run.id < cursor.id),
      )
      .sort((left, right) => right.queuedAt.getTime() - left.queuedAt.getTime() || right.id.localeCompare(left.id));
    const page = runs.slice(0, limit);
    return {
      runs: page.map(run => this.#cloneImportRun(run)),
      nextCursor: runs.length > limit ? page.at(-1)?.id : undefined,
    };
  }

  async updateImportRun(input: UpdateKnowledgeImportRunInput): Promise<KnowledgeImportRun> {
    const run = this.#db.knowledgeImportRuns.get(input.id);
    if (!run) throw new KnowledgeNotFoundError('import run', input.id);
    this.#assertImportRunTransition(run.status, input.status);
    const timestamp = input.timestamp ? new Date(input.timestamp) : new Date();
    run.status = input.status;
    run.error = input.status === 'failed' ? sanitizeKnowledgeImportError(input.error) : undefined;
    run.transcriptThreadId = input.transcriptThreadId ?? run.transcriptThreadId;
    run.traceId = input.traceId ?? run.traceId;
    if (input.status === 'running') run.startedAt = timestamp;
    else run.completedAt = timestamp;
    return this.#cloneImportRun(run);
  }

  async createProposal(input: CreateKnowledgeProposalInput): Promise<KnowledgeProposal> {
    this.#assertExpectedAccessEpoch(input.expectedAccessEpoch);
    const [primaryTarget] = input.targets;
    if (!primaryTarget) throw new Error('A knowledge proposal requires at least one target');
    const proposal: KnowledgeProposal = {
      id: input.id ?? createKnowledgeUlid(),
      targetType: primaryTarget.type,
      targetId: primaryTarget.id,
      expectedVersion: primaryTarget.expectedVersion,
      targets: structuredClone(input.targets),
      operation: input.operation,
      payload: structuredClone(input.payload),
      reason: input.reason,
      proposerContextScopeId: input.proposerContextScopeId,
      status: 'pending',
      createdAt: new Date(),
    };
    if (this.#db.knowledgeProposals.has(proposal.id)) throw new KnowledgeConflictError(proposal.id);
    this.#db.knowledgeProposals.set(proposal.id, proposal);
    this.#recordActivity('propose', proposal.targetType, proposal.targetId, input.proposerContextScopeId, undefined, {
      proposalId: proposal.id,
    });
    return cloneProposal(proposal);
  }

  async getProposal(id: string): Promise<KnowledgeProposal | null> {
    const proposal = this.#db.knowledgeProposals.get(id);
    return proposal ? cloneProposal(proposal) : null;
  }

  async getVisibleProposal(input: { id: string; scopeIds: KnowledgeScopeIds }): Promise<KnowledgeProposal | null> {
    const proposal = this.#db.knowledgeProposals.get(input.id);
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    return proposal && proposal.targets.every(target => this.#isProposalTargetVisible(target, scopeIds))
      ? cloneProposal(proposal)
      : null;
  }

  async listProposals(input: ListKnowledgeProposalsInput): Promise<ListKnowledgeProposalsOutput> {
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
    const cursor = input.cursor ? this.#db.knowledgeProposals.get(input.cursor) : undefined;
    if (
      input.cursor &&
      (!cursor ||
        (input.status && cursor.status !== input.status) ||
        !cursor.targets.every(target => this.#isProposalTargetVisible(target, scopeIds)))
    ) {
      return { proposals: [] };
    }
    const proposals = [...this.#db.knowledgeProposals.values()]
      .filter(proposal => !input.status || proposal.status === input.status)
      .filter(
        proposal =>
          !cursor ||
          proposal.createdAt < cursor.createdAt ||
          (proposal.createdAt.getTime() === cursor.createdAt.getTime() && proposal.id < cursor.id),
      )
      .filter(proposal => proposal.targets.every(target => this.#isProposalTargetVisible(target, scopeIds)))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id));
    const page = proposals.slice(0, limit);
    return {
      proposals: page.map(cloneProposal),
      nextCursor: proposals.length > limit ? page.at(-1)?.id : undefined,
    };
  }

  async reviewProposal(input: ReviewKnowledgeProposalInput): Promise<KnowledgeProposal> {
    this.#assertExpectedAccessEpoch(input.expectedAccessEpoch);
    const proposal = this.#db.knowledgeProposals.get(input.id);
    if (!proposal || proposal.status !== 'pending') throw new KnowledgeNotFoundError('proposal', input.id);
    proposal.status = input.status;
    proposal.reviewerContextScopeId = input.reviewerContextScopeId;
    proposal.reviewReason = input.reviewReason;
    proposal.reviewedAt = new Date();
    this.#recordActivity(
      input.status === 'rejected' ? 'reject' : 'conflict',
      proposal.targetType,
      proposal.targetId,
      input.reviewerContextScopeId,
      undefined,
      { proposalId: proposal.id, reason: input.reviewReason },
    );
    return cloneProposal(proposal);
  }

  async applyProposal(input: ApplyKnowledgeProposalInput): Promise<KnowledgeProposal> {
    return this.#runAtomicMutation(() => {
      this.#assertExpectedAccessEpoch(input.expectedAccessEpoch);
      const proposal = this.#db.knowledgeProposals.get(input.id);
      if (!proposal || proposal.status !== 'pending') throw new KnowledgeNotFoundError('proposal', input.id);
      for (const target of proposal.targets) {
        const entity =
          target.type === 'node' ? this.#db.knowledgeNodes.get(target.id) : this.#db.knowledgeRecords.get(target.id);
        if (!entity || entity.deletedAt || entity.version !== target.expectedVersion) {
          return this.#markProposalConflicted(
            proposal,
            input.reviewerContextScopeId,
            `Expected ${target.type} ${target.id} version ${target.expectedVersion}`,
          );
        }
      }
      const payload = proposal.payload as { kind?: unknown; mutation?: unknown };
      if (payload.kind !== 'update-node' || !payload.mutation || typeof payload.mutation !== 'object') {
        throw new Error(`Unsupported immutable payload for knowledge proposal ${proposal.id}`);
      }
      try {
        this.#updateNode({
          ...(structuredClone(payload.mutation) as UpdateKnowledgeNodeInput),
          contextScopeId: input.reviewerContextScopeId,
          importRunId: undefined,
          expectedAccessEpoch: input.expectedAccessEpoch,
        });
      } catch (error) {
        if (error instanceof KnowledgeConflictError) {
          return this.#markProposalConflicted(
            proposal,
            input.reviewerContextScopeId,
            'Proposed mutation conflicts with current state',
          );
        }
        throw error;
      }
      proposal.status = 'approved';
      proposal.reviewerContextScopeId = input.reviewerContextScopeId;
      proposal.reviewedAt = new Date();
      this.#recordActivity('approve', proposal.targetType, proposal.targetId, input.reviewerContextScopeId, undefined, {
        proposalId: proposal.id,
      });
      return cloneProposal(proposal);
    });
  }

  async listActivity(input: {
    scopeIds: KnowledgeScopeIds;
    membershipScopeIds?: KnowledgeScopeIds;
    contextScopeId?: string;
    importRunId?: string;
    action?: KnowledgeActivityAction;
    sourceType?: 'importer' | 'system';
    from?: Date;
    to?: Date;
    after?: string;
    limit?: number;
  }): Promise<KnowledgeActivityEvent[]> {
    const queryScope = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const membershipScope = input.membershipScopeIds
      ? canonicalizeKnowledgeScopeIds(input.membershipScopeIds)
      : undefined;
    return this.#db.knowledgeActivity
      .filter(event => !input.contextScopeId || event.contextScopeId === input.contextScopeId)
      .filter(event => {
        const retainedScopeIds = activityVisibilityScopeIds(event.details);
        const visibleDeletion = event.action === 'delete' && isKnowledgeScopeVisible(retainedScopeIds, queryScope);
        if (event.targetType === 'node') {
          const node = this.#db.knowledgeNodes.get(event.targetId);
          const targetScopeIds = node ? this.#nodeScopeIds(node.id) : retainedScopeIds;
          if (membershipScope && !isKnowledgeScopeVisible(targetScopeIds, membershipScope)) return false;
          return visibleDeletion || Boolean(node && isKnowledgeScopeVisible(targetScopeIds, queryScope));
        }
        const record = this.#db.knowledgeRecords.get(event.targetId);
        const targetScopeIds = record ? this.#recordScopeIds(record.id) : retainedScopeIds;
        if (membershipScope && !isKnowledgeScopeVisible(targetScopeIds, membershipScope)) return false;
        return record ? this.#isRecordVisible(record, queryScope) : visibleDeletion;
      })
      .filter(event => !input.importRunId || event.importRunId === input.importRunId)
      .filter(event => !input.action || event.action === input.action)
      .filter(event => !input.sourceType || (input.sourceType === 'importer') === Boolean(event.importRunId))
      .filter(event => !input.from || event.createdAt >= input.from)
      .filter(event => !input.to || event.createdAt <= input.to)
      .filter(event => !input.after || event.id < input.after)
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, input.limit ?? 100)
      .map(event => ({
        ...event,
        details: publicActivityDetails(event.details),
        createdAt: new Date(event.createdAt),
      }));
  }

  async listSemanticOutbox(
    input: {
      status?: KnowledgeSemanticOutboxEntry['status'];
      scopeIds?: KnowledgeScopeIds;
      limit?: number;
    } = {},
  ): Promise<KnowledgeSemanticOutboxEntry[]> {
    const queryScope = input.scopeIds ? canonicalizeKnowledgeScopeIds(input.scopeIds) : undefined;
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
    return [...this.#db.knowledgeSemanticOutbox.values()]
      .filter(entry => !input.status || entry.status === input.status)
      .filter(entry => !queryScope || this.#isSemanticOutboxEntryVisible(entry, queryScope))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
      .slice(0, limit)
      .map(cloneSemanticOutboxEntry);
  }

  async claimSemanticOutbox(input: ClaimKnowledgeSemanticOutboxInput): Promise<KnowledgeSemanticOutboxEntry[]> {
    const now = input.now ? new Date(input.now) : new Date();
    const timeout = input.claimTimeoutMs ?? 60_000;
    const queryScope = input.scopeIds ? canonicalizeKnowledgeScopeIds(input.scopeIds) : undefined;
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
    const ordered: KnowledgeSemanticOutboxEntry[] = [];
    const blockedDocuments = new Set<string>();
    for (const entry of this.#db.knowledgeSemanticOutbox.values()) {
      if (entry.status === 'completed') continue;
      const eligible =
        (entry.status === 'pending' ||
          (entry.status === 'processing' && entry.claimedAt && now.getTime() - entry.claimedAt.getTime() >= timeout)) &&
        entry.availableAt <= now &&
        (!queryScope || this.#isSemanticOutboxEntryVisible(entry, queryScope));
      if (!eligible) {
        blockedDocuments.add(entry.documentId);
        continue;
      }
      ordered.push(entry);
      if (ordered.length >= 1_000) break;
    }
    ordered.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    const claimed: KnowledgeSemanticOutboxEntry[] = [];
    for (const entry of ordered) {
      const eligible =
        (entry.status === 'pending' ||
          (entry.status === 'processing' && entry.claimedAt && now.getTime() - entry.claimedAt.getTime() >= timeout)) &&
        entry.availableAt <= now;
      if (
        eligible &&
        !blockedDocuments.has(entry.documentId) &&
        (!queryScope || this.#isSemanticOutboxEntryVisible(entry, queryScope))
      ) {
        claimed.push(entry);
        if (claimed.length >= limit) break;
      }
      if (entry.status !== 'completed') blockedDocuments.add(entry.documentId);
    }
    for (const entry of claimed) {
      entry.status = 'processing';
      entry.claimedAt = now;
      entry.claimedBy = input.workerId;
      entry.attempts += 1;
    }
    return claimed.map(cloneSemanticOutboxEntry);
  }

  async completeSemanticOutbox({ ids, workerId }: { ids: string[]; workerId: string }): Promise<void> {
    const now = new Date();
    for (const id of ids) {
      const entry = this.#db.knowledgeSemanticOutbox.get(id);
      if (entry?.status === 'processing' && entry.claimedBy === workerId) {
        entry.status = 'completed';
        entry.completedAt = now;
      }
    }
  }

  async releaseSemanticOutbox({
    ids,
    workerId,
    retryAt,
  }: {
    ids: string[];
    workerId: string;
    retryAt?: Date;
  }): Promise<void> {
    for (const id of ids) {
      const entry = this.#db.knowledgeSemanticOutbox.get(id);
      if (entry?.status === 'processing' && entry.claimedBy === workerId) {
        entry.status = 'pending';
        entry.availableAt = retryAt ? new Date(retryAt) : new Date();
        entry.claimedAt = undefined;
        entry.claimedBy = undefined;
      }
    }
  }

  #cloneImportRun(run: KnowledgeImportRun): KnowledgeImportRun {
    return {
      ...run,
      queuedAt: new Date(run.queuedAt),
      startedAt: run.startedAt ? new Date(run.startedAt) : undefined,
      completedAt: run.completedAt ? new Date(run.completedAt) : undefined,
    };
  }

  #assertExpectedAccessEpoch(expectedAccessEpoch?: number): void {
    if (expectedAccessEpoch === undefined || expectedAccessEpoch === this.#db.knowledgeAccessEpoch) return;
    throw new KnowledgeConflictError('Knowledge access changed during mutation authorization');
  }

  #assertImportRunTransition(from: KnowledgeImportRun['status'], to: UpdateKnowledgeImportRunInput['status']): void {
    const allowed =
      from === 'queued'
        ? to === 'running' || to === 'interrupted'
        : from === 'running'
          ? to === 'succeeded' || to === 'failed' || to === 'interrupted'
          : false;
    if (!allowed) throw new KnowledgeConflictError(`Import run cannot transition from ${from} to ${to}`);
  }

  #runAtomicMutation<T>(mutation: () => T): T {
    const snapshot = {
      nodes: new Map([...this.#db.knowledgeNodes].map(([id, node]) => [id, cloneNode(node)])),
      nodeKeys: new Map(this.#db.knowledgeNodeKeys),
      nodeAddresses: new Map([...this.#db.knowledgeNodeAddresses].map(([key, address]) => [key, { ...address }])),
      scopeAddresses: new Map(this.#db.knowledgeScopeAddresses),
      scopeGrants: new Map([...this.#db.knowledgeScopeGrants].map(([key, grant]) => [key, { ...grant }])),
      nodeScopes: new Map([...this.#db.knowledgeNodeScopes].map(([id, scopes]) => [id, new Set(scopes)])),
      records: new Map([...this.#db.knowledgeRecords].map(([id, record]) => [id, cloneRecord(record)])),
      recordScopes: new Map([...this.#db.knowledgeRecordScopes].map(([id, scopes]) => [id, new Set(scopes)])),
      accessEpoch: this.#db.knowledgeAccessEpoch,
      mentions: new Map([...this.#db.knowledgeMentions].map(([key, mentions]) => [key, new Set(mentions)])),
      activity: this.#db.knowledgeActivity.map(event => ({
        ...event,
        createdAt: new Date(event.createdAt),
      })),
      proposals: new Map([...this.#db.knowledgeProposals].map(([id, proposal]) => [id, cloneProposal(proposal)])),
      outbox: new Map(
        [...this.#db.knowledgeSemanticOutbox].map(([id, entry]) => [id, cloneSemanticOutboxEntry(entry)]),
      ),
      idempotency: new Map(this.#db.knowledgeSemanticIdempotency),
    };

    try {
      return mutation();
    } catch (error) {
      this.#db.knowledgeNodes.clear();
      snapshot.nodes.forEach((node, id) => this.#db.knowledgeNodes.set(id, node));
      this.#db.knowledgeNodeKeys.clear();
      snapshot.nodeKeys.forEach((id, key) => this.#db.knowledgeNodeKeys.set(key, id));
      this.#db.knowledgeNodeAddresses.clear();
      snapshot.nodeAddresses.forEach((address, key) => this.#db.knowledgeNodeAddresses.set(key, address));
      this.#db.knowledgeScopeAddresses.clear();
      snapshot.scopeAddresses.forEach((id, address) => this.#db.knowledgeScopeAddresses.set(address, id));
      this.#db.knowledgeScopeGrants.clear();
      snapshot.scopeGrants.forEach((grant, key) => this.#db.knowledgeScopeGrants.set(key, grant));
      this.#db.knowledgeNodeScopes.clear();
      snapshot.nodeScopes.forEach((scopes, id) => this.#db.knowledgeNodeScopes.set(id, scopes));
      this.#db.knowledgeRecords.clear();
      snapshot.records.forEach((record, id) => this.#db.knowledgeRecords.set(id, record));
      this.#db.knowledgeRecordScopes.clear();
      snapshot.recordScopes.forEach((scopes, id) => this.#db.knowledgeRecordScopes.set(id, scopes));
      this.#db.knowledgeAccessEpoch = snapshot.accessEpoch;
      this.#db.knowledgeMentions.clear();
      snapshot.mentions.forEach((mentions, key) => this.#db.knowledgeMentions.set(key, mentions));
      this.#db.knowledgeActivity.splice(0, this.#db.knowledgeActivity.length, ...snapshot.activity);
      this.#db.knowledgeProposals.clear();
      snapshot.proposals.forEach((proposal, id) => this.#db.knowledgeProposals.set(id, proposal));
      this.#db.knowledgeSemanticOutbox.clear();
      snapshot.outbox.forEach((entry, id) => this.#db.knowledgeSemanticOutbox.set(id, entry));
      this.#db.knowledgeSemanticIdempotency.clear();
      snapshot.idempotency.forEach((id, key) => this.#db.knowledgeSemanticIdempotency.set(key, id));
      throw error;
    }
  }

  #assertScopeNodes(scopeIds: KnowledgeScopeIds): void {
    for (const scopeId of canonicalizeKnowledgeScopeIds(scopeIds)) {
      const scope = this.#db.knowledgeNodes.get(scopeId);
      if (!scope?.isScope || scope.deletedAt) throw new KnowledgeNotFoundError('scope', scopeId);
    }
  }

  #findSiblingNameCollision(name: string, scopeIds: KnowledgeScopeIds, excludeId?: string): KnowledgeNode | undefined {
    const normalizedName = name.trim().toLocaleLowerCase();
    const memberships = new Set(scopeIds);
    return [...this.#db.knowledgeNodes.values()].find(node => {
      if (node.id === excludeId || node.deletedAt || node.name.trim().toLocaleLowerCase() !== normalizedName)
        return false;
      const existingMemberships = this.#nodeScopeIds(node.id);
      return (
        (memberships.size === 0 && existingMemberships.length === 0) ||
        existingMemberships.some(scopeId => memberships.has(scopeId))
      );
    });
  }

  #assertScopeIsEmpty(scopeId: string): void {
    const hasLiveMembers = [...this.#db.knowledgeNodeScopes.entries()].some(([nodeId, memberships]) => {
      const node = this.#db.knowledgeNodes.get(nodeId);
      return nodeId !== scopeId && memberships.has(scopeId) && Boolean(node && !node.deletedAt);
    });
    if (hasLiveMembers) throw new KnowledgeConflictError(`Knowledge scope is not empty: ${scopeId}`);
  }

  #assertScopeHasNoDependents(scopeId: string): void {
    const hasNodeMembers = [...this.#db.knowledgeNodeScopes.entries()].some(
      ([nodeId, memberships]) => nodeId !== scopeId && memberships.has(scopeId),
    );
    const hasRecordMembers = [...this.#db.knowledgeRecordScopes.values()].some(memberships => memberships.has(scopeId));
    const hasGrants = [...this.#db.knowledgeScopeGrants.values()].some(
      grant => grant.scopeNodeId === scopeId || grant.scopeRefId === scopeId,
    );
    const hasScopeAddress = [...this.#db.knowledgeScopeAddresses.values()].some(nodeId => nodeId === scopeId);
    if (hasNodeMembers || hasRecordMembers || hasGrants || hasScopeAddress) {
      throw new KnowledgeConflictError(`Knowledge scope has dependents: ${scopeId}`);
    }
  }

  #nodeScopeIds(nodeId: string): KnowledgeScopeIds {
    return [...(this.#db.knowledgeNodeScopes.get(nodeId) ?? [])].sort();
  }

  #recordScopeIds(recordId: string): KnowledgeScopeIds {
    return [...(this.#db.knowledgeRecordScopes.get(recordId) ?? [])].sort();
  }

  #markProposalConflicted(
    proposal: KnowledgeProposal,
    reviewerContextScopeId: string,
    reviewReason: string,
  ): KnowledgeProposal {
    proposal.status = 'conflicted';
    proposal.reviewerContextScopeId = reviewerContextScopeId;
    proposal.reviewReason = reviewReason;
    proposal.reviewedAt = new Date();
    this.#recordActivity('conflict', proposal.targetType, proposal.targetId, reviewerContextScopeId, undefined, {
      proposalId: proposal.id,
      reason: reviewReason,
    });
    return cloneProposal(proposal);
  }

  #isProposalTargetVisible(target: KnowledgeProposal['targets'][number], visibleScopeIds: KnowledgeScopeIds): boolean {
    return isKnowledgeScopeVisible(target.scopeIds, visibleScopeIds);
  }

  #isRecordVisible(record: KnowledgeRecord, visibleScopeIds: KnowledgeScopeIds): boolean {
    if (!isKnowledgeScopeVisible(this.#recordScopeIds(record.id), visibleScopeIds)) return false;
    const relatedNodeIds = [record.nodeId, ...(this.#db.knowledgeMentions.get(`record:${record.id}`) ?? [])];
    return relatedNodeIds.every(nodeId => {
      const node = this.#db.knowledgeNodes.get(nodeId);
      return Boolean(
        node && !node.deletedAt && isKnowledgeNodeVisible(node, this.#nodeScopeIds(nodeId), visibleScopeIds),
      );
    });
  }

  #isSemanticOutboxEntryVisible(entry: KnowledgeSemanticOutboxEntry, visibleScopeIds: KnowledgeScopeIds): boolean {
    const scopesVisible =
      entry.documentType === 'record'
        ? isKnowledgeScopeVisible(entry.scopeIds, visibleScopeIds)
        : isKnowledgeScopeVisible(entry.scopeIds, visibleScopeIds);
    if (!scopesVisible) return false;
    const id = entry.documentId.slice(`knowledge:${entry.documentType}:`.length);
    if (entry.documentType === 'node') {
      if (entry.operation === 'delete') return true;
      const node = this.#db.knowledgeNodes.get(id);
      return Boolean(
        node && !node.deletedAt && isKnowledgeNodeVisible(node, this.#nodeScopeIds(node.id), visibleScopeIds),
      );
    }
    const record = this.#db.knowledgeRecords.get(id);
    if (!record) return entry.operation === 'delete';
    if (entry.operation === 'delete') {
      const owner = this.#db.knowledgeNodes.get(record.nodeId);
      if (!owner || !isKnowledgeNodeVisible(owner, this.#nodeScopeIds(owner.id), visibleScopeIds)) return false;
      return [...(this.#db.knowledgeMentions.get(`record:${record.id}`) ?? [])].every(nodeId => {
        const node = this.#db.knowledgeNodes.get(nodeId);
        return Boolean(
          node && !node.deletedAt && isKnowledgeNodeVisible(node, this.#nodeScopeIds(node.id), visibleScopeIds),
        );
      });
    }
    return !record.deletedAt && this.#isRecordVisible(record, visibleScopeIds);
  }

  #resolveTerminalNode(id: string): KnowledgeNode | null {
    return this.#db.knowledgeNodes.get(id) ?? null;
  }

  #replaceMentions(
    recordId: string,
    text: string,
    source: string | undefined,
    resolutionScopeIds: KnowledgeScopeIds,
    recordScopeIds: KnowledgeScopeIds,
    importRunId?: string,
  ): void {
    const mentions = new Set<string>();
    for (const name of parseKnowledgeWikilinks(text)) {
      const addressed = [...this.#db.knowledgeNodeAddresses.values()]
        .filter(entry => entry.address === name)
        .map(entry => ({ entry, node: this.#db.knowledgeNodes.get(entry.nodeId) }))
        .filter((candidate): candidate is { entry: KnowledgeNodeAddress; node: KnowledgeNode } =>
          Boolean(
            candidate.node &&
            isKnowledgeNodeVisible(candidate.node, this.#nodeScopeIds(candidate.node.id), resolutionScopeIds),
          ),
        )
        .sort(
          (left, right) =>
            Number(right.entry.source === source) - Number(left.entry.source === source) ||
            this.#nodeScopeIds(right.node.id).length - this.#nodeScopeIds(left.node.id).length ||
            left.node.id.localeCompare(right.node.id),
        );
      const preferred = addressed.find(candidate => candidate.entry.source === source)?.node;
      const uniqueAddressedNodeIds = new Set(addressed.map(candidate => candidate.node.id));
      let node = preferred ?? (uniqueAddressedNodeIds.size === 1 ? addressed[0]?.node : undefined);
      node ??= this.#resolveNode({ name, scopeIds: resolutionScopeIds }) ?? undefined;
      node ??= this.#createNode({ name, kind: 'node', scopeIds: recordScopeIds, importRunId });
      mentions.add(node.id);
    }
    this.#db.knowledgeMentions.set(`record:${recordId}`, mentions);
  }

  #queryKnowledge(
    input: QueryKnowledgeRecordsInput,
    relationship: 'about' | 'mentioning' | 'related',
  ): QueryKnowledgeRecordsOutput {
    const queryScope = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const terminal = this.#resolveTerminalNode(nodeReferenceId(input.node));
    if (!terminal) return { records: [] };
    return this.#paginateKnowledge(
      [...this.#db.knowledgeRecords.values()].filter(record => {
        const about = record.nodeId === terminal.id;
        const mentioning = this.#db.knowledgeMentions.get(`record:${record.id}`)?.has(terminal.id) ?? false;
        if (relationship === 'about') return about;
        if (relationship === 'mentioning') return mentioning;
        return about || mentioning;
      }),
      { ...input, scopeIds: queryScope },
    );
  }

  #paginateKnowledge(records: KnowledgeRecord[], input: QueryKnowledgeRecordsInput): QueryKnowledgeRecordsOutput {
    const membershipScopeIds = input.membershipScopeIds ?? input.scopeIds;
    const filtered = records
      .filter(record => input.includeDeleted || !record.deletedAt)
      .filter(record => isKnowledgeScopeVisible(this.#recordScopeIds(record.id), membershipScopeIds))
      .filter(record => this.#isRecordVisible(record, input.scopeIds))
      .filter(record => !input.after || record.id < input.after)
      .sort((a, b) => b.id.localeCompare(a.id));
    const limit = input.limit ?? 100;
    const page = filtered.slice(0, limit);
    return {
      records: page.map(cloneRecord),
      nextCursor: filtered.length > limit ? page.at(-1)?.id : undefined,
    };
  }

  #assertImportRunExists(importRunId?: string): void {
    if (importRunId && !this.#db.knowledgeImportRuns.has(importRunId)) {
      throw new KnowledgeNotFoundError('import run', importRunId);
    }
  }

  #recordActivity(
    action: KnowledgeActivityAction,
    targetType: KnowledgeSemanticDocumentType,
    targetId: string,
    contextScopeId?: string,
    importRunId?: string,
    details?: Record<string, unknown>,
  ): void {
    const event: KnowledgeActivityEvent = {
      id: createKnowledgeUlid(),
      action,
      targetType,
      targetId,
      contextScopeId,
      importRunId,
      details,
      createdAt: new Date(),
    };
    this.#db.knowledgeActivity.push(event);
  }

  #deleteSemanticOutboxDocument(documentId: string): void {
    for (const [id, entry] of this.#db.knowledgeSemanticOutbox) {
      if (entry.documentId === documentId) this.#db.knowledgeSemanticOutbox.delete(id);
    }
  }

  #enqueue(
    documentType: KnowledgeSemanticDocumentType,
    id: string,
    operation: KnowledgeSemanticOperation,
    version: number | string,
    scopes: KnowledgeScopeIds,
  ): void {
    const documentId = knowledgeSemanticDocumentId(documentType, id);
    const idempotencyKey = knowledgeSemanticIdempotencyKey(documentId, operation, version);
    if (this.#db.knowledgeSemanticIdempotency.has(idempotencyKey)) return;
    const now = new Date();
    const entry: KnowledgeSemanticOutboxEntry = {
      id: createKnowledgeUlid(),
      idempotencyKey,
      documentId,
      documentType,
      operation,
      scopeIds: [...scopes],
      status: 'pending',
      attempts: 0,
      availableAt: now,
      createdAt: now,
    };
    this.#db.knowledgeSemanticOutbox.set(entry.id, entry);
    this.#db.knowledgeSemanticIdempotency.set(idempotencyKey, entry.id);
  }
}
