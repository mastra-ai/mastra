import { randomUUID } from 'node:crypto';

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
  KnowledgeSchemaError,
  KnowledgeStorage,
  KNOWLEDGE_STORAGE_CONTRACT_VERSION,
  KNOWLEDGE_STORAGE_SCHEMA_VERSION,
  parseKnowledgeNodeCursor,
  parseKnowledgeWikilinks,
  sanitizeKnowledgeImportError,
  TABLE_KNOWLEDGE_ACCESS_STATE,
  TABLE_KNOWLEDGE_ACTIVITY,
  TABLE_KNOWLEDGE_CURSORS,
  TABLE_KNOWLEDGE_IMPORT_RUNS,
  TABLE_KNOWLEDGE_IMPORT_STATE,
  TABLE_KNOWLEDGE_MENTIONS,
  TABLE_KNOWLEDGE_NODE_ADDRESSES,
  TABLE_KNOWLEDGE_NODE_SCOPES,
  TABLE_KNOWLEDGE_NODES,
  TABLE_KNOWLEDGE_PROPOSALS,
  TABLE_KNOWLEDGE_RECORD_SCOPES,
  TABLE_KNOWLEDGE_RECORDS,
  TABLE_KNOWLEDGE_SCOPE_ADDRESSES,
  TABLE_KNOWLEDGE_SCOPE_GRANTS,
  TABLE_KNOWLEDGE_SCHEMA,
  TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
} from '@mastra/core/storage';
import type {
  ApplyKnowledgeProposalInput,
  ClaimKnowledgeImportRunInput,
  CreateKnowledgeProposalInput,
  KnowledgeProposal,
  ListKnowledgeProposalsInput,
  ListKnowledgeProposalsOutput,
  ReviewKnowledgeProposalInput,
  CreateKnowledgeImportRunInput,
  CreateKnowledgeNodeInput,
  EnqueueKnowledgeImportRunInput,
  FinalizeKnowledgeImportRunInput,
  HeartbeatKnowledgeImportRunInput,
  KnowledgeImportRun,
  KnowledgeImportState,
  ListKnowledgeImportRunsInput,
  ListKnowledgeImportRunsOutput,
  RecoverKnowledgeImportRunInput,
  UpdateKnowledgeImportRunInput,
  CreateKnowledgeRecordInput,
  DeleteKnowledgeNodeInput,
  KnowledgeActivityEvent,
  KnowledgeNode,
  KnowledgeRecord,
  KnowledgeNodeAddress,
  KnowledgeScopeAddress,
  KnowledgeScopeGrant,
  KnowledgeScopeIds,
  KnowledgeStructurePlan,
  KnowledgeStructureReconcileResult,
  KnowledgeSemanticDocumentType,
  KnowledgeSemanticOperation,
  KnowledgeSemanticOutboxEntry,
  ListKnowledgeNodesInput,
  PromoteKnowledgeNodeInput,
  QueryKnowledgeRecordsBySourceInput,
  QueryKnowledgeRecordsInput,
  QueryKnowledgeRecordsOutput,
  RestoreKnowledgeNodeInput,
  SearchKnowledgeInput,
  SearchKnowledgeResult,
  UpdateKnowledgeNodeInput,
} from '@mastra/core/storage';
import { MongoServerError } from 'mongodb';
import type { ClientSession, Collection, Document, Filter } from 'mongodb';

import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

const ACTIVITY_VISIBILITY_SCOPE_IDS = '__visibilityScopeIds';
const canonicalName = (name: string) => name.trim().toLowerCase();
const sessionOptions = (session?: ClientSession) => (session ? { session } : {});

function nodeReferenceId(node: KnowledgeNode | string): string {
  return typeof node === 'string' ? node : node.id;
}

function toDate(value: unknown): Date {
  return value instanceof Date ? new Date(value) : new Date(String(value));
}

function optionalDate(value: unknown): Date | undefined {
  return value == null ? undefined : toDate(value);
}

function nodeFromDocument(row: Document): KnowledgeNode {
  const deletedAt = optionalDate(row.deletedAt);
  return {
    id: String(row.id),
    type: 'node',
    name: String(row.name),
    kind: row.kind == null ? undefined : String(row.kind),
    isScope: Boolean(row.isScope),
    metadata: row.metadata == null ? undefined : (row.metadata as Record<string, unknown>),
    version: Number(row.version),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
    ...(deletedAt ? { deletedAt } : {}),
    ...(row.deletedBy == null ? {} : { deletedBy: String(row.deletedBy) }),
  };
}

function recordFromDocument(row: Document): KnowledgeRecord {
  const deletedAt = optionalDate(row.deletedAt);
  return {
    id: String(row.id),
    nodeId: String(row.nodeId),
    text: String(row.text),
    metadata: row.metadata == null ? undefined : (row.metadata as Record<string, unknown>),
    source: row.source == null ? undefined : String(row.source),
    version: Number(row.version),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
    ...(deletedAt ? { deletedAt } : {}),
    ...(row.deletedBy == null ? {} : { deletedBy: String(row.deletedBy) }),
  };
}

function proposalFromDocument(row: Document): KnowledgeProposal {
  const targets = structuredClone(row.targets);
  return {
    id: String(row.id),
    targetType: row.targetType,
    targetId: String(row.targetId),
    expectedVersion: Number(row.expectedVersion),
    targets,
    operation: String(row.operation),
    payload: structuredClone(row.payload),
    reason: row.reason == null ? undefined : String(row.reason),
    proposerContextScopeId: row.proposerContextScopeId == null ? undefined : String(row.proposerContextScopeId),
    status: row.status,
    reviewerContextScopeId: row.reviewerContextScopeId == null ? undefined : String(row.reviewerContextScopeId),
    reviewReason: row.reviewReason == null ? undefined : String(row.reviewReason),
    reviewedAt: optionalDate(row.reviewedAt),
    createdAt: toDate(row.createdAt),
  };
}

function importRunFromDocument(row: Document): KnowledgeImportRun {
  return {
    id: String(row.id),
    importerId: String(row.importerId),
    binding: String(row.binding),
    importKind: row.importKind,
    triggerKind: row.triggerKind,
    status: row.status,
    error: row.error == null ? undefined : String(row.error),
    transcriptThreadId: row.transcriptThreadId == null ? undefined : String(row.transcriptThreadId),
    traceId: row.traceId == null ? undefined : String(row.traceId),
    queuedAt: toDate(row.queuedAt),
    startedAt: optionalDate(row.startedAt),
    completedAt: optionalDate(row.completedAt),
  };
}

function activityVisibilityScopeIds(details?: Record<string, unknown>): string[] {
  const value = details?.[ACTIVITY_VISIBILITY_SCOPE_IDS];
  return Array.isArray(value) ? value.filter(scopeId => typeof scopeId === 'string') : [];
}

function publicActivityDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const { [ACTIVITY_VISIBILITY_SCOPE_IDS]: _, scopeIds: __, ...visibleDetails } = details;
  return Object.keys(visibleDetails).length ? visibleDetails : undefined;
}

function assertImportRunTransition(
  from: KnowledgeImportRun['status'],
  to: UpdateKnowledgeImportRunInput['status'],
): void {
  const allowed =
    from === 'queued'
      ? to === 'running' || to === 'interrupted'
      : from === 'running'
        ? to === 'succeeded' || to === 'failed' || to === 'interrupted'
        : false;
  if (!allowed) throw new KnowledgeConflictError(`Import run cannot transition from ${from} to ${to}`);
}

export class KnowledgeMongoDB extends KnowledgeStorage {
  static readonly MANAGED_COLLECTIONS = [
    TABLE_KNOWLEDGE_NODES,
    TABLE_KNOWLEDGE_RECORDS,
    TABLE_KNOWLEDGE_MENTIONS,
    TABLE_KNOWLEDGE_NODE_SCOPES,
    TABLE_KNOWLEDGE_RECORD_SCOPES,
    TABLE_KNOWLEDGE_SCOPE_GRANTS,
    TABLE_KNOWLEDGE_ACCESS_STATE,
    TABLE_KNOWLEDGE_SCOPE_ADDRESSES,
    TABLE_KNOWLEDGE_NODE_ADDRESSES,
    TABLE_KNOWLEDGE_IMPORT_STATE,
    TABLE_KNOWLEDGE_IMPORT_RUNS,
    TABLE_KNOWLEDGE_PROPOSALS,
    TABLE_KNOWLEDGE_SCHEMA,
    TABLE_KNOWLEDGE_CURSORS,
    TABLE_KNOWLEDGE_ACTIVITY,
    TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
  ] as const;

  readonly #connector: MongoDBConnector;
  readonly #skipDefaultIndexes?: boolean;
  readonly #indexes?: MongoDBIndexConfig[];

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    this.#indexes = config.indexes?.filter(index =>
      (KnowledgeMongoDB.MANAGED_COLLECTIONS as readonly string[]).includes(index.collection),
    );
  }

  override getCapabilities() {
    return {
      supported: true,
      contractVersion: KNOWLEDGE_STORAGE_CONTRACT_VERSION,
      schemaVersion: KNOWLEDGE_STORAGE_SCHEMA_VERSION,
    } as const;
  }

  async #collection(name: string): Promise<Collection<Document>> {
    return this.#connector.getCollection(name);
  }

  async init(): Promise<void> {
    if (!(await this.#connector.supportsTransactions())) {
      throw new KnowledgeSchemaError(
        'MongoDB Knowledge requires a replica set or sharded cluster with multi-document transaction support.',
      );
    }
    const schema = await this.#collection(TABLE_KNOWLEDGE_SCHEMA);
    const existingCollections = await Promise.all(
      KnowledgeMongoDB.MANAGED_COLLECTIONS.map(async name => ({
        name,
        count: await (await this.#collection(name)).estimatedDocumentCount(),
      })),
    );
    const populated = existingCollections.filter(collection => collection.count > 0);
    const marker = await schema.findOne({ id: 'canonical' });
    if (populated.length > 0 && !marker) {
      throw new KnowledgeSchemaError('MongoDB Knowledge schema is incomplete or incompatible.');
    }
    if (marker && Number(marker.version) !== KNOWLEDGE_STORAGE_SCHEMA_VERSION) {
      throw new KnowledgeSchemaError(
        `MongoDB Knowledge schema version mismatch: expected ${KNOWLEDGE_STORAGE_SCHEMA_VERSION}, received ${String(marker.version)}.`,
      );
    }

    if (!this.#skipDefaultIndexes) {
      for (const index of this.getDefaultIndexDefinitions()) {
        const collection = await this.#collection(index.collection);
        await collection.createIndex(index.keys, index.options);
      }
    }
    for (const index of this.#indexes ?? []) {
      const collection = await this.#collection(index.collection);
      await collection.createIndex(index.keys, index.options);
    }
    await schema.updateOne(
      { id: 'canonical' },
      { $setOnInsert: { id: 'canonical', version: KNOWLEDGE_STORAGE_SCHEMA_VERSION } },
      { upsert: true },
    );
    await (
      await this.#collection(TABLE_KNOWLEDGE_ACCESS_STATE)
    ).updateOne({ id: 'global' }, { $setOnInsert: { id: 'global', epoch: 0 } }, { upsert: true });
  }

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_KNOWLEDGE_NODES, keys: { id: 1 }, options: { unique: true } },
      {
        collection: TABLE_KNOWLEDGE_NODES,
        keys: { activeNameScopeKey: 1 },
        options: { unique: true, sparse: true },
      },
      { collection: TABLE_KNOWLEDGE_NODES, keys: { canonicalName: 1, updatedAt: -1, id: 1 } },
      { collection: TABLE_KNOWLEDGE_RECORDS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_KNOWLEDGE_RECORDS, keys: { nodeId: 1, id: -1 } },
      { collection: TABLE_KNOWLEDGE_MENTIONS, keys: { recordId: 1, targetNodeId: 1 }, options: { unique: true } },
      { collection: TABLE_KNOWLEDGE_MENTIONS, keys: { targetNodeId: 1, recordId: -1 } },
      { collection: TABLE_KNOWLEDGE_NODE_SCOPES, keys: { nodeId: 1, scopeNodeId: 1 }, options: { unique: true } },
      { collection: TABLE_KNOWLEDGE_NODE_SCOPES, keys: { scopeNodeId: 1, nodeId: 1 } },
      { collection: TABLE_KNOWLEDGE_RECORD_SCOPES, keys: { recordId: 1, scopeNodeId: 1 }, options: { unique: true } },
      { collection: TABLE_KNOWLEDGE_RECORD_SCOPES, keys: { scopeNodeId: 1, recordId: 1 } },
      { collection: TABLE_KNOWLEDGE_SCOPE_GRANTS, keys: { scopeNodeId: 1, scopeRefId: 1 }, options: { unique: true } },
      { collection: TABLE_KNOWLEDGE_SCOPE_GRANTS, keys: { scopeRefId: 1, scopeNodeId: 1 } },
      { collection: TABLE_KNOWLEDGE_SCOPE_ADDRESSES, keys: { address: 1 }, options: { unique: true } },
      { collection: TABLE_KNOWLEDGE_SCOPE_ADDRESSES, keys: { scopeNodeId: 1 }, options: { unique: true } },
      { collection: TABLE_KNOWLEDGE_ACCESS_STATE, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_KNOWLEDGE_NODE_ADDRESSES, keys: { source: 1, address: 1 }, options: { unique: true } },
      { collection: TABLE_KNOWLEDGE_NODE_ADDRESSES, keys: { nodeId: 1 } },
      {
        collection: TABLE_KNOWLEDGE_IMPORT_STATE,
        keys: { importerId: 1, binding: 1, key: 1 },
        options: { unique: true },
      },
      { collection: TABLE_KNOWLEDGE_IMPORT_RUNS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_KNOWLEDGE_IMPORT_RUNS, keys: { importerId: 1, binding: 1, queuedAt: -1 } },
      { collection: TABLE_KNOWLEDGE_PROPOSALS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_KNOWLEDGE_CURSORS, keys: { sourceThreadId: 1, agent: 1 }, options: { unique: true } },
      { collection: TABLE_KNOWLEDGE_ACTIVITY, keys: { id: -1 } },
      { collection: TABLE_KNOWLEDGE_SEMANTIC_OUTBOX, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_KNOWLEDGE_SEMANTIC_OUTBOX, keys: { idempotencyKey: 1 }, options: { unique: true } },
      { collection: TABLE_KNOWLEDGE_SEMANTIC_OUTBOX, keys: { status: 1, availableAt: 1, createdAt: 1, id: 1 } },
    ];
  }

  async #transaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
    if (!(await this.#connector.supportsTransactions())) {
      throw new KnowledgeSchemaError('MongoDB Knowledge mutations require replica-set transaction support.');
    }
    return this.#connector.withTransaction(async session => {
      if (!session) throw new KnowledgeSchemaError('MongoDB Knowledge mutation started without a transaction session.');
      await (
        await this.#collection(TABLE_KNOWLEDGE_ACCESS_STATE)
      ).findOne({ id: 'global' }, { ...sessionOptions(session) });
      return operation(session);
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#transaction(async session => {
      for (const name of KnowledgeMongoDB.MANAGED_COLLECTIONS) {
        if (name === TABLE_KNOWLEDGE_SCHEMA) continue;
        await (await this.#collection(name)).deleteMany({}, sessionOptions(session));
      }
      await (
        await this.#collection(TABLE_KNOWLEDGE_ACCESS_STATE)
      ).insertOne({ id: 'global', epoch: 0 }, sessionOptions(session));
    });
  }

  async getAccessEpoch(): Promise<number> {
    const row = await (await this.#collection(TABLE_KNOWLEDGE_ACCESS_STATE)).findOne({ id: 'global' });
    return Number(row?.epoch ?? 0);
  }

  async #assertExpectedAccessEpoch(session: ClientSession, expectedAccessEpoch?: number): Promise<void> {
    if (expectedAccessEpoch === undefined) return;
    const row = await (
      await this.#collection(TABLE_KNOWLEDGE_ACCESS_STATE)
    ).findOne({ id: 'global' }, sessionOptions(session));
    if (Number(row?.epoch ?? 0) !== expectedAccessEpoch)
      throw new KnowledgeConflictError('Knowledge access changed during mutation authorization');
  }

  async #bumpAccessEpoch(session: ClientSession): Promise<number> {
    const result = await (
      await this.#collection(TABLE_KNOWLEDGE_ACCESS_STATE)
    ).findOneAndUpdate(
      { id: 'global' },
      { $inc: { epoch: 1 } },
      { ...sessionOptions(session), returnDocument: 'after' },
    );
    return Number(result?.epoch ?? 0);
  }

  async #assertScopeNodes(scopeIds: KnowledgeScopeIds, session?: ClientSession): Promise<KnowledgeScopeIds> {
    const canonical = canonicalizeKnowledgeScopeIds(scopeIds);
    if (!canonical.length) return canonical;
    const count = await (
      await this.#collection(TABLE_KNOWLEDGE_NODES)
    ).countDocuments({ id: { $in: canonical }, isScope: true, deletedAt: { $exists: false } }, sessionOptions(session));
    if (count !== canonical.length) throw new KnowledgeNotFoundError('scope', canonical.join(','));
    return canonical;
  }

  async listScopeGrants(input: { includeDeleted?: boolean } = {}): Promise<KnowledgeScopeGrant[]> {
    const rows = await (
      await this.#collection(TABLE_KNOWLEDGE_SCOPE_GRANTS)
    )
      .find(input.includeDeleted ? {} : { deletedAt: { $exists: false } })
      .sort({ scopeNodeId: 1, scopeRefId: 1 })
      .toArray();
    return rows.map(row => ({
      scopeNodeId: String(row.scopeNodeId),
      scopeRefId: String(row.scopeRefId),
      role: row.role,
      canSuggest: row.canSuggest ? true : undefined,
    }));
  }

  async reconcileScopeReferenceGrants(input: {
    scopeRefId: string;
    grants: KnowledgeScopeGrant[];
    expectedAccessEpoch?: number;
  }): Promise<{ changed: boolean; accessEpoch: number }> {
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
      if (input.grants.some(grant => grant.scopeRefId !== input.scopeRefId)) {
        throw new KnowledgeConflictError(input.scopeRefId);
      }
      const normalized = [...new Map(input.grants.map(grant => [grant.scopeNodeId, grant])).values()].sort((a, b) =>
        a.scopeNodeId.localeCompare(b.scopeNodeId),
      );
      await this.#assertScopeNodes(
        normalized.map(grant => grant.scopeNodeId),
        session,
      );
      const collection = await this.#collection(TABLE_KNOWLEDGE_SCOPE_GRANTS);
      const existing = await collection.find({ scopeRefId: input.scopeRefId }, sessionOptions(session)).toArray();
      const existingKey = JSON.stringify(
        existing
          .filter(row => !row.deletedAt)
          .map(row => [row.scopeNodeId, row.role, Boolean(row.canSuggest)])
          .sort(),
      );
      const nextKey = JSON.stringify(
        normalized.map(grant => [grant.scopeNodeId, grant.role, Boolean(grant.canSuggest)]),
      );
      if (existingKey === nextKey) return { changed: false, accessEpoch: await this.getAccessEpoch() };
      await collection.deleteMany({ scopeRefId: input.scopeRefId }, sessionOptions(session));
      if (normalized.length)
        await collection.insertMany(
          normalized.map(grant => ({ ...grant })),
          sessionOptions(session),
        );
      return { changed: true, accessEpoch: await this.#bumpAccessEpoch(session) };
    });
  }

  async upsertScopeGrant(
    grant: KnowledgeScopeGrant,
    fence: { expectedAccessEpoch?: number } = {},
  ): Promise<{ changed: boolean; accessEpoch: number }> {
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, fence.expectedAccessEpoch);
      await this.#assertScopeNodes([grant.scopeNodeId], session);
      const collection = await this.#collection(TABLE_KNOWLEDGE_SCOPE_GRANTS);
      const existing = await collection.findOne(
        { scopeNodeId: grant.scopeNodeId, scopeRefId: grant.scopeRefId },
        sessionOptions(session),
      );
      if (
        existing &&
        !existing.deletedAt &&
        existing.role === grant.role &&
        Boolean(existing.canSuggest) === Boolean(grant.canSuggest)
      ) {
        return { changed: false, accessEpoch: await this.getAccessEpoch() };
      }
      await collection.updateOne(
        { scopeNodeId: grant.scopeNodeId, scopeRefId: grant.scopeRefId },
        {
          $set: { role: grant.role, canSuggest: grant.canSuggest ?? false },
          $unset: { deletedAt: '' },
          $setOnInsert: { scopeNodeId: grant.scopeNodeId, scopeRefId: grant.scopeRefId },
        },
        { ...sessionOptions(session), upsert: true },
      );
      return { changed: true, accessEpoch: await this.#bumpAccessEpoch(session) };
    });
  }

  async removeScopeGrant(input: {
    scopeNodeId: string;
    scopeRefId: string;
    expectedAccessEpoch?: number;
  }): Promise<{ changed: boolean; accessEpoch: number }> {
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
      const result = await (
        await this.#collection(TABLE_KNOWLEDGE_SCOPE_GRANTS)
      ).deleteOne({ scopeNodeId: input.scopeNodeId, scopeRefId: input.scopeRefId }, sessionOptions(session));
      if (!result.deletedCount) return { changed: false, accessEpoch: await this.getAccessEpoch() };
      return { changed: true, accessEpoch: await this.#bumpAccessEpoch(session) };
    });
  }

  async reconcileStructure(
    plan: KnowledgeStructurePlan,
    options: { expectedAccessEpoch?: number; expectedAbsentScopeAddresses?: string[] } = {},
  ): Promise<KnowledgeStructureReconcileResult> {
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, options.expectedAccessEpoch);
      const addresses = await this.#collection(TABLE_KNOWLEDGE_SCOPE_ADDRESSES);
      for (const address of options.expectedAbsentScopeAddresses ?? []) {
        if (await addresses.findOne({ address }, sessionOptions(session))) {
          throw new KnowledgeConflictError(`Knowledge scope address already exists: ${address}`);
        }
      }
      const scopes: Record<string, string> = {};
      const createdScopeIds: string[] = [];
      const deletedScopeAddresses = new Set<string>();
      let changed = false;
      for (const declaration of plan.scopes) {
        const existingAddress = await addresses.findOne({ address: declaration.address }, sessionOptions(session));
        if (existingAddress) {
          const existingNode = await (
            await this.#collection(TABLE_KNOWLEDGE_NODES)
          ).findOne({ id: existingAddress.scopeNodeId }, sessionOptions(session));
          if (!existingNode?.isScope)
            throw new KnowledgeSchemaError(`Knowledge address ${declaration.address} does not reference a scope`);
          scopes[declaration.address] = String(existingAddress.scopeNodeId);
          if (existingNode.deletedAt) deletedScopeAddresses.add(declaration.address);
          continue;
        }
        const id = randomUUID();
        const now = new Date();
        await (
          await this.#collection(TABLE_KNOWLEDGE_NODES)
        ).insertOne(
          {
            id,
            type: 'node',
            name: declaration.name,
            canonicalName: canonicalName(declaration.name),
            kind: declaration.kind,
            isScope: true,
            metadata: declaration.metadata,
            version: 1,
            createdAt: now,
            updatedAt: now,
          },
          sessionOptions(session),
        );
        await addresses.insertOne({ address: declaration.address, scopeNodeId: id }, sessionOptions(session));
        scopes[declaration.address] = id;
        createdScopeIds.push(id);
        changed = true;
      }
      for (const declaration of plan.scopes) {
        if (deletedScopeAddresses.has(declaration.address)) continue;
        const scopeNodeId = scopes[declaration.address]!;
        const parentIds =
          declaration.parentAddresses
            ?.map(address => scopes[address])
            .filter((scopeId): scopeId is string => scopeId !== undefined) ?? [];
        if (parentIds.length !== (declaration.parentAddresses?.length ?? 0)) {
          throw new KnowledgeNotFoundError('scope', declaration.address);
        }
        const existingNode = await (
          await this.#collection(TABLE_KNOWLEDGE_NODES)
        ).findOne({ id: scopeNodeId }, sessionOptions(session));
        const activeNameScopeKey = `${canonicalName(String(existingNode!.name))}\u0000${knowledgeScopeIdsKey(parentIds)}`;
        if (existingNode!.activeNameScopeKey !== activeNameScopeKey) {
          await (
            await this.#collection(TABLE_KNOWLEDGE_NODES)
          ).updateOne({ id: scopeNodeId }, { $set: { activeNameScopeKey } }, sessionOptions(session));
        }
        const oldParents = await this.#getNodeScopeIds(scopeNodeId, session);
        if (knowledgeScopeIdsKey(oldParents) !== knowledgeScopeIdsKey(parentIds)) {
          await this.#replaceNodeScopes(scopeNodeId, parentIds, session);
          changed = true;
        }
        const desiredGrants = [];
        for (const grant of declaration.grants ?? []) {
          const scopeRefId = scopes[grant.scopeRefAddress];
          if (!scopeRefId || deletedScopeAddresses.has(grant.scopeRefAddress)) {
            throw new Error(`Knowledge grant scope does not exist: ${grant.scopeRefAddress}`);
          }
          desiredGrants.push({ scopeNodeId, scopeRefId, role: grant.role, canSuggest: grant.canSuggest });
        }
        const grants = await this.#collection(TABLE_KNOWLEDGE_SCOPE_GRANTS);
        const existingGrants = await grants.find({ scopeNodeId }, sessionOptions(session)).toArray();
        const oldKey = JSON.stringify(
          existingGrants.map(row => [row.scopeRefId, row.role, Boolean(row.canSuggest)]).sort(),
        );
        const newKey = JSON.stringify(
          desiredGrants.map(grant => [grant.scopeRefId, grant.role, Boolean(grant.canSuggest)]).sort(),
        );
        if (oldKey !== newKey) {
          await grants.deleteMany({ scopeNodeId }, sessionOptions(session));
          if (desiredGrants.length) await grants.insertMany(desiredGrants, sessionOptions(session));
          changed = true;
        }
      }
      const accessEpoch = changed ? await this.#bumpAccessEpoch(session) : await this.getAccessEpoch();
      return {
        scopes,
        createdScopeIds,
        deletedScopeAddresses: [...deletedScopeAddresses],
        changed,
        accessEpoch,
      };
    });
  }

  async getScopeAddress(address: string): Promise<KnowledgeScopeAddress | null> {
    const row = await (await this.#collection(TABLE_KNOWLEDGE_SCOPE_ADDRESSES)).findOne({ address });
    return row ? { address: String(row.address), scopeNodeId: String(row.scopeNodeId) } : null;
  }

  async getNodeAddress(input: { source: string; address: string }): Promise<KnowledgeNodeAddress | null> {
    const row = await (await this.#collection(TABLE_KNOWLEDGE_NODE_ADDRESSES)).findOne(input);
    if (!row || !(await this.getNode(String(row.nodeId)))) return null;
    return { source: String(row.source), address: String(row.address), nodeId: String(row.nodeId) };
  }

  async listNodeAddresses(input: { source: string }): Promise<KnowledgeNodeAddress[]> {
    const rows = await (
      await this.#collection(TABLE_KNOWLEDGE_NODE_ADDRESSES)
    )
      .find({ source: input.source })
      .sort({ address: 1 })
      .toArray();
    const addresses: KnowledgeNodeAddress[] = [];
    for (const row of rows) {
      if (!(await this.getNode(String(row.nodeId)))) continue;
      addresses.push({ source: String(row.source), address: String(row.address), nodeId: String(row.nodeId) });
    }
    return addresses;
  }

  async setNodeAddress(input: KnowledgeNodeAddress & { expectedAccessEpoch?: number }): Promise<KnowledgeNodeAddress> {
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
      const node = await (
        await this.#collection(TABLE_KNOWLEDGE_NODES)
      ).findOne({ id: input.nodeId, deletedAt: { $exists: false } }, sessionOptions(session));
      if (!node) throw new KnowledgeNotFoundError('node', input.nodeId);
      const collection = await this.#collection(TABLE_KNOWLEDGE_NODE_ADDRESSES);
      const existing = await collection.findOne(
        { source: input.source, address: input.address },
        sessionOptions(session),
      );
      if (existing && existing.nodeId !== input.nodeId) throw new KnowledgeConflictError(input.address);
      await collection.updateOne(
        { source: input.source, address: input.address },
        { $setOnInsert: { source: input.source, address: input.address, nodeId: input.nodeId } },
        { ...sessionOptions(session), upsert: true },
      );
      return { source: input.source, address: input.address, nodeId: input.nodeId };
    });
  }

  async removeNodeAddress(input: {
    source: string;
    address: string;
    nodeId: string;
    expectedAccessEpoch?: number;
  }): Promise<void> {
    await this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
      const result = await (
        await this.#collection(TABLE_KNOWLEDGE_NODE_ADDRESSES)
      ).deleteOne({ source: input.source, address: input.address, nodeId: input.nodeId }, sessionOptions(session));
      if (!result.deletedCount) throw new KnowledgeConflictError(input.address);
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
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
      const collection = await this.#collection(TABLE_KNOWLEDGE_NODE_ADDRESSES);
      if (await collection.findOne({ source: input.source, address: input.newAddress }, sessionOptions(session))) {
        throw new KnowledgeConflictError(input.newAddress);
      }
      const result = await collection.findOneAndUpdate(
        { source: input.source, address: input.address, nodeId: input.nodeId },
        { $set: { address: input.newAddress } },
        { ...sessionOptions(session), returnDocument: 'after' },
      );
      if (!result) throw new KnowledgeConflictError(input.address);
      await this.#activity(
        'rebind',
        'node',
        input.nodeId,
        undefined,
        input.importRunId,
        { scopeIds: await this.#getNodeScopeIds(input.nodeId, session), address: input.newAddress },
        session,
      );
      return { source: input.source, address: input.newAddress, nodeId: input.nodeId };
    });
  }

  async createNodeWithAddress(input: {
    source: string;
    address: string;
    node: CreateKnowledgeNodeInput;
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeNode> {
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
      const addresses = await this.#collection(TABLE_KNOWLEDGE_NODE_ADDRESSES);
      const existing = await addresses.findOne(
        { source: input.source, address: input.address },
        sessionOptions(session),
      );
      if (existing) {
        const node = await (
          await this.#collection(TABLE_KNOWLEDGE_NODES)
        ).findOne({ id: existing.nodeId, deletedAt: { $exists: false } }, sessionOptions(session));
        if (!node) throw new KnowledgeConflictError(input.address);
        return nodeFromDocument(node);
      }
      const node = await this.#createNode({ ...input.node, expectedAccessEpoch: undefined }, session);
      await addresses.insertOne(
        { source: input.source, address: input.address, nodeId: node.id },
        sessionOptions(session),
      );
      return node;
    });
  }

  async deleteNodeByAddress(input: {
    source: string;
    address: string;
    scopeId: string;
    importRunId?: string;
    expectedAccessEpoch?: number;
  }): Promise<{ node: KnowledgeNode; deleted: boolean }> {
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
      const addressCollection = await this.#collection(TABLE_KNOWLEDGE_NODE_ADDRESSES);
      const address = await addressCollection.findOne(
        { source: input.source, address: input.address },
        sessionOptions(session),
      );
      if (!address) throw new KnowledgeNotFoundError('node address', input.address);
      const nodes = await this.#collection(TABLE_KNOWLEDGE_NODES);
      const existing = await nodes.findOne(
        { id: address.nodeId, deletedAt: { $exists: false } },
        sessionOptions(session),
      );
      if (!existing) throw new KnowledgeNotFoundError('node', String(address.nodeId));
      const node = nodeFromDocument(existing);
      if (node.isScope) throw new KnowledgeConflictError(`Knowledge scopes cannot be permanently deleted: ${node.id}`);
      const memberships = await this.#getNodeScopeIds(node.id, session);
      if (!memberships.includes(input.scopeId)) throw new KnowledgeNotFoundError('node address', input.address);

      await addressCollection.deleteOne(
        { source: input.source, address: input.address, nodeId: node.id },
        sessionOptions(session),
      );
      const records = await this.#collection(TABLE_KNOWLEDGE_RECORDS);
      const owned = await records.find({ nodeId: node.id, source: input.source }, sessionOptions(session)).toArray();
      for (const row of owned) {
        const recordScopeIds = await this.#getRecordScopeIds(String(row.id), session);
        if (recordScopeIds.length === 1 && recordScopeIds[0] === input.scopeId) {
          await this.#deleteRecordPermanently(recordFromDocument(row), input.importRunId, undefined, session);
        }
      }
      const remainingAddresses = await addressCollection.countDocuments({ nodeId: node.id }, sessionOptions(session));
      const remainingRecords = await records.countDocuments({ nodeId: node.id }, sessionOptions(session));
      if (remainingAddresses || remainingRecords) return { node, deleted: false };

      await this.#activity('delete', 'node', node.id, undefined, input.importRunId, { scopeIds: memberships }, session);
      await this.#outbox('node', node.id, 'delete', memberships, node.version + 1, session);
      await (
        await this.#collection(TABLE_KNOWLEDGE_NODE_SCOPES)
      ).deleteMany({ nodeId: node.id }, sessionOptions(session));
      const updatedAt = new Date();
      const deleted = await nodes.findOneAndUpdate(
        { id: node.id, version: node.version, deletedAt: { $exists: false } },
        {
          $set: { deletedAt: updatedAt, deletedBy: `importer:${input.source}`, updatedAt },
          $unset: { activeNameScopeKey: '' },
          $inc: { version: 1 },
        },
        { ...sessionOptions(session), returnDocument: 'after' },
      );
      if (!deleted) throw new KnowledgeConflictError(node.id);
      return { node, deleted: true };
    });
  }

  async deleteRecordBySource(input: {
    id: string;
    version: number;
    source: string;
    importRunId?: string;
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeRecord> {
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
      const records = await this.#collection(TABLE_KNOWLEDGE_RECORDS);
      const existing = await records.findOne({ id: input.id }, sessionOptions(session));
      if (!existing || existing.source !== input.source) throw new KnowledgeNotFoundError('record', input.id);
      if (Number(existing.version) !== input.version) throw new KnowledgeConflictError(input.id);
      const record = recordFromDocument(existing);
      await this.#deleteRecordPermanently(record, input.importRunId, input.version, session);
      return record;
    });
  }

  async #deleteRecordPermanently(
    record: KnowledgeRecord,
    importRunId: string | undefined,
    expectedVersion: number | undefined,
    session: ClientSession,
  ): Promise<void> {
    const scopeIds = await this.#getRecordScopeIds(record.id, session);
    const mentions = await this.#collection(TABLE_KNOWLEDGE_MENTIONS);
    const hasMentions = (await mentions.countDocuments({ recordId: record.id }, sessionOptions(session))) > 0;
    await this.#activity(
      'delete',
      'record',
      record.id,
      undefined,
      importRunId,
      hasMentions ? undefined : { scopeIds },
      session,
    );
    const outbox = await this.#collection(TABLE_KNOWLEDGE_SEMANTIC_OUTBOX);
    await outbox.deleteMany({ documentId: knowledgeSemanticDocumentId('record', record.id) }, sessionOptions(session));
    await this.#outbox('record', record.id, 'delete', hasMentions ? [] : scopeIds, record.version + 1, session);
    await mentions.deleteMany({ recordId: record.id }, sessionOptions(session));
    await (
      await this.#collection(TABLE_KNOWLEDGE_RECORD_SCOPES)
    ).deleteMany({ recordId: record.id }, sessionOptions(session));
    const result = await (
      await this.#collection(TABLE_KNOWLEDGE_RECORDS)
    ).deleteOne(
      expectedVersion === undefined ? { id: record.id } : { id: record.id, version: expectedVersion },
      sessionOptions(session),
    );
    if (expectedVersion !== undefined && result.deletedCount !== 1) throw new KnowledgeConflictError(record.id);
  }

  async getNodeScopeIds(nodeId: string): Promise<KnowledgeScopeIds> {
    return this.#getNodeScopeIds(nodeId);
  }

  async #getNodeScopeIds(nodeId: string, session?: ClientSession): Promise<KnowledgeScopeIds> {
    const rows = await (
      await this.#collection(TABLE_KNOWLEDGE_NODE_SCOPES)
    )
      .find({ nodeId }, sessionOptions(session))
      .sort({ scopeNodeId: 1 })
      .toArray();
    return rows.map(row => String(row.scopeNodeId));
  }

  async getRecordScopeIds(recordId: string): Promise<KnowledgeScopeIds> {
    return this.#getRecordScopeIds(recordId);
  }

  async #assertScopeIsEmpty(scopeId: string, session: ClientSession): Promise<void> {
    const memberships = await (
      await this.#collection(TABLE_KNOWLEDGE_NODE_SCOPES)
    )
      .find({ scopeNodeId: scopeId, nodeId: { $ne: scopeId } }, sessionOptions(session))
      .toArray();
    if (!memberships.length) return;
    const liveMembers = await (
      await this.#collection(TABLE_KNOWLEDGE_NODES)
    ).countDocuments(
      { id: { $in: memberships.map(membership => String(membership.nodeId)) }, deletedAt: { $exists: false } },
      sessionOptions(session),
    );
    if (liveMembers) throw new KnowledgeConflictError(`Knowledge scope is not empty: ${scopeId}`);
  }

  async #assertScopeHasNoDependents(scopeId: string, session: ClientSession): Promise<void> {
    const options = sessionOptions(session);
    const [nodeMemberships, recordMemberships, grants, addresses] = await Promise.all([
      (await this.#collection(TABLE_KNOWLEDGE_NODE_SCOPES)).countDocuments(
        { scopeNodeId: scopeId, nodeId: { $ne: scopeId } },
        options,
      ),
      (await this.#collection(TABLE_KNOWLEDGE_RECORD_SCOPES)).countDocuments({ scopeNodeId: scopeId }, options),
      (await this.#collection(TABLE_KNOWLEDGE_SCOPE_GRANTS)).countDocuments(
        { $or: [{ scopeNodeId: scopeId }, { scopeRefId: scopeId }] },
        options,
      ),
      (await this.#collection(TABLE_KNOWLEDGE_SCOPE_ADDRESSES)).countDocuments({ scopeNodeId: scopeId }, options),
    ]);
    if (nodeMemberships || recordMemberships || grants || addresses) {
      throw new KnowledgeConflictError(`Knowledge scope has dependents: ${scopeId}`);
    }
  }

  async #getRecordScopeIds(recordId: string, session?: ClientSession): Promise<KnowledgeScopeIds> {
    const rows = await (
      await this.#collection(TABLE_KNOWLEDGE_RECORD_SCOPES)
    )
      .find({ recordId }, sessionOptions(session))
      .sort({ scopeNodeId: 1 })
      .toArray();
    return rows.map(row => String(row.scopeNodeId));
  }

  async #replaceNodeScopes(nodeId: string, scopeIds: KnowledgeScopeIds, session: ClientSession): Promise<void> {
    const collection = await this.#collection(TABLE_KNOWLEDGE_NODE_SCOPES);
    await collection.deleteMany({ nodeId, scopeNodeId: { $nin: scopeIds } }, sessionOptions(session));
    if (scopeIds.length) {
      await collection.bulkWrite(
        scopeIds.map(scopeNodeId => ({
          updateOne: {
            filter: { nodeId, scopeNodeId },
            update: { $setOnInsert: { nodeId, scopeNodeId, addedAt: new Date() } },
            upsert: true,
          },
        })),
        sessionOptions(session),
      );
    }
  }

  async #replaceRecordScopes(recordId: string, scopeIds: KnowledgeScopeIds, session: ClientSession): Promise<void> {
    const collection = await this.#collection(TABLE_KNOWLEDGE_RECORD_SCOPES);
    await collection.deleteMany({ recordId, scopeNodeId: { $nin: scopeIds } }, sessionOptions(session));
    if (scopeIds.length) {
      await collection.bulkWrite(
        scopeIds.map(scopeNodeId => ({
          updateOne: {
            filter: { recordId, scopeNodeId },
            update: { $setOnInsert: { recordId, scopeNodeId, addedAt: new Date() } },
            upsert: true,
          },
        })),
        sessionOptions(session),
      );
    }
  }

  async createNode(input: CreateKnowledgeNodeInput): Promise<KnowledgeNode> {
    try {
      return await this.#transaction(async session => {
        await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
        return this.#createNode(input, session);
      });
    } catch (error) {
      if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
      const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
      const existing = await (
        await this.#collection(TABLE_KNOWLEDGE_NODES)
      ).findOne({
        activeNameScopeKey: `${canonicalName(input.name)}\u0000${knowledgeScopeIdsKey(scopeIds)}`,
        deletedAt: { $exists: false },
      });
      if (!existing) throw new KnowledgeConflictError(input.name);
      return nodeFromDocument(existing);
    }
  }

  async #createNode(input: CreateKnowledgeNodeInput, session: ClientSession): Promise<KnowledgeNode> {
    const scopeIds = await this.#assertScopeNodes(input.scopeIds, session);
    const normalizedName = canonicalName(input.name);
    await (
      await this.#collection(TABLE_KNOWLEDGE_ACCESS_STATE)
    ).updateOne(
      { id: `name-lock:${normalizedName}` },
      { $inc: { revision: 1 } },
      { ...sessionOptions(session), upsert: true },
    );
    const sameName = await (
      await this.#collection(TABLE_KNOWLEDGE_NODES)
    )
      .find({ canonicalName: normalizedName }, sessionOptions(session))
      .toArray();
    for (const row of sameName) {
      const existingScopeIds = await this.#getNodeScopeIds(String(row.id), session);
      if (knowledgeScopeIdsKey(existingScopeIds) === knowledgeScopeIdsKey(scopeIds)) {
        if (row.deletedAt) throw new KnowledgeConflictError(String(row.id));
        return nodeFromDocument(row);
      }
      if (!row.deletedAt && existingScopeIds.some(scopeId => scopeIds.includes(scopeId))) {
        throw new KnowledgeConflictError(String(row.id));
      }
    }
    const now = new Date();
    const node: KnowledgeNode = {
      id: canonicalizeKnowledgeNodeId(input.id ?? randomUUID()),
      type: 'node',
      name: input.name.trim(),
      kind: input.kind,
      isScope: input.isScope ?? false,
      metadata: input.metadata,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await (
      await this.#collection(TABLE_KNOWLEDGE_NODES)
    ).insertOne(
      {
        ...node,
        canonicalName: canonicalName(node.name),
        activeNameScopeKey: `${canonicalName(node.name)}\u0000${knowledgeScopeIdsKey(scopeIds)}`,
      },
      sessionOptions(session),
    );
    await this.#replaceNodeScopes(node.id, scopeIds, session);
    await this.#activity('create', 'node', node.id, input.contextScopeId, input.importRunId, { scopeIds }, session);
    await this.#outbox('node', node.id, 'upsert', scopeIds, 1, session);
    if (node.isScope) await this.#bumpAccessEpoch(session);
    return node;
  }

  async getNode(id: string): Promise<KnowledgeNode | null> {
    const row = await (await this.#collection(TABLE_KNOWLEDGE_NODES)).findOne({ id, deletedAt: { $exists: false } });
    return row ? nodeFromDocument(row) : null;
  }

  async getNodeIncludingDeleted(id: string): Promise<KnowledgeNode | null> {
    const row = await (await this.#collection(TABLE_KNOWLEDGE_NODES)).findOne({ id });
    return row ? nodeFromDocument(row) : null;
  }

  async getNodeByName(input: { name: string; scopeIds: KnowledgeScopeIds }): Promise<KnowledgeNode | null> {
    const expected = knowledgeScopeIdsKey(canonicalizeKnowledgeScopeIds(input.scopeIds));
    const rows = await (
      await this.#collection(TABLE_KNOWLEDGE_NODES)
    )
      .find({ canonicalName: canonicalName(input.name), deletedAt: { $exists: false } })
      .toArray();
    for (const row of rows) {
      if (knowledgeScopeIdsKey(await this.#getNodeScopeIds(String(row.id))) === expected) return nodeFromDocument(row);
    }
    return null;
  }

  async resolveNode(input: { name: string; scopeIds: KnowledgeScopeIds }): Promise<KnowledgeNode | null> {
    const vouched = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const rows = await (
      await this.#collection(TABLE_KNOWLEDGE_NODES)
    )
      .find({ canonicalName: canonicalName(input.name), deletedAt: { $exists: false } })
      .toArray();
    const candidates: KnowledgeNode[] = [];
    for (const row of rows) {
      const node = nodeFromDocument(row);
      if (isKnowledgeNodeVisible(node, await this.#getNodeScopeIds(node.id), vouched)) candidates.push(node);
    }
    return candidates.length === 1 ? candidates[0]! : null;
  }

  async listNodes(input: ListKnowledgeNodesInput): Promise<KnowledgeNode[]> {
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const rows = await (
      await this.#collection(TABLE_KNOWLEDGE_NODES)
    )
      .find({ deletedAt: { $exists: false } })
      .sort({ updatedAt: -1, name: 1, id: 1 })
      .toArray();
    const cursor = input.cursor
      ? parseKnowledgeNodeCursor(input.cursor, {
          name: input.name,
          namePrefix: input.namePrefix,
          kind: input.kind,
          isScope: input.isScope,
        })
      : undefined;
    const result: KnowledgeNode[] = [];
    for (const row of rows) {
      const node = nodeFromDocument(row);
      const memberships = await this.#getNodeScopeIds(node.id);
      if (!isKnowledgeNodeVisible(node, memberships, scopeIds)) continue;
      if (input.membershipScopeIds && !isKnowledgeScopeVisible(memberships, input.membershipScopeIds)) continue;
      if (input.name && canonicalName(node.name) !== canonicalName(input.name)) continue;
      if (input.namePrefix && !canonicalName(node.name).startsWith(canonicalName(input.namePrefix))) continue;
      if (input.kind && node.kind !== input.kind) continue;
      if (input.isScope !== undefined && node.isScope !== input.isScope) continue;
      if (
        cursor &&
        !(
          node.updatedAt.getTime() < cursor.updatedAt.getTime() ||
          (node.updatedAt.getTime() === cursor.updatedAt.getTime() &&
            (node.name > cursor.name || (node.name === cursor.name && node.id > cursor.id)))
        )
      )
        continue;
      result.push(node);
      if (result.length >= Math.min(Math.max(input.limit ?? 100, 1), 100)) break;
    }
    return result;
  }

  async updateNode(input: UpdateKnowledgeNodeInput): Promise<KnowledgeNode> {
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
      const existing = await (
        await this.#collection(TABLE_KNOWLEDGE_NODES)
      ).findOne({ id: input.id }, sessionOptions(session));
      if (!existing || existing.deletedAt) throw new KnowledgeNotFoundError('node', input.id);
      if (Number(existing.version) !== input.version) throw new KnowledgeConflictError(input.id);
      const nextName = input.name?.trim() ?? String(existing.name);
      const currentScopes = await this.#getNodeScopeIds(input.id, session);
      const nextScopes = input.scopeIds ? await this.#assertScopeNodes(input.scopeIds, session) : currentScopes;
      if (existing.isScope && input.isScope === false) await this.#assertScopeHasNoDependents(input.id, session);
      if (input.name !== undefined || input.scopeIds !== undefined) {
        const normalizedName = canonicalName(nextName);
        await (
          await this.#collection(TABLE_KNOWLEDGE_ACCESS_STATE)
        ).updateOne(
          { id: `name-lock:${normalizedName}` },
          { $inc: { revision: 1 } },
          { ...sessionOptions(session), upsert: true },
        );
        const sameName = await (
          await this.#collection(TABLE_KNOWLEDGE_NODES)
        )
          .find(
            { canonicalName: normalizedName, id: { $ne: input.id }, deletedAt: { $exists: false } },
            sessionOptions(session),
          )
          .toArray();
        for (const row of sameName) {
          const collisionScopes = await this.#getNodeScopeIds(String(row.id), session);
          if (collisionScopes.some(scopeId => nextScopes.includes(scopeId))) {
            throw new KnowledgeConflictError(String(row.id));
          }
        }
      }
      const updatedAt = new Date();
      const result = await (
        await this.#collection(TABLE_KNOWLEDGE_NODES)
      ).findOneAndUpdate(
        { id: input.id, version: input.version, deletedAt: { $exists: false } },
        {
          $set: {
            name: nextName,
            canonicalName: canonicalName(nextName),
            activeNameScopeKey: `${canonicalName(nextName)}\u0000${knowledgeScopeIdsKey(nextScopes)}`,
            kind: input.kind ?? existing.kind,
            metadata: input.metadata ?? existing.metadata,
            updatedAt,
          },
          $inc: { version: 1 },
        },
        { ...sessionOptions(session), returnDocument: 'after' },
      );
      if (!result) throw new KnowledgeConflictError(input.id);
      const node = nodeFromDocument(result);
      await this.#replaceNodeScopes(node.id, nextScopes, session);
      await this.#activity(
        input.scopeIds ? 'move' : 'edit',
        'node',
        node.id,
        input.contextScopeId,
        input.importRunId,
        { scopeIds: nextScopes },
        session,
      );
      if (knowledgeScopeIdsKey(currentScopes) !== knowledgeScopeIdsKey(nextScopes)) {
        await this.#outbox('node', node.id, 'delete', currentScopes, node.version, session);
      }
      await this.#outbox('node', node.id, 'upsert', nextScopes, node.version, session);
      const records = await (
        await this.#collection(TABLE_KNOWLEDGE_RECORDS)
      )
        .find({ nodeId: node.id }, sessionOptions(session))
        .toArray();
      for (const recordDocument of records) {
        const record = recordFromDocument(recordDocument);
        await (
          await this.#collection(TABLE_KNOWLEDGE_RECORDS)
        ).updateOne(
          { id: record.id, version: record.version },
          { $set: { updatedAt }, $inc: { version: 1 } },
          sessionOptions(session),
        );
        await this.#outbox(
          'record',
          record.id,
          record.deletedAt ? 'delete' : 'upsert',
          await this.#getRecordScopeIds(record.id, session),
          record.version + 1,
          session,
        );
      }
      return node;
    });
  }

  async deleteNode(input: DeleteKnowledgeNodeInput): Promise<KnowledgeNode> {
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
      const existing = await (
        await this.#collection(TABLE_KNOWLEDGE_NODES)
      ).findOne({ id: input.id }, sessionOptions(session));
      if (!existing || existing.deletedAt) throw new KnowledgeNotFoundError('node', input.id);
      if (Number(existing.version) !== input.version) throw new KnowledgeConflictError(input.id);
      if (existing.isScope) await this.#assertScopeIsEmpty(input.id, session);
      const memberships = await this.#getNodeScopeIds(input.id, session);
      const updatedAt = new Date();
      const result = await (
        await this.#collection(TABLE_KNOWLEDGE_NODES)
      ).findOneAndUpdate(
        { id: input.id, version: input.version, deletedAt: { $exists: false } },
        {
          $set: { deletedAt: updatedAt, deletedBy: input.deletedBy, updatedAt },
          $unset: { activeNameScopeKey: '' },
          $inc: { version: 1 },
        },
        { ...sessionOptions(session), returnDocument: 'after' },
      );
      if (!result) throw new KnowledgeConflictError(input.id);
      const node = nodeFromDocument(result);
      await this.#activity('delete', 'node', node.id, undefined, undefined, { scopeIds: memberships }, session);
      await this.#outbox('node', node.id, 'delete', memberships, node.version, session);
      if (node.isScope) await this.#bumpAccessEpoch(session);
      return node;
    });
  }

  async restoreNode(input: RestoreKnowledgeNodeInput): Promise<KnowledgeNode> {
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
      const existing = await (
        await this.#collection(TABLE_KNOWLEDGE_NODES)
      ).findOne({ id: input.id }, sessionOptions(session));
      if (!existing?.deletedAt) throw new KnowledgeNotFoundError('node', input.id);
      if (Number(existing.version) !== input.version) throw new KnowledgeConflictError(input.id);
      const memberships = await this.#getNodeScopeIds(input.id, session);
      await this.#assertScopeNodes(memberships, session);
      const normalizedName = canonicalName(String(existing.name));
      await (
        await this.#collection(TABLE_KNOWLEDGE_ACCESS_STATE)
      ).updateOne(
        { id: `name-lock:${normalizedName}` },
        { $inc: { revision: 1 } },
        { ...sessionOptions(session), upsert: true },
      );
      const sameName = await (
        await this.#collection(TABLE_KNOWLEDGE_NODES)
      )
        .find(
          { canonicalName: normalizedName, id: { $ne: input.id }, deletedAt: { $exists: false } },
          sessionOptions(session),
        )
        .toArray();
      for (const row of sameName) {
        const collisionScopes = await this.#getNodeScopeIds(String(row.id), session);
        if (collisionScopes.some(scopeId => memberships.includes(scopeId))) {
          throw new KnowledgeConflictError(String(row.id));
        }
      }
      const updatedAt = new Date();
      const result = await (
        await this.#collection(TABLE_KNOWLEDGE_NODES)
      ).findOneAndUpdate(
        { id: input.id, version: input.version, deletedAt: { $exists: true } },
        {
          $unset: { deletedAt: '', deletedBy: '' },
          $set: {
            updatedAt,
            activeNameScopeKey: `${canonicalName(String(existing.name))}\u0000${knowledgeScopeIdsKey(memberships)}`,
          },
          $inc: { version: 1 },
        },
        { ...sessionOptions(session), returnDocument: 'after' },
      );
      if (!result) throw new KnowledgeConflictError(input.id);
      const node = nodeFromDocument(result);
      await this.#activity('restore', 'node', node.id, undefined, undefined, { scopeIds: memberships }, session);
      await this.#outbox('node', node.id, 'upsert', memberships, node.version, session);
      if (node.isScope) await this.#bumpAccessEpoch(session);
      return { ...node, deletedAt: undefined, deletedBy: undefined };
    });
  }

  async promoteNode(input: PromoteKnowledgeNodeInput): Promise<KnowledgeNode> {
    return this.#transaction(session => this.#promoteNode(input, session));
  }

  async #promoteNode(
    input: PromoteKnowledgeNodeInput,
    session: ClientSession,
    expectedRecordVersions?: Map<string, number>,
  ): Promise<KnowledgeNode> {
    await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
    await this.#assertScopeNodes([input.sourceScopeId, input.destinationScopeId], session);
    const row = await (
      await this.#collection(TABLE_KNOWLEDGE_NODES)
    ).findOne({ id: input.id, deletedAt: { $exists: false } }, sessionOptions(session));
    if (!row) throw new KnowledgeNotFoundError('node', input.id);
    if (Number(row.version) !== input.version) throw new KnowledgeConflictError(input.id);
    const nodeScopes = await this.#getNodeScopeIds(input.id, session);
    if (!nodeScopes.includes(input.sourceScopeId)) throw new KnowledgeConflictError(input.id);
    const nextNodeScopes = canonicalizeKnowledgeScopeIds([
      ...nodeScopes.filter(scopeId => scopeId !== input.sourceScopeId),
      input.destinationScopeId,
    ]);
    const records = await (
      await this.#collection(TABLE_KNOWLEDGE_RECORDS)
    )
      .find({ nodeId: input.id, deletedAt: { $exists: false } }, sessionOptions(session))
      .toArray();
    if (
      expectedRecordVersions &&
      (records.length !== expectedRecordVersions.size ||
        records.some(record => expectedRecordVersions.get(String(record.id)) !== Number(record.version)))
    ) {
      throw new KnowledgeConflictError('Promotion record set changed');
    }
    for (const recordRow of records) {
      const recordId = String(recordRow.id);
      const scopes = await this.#getRecordScopeIds(recordId, session);
      const nextScopes = canonicalizeKnowledgeScopeIds([
        ...scopes.filter(scopeId => scopeId !== input.sourceScopeId),
        input.destinationScopeId,
      ]);
      await this.#replaceRecordScopes(recordId, nextScopes, session);
      const nextVersion = Number(recordRow.version) + 1;
      await (
        await this.#collection(TABLE_KNOWLEDGE_RECORDS)
      ).updateOne(
        { id: recordId, version: Number(recordRow.version) },
        { $set: { updatedAt: new Date() }, $inc: { version: 1 } },
        sessionOptions(session),
      );
      await this.#outbox('record', recordId, 'upsert', nextScopes, nextVersion, session);
    }
    const result = await (
      await this.#collection(TABLE_KNOWLEDGE_NODES)
    ).findOneAndUpdate(
      { id: input.id, version: input.version, deletedAt: { $exists: false } },
      {
        $set: {
          updatedAt: new Date(),
          activeNameScopeKey: `${canonicalName(String(row.name))}\u0000${knowledgeScopeIdsKey(nextNodeScopes)}`,
        },
        $inc: { version: 1 },
      },
      { ...sessionOptions(session), returnDocument: 'after' },
    );
    if (!result) throw new KnowledgeConflictError(input.id);
    await this.#replaceNodeScopes(input.id, nextNodeScopes, session);
    const node = nodeFromDocument(result);
    await this.#activity(
      'promote',
      'node',
      node.id,
      input.contextScopeId,
      undefined,
      { scopeIds: nextNodeScopes },
      session,
    );
    await this.#outbox('node', node.id, 'upsert', nextNodeScopes, node.version, session);
    return node;
  }

  async mergeNodes(input: {
    sourceId: string;
    targetId: string;
    sourceVersion: number;
    targetVersion: number;
    importRunId?: string;
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeNode> {
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
      const nodes = await (
        await this.#collection(TABLE_KNOWLEDGE_NODES)
      )
        .find({ id: { $in: [input.sourceId, input.targetId] }, deletedAt: { $exists: false } }, sessionOptions(session))
        .toArray();
      const sourceRow = nodes.find(row => row.id === input.sourceId);
      const targetRow = nodes.find(row => row.id === input.targetId);
      if (!sourceRow) throw new KnowledgeNotFoundError('node', input.sourceId);
      if (!targetRow) throw new KnowledgeNotFoundError('node', input.targetId);
      if (Number(sourceRow.version) !== input.sourceVersion) throw new KnowledgeConflictError(input.sourceId);
      if (Number(targetRow.version) !== input.targetVersion) throw new KnowledgeConflictError(input.targetId);
      const records = await (
        await this.#collection(TABLE_KNOWLEDGE_RECORDS)
      )
        .find({ nodeId: input.sourceId }, sessionOptions(session))
        .toArray();
      for (const recordRow of records) {
        await (
          await this.#collection(TABLE_KNOWLEDGE_RECORDS)
        ).updateOne(
          { id: recordRow.id, version: recordRow.version },
          { $set: { nodeId: input.targetId, updatedAt: new Date() }, $inc: { version: 1 } },
          sessionOptions(session),
        );
        await this.#outbox(
          'record',
          String(recordRow.id),
          recordRow.deletedAt ? 'delete' : 'upsert',
          await this.#getRecordScopeIds(String(recordRow.id), session),
          Number(recordRow.version) + 1,
          session,
        );
      }
      const mentions = await this.#collection(TABLE_KNOWLEDGE_MENTIONS);
      const sourceMentions = await mentions.find({ targetNodeId: input.sourceId }, sessionOptions(session)).toArray();
      if (sourceMentions.length) {
        const duplicateRecordIds = (
          await mentions
            .find(
              {
                targetNodeId: input.targetId,
                recordId: { $in: sourceMentions.map(mention => mention.recordId) },
              },
              sessionOptions(session),
            )
            .toArray()
        ).map(mention => mention.recordId);
        if (duplicateRecordIds.length) {
          await mentions.deleteMany(
            { targetNodeId: input.sourceId, recordId: { $in: duplicateRecordIds } },
            sessionOptions(session),
          );
        }
        await mentions.updateMany(
          { targetNodeId: input.sourceId },
          { $set: { targetNodeId: input.targetId } },
          sessionOptions(session),
        );
      }
      await (
        await this.#collection(TABLE_KNOWLEDGE_NODE_ADDRESSES)
      ).updateMany({ nodeId: input.sourceId }, { $set: { nodeId: input.targetId } }, sessionOptions(session));
      const now = new Date();
      const sourceResult = await (
        await this.#collection(TABLE_KNOWLEDGE_NODES)
      ).findOneAndUpdate(
        { id: input.sourceId, version: input.sourceVersion, deletedAt: { $exists: false } },
        {
          $set: { deletedAt: now, deletedBy: 'merge', updatedAt: now },
          $unset: { activeNameScopeKey: '' },
          $inc: { version: 1 },
        },
        { ...sessionOptions(session), returnDocument: 'after' },
      );
      if (!sourceResult) throw new KnowledgeConflictError(input.sourceId);
      const sourceScopes = await this.#getNodeScopeIds(input.sourceId, session);
      await this.#activity(
        'merge',
        'node',
        input.sourceId,
        undefined,
        input.importRunId,
        { scopeIds: sourceScopes, targetId: input.targetId },
        session,
      );
      await this.#outbox('node', input.sourceId, 'delete', sourceScopes, Number(sourceResult.version), session);
      await (
        await this.#collection(TABLE_KNOWLEDGE_NODE_SCOPES)
      ).deleteMany({ nodeId: input.sourceId }, sessionOptions(session));
      return nodeFromDocument(targetRow);
    });
  }

  async createRecord(input: CreateKnowledgeRecordInput): Promise<KnowledgeRecord> {
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
      const nodeId = nodeReferenceId(input.node);
      const owner = await (
        await this.#collection(TABLE_KNOWLEDGE_NODES)
      ).findOne({ id: nodeId, deletedAt: { $exists: false } }, sessionOptions(session));
      if (!owner) throw new KnowledgeNotFoundError('node', nodeId);
      const scopeIds = await this.#assertScopeNodes(input.scopeIds, session);
      if (!scopeIds.length) throw new KnowledgeNotFoundError('scope', '');
      const now = new Date();
      const record: KnowledgeRecord = {
        id: input.id ?? createKnowledgeUlid(),
        nodeId,
        text: input.text,
        metadata: input.metadata,
        source: input.source,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      await (await this.#collection(TABLE_KNOWLEDGE_RECORDS)).insertOne({ ...record }, sessionOptions(session));
      await this.#replaceRecordScopes(record.id, scopeIds, session);
      const resolutionScopeIds = await this.#assertScopeNodes(input.resolutionScopeIds ?? scopeIds, session);
      await this.#replaceMentions(record, resolutionScopeIds, session, scopeIds, input.importRunId);
      await this.#activity(
        'create',
        'record',
        record.id,
        input.contextScopeId,
        input.importRunId,
        { scopeIds },
        session,
      );
      await this.#outbox('record', record.id, 'upsert', scopeIds, record.version, session);
      return record;
    });
  }

  async getRecord(input: { id: string; includeDeleted?: boolean }): Promise<KnowledgeRecord | null> {
    const filter: Filter<Document> = { id: input.id };
    if (!input.includeDeleted) filter.deletedAt = { $exists: false };
    const row = await (await this.#collection(TABLE_KNOWLEDGE_RECORDS)).findOne(filter);
    return row ? recordFromDocument(row) : null;
  }

  async getVisibleRecord(input: {
    id: string;
    scopeIds: KnowledgeScopeIds;
    includeDeleted?: boolean;
  }): Promise<KnowledgeRecord | null> {
    const record = await this.getRecord(input);
    if (!record) return null;
    return (await this.#isRecordVisible(record, canonicalizeKnowledgeScopeIds(input.scopeIds))) ? record : null;
  }

  async #isRecordVisible(record: KnowledgeRecord, scopeIds: KnowledgeScopeIds): Promise<boolean> {
    if (!isKnowledgeScopeVisible(await this.#getRecordScopeIds(record.id), scopeIds)) return false;
    const mentions = await (await this.#collection(TABLE_KNOWLEDGE_MENTIONS)).find({ recordId: record.id }).toArray();
    const nodeIds = [record.nodeId, ...mentions.map(mention => String(mention.targetNodeId))];
    for (const nodeId of nodeIds) {
      const node = await this.getNode(nodeId);
      if (!node || !isKnowledgeNodeVisible(node, await this.#getNodeScopeIds(node.id), scopeIds)) return false;
    }
    return true;
  }

  async listRecords(input: QueryKnowledgeRecordsInput): Promise<QueryKnowledgeRecordsOutput> {
    return this.#queryRecords(input, { nodeId: nodeReferenceId(input.node) });
  }

  async listRecordsBySource(input: QueryKnowledgeRecordsBySourceInput): Promise<QueryKnowledgeRecordsOutput> {
    return this.#queryRecords(input, { source: input.source }, 1);
  }

  async listMentioningRecords(input: QueryKnowledgeRecordsInput): Promise<QueryKnowledgeRecordsOutput> {
    const targetNodeId = nodeReferenceId(input.node);
    const mentions = await (
      await this.#collection(TABLE_KNOWLEDGE_MENTIONS)
    )
      .find({ targetNodeId })
      .sort({ recordId: -1 })
      .toArray();
    return this.#queryRecords(input, { id: { $in: mentions.map(mention => String(mention.recordId)) } });
  }

  async listRelatedRecords(input: QueryKnowledgeRecordsInput): Promise<QueryKnowledgeRecordsOutput> {
    const nodeId = nodeReferenceId(input.node);
    const mentions = await (await this.#collection(TABLE_KNOWLEDGE_MENTIONS)).find({ targetNodeId: nodeId }).toArray();
    return this.#queryRecords(input, {
      $or: [{ nodeId }, { id: { $in: mentions.map(mention => String(mention.recordId)) } }],
    });
  }

  async deleteRecord(input: {
    id: string;
    version: number;
    deletedBy: string;
    importRunId?: string;
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeRecord> {
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
      const existing = await (
        await this.#collection(TABLE_KNOWLEDGE_RECORDS)
      ).findOne({ id: input.id }, sessionOptions(session));
      if (!existing || existing.deletedAt) throw new KnowledgeNotFoundError('record', input.id);
      if (Number(existing.version) !== input.version) throw new KnowledgeConflictError(input.id);
      const scopeIds = await this.#getRecordScopeIds(input.id, session);
      const result = await (
        await this.#collection(TABLE_KNOWLEDGE_RECORDS)
      ).findOneAndUpdate(
        { id: input.id, version: input.version, deletedAt: { $exists: false } },
        { $set: { deletedAt: new Date(), deletedBy: input.deletedBy, updatedAt: new Date() }, $inc: { version: 1 } },
        { ...sessionOptions(session), returnDocument: 'after' },
      );
      if (!result) throw new KnowledgeConflictError(input.id);
      const record = recordFromDocument(result);
      await this.#activity('delete', 'record', record.id, undefined, input.importRunId, undefined, session);
      await this.#outbox('record', record.id, 'delete', scopeIds, record.version, session);
      return record;
    });
  }

  async restoreRecord(input: {
    id: string;
    version: number;
    importRunId?: string;
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeRecord> {
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
      const existing = await (
        await this.#collection(TABLE_KNOWLEDGE_RECORDS)
      ).findOne({ id: input.id }, sessionOptions(session));
      if (!existing?.deletedAt) throw new KnowledgeNotFoundError('record', input.id);
      if (Number(existing.version) !== input.version) throw new KnowledgeConflictError(input.id);
      const scopeIds = await this.#assertScopeNodes(await this.#getRecordScopeIds(input.id, session), session);
      const result = await (
        await this.#collection(TABLE_KNOWLEDGE_RECORDS)
      ).findOneAndUpdate(
        { id: input.id, version: input.version, deletedAt: { $exists: true } },
        { $unset: { deletedAt: '', deletedBy: '' }, $set: { updatedAt: new Date() }, $inc: { version: 1 } },
        { ...sessionOptions(session), returnDocument: 'after' },
      );
      if (!result) throw new KnowledgeConflictError(input.id);
      const record = recordFromDocument(result);
      await this.#replaceMentions(record, scopeIds, session);
      await this.#activity('restore', 'record', record.id, undefined, input.importRunId, { scopeIds }, session);
      await this.#outbox('record', record.id, 'upsert', scopeIds, record.version, session);
      return record;
    });
  }

  async setRecordScopes(input: {
    id: string;
    version: number;
    scopeIds: KnowledgeScopeIds;
    importRunId?: string;
    contextScopeId?: string;
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeRecord> {
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
      const scopeIds = await this.#assertScopeNodes(input.scopeIds, session);
      if (!scopeIds.length) throw new KnowledgeNotFoundError('scope', '');
      const existing = await (
        await this.#collection(TABLE_KNOWLEDGE_RECORDS)
      ).findOne({ id: input.id, deletedAt: { $exists: false } }, sessionOptions(session));
      if (!existing) throw new KnowledgeNotFoundError('record', input.id);
      if (Number(existing.version) !== input.version) throw new KnowledgeConflictError(input.id);
      const previousScopeIds = await this.#getRecordScopeIds(input.id, session);
      const result = await (
        await this.#collection(TABLE_KNOWLEDGE_RECORDS)
      ).findOneAndUpdate(
        { id: input.id, version: input.version, deletedAt: { $exists: false } },
        { $set: { updatedAt: new Date() }, $inc: { version: 1 } },
        { ...sessionOptions(session), returnDocument: 'after' },
      );
      if (!result) throw new KnowledgeConflictError(input.id);
      await this.#replaceRecordScopes(input.id, scopeIds, session);
      const record = recordFromDocument(result);
      await this.#replaceMentions(record, scopeIds, session);
      await this.#activity(
        'stamp',
        'record',
        record.id,
        input.contextScopeId,
        input.importRunId,
        { scopeIds },
        session,
      );
      if (knowledgeScopeIdsKey(previousScopeIds) !== knowledgeScopeIdsKey(scopeIds)) {
        await this.#outbox('record', record.id, 'delete', previousScopeIds, record.version, session);
      }
      await this.#outbox('record', record.id, 'upsert', scopeIds, record.version, session);
      return record;
    });
  }

  async #queryRecords(
    input: QueryKnowledgeRecordsInput | QueryKnowledgeRecordsBySourceInput,
    filter: Filter<Document>,
    direction: 1 | -1 = -1,
  ): Promise<QueryKnowledgeRecordsOutput> {
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const rows = await (
      await this.#collection(TABLE_KNOWLEDGE_RECORDS)
    )
      .find({ ...filter, deletedAt: { $exists: false } })
      .sort({ id: direction })
      .toArray();
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
    const records: KnowledgeRecord[] = [];
    let started = !input.after;
    for (const row of rows) {
      const record = recordFromDocument(row);
      if (!started) {
        if (record.id === input.after) started = true;
        continue;
      }
      const memberships = await this.#getRecordScopeIds(record.id);
      if (
        'membershipScopeIds' in input &&
        input.membershipScopeIds &&
        !isKnowledgeScopeVisible(memberships, input.membershipScopeIds)
      )
        continue;
      if (!(await this.#isRecordVisible(record, scopeIds))) continue;
      records.push(record);
      if (records.length > limit) break;
    }
    const hasMore = records.length > limit;
    if (hasMore) records.pop();
    return { records, nextCursor: hasMore ? records.at(-1)?.id : undefined };
  }

  async search(input: SearchKnowledgeInput): Promise<SearchKnowledgeResult[]> {
    const query = input.query.trim().toLowerCase();
    if (!query) return [];
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const results: SearchKnowledgeResult[] = [];
    for (const node of await this.listNodes({ scopeIds, limit: 100 })) {
      if (!node.name.toLowerCase().includes(query)) continue;
      results.push({
        type: 'node',
        id: node.id,
        recordId: node.id,
        name: node.name,
        text: node.name,
        scopeIds: await this.#getNodeScopeIds(node.id),
      });
    }
    const rows = await (
      await this.#collection(TABLE_KNOWLEDGE_RECORDS)
    )
      .find({ deletedAt: { $exists: false } })
      .sort({ id: -1 })
      .limit(1000)
      .toArray();
    for (const row of rows) {
      const record = recordFromDocument(row);
      if (!record.text.toLowerCase().includes(query) || !(await this.#isRecordVisible(record, scopeIds))) continue;
      const parent = await this.getNode(record.nodeId);
      if (!parent) continue;
      results.push({
        type: 'record',
        id: record.id,
        recordId: record.nodeId,
        name: parent.name,
        text: record.text,
        scopeIds: await this.#getRecordScopeIds(record.id),
      });
    }
    return results.slice(0, Math.min(Math.max(input.limit ?? 20, 1), 100));
  }

  async createProposal(input: CreateKnowledgeProposalInput): Promise<KnowledgeProposal> {
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
      const primary = input.targets[0];
      if (!primary) throw new Error('A knowledge proposal requires at least one target');
      const proposal: KnowledgeProposal = {
        id: input.id ?? randomUUID(),
        targetType: primary.type,
        targetId: primary.id,
        expectedVersion: primary.expectedVersion,
        targets: structuredClone(input.targets),
        operation: input.operation,
        payload: structuredClone(input.payload),
        reason: input.reason,
        proposerContextScopeId: input.proposerContextScopeId,
        status: 'pending',
        createdAt: new Date(),
      };
      await (await this.#collection(TABLE_KNOWLEDGE_PROPOSALS)).insertOne({ ...proposal }, sessionOptions(session));
      await this.#activity(
        'propose',
        proposal.targetType,
        proposal.targetId,
        input.proposerContextScopeId,
        undefined,
        { proposalId: proposal.id, scopeIds: primary.scopeIds },
        session,
      );
      return proposal;
    });
  }

  async getProposal(id: string): Promise<KnowledgeProposal | null> {
    const row = await (await this.#collection(TABLE_KNOWLEDGE_PROPOSALS)).findOne({ id });
    return row ? proposalFromDocument(row) : null;
  }

  async #isProposalVisible(proposal: KnowledgeProposal, visibleScopeIds: KnowledgeScopeIds): Promise<boolean> {
    for (const target of proposal.targets) {
      if (target.type === 'node') {
        const node = await this.getNodeIncludingDeleted(target.id);
        if (!node || node.deletedAt) return false;
        const scopes = node.isScope ? [node.id] : await this.#getNodeScopeIds(node.id);
        if (!isKnowledgeScopeVisible(scopes, visibleScopeIds)) return false;
      } else {
        const record = await this.getVisibleRecord({ id: target.id, scopeIds: visibleScopeIds, includeDeleted: true });
        if (!record || record.deletedAt) return false;
      }
    }
    return true;
  }

  async getVisibleProposal(input: { id: string; scopeIds: KnowledgeScopeIds }): Promise<KnowledgeProposal | null> {
    const proposal = await this.getProposal(input.id);
    return proposal && (await this.#isProposalVisible(proposal, canonicalizeKnowledgeScopeIds(input.scopeIds)))
      ? proposal
      : null;
  }

  async listProposals(input: ListKnowledgeProposalsInput): Promise<ListKnowledgeProposalsOutput> {
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    if (!scopeIds.length) return { proposals: [] };
    if (input.cursor && !(await this.getVisibleProposal({ id: input.cursor, scopeIds }))) return { proposals: [] };
    const nodeMemberships = await (
      await this.#collection(TABLE_KNOWLEDGE_NODE_SCOPES)
    )
      .find({ scopeNodeId: { $in: scopeIds } })
      .project({ nodeId: 1 })
      .toArray();
    const visibleNodeIds = [...new Set([...scopeIds, ...nodeMemberships.map(row => String(row.nodeId))])];
    const recordMemberships = await (
      await this.#collection(TABLE_KNOWLEDGE_RECORD_SCOPES)
    )
      .find({ scopeNodeId: { $in: scopeIds } })
      .project({ recordId: 1 })
      .toArray();
    const visibleRecordIds = [...new Set(recordMemberships.map(row => String(row.recordId)))];
    const visibilityFilter: Filter<Document> = {
      $or: [
        { targetType: 'node', targetId: { $in: visibleNodeIds } },
        { targetType: 'record', targetId: { $in: visibleRecordIds } },
      ],
    };
    const constraints: Filter<Document>[] = [visibilityFilter];
    if (input.status) constraints.push({ status: input.status });
    if (input.cursor) {
      const cursor = await (await this.#collection(TABLE_KNOWLEDGE_PROPOSALS)).findOne({ id: input.cursor });
      if (!cursor) return { proposals: [] };
      constraints.push({
        $or: [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { $lt: input.cursor } }],
      });
    }
    const rows = await (
      await this.#collection(TABLE_KNOWLEDGE_PROPOSALS)
    )
      .find({ $and: constraints })
      .sort({ createdAt: -1, id: -1 })
      .limit(1000)
      .toArray();
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
    const proposals: KnowledgeProposal[] = [];
    for (const row of rows) {
      const proposal = proposalFromDocument(row);
      if (await this.#isProposalVisible(proposal, scopeIds)) proposals.push(proposal);
      if (proposals.length > limit) break;
    }
    return {
      proposals: proposals.slice(0, limit),
      nextCursor: proposals.length > limit ? proposals[limit - 1]?.id : undefined,
    };
  }

  async reviewProposal(input: ReviewKnowledgeProposalInput): Promise<KnowledgeProposal> {
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
      const collection = await this.#collection(TABLE_KNOWLEDGE_PROPOSALS);
      const existing = await collection.findOne({ id: input.id }, sessionOptions(session));
      if (!existing) throw new KnowledgeNotFoundError('proposal', input.id);
      if (existing.status !== 'pending') throw new KnowledgeConflictError('Knowledge proposal was already reviewed');
      const reviewedAt = new Date();
      const row = await collection.findOneAndUpdate(
        { id: input.id, status: 'pending' },
        {
          $set: {
            status: input.status,
            reviewerContextScopeId: input.reviewerContextScopeId,
            reviewReason: input.reviewReason,
            reviewedAt,
          },
        },
        { ...sessionOptions(session), returnDocument: 'after' },
      );
      if (!row) throw new KnowledgeConflictError('Knowledge proposal was already reviewed');
      const proposal = proposalFromDocument(row);
      await this.#activity(
        input.status === 'rejected' ? 'reject' : 'conflict',
        proposal.targetType,
        proposal.targetId,
        input.reviewerContextScopeId,
        undefined,
        {
          proposalId: proposal.id,
          reason: input.reviewReason,
          scopeIds: proposal.targets.flatMap(target => target.scopeIds),
        },
        session,
      );
      return proposal;
    });
  }

  async applyProposal(input: ApplyKnowledgeProposalInput): Promise<KnowledgeProposal> {
    return this.#transaction(async session => {
      await this.#assertExpectedAccessEpoch(session, input.expectedAccessEpoch);
      const proposals = await this.#collection(TABLE_KNOWLEDGE_PROPOSALS);
      const row = await proposals.findOne({ id: input.id }, sessionOptions(session));
      if (!row) throw new KnowledgeNotFoundError('proposal', input.id);
      const proposal = proposalFromDocument(row);
      if (proposal.status !== 'pending') throw new KnowledgeConflictError('Knowledge proposal was already reviewed');
      for (const target of proposal.targets) {
        const collection = await this.#collection(
          target.type === 'node' ? TABLE_KNOWLEDGE_NODES : TABLE_KNOWLEDGE_RECORDS,
        );
        if (
          !(await collection.findOne(
            { id: target.id, version: target.expectedVersion, deletedAt: { $exists: false } },
            sessionOptions(session),
          ))
        ) {
          return this.#markProposalConflicted(
            proposal,
            input.reviewerContextScopeId,
            `Expected ${target.type} ${target.id} version ${target.expectedVersion}`,
            session,
          );
        }
      }
      const payload = proposal.payload as { kind?: unknown; mutation?: Record<string, unknown> };
      if (!payload.mutation || typeof payload.mutation !== 'object') {
        throw new Error(`Unsupported immutable payload for knowledge proposal ${proposal.id}`);
      }
      if (payload.kind === 'update-node') {
        const mutation = payload.mutation;
        const target = proposal.targets.find(candidate => candidate.type === 'node');
        if (!target) throw new KnowledgeConflictError(proposal.id);
        const existing = await (
          await this.#collection(TABLE_KNOWLEDGE_NODES)
        ).findOne(
          { id: target.id, version: target.expectedVersion, deletedAt: { $exists: false } },
          sessionOptions(session),
        );
        if (!existing) {
          return this.#markProposalConflicted(
            proposal,
            input.reviewerContextScopeId,
            `Expected ${target.type} ${target.id} version ${target.expectedVersion}`,
            session,
          );
        }
        const currentScopes = await this.#getNodeScopeIds(target.id, session);
        const nextScopes = Array.isArray(mutation.scopeIds)
          ? await this.#assertScopeNodes(mutation.scopeIds as string[], session)
          : currentScopes;
        const name = typeof mutation.name === 'string' ? mutation.name : String(existing.name);
        const activeNameScopeKey = `${canonicalName(name)}\u0000${knowledgeScopeIdsKey(nextScopes)}`;
        const sibling = await (
          await this.#collection(TABLE_KNOWLEDGE_NODES)
        ).findOne(
          { activeNameScopeKey, id: { $ne: target.id }, deletedAt: { $exists: false } },
          sessionOptions(session),
        );
        if (sibling) {
          return this.#markProposalConflicted(
            proposal,
            input.reviewerContextScopeId,
            'Proposed mutation conflicts with current state',
            session,
          );
        }
        await (
          await this.#collection(TABLE_KNOWLEDGE_NODES)
        ).updateOne(
          { id: target.id, version: target.expectedVersion },
          {
            $set: {
              name,
              canonicalName: canonicalName(name),
              activeNameScopeKey,
              kind: mutation.kind ?? existing.kind,
              metadata: mutation.metadata ?? existing.metadata,
              updatedAt: new Date(),
            },
            $inc: { version: 1 },
          },
          sessionOptions(session),
        );
        await this.#replaceNodeScopes(target.id, nextScopes, session);
        await this.#outbox('node', target.id, 'upsert', nextScopes, target.expectedVersion + 1, session);
      } else if (payload.kind === 'promote-node') {
        try {
          await this.#promoteNode(
            {
              ...(structuredClone(payload.mutation) as unknown as PromoteKnowledgeNodeInput),
              contextScopeId: input.reviewerContextScopeId,
              expectedAccessEpoch: input.expectedAccessEpoch,
            },
            session,
            new Map(
              proposal.targets
                .filter(target => target.type === 'record')
                .map(target => [target.id, target.expectedVersion]),
            ),
          );
        } catch (error) {
          if (error instanceof KnowledgeConflictError) {
            return this.#markProposalConflicted(
              proposal,
              input.reviewerContextScopeId,
              'Proposed mutation conflicts with current state',
              session,
            );
          }
          throw error;
        }
      } else {
        throw new Error(`Unsupported immutable payload for knowledge proposal ${proposal.id}`);
      }
      const reviewedAt = new Date();
      const approved = await proposals.findOneAndUpdate(
        { id: proposal.id, status: 'pending' },
        { $set: { status: 'approved', reviewerContextScopeId: input.reviewerContextScopeId, reviewedAt } },
        { ...sessionOptions(session), returnDocument: 'after' },
      );
      if (!approved) throw new KnowledgeConflictError(proposal.id);
      await this.#activity(
        'approve',
        proposal.targetType,
        proposal.targetId,
        input.reviewerContextScopeId,
        undefined,
        { proposalId: proposal.id, scopeIds: proposal.targets.flatMap(target => target.scopeIds) },
        session,
      );
      return proposalFromDocument(approved);
    });
  }

  async #markProposalConflicted(
    proposal: KnowledgeProposal,
    reviewerContextScopeId: string,
    reviewReason: string,
    session: ClientSession,
  ): Promise<KnowledgeProposal> {
    const reviewedAt = new Date();
    const row = await (
      await this.#collection(TABLE_KNOWLEDGE_PROPOSALS)
    ).findOneAndUpdate(
      { id: proposal.id, status: 'pending' },
      { $set: { status: 'conflicted', reviewerContextScopeId, reviewReason, reviewedAt } },
      { ...sessionOptions(session), returnDocument: 'after' },
    );
    if (!row) throw new KnowledgeConflictError(proposal.id);
    await this.#activity(
      'conflict',
      proposal.targetType,
      proposal.targetId,
      reviewerContextScopeId,
      undefined,
      { proposalId: proposal.id, reason: reviewReason, scopeIds: proposal.targets.flatMap(target => target.scopeIds) },
      session,
    );
    return proposalFromDocument(row);
  }

  async getImportState(input: {
    importerId: string;
    binding: string;
    key: string;
  }): Promise<KnowledgeImportState | null> {
    const binding = canonicalizeKnowledgeImporterBindingKey(input.binding);
    const row = await (
      await this.#collection(TABLE_KNOWLEDGE_IMPORT_STATE)
    ).findOne({
      importerId: input.importerId,
      binding,
      key: input.key,
    });
    return row
      ? {
          importerId: String(row.importerId),
          binding: String(row.binding),
          key: String(row.key),
          value: String(row.value),
        }
      : null;
  }

  async setImportState(input: {
    importerId: string;
    binding: string;
    key: string;
    value: string;
  }): Promise<KnowledgeImportState> {
    const state = { ...input, binding: canonicalizeKnowledgeImporterBindingKey(input.binding) };
    await this.#transaction(async session => {
      await (
        await this.#collection(TABLE_KNOWLEDGE_IMPORT_STATE)
      ).updateOne(
        { importerId: state.importerId, binding: state.binding, key: state.key },
        { $set: state },
        { ...sessionOptions(session), upsert: true },
      );
    });
    return state;
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
    await this.#transaction(async session => {
      const runs = await this.#collection(TABLE_KNOWLEDGE_IMPORT_RUNS);
      if (await runs.findOne({ id: run.id }, sessionOptions(session))) throw new KnowledgeConflictError(run.id);
      await runs.insertOne({ ...run }, sessionOptions(session));
    });
    return run;
  }

  async enqueueImportRun(input: EnqueueKnowledgeImportRunInput): Promise<KnowledgeImportRun> {
    const binding = canonicalizeKnowledgeImporterBindingKey(input.binding);
    return this.#transaction(async session => {
      const runs = await this.#collection(TABLE_KNOWLEDGE_IMPORT_RUNS);
      if (input.skipIfActiveCron) {
        await (
          await this.#collection(TABLE_KNOWLEDGE_IMPORT_STATE)
        ).updateOne(
          { importerId: input.importerId, binding, key: '__enqueue_lock__' },
          { $set: { importerId: input.importerId, binding, key: '__enqueue_lock__', value: String(Date.now()) } },
          { ...sessionOptions(session), upsert: true },
        );
      }
      const active = input.skipIfActiveCron
        ? await runs.findOne(
            { importerId: input.importerId, binding, status: { $in: ['queued', 'running'] } },
            sessionOptions(session),
          )
        : null;
      const queuedAt = input.queuedAt ? new Date(input.queuedAt) : new Date();
      const status = active ? 'skipped' : (input.status ?? 'queued');
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
      await runs.insertOne({ ...run }, sessionOptions(session));
      if (status !== 'skipped') {
        await (
          await this.#collection(TABLE_KNOWLEDGE_IMPORT_STATE)
        ).insertOne(
          { importerId: input.importerId, binding, key: input.payloadKey, value: input.payload },
          sessionOptions(session),
        );
      }
      return run;
    });
  }

  async claimImportRun(input: ClaimKnowledgeImportRunInput): Promise<KnowledgeImportRun | null> {
    const binding = canonicalizeKnowledgeImporterBindingKey(input.binding);
    return this.#transaction(async session => {
      const runs = await this.#collection(TABLE_KNOWLEDGE_IMPORT_RUNS);
      if (await runs.findOne({ importerId: input.importerId, binding, status: 'running' }, sessionOptions(session))) {
        return null;
      }
      const queued = await runs.findOneAndUpdate(
        { importerId: input.importerId, binding, status: 'queued' },
        { $set: { status: 'running', startedAt: input.timestamp ?? new Date() } },
        { ...sessionOptions(session), sort: { queuedAt: 1, id: 1 }, returnDocument: 'after' },
      );
      if (!queued) return null;
      const timestamp = toDate(queued.startedAt);
      await (
        await this.#collection(TABLE_KNOWLEDGE_IMPORT_STATE)
      ).updateOne(
        { importerId: input.importerId, binding, key: `${input.leaseKey}${String(queued.id)}` },
        {
          $set: {
            importerId: input.importerId,
            binding,
            key: `${input.leaseKey}${String(queued.id)}`,
            value: JSON.stringify({ workerId: input.workerId, heartbeatAt: timestamp.toISOString() }),
          },
        },
        { ...sessionOptions(session), upsert: true },
      );
      return importRunFromDocument(queued);
    });
  }

  async heartbeatImportRun(input: HeartbeatKnowledgeImportRunInput): Promise<boolean> {
    const binding = canonicalizeKnowledgeImporterBindingKey(input.binding);
    return this.#transaction(async session => {
      const run = await (
        await this.#collection(TABLE_KNOWLEDGE_IMPORT_RUNS)
      ).findOne({ id: input.id, importerId: input.importerId, binding, status: 'running' }, sessionOptions(session));
      if (!run) return false;
      const state = await this.#collection(TABLE_KNOWLEDGE_IMPORT_STATE);
      const lease = await state.findOne(
        { importerId: input.importerId, binding, key: input.leaseKey },
        sessionOptions(session),
      );
      if (!lease) return false;
      try {
        if (JSON.parse(String(lease.value)).workerId !== input.workerId) return false;
      } catch {
        return false;
      }
      await state.updateOne(
        { importerId: input.importerId, binding, key: input.leaseKey },
        {
          $set: {
            value: JSON.stringify({
              workerId: input.workerId,
              heartbeatAt: (input.timestamp ?? new Date()).toISOString(),
            }),
          },
        },
        sessionOptions(session),
      );
      return true;
    });
  }

  async finalizeImportRun(input: FinalizeKnowledgeImportRunInput): Promise<KnowledgeImportRun | null> {
    const binding = canonicalizeKnowledgeImporterBindingKey(input.binding);
    return this.#transaction(async session => {
      const runs = await this.#collection(TABLE_KNOWLEDGE_IMPORT_RUNS);
      const run = await runs.findOne(
        { id: input.id, importerId: input.importerId, binding, status: 'running' },
        sessionOptions(session),
      );
      if (!run) return null;
      const states = await this.#collection(TABLE_KNOWLEDGE_IMPORT_STATE);
      const lease = await states.findOne(
        { importerId: input.importerId, binding, key: input.leaseKey },
        sessionOptions(session),
      );
      if (!lease) return null;
      try {
        if (JSON.parse(String(lease.value)).workerId !== input.workerId) return null;
      } catch {
        return null;
      }
      for (const state of input.state) {
        await states.updateOne(
          { importerId: input.importerId, binding, key: state.key },
          { $set: { importerId: input.importerId, binding, ...state } },
          { ...sessionOptions(session), upsert: true },
        );
      }
      const completedAt = input.timestamp ?? new Date();
      const result = await runs.findOneAndUpdate(
        { id: input.id, status: 'running' },
        {
          $set: {
            status: input.status,
            error: input.status === 'failed' ? sanitizeKnowledgeImportError(input.error) : undefined,
            transcriptThreadId: input.transcriptThreadId ?? run.transcriptThreadId,
            completedAt,
          },
        },
        { ...sessionOptions(session), returnDocument: 'after' },
      );
      return result ? importRunFromDocument(result) : null;
    });
  }

  async recoverImportRun(input: RecoverKnowledgeImportRunInput): Promise<KnowledgeImportRun | null> {
    return this.#transaction(async session => {
      const runs = await this.#collection(TABLE_KNOWLEDGE_IMPORT_RUNS);
      const run = await runs.findOne({ id: input.id, status: 'running' }, sessionOptions(session));
      if (!run) return null;
      const states = await this.#collection(TABLE_KNOWLEDGE_IMPORT_STATE);
      const lease = await states.findOne(
        { importerId: run.importerId, binding: run.binding, key: input.leaseKey },
        sessionOptions(session),
      );
      if (lease) {
        try {
          if (new Date(JSON.parse(String(lease.value)).heartbeatAt) >= input.staleBefore) return null;
        } catch {
          // Malformed internal leases are stale.
        }
      }
      const payload = await states.findOne(
        { importerId: run.importerId, binding: run.binding, key: input.payloadKey },
        sessionOptions(session),
      );
      const completedAt = input.queuedAt ?? new Date();
      await runs.updateOne(
        { id: input.id, status: 'running' },
        {
          $set: {
            status: payload ? 'interrupted' : 'failed',
            error: payload ? undefined : 'Import failed: durable payload is missing',
            completedAt,
          },
        },
        sessionOptions(session),
      );
      if (!payload) return null;
      const replacement: KnowledgeImportRun = {
        id: input.replacementId,
        importerId: String(run.importerId),
        binding: String(run.binding),
        importKind: run.importKind,
        triggerKind: run.triggerKind,
        status: 'queued',
        queuedAt: new Date(toDate(run.queuedAt).getTime() - 1),
      };
      await runs.insertOne({ ...replacement }, sessionOptions(session));
      await states.updateOne(
        { importerId: run.importerId, binding: run.binding, key: input.replacementPayloadKey },
        {
          $set: {
            importerId: run.importerId,
            binding: run.binding,
            key: input.replacementPayloadKey,
            value: payload.value,
          },
        },
        { ...sessionOptions(session), upsert: true },
      );
      return replacement;
    });
  }

  async getImportRun(id: string): Promise<KnowledgeImportRun | null> {
    const row = await (await this.#collection(TABLE_KNOWLEDGE_IMPORT_RUNS)).findOne({ id });
    return row ? importRunFromDocument(row) : null;
  }

  async listImportRuns(input: ListKnowledgeImportRunsInput = {}): Promise<ListKnowledgeImportRunsOutput> {
    if (input.importerIds?.length === 0 || input.scopeIds?.length === 0) return { runs: [], nextCursor: undefined };
    const constraints: Filter<Document>[] = [];
    if (input.importerId) constraints.push({ importerId: input.importerId });
    if (input.importerIds) constraints.push({ importerId: { $in: input.importerIds } });
    if (input.binding) constraints.push({ binding: canonicalizeKnowledgeImporterBindingKey(input.binding) });
    if (input.status) constraints.push({ status: input.status });
    if (input.scopeIds) {
      const addresses = await (
        await this.#collection(TABLE_KNOWLEDGE_SCOPE_ADDRESSES)
      )
        .find({ scopeNodeId: { $in: canonicalizeKnowledgeScopeIds(input.scopeIds) } })
        .project({ address: 1 })
        .toArray();
      if (!addresses.length) return { runs: [], nextCursor: undefined };
      constraints.push({
        binding: {
          $in: addresses.map(row => new RegExp(`${String(row.address).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\]$`)),
        },
      });
    }
    if (input.after) {
      const cursor = await (await this.#collection(TABLE_KNOWLEDGE_IMPORT_RUNS)).findOne({ id: input.after });
      if (!cursor) return { runs: [], nextCursor: undefined };
      constraints.push({
        $or: [{ queuedAt: { $lt: cursor.queuedAt } }, { queuedAt: cursor.queuedAt, id: { $lt: input.after } }],
      });
    }
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
    const rows = await (
      await this.#collection(TABLE_KNOWLEDGE_IMPORT_RUNS)
    )
      .find(constraints.length ? { $and: constraints } : {})
      .sort({ queuedAt: -1, id: -1 })
      .limit(limit + 1)
      .toArray();
    const runs = rows.slice(0, limit).map(importRunFromDocument);
    return { runs, nextCursor: rows.length > limit ? runs.at(-1)?.id : undefined };
  }

  async updateImportRun(input: UpdateKnowledgeImportRunInput): Promise<KnowledgeImportRun> {
    return this.#transaction(async session => {
      const runs = await this.#collection(TABLE_KNOWLEDGE_IMPORT_RUNS);
      const existing = await runs.findOne({ id: input.id }, sessionOptions(session));
      if (!existing) throw new KnowledgeNotFoundError('import run', input.id);
      const run = importRunFromDocument(existing);
      assertImportRunTransition(run.status, input.status);
      const timestamp = input.timestamp ?? new Date();
      const error = input.status === 'failed' ? sanitizeKnowledgeImportError(input.error) : undefined;
      const updates: Record<string, unknown> = { status: input.status, error };
      if (input.transcriptThreadId !== undefined) updates.transcriptThreadId = input.transcriptThreadId;
      if (input.traceId !== undefined) updates.traceId = input.traceId;
      if (input.status === 'running') updates.startedAt = timestamp;
      else updates.completedAt = timestamp;
      const result = await runs.findOneAndUpdate(
        { id: input.id, status: run.status },
        { $set: updates },
        { ...sessionOptions(session), returnDocument: 'after' },
      );
      if (!result) throw new KnowledgeConflictError(input.id);
      return importRunFromDocument(result);
    });
  }

  async getCurationCursor(input: {
    sourceThreadId: string;
    agent: string;
  }): Promise<{ sourceThreadId: string; agent: string; lastKnowledgeId: string; updatedAt: Date } | null> {
    const row = await (await this.#collection(TABLE_KNOWLEDGE_CURSORS)).findOne(input);
    return row
      ? {
          sourceThreadId: String(row.sourceThreadId),
          agent: String(row.agent),
          lastKnowledgeId: String(row.lastKnowledgeId),
          updatedAt: toDate(row.updatedAt),
        }
      : null;
  }

  async advanceCurationCursor(input: {
    sourceThreadId: string;
    agent: string;
    lastKnowledgeId: string;
  }): Promise<{ sourceThreadId: string; agent: string; lastKnowledgeId: string; updatedAt: Date }> {
    const updatedAt = new Date();
    const row = await (
      await this.#collection(TABLE_KNOWLEDGE_CURSORS)
    ).findOneAndUpdate(
      {
        sourceThreadId: input.sourceThreadId,
        agent: input.agent,
        $or: [{ lastKnowledgeId: { $lt: input.lastKnowledgeId } }, { lastKnowledgeId: { $exists: false } }],
      },
      { $set: { ...input, updatedAt } },
      { upsert: true, returnDocument: 'after' },
    );
    if (row) return { ...input, lastKnowledgeId: String(row.lastKnowledgeId), updatedAt: toDate(row.updatedAt) };
    return (await this.getCurationCursor(input))!;
  }

  async listActivity(input: {
    scopeIds: KnowledgeScopeIds;
    membershipScopeIds?: KnowledgeScopeIds;
    contextScopeId?: string;
    importRunId?: string;
    action?: KnowledgeActivityEvent['action'];
    sourceType?: 'importer' | 'system';
    from?: Date;
    to?: Date;
    after?: string;
    limit?: number;
  }): Promise<KnowledgeActivityEvent[]> {
    const vouched = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const nodeMemberships = await (
      await this.#collection(TABLE_KNOWLEDGE_NODE_SCOPES)
    )
      .find({ scopeNodeId: { $in: vouched } })
      .project({ nodeId: 1 })
      .toArray();
    const visibleNodeIds = [...new Set([...vouched, ...nodeMemberships.map(row => String(row.nodeId))])];
    const recordMemberships = await (
      await this.#collection(TABLE_KNOWLEDGE_RECORD_SCOPES)
    )
      .find({ scopeNodeId: { $in: vouched } })
      .project({ recordId: 1 })
      .toArray();
    const visibleRecordIds = [...new Set(recordMemberships.map(row => String(row.recordId)))];
    const filter: Filter<Document> = {
      $or: [
        { targetType: 'node', targetId: { $in: visibleNodeIds } },
        { targetType: 'record', targetId: { $in: visibleRecordIds } },
        { [`details.${ACTIVITY_VISIBILITY_SCOPE_IDS}`]: { $in: vouched } },
      ],
    };
    if (input.contextScopeId) filter.contextScopeId = input.contextScopeId;
    if (input.importRunId) filter.importRunId = input.importRunId;
    if (input.action) filter.action = input.action;
    if (input.after) filter.id = { $lt: input.after };
    if (input.from || input.to) {
      filter.createdAt = {};
      if (input.from) filter.createdAt.$gte = input.from;
      if (input.to) filter.createdAt.$lte = input.to;
    }
    const rows = await (
      await this.#collection(TABLE_KNOWLEDGE_ACTIVITY)
    )
      .find(filter)
      .sort({ id: -1 })
      .limit(1000)
      .toArray();
    const membershipScopeIds = input.membershipScopeIds
      ? canonicalizeKnowledgeScopeIds(input.membershipScopeIds)
      : undefined;
    const result: KnowledgeActivityEvent[] = [];
    for (const row of rows) {
      const details = row.details as Record<string, unknown> | undefined;
      const proposalId = typeof details?.proposalId === 'string' ? details.proposalId : undefined;
      if (proposalId && !(await this.getVisibleProposal({ id: proposalId, scopeIds: vouched }))) continue;
      const retainedScopeIds = activityVisibilityScopeIds(details);
      const action = row.action as KnowledgeActivityEvent['action'];
      const targetType = row.targetType as KnowledgeActivityEvent['targetType'];
      const targetId = String(row.targetId);
      const visibleDeletion = action === 'delete' && isKnowledgeScopeVisible(retainedScopeIds, vouched);
      if (targetType === 'node') {
        const node = await this.getNodeIncludingDeleted(targetId);
        const targetScopeIds = node ? await this.#getNodeScopeIds(targetId) : retainedScopeIds;
        if (membershipScopeIds && !isKnowledgeScopeVisible(targetScopeIds, membershipScopeIds)) continue;
        if (!visibleDeletion && (!node || !isKnowledgeScopeVisible(targetScopeIds, vouched))) continue;
      } else {
        const recordDocument = await (await this.#collection(TABLE_KNOWLEDGE_RECORDS)).findOne({ id: targetId });
        const record = recordDocument ? recordFromDocument(recordDocument) : undefined;
        const targetScopeIds = record ? await this.#getRecordScopeIds(targetId) : retainedScopeIds;
        if (membershipScopeIds && !isKnowledgeScopeVisible(targetScopeIds, membershipScopeIds)) continue;
        if (record ? !(await this.#isRecordVisible(record, vouched)) : !visibleDeletion) continue;
      }
      if (input.sourceType) {
        const sourceType = row.importRunId ? 'importer' : 'system';
        if (sourceType !== input.sourceType) continue;
      }
      result.push({
        id: String(row.id),
        action,
        targetType,
        targetId,
        contextScopeId: row.contextScopeId == null ? undefined : String(row.contextScopeId),
        importRunId: row.importRunId == null ? undefined : String(row.importRunId),
        details: publicActivityDetails(details),
        createdAt: toDate(row.createdAt),
      });
      if (result.length >= Math.min(Math.max(input.limit ?? 100, 1), 100)) break;
    }
    return result;
  }

  async listSemanticOutbox(
    input: {
      status?: KnowledgeSemanticOutboxEntry['status'];
      scopeIds?: KnowledgeScopeIds;
      limit?: number;
    } = {},
  ): Promise<KnowledgeSemanticOutboxEntry[]> {
    const rows = await (
      await this.#collection(TABLE_KNOWLEDGE_SEMANTIC_OUTBOX)
    )
      .find(input.status ? { status: input.status } : {})
      .sort({ createdAt: 1, id: 1 })
      .limit(1000)
      .toArray();
    const vouched = input.scopeIds ? canonicalizeKnowledgeScopeIds(input.scopeIds) : undefined;
    const result: KnowledgeSemanticOutboxEntry[] = [];
    for (const row of rows) {
      const entry = this.#semanticEntry(row);
      if (vouched && !(await this.#isSemanticEntryVisible(entry, vouched))) continue;
      result.push(entry);
      if (result.length >= Math.min(Math.max(input.limit ?? 100, 1), 100)) break;
    }
    return result;
  }

  async claimSemanticOutbox(input: {
    workerId: string;
    limit?: number;
    now?: Date;
    claimTimeoutMs?: number;
    scopeIds?: KnowledgeScopeIds;
  }): Promise<KnowledgeSemanticOutboxEntry[]> {
    return this.#transaction(async session => {
      const now = input.now ?? new Date();
      const staleBefore = new Date(now.getTime() - (input.claimTimeoutMs ?? 60_000));
      const collection = await this.#collection(TABLE_KNOWLEDGE_SEMANTIC_OUTBOX);
      await collection.updateMany(
        { status: 'processing', claimedAt: { $lte: staleBefore } },
        { $set: { status: 'pending', availableAt: now }, $unset: { claimedAt: '', claimedBy: '' } },
        sessionOptions(session),
      );
      const rows = await collection
        .find({ status: 'pending', availableAt: { $lte: now } }, sessionOptions(session))
        .sort({ createdAt: 1, id: 1 })
        .limit(1000)
        .toArray();
      const vouched = input.scopeIds ? canonicalizeKnowledgeScopeIds(input.scopeIds) : undefined;
      if (vouched) {
        for (const row of rows) {
          const successor = this.#semanticEntry(row);
          if (!(await this.#isSemanticEntryVisible(successor, vouched, session))) continue;
          const predecessorRows = await collection
            .find(
              {
                documentId: successor.documentId,
                status: 'pending',
                $or: [
                  { createdAt: { $lt: successor.createdAt } },
                  { createdAt: successor.createdAt, id: { $lt: successor.id } },
                ],
              },
              sessionOptions(session),
            )
            .toArray();
          const obsoleteIds: string[] = [];
          for (const predecessorRow of predecessorRows) {
            const predecessor = this.#semanticEntry(predecessorRow);
            if (
              successor.operation === 'delete' ||
              !(await this.#isSemanticEntryVisible(predecessor, vouched, session))
            ) {
              obsoleteIds.push(predecessor.id);
            }
          }
          if (obsoleteIds.length) {
            await collection.updateMany(
              { id: { $in: obsoleteIds }, status: 'pending' },
              { $set: { status: 'completed', completedAt: now } },
              sessionOptions(session),
            );
          }
        }
      }
      const claimed: KnowledgeSemanticOutboxEntry[] = [];
      for (const row of rows) {
        if (claimed.length >= Math.min(Math.max(input.limit ?? 100, 1), 100)) break;
        const entry = this.#semanticEntry(row);
        if (vouched && !(await this.#isSemanticEntryVisible(entry, vouched, session))) continue;
        const predecessor = await collection.findOne(
          {
            documentId: entry.documentId,
            status: { $in: ['pending', 'processing'] },
            $or: [{ createdAt: { $lt: entry.createdAt } }, { createdAt: entry.createdAt, id: { $lt: entry.id } }],
          },
          sessionOptions(session),
        );
        if (predecessor) continue;
        const claimedRow = await collection.findOneAndUpdate(
          { id: entry.id, status: 'pending' },
          { $set: { status: 'processing', claimedAt: now, claimedBy: input.workerId }, $inc: { attempts: 1 } },
          { ...sessionOptions(session), returnDocument: 'after' },
        );
        if (claimedRow) claimed.push(this.#semanticEntry(claimedRow));
      }
      return claimed;
    });
  }

  async completeSemanticOutbox(input: { ids: string[]; workerId: string }): Promise<void> {
    if (!input.ids.length) return;
    await this.#transaction(async session => {
      await (
        await this.#collection(TABLE_KNOWLEDGE_SEMANTIC_OUTBOX)
      ).updateMany(
        { id: { $in: input.ids }, status: 'processing', claimedBy: input.workerId },
        { $set: { status: 'completed', completedAt: new Date() }, $unset: { claimedAt: '', claimedBy: '' } },
        sessionOptions(session),
      );
    });
  }

  async releaseSemanticOutbox(input: { ids: string[]; workerId: string; retryAt?: Date }): Promise<void> {
    if (!input.ids.length) return;
    await this.#transaction(async session => {
      await (
        await this.#collection(TABLE_KNOWLEDGE_SEMANTIC_OUTBOX)
      ).updateMany(
        { id: { $in: input.ids }, status: 'processing', claimedBy: input.workerId },
        {
          $set: { status: 'pending', availableAt: input.retryAt ?? new Date() },
          $unset: { claimedAt: '', claimedBy: '' },
        },
        sessionOptions(session),
      );
    });
  }

  async #isSemanticEntryVisible(
    entry: KnowledgeSemanticOutboxEntry,
    visibleScopeIds: KnowledgeScopeIds,
    session?: ClientSession,
  ): Promise<boolean> {
    if (!isKnowledgeScopeVisible(entry.scopeIds, visibleScopeIds)) return false;
    const id = entry.documentId.slice(`knowledge:${entry.documentType}:`.length);
    if (entry.documentType === 'node') {
      if (entry.operation === 'delete') return true;
      const node = await (
        await this.#collection(TABLE_KNOWLEDGE_NODES)
      ).findOne({ id, deletedAt: { $exists: false } }, sessionOptions(session));
      return Boolean(
        node &&
        isKnowledgeNodeVisible(nodeFromDocument(node), await this.#getNodeScopeIds(id, session), visibleScopeIds),
      );
    }
    const row = await (await this.#collection(TABLE_KNOWLEDGE_RECORDS)).findOne({ id }, sessionOptions(session));
    if (!row) return entry.operation === 'delete';
    const record = recordFromDocument(row);
    if (!isKnowledgeScopeVisible(await this.#getRecordScopeIds(record.id, session), visibleScopeIds)) return false;
    const mentions = await (
      await this.#collection(TABLE_KNOWLEDGE_MENTIONS)
    )
      .find({ recordId: record.id }, sessionOptions(session))
      .toArray();
    const nodeIds = [record.nodeId, ...mentions.map(mention => String(mention.targetNodeId))];
    for (const nodeId of nodeIds) {
      const node = await (
        await this.#collection(TABLE_KNOWLEDGE_NODES)
      ).findOne({ id: nodeId, deletedAt: { $exists: false } }, sessionOptions(session));
      if (
        !node ||
        !isKnowledgeNodeVisible(nodeFromDocument(node), await this.#getNodeScopeIds(nodeId, session), visibleScopeIds)
      ) {
        return false;
      }
    }
    return entry.operation === 'delete' || !record.deletedAt;
  }

  #semanticEntry(row: Document): KnowledgeSemanticOutboxEntry {
    return {
      id: String(row.id),
      idempotencyKey: String(row.idempotencyKey),
      documentId: String(row.documentId),
      documentType: row.documentType,
      operation: row.operation,
      scopeIds: canonicalizeKnowledgeScopeIds(row.scopeIds ?? []),
      status: row.status,
      attempts: Number(row.attempts),
      availableAt: toDate(row.availableAt),
      claimedAt: optionalDate(row.claimedAt),
      claimedBy: row.claimedBy == null ? undefined : String(row.claimedBy),
      createdAt: toDate(row.createdAt),
      completedAt: optionalDate(row.completedAt),
    };
  }

  async #replaceMentions(
    record: KnowledgeRecord,
    scopeIds: KnowledgeScopeIds,
    session: ClientSession,
    recordScopeIds: KnowledgeScopeIds = scopeIds,
    importRunId?: string,
  ): Promise<void> {
    const mentions = await this.#collection(TABLE_KNOWLEDGE_MENTIONS);
    await mentions.deleteMany({ recordId: record.id }, sessionOptions(session));
    const targetIds = new Set<string>();
    for (const name of parseKnowledgeWikilinks(record.text)) {
      const addressRows = await (
        await this.#collection(TABLE_KNOWLEDGE_NODE_ADDRESSES)
      )
        .find({ address: name }, sessionOptions(session))
        .toArray();
      const addressed: { id: string; preferred: boolean }[] = [];
      for (const address of addressRows) {
        const row = await (
          await this.#collection(TABLE_KNOWLEDGE_NODES)
        ).findOne({ id: String(address.nodeId), deletedAt: { $exists: false } }, sessionOptions(session));
        if (!row) continue;
        const node = nodeFromDocument(row);
        if (isKnowledgeNodeVisible(node, await this.#getNodeScopeIds(node.id, session), scopeIds)) {
          addressed.push({ id: node.id, preferred: address.source === record.source });
        }
      }
      const preferred = addressed.find(candidate => candidate.preferred)?.id;
      const uniqueAddressed = new Set(addressed.map(candidate => candidate.id));
      if (preferred || uniqueAddressed.size === 1) {
        targetIds.add(preferred ?? addressed[0]!.id);
        continue;
      }

      const rows = await (
        await this.#collection(TABLE_KNOWLEDGE_NODES)
      )
        .find({ canonicalName: canonicalName(name), deletedAt: { $exists: false } }, sessionOptions(session))
        .toArray();
      const visible: string[] = [];
      for (const row of rows) {
        const node = nodeFromDocument(row);
        if (isKnowledgeNodeVisible(node, await this.#getNodeScopeIds(node.id, session), scopeIds)) {
          visible.push(node.id);
        }
      }
      if (visible.length === 1) {
        targetIds.add(visible[0]!);
      } else if (visible.length === 0) {
        const target = await this.#createNode({ name, scopeIds: recordScopeIds, importRunId }, session);
        targetIds.add(target.id);
      }
    }
    if (targetIds.size) {
      await mentions.insertMany(
        [...targetIds].map(targetNodeId => ({ recordId: record.id, targetNodeId })),
        sessionOptions(session),
      );
    }
  }

  async #activity(
    action: KnowledgeActivityEvent['action'],
    targetType: KnowledgeActivityEvent['targetType'],
    targetId: string,
    contextScopeId: string | undefined,
    importRunId: string | undefined,
    details: Record<string, unknown> | undefined,
    session: ClientSession,
  ): Promise<void> {
    const event: KnowledgeActivityEvent = {
      id: createKnowledgeUlid(),
      action,
      targetType,
      targetId,
      contextScopeId,
      importRunId,
      details: details
        ? {
            ...details,
            [ACTIVITY_VISIBILITY_SCOPE_IDS]: canonicalizeKnowledgeScopeIds((details.scopeIds as string[]) ?? []),
          }
        : undefined,
      createdAt: new Date(),
    };
    await (await this.#collection(TABLE_KNOWLEDGE_ACTIVITY)).insertOne({ ...event }, sessionOptions(session));
  }

  async #outbox(
    documentType: KnowledgeSemanticDocumentType,
    entityId: string,
    operation: KnowledgeSemanticOperation,
    scopeIds: KnowledgeScopeIds,
    version: number,
    session: ClientSession,
  ): Promise<void> {
    const documentId = knowledgeSemanticDocumentId(documentType, entityId);
    const idempotencyKey = knowledgeSemanticIdempotencyKey(documentId, operation, version);
    await (
      await this.#collection(TABLE_KNOWLEDGE_SEMANTIC_OUTBOX)
    ).updateOne(
      { idempotencyKey },
      {
        $setOnInsert: {
          id: createKnowledgeUlid(),
          idempotencyKey,
          documentId,
          documentType,
          operation,
          scopeIds: canonicalizeKnowledgeScopeIds(scopeIds),
          status: 'pending',
          attempts: 0,
          availableAt: new Date(),
          createdAt: new Date(),
        },
      },
      { ...sessionOptions(session), upsert: true },
    );
  }
}
