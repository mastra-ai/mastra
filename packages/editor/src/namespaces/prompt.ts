import type {
  AgentInstructionBlock,
  StorageCreatePromptBlockInput,
  StorageUpdatePromptBlockInput,
  StorageListPromptBlocksInput,
  StorageListPromptBlocksOutput,
  StorageResolvedPromptBlockType,
  StorageListPromptBlocksResolvedOutput,
} from '@mastra/core/storage';

import { resolveInstructionBlocks } from '../instruction-builder';
import { CrudEditorNamespace } from './base';
import type { StorageAdapter } from './base';

export class EditorPromptNamespace extends CrudEditorNamespace<
  StorageCreatePromptBlockInput,
  StorageUpdatePromptBlockInput,
  StorageListPromptBlocksInput,
  StorageListPromptBlocksOutput,
  StorageListPromptBlocksResolvedOutput,
  StorageResolvedPromptBlockType
> {
  protected override onCacheEvict(id: string): void {
    this.mastra?.removePromptBlock(id);
  }

  protected async getStorageAdapter(): Promise<
    StorageAdapter<
      StorageCreatePromptBlockInput,
      StorageUpdatePromptBlockInput,
      StorageListPromptBlocksInput,
      StorageListPromptBlocksOutput,
      StorageListPromptBlocksResolvedOutput,
      StorageResolvedPromptBlockType
    >
  > {
    const storage = this.mastra!.getStorage();
    if (!storage) throw new Error('Storage is not configured');
    const store = await storage.getStore('promptBlocks');
    if (!store) throw new Error('Prompt blocks storage domain is not available');

    return {
      create: input => store.create({ promptBlock: input }),
      getByIdResolved: id => store.getByIdResolved(id),
      update: input => store.update(input),
      delete: id => store.delete(id),
      list: args => store.list(args),
      listResolved: args => store.listResolved(args),
    };
  }

  async preview(blocks: AgentInstructionBlock[], context: Record<string, unknown>): Promise<string> {
    this.ensureRegistered();
    const storage = this.mastra!.getStorage();
    if (!storage) throw new Error('Storage is not configured');
    const store = await storage.getStore('promptBlocks');
    if (!store) throw new Error('Prompt blocks storage domain is not available');
    return resolveInstructionBlocks(blocks, context, { promptBlocksStorage: store });
  }
}
