import { randomUUID } from 'node:crypto';
import { MastraBase } from '../base';
import type { Mastra } from '../mastra';
import type { MastraCompositeStore } from '../storage';
import { sanitizeKnowledgeImportError, KnowledgeUnsupportedError } from '../storage/domains/knowledge';
import type {
  CreateKnowledgeRecordInput,
  ClaimKnowledgeSemanticOutboxInput,
  CreateKnowledgeNodeInput,
  CreateKnowledgeImportRunInput,
  KnowledgeImportRunStatus,
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
  SearchKnowledgeInput,
  UpdateKnowledgeNodeInput,
} from '../storage/domains/knowledge';
import { augmentWithInit, getStorageSource } from '../storage/storageWithInit';
import type { KnowledgeConfig } from './config';
import {
  KnowledgeImporterRegistry,
  type KnowledgeImporterBindingInput,
  type KnowledgeImporterDefinition,
} from './imports';
import { KnowledgeImporterRunner } from './imports/runner';
import {
  materializeKnowledgeScopePlan,
  validateKnowledgeScopeTypes,
  validateKnowledgeStructurePlan,
  type KnowledgeScopeTypesConfig,
  type MaterializeKnowledgeScopeInput,
} from './reconcile';

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
  #importerRunner = new KnowledgeImporterRunner(this);
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
      const accessEpoch = await (await this.getStorage()).getAccessEpoch();
      return { scopes: {}, createdScopeIds: [], changed: false, accessEpoch };
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
      .then(storage => storage.reconcileStructure(plan))
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
    const handle = this.#importers.register(definition, (binding, payload) =>
      this.runImporter(definition.id, binding, payload, { triggerKind: 'programmatic' }),
    );
    this.#importerRunner.schedule(handle);
    return handle;
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
    options: { triggerKind?: 'programmatic' | 'webhook' | 'cron' } = {},
  ) {
    const importer = this.#assertImporter(importerId);
    const triggerKind = options.triggerKind ?? 'programmatic';
    if (triggerKind === 'webhook' && !importer.triggers.webhook) {
      throw new Error(`Knowledge importer ${importerId} does not have a webhook trigger`);
    }
    if (triggerKind === 'cron' && !importer.triggers.cron) {
      throw new Error(`Knowledge importer ${importerId} does not have a cron trigger`);
    }
    return this.#importerRunner.enqueue(importer, binding, payload, triggerKind);
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
    const run = await (await this.getStorage()).getImportRun(id);
    if (run) this.#assertImporter(run.importerId);
    return run;
  }

  async listImportRuns(input: ListKnowledgeImportRunsInput = {}) {
    if (input.importerId) {
      this.#assertImporter(input.importerId);
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

  async listRecordsBySource(input: QueryKnowledgeRecordsBySourceInput) {
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
    scopeIds: KnowledgeScopeIds;
    importRunId?: string;
    contextScopeId?: string;
  }) {
    const storage = await this.getStorage();
    await this.#assertImportRun(storage, input.importRunId);
    return storage.setRecordScopes(input);
  }

  async search(input: SearchKnowledgeInput) {
    return (await this.getStorage()).search(input);
  }

  async getCurationCursor(input: { sourceThreadId: string; agent: string }) {
    return (await this.getStorage()).getCurationCursor(input);
  }

  async advanceCurationCursor(input: { sourceThreadId: string; agent: string; lastKnowledgeId: string }) {
    return (await this.getStorage()).advanceCurationCursor(input);
  }

  async listActivity(input: { scopeIds: KnowledgeScopeIds; importRunId?: string; after?: string; limit?: number }) {
    const storage = await this.getStorage();
    if (input.importRunId) {
      const run = await storage.getImportRun(input.importRunId);
      if (!run) return [];
      this.#assertImporter(run.importerId);
    }
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
export * from './access/grants';
export type * from './access/types';
export * from './imports';
export type { KnowledgeConfig } from './config';
export type {
  KnowledgeScopeAccessConfig,
  KnowledgeScopeTypeConfig,
  KnowledgeScopeTypesConfig,
  MaterializeKnowledgeScopeInput,
} from './reconcile';
