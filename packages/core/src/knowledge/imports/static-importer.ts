import {
  canonicalizeKnowledgeScopeIds,
  isKnowledgeTargetImporterOwned,
  KnowledgeConflictError,
  knowledgeImportNodeAddress,
  knowledgeImporterBindingKey,
  knowledgeImporterRecordId,
  knowledgeImportStoredRecordId,
  parseKnowledgeImportNodeAddress,
  knowledgeScopeIdsKey,
} from '../../storage/domains/knowledge';
import type {
  KnowledgeImportClaim,
  KnowledgeImportClaimant,
  KnowledgeNode,
  KnowledgeRecord,
  KnowledgeScopeIds,
  KnowledgeStorage,
} from '../../storage/domains/knowledge';
import { deepEqual } from '../../utils/deep-equal';
import type { Knowledge } from '../index';
import type { KnowledgeCitationHost, KnowledgeCitationTarget } from './citations';
import type { KnowledgeCitationEntity, KnowledgeCitationRef, KnowledgeImporterBindingHandle } from './types';

export interface StaticKnowledgeNodeInput {
  readonly name: string;
  readonly metadata?: Record<string, unknown>;
  /**
   * The scopes this node lives under: structural scope addresses (e.g. `project:alpha`) or the addresses
   * of this source's own imported scope nodes. Each must be the binding scope or sit under it, and
   * structural scopes must be writable under the importer's `access` map. At least one is required.
   */
  readonly scopes: readonly string[];
  /** Makes the node a scope, so this source's other nodes can name its address in `scopes`. */
  readonly isScope?: boolean;
}

export interface StaticKnowledgeRecordInput {
  readonly id?: string;
  readonly text: string;
  readonly metadata?: Record<string, unknown>;
  /** A subset of the node's `scopes` to narrow where this record is visible. Defaults to all of them. */
  readonly scopes?: readonly string[];
}

export interface StaticKnowledgeNodeHandle {
  readonly node: KnowledgeNode;
  readonly id: string;
  appendKnowledge(input: StaticKnowledgeRecordInput): Promise<KnowledgeRecord>;
  listKnowledge(): Promise<KnowledgeRecord[]>;
  removeKnowledge(id: string): Promise<KnowledgeRecord | null>;
}

export interface StaticKnowledgeImporterOperations {
  /** The binding's scope address: the root every write must stay under. */
  readonly scope: string;
  getNode(address: string): Promise<StaticKnowledgeNodeHandle | null>;
  listNodes(): Promise<StaticKnowledgeNodeHandle[]>;
  upsertNode(address: string, input: StaticKnowledgeNodeInput): Promise<StaticKnowledgeNodeHandle>;
  /**
   * Provider-confirmed deletion: removes this binding's records on the node. The node is kept, along
   * with every scope membership and every other binding's records.
   */
  removeNode(address: string): Promise<{ node: KnowledgeNode; recordsRemoved: number } | null>;
}

/** Concurrent writers to one node retry this many times on a version race before giving up. */
const MAX_CLAIM_ATTEMPTS = 5;

/** @internal */
export async function createStaticKnowledgeImporterOperations(input: {
  knowledge: Knowledge;
  importerId: string;
  source: string;
  scopeAddress: string;
  importRunId: string;
  assertLeaseOwned?: () => Promise<void>;
}): Promise<StaticKnowledgeImporterOperations & KnowledgeCitationHost> {
  const importer = input.knowledge.getImporter(input.importerId);
  if (!importer) throw new Error(`Knowledge importer ${input.importerId} is not registered`);
  const storage = await input.knowledge.getStorage();
  const scope = await storage.getScopeAddress(input.scopeAddress);
  if (!scope) throw new Error(`Knowledge importer destination scope does not exist: ${input.scopeAddress}`);

  const access = importer.access;
  const writableMatches = access
    ? Object.entries(access)
        .map(([pattern, role]) => ({ role, parameters: matchAddressPattern(pattern, input.scopeAddress) }))
        .filter(
          (match): match is { role: KnowledgeImporterBindingHandle['role']; parameters: Record<string, string> } =>
            match.parameters !== null && match.role !== 'readonly',
        )
    : [{ role: 'edit' as const, parameters: {} }];
  if (writableMatches.length === 0) {
    throw new Error(`Knowledge importer ${input.importerId} cannot write to scope ${input.scopeAddress}`);
  }
  const selected = writableMatches.sort((left, right) => roleRank(right.role) - roleRank(left.role))[0]!;
  const resolutionScopeIds = new Set([scope.scopeNodeId]);
  for (const pattern of Object.keys(access ?? {})) {
    const address = renderAddressPattern(pattern, selected.parameters);
    if (!address) continue;
    const resolved = await storage.getScopeAddress(address);
    if (resolved) resolutionScopeIds.add(resolved.scopeNodeId);
  }
  const binding = knowledgeImporterBindingKey({ source: input.source, scope: input.scopeAddress });
  const run = await input.knowledge.getImportRun(input.importRunId);
  if (
    !run ||
    run.importerId !== input.importerId ||
    run.binding !== binding ||
    (run.importKind !== 'static' && run.importKind !== 'agentic') ||
    run.status !== 'running'
  ) {
    throw new Error(`Knowledge import run ${input.importRunId} is not active`);
  }

  return new StaticKnowledgeImporterOperationsImpl({
    knowledge: input.knowledge,
    storage,
    importer: {
      importerId: input.importerId,
      binding,
      source: input.source.trim(),
      scopeAddress: input.scopeAddress.trim(),
      scopeId: scope.scopeNodeId,
      resolutionScopeIds: [...resolutionScopeIds],
      role: selected.role,
    },
    access,
    importRunId: input.importRunId,
    assertLeaseOwned: input.assertLeaseOwned,
  });
}

/** What a binding may do and where; shared by the operations and their node handles. */
interface ImporterContext {
  readonly knowledge: Knowledge;
  readonly storage: KnowledgeStorage;
  readonly importer: KnowledgeImporterBindingHandle;
  readonly claimant: KnowledgeImportClaimant;
  /** Stored address of this binding's node for a provider address: identity is per destination, never shared. */
  nodeAddress(address: string): string;
  readonly importRunId: string;
  assertRunActive(): Promise<void>;
}

class StaticKnowledgeNodeHandleImpl implements StaticKnowledgeNodeHandle {
  readonly node: KnowledgeNode;
  readonly #address: string;
  readonly #context: ImporterContext;

  constructor(input: { address: string; node: KnowledgeNode; context: ImporterContext }) {
    this.#address = input.address;
    this.node = input.node;
    this.#context = input.context;
  }

  get id(): string {
    return this.node.id;
  }

  async appendKnowledge(input: StaticKnowledgeRecordInput): Promise<KnowledgeRecord> {
    const nodeClaim = await this.#assertMutationAllowed();
    const { storage, importer, claimant, importRunId } = this.#context;
    const scopeIds = narrowRecordScopes(nodeClaim.scopeIds, await this.#recordScopeIds(input.scopes));
    const storedId = input.id === undefined ? undefined : knowledgeImportStoredRecordId(claimant, input.id);
    if (storedId !== undefined) {
      const existing = await storage.getRecord({ id: storedId, includeDeleted: true });
      if (existing) {
        if (existing.nodeId !== this.node.id || existing.source !== importer.source) {
          throw new Error(
            `Knowledge record ${input.id} already exists with different content; importer ${importer.importerId} will not overwrite it`,
          );
        }
        // Someone deleted this importer's record; a re-run must not resurrect it.
        if (existing.deletedAt) return this.#asImported(existing);
        const sameContent =
          existing.text === input.text &&
          // jsonb (pg) does not preserve key order, so compare metadata structurally.
          deepEqual(existing.metadata, input.metadata);
        if (!sameContent) {
          throw new Error(
            `Knowledge record ${input.id} already exists with different content; importer ${importer.importerId} will not overwrite it`,
          );
        }
        return this.#asImported(await this.#claimExistingRecord(existing, scopeIds));
      }
    }
    const created = this.#context.knowledge.createRecord({
      ...(storedId !== undefined ? { id: storedId } : {}),
      text: input.text,
      metadata: input.metadata,
      node: this.node.id,
      source: importer.source,
      scopeIds,
      resolutionScopeIds: [...importer.resolutionScopeIds],
      contextScopeId: importer.scopeId,
      importRunId,
      claimant,
    });
    if (storedId === undefined) return created;
    // A concurrent run of this binding may create the same record first; then the retry finds it.
    return created.then(
      record => this.#asImported(record),
      async error => {
        if (!(error instanceof KnowledgeConflictError)) throw error;
        if (!(await storage.getRecord({ id: storedId }))) throw error;
        return this.appendKnowledge(input);
      },
    );
  }

  /** The record as the importer sees it: under the id it named, not the binding-qualified stored id. */
  #asImported(record: KnowledgeRecord): KnowledgeRecord {
    return { ...record, id: knowledgeImporterRecordId(this.#context.claimant, record.id) };
  }

  /** Re-imports this binding's record, updating its claim when the importer narrowed or widened its scopes. */
  async #claimExistingRecord(record: KnowledgeRecord, scopeIds: KnowledgeScopeIds): Promise<KnowledgeRecord> {
    const { storage, importer, claimant, importRunId } = this.#context;
    for (let attempt = 0; attempt < MAX_CLAIM_ATTEMPTS; attempt++) {
      const current = attempt === 0 ? record : await storage.getRecord({ id: record.id });
      if (!current)
        throw new Error(`Knowledge record ${record.id} disappeared while importer ${importer.importerId} claimed it`);
      const claims = await storage.listImportClaims({ targetType: 'record', targetId: current.id });
      if (!isKnowledgeTargetImporterOwned(current.version, claims, importer)) {
        throw new Error(`Knowledge record ${current.id} changed outside importer ${importer.importerId}`);
      }
      const mine = claims.find(claim => isClaimant(claim, claimant));
      if (mine && knowledgeScopeIdsKey(mine.scopeIds) === knowledgeScopeIdsKey(scopeIds)) return current;
      try {
        return await storage.claimRecord({
          id: current.id,
          version: current.version,
          claimant,
          scopeIds,
          contextScopeId: importer.scopeId,
          importRunId,
        });
      } catch (error) {
        if (!(error instanceof KnowledgeConflictError)) throw error;
      }
    }
    throw new KnowledgeConflictError(record.id);
  }

  async listKnowledge(): Promise<KnowledgeRecord[]> {
    return (await this.ownedRecords()).map(record => this.#asImported(record));
  }

  /** @internal This binding's records under their stored ids. */
  async ownedRecords(): Promise<KnowledgeRecord[]> {
    await this.#context.assertRunActive();
    const nodeClaim = await this.#nodeClaim();
    if (!nodeClaim) return [];
    const { knowledge, storage, importer, claimant } = this.#context;
    const records: KnowledgeRecord[] = [];
    let after: string | undefined;
    do {
      const page = await knowledge.listRecords({
        node: this.node.id,
        scopeIds: canonicalizeKnowledgeScopeIds([...nodeClaim.scopeIds, ...importer.resolutionScopeIds]),
        after,
        limit: 100,
      });
      const owned = await Promise.all(
        page.records.map(async record => {
          if (record.source !== importer.source) return null;
          const claims = await storage.listImportClaims({ targetType: 'record', targetId: record.id });
          return ownsTarget(record, claims, claimant) ? record : null;
        }),
      );
      records.push(...owned.filter((record): record is KnowledgeRecord => record !== null));
      after = page.nextCursor;
    } while (after);
    return records;
  }

  async removeKnowledge(id: string): Promise<KnowledgeRecord | null> {
    await this.#assertMutationAllowed();
    const { storage, importer, claimant } = this.#context;
    if (importer.role !== 'owner') {
      throw new Error(`Knowledge importer ${importer.importerId} requires owner authority to remove knowledge`);
    }
    // An id that isn't this binding's own still resolves, so removing someone else's record is refused, not ignored.
    const record =
      (await storage.getRecord({ id: knowledgeImportStoredRecordId(claimant, id), includeDeleted: true })) ??
      (await storage.getRecord({ id, includeDeleted: true }));
    if (!record) return null;
    const claims = await storage.listImportClaims({ targetType: 'record', targetId: record.id });
    if (
      record.nodeId !== this.node.id ||
      record.source !== importer.source ||
      !claims.some(claim => isClaimant(claim, this.#context.claimant))
    ) {
      throw new Error(`Knowledge importer ${importer.importerId} cannot remove knowledge owned by another binding`);
    }
    const released = await releaseRecord(this.#context, record, claims);
    return released && this.#asImported(released);
  }

  /** This binding's claim on the node, while nothing outside the importer has changed the node since. */
  async #nodeClaim(): Promise<KnowledgeImportClaim | undefined> {
    const { storage, importer, claimant, nodeAddress } = this.#context;
    const binding = await storage.getNodeAddress({ source: importer.source, address: nodeAddress(this.#address) });
    if (binding?.nodeId !== this.node.id) return undefined;
    const node = await storage.getNode(this.node.id);
    if (!node || node.deletedAt) return undefined;
    const claims = await storage.listImportClaims({ targetType: 'node', targetId: node.id });
    return ownsTarget(node, claims, claimant) ? claims.find(claim => isClaimant(claim, claimant)) : undefined;
  }

  async #assertMutationAllowed(): Promise<KnowledgeImportClaim> {
    await this.#context.assertRunActive();
    const claim = await this.#nodeClaim();
    if (!claim) {
      throw new Error(`Knowledge node ${this.#address} is not owned by this importer binding`);
    }
    return claim;
  }

  async #recordScopeIds(scopes: readonly string[] | undefined): Promise<KnowledgeScopeIds | undefined> {
    if (!scopes) return undefined;
    return resolveImporterScopes(this.#context, scopes);
  }
}

class StaticKnowledgeImporterOperationsImpl implements StaticKnowledgeImporterOperations, KnowledgeCitationHost {
  readonly #context: ImporterContext;
  readonly #access: Readonly<Record<string, KnowledgeImporterBindingHandle['role'] | 'readonly'>> | undefined;
  readonly #assertLeaseOwned?: () => Promise<void>;

  constructor(input: {
    knowledge: Knowledge;
    storage: KnowledgeStorage;
    importer: KnowledgeImporterBindingHandle;
    access: Readonly<Record<string, KnowledgeImporterBindingHandle['role'] | 'readonly'>> | undefined;
    importRunId: string;
    assertLeaseOwned?: () => Promise<void>;
  }) {
    this.#access = input.access;
    this.#assertLeaseOwned = input.assertLeaseOwned;
    this.#context = {
      knowledge: input.knowledge,
      storage: input.storage,
      importer: input.importer,
      claimant: {
        importerId: input.importer.importerId,
        binding: input.importer.binding,
        source: input.importer.source,
      },
      nodeAddress: address => knowledgeImportNodeAddress(input.importer.scopeAddress, address),
      importRunId: input.importRunId,
      assertRunActive: () => this.#assertRunActive(),
    };
  }

  get source(): string {
    return this.#context.importer.source;
  }

  get scope(): string {
    return this.#context.importer.scopeAddress;
  }

  /**
   * Classifies a cited identity for this binding. Own-source citations are usable only when this
   * binding holds a claim on the node; other sources are usable only when the node is readable from
   * this binding's resolution scopes. Hidden, deleted, and moved nodes are all `unusable`.
   */
  async citationTarget(ref: KnowledgeCitationRef): Promise<KnowledgeCitationTarget> {
    await this.#assertRunActive();
    const { storage, importer, claimant, nodeAddress } = this.#context;
    const binding =
      ref.source === importer.source
        ? await storage.getNodeAddress({ source: ref.source, address: nodeAddress(normalizeAddress(ref.address)) })
        : await this.#visibleNodeAddress(ref.source, normalizeAddress(ref.address));
    if (!binding) return { status: 'unbound' };
    const node = await this.#context.knowledge.getNode(binding.nodeId);
    if (!node || node.deletedAt) return { status: 'unusable' };
    const usable =
      ref.source === importer.source
        ? ownsTarget(node, await storage.listImportClaims({ targetType: 'node', targetId: node.id }), claimant)
        : (await storage.getNodeScopeIds(node.id)).some(scopeId => importer.resolutionScopeIds.includes(scopeId));
    return usable ? { status: 'usable', nodeId: node.id } : { status: 'unusable' };
  }

  /** Writes a fetched own-source entity through ordinary binding authority; replay never duplicates records. */
  async storeCitedEntity(address: string, entity: KnowledgeCitationEntity): Promise<string> {
    const node = await this.upsertNode(address, { name: entity.name, metadata: entity.metadata, scopes: [this.scope] });
    const existing = await node.listKnowledge();
    for (const record of entity.records ?? []) {
      const present = existing.some(item => (record.id ? item.id === record.id : item.text === record.text));
      if (!present) existing.push(await node.appendKnowledge(record));
    }
    return node.id;
  }

  async getNode(address: string): Promise<StaticKnowledgeNodeHandle | null> {
    await this.#assertRunActive();
    const normalized = normalizeAddress(address);
    const { storage, importer, claimant, nodeAddress } = this.#context;
    const binding = await storage.getNodeAddress({ source: importer.source, address: nodeAddress(normalized) });
    if (!binding) return null;
    const node = await this.#context.knowledge.getNode(binding.nodeId);
    if (!node) return null;
    const claims = await storage.listImportClaims({ targetType: 'node', targetId: node.id });
    return ownsTarget(node, claims, claimant) ? this.#handle(normalized, node) : null;
  }

  async listNodes(): Promise<StaticKnowledgeNodeHandle[]> {
    await this.#assertRunActive();
    const { storage, importer, claimant, nodeAddress } = this.#context;
    const bindings = (await storage.listNodeAddresses({ source: importer.source })).flatMap(binding => {
      const parsed = parseKnowledgeImportNodeAddress(binding.address);
      return parsed?.scope === importer.scopeAddress ? [{ address: parsed.address, nodeId: binding.nodeId }] : [];
    });
    const handles = await Promise.all(
      bindings.map(async binding => {
        const node = await this.#context.knowledge.getNode(binding.nodeId);
        if (!node) return null;
        const claims = await storage.listImportClaims({ targetType: 'node', targetId: node.id });
        return ownsTarget(node, claims, claimant) ? this.#handle(binding.address, node) : null;
      }),
    );
    return handles.filter((handle): handle is StaticKnowledgeNodeHandleImpl => handle !== null);
  }

  async upsertNode(address: string, input: StaticKnowledgeNodeInput): Promise<StaticKnowledgeNodeHandle> {
    await this.#assertRunActive();
    const normalized = normalizeAddress(address);
    const { knowledge, storage, importer, claimant, importRunId, nodeAddress } = this.#context;
    if (!Array.isArray(input.scopes) || input.scopes.length === 0) {
      throw new Error(`Knowledge importer ${importer.importerId} must name at least one scope for node ${normalized}`);
    }
    const scopeIds = await resolveImporterScopes(this.#context, input.scopes, this.#access);
    const name = input.name.trim();
    // Names are unique per scope, but distinct source entities can share a title, so a
    // collision falls back to a deterministic address-derived name rather than coalescing.
    const fallbackName = disambiguatedNodeName(input.name, normalized);

    const binding = await storage.getNodeAddress({ source: importer.source, address: nodeAddress(normalized) });
    if (!binding) {
      const createNode = (nodeName: string) =>
        storage.createNodeWithAddress({
          source: importer.source,
          address: nodeAddress(normalized),
          node: {
            name: nodeName,
            metadata: input.metadata,
            isScope: input.isScope ?? false,
            scopeIds,
            contextScopeId: importer.scopeId,
            importRunId,
            claimant,
          },
        });
      const created = await createNode(name).catch(error => {
        if (!(error instanceof KnowledgeConflictError)) throw error;
        return createNode(fallbackName);
      });
      const claims = await storage.listImportClaims({ targetType: 'node', targetId: created.id });
      // A concurrent run (or another importer with this source and scope) may have created it first; the loop below
      // re-reads it and either treats it as a re-import or rejects it as changed outside this importer.
      if (claims.some(claim => isClaimant(claim, claimant) && claim.version === created.version)) {
        return this.#handle(normalized, created);
      }
    }

    for (let attempt = 0; attempt < MAX_CLAIM_ATTEMPTS; attempt++) {
      const nodeId = (await storage.getNodeAddress({ source: importer.source, address: nodeAddress(normalized) }))
        ?.nodeId;
      const existing = nodeId ? await knowledge.getNode(nodeId) : null;
      if (!existing) throw new Error(`Knowledge node address points to a missing node: ${normalized}`);
      const claims = await storage.listImportClaims({ targetType: 'node', targetId: existing.id });
      if (!isKnowledgeTargetImporterOwned(existing.version, claims, importer)) {
        throw new Error(`Knowledge node ${normalized} changed outside importer ${importer.importerId}`);
      }
      const mine = claims.find(claim => isClaimant(claim, claimant));
      const contentMatches =
        (existing.name === name || existing.name === fallbackName) &&
        deepEqual(existing.metadata, input.metadata) &&
        (input.isScope === undefined || existing.isScope === input.isScope);
      const claimMatches = mine !== undefined && knowledgeScopeIdsKey(mine.scopeIds) === knowledgeScopeIdsKey(scopeIds);
      if (contentMatches && claimMatches) return this.#handle(normalized, existing);
      if (
        importer.role === 'append' &&
        (!contentMatches || (mine && mine.scopeIds.some(id => !scopeIds.includes(id))))
      ) {
        throw new Error(`Knowledge importer ${importer.importerId} cannot update existing nodes with append authority`);
      }
      try {
        let node = existing;
        if (!contentMatches) {
          const update = (nodeName: string) =>
            knowledge.updateNode({
              id: existing.id,
              version: existing.version,
              name: nodeName,
              metadata: input.metadata,
              ...(input.isScope === undefined ? {} : { isScope: input.isScope }),
              contextScopeId: importer.scopeId,
              importRunId,
              claimant,
            });
          // Prefer the plain name so a disambiguated node self-heals once the collision is gone.
          node = await update(name).catch(async error => {
            if (!(error instanceof KnowledgeConflictError) || (await isStale(storage, existing))) throw error;
            return update(fallbackName);
          });
        }
        if (!claimMatches) {
          node = await storage
            .setNodeScopes({
              id: node.id,
              version: node.version,
              claimant,
              scopeIds,
              contextScopeId: importer.scopeId,
              importRunId,
            })
            .catch(async error => {
              // A name taken in a newly joined scope is resolved like on create: fall back to the address-derived name.
              if (
                !(error instanceof KnowledgeConflictError) ||
                (await isStale(storage, node)) ||
                node.name === fallbackName
              ) {
                throw error;
              }
              if (importer.role === 'append') throw error;
              const renamed = await knowledge.updateNode({
                id: node.id,
                version: node.version,
                name: fallbackName,
                contextScopeId: importer.scopeId,
                importRunId,
                claimant,
              });
              return storage.setNodeScopes({
                id: renamed.id,
                version: renamed.version,
                claimant,
                scopeIds,
                contextScopeId: importer.scopeId,
                importRunId,
              });
            });
        }
        return this.#handle(normalized, node);
      } catch (error) {
        // A concurrent run of this binding wrote the node first; re-read and retry.
        if (!(error instanceof KnowledgeConflictError) || !(await isStale(storage, existing))) throw error;
      }
    }
    throw new KnowledgeConflictError(normalized);
  }

  async removeNode(address: string): Promise<{ node: KnowledgeNode; recordsRemoved: number } | null> {
    await this.#assertRunActive();
    const { knowledge, storage, importer, claimant, importRunId, nodeAddress } = this.#context;
    if (importer.role !== 'owner') {
      throw new Error(`Knowledge importer ${importer.importerId} requires owner authority to remove nodes`);
    }
    const normalized = normalizeAddress(address);
    const binding = await storage.getNodeAddress({ source: importer.source, address: nodeAddress(normalized) });
    if (!binding) return null;
    const node = await knowledge.getNode(binding.nodeId);
    if (!node) return null;
    const claims = await storage.listImportClaims({ targetType: 'node', targetId: node.id });
    if (!claims.some(claim => isClaimant(claim, claimant))) return null;
    if (!isKnowledgeTargetImporterOwned(node.version, claims, importer)) {
      await storage.recordImportSkip({
        targetType: 'node',
        targetId: node.id,
        contextScopeId: importer.scopeId,
        importRunId,
        details: { reason: 'ownership-changed', source: importer.source, address: normalized },
      });
      return { node, recordsRemoved: 0 };
    }
    // Nodes are never deleted: only this binding's records go, and every scope membership stays.
    let recordsRemoved = 0;
    for (const record of await this.#handle(normalized, node).ownedRecords()) {
      const recordClaims = await storage.listImportClaims({ targetType: 'record', targetId: record.id });
      if (await releaseRecord(this.#context, record, recordClaims)) recordsRemoved += 1;
    }
    return { node, recordsRemoved };
  }

  /**
   * Another source's node for a provider address, as stored by whichever binding of that source this binding can
   * read. Several destinations may hold their own copy; the one in this binding's own scope wins, then the first
   * visible one by id.
   */
  async #visibleNodeAddress(source: string, address: string) {
    const { storage, importer } = this.#context;
    const candidates = (await storage.listNodeAddresses({ source })).filter(
      entry => (parseKnowledgeImportNodeAddress(entry.address)?.address ?? entry.address) === address,
    );
    const visible = [];
    for (const entry of candidates) {
      const scopeIds = await storage.getNodeScopeIds(entry.nodeId);
      if (scopeIds.some(scopeId => importer.resolutionScopeIds.includes(scopeId))) visible.push(entry);
    }
    const own = visible.find(entry => parseKnowledgeImportNodeAddress(entry.address)?.scope === importer.scopeAddress);
    return own ?? visible.sort((a, b) => a.nodeId.localeCompare(b.nodeId))[0] ?? null;
  }

  async #assertRunActive(): Promise<void> {
    await this.#assertLeaseOwned?.();
    const { knowledge, importer, importRunId } = this.#context;
    const run = await knowledge.getImportRun(importRunId);
    if (
      !run ||
      run.importerId !== importer.importerId ||
      run.binding !== importer.binding ||
      (run.importKind !== 'static' && run.importKind !== 'agentic') ||
      run.status !== 'running'
    ) {
      throw new Error(`Knowledge import run ${importRunId} is not active`);
    }
  }

  #handle(address: string, node: KnowledgeNode): StaticKnowledgeNodeHandleImpl {
    return new StaticKnowledgeNodeHandleImpl({ address, node, context: this.#context });
  }
}

/** Releases this binding's claim on a record, skipping it when the record changed outside the importer. */
async function releaseRecord(
  context: ImporterContext,
  record: KnowledgeRecord,
  claims: KnowledgeImportClaim[],
): Promise<KnowledgeRecord | null> {
  const { storage, importer, claimant, importRunId } = context;
  if (record.deletedAt || !isKnowledgeTargetImporterOwned(record.version, claims, importer)) {
    await storage.recordImportSkip({
      targetType: 'record',
      targetId: record.id,
      contextScopeId: importer.scopeId,
      importRunId,
      details: { reason: 'ownership-changed', source: importer.source },
    });
    return null;
  }
  const { record: released } = await storage.releaseRecordClaim({
    id: record.id,
    version: record.version,
    claimant,
    importRunId,
  });
  return released;
}

/**
 * Resolves importer-named scopes to scope node ids and enforces the binding limit: every scope is
 * the binding scope or sits under it, and structural scopes must also be writable under `access`.
 * An entry is first looked up as this source's own imported scope node, then as a structural address.
 */
async function resolveImporterScopes(
  context: ImporterContext,
  scopes: readonly string[],
  access?: Readonly<Record<string, string>>,
): Promise<KnowledgeScopeIds> {
  const { knowledge, storage, importer, nodeAddress } = context;
  const resolved: string[] = [];
  for (const entry of scopes) {
    const address = normalizeAddress(entry);
    let scopeId: string | undefined;
    const imported = await storage.getNodeAddress({ source: importer.source, address: context.nodeAddress(address) });
    if (imported) {
      const node = await knowledge.getNode(imported.nodeId);
      if (node?.isScope && !node.deletedAt) scopeId = node.id;
    }
    if (!scopeId) {
      const structural = await storage.getScopeAddress(address);
      if (structural && isWritableAddress(access, address)) scopeId = structural.scopeNodeId;
    }
    if (!scopeId || !(await isUnderScope(storage, scopeId, importer.scopeId))) {
      throw new Error(
        `Knowledge importer ${importer.importerId} cannot write to scope ${address}: it must be ${importer.scopeAddress} or under it`,
      );
    }
    resolved.push(scopeId);
  }
  return canonicalizeKnowledgeScopeIds(resolved);
}

function isWritableAddress(access: Readonly<Record<string, string>> | undefined, address: string): boolean {
  if (!access) return true;
  return Object.entries(access).some(([pattern, role]) => role !== 'readonly' && matchAddressPattern(pattern, address));
}

/** True when `scopeId` is `rootId` or `rootId` is among its transitive scope memberships. */
async function isUnderScope(storage: KnowledgeStorage, scopeId: string, rootId: string): Promise<boolean> {
  const seen = new Set<string>();
  const stack = [scopeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === rootId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(await storage.getNodeScopeIds(current)));
  }
  return false;
}

/** A record lives in the node's claimed scopes, or in a subset of them the importer names. */
function narrowRecordScopes(
  nodeScopeIds: KnowledgeScopeIds,
  requested: KnowledgeScopeIds | undefined,
): KnowledgeScopeIds {
  if (!requested) return canonicalizeKnowledgeScopeIds(nodeScopeIds);
  const outside = requested.filter(id => !nodeScopeIds.includes(id));
  if (requested.length === 0 || outside.length > 0) {
    throw new Error('Knowledge importer record scopes must be a non-empty subset of the node scopes');
  }
  return canonicalizeKnowledgeScopeIds(requested);
}

async function isStale(storage: KnowledgeStorage, node: KnowledgeNode): Promise<boolean> {
  return (await storage.getNode(node.id))?.version !== node.version;
}

/** A binding owns a target it claims, until something outside the importer changes the target. */
function ownsTarget(
  target: { version: number; deletedAt?: Date },
  claims: KnowledgeImportClaim[],
  claimant: KnowledgeImportClaimant,
): boolean {
  return (
    !target.deletedAt &&
    claims.some(claim => isClaimant(claim, claimant)) &&
    isKnowledgeTargetImporterOwned(target.version, claims, claimant)
  );
}

function isClaimant(claim: KnowledgeImportClaim, claimant: KnowledgeImportClaimant): boolean {
  return claim.importerId === claimant.importerId && claim.binding === claimant.binding;
}

function disambiguatedNodeName(name: string, address: string): string {
  const tail = address
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-6)
    .toLowerCase();
  return `${name.trim()} (${tail || 'alt'})`;
}

function normalizeAddress(address: string): string {
  const normalized = address.trim();
  if (!normalized) throw new Error('Knowledge importer node address cannot be empty');
  return normalized;
}

function roleRank(role: KnowledgeImporterBindingHandle['role']): number {
  return role === 'owner' ? 3 : role === 'edit' ? 2 : 1;
}

export function matchAddressPattern(pattern: string, address: string): Record<string, string> | null {
  const names: string[] = [];
  const expression = pattern
    .split(/(\$[A-Za-z][A-Za-z0-9_]*)/g)
    .map(part => {
      if (part.startsWith('$')) {
        names.push(part.slice(1));
        return '([^:/]+)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  const match = new RegExp(`^${expression}$`).exec(address);
  if (!match) return null;
  return Object.fromEntries(names.map((name, index) => [name, match[index + 1]!]));
}

function renderAddressPattern(pattern: string, parameters: Record<string, string>): string | null {
  let complete = true;
  const address = pattern.replace(/\$([A-Za-z][A-Za-z0-9_]*)/g, (_match, name: string) => {
    const value = parameters[name];
    if (!value) complete = false;
    return value ?? '';
  });
  return complete ? address : null;
}
