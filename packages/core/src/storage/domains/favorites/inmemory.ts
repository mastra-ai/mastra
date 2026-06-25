import type {
  StorageDeleteFavoritesForEntityInput,
  StorageIsFavoritedBatchInput,
  StorageListFavoritesInput,
  StorageFavoriteEntityType,
  StorageFavoriteKey,
  StorageFavoriteType,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import type { FavoriteToggleResult } from './base';
import { FavoritesStorage } from './base';

/**
 * Build the composite key used by the in-memory favorites Map.
 */
function favoriteKey(userId: string, entityType: StorageFavoriteEntityType, entityId: string): string {
  return `${userId}\u0000${entityType}\u0000${entityId}`;
}

/**
 * In-memory implementation of FavoritesStorage. Mutates the shared InMemoryDB
 * Maps for favorites and the parent entity records (agents, skills) so that the
 * denormalized `favoriteCount` stays in sync.
 *
 * Atomicity is provided by the JavaScript single-threaded event loop: each
 * favorite/unfavorite runs to completion within one synchronous block.
 */
export class InMemoryFavoritesStorage extends FavoritesStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async init(): Promise<void> {
    // No-op for in-memory store.
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.favorites.clear();
    // Keep denormalized counters in sync with the cleared favorites map.
    for (const agent of this.db.agents.values()) {
      if (agent.favoriteCount) agent.favoriteCount = 0;
    }
    for (const skill of this.db.skills.values()) {
      if (skill.favoriteCount) skill.favoriteCount = 0;
    }
  }

  async favorite({ userId, entityType, entityId }: StorageFavoriteKey): Promise<FavoriteToggleResult> {
    const entity = this.requireEntity(entityType, entityId);
    const key = favoriteKey(userId, entityType, entityId);

    if (this.db.favorites.has(key)) {
      return { favorited: true, favoriteCount: entity.favoriteCount ?? 0 };
    }

    const row: StorageFavoriteType = {
      userId,
      entityType,
      entityId,
      createdAt: new Date(),
    };
    this.db.favorites.set(key, row);

    const nextCount = (entity.favoriteCount ?? 0) + 1;
    entity.favoriteCount = nextCount;
    entity.updatedAt = new Date();

    return { favorited: true, favoriteCount: nextCount };
  }

  async unfavorite({ userId, entityType, entityId }: StorageFavoriteKey): Promise<FavoriteToggleResult> {
    const entity = this.requireEntity(entityType, entityId);
    const key = favoriteKey(userId, entityType, entityId);

    if (!this.db.favorites.has(key)) {
      return { favorited: false, favoriteCount: entity.favoriteCount ?? 0 };
    }

    this.db.favorites.delete(key);

    const nextCount = Math.max(0, (entity.favoriteCount ?? 0) - 1);
    entity.favoriteCount = nextCount;
    entity.updatedAt = new Date();

    return { favorited: false, favoriteCount: nextCount };
  }

  async isFavorited({ userId, entityType, entityId }: StorageFavoriteKey): Promise<boolean> {
    return this.db.favorites.has(favoriteKey(userId, entityType, entityId));
  }

  async isFavoritedBatch({ userId, entityType, entityIds }: StorageIsFavoritedBatchInput): Promise<Set<string>> {
    const result = new Set<string>();
    for (const entityId of entityIds) {
      if (this.db.favorites.has(favoriteKey(userId, entityType, entityId))) {
        result.add(entityId);
      }
    }
    return result;
  }

  async listFavoritedIds({ userId, entityType }: StorageListFavoritesInput): Promise<string[]> {
    const ids: string[] = [];
    for (const row of this.db.favorites.values()) {
      if (row.userId === userId && row.entityType === entityType) {
        ids.push(row.entityId);
      }
    }
    return ids;
  }

  async deleteFavoritesForEntity({ entityType, entityId }: StorageDeleteFavoritesForEntityInput): Promise<number> {
    let removed = 0;
    for (const [key, row] of this.db.favorites) {
      if (row.entityType === entityType && row.entityId === entityId) {
        this.db.favorites.delete(key);
        removed++;
      }
    }
    // Zero the parent's denormalized counter if the record still exists. The
    // cascade caller in the server typically deletes the entity first, in
    // which case this is a no-op — but callers that prune favorites for a still
    // existing entity (e.g. admin reset) need consistent counts.
    const map = entityType === 'agent' ? this.db.agents : this.db.skills;
    const entity = map.get(entityId);
    if (entity && entity.favoriteCount) {
      entity.favoriteCount = 0;
    }
    return removed;
  }

  /**
   * Look up the parent entity record for counter maintenance. Throws if the
   * entity does not exist — callers should validate existence (and access)
   * before invoking favorite/unfavorite.
   */
  private requireEntity(
    entityType: StorageFavoriteEntityType,
    entityId: string,
  ): { favoriteCount?: number; updatedAt: Date } {
    const map = entityType === 'agent' ? this.db.agents : this.db.skills;
    const entity = map.get(entityId);
    if (!entity) {
      throw new Error(`Cannot favorite: ${entityType} with id ${entityId} does not exist`);
    }
    return entity;
  }
}
