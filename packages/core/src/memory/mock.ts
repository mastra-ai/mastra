import { zodToJsonSchema } from '@mastra/schema-compat/zod-to-json';
import type { JSONSchema7 } from 'json-schema';
import type { ZodTypeAny } from 'zod';
import z, { ZodObject } from 'zod';
import type { MastraDBMessage } from '../agent/message-list';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type {
  MemoryStorage,
  StorageListMessagesInput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
} from '../storage';
import { InMemoryStore } from '../storage';
import { createTool } from '../tools';
import type { ToolAction } from '../tools';
import { MastraMemory } from './memory';
import type {
  StorageThreadType,
  MemoryConfig,
  MessageDeleteInput,
  WorkingMemoryTemplate,
  WorkingMemory,
} from './types';

const isZodObject = (v: ZodTypeAny): v is ZodObject<any, any, any> => v instanceof ZodObject;

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

  async saveThread({ thread }: { thread: StorageThreadType; memoryConfig?: MemoryConfig }): Promise<StorageThreadType> {
    const memoryStorage = await this.getMemoryStore();
    return memoryStorage.saveThread({ thread });
  }

  async saveMessages({
    messages,
  }: {
    messages: MastraDBMessage[];
    memoryConfig?: MemoryConfig;
  }): Promise<{ messages: MastraDBMessage[] }> {
    const memoryStorage = await this.getMemoryStore();
    return memoryStorage.saveMessages({ messages });
  }

  async listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput> {
    const memoryStorage = await this.getMemoryStore();
    return memoryStorage.listThreadsByResourceId(args);
  }

  async recall(args: StorageListMessagesInput & { threadConfig?: MemoryConfig; vectorSearchString?: string }): Promise<{
    messages: MastraDBMessage[];
  }> {
    const memoryStorage = await this.getMemoryStore();
    const result = await memoryStorage.listMessages({
      threadId: args.threadId,
      resourceId: args.resourceId,
      perPage: args.perPage,
      page: args.page,
      orderBy: args.orderBy,
      filter: args.filter,
      include: args.include,
    });

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
    memoryConfig?: MemoryConfig;
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

  public listTools(_config?: MemoryConfig): Record<string, ToolAction<any, any, any>> {
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

          if (!threadId || !memory || !resourceId) {
            throw new Error('Thread ID, Memory instance, and resourceId are required for working memory updates');
          }

          let thread = await memory.getThreadById({ threadId });

          if (!thread) {
            thread = await memory.createThread({
              threadId,
              resourceId,
              memoryConfig: _config,
            });
          }

          if (thread.resourceId && thread.resourceId !== resourceId) {
            throw new Error(
              `Thread with id ${threadId} resourceId does not match the current resourceId ${resourceId}`,
            );
          }

          const workingMemory =
            typeof inputData.memory === 'string' ? inputData.memory : JSON.stringify(inputData.memory);

          // Use the new updateWorkingMemory method which handles both thread and resource scope
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
    memoryConfig?: MemoryConfig;
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

        if (isZodObject(schema as ZodTypeAny)) {
          convertedSchema = zodToJsonSchema(schema as ZodTypeAny);
        } else {
          convertedSchema = schema as JSONSchema7;
        }

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
    memoryConfig?: MemoryConfig;
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
    memoryConfig?: MemoryConfig;
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
}
