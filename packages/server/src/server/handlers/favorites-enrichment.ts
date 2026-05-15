import type { Mastra } from '@mastra/core';
import type { RequestContext } from '@mastra/core/di';
import type { FavoritesStorage, StorageFavoriteEntityType } from '@mastra/core/storage';

import { getCallerAuthorId } from './authorship';
import { isBuilderFeatureEnabled } from './editor-builder';

/**
 * Result of `prepareFavoritesEnrichment` — `null` when the `stars` EE feature is off.
 * When non-null the caller may use `starredIds` to set `isFavorited` on records
 * and may pass `userId` along to storage list paths for pin-favorited-first
 * sorting (`pinFavoritedFor`).
 */
export type FavoritesEnrichmentContext = {
  userId: string;
  starredIds: Set<string>;
  favoritesStore: FavoritesStorage;
} | null;

/**
 * Resolve the EE feature flag plus the caller's favorited set for a list of
 * candidate entity IDs in one shot. Soft-gated: returns `null` if the feature
 * is off or there's no caller — handlers should drop `isFavorited` / `favoriteCount`
 * fields and ignore `?favoritedOnly=true` in that case.
 */
export async function prepareFavoritesEnrichment(
  mastra: Mastra,
  requestContext: RequestContext,
  entityType: StorageFavoriteEntityType,
  entityIds: string[],
): Promise<FavoritesEnrichmentContext> {
  if (!(await isBuilderFeatureEnabled(mastra, 'stars'))) return null;

  const userId = getCallerAuthorId(requestContext);
  if (!userId) return null;

  const storage = mastra.getStorage();
  if (!storage) return null;
  const favoritesStore = await storage.getStore('favorites');
  if (!favoritesStore) return null;

  const starredIds =
    entityIds.length === 0
      ? new Set<string>()
      : await favoritesStore.isFavoritedBatch({ userId, entityType, entityIds });
  return { userId, starredIds, favoritesStore };
}

/**
 * Strip the favorites EE fields from a record. Used when the feature is off so
 * stale values from storage do not leak through the API.
 */
export function stripFavoriteFields<T extends object>(record: T): T {
  if ('isFavorited' in record || 'favoriteCount' in record) {
    const copy = { ...record } as Record<string, unknown>;
    delete copy.isFavorited;
    delete copy.favoriteCount;
    return copy as T;
  }
  return record;
}
