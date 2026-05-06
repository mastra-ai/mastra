import type {
  StorageCreateSkillInput,
  StorageUpdateSkillInput,
  StorageListSkillsInput,
  StorageListSkillsOutput,
  StorageResolvedSkillType,
  StorageListSkillsResolvedOutput,
} from '@mastra/core/storage';
import type { SkillSource } from '@mastra/core/workspace';
import { publishSkillFromSource } from '@mastra/core/workspace';

import { CrudEditorNamespace } from './base';
import type { StorageAdapter } from './base';

export class EditorSkillNamespace extends CrudEditorNamespace<
  StorageCreateSkillInput,
  StorageUpdateSkillInput,
  StorageListSkillsInput,
  StorageListSkillsOutput,
  StorageListSkillsResolvedOutput,
  StorageResolvedSkillType
> {
  protected override onCacheEvict(_id: string): void {
    // Skills are standalone entities — no runtime cleanup needed.
  }

  protected async getStorageAdapter(): Promise<
    StorageAdapter<
      StorageCreateSkillInput,
      StorageUpdateSkillInput,
      StorageListSkillsInput,
      StorageListSkillsOutput,
      StorageListSkillsResolvedOutput,
      StorageResolvedSkillType
    >
  > {
    const storage = this.mastra?.getStorage();
    if (!storage) throw new Error('Storage is not configured');
    const store = await storage.getStore('skills');
    if (!store) throw new Error('Skills storage domain is not available');

    return {
      create: input => store.create({ skill: input }),
      getByIdResolved: id => store.getByIdResolved(id),
      update: input => store.update(input),
      delete: id => store.delete(id),
      list: args => store.list(args),
      listResolved: args => store.listResolved(args),
    };
  }

  /**
   * Publish a skill from a live filesystem source.
   * Walks the skill directory, hashes files into the blob store,
   * creates a new version with the tree manifest, and sets activeVersionId.
   */
  async publish(skillId: string, source: SkillSource, skillPath: string): Promise<StorageResolvedSkillType> {
    this.ensureRegistered();

    const storage = this.mastra?.getStorage();
    if (!storage) throw new Error('Storage is not configured');

    const skillStore = await storage.getStore('skills');
    if (!skillStore) throw new Error('Skills storage domain is not available');

    const blobStore = await this.editor.resolveBlobStore();
    if (!blobStore)
      throw new Error('No blob store is configured. Register one via new MastraEditor({ blobStores: [...] })');

    // Collect and store blobs
    const { snapshot, tree } = await publishSkillFromSource(source, skillPath, blobStore);

    // Update the skill with new version data + tree (creates a new version)
    await skillStore.update({
      id: skillId,
      ...snapshot,
      tree,
      status: 'published',
    });

    // Point activeVersionId to the newly created version
    const latestVersion = await skillStore.getLatestVersion(skillId);
    if (!latestVersion) {
      throw new Error(`Failed to retrieve version after publishing skill "${skillId}"`);
    }
    await skillStore.update({
      id: skillId,
      activeVersionId: latestVersion.id,
    });

    // Fetch and return the resolved skill
    const resolved = await skillStore.getByIdResolved(skillId);
    if (!resolved) throw new Error(`Failed to resolve skill ${skillId} after publish`);

    // Clear skill cache
    this.clearCache(skillId);

    // Invalidate any cached agents that reference this skill so they
    // re-hydrate with the updated version on next access.
    this.editor.agent.invalidateAgentsReferencingSkill(skillId);

    return resolved;
  }
}
