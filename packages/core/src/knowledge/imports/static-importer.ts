import type { KnowledgeNode, KnowledgeRecord, KnowledgeScopeIds } from '../../storage/domains/knowledge';
import type { Knowledge } from '../index';
import type { KnowledgeImporterBindingHandle } from './types';

export interface StaticKnowledgeNodeInput {
  readonly address: string;
  readonly name: string;
  readonly kind: string;
  readonly metadata?: Record<string, unknown>;
  readonly scopeIds?: KnowledgeScopeIds;
}

export interface StaticKnowledgeRecordInput {
  readonly id?: string;
  readonly text: string;
  readonly metadata?: Record<string, unknown>;
}

export interface StaticKnowledgeImporterContext {
  readonly importerId: string;
  readonly binding: string;
  readonly importRunId: string;
  readonly source: KnowledgeImporterBindingHandle['source'];
  readonly scopeIds: KnowledgeScopeIds;
  readonly role: KnowledgeImporterBindingHandle['role'];
}

/**
 * An importer-owned view of one Knowledge node. Record operations use ordinary Knowledge records,
 * narrowed to records written by this registered source.
 */
export class StaticKnowledgeNodeHandle {
  readonly node: KnowledgeNode;
  readonly #knowledge: Knowledge;
  readonly #importer: KnowledgeImporterBindingHandle;
  readonly #importRunId: string;
  readonly #assertRunActive: () => Promise<void>;

  constructor(input: {
    node: KnowledgeNode;
    knowledge: Knowledge;
    importer: KnowledgeImporterBindingHandle;
    importRunId: string;
    assertRunActive: () => Promise<void>;
  }) {
    this.node = input.node;
    this.#knowledge = input.knowledge;
    this.#importer = input.importer;
    this.#importRunId = input.importRunId;
    this.#assertRunActive = input.assertRunActive;
  }

  get id(): string {
    return this.node.id;
  }

  async createRecord(input: StaticKnowledgeRecordInput): Promise<KnowledgeRecord> {
    await this.#assertRunActive();
    return this.#knowledge.createRecord({
      ...input,
      node: this.node.id,
      source: this.#importer.sourceKey,
      scopeIds: [...this.#importer.scopeIds],
      importRunId: this.#importRunId,
    });
  }

  async listRecords(): Promise<KnowledgeRecord[]> {
    const records: KnowledgeRecord[] = [];
    let after: string | undefined;
    do {
      const page = await this.#knowledge.listRecords({
        node: this.node.id,
        scopeIds: [...this.#importer.scopeIds],
        after,
        limit: 100,
      });
      records.push(...page.records.filter(record => record.source === this.#importer.sourceKey));
      after = page.nextCursor;
    } while (after);
    return records;
  }

  async removeRecord(id: string): Promise<KnowledgeRecord | null> {
    await this.#assertRunActive();
    if (this.#importer.role === 'append') {
      throw new Error(`Knowledge importer ${this.#importer.importerId} cannot remove records with append authority`);
    }
    const storage = await this.#knowledge.getStorage();
    const record = await storage.getRecord({ id, includeDeleted: true });
    if (!record) return null;
    if (record.source !== this.#importer.sourceKey) {
      throw new Error(`Knowledge importer ${this.#importer.importerId} cannot remove a record owned by another source`);
    }
    return storage.deleteRecordBySource({ id, source: this.#importer.sourceKey, importRunId: this.#importRunId });
  }
}

/**
 * Operations exposed to one registered static importer run. External addresses are namespaced by
 * the immutable registered source identity; callers cannot choose another source or destination
 * scope.
 */
export class StaticKnowledgeImporterOperations {
  readonly #knowledge: Knowledge;
  readonly #importer: KnowledgeImporterBindingHandle;
  readonly #binding: string;
  readonly #importRunId: string;

  constructor(input: {
    knowledge: Knowledge;
    importer: KnowledgeImporterBindingHandle;
    binding: string;
    importRunId: string;
  }) {
    this.#knowledge = input.knowledge;
    this.#importer = input.importer;
    this.#binding = input.binding;
    this.#importRunId = input.importRunId;
  }

  async getNode(address: string): Promise<StaticKnowledgeNodeHandle | null> {
    const storage = await this.#knowledge.getStorage();
    const binding = await storage.getNodeAddress({
      source: this.#importer.sourceKey,
      address: normalizeAddress(address),
    });
    if (!binding) return null;
    const node = await this.#knowledge.getNode(binding.nodeId);
    return node ? this.#handle(node) : null;
  }

  async listNodes(): Promise<StaticKnowledgeNodeHandle[]> {
    const storage = await this.#knowledge.getStorage();
    const bindings = await storage.listNodeAddresses({ source: this.#importer.sourceKey });
    const nodes = await Promise.all(bindings.map(binding => this.#knowledge.getNode(binding.nodeId)));
    return [
      ...new Map(nodes.filter((node): node is KnowledgeNode => node !== null).map(node => [node.id, node])).values(),
    ].map(node => this.#handle(node));
  }

  async upsertNode(input: StaticKnowledgeNodeInput): Promise<StaticKnowledgeNodeHandle> {
    await this.#assertRunActive();
    const address = normalizeAddress(input.address);
    const storage = await this.#knowledge.getStorage();
    const binding = await storage.getNodeAddress({ source: this.#importer.sourceKey, address });
    const existing = binding
      ? await this.#knowledge.getNode(binding.nodeId)
      : await storage.createNodeWithAddress({
          source: this.#importer.sourceKey,
          address,
          node: {
            name: input.name,
            kind: input.kind,
            metadata: input.metadata,
            scopeIds: input.scopeIds ? [...input.scopeIds] : [...this.#importer.scopeIds],
            importRunId: this.#importRunId,
          },
        });
    if (!existing) throw new Error(`Knowledge node address points to a missing node: ${address}`);
    const importerScopeIds = input.scopeIds ? [...input.scopeIds] : [...this.#importer.scopeIds];
    const existingScopeIds = await storage.getNodeScopeIds(existing.id);
    const matchesImporterState =
      existing.name === input.name.trim() &&
      existing.kind === input.kind &&
      JSON.stringify(existing.metadata) === JSON.stringify(input.metadata) &&
      existingScopeIds.length === importerScopeIds.length &&
      existingScopeIds.every((scopeId, index) => scopeId === importerScopeIds[index]);
    if (matchesImporterState) {
      await this.#setTrackedNode(address, existing);
      return this.#handle(existing);
    }
    if (this.#importer.role === 'append') {
      throw new Error(
        `Knowledge importer ${this.#importer.importerId} cannot update existing nodes with append authority`,
      );
    }
    const tracked = await this.#getTrackedNode(address);
    if (tracked?.nodeId !== existing.id || tracked.version !== existing.version) {
      throw new Error(`Knowledge node ${address} changed outside importer ${this.#importer.importerId}`);
    }
    const updated = await this.#knowledge.updateNode({
      id: existing.id,
      version: existing.version,
      name: input.name,
      kind: input.kind,
      metadata: input.metadata,
      scopeIds: importerScopeIds,
      importRunId: this.#importRunId,
    });
    await this.#setTrackedNode(address, updated);
    return this.#handle(updated);
  }

  async rebindNode(input: { address: string; newAddress: string }): Promise<StaticKnowledgeNodeHandle> {
    await this.#assertRunActive();
    if (this.#importer.role === 'append') {
      throw new Error(`Knowledge importer ${this.#importer.importerId} cannot rebind nodes with append authority`);
    }
    const address = normalizeAddress(input.address);
    const newAddress = normalizeAddress(input.newAddress);
    const storage = await this.#knowledge.getStorage();
    const existing = await storage.getNodeAddress({ source: this.#importer.sourceKey, address });
    const tracked = existing ? undefined : await this.#getTrackedNode(address);
    if (!existing && !tracked) throw new Error(`Knowledge node address does not exist: ${address}`);
    const nodeId = existing?.nodeId ?? tracked!.nodeId;
    await storage.rebindNodeAddress({
      source: this.#importer.sourceKey,
      address,
      newAddress,
      nodeId,
      importRunId: this.#importRunId,
    });
    const node = await this.#knowledge.getNode(nodeId);
    if (!node) throw new Error(`Knowledge node address points to a missing node: ${newAddress}`);
    if (address !== newAddress) {
      await this.#setTrackedNode(address, node);
      await this.#setTrackedNode(newAddress, node);
    }
    return this.#handle(node);
  }

  async unbindNode(address: string): Promise<void> {
    await this.#assertRunActive();
    if (this.#importer.role !== 'owner') {
      throw new Error(`Knowledge importer ${this.#importer.importerId} requires owner authority to unbind nodes`);
    }
    const storage = await this.#knowledge.getStorage();
    const normalized = normalizeAddress(address);
    const existing = await storage.getNodeAddress({ source: this.#importer.sourceKey, address: normalized });
    if (!existing) return;
    await storage.removeNodeAddress({ ...existing });
    await this.#setTrackedNode(normalized, undefined);
  }

  async removeNode(address: string): Promise<{ node: KnowledgeNode; deleted: boolean } | null> {
    await this.#assertRunActive();
    if (this.#importer.role !== 'owner') {
      throw new Error(`Knowledge importer ${this.#importer.importerId} requires owner authority to remove nodes`);
    }
    const storage = await this.#knowledge.getStorage();
    const normalized = normalizeAddress(address);
    if (!(await storage.getNodeAddress({ source: this.#importer.sourceKey, address: normalized }))) return null;
    const result = await storage.deleteNodeByAddress({
      source: this.#importer.sourceKey,
      address: normalized,
      importRunId: this.#importRunId,
    });
    await this.#setTrackedNode(normalized, undefined);
    return result;
  }

  async #getTrackedNode(address: string): Promise<{ nodeId: string; version: number } | undefined> {
    const state = await this.#knowledge.getImportState({
      importerId: this.#importer.importerId,
      binding: this.#binding,
      key: trackedVersionKey(address),
    });
    if (!state?.value) return undefined;
    try {
      const tracked = JSON.parse(state.value) as { nodeId?: unknown; version?: unknown };
      return typeof tracked.nodeId === 'string' && Number.isSafeInteger(tracked.version) && Number(tracked.version) > 0
        ? { nodeId: tracked.nodeId, version: Number(tracked.version) }
        : undefined;
    } catch {
      return undefined;
    }
  }

  async #setTrackedNode(address: string, node: KnowledgeNode | undefined): Promise<void> {
    await this.#knowledge.setImportState({
      importerId: this.#importer.importerId,
      binding: this.#binding,
      key: trackedVersionKey(address),
      value: node ? JSON.stringify({ nodeId: node.id, version: node.version }) : '',
    });
  }

  async #assertRunActive(): Promise<void> {
    const run = await this.#knowledge.getImportRun(this.#importRunId);
    if (
      !run ||
      run.importerId !== this.#importer.importerId ||
      run.importKind !== 'static' ||
      run.status !== 'running'
    ) {
      throw new Error(`Knowledge import run ${this.#importRunId} is not active`);
    }
  }

  #handle(node: KnowledgeNode): StaticKnowledgeNodeHandle {
    return new StaticKnowledgeNodeHandle({
      node,
      knowledge: this.#knowledge,
      importer: this.#importer,
      importRunId: this.#importRunId,
      assertRunActive: () => this.#assertRunActive(),
    });
  }
}

function trackedVersionKey(address: string): string {
  return `mastra:static-importer:node-version:${address}`;
}

function normalizeAddress(address: string): string {
  const normalized = address.trim();
  if (!normalized) throw new Error('Knowledge importer node address cannot be empty');
  return normalized;
}
