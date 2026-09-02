import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { MastraBase } from '../base';
import type { Mastra } from '../mastra';
import type { MastraCompositeStore } from '../storage';
import {
  parseKnowledgeImporterBindingKey,
  parseKnowledgeWikilinks,
  sanitizeKnowledgeImportError,
  KnowledgeNotFoundError,
  KnowledgeUnsupportedError,
} from '../storage/domains/knowledge';
import type {
  CreateKnowledgeRecordInput,
  ClaimKnowledgeSemanticOutboxInput,
  CreateKnowledgeNodeInput,
  CreateKnowledgeImportRunInput,
  KnowledgeImportRunStatus,
  KnowledgeProposalStatus,
  KnowledgeActivityAction,
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
import { KnowledgeAccessEvaluator } from './access/cache';
import { assertKnowledgeScopeCapabilities, assertKnowledgeTargetCapability } from './access/mutations';
import { getKnowledgeReadableScopeIds, isKnowledgeReadVisible } from './access/read-filter';
import type { KnowledgeAccessFrontier } from './access/types';
import type { KnowledgeConfig } from './config';
import { KnowledgeCurator } from './curation/curator';
import type { CreateKnowledgeCuratorInput } from './curation/types';
export * from './curation/curator';
export * from './curation/types';
import {
  KnowledgeProposalLifecycle,
  type ProposeKnowledgeNodeUpdateInput,
  type ReviewKnowledgeProposalDecisionInput,
} from './governance/proposals';
import {
  KnowledgeScopeGovernance,
  type CreateKnowledgeRootScopeInput,
  type CreateKnowledgeScopeInput,
  type DeleteGovernedKnowledgeNodeInput,
  type RestoreGovernedKnowledgeNodeInput,
  type RestoreKnowledgeRootScopeInput,
  type RevokeKnowledgeScopeAccessInput,
  type ShareKnowledgeScopeInput,
} from './governance/scopes';
import {
  KnowledgeImporterRegistry,
  type KnowledgeImporterBindingInput,
  type KnowledgeImporterDefinition,
} from './imports';
import { KnowledgeImporterRunner } from './imports/runner';
export * from './governance/proposals';
export * from './governance/scopes';

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
  #curatorInstructions?: string;
  #importers = new KnowledgeImporterRegistry();
  #importerRunner = new KnowledgeImporterRunner(this);
  #accessEvaluator?: KnowledgeAccessEvaluator;
  #proposalLifecycle?: KnowledgeProposalLifecycle;
  #scopeGovernance?: KnowledgeScopeGovernance;
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
    this.#curatorInstructions = config.curation?.instructions?.trim() || undefined;
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
        if (this.#importers.list().length > 0) await this.#importerRunner.start();
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
    this.#accessEvaluator = undefined;
    this.#proposalLifecycle = undefined;
    this.#scopeGovernance = undefined;
  }

  async #getStorage(): Promise<KnowledgeStorage> {
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

  /** @internal */
  async getStorageInternal(): Promise<KnowledgeStorage> {
    return this.#getStorage();
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

  createCurator(input: CreateKnowledgeCuratorInput): KnowledgeCurator {
    return new KnowledgeCurator(this, structuredClone(input), this.#curatorInstructions);
  }

  async evaluateAccess(vouchedScopeIds: readonly string[]): Promise<KnowledgeAccessFrontier> {
    const storage = await this.#getStorage();
    const liveScopeIds: string[] = [];
    for (const scopeId of vouchedScopeIds) {
      const scope = await storage.getNode(scopeId);
      if (scope?.isScope) liveScopeIds.push(scopeId);
    }
    this.#accessEvaluator ??= new KnowledgeAccessEvaluator({ instance: this, storage });
    return this.#accessEvaluator.evaluate(liveScopeIds);
  }

  async proposeNodeUpdate(input: ProposeKnowledgeNodeUpdateInput) {
    return (await this.#getProposalLifecycle()).proposeNodeUpdate(input);
  }

  async listProposals(input: {
    vouchedScopeIds: KnowledgeScopeIds;
    status?: KnowledgeProposalStatus;
    limit?: number;
    cursor?: string;
  }) {
    return (await this.#getProposalLifecycle()).list(input);
  }

  async getProposal(input: { id: string; vouchedScopeIds: KnowledgeScopeIds }) {
    return (await this.#getProposalLifecycle()).get(input);
  }

  async approveProposal(input: ReviewKnowledgeProposalDecisionInput) {
    return (await this.#getProposalLifecycle()).approve(input);
  }

  async rejectProposal(input: ReviewKnowledgeProposalDecisionInput) {
    return (await this.#getProposalLifecycle()).reject(input);
  }

  async reReviewProposal(input: ReviewKnowledgeProposalDecisionInput) {
    return (await this.#getProposalLifecycle()).reReview(input);
  }

  async #getProposalLifecycle(): Promise<KnowledgeProposalLifecycle> {
    const storage = await this.#getStorage();
    this.#proposalLifecycle ??= new KnowledgeProposalLifecycle(
      storage,
      scopeIds => this.evaluateAccess(scopeIds),
      input => this.getNode(input),
      input => this.getRecord(input),
      input => this.#resolveVisibleScopeNode(input),
    );
    return this.#proposalLifecycle;
  }

  async #resolveVisibleScopeNode(input: { id: string; scopeIds: KnowledgeScopeIds }) {
    const frontier = await this.evaluateAccess(input.scopeIds);
    if (!frontier.scopes[input.id]?.read) return null;
    const node = await (await this.#getStorage()).getNode(input.id);
    return node?.isScope && !node.deletedAt ? node : null;
  }

  async createScope(input: CreateKnowledgeScopeInput) {
    return (await this.#getScopeGovernance()).create(input);
  }

  async createRootScope(input: CreateKnowledgeRootScopeInput) {
    return (await this.#getScopeGovernance()).createRoot(input);
  }

  async shareScope(input: ShareKnowledgeScopeInput) {
    return (await this.#getScopeGovernance()).share(input);
  }

  async revokeScopeAccess(input: RevokeKnowledgeScopeAccessInput) {
    return (await this.#getScopeGovernance()).revoke(input);
  }

  async deleteNode(input: DeleteGovernedKnowledgeNodeInput) {
    return (await this.#getScopeGovernance()).delete(input);
  }

  async restoreNode(input: RestoreGovernedKnowledgeNodeInput) {
    return (await this.#getScopeGovernance()).restore(input);
  }

  async restoreRootScope(input: RestoreKnowledgeRootScopeInput) {
    return (await this.#getScopeGovernance()).restoreRoot(input);
  }

  async #getScopeGovernance(): Promise<KnowledgeScopeGovernance> {
    const storage = await this.#getStorage();
    this.#scopeGovernance ??= new KnowledgeScopeGovernance(storage, this.#scopeTypes, scopeIds =>
      this.evaluateAccess(scopeIds),
    );
    return this.#scopeGovernance;
  }

  async #resolveReadScopeIds(vouchedScopeIds: KnowledgeScopeIds): Promise<KnowledgeScopeIds> {
    return getKnowledgeReadableScopeIds(await this.evaluateAccess(vouchedScopeIds));
  }

  async #authorizeNodeMutation(input: {
    storage: KnowledgeStorage;
    frontier: KnowledgeAccessFrontier;
    nodeId: string;
    capability: 'append' | 'edit' | 'delete' | 'manageAccess';
  }) {
    const node = await input.storage.getNode(input.nodeId);
    if (!node) throw new KnowledgeNotFoundError('node', input.nodeId);
    const scopeIds = await input.storage.getNodeScopeIds(node.id);
    assertKnowledgeTargetCapability({
      frontier: input.frontier,
      scopeIds,
      capability: input.capability,
      targetType: 'node',
      targetId: node.id,
    });
    return { node, scopeIds };
  }

  async #authorizeRecordMutation(input: {
    storage: KnowledgeStorage;
    frontier: KnowledgeAccessFrontier;
    recordId: string;
    nodeId: string;
    capability: 'edit' | 'delete' | 'manageAccess';
  }) {
    const [nodeScopeIds, recordScopeIds] = await Promise.all([
      input.storage.getNodeScopeIds(input.nodeId),
      input.storage.getRecordScopeIds(input.recordId),
    ]);
    assertKnowledgeTargetCapability({
      frontier: input.frontier,
      scopeIds: nodeScopeIds,
      capability: input.capability,
      targetType: 'record',
      targetId: input.recordId,
    });
    assertKnowledgeScopeCapabilities({
      frontier: input.frontier,
      scopeIds: recordScopeIds,
      capability: input.capability,
      targetType: 'scope',
    });
  }

  async #authorizeMentionTargets(input: {
    storage: KnowledgeStorage;
    frontier: KnowledgeAccessFrontier;
    text: string;
    resolutionScopeIds: KnowledgeScopeIds;
  }) {
    for (const name of parseKnowledgeWikilinks(input.text)) {
      const target = await input.storage.resolveNode({ name, scopeIds: input.resolutionScopeIds });
      if (!target) continue;
      assertKnowledgeTargetCapability({
        frontier: input.frontier,
        scopeIds: await input.storage.getNodeScopeIds(target.id),
        capability: 'read',
        targetType: 'node',
        targetId: target.id,
      });
    }
  }

  async reconcile(): Promise<KnowledgeStructureReconcileResult> {
    if (!this.#structure) {
      const accessEpoch = await (await this.#getStorage()).getAccessEpoch();
      return { scopes: {}, createdScopeIds: [], changed: false, accessEpoch };
    }
    if (!this.#reconcilePromise) {
      const promise = this.#getStorage()
        .then(storage => storage.reconcileStructure(this.#structure!))
        .finally(() => {
          if (this.#reconcilePromise === promise) this.#reconcilePromise = undefined;
        });
      this.#reconcilePromise = promise;
    }
    return this.#reconcilePromise;
  }

  /** @internal Host-only lazy scope materialization. Agent-created scopes must use createScope(). */
  async materializeScope(input: MaterializeKnowledgeScopeInput): Promise<KnowledgeStructureReconcileResult> {
    const snapshot = structuredClone(input);
    const plan = materializeKnowledgeScopePlan(this.#scopeTypes, snapshot);
    const existing = this.#materializePromises.get(snapshot.address);
    if (existing) {
      if (!isDeepStrictEqual(existing.plan, plan)) {
        throw new Error(`Conflicting materialization is already in progress for Knowledge scope ${snapshot.address}`);
      }
      return existing.promise;
    }

    const promise = this.#getStorage()
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

  async getImportState(input: { importerId: string; binding: string; key: string; scopeIds: KnowledgeScopeIds }) {
    this.#assertImporter(input.importerId);
    const storage = await this.#getStorage();
    const readableScopeIds = await this.#resolveReadScopeIds(input.scopeIds);
    if (!(await this.#isImportBindingVisible(storage, input.binding, readableScopeIds))) return null;
    return storage.getImportState(input);
  }

  /** @internal */
  async getImportStateInternal(input: { importerId: string; binding: string; key: string }) {
    this.#assertImporter(input.importerId);
    return (await this.#getStorage()).getImportState(input);
  }

  /** @internal */
  async setImportStateInternal(input: { importerId: string; binding: string; key: string; value: string }) {
    this.#assertImporter(input.importerId);
    return (await this.#getStorage()).setImportState(input);
  }

  /** @internal */
  async createImportRunInternal(input: CreateKnowledgeImportRunInput) {
    const importer = this.#assertImporter(input.importerId);
    if (input.triggerKind === 'cron' && !importer.triggers.cron) {
      throw new Error(`Knowledge importer ${input.importerId} does not have a cron trigger`);
    }
    if (input.triggerKind === 'webhook' && !importer.triggers.webhook) {
      throw new Error(`Knowledge importer ${input.importerId} does not have a webhook trigger`);
    }
    return (await this.#getStorage()).createImportRun(input);
  }

  async getImportRun(input: { id: string; scopeIds: KnowledgeScopeIds }) {
    const storage = await this.#getStorage();
    const readableScopeIds = await this.#resolveReadScopeIds(input.scopeIds);
    const run = await storage.getImportRun(input.id);
    if (!run || !this.#importers.get(run.importerId)) return null;
    return (await this.#isImportBindingVisible(storage, run.binding, readableScopeIds)) ? run : null;
  }

  /** @internal */
  async getImportRunInternal(id: string) {
    const run = await (await this.#getStorage()).getImportRun(id);
    if (run) this.#assertImporter(run.importerId);
    return run;
  }

  async listImportRuns(input: ListKnowledgeImportRunsInput & { scopeIds: KnowledgeScopeIds }) {
    if (input.importerId) this.#assertImporter(input.importerId);
    const importerIds = input.importerId
      ? [input.importerId]
      : this.#importers.list().map(importer => importer.importerId);
    if (importerIds.length === 0) return { runs: [], nextCursor: undefined };

    const storage = await this.#getStorage();
    const readableScopeIds = await this.#resolveReadScopeIds(input.scopeIds);
    const { scopeIds: _vouchedScopeIds, ...query } = input;
    return storage.listImportRuns({
      ...query,
      importerIds,
      scopeIds: readableScopeIds,
      limit: Math.min(Math.max(input.limit ?? 100, 1), 100),
    });
  }

  /** @internal */
  async listImportRunsInternal(input: ListKnowledgeImportRunsInput = {}) {
    if (input.importerId) this.#assertImporter(input.importerId);
    const importerIds = input.importerId ? undefined : this.#importers.list().map(importer => importer.importerId);
    if (importerIds?.length === 0) return { runs: [], nextCursor: undefined };
    return (await this.#getStorage()).listImportRuns({ ...input, importerIds });
  }

  /** @internal */
  async updateImportRunInternal(input: Omit<UpdateKnowledgeImportRunInput, 'error'> & { error?: unknown }) {
    const storage = await this.#getStorage();
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

  async #isImportBindingVisible(storage: KnowledgeStorage, binding: string, readableScopeIds: KnowledgeScopeIds) {
    const { scope } = parseKnowledgeImporterBindingKey(binding);
    const address = await storage.getScopeAddress(scope);
    return Boolean(address && readableScopeIds.includes(address.scopeNodeId));
  }

  async #assertImportRun(storage: KnowledgeStorage, importRunId?: string) {
    if (!importRunId) return;
    const run = await storage.getImportRun(importRunId);
    if (!run) throw new Error(`Knowledge import run ${importRunId} does not exist`);
    this.#assertImporter(run.importerId);
    if (run.status !== 'running') throw new Error(`Knowledge import run ${importRunId} is not active`);
  }

  async createNode(input: CreateKnowledgeNodeInput & { vouchedScopeIds: KnowledgeScopeIds }) {
    const storage = await this.#getStorage();
    const { vouchedScopeIds, ...mutation } = input;
    await this.#assertImportRun(storage, mutation.importRunId);
    const frontier = await this.evaluateAccess(vouchedScopeIds);
    if (mutation.scopeIds.length === 0) throw new KnowledgeNotFoundError('scope', 'root');
    assertKnowledgeScopeCapabilities({
      frontier,
      scopeIds: mutation.scopeIds,
      capability: mutation.isScope ? 'createChildren' : 'append',
      targetType: 'scope',
    });
    return storage.createNode({ ...mutation, expectedAccessEpoch: frontier.accessEpoch });
  }

  async getNode(input: { id: string; scopeIds: KnowledgeScopeIds; membershipScopeIds?: KnowledgeScopeIds }) {
    const storage = await this.#getStorage();
    const scopeIds = await this.#resolveReadScopeIds(input.scopeIds);
    const node = await storage.getNode(input.id);
    if (!node || node.deletedAt) return null;
    const nodeScopeIds = await storage.getNodeScopeIds(node.id);
    if (!isKnowledgeReadVisible(nodeScopeIds, scopeIds)) return null;
    if (input.membershipScopeIds && !input.membershipScopeIds.some(scopeId => nodeScopeIds.includes(scopeId)))
      return null;
    return node;
  }

  /** @internal */
  async getNodeInternal(id: string) {
    return (await this.#getStorage()).getNode(id);
  }

  async getNodeByName(input: { name: string; scopeIds: KnowledgeScopeIds }) {
    const scopeIds = await this.#resolveReadScopeIds(input.scopeIds);
    return (await this.#getStorage()).resolveNode({ name: input.name, scopeIds });
  }

  async resolveNode(input: { name: string; scopeIds: KnowledgeScopeIds }) {
    const scopeIds = await this.#resolveReadScopeIds(input.scopeIds);
    return (await this.#getStorage()).resolveNode({ ...input, scopeIds });
  }

  async listNodes(input: ListKnowledgeNodesInput) {
    const scopeIds = await this.#resolveReadScopeIds(input.scopeIds);
    return (await this.#getStorage()).listNodes({ ...input, scopeIds });
  }

  async updateNode(input: UpdateKnowledgeNodeInput & { vouchedScopeIds: KnowledgeScopeIds }) {
    const storage = await this.#getStorage();
    const { vouchedScopeIds, ...mutation } = input;
    await this.#assertImportRun(storage, mutation.importRunId);
    const frontier = await this.evaluateAccess(vouchedScopeIds);
    const { node, scopeIds } = await this.#authorizeNodeMutation({
      storage,
      frontier,
      nodeId: mutation.id,
      capability: 'edit',
    });
    if (mutation.scopeIds) {
      if (mutation.scopeIds.length === 0) throw new KnowledgeNotFoundError('scope', 'root');
      assertKnowledgeScopeCapabilities({ frontier, scopeIds, capability: 'manageAccess', targetType: 'scope' });
      assertKnowledgeScopeCapabilities({
        frontier,
        scopeIds: mutation.scopeIds,
        capability: 'manageAccess',
        targetType: 'scope',
      });
    }
    if (mutation.isScope !== undefined && mutation.isScope !== node.isScope) {
      assertKnowledgeScopeCapabilities({
        frontier,
        scopeIds,
        capability: 'manageAccess',
        targetType: 'scope',
      });
    }
    return storage.updateNode({ ...mutation, expectedAccessEpoch: frontier.accessEpoch });
  }

  async mergeNodes(input: {
    sourceId: string;
    targetId: string;
    sourceVersion: number;
    importRunId?: string;
    vouchedScopeIds: KnowledgeScopeIds;
  }) {
    const storage = await this.#getStorage();
    const { vouchedScopeIds, ...mutation } = input;
    await this.#assertImportRun(storage, mutation.importRunId);
    const frontier = await this.evaluateAccess(vouchedScopeIds);
    await this.#authorizeNodeMutation({ storage, frontier, nodeId: mutation.sourceId, capability: 'manageAccess' });
    await this.#authorizeNodeMutation({ storage, frontier, nodeId: mutation.targetId, capability: 'edit' });
    return storage.mergeNodes({ ...mutation, expectedAccessEpoch: frontier.accessEpoch });
  }

  async createRecord(input: CreateKnowledgeRecordInput & { vouchedScopeIds: KnowledgeScopeIds }) {
    const storage = await this.#getStorage();
    const { vouchedScopeIds, ...mutation } = input;
    await this.#assertImportRun(storage, mutation.importRunId);
    const frontier = await this.evaluateAccess(vouchedScopeIds);
    if (mutation.scopeIds.length === 0) throw new KnowledgeNotFoundError('scope', 'root');
    const nodeId = typeof mutation.node === 'string' ? mutation.node : mutation.node.id;
    await this.#authorizeNodeMutation({ storage, frontier, nodeId, capability: 'append' });
    assertKnowledgeScopeCapabilities({
      frontier,
      scopeIds: mutation.scopeIds,
      capability: 'append',
      targetType: 'scope',
    });
    await this.#authorizeMentionTargets({
      storage,
      frontier,
      text: mutation.text,
      resolutionScopeIds: mutation.resolutionScopeIds ?? mutation.scopeIds,
    });
    return storage.createRecord({ ...mutation, expectedAccessEpoch: frontier.accessEpoch });
  }

  async getRecord(input: { id: string; scopeIds: KnowledgeScopeIds; includeDeleted?: boolean }) {
    const scopeIds = await this.#resolveReadScopeIds(input.scopeIds);
    return (await this.#getStorage()).getVisibleRecord({ ...input, scopeIds });
  }

  /** @internal */
  async getRecordInternal(input: { id: string; includeDeleted?: boolean }) {
    return (await this.#getStorage()).getRecord(input);
  }

  async listRecords(input: QueryKnowledgeRecordsInput) {
    const scopeIds = await this.#resolveReadScopeIds(input.scopeIds);
    return (await this.#getStorage()).listRecords({ ...input, scopeIds });
  }

  async listMentioningRecords(input: QueryKnowledgeRecordsInput) {
    const scopeIds = await this.#resolveReadScopeIds(input.scopeIds);
    return (await this.#getStorage()).listMentioningRecords({ ...input, scopeIds });
  }

  async listRelatedRecords(input: QueryKnowledgeRecordsInput) {
    const scopeIds = await this.#resolveReadScopeIds(input.scopeIds);
    return (await this.#getStorage()).listRelatedRecords({ ...input, scopeIds });
  }

  async listRecordsBySource(input: QueryKnowledgeRecordsBySourceInput) {
    const scopeIds = await this.#resolveReadScopeIds(input.scopeIds);
    return (await this.#getStorage()).listRecordsBySource({ ...input, scopeIds });
  }

  async deleteRecord(input: {
    id: string;
    version: number;
    deletedBy: string;
    importRunId?: string;
    vouchedScopeIds: KnowledgeScopeIds;
  }) {
    const storage = await this.#getStorage();
    const { vouchedScopeIds, ...mutation } = input;
    await this.#assertImportRun(storage, mutation.importRunId);
    const frontier = await this.evaluateAccess(vouchedScopeIds);
    const record = await storage.getVisibleRecord({
      id: mutation.id,
      scopeIds: Object.keys(frontier.scopes),
      includeDeleted: true,
    });
    if (!record) throw new KnowledgeNotFoundError('record', mutation.id);
    await this.#authorizeRecordMutation({
      storage,
      frontier,
      recordId: record.id,
      nodeId: record.nodeId,
      capability: 'manageAccess',
    });
    return storage.deleteRecord({ ...mutation, expectedAccessEpoch: frontier.accessEpoch });
  }

  async restoreRecord(input: {
    id: string;
    version: number;
    importRunId?: string;
    vouchedScopeIds: KnowledgeScopeIds;
  }) {
    const storage = await this.#getStorage();
    const { vouchedScopeIds, ...mutation } = input;
    await this.#assertImportRun(storage, mutation.importRunId);
    const frontier = await this.evaluateAccess(vouchedScopeIds);
    const record = await storage.getVisibleRecord({
      id: mutation.id,
      scopeIds: Object.keys(frontier.scopes),
      includeDeleted: true,
    });
    if (!record) throw new KnowledgeNotFoundError('record', mutation.id);
    await this.#authorizeRecordMutation({
      storage,
      frontier,
      recordId: record.id,
      nodeId: record.nodeId,
      capability: 'manageAccess',
    });
    return storage.restoreRecord({ ...mutation, expectedAccessEpoch: frontier.accessEpoch });
  }

  async setRecordScopes(input: {
    id: string;
    version: number;
    scopeIds: KnowledgeScopeIds;
    importRunId?: string;
    contextScopeId?: string;
    vouchedScopeIds: KnowledgeScopeIds;
  }) {
    const storage = await this.#getStorage();
    const { vouchedScopeIds, ...mutation } = input;
    await this.#assertImportRun(storage, mutation.importRunId);
    const frontier = await this.evaluateAccess(vouchedScopeIds);
    if (mutation.scopeIds.length === 0) throw new KnowledgeNotFoundError('scope', 'root');
    const record = await storage.getVisibleRecord({
      id: mutation.id,
      scopeIds: Object.keys(frontier.scopes),
      includeDeleted: true,
    });
    if (!record) throw new KnowledgeNotFoundError('record', mutation.id);
    await this.#authorizeRecordMutation({
      storage,
      frontier,
      recordId: record.id,
      nodeId: record.nodeId,
      capability: 'edit',
    });
    const currentScopeIds = await storage.getRecordScopeIds(record.id);
    const currentScopeIdSet = new Set(currentScopeIds);
    const addedScopeIds = mutation.scopeIds.filter(scopeId => !currentScopeIdSet.has(scopeId));
    assertKnowledgeScopeCapabilities({ frontier, scopeIds: addedScopeIds, capability: 'append', targetType: 'scope' });
    return storage.setRecordScopes({ ...mutation, expectedAccessEpoch: frontier.accessEpoch });
  }

  async search(input: SearchKnowledgeInput) {
    const scopeIds = await this.#resolveReadScopeIds(input.scopeIds);
    return (await this.#getStorage()).search({ ...input, scopeIds });
  }

  /** @internal */
  async getCurationCursorInternal(input: { sourceThreadId: string; agent: string }) {
    return (await this.#getStorage()).getCurationCursor(input);
  }

  /** @internal */
  async advanceCurationCursorInternal(input: { sourceThreadId: string; agent: string; lastKnowledgeId: string }) {
    return (await this.#getStorage()).advanceCurationCursor(input);
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
  }) {
    const storage = await this.#getStorage();
    const scopeIds = await this.#resolveReadScopeIds(input.scopeIds);
    const membershipScopeIds = input.membershipScopeIds
      ? input.membershipScopeIds.filter(scopeId => scopeIds.includes(scopeId))
      : undefined;
    if (input.membershipScopeIds && membershipScopeIds?.length === 0) return [];
    if (input.importRunId) {
      const run = await storage.getImportRun(input.importRunId);
      if (!run || !this.#importers.get(run.importerId)) return [];
      if (!(await this.#isImportBindingVisible(storage, run.binding, scopeIds))) return [];
    }
    return storage.listActivity({ ...input, scopeIds, membershipScopeIds });
  }

  async listSemanticOutbox(input: {
    status?: KnowledgeSemanticOutboxEntry['status'];
    scopeIds: KnowledgeScopeIds;
    limit?: number;
  }) {
    const scopeIds = await this.#resolveReadScopeIds(input.scopeIds);
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
    return (await this.#getStorage()).listSemanticOutbox({ ...input, scopeIds, limit });
  }

  async claimSemanticOutbox(input: ClaimKnowledgeSemanticOutboxInput & { scopeIds: KnowledgeScopeIds }) {
    const scopeIds = await this.#resolveReadScopeIds(input.scopeIds);
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
    return (await this.#getStorage()).claimSemanticOutbox({ ...input, scopeIds, limit });
  }

  async claimSemanticOutboxInternal(input: ClaimKnowledgeSemanticOutboxInput) {
    return (await this.#getStorage()).claimSemanticOutbox(input);
  }

  async completeSemanticOutbox(input: { ids: string[]; workerId: string }) {
    return (await this.#getStorage()).completeSemanticOutbox(input);
  }

  async releaseSemanticOutbox(input: { ids: string[]; workerId: string; retryAt?: Date }) {
    return (await this.#getStorage()).releaseSemanticOutbox(input);
  }
}

export * from '../storage/domains/knowledge';
export * from './access/cache';
export * from './access/evaluator';
export * from './access/grants';
export * from './access/mutations';
export * from './access/read-filter';
export type * from './access/types';
export * from './imports';
export type { KnowledgeConfig } from './config';
export type {
  KnowledgeScopeAccessConfig,
  KnowledgeScopeTypeConfig,
  KnowledgeScopeTypesConfig,
  MaterializeKnowledgeScopeInput,
} from './reconcile';
