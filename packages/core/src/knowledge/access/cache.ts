import type { KnowledgeStorage } from '../../storage/domains/knowledge';
import { canonicalizeKnowledgeScopeIds, knowledgeScopeIdsKey } from '../../storage/domains/knowledge';
import { evaluateKnowledgeAccessFrontier } from './evaluator';
import type { KnowledgeAccessFrontier } from './types';

interface KnowledgeAccessCacheEntry {
  key: string;
  accessEpoch: number;
  frontier: KnowledgeAccessFrontier;
}

export class KnowledgeAccessFrontierCache {
  readonly #maxEntries: number;
  readonly #entries = new Map<object, Map<string, KnowledgeAccessCacheEntry>>();
  readonly #lru = new Map<KnowledgeAccessCacheEntry, object>();

  constructor({ maxEntries = 256 }: { maxEntries?: number } = {}) {
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) {
      throw new Error('Knowledge access frontier cache maxEntries must be a positive safe integer');
    }
    this.#maxEntries = maxEntries;
  }

  get(instance: object, vouchedScopeIds: readonly string[], accessEpoch: number): KnowledgeAccessFrontier | undefined {
    const entry = this.#entries.get(instance)?.get(this.#key(vouchedScopeIds, accessEpoch));
    if (!entry) return undefined;
    this.#lru.delete(entry);
    this.#lru.set(entry, instance);
    return entry.frontier;
  }

  set(instance: object, frontier: KnowledgeAccessFrontier): void {
    const entries = this.#entries.get(instance) ?? new Map<string, KnowledgeAccessCacheEntry>();
    this.#entries.set(instance, entries);
    for (const [key, entry] of entries) {
      if (entry.accessEpoch === frontier.accessEpoch) continue;
      entries.delete(key);
      this.#lru.delete(entry);
    }

    const key = this.#key(frontier.vouchedScopeIds, frontier.accessEpoch);
    const previous = entries.get(key);
    if (previous) this.#lru.delete(previous);
    const entry = { key, accessEpoch: frontier.accessEpoch, frontier };
    entries.set(key, entry);
    this.#lru.set(entry, instance);

    while (this.#lru.size > this.#maxEntries) {
      const oldest = this.#lru.entries().next().value;
      if (!oldest) break;
      const [oldestEntry, oldestInstance] = oldest;
      this.#lru.delete(oldestEntry);
      const oldestEntries = this.#entries.get(oldestInstance);
      oldestEntries?.delete(oldestEntry.key);
      if (oldestEntries?.size === 0) this.#entries.delete(oldestInstance);
    }
  }

  clear(instance?: object): void {
    if (!instance) {
      this.#entries.clear();
      this.#lru.clear();
      return;
    }
    const entries = this.#entries.get(instance);
    if (!entries) return;
    for (const entry of entries.values()) this.#lru.delete(entry);
    this.#entries.delete(instance);
  }

  #key(vouchedScopeIds: readonly string[], accessEpoch: number): string {
    return JSON.stringify([accessEpoch, knowledgeScopeIdsKey([...vouchedScopeIds])]);
  }
}

export class KnowledgeAccessEvaluator {
  readonly #instance: object;
  readonly #storage: KnowledgeStorage;
  readonly #cache: KnowledgeAccessFrontierCache;

  constructor(input: { instance: object; storage: KnowledgeStorage; cache?: KnowledgeAccessFrontierCache }) {
    this.#instance = input.instance;
    this.#storage = input.storage;
    this.#cache = input.cache ?? new KnowledgeAccessFrontierCache();
  }

  async evaluate(vouchedScopeIds: readonly string[]): Promise<KnowledgeAccessFrontier> {
    const normalizedScopeIds = canonicalizeKnowledgeScopeIds([...vouchedScopeIds]);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const accessEpoch = await this.#storage.getAccessEpoch();
      const cached = this.#cache.get(this.#instance, normalizedScopeIds, accessEpoch);
      if (cached) {
        if ((await this.#storage.getAccessEpoch()) === accessEpoch) return cached;
        continue;
      }

      const grants = await this.#storage.listScopeGrants();
      const frontier = evaluateKnowledgeAccessFrontier({
        vouchedScopeIds: normalizedScopeIds,
        grants,
        accessEpoch,
      });
      if ((await this.#storage.getAccessEpoch()) !== accessEpoch) continue;
      this.#cache.set(this.#instance, frontier);
      return frontier;
    }
    throw new Error('Knowledge access grants changed repeatedly while evaluating the request frontier');
  }
}
