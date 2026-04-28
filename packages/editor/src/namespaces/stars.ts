import type {
  EditorIsStarredBatchInput,
  EditorListStarredIdsInput,
  EditorStarTargetInput,
  EditorStarToggleResult,
  IEditorStarsNamespace,
} from '@mastra/core/editor';

import { EditorNamespace } from './base';

/**
 * Stars (favorites) namespace.
 *
 * Verifies the target entity exists and performs the storage mutation.
 * Visibility / ownership enforcement (`assertReadAccess`) lives at the
 * route handler in `@mastra/server`. Direct callers of this namespace must
 * perform their own access check before invoking these methods.
 */
export class EditorStarsNamespace extends EditorNamespace implements IEditorStarsNamespace {
  async star(input: EditorStarTargetInput): Promise<EditorStarToggleResult> {
    this.ensureRegistered();
    const store = await this.getStarsStore();
    return store.star({
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  }

  async unstar(input: EditorStarTargetInput): Promise<EditorStarToggleResult> {
    this.ensureRegistered();
    const store = await this.getStarsStore();
    return store.unstar({
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  }

  async isStarred(input: EditorStarTargetInput): Promise<boolean> {
    this.ensureRegistered();
    const store = await this.getStarsStore();
    return store.isStarred({
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  }

  async isStarredBatch(input: EditorIsStarredBatchInput): Promise<Set<string>> {
    this.ensureRegistered();
    if (input.entityIds.length === 0) return new Set<string>();
    const store = await this.getStarsStore();
    return store.isStarredBatch({
      userId: input.userId,
      entityType: input.entityType,
      entityIds: input.entityIds,
    });
  }

  async listStarredIds(input: EditorListStarredIdsInput): Promise<string[]> {
    this.ensureRegistered();
    const store = await this.getStarsStore();
    return store.listStarredIds({ userId: input.userId, entityType: input.entityType });
  }

  private async getStarsStore() {
    const storage = this.mastra?.getStorage();
    if (!storage) throw new Error('Storage is not configured');
    const store = await storage.getStore('stars');
    if (!store) throw new Error('Stars storage domain is not available');
    return store;
  }
}
