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
      create: input => store.createPromptBlock({ promptBlock: input }),
      getByIdResolved: id => store.getPromptBlockByIdResolved({ id }),
      update: input => store.updatePromptBlock(input),
      delete: id => store.deletePromptBlock({ id }),
      list: args => store.listPromptBlocks(args),
      listResolved: args => store.listPromptBlocksResolved(args),
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
