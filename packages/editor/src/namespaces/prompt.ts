import type {
  AgentInstructionBlock,
  StorageCreatePromptBlockInput,
  StorageUpdatePromptBlockInput,
  StorageListPromptBlocksInput,
  StorageListPromptBlocksOutput,
  StorageResolvedPromptBlockType,
  StorageListPromptBlocksResolvedOutput,
} from '@mastra/core/storage';

import type { MastraEditor } from '../index';

export class EditorPromptNamespace {
  constructor(private editor: MastraEditor) {}

  create(input: StorageCreatePromptBlockInput): Promise<StorageResolvedPromptBlockType> {
    return this.editor.createPromptBlock(input);
  }

  getById(id: string): Promise<StorageResolvedPromptBlockType | null> {
    return this.editor.getPromptBlock(id);
  }

  update(input: StorageUpdatePromptBlockInput): Promise<StorageResolvedPromptBlockType> {
    return this.editor.updatePromptBlock(input);
  }

  delete(id: string): Promise<void> {
    return this.editor.deletePromptBlock(id);
  }

  list(args?: StorageListPromptBlocksInput): Promise<StorageListPromptBlocksOutput> {
    return this.editor.listPromptBlocks(args);
  }

  listResolved(args?: StorageListPromptBlocksInput): Promise<StorageListPromptBlocksResolvedOutput> {
    return this.editor.listPromptBlocksResolved(args);
  }

  preview(blocks: AgentInstructionBlock[], context: Record<string, unknown>): Promise<string> {
    return this.editor.previewInstructions(blocks, context);
  }
}
