import type {
  EditorIsFavoritedBatchInput,
  EditorListFavoritedIdsInput,
  EditorFavoriteTargetInput,
  EditorFavoriteToggleResult,
  IEditorFavoritesNamespace,
} from '@mastra/core/editor';

import { EditorNamespace } from './base';

/**
 * Favorites namespace.
 *
 * Verifies the target entity exists and performs the storage mutation.
 * Visibility / ownership enforcement (`assertReadAccess`) lives at the
 * route handler in `@mastra/server`. Direct callers of this namespace must
 * perform their own access check before invoking these methods.
 */
export class EditorFavoritesNamespace extends EditorNamespace implements IEditorFavoritesNamespace {
  async favorite(input: EditorFavoriteTargetInput): Promise<EditorFavoriteToggleResult> {
    this.ensureRegistered();
    const store = await this.getFavoritesStore();
    return store.favorite({
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  }

  async unfavorite(input: EditorFavoriteTargetInput): Promise<EditorFavoriteToggleResult> {
    this.ensureRegistered();
    const store = await this.getFavoritesStore();
    return store.unfavorite({
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  }

  async isFavorited(input: EditorFavoriteTargetInput): Promise<boolean> {
    this.ensureRegistered();
    const store = await this.getFavoritesStore();
    return store.isFavorited({
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  }

  async isFavoritedBatch(input: EditorIsFavoritedBatchInput): Promise<Set<string>> {
    this.ensureRegistered();
    if (input.entityIds.length === 0) return new Set<string>();
    const store = await this.getFavoritesStore();
    return store.isFavoritedBatch({
      userId: input.userId,
      entityType: input.entityType,
      entityIds: input.entityIds,
    });
  }

  async listFavoritedIds(input: EditorListFavoritedIdsInput): Promise<string[]> {
    this.ensureRegistered();
    const store = await this.getFavoritesStore();
    return store.listFavoritedIds({ userId: input.userId, entityType: input.entityType });
  }

  private async getFavoritesStore() {
    const storage = this.mastra?.getStorage();
    if (!storage) throw new Error('Storage is not configured');
    const store = await storage.getStore('favorites');
    if (!store) throw new Error('Favorites storage domain is not available');
    return store;
  }
}
