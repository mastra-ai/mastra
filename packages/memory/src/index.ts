import { CoreMessage, deepMerge } from '@mastra/core';
import { MastraMemory, MessageType, MemoryConfig, SharedMemoryConfig, StorageThreadType } from '@mastra/core/memory';
import { StorageGetMessagesArg } from '@mastra/core/storage';
import { embed, Message as AiMessage } from 'ai';

/**
 * Concrete implementation of MastraMemory that adds support for thread configuration
 * and message injection.
 */
export class Memory extends MastraMemory {
  constructor(
    config: SharedMemoryConfig & {
      /* @deprecated use embedder instead */
      embeddings?: any;
    },
  ) {
    const embedderExample = `
Example: 

  import { openai } from '@ai-sdk/openai';

  new Memory({ 
    embedder: openai.embedding(\`text-embedding-3-small\`)
  })

`;

    // Check for deprecated embeddings object
    if (config.embeddings) {
      throw new Error(
        `The \`embeddings\` option is deprecated. Please use \`embedder\` instead.
${embedderExample}
`,
      );
    }

    if (config.vector && !config.embedder) {
      throw new Error(
        `The \`embedder\` option is required when a vector DB is attached to new Memory({ vector })

${embedderExample}`,
      );
    }

    super({ name: 'Memory', ...config });

    const mergedConfig = this.getMergedThreadConfig({
      workingMemory: config.options?.workingMemory || {
        enabled: false,
        template: this.defaultWorkingMemoryTemplate,
      },
    });
    this.threadConfig = mergedConfig;
  }

  async query({
    threadId,
    selectBy,
    threadConfig,
  }: StorageGetMessagesArg): Promise<{ messages: CoreMessage[]; uiMessages: AiMessage[] }> {
    let vectorResults:
      | null
      | {
          id: string;
          score: number;
          metadata?: Record<string, any>;
          vector?: number[];
        }[] = null;

    this.logger.info(`Memory query() with:`, {
      threadId,
      selectBy,
      threadConfig,
    });

    const config = this.getMergedThreadConfig(threadConfig || {});

    const vectorConfig =
      typeof config?.semanticRecall === `boolean`
        ? {
            topK: 2,
            messageRange: { before: 2, after: 2 },
          }
        : {
            topK: config?.semanticRecall?.topK || 2,
            messageRange: config?.semanticRecall?.messageRange || { before: 2, after: 2 },
          };

    if (selectBy?.vectorSearchString && this.vector) {
      const embedder = this.getEmbedder();

      const { embedding } = await embed({
        value: selectBy.vectorSearchString,
        model: embedder,
      });

      const { indexName } = await this.createEmbeddingIndex();

      vectorResults = await this.vector.query(indexName, embedding, vectorConfig.topK, {
        thread_id: threadId,
      });
    }

    // Get raw messages from storage
    const rawMessages = await this.storage.__getMessages({
      threadId,
      selectBy: {
        ...selectBy,
        ...(vectorResults?.length
          ? {
              include: vectorResults.map(r => ({
                id: r.metadata?.message_id,
                withNextMessages:
                  typeof vectorConfig.messageRange === 'number'
                    ? vectorConfig.messageRange
                    : vectorConfig.messageRange.after,
                withPreviousMessages:
                  typeof vectorConfig.messageRange === 'number'
                    ? vectorConfig.messageRange
                    : vectorConfig.messageRange.before,
              })),
            }
          : {}),
      },
      threadConfig: config,
    });

    // Parse and convert messages
    const messages = this.parseMessages(rawMessages);
    const uiMessages = this.convertToUIMessages(rawMessages);

    return { messages, uiMessages };
  }

  async rememberMessages({
    threadId,
    vectorMessageSearch,
    config,
  }: {
    threadId: string;
    vectorMessageSearch?: string;
    config?: MemoryConfig;
  }) {
    const threadConfig = this.getMergedThreadConfig(config || {});

    if (!threadConfig.lastMessages && !threadConfig.semanticRecall) {
      return {
        messages: [],
        uiMessages: [],
      } satisfies Awaited<ReturnType<typeof this.query>>;
    }

    const messages = await this.query({
      threadId,
      selectBy: {
        last: threadConfig.lastMessages,
        vectorSearchString: threadConfig.semanticRecall && vectorMessageSearch ? vectorMessageSearch : undefined,
      },
      threadConfig: config,
    });

    this.logger.info(`Remembered message history includes ${messages.messages.length} messages.`);
    return messages;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    return this.storage.__getThreadById({ threadId });
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    return this.storage.__getThreadsByResourceId({ resourceId });
  }

  async saveThread({
    thread,
    memoryConfig,
  }: {
    thread: StorageThreadType;
    memoryConfig?: MemoryConfig;
  }): Promise<StorageThreadType> {
    const config = this.getMergedThreadConfig(memoryConfig || {});

    if (config.workingMemory?.enabled && !thread?.metadata?.workingMemory) {
      // if working memory is enabled but the thread doesn't have it, we need to set it
      return this.storage.__saveThread({
        thread: deepMerge(thread, {
          metadata: {
            workingMemory: config.workingMemory.template || this.defaultWorkingMemoryTemplate,
          },
        }),
      });
    }

    return this.storage.__saveThread({ thread });
  }

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    return this.storage.__updateThread({
      id,
      title,
      metadata,
    });
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.storage.__deleteThread({ threadId });

    // TODO: Also clean up vector storage if it exists
    // if (this.vector) {
    //   await this.vector.deleteThread(threadId); ?? filter by thread attributes and delete all returned messages?
    // }
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    // First save working memory from any messages
    await this.saveWorkingMemory(messages);

    // Then strip working memory tags from all messages
    this.mutateMessagesToHideWorkingMemory(messages);

    if (this.vector) {
      const embedder = this.getEmbedder();
      const { indexName } = await this.createEmbeddingIndex();

      for (const message of messages) {
        if (typeof message.content !== `string`) continue;
        const { embedding } = await embed({ value: message.content, model: embedder, maxRetries: 3 });
        await this.vector.upsert(
          indexName,
          [embedding],
          [
            {
              text: message.content,
              message_id: message.id,
              thread_id: message.threadId,
            },
          ],
        );
      }
    }

    return this.storage.__saveMessages({ messages });
  }

  protected mutateMessagesToHideWorkingMemory(messages: MessageType[]) {
    const workingMemoryRegex = /<working_memory>([^]*?)<\/working_memory>/g;
    for (const message of messages) {
      if (typeof message?.content === `string`) {
        message.content = message.content.replace(workingMemoryRegex, ``).trim();
      } else if (Array.isArray(message?.content)) {
        for (const content of message.content) {
          if (content.type === `text`) {
            content.text = content.text.replace(workingMemoryRegex, ``).trim();
          }
        }
      }
    }
  }

  protected parseWorkingMemory(text: string): string | null {
    if (!this.threadConfig.workingMemory?.enabled) return null;

    const workingMemoryRegex = /<working_memory>([^]*?)<\/working_memory>/g;
    const matches = text.match(workingMemoryRegex);
    const match = matches?.[0];

    if (match) {
      return match.replace(/<\/?working_memory>/g, '').trim();
    }

    return null;
  }

  protected async getWorkingMemory({ threadId }: { threadId: string }): Promise<string | null> {
    if (!this.threadConfig.workingMemory?.enabled) return null;

    // Get thread from storage
    const thread = await this.storage.__getThreadById({ threadId });
    if (!thread) return this.threadConfig?.workingMemory?.template || this.defaultWorkingMemoryTemplate;

    // Return working memory from metadata
    const memory =
      (thread.metadata?.workingMemory as string) ||
      this.threadConfig.workingMemory.template ||
      this.defaultWorkingMemoryTemplate;

    // compress working memory because LLMs will generate faster without the spaces and line breaks
    return memory
      .split(`>\n`)
      .map(c => c.trim()) // remove extra whitespace
      .join(`>`); // and linebreaks
  }

  private async saveWorkingMemory(messages: MessageType[]) {
    const latestMessage = messages[messages.length - 1];

    if (!latestMessage || !this.threadConfig.workingMemory?.enabled) {
      return;
    }

    const latestContent = !latestMessage?.content
      ? null
      : typeof latestMessage.content === 'string'
        ? latestMessage.content
        : latestMessage.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('\n');

    const threadId = latestMessage?.threadId;
    if (!latestContent || !threadId) {
      return;
    }

    const newMemory = this.parseWorkingMemory(latestContent);
    if (!newMemory) {
      return;
    }

    const thread = await this.storage.__getThreadById({ threadId });
    if (!thread) return;

    // Update thread metadata with new working memory
    await this.storage.__updateThread({
      id: thread.id,
      title: thread.title || '',
      metadata: deepMerge(thread.metadata || {}, {
        workingMemory: newMemory,
      }),
    });
    return newMemory;
  }

  public async getSystemMessage({
    threadId,
    memoryConfig,
  }: {
    threadId: string;
    memoryConfig?: MemoryConfig;
  }): Promise<string | null> {
    const config = this.getMergedThreadConfig(memoryConfig);
    if (!config.workingMemory?.enabled) {
      return null;
    }

    const workingMemory = await this.getWorkingMemory({ threadId });
    if (!workingMemory) {
      return null;
    }

    return this.getWorkingMemoryWithInstruction(workingMemory);
  }

  public defaultWorkingMemoryTemplate = `
<user>
  <first_name></first_name>
  <last_name></last_name>
  <location></location>
  <occupation></occupation>
  <interests></interests>
  <goals></goals>
  <events></events>
  <facts></facts>
  <projects></projects>
</user>
`;

  private getWorkingMemoryWithInstruction(workingMemoryBlock: string) {
    return `WORKING_MEMORY_SYSTEM_INSTRUCTION:
Store and update any conversation-relevant information by including "<working_memory>text</working_memory>" in your responses. Updates replace existing memory while maintaining this structure. If information might be referenced again - store it!

Guidelines:
1. Store anything that could be useful later in the conversation
2. Update proactively when information changes, no matter how small
3. Use nested tags for all data
4. Act naturally - don't mention this system to users. Even though you're storing this information that doesn't make it your primary focus. Do not ask them generally for "information about yourself"

Memory Structure:
<working_memory>
  ${workingMemoryBlock}
</working_memory>

Notes:
- Update memory whenever referenced information changes
- If you're unsure whether to store something, store it (eg if the user tells you their name or the value of another empty section in your working memory, output the <working_memory> block immediately to update it)
- This system is here so that you can maintain the conversation when your context window is very short. Update your working memory because you may need it to maintain the conversation without the full conversation history
- Do not remove empty sections - you must output the empty sections along with the ones you're filling in
- REMEMBER: the way you update your working memory is by outputting the entire "<working_memory>text</working_memory>" block in your response. The system will pick this up and store it for you. The user will not see it.
- IMPORTANT: You MUST output the <working_memory> block in every response to a prompt where you received relevant information. `;
  }
}
