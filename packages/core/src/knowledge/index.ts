import { randomUUID } from 'node:crypto';
import { MastraBase } from '../base';
import type { Mastra } from '../mastra';
import type { MastraCompositeStore } from '../storage';
import {
  assertKnowledgeRecordScopesVisible,
  sanitizeKnowledgeImportError,
  KnowledgeUnsupportedError,
} from '../storage/domains/knowledge';
import type {
  CreateKnowledgeRecordInput,
  ClaimKnowledgeSemanticOutboxInput,
  CreateKnowledgeNodeInput,
  CreateKnowledgeImportRunInput,
  KnowledgeScopeIds,
  KnowledgeSemanticOutboxEntry,
  KnowledgeStructurePlan,
  ListKnowledgeImportRunsInput,
  UpdateKnowledgeImportRunInput,
  KnowledgeStructureReconcileResult,
  KnowledgeStorage,
  ListKnowledgeNodesInput,
  QueryKnowledgeRecordsBySourceInput,
  QueryKnowledgeRecordsInput,
  QueryKnowledgeRecordsOutput,
  SearchKnowledgeInput,
  UpdateKnowledgeNodeInput,
} from '../storage/domains/knowledge';
import { augmentWithInit, getStorageSource } from '../storage/storageWithInit';
import type { KnowledgeConfig, KnowledgeToolsConfig } from './config';
import { KnowledgeImporterRegistry } from './imports';
import type { KnowledgeImporterBindingInput, KnowledgeImporterDefinition, KnowledgeImporterResolver } from './imports';
import { KnowledgeImporterRunner } from './imports/runner';
import {
  materializeKnowledgeScopePlan,
  planKnowledgeRunScopes,
  validateKnowledgeScopeTypes,
  validateKnowledgeStructurePlan,
} from './reconcile';
import type { KnowledgeRunScopePlan, KnowledgeScopeTypesConfig, MaterializeKnowledgeScopeInput } from './reconcile';

function configuredScopeDescription(scope: KnowledgeStructurePlan['scopes'][number]): string | undefined {
  const description = scope.metadata?.description;
  return typeof description === 'string' ? description.trim() || undefined : undefined;
}

export class Knowledge extends MastraBase {
  readonly id: string;
  readonly hasOwnStorage: boolean;

  readonly description?: string;
  /** Knowledge tools Memory gives every agent that uses this instance. */
  readonly tools: Readonly<Required<KnowledgeToolsConfig>>;

  #storage?: MastraCompositeStore;
  #storageSource?: MastraCompositeStore;
  #storagePromise?: Promise<KnowledgeStorage>;
  #structure?: KnowledgeStructurePlan;
  #scopeTypes?: KnowledgeScopeTypesConfig;
  #importers = new KnowledgeImporterRegistry();
  #importerRunner = new KnowledgeImporterRunner(this, () => this.logger);
  #importerResolver?: KnowledgeImporterResolver;
  #importerProvenance = new Map<string, 'config' | 'resolver' | 'manual'>();
  #reconcilePromise?: Promise<KnowledgeStructureReconcileResult>;
  #materializePromises = new Map<
    string,
    { plan: KnowledgeStructurePlan; promise: Promise<KnowledgeStructureReconcileResult> }
  >();

  constructor(config: KnowledgeConfig = {}) {
    super({ component: 'STORAGE', name: config.name ?? config.id ?? 'Knowledge' });
    this.id = config.id ?? randomUUID();
    this.description = config.description;
    this.tools = Object.freeze({ read: config.tools?.read ?? false, write: config.tools?.write ?? false });
    this.#structure = config.structure ? validateKnowledgeStructurePlan(structuredClone(config.structure)) : undefined;
    this.#scopeTypes = validateKnowledgeScopeTypes(structuredClone(config.scopes));
    if (typeof config.importers === 'function') {
      this.#importerResolver = config.importers;
    } else {
      for (const importer of config.importers ?? []) {
        this.#registerImporter(importer, 'config');
      }
    }
    this.hasOwnStorage = config.storage !== undefined;
    if (config.storage) {
      this.#storageSource = getStorageSource(config.storage);
      this.#storage = augmentWithInit(config.storage);
    }
  }

  /** @internal */
  __registerMastra(_mastra: Mastra): void {
    queueMicrotask(() => {
      void (async () => {
        if (this.#structure) await this.reconcile();
        await this.#importerRunner.start();
      })().catch(error => {
        this.logger.warn('Knowledge startup reconciliation failed; durable importer runs remain recoverable', {
          error,
        });
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

  /** @internal */
  setStorage(storage: MastraCompositeStore, source: MastraCompositeStore = storage): void {
    if (this.hasOwnStorage) return;
    this.#storageSource = getStorageSource(source);
    this.#storage = augmentWithInit(storage);
    this.#storagePromise = undefined;
  }

  /**
   * Returns trusted placement context for the held scope addresses and the configured
   * structural scopes reachable from them. @internal
   */
  async __getDescriptionContext(heldAddresses: string[]): Promise<{
    description?: string;
    scopes: Array<{ address: string; name: string; description: string }>;
  }> {
    const visibleAddresses = new Set(heldAddresses);
    const configured = await this.#placementScopes(heldAddresses);
    const structural = new Set(this.#visibleStructureScopes(heldAddresses, configured).map(scope => scope.address));
    return {
      description: this.description?.trim() || undefined,
      scopes: configured.flatMap(configuredScope => {
        const description = configuredScopeDescription(configuredScope);
        if (!description) return [];
        if (!visibleAddresses.has(configuredScope.address) && !structural.has(configuredScope.address)) return [];
        return [{ address: configuredScope.address, name: configuredScope.name, description }];
      }),
    };
  }

  /**
   * Host-configured scopes a writer holding `heldAddresses` could place into: the static structure
   * plan plus the template children of each held address. Template children come from the
   * scope-type config the store materializes them from, so they are host-vouched like the plan.
   * Children are copied on create, so only those that exist in storage are offered.
   */
  async #placementScopes(heldAddresses: string[]): Promise<KnowledgeStructurePlan['scopes']> {
    const configured = this.#structure?.scopes ?? [];
    const known = new Set(configured.map(scope => scope.address));
    const templated: KnowledgeStructurePlan['scopes'] = [];
    for (const address of heldAddresses) {
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
    const existing = await Promise.all(templated.map(child => storage.getScopeAddress(child.address)));
    return [...configured, ...templated.filter((_, index) => existing[index])];
  }

  /**
   * Structural scopes a writer holding `heldAddresses` may place content into: every configured
   * or held-scope template child whose parent chain reaches a held address. Held addresses
   * themselves are excluded. This frontier is host-vouched configuration. @internal
   */
  async __getVisibleStructureScopes(
    heldAddresses: string[],
  ): Promise<Array<{ address: string; name: string; description?: string }>> {
    return this.#visibleStructureScopes(heldAddresses, await this.#placementScopes(heldAddresses));
  }

  #visibleStructureScopes(
    heldAddresses: string[],
    configured: KnowledgeStructurePlan['scopes'],
  ): Array<{ address: string; name: string; description?: string }> {
    const held = new Set(heldAddresses);
    const byAddress = new Map(configured.map(scope => [scope.address, scope]));
    const reachesHeld = (address: string): boolean => {
      const seen = new Set<string>();
      const stack = [address];
      while (stack.length > 0) {
        const current = stack.pop()!;
        if (seen.has(current)) continue;
        seen.add(current);
        if (held.has(current)) return true;
        stack.push(...(byAddress.get(current)?.parentAddresses ?? []));
      }
      return false;
    };
    return configured.flatMap(scope => {
      if (held.has(scope.address) || !reachesHeld(scope.address)) return [];
      const description = configuredScopeDescription(scope);
      return [{ address: scope.address, name: scope.name, ...(description ? { description } : {}) }];
    });
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
    if (!capabilities.supported) {
      throw new KnowledgeUnsupportedError(storage.constructor.name);
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

  /**
   * Materializes the scopes a run holds: every configured scope type its trusted scope addresses
   * fill (see `planKnowledgeRunScopes`), parent-first. Pass only trusted scopes, such as
   * `getRunAgentScopes(requestContext)` plus the run's own Memory resource and thread. A scope that
   * already exists under a different parent is refused, never re-parented.
   */
  async materializeRunScopes(input: {
    scopes: readonly string[];
  }): Promise<Array<KnowledgeRunScopePlan & { scopeId: string }>> {
    const held: Array<KnowledgeRunScopePlan & { scopeId: string }> = [];
    for (const plan of planKnowledgeRunScopes(this.#scopeTypes, input.scopes)) {
      const { pattern: _pattern, parentAddress, ...materialize } = plan;
      const result = await this.materializeScope(materialize);
      const scopeId = result.scopes[plan.address]!;
      if (parentAddress) {
        const parentId = held.find(scope => scope.address === parentAddress)!.scopeId;
        const storage = await this.getStorage();
        if (!(await storage.getNodeScopeIds(scopeId)).includes(parentId)) {
          throw new Error(`Knowledge scope ${plan.address} already exists under a parent other than ${parentAddress}`);
        }
      }
      held.push({ ...plan, scopeId });
    }
    return held;
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
          if (await storage.getScopeAddress(snapshot.address)) {
            return storage.reconcileStructure({ ...plan, scopes: plan.scopes.slice(0, 1) });
          }
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

  registerImporter<TPayload = unknown>(definition: KnowledgeImporterDefinition<TPayload>) {
    return this.#registerImporter(definition, 'manual');
  }

  #registerImporter<TPayload = unknown>(
    definition: KnowledgeImporterDefinition<TPayload>,
    provenance: 'config' | 'resolver' | 'manual',
  ) {
    const handle = this.#importers.register(definition, (binding, payload) =>
      this.runImporter(definition.id, binding, payload, { triggerKind: 'programmatic' }),
    );
    this.#importerProvenance.set(handle.importerId, provenance);
    this.#importerRunner.schedule(handle);
    return handle;
  }

  /**
   * @internal Re-resolves the configured importer resolver and reconciles registrations. Called by
   * the importer runner at the top of each scheduling tick. Resolver failures keep the previously
   * resolved set active. Never throws.
   */
  async reconcileImportersInternal(): Promise<void> {
    if (!this.#importerResolver) return;
    let resolved: readonly KnowledgeImporterDefinition[];
    try {
      resolved = await this.#importerResolver();
      if (!Array.isArray(resolved)) {
        throw new Error('Knowledge importer resolver must return an array of importer definitions');
      }
    } catch (error) {
      this.logger.warn('Knowledge importer resolver failed; keeping previously resolved importers', { error });
      return;
    }
    const resolvedIds = new Set<string>();
    for (const definition of resolved) {
      try {
        const existing = typeof definition?.id === 'string' ? this.#importers.get(definition.id.trim()) : undefined;
        const handle = existing ?? this.#registerImporter(definition, 'resolver');
        resolvedIds.add(handle.importerId);
        // Re-adding an id whose deferred removal already unscheduled its crons must reschedule them.
        this.#importerRunner.schedule(handle);
      } catch (error) {
        this.logger.warn('Knowledge importer resolver produced an invalid importer definition; skipping it', {
          error,
        });
      }
    }
    for (const [id, provenance] of this.#importerProvenance) {
      if (provenance !== 'resolver' || resolvedIds.has(id)) continue;
      this.#importerRunner.unschedule(id);
      // Let in-flight runs finish under their registration; removal retries on a later tick.
      if (this.#importerRunner.hasActiveRuns(id)) continue;
      this.#importers.remove(id);
      this.#importerProvenance.delete(id);
    }
  }

  getImporter(id: string) {
    return this.#importers.get(id);
  }

  listImporters() {
    return this.#importers.list();
  }

  runImporter<TPayload = unknown>(
    importerId: string,
    binding: KnowledgeImporterBindingInput,
    payload?: TPayload,
    options: { triggerKind?: 'programmatic' | 'webhook' | 'cron'; awaitCompletion?: boolean } = {},
  ) {
    const importer = this.#assertImporter(importerId);
    const triggerKind = options.triggerKind ?? 'programmatic';
    if (triggerKind === 'webhook' && !importer.triggers.webhook) {
      throw new Error(`Knowledge importer ${importerId} does not have a webhook trigger`);
    }
    if (triggerKind === 'cron' && !importer.triggers.cron) {
      throw new Error(`Knowledge importer ${importerId} does not have a cron trigger`);
    }
    return this.#importerRunner.enqueue(importer, binding, payload, triggerKind, {
      awaitCompletion: options.awaitCompletion,
    });
  }

  /** @internal */
  async shutdownImporters(): Promise<void> {
    await this.#importerRunner.shutdown();
  }

  async getImportState(input: { importerId: string; binding: string; key: string }) {
    this.#assertImporter(input.importerId);
    return (await this.getStorage()).getImportState(input);
  }

  async setImportState(input: { importerId: string; binding: string; key: string; value: string }) {
    this.#assertImporter(input.importerId);
    return (await this.getStorage()).setImportState(input);
  }

  /**
   * Removes one importer binding's contribution: its claims, the scope memberships only it held and the records
   * only it claimed. Nodes are never deleted, and a record shared with another binding stays with that binding's
   * scopes. Use it to retire or move a binding without resetting the importer.
   */
  async releaseImportBinding(input: { importerId: string; binding: string }): Promise<void> {
    this.#assertImporter(input.importerId);
    await (await this.getStorage()).releaseImportClaims(input);
  }

  async createImportRun(input: CreateKnowledgeImportRunInput) {
    const importer = this.#assertImporter(input.importerId);
    if (input.triggerKind === 'cron' && !importer.triggers.cron) {
      throw new Error(`Knowledge importer ${input.importerId} does not have a cron trigger`);
    }
    if (input.triggerKind === 'webhook' && !importer.triggers.webhook) {
      throw new Error(`Knowledge importer ${input.importerId} does not have a webhook trigger`);
    }
    return (await this.getStorage()).createImportRun(input);
  }

  async getImportRun(id: string) {
    return (await this.getStorage()).getImportRun(id);
  }

  async listImportRuns(input: ListKnowledgeImportRunsInput = {}) {
    if (input.importerId) {
      return (await this.getStorage()).listImportRuns(input);
    }

    const importerIds = this.#importers.list().map(importer => importer.importerId);
    if (importerIds.length === 0) return { runs: [], nextCursor: undefined };
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
    const storage = await this.getStorage();
    const pages = await Promise.all(
      importerIds.map(importerId => storage.listImportRuns({ ...input, importerId, limit })),
    );
    const runs = pages
      .flatMap(page => page.runs)
      .sort((a, b) => b.queuedAt.getTime() - a.queuedAt.getTime() || b.id.localeCompare(a.id));
    const hasMore = runs.length > limit || pages.some(page => page.nextCursor);
    const visibleRuns = runs.slice(0, limit);
    return { runs: visibleRuns, nextCursor: hasMore ? visibleRuns.at(-1)?.id : undefined };
  }

  async updateImportRun(input: Omit<UpdateKnowledgeImportRunInput, 'error'> & { error?: unknown }) {
    const storage = await this.getStorage();
    const run = await storage.getImportRun(input.id);
    if (run) this.#assertImporter(run.importerId);
    const error = input.status === 'failed' ? sanitizeKnowledgeImportError(input.error) : undefined;
    return storage.updateImportRun({ ...input, error });
  }

  #assertImporter(importerId: string) {
    const importer = this.#importers.get(importerId);
    if (!importer) throw new Error(`Knowledge importer ${importerId} is not registered`);
    return importer;
  }

  async #assertImportRun(storage: KnowledgeStorage, importRunId?: string) {
    if (!importRunId) return;
    const run = await storage.getImportRun(importRunId);
    if (!run) throw new Error(`Knowledge import run ${importRunId} does not exist`);
    this.#assertImporter(run.importerId);
    if (run.status !== 'running') throw new Error(`Knowledge import run ${importRunId} is not active`);
  }

  async createNode(input: CreateKnowledgeNodeInput) {
    const storage = await this.getStorage();
    await this.#assertImportRun(storage, input.importRunId);
    return storage.createNode(input);
  }

  async getNode(id: string) {
    return (await this.getStorage()).getNode(id);
  }

  async getNodeByName(input: { name: string; scopeIds: KnowledgeScopeIds }) {
    return (await this.getStorage()).getNodeByName(input);
  }

  async resolveNode(input: { name: string; scopeIds: KnowledgeScopeIds }) {
    return (await this.getStorage()).resolveNode(input);
  }

  async listNodes(input: ListKnowledgeNodesInput) {
    return (await this.getStorage()).listNodes(input);
  }

  async updateNode(input: UpdateKnowledgeNodeInput) {
    const storage = await this.getStorage();
    await this.#assertImportRun(storage, input.importRunId);
    return storage.updateNode(input);
  }

  async mergeNodes(input: { sourceId: string; targetId: string; sourceVersion: number; importRunId?: string }) {
    const storage = await this.getStorage();
    await this.#assertImportRun(storage, input.importRunId);
    return storage.mergeNodes(input);
  }

  async createRecord(input: CreateKnowledgeRecordInput) {
    const storage = await this.getStorage();
    await this.#assertImportRun(storage, input.importRunId);
    await assertKnowledgeRecordScopesVisible(storage, input);
    return storage.createRecord(input);
  }

  async getRecord(input: { id: string; includeDeleted?: boolean }) {
    return (await this.getStorage()).getRecord(input);
  }

  async listRecords(input: QueryKnowledgeRecordsInput) {
    return (await this.getStorage()).listRecords(input);
  }

  async listMentioningRecords(input: QueryKnowledgeRecordsInput) {
    return (await this.getStorage()).listMentioningRecords(input);
  }

  async listRelatedRecords(input: QueryKnowledgeRecordsInput) {
    return (await this.getStorage()).listRelatedRecords(input);
  }

  async listRecordsBySource(input: QueryKnowledgeRecordsBySourceInput): Promise<QueryKnowledgeRecordsOutput> {
    return (await this.getStorage()).listRecordsBySource(input);
  }

  async deleteRecord(input: { id: string; deletedBy: string; importRunId?: string }) {
    const storage = await this.getStorage();
    await this.#assertImportRun(storage, input.importRunId);
    return storage.deleteRecord(input);
  }

  async restoreRecord(input: { id: string; importRunId?: string }) {
    const storage = await this.getStorage();
    await this.#assertImportRun(storage, input.importRunId);
    return storage.restoreRecord(input);
  }

  async setRecordScopes(input: {
    id: string;
    version: number;
    scopeIds: KnowledgeScopeIds;
    importRunId?: string;
    contextScopeId?: string;
  }) {
    const storage = await this.getStorage();
    await this.#assertImportRun(storage, input.importRunId);
    const record = await storage.getRecord({ id: input.id, includeDeleted: true });
    if (record) {
      await assertKnowledgeRecordScopesVisible(storage, {
        node: record.nodeId,
        scopeIds: input.scopeIds,
        ...(record.deletedAt ? {} : { recordId: record.id }),
      });
    }
    return storage.setRecordScopes(input);
  }

  async search(input: SearchKnowledgeInput) {
    return (await this.getStorage()).search(input);
  }

  async listActivity(input: { scopeIds: KnowledgeScopeIds; importRunId?: string; after?: string; limit?: number }) {
    const storage = await this.getStorage();
    if (input.importRunId && !(await storage.getImportRun(input.importRunId))) return [];
    return storage.listActivity(input);
  }

  async listSemanticOutbox(input?: {
    status?: KnowledgeSemanticOutboxEntry['status'];
    scopeIds?: KnowledgeScopeIds;
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
export { materializeKnowledgeScopePlan, memoryScopeTypes, planKnowledgeRunScopes } from './reconcile';
export type { KnowledgeConfig, KnowledgeToolsConfig } from './config';
export type {
  KnowledgeScopeAccessConfig,
  KnowledgeScopeChildTemplate,
  KnowledgeScopeTypeConfig,
  KnowledgeScopeTypesConfig,
  KnowledgeRunScopePlan,
  MaterializeKnowledgeScopeInput,
} from './reconcile';
