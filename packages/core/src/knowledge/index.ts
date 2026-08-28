import { randomUUID } from 'node:crypto';
import { MastraBase } from '../base';
import type { Mastra } from '../mastra';
import type { MastraCompositeStore } from '../storage';
import type {
  AppendKnowledgeInput,
  ClaimKnowledgeSemanticOutboxInput,
  CreateKnowledgeNodeInput,
  KnowledgeScope,
  KnowledgeSemanticOutboxEntry,
  KnowledgeStructurePlan,
  KnowledgeStructureReconcileResult,
  KnowledgeStorage,
  ListKnowledgeNodesInput,
  QueryKnowledgeBySourceInput,
  QueryKnowledgeInput,
  SearchKnowledgeInput,
  UpdateKnowledgeNodeInput,
} from '../storage/domains/knowledge';
import { augmentWithInit, getStorageSource } from '../storage/storageWithInit';
import type { KnowledgeConfig } from './config';
import { KnowledgeImporterRegistry, type KnowledgeImporterDefinition } from './imports';
import {
  materializeKnowledgeScopePlan,
  validateKnowledgeScopeTypes,
  validateKnowledgeStructurePlan,
  type KnowledgeScopeTypesConfig,
  type MaterializeKnowledgeScopeInput,
} from './reconcile';

/** @experimental Knowledge APIs are experimental and may change without notice. */
export class Knowledge extends MastraBase {
  readonly id: string;
  readonly hasOwnStorage: boolean;

  readonly description?: string;

  #storage?: MastraCompositeStore;
  #storageSource?: MastraCompositeStore;
  #storagePromise?: Promise<KnowledgeStorage>;
  #structure?: KnowledgeStructurePlan;
  #scopeTypes?: KnowledgeScopeTypesConfig;
  #importers = new KnowledgeImporterRegistry();
  #reconcilePromise?: Promise<KnowledgeStructureReconcileResult>;
  #materializePromises = new Map<
    string,
    { plan: KnowledgeStructurePlan; promise: Promise<KnowledgeStructureReconcileResult> }
  >();

  constructor(config: KnowledgeConfig = {}) {
    super({ component: 'STORAGE', name: config.name ?? config.id ?? 'Knowledge' });
    this.id = config.id ?? randomUUID();
    this.description = config.description;
    this.#structure = config.structure ? validateKnowledgeStructurePlan(structuredClone(config.structure)) : undefined;
    this.#scopeTypes = validateKnowledgeScopeTypes(structuredClone(config.scopes));
    for (const importer of config.importers ?? []) {
      this.registerImporter(importer);
    }
    this.hasOwnStorage = config.storage !== undefined;
    if (config.storage) {
      this.#storageSource = getStorageSource(config.storage);
      this.#storage = augmentWithInit(config.storage);
    }
  }

  /** @internal */
  __registerMastra(_mastra: Mastra): void {
    if (!this.#structure) return;
    queueMicrotask(() => {
      void this.reconcile().catch(error => {
        this.logger.warn('Knowledge structure reconciliation failed; call reconcile() to retry', { error });
      });
    });
  }

  /** @internal */
  __sharesStorageWith(other: Knowledge): boolean {
    if (!this.#storageSource || !other.#storageSource) return false;
    if (this.#storageSource === other.#storageSource) return true;

    const domain = this.#storageSource.stores?.knowledge;
    const otherDomain = other.#storageSource.stores?.knowledge;
    return (
      domain !== undefined &&
      otherDomain !== undefined &&
      domain.getStorageIsolationKey() === otherDomain.getStorageIsolationKey()
    );
  }

  /** @internal */
  __usesStorage(storage: MastraCompositeStore): boolean {
    const source = getStorageSource(storage);
    if (this.#storageSource === source) return true;

    const domain = this.#storageSource?.stores?.knowledge;
    const sourceDomain = source.stores?.knowledge;
    return (
      domain !== undefined &&
      sourceDomain !== undefined &&
      domain.getStorageIsolationKey() === sourceDomain.getStorageIsolationKey()
    );
  }

  /** Returns trusted placement context for the exact scope addresses visible to an agent. @internal */
  async __getDescriptionContext(scope: KnowledgeScope): Promise<{
    description?: string;
    scopes: Array<{ address: string; name: string; description: string }>;
  }> {
    const visibleAddresses = new Set(scope);
    const placementScopes = await this.#placementScopes(scope);
    const structural = new Set(
      this.#visibleStructureScopes(scope, placementScopes).map(visibleScope => visibleScope.address),
    );
    return {
      description: this.description?.trim() || undefined,
      scopes: placementScopes.flatMap(configuredScope => {
        const description = configuredScope.description?.trim();
        if (!description) return [];
        if (!visibleAddresses.has(configuredScope.address) && !structural.has(configuredScope.address)) return [];
        return [{ address: configuredScope.address, name: configuredScope.name, description }];
      }),
    };
  }

  /**
   * Host-configured scopes a writer holding `scope` could place into: the static structure plan
   * plus the template children of each held address. Template children are derived from the
   * scope-type config the store materializes them from, so they are host-vouched like the plan.
   * Children are copied on create, so only those that exist in storage are offered: a scope
   * materialized before its template gained a child does not have that child.
   */
  async #placementScopes(scope: KnowledgeScope): Promise<KnowledgeStructurePlan['scopes']> {
    const configured = this.#structure?.scopes ?? [];
    const known = new Set(configured.map(configuredScope => configuredScope.address));
    const templated: KnowledgeStructurePlan['scopes'] = [];
    for (const address of scope) {
      let plan: KnowledgeStructurePlan;
      try {
        plan = materializeKnowledgeScopePlan(this.#scopeTypes, { address, contextualScopeAddress: address });
      } catch {
        continue;
      }
      for (const child of plan.scopes.slice(1)) {
        if (known.has(child.address)) continue;
        known.add(child.address);
        templated.push(child);
      }
    }
    if (templated.length === 0) return configured;
    const storage = await this.getStorage();
    const { scopes: existing } = await storage.listScopeNodes({
      addresses: templated.map(child => child.address),
      limit: templated.length,
    });
    const existingAddresses = new Set(existing.map(node => node.address));
    return [...configured, ...templated.filter(child => existingAddresses.has(child.address))];
  }

  /**
   * Structural scopes a writer holding `scope` may place content into: every configured
   * or held-scope template child whose ancestor chain (via parent addresses) reaches a held address.
   * Held identity addresses themselves are excluded — those are placed via rungs. The
   * structure plan is host configuration, so this frontier is host-vouched. @internal
   */
  async __getVisibleStructureScopes(
    scope: KnowledgeScope,
  ): Promise<Array<{ address: string; name: string; description?: string; heldAncestors: string[] }>> {
    return this.#visibleStructureScopes(scope, await this.#placementScopes(scope));
  }

  #visibleStructureScopes(
    scope: KnowledgeScope,
    configured: KnowledgeStructurePlan['scopes'],
  ): Array<{ address: string; name: string; description?: string; heldAncestors: string[] }> {
    const held = new Set(scope);
    const parentsByAddress = new Map(configured.map(configuredScope => [configuredScope.address, configuredScope]));
    // Held identity addresses reachable through the scope's ancestor chain. Placing a node
    // into the scope should keep its identity scope at one of these so the node stays
    // readable wherever the structural scope is.
    const heldAncestorsOf = (address: string): string[] => {
      // DFS over all declared parents (multi-parent scopes are valid); the plan is
      // validated acyclic, the seen set is just belt-and-braces.
      const seen = new Set<string>();
      const reached: string[] = [];
      const stack = [address];
      while (stack.length > 0) {
        const current = stack.pop()!;
        if (seen.has(current)) continue;
        seen.add(current);
        if (held.has(current)) {
          reached.push(current);
          continue;
        }
        for (const parent of parentsByAddress.get(current)?.parentAddresses ?? []) stack.push(parent);
      }
      return reached;
    };
    const visible: Array<{ address: string; name: string; description?: string; heldAncestors: string[] }> = [];
    for (const configuredScope of configured) {
      if (held.has(configuredScope.address)) continue;
      const heldAncestors = heldAncestorsOf(configuredScope.address);
      if (heldAncestors.length === 0) continue;
      visible.push({
        address: configuredScope.address,
        name: configuredScope.name,
        ...(configuredScope.description ? { description: configuredScope.description } : {}),
        heldAncestors,
      });
    }
    return visible;
  }

  /** @internal */
  setStorage(storage: MastraCompositeStore, source: MastraCompositeStore = storage): void {
    if (this.hasOwnStorage) return;
    this.#storageSource = getStorageSource(source);
    this.#storage = augmentWithInit(storage);
    this.#storagePromise = undefined;
  }

  async getStorage(): Promise<KnowledgeStorage> {
    if (!this.#storagePromise) {
      const promise = this.#resolveStorage().catch(error => {
        if (this.#storagePromise === promise) {
          this.#storagePromise = undefined;
        }
        throw error;
      });
      this.#storagePromise = promise;
    }
    return this.#storagePromise;
  }

  async #resolveStorage(): Promise<KnowledgeStorage> {
    if (!this.#storage) {
      throw new Error(
        'Knowledge requires a storage provider. Configure storage on the Knowledge instance or on the owning Mastra instance.',
      );
    }

    const storage = await this.#storage.getStore('knowledge');
    if (!storage) {
      throw new Error('The configured storage provider does not provide a Knowledge storage domain.');
    }

    const capabilities = storage.getCapabilities();
    if (!capabilities.supportsV2) {
      throw new Error(
        `The configured Knowledge storage adapter supports schema version ${capabilities.schemaVersion}, but Knowledge requires schema version 2.`,
      );
    }

    return storage;
  }

  async reconcile(): Promise<KnowledgeStructureReconcileResult> {
    if (!this.#structure) {
      return { scopes: {}, createdScopeIds: [], changed: false, accessEpoch: 0 };
    }
    if (!this.#reconcilePromise) {
      const promise = this.getStorage()
        .then(storage => storage.reconcileStructure(this.#structure!))
        .finally(() => {
          if (this.#reconcilePromise === promise) this.#reconcilePromise = undefined;
        });
      this.#reconcilePromise = promise;
    }
    return this.#reconcilePromise;
  }

  async materializeScope(input: MaterializeKnowledgeScopeInput): Promise<KnowledgeStructureReconcileResult> {
    const snapshot = structuredClone(input);
    const plan = materializeKnowledgeScopePlan(this.#scopeTypes, snapshot);
    const existing = this.#materializePromises.get(snapshot.address);
    if (existing) {
      if (JSON.stringify(existing.plan) !== JSON.stringify(plan)) {
        throw new Error(`Conflicting materialization is already in progress for Knowledge scope ${snapshot.address}`);
      }
      return existing.promise;
    }

    const promise = this.getStorage()
      .then(async storage => {
        // Template children are copied on create: a scope that already exists keeps the
        // children it was created with, even when its scope type template changes later.
        if (plan.scopes.length > 1) {
          const { scopes } = await storage.listScopeNodes({ addresses: [snapshot.address], limit: 1 });
          if (scopes.length > 0) return storage.reconcileStructure({ ...plan, scopes: plan.scopes.slice(0, 1) });
        }
        return storage.reconcileStructure(plan);
      })
      .then(result => {
        if (result.deletedScopeAddresses?.includes(snapshot.address)) {
          throw new Error(`Knowledge scope ${snapshot.address} was explicitly deleted and cannot be recreated lazily`);
        }
        return result;
      })
      .finally(() => {
        if (this.#materializePromises.get(snapshot.address)?.promise === promise) {
          this.#materializePromises.delete(snapshot.address);
        }
      });
    this.#materializePromises.set(snapshot.address, { plan, promise });
    return promise;
  }

  registerImporter(definition: KnowledgeImporterDefinition) {
    return this.#importers.register(definition);
  }

  getImporter(id: string) {
    return this.#importers.get(id);
  }

  listImporters() {
    return this.#importers.list();
  }

  async createNode(input: CreateKnowledgeNodeInput) {
    return (await this.getStorage()).createNode(input);
  }

  async getNode(id: string) {
    return (await this.getStorage()).getNode(id);
  }

  async getNodeByName(input: { name: string; scope: KnowledgeScope }) {
    return (await this.getStorage()).getNodeByName(input);
  }

  async resolveNode(input: { name: string; scope: KnowledgeScope }) {
    return (await this.getStorage()).resolveNode(input);
  }

  async listNodes(input: ListKnowledgeNodesInput) {
    return (await this.getStorage()).listNodes(input);
  }

  async updateNode(input: UpdateKnowledgeNodeInput) {
    return (await this.getStorage()).updateNode(input);
  }

  async mergeNodes(input: { sourceId: string; targetId: string; sourceVersion: number }) {
    return (await this.getStorage()).mergeNodes(input);
  }

  async appendKnowledge(input: AppendKnowledgeInput) {
    return (await this.getStorage()).appendKnowledge(input);
  }

  async getKnowledge(input: { id: string; includeDeleted?: boolean }) {
    return (await this.getStorage()).getKnowledge(input);
  }

  async listKnowledgeAbout(input: QueryKnowledgeInput) {
    return (await this.getStorage()).listKnowledgeAbout(input);
  }

  async listKnowledgeMentioning(input: QueryKnowledgeInput) {
    return (await this.getStorage()).listKnowledgeMentioning(input);
  }

  async listKnowledgeRelatedTo(input: QueryKnowledgeInput) {
    return (await this.getStorage()).listKnowledgeRelatedTo(input);
  }

  async knowledgeBySource(input: QueryKnowledgeBySourceInput) {
    return (await this.getStorage()).knowledgeBySource(input);
  }

  async removeKnowledge(input: { id: string; deletedBy: string }) {
    return (await this.getStorage()).removeKnowledge(input);
  }

  async restoreKnowledge(input: { id: string }) {
    return (await this.getStorage()).restoreKnowledge(input);
  }

  async rescopeKnowledge(input: { id: string; scope: KnowledgeScope }) {
    return (await this.getStorage()).rescopeKnowledge(input);
  }

  async search(input: SearchKnowledgeInput) {
    return (await this.getStorage()).search(input);
  }

  async listActivity(input: { scope: KnowledgeScope; after?: string; limit?: number }) {
    return (await this.getStorage()).listActivity(input);
  }

  async listSemanticOutbox(input?: {
    status?: KnowledgeSemanticOutboxEntry['status'];
    scope?: KnowledgeScope;
    limit?: number;
  }) {
    return (await this.getStorage()).listSemanticOutbox(input);
  }

  async claimSemanticOutbox(input: ClaimKnowledgeSemanticOutboxInput) {
    return (await this.getStorage()).claimSemanticOutbox(input);
  }

  async completeSemanticOutbox(input: { ids: string[]; workerId: string }) {
    return (await this.getStorage()).completeSemanticOutbox(input);
  }

  async releaseSemanticOutbox(input: { ids: string[]; workerId: string; retryAt?: Date }) {
    return (await this.getStorage()).releaseSemanticOutbox(input);
  }
}

export * from '../storage/domains/knowledge';
export * from './imports';
export type { KnowledgeConfig } from './config';
export type {
  KnowledgeScopeAccessConfig,
  KnowledgeScopeChildTemplate,
  KnowledgeScopeTypeConfig,
  KnowledgeScopeTypesConfig,
  MaterializeKnowledgeScopeInput,
} from './reconcile';
