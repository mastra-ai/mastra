import type { FactoryProject, FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { Card, WorkItemsStorage } from '../storage/domains/work-items/base.js';

interface BoardScope {
  orgId: string;
  factoryProjectId: string;
}

/** What a background sweep reads: the projects, and each project's cards. */
export interface CardSource {
  projects(): Promise<readonly FactoryProject[]>;
  /** Shared between readers: do not mutate. */
  cards(scope: BoardScope): Promise<readonly Card[]>;
}

/** Reads storage on every call: what a sweep uses when no {@link KeptCards} is wired. */
export function storageCards(options: {
  projects: Pick<FactoryProjectsStorage, 'listAll'>;
  workItems: Pick<WorkItemsStorage, 'listShared'>;
}): CardSource {
  return {
    projects: () => options.projects.listAll(),
    cards: scope => options.workItems.listShared(scope),
  };
}

function scopeKey(scope: BoardScope): string {
  return `${scope.orgId}\u0000${scope.factoryProjectId}`;
}

/**
 * Keeps the cards sweeps look at in memory, so a sweep that finds nothing to
 * change at a provider reads nothing from storage. A board is read again only
 * after a change to it was announced through {@link changed}. There is no timed
 * re-read, since that would wake the database; an announcement lost between
 * replicas stays unseen until that board changes again or the process restarts.
 *
 * The kept cards decide what a sweep looks at, not what it writes: a sweep
 * about to write a card reads that card first.
 */
export class KeptCards implements CardSource {
  readonly #storage: CardSource;

  #trusted = false;
  #projects: readonly FactoryProject[] | undefined;
  #known = new Set<string>();
  /** Bumped by every change, since a change can mean a project was created or deleted. */
  #projectChanges = 0;
  #projectsLoading: Promise<readonly FactoryProject[]> | undefined;
  readonly #cards = new Map<string, readonly Card[]>();
  readonly #boardChanges = new Map<string, number>();
  readonly #cardsLoading = new Map<string, Promise<readonly Card[]>>();

  constructor(options: {
    projects: Pick<FactoryProjectsStorage, 'listAll'>;
    workItems: Pick<WorkItemsStorage, 'listShared'>;
  }) {
    this.#storage = storageCards(options);
  }

  /**
   * Call once every replica's board changes reach {@link changed}. Until then
   * nothing is kept and every read goes to storage.
   */
  trustAnnouncements(): void {
    this.#trusted = true;
  }

  /**
   * A committed write changed this project's board, or deleted the project, on
   * this replica or another. The project list is read again too: one query,
   * only after activity, and it is how a new or deleted project shows up.
   */
  changed(scope: BoardScope): void {
    const key = scopeKey(scope);
    this.#cards.delete(key);
    this.#boardChanges.set(key, (this.#boardChanges.get(key) ?? 0) + 1);
    this.#projects = undefined;
    this.#projectChanges += 1;
  }

  projects(): Promise<readonly FactoryProject[]> {
    if (this.#projects) return Promise.resolve(this.#projects);
    // Sweeps of several integrations start together; they share one read.
    this.#projectsLoading ??= this.#readProjects().finally(() => {
      this.#projectsLoading = undefined;
    });
    return this.#projectsLoading;
  }

  async cards(scope: BoardScope): Promise<readonly Card[]> {
    // Only a listed project's cards are kept; the list is usually kept too.
    await this.projects();
    const key = scopeKey(scope);
    const kept = this.#cards.get(key);
    if (kept) return kept;
    let loading = this.#cardsLoading.get(key);
    if (!loading) {
      loading = this.#readCards(scope, key).finally(() => this.#cardsLoading.delete(key));
      this.#cardsLoading.set(key, loading);
    }
    return loading;
  }

  async #readProjects(): Promise<readonly FactoryProject[]> {
    const changes = this.#projectChanges;
    const projects = await this.#storage.projects();
    // A project announced during the read may be missing from it, so that read
    // is used for this pass only.
    if (this.#trusted && changes === this.#projectChanges) {
      this.#projects = projects;
      this.#known = new Set(projects.map(project => scopeKey({ orgId: project.orgId, factoryProjectId: project.id })));
      for (const key of this.#cards.keys()) if (!this.#known.has(key)) this.#cards.delete(key);
      for (const key of this.#boardChanges.keys()) if (!this.#known.has(key)) this.#boardChanges.delete(key);
    }
    return projects;
  }

  async #readCards(scope: BoardScope, key: string): Promise<readonly Card[]> {
    const changes = this.#boardChanges.get(key) ?? 0;
    const cards = await this.#storage.cards(scope);
    // Kept only for a listed project, so a deleted project's cards are not.
    if (this.#trusted && this.#known.has(key) && changes === (this.#boardChanges.get(key) ?? 0)) {
      this.#cards.set(key, cards);
    }
    return cards;
  }
}
