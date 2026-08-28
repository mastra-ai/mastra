import { randomUUID } from 'node:crypto';
import { MastraBase } from '../base';
import type { Mastra } from '../mastra';
import type { MastraCompositeStore } from '../storage';
import type {
  AppendKnowledgeInput,
  ClaimKnowledgeSemanticOutboxInput,
  CreateKnowledgeNodeInput,
  KnowledgeScope,
  KnowledgeScopeLevel,
  KnowledgeSemanticOutboxEntry,
  KnowledgeStorage,
  ListKnowledgeNodesInput,
  QueryKnowledgeBySourceInput,
  QueryKnowledgeInput,
  SearchKnowledgeInput,
  UpdateKnowledgeNodeInput,
} from '../storage/domains/knowledge';
import { augmentWithInit, getStorageSource } from '../storage/storageWithInit';

export interface KnowledgeConfig {
  id?: string;
  name?: string;
  storage?: MastraCompositeStore;
}

/** @experimental Knowledge APIs are experimental and may change without notice. */
export class Knowledge extends MastraBase {
  readonly id: string;
  readonly hasOwnStorage: boolean;

  #storage?: MastraCompositeStore;
  #storageSource?: MastraCompositeStore;
  #storagePromise?: Promise<KnowledgeStorage>;

  constructor(config: KnowledgeConfig = {}) {
    super({ component: 'STORAGE', name: config.name ?? config.id ?? 'Knowledge' });
    this.id = config.id ?? randomUUID();
    this.hasOwnStorage = config.storage !== undefined;
    if (config.storage) {
      this.#storageSource = getStorageSource(config.storage);
      this.#storage = augmentWithInit(config.storage);
    }
  }

  /** @internal */
  __registerMastra(_mastra: Mastra): void {}

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
    if (!capabilities.supportsV2) {
      throw new Error(
        `The configured Knowledge storage adapter supports schema version ${capabilities.schemaVersion}, but Knowledge requires schema version 2.`,
      );
    }

    return storage;
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

  async raiseKnowledgeCeiling(input: { id: string; maxScope?: KnowledgeScopeLevel }) {
    return (await this.getStorage()).raiseKnowledgeCeiling(input);
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
