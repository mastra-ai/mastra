import { MastraBase } from '../../../base';
import type {
  StorageDeleteStarsForEntityInput,
  StorageIsStarredBatchInput,
  StorageListStarsInput,
  StorageStarEntityType,
  StorageStarKey,
} from '../../types';

/**
 * Result of a star/unstar operation. `starred` reflects the new state for the
 * caller; `starCount` reflects the entity's denormalized counter after the
 * operation.
 */
export interface StarToggleResult {
  starred: boolean;
  starCount: number;
}

/**
 * Abstract base class for stars storage.
 *
 * The stars domain is responsible for:
 *   - persisting `(userId, entityType, entityId)` star rows,
 *   - maintaining the denormalized `starCount` on the parent entity record,
 *   - answering batched lookups for list-response annotation.
 *
 * EE feature gating is the server-handler concern, not the storage domain.
 */
export abstract class StarsStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'STARS',
    });
  }

  /**
   * Initialize the stars store (create tables, indexes, etc).
   */
  abstract init(): Promise<void>;

  /**
   * Star an entity for a user. Idempotent — re-starring an already-starred
   * entity is a no-op and returns the current state.
   *
   * Implementations must atomically insert the star row and increment the
   * entity's `starCount`. If the entity does not exist, throw.
   */
  abstract star(input: StorageStarKey): Promise<StarToggleResult>;

  /**
   * Unstar an entity for a user. Idempotent — unstarring a non-starred
   * entity is a no-op and returns the current state.
   *
   * Implementations must atomically delete the star row and decrement the
   * entity's `starCount` (clamped at 0). If the entity does not exist,
   * throw.
   */
  abstract unstar(input: StorageStarKey): Promise<StarToggleResult>;

  /**
   * Check whether a single entity is starred by the given user.
   */
  abstract isStarred(input: StorageStarKey): Promise<boolean>;

  /**
   * Look up which entity IDs in a candidate set are starred by the given user.
   * Used to annotate list responses.
   *
   * Returns a Set of starred entity IDs. Order does not matter.
   */
  abstract isStarredBatch(input: StorageIsStarredBatchInput): Promise<Set<string>>;

  /**
   * List all entity IDs of the given type starred by the user.
   * Used internally by the `?starredOnly=true` query handler to pre-filter
   * the candidate set for the existing list path.
   */
  abstract listStarredIds(input: StorageListStarsInput): Promise<string[]>;

  /**
   * Remove all star rows referencing the given entity. Called by hard-delete
   * handlers. Decrements no counters (the entity is being removed).
   *
   * Returns the number of star rows removed.
   */
  abstract deleteStarsForEntity(input: StorageDeleteStarsForEntityInput): Promise<number>;

  /**
   * Delete all stars. Used for testing.
   */
  abstract dangerouslyClearAll(): Promise<void>;
}

export type { StorageStarEntityType };
