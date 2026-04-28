import type { Mastra } from '@mastra/core';
import type { RequestContext } from '@mastra/core/di';
import type { StarsStorage, StorageStarEntityType } from '@mastra/core/storage';

import { getCallerAuthorId } from './authorship';
import { isBuilderFeatureEnabled } from './editor-builder';

/**
 * Result of `prepareStarsEnrichment` — `null` when the stars EE feature is off.
 * When non-null the caller may use `starredIds` to set `isStarred` on records
 * and may pass `userId` along to storage list paths for pin-starred-first
 * sorting (`pinStarredFor`).
 */
export type StarsEnrichmentContext = {
  userId: string;
  starredIds: Set<string>;
  starsStore: StarsStorage;
} | null;

/**
 * Resolve the EE feature flag plus the caller's starred set for a list of
 * candidate entity IDs in one shot. Soft-gated: returns `null` if the feature
 * is off or there's no caller — handlers should drop `isStarred` / `starCount`
 * fields and ignore `?starredOnly=true` in that case.
 */
export async function prepareStarsEnrichment(
  mastra: Mastra,
  requestContext: RequestContext,
  entityType: StorageStarEntityType,
  entityIds: string[],
): Promise<StarsEnrichmentContext> {
  if (!(await isBuilderFeatureEnabled(mastra, 'stars'))) return null;

  const userId = getCallerAuthorId(requestContext);
  if (!userId) return null;

  const storage = mastra.getStorage();
  if (!storage) return null;
  const starsStore = await storage.getStore('stars');
  if (!starsStore) return null;

  const starredIds =
    entityIds.length === 0 ? new Set<string>() : await starsStore.isStarredBatch({ userId, entityType, entityIds });
  return { userId, starredIds, starsStore };
}

/**
 * Strip the stars EE fields from a record. Used when the feature is off so
 * stale values from storage do not leak through the API.
 */
export function stripStarFields<T extends object>(record: T): T {
  if ('isStarred' in record || 'starCount' in record) {
    const copy = { ...record } as Record<string, unknown>;
    delete copy.isStarred;
    delete copy.starCount;
    return copy as T;
  }
  return record;
}
