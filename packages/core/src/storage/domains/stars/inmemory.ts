import type {
  StorageDeleteStarsForEntityInput,
  StorageIsStarredBatchInput,
  StorageListStarsInput,
  StorageStarEntityType,
  StorageStarKey,
  StorageStarType,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import type { StarToggleResult } from './base';
import { StarsStorage } from './base';

/**
 * Build the composite key used by the in-memory stars Map.
 */
function starKey(userId: string, entityType: StorageStarEntityType, entityId: string): string {
  return `${userId}\u0000${entityType}\u0000${entityId}`;
}

/**
 * In-memory implementation of StarsStorage. Mutates the shared InMemoryDB
 * Maps for stars and the parent entity records (agents, skills) so that the
 * denormalized `starCount` stays in sync.
 *
 * Atomicity is provided by the JavaScript single-threaded event loop: each
 * star/unstar runs to completion within one synchronous block.
 */
export class InMemoryStarsStorage extends StarsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async init(): Promise<void> {
    // No-op for in-memory store.
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.stars.clear();
    // Keep denormalized counters in sync with the cleared stars map.
    for (const agent of this.db.agents.values()) {
      if (agent.starCount) agent.starCount = 0;
    }
    for (const skill of this.db.skills.values()) {
      if (skill.starCount) skill.starCount = 0;
    }
  }

  async star({ userId, entityType, entityId }: StorageStarKey): Promise<StarToggleResult> {
    const entity = this.requireEntity(entityType, entityId);
    const key = starKey(userId, entityType, entityId);

    if (this.db.stars.has(key)) {
      return { starred: true, starCount: entity.starCount ?? 0 };
    }

    const row: StorageStarType = {
      userId,
      entityType,
      entityId,
      createdAt: new Date(),
    };
    this.db.stars.set(key, row);

    const nextCount = (entity.starCount ?? 0) + 1;
    entity.starCount = nextCount;
    entity.updatedAt = new Date();

    return { starred: true, starCount: nextCount };
  }

  async unstar({ userId, entityType, entityId }: StorageStarKey): Promise<StarToggleResult> {
    const entity = this.requireEntity(entityType, entityId);
    const key = starKey(userId, entityType, entityId);

    if (!this.db.stars.has(key)) {
      return { starred: false, starCount: entity.starCount ?? 0 };
    }

    this.db.stars.delete(key);

    const nextCount = Math.max(0, (entity.starCount ?? 0) - 1);
    entity.starCount = nextCount;
    entity.updatedAt = new Date();

    return { starred: false, starCount: nextCount };
  }

  async isStarred({ userId, entityType, entityId }: StorageStarKey): Promise<boolean> {
    return this.db.stars.has(starKey(userId, entityType, entityId));
  }

  async isStarredBatch({ userId, entityType, entityIds }: StorageIsStarredBatchInput): Promise<Set<string>> {
    const result = new Set<string>();
    for (const entityId of entityIds) {
      if (this.db.stars.has(starKey(userId, entityType, entityId))) {
        result.add(entityId);
      }
    }
    return result;
  }

  async listStarredIds({ userId, entityType }: StorageListStarsInput): Promise<string[]> {
    const ids: string[] = [];
    for (const row of this.db.stars.values()) {
      if (row.userId === userId && row.entityType === entityType) {
        ids.push(row.entityId);
      }
    }
    return ids;
  }

  async deleteStarsForEntity({ entityType, entityId }: StorageDeleteStarsForEntityInput): Promise<number> {
    let removed = 0;
    for (const [key, row] of this.db.stars) {
      if (row.entityType === entityType && row.entityId === entityId) {
        this.db.stars.delete(key);
        removed++;
      }
    }
    // Zero the parent's denormalized counter if the record still exists. The
    // cascade caller in the server typically deletes the entity first, in
    // which case this is a no-op — but callers that prune stars for a still
    // existing entity (e.g. admin reset) need consistent counts.
    const map = entityType === 'agent' ? this.db.agents : this.db.skills;
    const entity = map.get(entityId);
    if (entity && entity.starCount) {
      entity.starCount = 0;
    }
    return removed;
  }

  /**
   * Look up the parent entity record for counter maintenance. Throws if the
   * entity does not exist — callers should validate existence (and access)
   * before invoking star/unstar.
   */
  private requireEntity(entityType: StorageStarEntityType, entityId: string): { starCount?: number; updatedAt: Date } {
    const map = entityType === 'agent' ? this.db.agents : this.db.skills;
    const entity = map.get(entityId);
    if (!entity) {
      throw new Error(`Cannot star: ${entityType} with id ${entityId} does not exist`);
    }
    return entity;
  }
}
