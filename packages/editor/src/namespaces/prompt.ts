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
import { resolveInstructionBlocks } from '../instruction-builder';

export class EditorPromptNamespace {
  constructor(private editor: MastraEditor) {}

  private async getStore() {
    const storage = this.editor.__mastra!.getStorage();
    if (!storage) throw new Error('Storage is not configured');
    const store = await storage.getStore('promptBlocks');
    if (!store) throw new Error('Prompt blocks storage domain is not available');
    return store;
  }

  async create(input: StorageCreatePromptBlockInput): Promise<StorageResolvedPromptBlockType> {
    this.ensureRegistered();
    const store = await this.getStore();
    await store.createPromptBlock({ promptBlock: input });
    const resolved = await store.getPromptBlockByIdResolved({ id: input.id });
    if (!resolved) {
      throw new Error(`Failed to resolve prompt block ${input.id} after creation`);
    }
    return resolved;
  }

  async getById(id: string): Promise<StorageResolvedPromptBlockType | null> {
    this.ensureRegistered();
    const store = await this.getStore();
    return store.getPromptBlockByIdResolved({ id });
  }

  async update(input: StorageUpdatePromptBlockInput): Promise<StorageResolvedPromptBlockType> {
    this.ensureRegistered();
    const store = await this.getStore();
    await store.updatePromptBlock(input);
    const resolved = await store.getPromptBlockByIdResolved({ id: input.id });
    if (!resolved) {
      throw new Error(`Failed to resolve prompt block ${input.id} after update`);
    }
    return resolved;
  }

  async delete(id: string): Promise<void> {
    this.ensureRegistered();
    const store = await this.getStore();
    await store.deletePromptBlock({ id });
  }

  async list(args?: StorageListPromptBlocksInput): Promise<StorageListPromptBlocksOutput> {
    this.ensureRegistered();
    const store = await this.getStore();
    return store.listPromptBlocks(args);
  }

  async listResolved(args?: StorageListPromptBlocksInput): Promise<StorageListPromptBlocksResolvedOutput> {
    this.ensureRegistered();
    const store = await this.getStore();
    return store.listPromptBlocksResolved(args);
  }

  async preview(blocks: AgentInstructionBlock[], context: Record<string, unknown>): Promise<string> {
    this.ensureRegistered();
    const store = await this.getStore();
    return resolveInstructionBlocks(blocks, context, { promptBlocksStorage: store });
  }

  private ensureRegistered(): void {
    if (!this.editor.__mastra) {
      throw new Error('MastraEditor is not registered with a Mastra instance');
    }
  }
}
