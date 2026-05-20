import { MastraBase } from '../../../base';
import type {
  StorageDeleteFavoritesForEntityInput,
  StorageIsFavoritedBatchInput,
  StorageListFavoritesInput,
  StorageFavoriteEntityType,
  StorageFavoriteKey,
} from '../../types';

/**
 * Result of a favorite/unfavorite operation. `favorited` reflects the new state
 * for the caller; `favoriteCount` reflects the entity's denormalized counter
 * after the operation.
 */
export interface FavoriteToggleResult {
  favorited: boolean;
  favoriteCount: number;
}

/**
 * Abstract base class for favorites storage.
 *
 * The favorites domain is responsible for:
 *   - persisting `(userId, entityType, entityId)` favorite rows,
 *   - maintaining the denormalized `favoriteCount` on the parent entity record,
 *   - answering batched lookups for list-response annotation.
 *
 * EE feature gating is the server-handler concern, not the storage domain.
 */
export abstract class FavoritesStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'FAVORITES',
    });
  }

  /**
   * Initialize the favorites store (create tables, indexes, etc).
   */
  abstract init(): Promise<void>;

  /**
   * Favorite an entity for a user. Idempotent — re-favoriting an already-favorited
   * entity is a no-op and returns the current state.
   *
   * Implementations must atomically insert the favorite row and increment the
   * entity's `favoriteCount`. If the entity does not exist, throw.
   */
  abstract favorite(input: StorageFavoriteKey): Promise<FavoriteToggleResult>;

  /**
   * Unfavorite an entity for a user. Idempotent — unfavoriting a non-favorited
   * entity is a no-op and returns the current state.
   *
   * Implementations must atomically delete the favorite row and decrement the
   * entity's `favoriteCount` (clamped at 0). If the entity does not exist,
   * throw.
   */
  abstract unfavorite(input: StorageFavoriteKey): Promise<FavoriteToggleResult>;

  /**
   * Check whether a single entity is favorited by the given user.
   */
  abstract isFavorited(input: StorageFavoriteKey): Promise<boolean>;

  /**
   * Look up which entity IDs in a candidate set are favorited by the given user.
   * Used to annotate list responses.
   *
   * Returns a Set of favorited entity IDs. Order does not matter.
   */
  abstract isFavoritedBatch(input: StorageIsFavoritedBatchInput): Promise<Set<string>>;

  /**
   * List all entity IDs of the given type favorited by the user.
   * Used internally by the `?favoritedOnly=true` query handler to pre-filter
   * the candidate set for the existing list path.
   */
  abstract listFavoritedIds(input: StorageListFavoritesInput): Promise<string[]>;

  /**
   * Remove all favorite rows referencing the given entity. Called by
   * hard-delete handlers. Decrements no counters (the entity is being
   * removed).
   *
   * Returns the number of favorite rows removed.
   */
  abstract deleteFavoritesForEntity(input: StorageDeleteFavoritesForEntityInput): Promise<number>;

  /**
   * Delete all favorites. Used for testing.
   */
  abstract dangerouslyClearAll(): Promise<void>;
}

export type { StorageFavoriteEntityType };
