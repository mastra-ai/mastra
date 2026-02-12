import type { JSONSchema7 } from 'json-schema';
import z from 'zod/v4';
import type { MastraDBMessage } from '../agent/message-list';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import { toStandardSchema, standardSchemaToJSONSchema } from '../schema/standard-schema';
import type {
  MemoryStorage,
  StorageListMessagesInput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
} from '../storage';
import { InMemoryStore } from '../storage';
import { createTool } from '../tools';
import type { ToolAction } from '../tools';
import { MastraMemory } from './memory';
import type {
  StorageThreadType,
  MemoryConfigInternal,
  MessageDeleteInput,
  WorkingMemoryTemplate,
  WorkingMemory,
} from './types';

export class MockMemory extends MastraMemory {
  constructor({
    storage,
    enableWorkingMemory = false,
    workingMemoryTemplate,
    enableMessageHistory = true,
  }: {
    storage?: InMemoryStore;
    enableWorkingMemory?: boolean;
    enableMessageHistory?: boolean;
    workingMemoryTemplate?: string;
  } = {}) {
    super({
      name: 'mock',
      storage: storage || new InMemoryStore(),
      options: {
        workingMemory: enableWorkingMemory
          ? ({ enabled: true, template: workingMemoryTemplate } as WorkingMemory)
          : undefined,
        lastMessages: enableMessageHistory ? 10 : undefined,
      },
    });
    this._hasOwnStorage = true;
  }

  protected async getMemoryStore(): Promise<MemoryStorage> {
    const store = await this.storage.getStore('memory');
    if (!store) {
      throw new MastraError({
        id: 'MASTRA_MEMORY_STORAGE_NOT_AVAILABLE',
        domain: ErrorDomain.MASTRA_MEMORY,
        category: ErrorCategory.SYSTEM,
        text: 'Memory storage is not supported by this storage adapter',
      });
    }
    return store;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const memoryStorage = await this.getMemoryStore();
    return memoryStorage.getThreadById({ threadId });
  }

  async saveThread({
    thread,
  }: {
    thread: StorageThreadType;
    memoryConfig?: MemoryConfigInternal;
  }): Promise<StorageThreadType> {
    const memoryStorage = await this.getMemoryStore();
    return memoryStorage.saveThread({ thread });
  }

  async saveMessages({
    messages,
  }: {
    messages: MastraDBMessage[];
    memoryConfig?: MemoryConfigInternal;
  }): Promise<{ messages: MastraDBMessage[] }> {
    const memoryStorage = await this.getMemoryStore();
    return memoryStorage.saveMessages({ messages });
  }

  async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    const memoryStorage = await this.getMemoryStore();
    return memoryStorage.listThreads(args);
  }

  async recall(
    args: StorageListMessagesInput & { threadConfig?: MemoryConfigInternal; vectorSearchString?: string },
  ): Promise<{
    messages: MastraDBMessage[];
  }> {
    const memoryStorage = await this.getMemoryStore();
    // Extract only the StorageListMessagesInput properties, excluding threadConfig and vectorSearchString
    const { threadConfig: _threadConfig, vectorSearchString: _vectorSearchString, ...listMessagesArgs } = args;
    const result = await memoryStorage.listMessages(listMessagesArgs);

    return result;
  }

  async deleteThread(threadId: string) {
    const memoryStorage = await this.getMemoryStore();
    return memoryStorage.deleteThread({ threadId });
  }

  async deleteMessages(messageIds: MessageDeleteInput): Promise<void> {
    const memoryStorage = await this.getMemoryStore();
    const ids = Array.isArray(messageIds)
      ? messageIds?.map(item => (typeof item === 'string' ? item : item.id))
      : [messageIds];
    return memoryStorage.deleteMessages(ids);
  }

  async getWorkingMemory({
    threadId,
    resourceId,
    memoryConfig,
  }: {
    threadId: string;
    resourceId?: string;
    memoryConfig?: MemoryConfigInternal;
  }): Promise<string | null> {
    const mergedConfig = this.getMergedThreadConfig(memoryConfig);
    const workingMemoryConfig = mergedConfig.workingMemory;

    if (!workingMemoryConfig?.enabled) {
      return null;
    }

    const scope = workingMemoryConfig.scope || 'resource';
    const id = scope === 'resource' ? resourceId : threadId;

    if (!id) {
      return null;
    }

    const memoryStorage = await this.getMemoryStore();
    const resource = await memoryStorage.getResourceById({ resourceId: id });
    return resource?.workingMemory || null;
  }

  public listTools(_config?: MemoryConfigInternal): Record<string, ToolAction<any, any, any>> {
    const mergedConfig = this.getMergedThreadConfig(_config);
    if (!mergedConfig.workingMemory?.enabled) {
      return {};
    }

    return {
      updateWorkingMemory: createTool({
        id: 'update-working-memory',
        description: `Update the working memory with new information. Any data not included will be overwritten.`,
        inputSchema: z.object({ memory: z.string() }),
        execute: async (inputData, context) => {
          const threadId = context?.agent?.threadId;
          const resourceId = context?.agent?.resourceId;

          // Memory can be accessed via context.memory (when agent is part of Mastra instance)
          // or context.memory (when agent is standalone with memory passed directly)
          const memory = (context as any)?.memory;

          if (!memory) {
            throw new Error('Memory instance is required for working memory updates');
          }

          const scope = mergedConfig.workingMemory?.scope || 'resource';
          if (scope === 'thread' && !threadId) {
            throw new Error('Thread ID is required for thread-scoped working memory updates');
          }
          if (scope === 'resource' && !resourceId) {
            throw new Error('Resource ID is required for resource-scoped working memory updates');
          }

          if (threadId) {
            let thread = await memory.getThreadById({ threadId });

            if (!thread) {
              thread = await memory.createThread({
                threadId,
                resourceId,
                memoryConfig: _config,
              });
            }

            if (thread.resourceId && resourceId && thread.resourceId !== resourceId) {
              throw new Error(
                `Thread with id ${threadId} resourceId does not match the current resourceId ${resourceId}`,
              );
            }
          }

          const workingMemory =
            typeof inputData.memory === 'string' ? inputData.memory : JSON.stringify(inputData.memory);

          await memory.updateWorkingMemory({
            threadId,
            resourceId,
            workingMemory,
            memoryConfig: _config,
          });

          return { success: true };
        },
      }),
    };
  }

  async getWorkingMemoryTemplate({
    memoryConfig,
  }: {
    memoryConfig?: MemoryConfigInternal;
  } = {}): Promise<WorkingMemoryTemplate | null> {
    const mergedConfig = this.getMergedThreadConfig(memoryConfig);
    const workingMemoryConfig = mergedConfig.workingMemory;

    if (!workingMemoryConfig?.enabled) {
      return null;
    }

    if (workingMemoryConfig.template) {
      return {
        format: 'markdown' as const,
        content: workingMemoryConfig.template,
      };
    }

    if (workingMemoryConfig.schema) {
      try {
        const schema = workingMemoryConfig.schema;
        let convertedSchema: JSONSchema7;

        // Convert any schema type to JSON Schema using the standard schema interface
        convertedSchema = standardSchemaToJSONSchema(toStandardSchema(schema as any));

        return { format: 'json', content: JSON.stringify(convertedSchema) };
      } catch (error) {
        this.logger?.error?.('Error converting schema', error);
        throw error;
      }
    }

    return null;
  }

  async updateWorkingMemory({
    threadId,
    resourceId,
    workingMemory,
    memoryConfig,
  }: {
    threadId: string;
    resourceId?: string;
    workingMemory: string;
    memoryConfig?: MemoryConfigInternal;
  }) {
    const mergedConfig = this.getMergedThreadConfig(memoryConfig);
    const workingMemoryConfig = mergedConfig.workingMemory;

    if (!workingMemoryConfig?.enabled) {
      return;
    }

    const scope = workingMemoryConfig.scope || 'resource';
    const id = scope === 'resource' ? resourceId : threadId;

    if (!id) {
      throw new Error(`Cannot update working memory: ${scope} ID is required`);
    }

    const memoryStorage = await this.getMemoryStore();
    await memoryStorage.updateResource({
      resourceId: id,
      workingMemory,
    });
  }

  async __experimental_updateWorkingMemoryVNext({
    threadId,
    resourceId,
    workingMemory,
    searchString: _searchString,
    memoryConfig,
  }: {
    threadId: string;
    resourceId?: string;
    workingMemory: string;
    searchString?: string;
    memoryConfig?: MemoryConfigInternal;
  }) {
    try {
      await this.updateWorkingMemory({
        threadId,
        resourceId,
        workingMemory,
        memoryConfig,
      });
      return { success: true, reason: 'Working memory updated successfully' };
    } catch (error) {
      return {
        success: false,
        reason: error instanceof Error ? error.message : 'Failed to update working memory',
      };
    }
  }

  async cloneThread(args: StorageCloneThreadInput): Promise<StorageCloneThreadOutput> {
    const memoryStorage = await this.getMemoryStore();
    return memoryStorage.cloneThread(args);
  }
}
