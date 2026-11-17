export interface ProjectListScope {
  orgId: string;
  factoryProjectId: string;
}

const MAX_AGE_MS = 60_000;
const MAX_KEPT = 100;

function scopeKey(scope: ProjectListScope): string {
  return `${scope.orgId}\u0000${scope.factoryProjectId}`;
}

interface Load<T> {
  rows: Promise<readonly T[]>;
  announced: boolean;
}

export class AnnouncedLists<T> {
  #trusted = false;
  #listener: ((scope: ProjectListScope) => void) | undefined;
  readonly #kept = new Map<string, { rows: readonly T[]; loadedAt: number }>();
  readonly #loading = new Map<string, Load<T>>();

  onAnnounced(listener: (scope: ProjectListScope) => void): () => void {
    this.#listener = listener;
    return () => {
      if (this.#listener === listener) this.#listener = undefined;
    };
  }

  trustAnnouncements(): void {
    this.#trusted = true;
  }

  distrustAnnouncements(): void {
    this.#trusted = false;
    for (const key of this.#kept.keys()) this.#forget(key);
    for (const key of this.#loading.keys()) this.#forget(key);
  }

  announce(scope: ProjectListScope): void {
    this.changed(scope);
    this.#listener?.(scope);
  }

  changed(scope: ProjectListScope): void {
    this.#forget(scopeKey(scope));
  }

  read(scope: ProjectListScope, load: () => Promise<readonly T[]>): Promise<readonly T[]> {
    if (!this.#trusted) return load().then(rows => Object.freeze(rows));
    const key = scopeKey(scope);
    const kept = this.#kept.get(key);
    if (kept && Date.now() - kept.loadedAt < MAX_AGE_MS) return Promise.resolve(kept.rows);
    const loading = this.#loading.get(key);
    if (loading) return loading.rows;
    const loadedAt = Date.now();
    const entry: Load<T> = {
      announced: false,
      rows: load().then(rows => {
        const frozen = Object.freeze(rows);
        if (!entry.announced) this.#keep(key, { rows: frozen, loadedAt });
        return frozen;
      }),
    };
    this.#loading.set(key, entry);
    const settled = () => {
      if (this.#loading.get(key) === entry) this.#loading.delete(key);
    };
    entry.rows.then(settled, settled);
    return entry.rows;
  }

  #keep(key: string, kept: { rows: readonly T[]; loadedAt: number }): void {
    this.#kept.delete(key);
    this.#kept.set(key, kept);
    if (this.#kept.size > MAX_KEPT) {
      const oldest = this.#kept.keys().next();
      if (!oldest.done) this.#kept.delete(oldest.value);
    }
  }

  #forget(key: string): void {
    this.#kept.delete(key);
    const loading = this.#loading.get(key);
    if (loading) {
      loading.announced = true;
      this.#loading.delete(key);
    }
  }
}
