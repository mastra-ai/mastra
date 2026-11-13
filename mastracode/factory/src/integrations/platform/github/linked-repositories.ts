import type { ExternalRepositoryProjectTarget } from '../../../storage/domains/source-control/base.js';

export interface LinkedGithubRepositorySource {
  listConfiguredExternalKeys(): Promise<Array<{ installationExternalId: string; repositoryExternalId: string }>>;
  listByExternalRepository(args: {
    installationExternalId: string;
    repositoryExternalId: string;
  }): Promise<ExternalRepositoryProjectTarget[]>;
  /** Subscribes to link changes; returns the unsubscribe. */
  onLinkedRepositoriesChanged?(listener: () => void): () => void;
  /** False while link changes made on other replicas can't reach this one. */
  linkedRepositoryChangesShared?(): boolean;
}

/** One installation through which a Factory project links a repository. */
export interface LinkedGithubRepository {
  installationId: number;
  orgIds: string[];
}

const DEFAULT_UNSHARED_TTL_MS = 30_000;

/**
 * The repositories Factory projects link, by GitHub repository id. Topics
 * carry every repository an installation sees; only linked ones are Factory's.
 * Read once and again after a link change, or every `unsharedTtlMs` while
 * changes on other replicas can't reach this one.
 */
export class LinkedGithubRepositories {
  readonly #source: () => LinkedGithubRepositorySource;
  readonly #unsharedTtlMs: number;
  readonly #now: () => number;
  #index: Promise<Map<number, LinkedGithubRepository[]>> | undefined;
  #loadedAt = 0;
  #unsubscribe: (() => void) | undefined;

  constructor(
    source: () => LinkedGithubRepositorySource,
    options: { unsharedTtlMs?: number; now?: () => number } = {},
  ) {
    this.#source = source;
    this.#unsharedTtlMs = options.unsharedTtlMs ?? DEFAULT_UNSHARED_TTL_MS;
    this.#now = options.now ?? Date.now;
  }

  async forRepository(repositoryId: number): Promise<LinkedGithubRepository[]> {
    return (await this.#load()).get(repositoryId) ?? [];
  }

  invalidate(): void {
    this.#index = undefined;
  }

  close(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
  }

  #load(): Promise<Map<number, LinkedGithubRepository[]>> {
    const source = this.#source();
    if (!this.#unsubscribe && source.onLinkedRepositoriesChanged) {
      this.#unsubscribe = source.onLinkedRepositoriesChanged(() => this.invalidate());
    }
    const shared = Boolean(this.#unsubscribe) && (source.linkedRepositoryChangesShared?.() ?? true);
    if (this.#index && (shared || this.#now() - this.#loadedAt < this.#unsharedTtlMs)) return this.#index;
    this.#loadedAt = this.#now();
    const loading = this.#read(source);
    this.#index = loading;
    loading.catch(() => {
      if (this.#index === loading) this.#index = undefined;
    });
    return loading;
  }

  async #read(source: LinkedGithubRepositorySource): Promise<Map<number, LinkedGithubRepository[]>> {
    const index = new Map<number, LinkedGithubRepository[]>();
    for (const key of await source.listConfiguredExternalKeys()) {
      const repositoryId = Number(key.repositoryExternalId);
      const installationId = Number(key.installationExternalId);
      if (!Number.isSafeInteger(repositoryId) || !Number.isSafeInteger(installationId)) continue;
      const projects = await source.listByExternalRepository(key);
      const orgIds = [...new Set(projects.map(project => project.orgId))];
      if (orgIds.length === 0) continue;
      index.set(repositoryId, [...(index.get(repositoryId) ?? []), { installationId, orgIds }]);
    }
    return index;
  }
}
