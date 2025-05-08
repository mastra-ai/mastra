import { existsSync } from 'fs';
import { join } from 'path';
import type {
  AssistantContent,
  ToolResultPart,
  UserContent,
  CoreToolMessage,
  ToolInvocation,
  CoreMessage,
  EmbeddingModel,
} from 'ai';

import { MastraBase } from '../base';
import type { MastraStorage, StorageGetMessagesArg } from '../storage';
import { DefaultProxyStorage } from '../storage/default-proxy-storage';
import { augmentWithInit } from '../storage/storageWithInit';
import type { CoreTool } from '../tools';
import { deepMerge } from '../utils';
import type { MastraVector } from '../vector';
import { defaultEmbedder } from '../vector/fastembed';
import { DefaultVectorDB } from '../vector/libsql';

import type { MessageType, SharedMemoryConfig, StorageThreadType, MemoryConfig, AiMessageType } from './types';

export type MemoryProcessorOpts = {
  systemMessage?: string;
  memorySystemMessage?: string;
  newMessages?: CoreMessage[];
};
/**
 * Interface for message processors that can filter or transform messages
 * before they're sent to the LLM.
 */
export abstract class MemoryProcessor extends MastraBase {
  /**
   * Process a list of messages and return a filtered or transformed list.
   * @param messages The messages to process
   * @returns The processed messages
   */
  process(messages: CoreMessage[], _opts: MemoryProcessorOpts): CoreMessage[] {
    return messages;
  }
}

export const memoryDefaultOptions = {
  lastMessages: 40,
  semanticRecall: {
    topK: 2,
    messageRange: {
      before: 2,
      after: 2,
    },
  },
  threads: {
    generateTitle: true,
  },
  workingMemory: {
    use: 'text-stream', // will be deprecated, use 'tool-call' instead
    enabled: false,
    template: `
# User Information
- **First Name**: 
- **Last Name**: 
- **Location**: 
- **Occupation**: 
- **Interests**: 
- **Goals**: 
- **Events**: 
- **Facts**: 
- **Projects**: 
`,
  },
} satisfies MemoryConfig;

// TODO: May 20th breaking change, make these the default options. Also in packages/cli/src/commands/init/utils.ts remove the hardcoded options to use the new defaults instead
const newMemoryDefaultOptions = {
  lastMessages: 10,
  semanticRecall: false,
  threads: {
    generateTitle: false,
  },
  workingMemory: {
    // new
    use: 'tool-call',
    // stays the same
    enabled: false,
    template: `
# User Information
- **First Name**: 
- **Last Name**: 
- **Location**: 
- **Occupation**: 
- **Interests**: 
- **Goals**: 
- **Events**: 
- **Facts**: 
- **Projects**: 
`,
  },
} satisfies MemoryConfig;

/**
 * Abstract Memory class that defines the interface for storing and retrieving
 * conversation threads and messages.
 */
export abstract class MastraMemory extends MastraBase {
  MAX_CONTEXT_TOKENS?: number;

  storage: MastraStorage;
  vector?: MastraVector;
  embedder?: EmbeddingModel<string>;
  private processors: MemoryProcessor[] = [];

  private deprecationWarnings: string[] = [];

  protected threadConfig: MemoryConfig = { ...memoryDefaultOptions };

  constructor(config: { name: string } & SharedMemoryConfig) {
    super({ component: 'MEMORY', name: config.name });

    if (config.options) {
      this.threadConfig = this.getMergedThreadConfig(config.options);
    }

    // user is running mastra outside mastra dev in their own code, and is using default memory storage
    const hasRootMemoryDbFile = existsSync(join(process.cwd(), `memory.db`));
    // user is running mastra server and has default memory storage
    const hasParentMemoryDbFile = existsSync(join(process.cwd(), `..`, `..`, `memory.db`));
    // May 20th we wont worry about this anymore
    const suggestDbPath =
      hasRootMemoryDbFile || hasParentMemoryDbFile
        ? `file:${hasParentMemoryDbFile ? `../../` : ``}memory.db`
        : `file:../mastra.db`;

    // TODO: MAY 20th BREAKING CHANGE: Memory will inherit storage from Mastra instance by default
    // if (config.storage) {
    //   this.storage = config.storage;
    // } else if (this.mastra?.storage) { // Assuming Mastra instance is available as this.mastra
    //   this.storage = this.mastra.storage;
    // } else {
    //   throw new Error(`Memory requires a storage provider to function. Add a storage configuration to Memory or add one to your Mastra instance`)
    // }
    // TODO: remove in may 20th breaking change, replace with above code.
    if (config.storage) {
      this.storage = config.storage;
    } else {
      this.storage = new DefaultProxyStorage({
        config: {
          url: 'file:memory.db',
        },
      });

      // TODO: remove in may 20th breaking change
      this.deprecationWarnings.push(`
Default storage is deprecated in Mastra Memory.
You're using it as an implicit default by not setting a storage adapter.

In the May 20th breaking change the default store will be removed.

Instead of this:
export const agent = new Agent({
  memory: new Memory({
    // your config
  })
})

Do this:
import { LibSQLStore } from '@mastra/libsql';

export const agent = new Agent({
  memory: new Memory({
    // your config
    storage: new LibSQLStore({
      url: '${suggestDbPath}' // relative path from bundled .mastra/output dir
    })
  })
})

Additionally, in the breaking release, Memory will inherit storage from the Mastra instance.
If you plan on using that feature you can prepare by setting the same storage instance on Mastra and Memory.

Ex:
// mastra/storage.ts
export const storage = new LibSQLStore({
  url: '${suggestDbPath}'
})

// mastra/index.ts
import { storage } from "./storage"
export const mastra = new Mastra({
  // your config
  storage
})

// mastra/agents/index.ts
import { storage } from "../storage"
export const yourAgent = new Agent({
  // your config
  storage
})
`);
    }

    this.storage = augmentWithInit(this.storage);

    const semanticRecallIsEnabled = this.threadConfig.semanticRecall !== false; // default is to have it enabled, so any value except false means it's on
    if (config.vector && semanticRecallIsEnabled) {
      this.vector = config.vector;
    } else if (
      // if there's no configured vector store
      // and the vector store hasn't been explicitly disabled with vector: false
      config.vector !== false &&
      // and semanticRecall is enabled
      semanticRecallIsEnabled
      // add the default vector store
    ) {
      // TODO: remove in may 20th breaking change
      // for backwards compat reasons, check if there's a memory-vector.db in cwd or in cwd/.mastra
      // if it's there we need to use it, otherwise use the same file:memory.db
      // We used to need two separate DBs because we would get schema errors
      // Creating a new index for each vector dimension size fixed that, so we no longer need a separate sqlite db
      const oldDb = 'memory-vector.db';
      const hasOldDb = existsSync(join(process.cwd(), oldDb)) || existsSync(join(process.cwd(), '.mastra', oldDb));
      const newDb = 'memory.db';

      if (hasOldDb) {
        // TODO: remove in may 20th breaking change
        this.deprecationWarnings.push(
          `Found deprecated Memory vector db file ${oldDb}. In the May 20th breaking change, this will no longer be used by default. This db is now merged with the default storage file (${newDb}). You will need to manually migrate any data from ${oldDb} to ${newDb} if it's important to you. For now the deprecated path will be used, but in the May 20th breaking change we will only use the new db file path.`,
        );
      }

      // TODO: remove in may 20th breaking change
      this.deprecationWarnings.push(`
Default vector storage is deprecated in Mastra Memory.
You're using it as an implicit default by not setting a vector store.

In the May 20th breaking change the default vector store will be removed.

Instead of this:
export const agent = new Agent({
  memory: new Memory({
    options: { semanticRecall: true }
  })
})

Do this:
import { LibSQLVector } from '@mastra/libsql';

export const agent = new Agent({
  memory: new Memory({
    options: { semanticRecall: true },
    vector: new LibSQLVector({
      connectionUrl: '${suggestDbPath}' // relative path from bundled .mastra/output dir
    })
  })
})
`);

      this.vector = new DefaultVectorDB({
        // TODO: MAY 20th BREAKING CHANGE: remove this default and throw an error if semantic recall is enabled but there's no vector db
        connectionUrl: hasOldDb ? `file:${oldDb}` : `file:${newDb}`,
      });
    }

    if (config.embedder) {
      this.embedder = config.embedder;
    } else if (
      // if there's no configured embedder
      // and there's a vector store
      typeof this.vector !== `undefined` &&
      // and semanticRecall is enabled
      semanticRecallIsEnabled
    ) {
      // add the default embedder
      // TODO: remove in may 20th breaking change
      this.deprecationWarnings.push(`
The default embedder (FastEmbed) is deprecated in Mastra Memory.
You're using it as an implicit default by not configuring an embedder.

On May 20th there will be a breaking change and the default embedder will be removed from @mastra/core.

To continue using FastEmbed, install the dedicated package:
pnpm add @mastra/fastembed

Then configure it in your Memory setup:

import { fastembed } from '@mastra/fastembed';

export const agent = new Agent({
  memory: new Memory({
    embedder: fastembed, // Configure the embedder
    // your other config
  })
})

Alternatively, you can use a different embedder, like OpenAI:
import { openai } from '@ai-sdk/openai';

export const agent = new Agent({
  memory: new Memory({
    embedder: openai.embedding('text-embedding-3-small'),
    // your other config
  })
})

--> This breaking change will be released on May 20th <--
`);
      // TODO: may 20th release, throw an error here if no embedder was configured. Should also update the TS types so if semanticRecall is enabled the types show an embedder must be set.
      this.embedder = defaultEmbedder('bge-small-en-v1.5'); // https://huggingface.co/BAAI/bge-small-en-v1.5#model-list we're using small 1.5 because it's much faster than base 1.5 and only scores slightly worse despite being roughly 100MB smaller - small is ~130MB while base is ~220MB
    }

    // Initialize processors if provided
    if (config.processors) {
      this.processors = config.processors;
    }

    this.addImplicitDefaultsWarning(config);

    if (this.deprecationWarnings.length > 0) {
      setTimeout(() => {
        this.logger?.warn(`

!MEMORY DEPRECATION WARNING!
${this.deprecationWarnings.map((w, i) => `${this.deprecationWarnings.length > 1 ? `Warning ${i + 1}:\n` : ``}${w}`).join(`\n\n`)}
!END MEMORY DEPRECATION WARNING!

`);
      }, 1000);
    }
  }

  // We're changing the implicit defaults from memoryDefaultOptions to newMemoryDefaultOptions so we need to log and let people know
  private addImplicitDefaultsWarning(config: SharedMemoryConfig) {
    const fromToPairs: {
      key: keyof MemoryConfig;
      from: unknown;
      to: unknown;
      message?: string;
    }[] = [];

    const indent = (s: string) => s.split(`\n`).join(`\n    `);
    const format = (v: unknown) =>
      typeof v === `object` && !Array.isArray(v) && v !== null
        ? indent(JSON.stringify(v, null, 2).replaceAll(`"`, ``))
        : v;

    const options = config.options ?? {};

    if (!(`lastMessages` in options))
      fromToPairs.push({
        key: 'lastMessages',
        from: memoryDefaultOptions.lastMessages,
        to: newMemoryDefaultOptions.lastMessages,
      });

    if (!(`semanticRecall` in options))
      fromToPairs.push({
        key: 'semanticRecall',
        from: memoryDefaultOptions.semanticRecall,
        to: newMemoryDefaultOptions.semanticRecall,
      });

    if (!(`threads` in options))
      fromToPairs.push({
        key: 'threads',
        from: memoryDefaultOptions.threads,
        to: newMemoryDefaultOptions.threads,
      });

    if (
      `workingMemory` in options &&
      // special handling for working memory since it's disabled by default and users should only care about the change if they're using
      options.workingMemory?.enabled === true &&
      options.workingMemory?.use !== `tool-call`
    ) {
      fromToPairs.push({
        key: 'workingMemory',
        from: {
          use: memoryDefaultOptions.workingMemory.use,
        },
        to: {
          use: newMemoryDefaultOptions.workingMemory.use,
        },
        message: `\nAlso, the text-stream output mode (which is the current default) will be fully removed in an upcoming breaking change. Please update your code to use the newer "use: 'tool-call'" setting instead.\n`,
      });
    }

    if (fromToPairs.length > 0) {
      const currentDefaults = `{
  options: {
    ${fromToPairs.map(({ key, from }) => `${key}: ${format(from)}`).join(`,\n    `)}
  }
}`;
      const upcomingDefaults = `{
  options: {
    ${fromToPairs.map(({ key, to }) => `${key}: ${format(to)}`).join(`,\n    `)}
  }
}`;

      const messages = fromToPairs.filter(ft => ft.message);

      this.deprecationWarnings.push(`
Your Mastra memory instance has the
following implicit default options:

new Memory(${currentDefaults})

In the next release these implicit defaults
will be changed to the following default settings:

new Memory(${upcomingDefaults})

To keep your defaults as they are, add
them directly into your Memory configuration,
otherwise please add the new settings to
your memory config to prepare for the change.
${messages.length ? messages.map(ft => ft.message).join(`\n`) : ``}
--> This breaking change will be released on May 20th <--
`);
    }
  }

  public setStorage(storage: MastraStorage) {
    if (storage instanceof DefaultProxyStorage) {
      this.deprecationWarnings.push(`Importing "DefaultStorage" from '@mastra/core/storage/libsql' is deprecated.

Instead of:
  import { DefaultStorage } from '@mastra/core/storage/libsql';

Do:
  import { LibSQLStore } from '@mastra/libsql';
`);
    }

    this.storage = storage;
  }

  public setVector(vector: MastraVector) {
    this.vector = vector;
  }

  public setEmbedder(embedder: EmbeddingModel<string>) {
    this.embedder = embedder;
  }

  /**
   * Get a system message to inject into the conversation.
   * This will be called before each conversation turn.
   * Implementations can override this to inject custom system messages.
   */
  public async getSystemMessage(_input: { threadId: string; memoryConfig?: MemoryConfig }): Promise<string | null> {
    return null;
  }

  /**
   * Get tools that should be available to the agent.
   * This will be called when converting tools for the agent.
   * Implementations can override this to provide additional tools.
   */
  public getTools(_config?: MemoryConfig): Record<string, CoreTool> {
    return {};
  }

  protected async createEmbeddingIndex(dimensions?: number): Promise<{ indexName: string }> {
    const defaultDimensions = 1536;
    const isDefault = dimensions === defaultDimensions;
    const usedDimensions = dimensions ?? defaultDimensions;
    const separator = this.vector?.indexSeparator ?? '_';
    const indexName = isDefault
      ? `memory${separator}messages`
      : `memory${separator}messages${separator}${usedDimensions}`;

    if (typeof this.vector === `undefined`) {
      throw new Error(`Tried to create embedding index but no vector db is attached to this Memory instance.`);
    }
    await this.vector.createIndex({
      indexName,
      dimension: usedDimensions,
    });
    return { indexName };
  }

  public getMergedThreadConfig(config?: MemoryConfig): MemoryConfig {
    return deepMerge(this.threadConfig, config || {});
  }

  /**
   * Apply all configured message processors to a list of messages.
   * @param messages The messages to process
   * @returns The processed messages
   */
  private applyProcessors(
    messages: CoreMessage[],
    opts: {
      processors?: MemoryProcessor[];
    } & MemoryProcessorOpts,
  ): CoreMessage[] {
    const processors = opts.processors || this.processors;
    if (!processors || processors.length === 0) {
      return messages;
    }

    let processedMessages = [...messages];

    for (const processor of processors) {
      processedMessages = processor.process(processedMessages, {
        systemMessage: opts.systemMessage,
        newMessages: opts.newMessages,
        memorySystemMessage: opts.memorySystemMessage,
      });
    }

    return processedMessages;
  }

  processMessages({
    messages,
    processors,
    ...opts
  }: {
    messages: CoreMessage[];
    processors?: MemoryProcessor[];
  } & MemoryProcessorOpts) {
    return this.applyProcessors(messages, { processors: processors || this.processors, ...opts });
  }

  abstract rememberMessages({
    threadId,
    resourceId,
    vectorMessageSearch,
    systemMessage,
    config,
  }: {
    threadId: string;
    resourceId?: string;
    vectorMessageSearch?: string;
    systemMessage?: CoreMessage;
    config?: MemoryConfig;
  }): Promise<{
    threadId: string;
    messages: CoreMessage[];
    uiMessages: AiMessageType[];
  }>;

  estimateTokens(text: string): number {
    return Math.ceil(text.split(' ').length * 1.3);
  }

  protected parseMessages(messages: MessageType[]): CoreMessage[] {
    return messages.map(msg => {
      let content = msg.content;
      if (typeof content === 'string' && (content.startsWith('[') || content.startsWith('{'))) {
        try {
          content = JSON.parse(content);
        } catch {
          // Keep the original string if it's not valid JSON
        }
      } else if (typeof content === 'number') {
        content = String(content);
      }
      return {
        ...msg,
        content,
      };
    }) as CoreMessage[];
  }

  protected convertToUIMessages(messages: MessageType[]): AiMessageType[] {
    function addToolMessageToChat({
      toolMessage,
      messages,
      toolResultContents,
    }: {
      toolMessage: CoreToolMessage;
      messages: Array<AiMessageType>;
      toolResultContents: Array<ToolResultPart>;
    }): { chatMessages: Array<AiMessageType>; toolResultContents: Array<ToolResultPart> } {
      const chatMessages = messages.map(message => {
        if (message.toolInvocations) {
          return {
            ...message,
            toolInvocations: message.toolInvocations.map(toolInvocation => {
              const toolResult = toolMessage.content.find(tool => tool.toolCallId === toolInvocation.toolCallId);

              if (toolResult) {
                return {
                  ...toolInvocation,
                  state: 'result',
                  result: toolResult.result,
                };
              }

              return toolInvocation;
            }),
          };
        }

        return message;
      }) as Array<AiMessageType>;

      const resultContents = [...toolResultContents, ...toolMessage.content];

      return { chatMessages, toolResultContents: resultContents };
    }

    const { chatMessages } = messages.reduce(
      (obj: { chatMessages: Array<AiMessageType>; toolResultContents: Array<ToolResultPart> }, message) => {
        if (message.role === 'tool') {
          return addToolMessageToChat({
            toolMessage: message as CoreToolMessage,
            messages: obj.chatMessages,
            toolResultContents: obj.toolResultContents,
          });
        }

        let textContent = '';
        let toolInvocations: Array<ToolInvocation> = [];

        if (typeof message.content === 'string') {
          textContent = message.content;
        } else if (typeof message.content === 'number') {
          textContent = String(message.content);
        } else if (Array.isArray(message.content)) {
          for (const content of message.content) {
            if (content.type === 'text') {
              textContent += content.text;
            } else if (content.type === 'tool-call') {
              const toolResult = obj.toolResultContents.find(tool => tool.toolCallId === content.toolCallId);
              toolInvocations.push({
                state: toolResult ? 'result' : 'call',
                toolCallId: content.toolCallId,
                toolName: content.toolName,
                args: content.args,
                result: toolResult?.result,
              });
            }
          }
        }

        obj.chatMessages.push({
          id: (message as MessageType).id,
          role: message.role as AiMessageType['role'],
          content: textContent,
          toolInvocations,
          createdAt: message.createdAt,
        });

        return obj;
      },
      { chatMessages: [], toolResultContents: [] } as {
        chatMessages: Array<AiMessageType>;
        toolResultContents: Array<ToolResultPart>;
      },
    );

    return chatMessages;
  }

  /**
   * Retrieves a specific thread by its ID
   * @param threadId - The unique identifier of the thread
   * @returns Promise resolving to the thread or null if not found
   */
  abstract getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null>;

  abstract getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]>;

  /**
   * Saves or updates a thread
   * @param thread - The thread data to save
   * @returns Promise resolving to the saved thread
   */
  abstract saveThread({
    thread,
    memoryConfig,
  }: {
    thread: StorageThreadType;
    memoryConfig?: MemoryConfig;
  }): Promise<StorageThreadType>;

  /**
   * Saves messages to a thread
   * @param messages - Array of messages to save
   * @returns Promise resolving to the saved messages
   */
  abstract saveMessages({
    messages,
    memoryConfig,
  }: {
    messages: MessageType[];
    memoryConfig: MemoryConfig | undefined;
  }): Promise<MessageType[]>;

  /**
   * Retrieves all messages for a specific thread
   * @param threadId - The unique identifier of the thread
   * @returns Promise resolving to array of messages and uiMessages
   */
  abstract query({
    threadId,
    resourceId,
    selectBy,
  }: StorageGetMessagesArg): Promise<{ messages: CoreMessage[]; uiMessages: AiMessageType[] }>;

  /**
   * Helper method to create a new thread
   * @param title - Optional title for the thread
   * @param metadata - Optional metadata for the thread
   * @returns Promise resolving to the created thread
   */
  async createThread({
    threadId,
    resourceId,
    title,
    metadata,
    memoryConfig,
  }: {
    resourceId: string;
    threadId?: string;
    title?: string;
    metadata?: Record<string, unknown>;
    memoryConfig?: MemoryConfig;
  }): Promise<StorageThreadType> {
    const thread: StorageThreadType = {
      id: threadId || this.generateId(),
      title: title || `New Thread ${new Date().toISOString()}`,
      resourceId,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
    };

    return this.saveThread({ thread, memoryConfig });
  }

  /**
   * Helper method to delete a thread
   * @param threadId - the id of the thread to delete
   */
  abstract deleteThread(threadId: string): Promise<void>;

  /**
   * Helper method to add a single message to a thread
   * @param threadId - The thread to add the message to
   * @param content - The message content
   * @param role - The role of the message sender
   * @param type - The type of the message
   * @param toolNames - Optional array of tool names that were called
   * @param toolCallArgs - Optional array of tool call arguments
   * @param toolCallIds - Optional array of tool call ids
   * @returns Promise resolving to the saved message
   */
  async addMessage({
    threadId,
    resourceId,
    config,
    content,
    role,
    type,
    toolNames,
    toolCallArgs,
    toolCallIds,
  }: {
    threadId: string;
    resourceId: string;
    config?: MemoryConfig;
    content: UserContent | AssistantContent;
    role: 'user' | 'assistant';
    type: 'text' | 'tool-call' | 'tool-result';
    toolNames?: string[];
    toolCallArgs?: Record<string, unknown>[];
    toolCallIds?: string[];
  }): Promise<MessageType> {
    const message: MessageType = {
      id: this.generateId(),
      content,
      role,
      createdAt: new Date(),
      threadId,
      resourceId,
      type,
      toolNames,
      toolCallArgs,
      toolCallIds,
    };

    const savedMessages = await this.saveMessages({ messages: [message], memoryConfig: config });
    return savedMessages[0]!;
  }

  /**
   * Generates a unique identifier
   * @returns A unique string ID
   */
  public generateId(): string {
    return crypto.randomUUID();
  }
}
