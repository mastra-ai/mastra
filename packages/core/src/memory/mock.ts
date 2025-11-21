import { zodToJsonSchema } from '@mastra/schema-compat/zod-to-json';
import type { JSONSchema7 } from 'json-schema';
import type { ZodTypeAny } from 'zod';
import { ZodObject } from 'zod';
import type { MastraDBMessage } from '../agent/message-list';
import { MessageList } from '../agent/message-list';
import type { InputProcessor, OutputProcessor } from '../processors';
import type {
  StorageListMessagesInput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
} from '../storage';
import { InMemoryStore } from '../storage';
import { MastraMemory } from './memory';
import type { StorageThreadType, MemoryConfig, MessageDeleteInput, WorkingMemoryTemplate } from './types';

const isZodObject = (v: ZodTypeAny): v is ZodObject<any, any, any> => v instanceof ZodObject;

export class MockMemory extends MastraMemory {
  private inputProcessors: InputProcessor[];
  private outputProcessors: OutputProcessor[];

  constructor({
    storage,
    inputProcessors = [],
    outputProcessors = [],
  }: {
    storage?: InMemoryStore;
    inputProcessors?: InputProcessor[];
    outputProcessors?: OutputProcessor[];
  } = {}) {
    super({ name: 'mock', storage: storage || new InMemoryStore() });
    this._hasOwnStorage = true;
    this.inputProcessors = inputProcessors;
    this.outputProcessors = outputProcessors;
  }

  getInputProcessors(): InputProcessor[] {
    return this.inputProcessors;
  }

  getOutputProcessors(): OutputProcessor[] {
    return this.outputProcessors;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    return this.storage.getThreadById({ threadId });
  }

  async saveThread({ thread }: { thread: StorageThreadType; memoryConfig?: MemoryConfig }): Promise<StorageThreadType> {
    return this.storage.saveThread({ thread });
  }

  async saveMessages({
    messages,
  }: {
    messages: MastraDBMessage[];
    memoryConfig?: MemoryConfig;
  }): Promise<{ messages: MastraDBMessage[] }> {
    const dbMessages = new MessageList({
      generateMessageId: () => this.generateId(),
    })
      .add(messages, 'memory')
      .get.all.db();

    return this.storage.saveMessages({ messages: dbMessages });
  }

  async listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput> {
    return this.storage.listThreadsByResourceId(args);
  }

  async recall(args: StorageListMessagesInput & { threadConfig?: MemoryConfig; vectorSearchString?: string }): Promise<{
    messages: MastraDBMessage[];
  }> {
    const result = await this.storage.listMessages({
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
    return this.storage.deleteThread({ threadId });
  }

  async deleteMessages(messageIds: MessageDeleteInput): Promise<void> {
    const ids = Array.isArray(messageIds)
      ? messageIds?.map(item => (typeof item === 'string' ? item : item.id))
      : [messageIds];
    return this.storage.deleteMessages(ids);
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

    const resource = await this.storage.getResourceById({ resourceId: id });
    return resource?.workingMemory || null;
  }

  async getWorkingMemoryTemplate(
    _args: {
      threadId?: string;
      resourceId?: string;
    } = {},
  ): Promise<WorkingMemoryTemplate | null> {
    const mergedConfig = this.getMergedThreadConfig();
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

    await this.storage.updateResource({
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
