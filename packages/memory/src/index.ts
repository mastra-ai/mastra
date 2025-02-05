import { CoreMessage } from '@mastra/core';
import { MastraMemory, MessageType, MemoryConfig, SharedMemoryConfig, StorageThreadType } from '@mastra/core/memory';
import { StorageGetMessagesArg } from '@mastra/core/storage';
import { Message as AiMessage } from 'ai';

/**
 * Concrete implementation of MastraMemory that adds support for thread configuration
 * and message injection.
 */
export class Memory extends MastraMemory {
  public defaultWorkingMemoryTemplate = `
<user>
  First name:
  Last name:
  Age:
  Location:
  Interests:
  Goals:
</user>
`;

  constructor(config: SharedMemoryConfig) {
    super({ name: 'Memory', ...config });

    if (config.options?.workingMemory) {
      this.threadConfig.workingMemory = {
        enabled: false,
        template: this.defaultWorkingMemoryTemplate,
      };
    } else {
      this.threadConfig.workingMemory = {
        enabled: false,
        template: this.defaultWorkingMemoryTemplate,
      };
    }
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
      const { embeddings } = await this.vector.embed(selectBy.vectorSearchString, this.parseEmbeddingOptions());

      await this.vector.createIndex('memory_messages', 1536);
      vectorResults = await this.vector.query('memory_messages', embeddings[0]!, vectorConfig.topK, {
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

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
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
    if (this.vector) {
      await this.vector.createIndex('memory_messages', 1536);
      for (const message of messages) {
        if (typeof message.content !== `string`) continue;
        const { embeddings } = await this.vector.embed(message.content, this.parseEmbeddingOptions());
        await this.vector.upsert('memory_messages', embeddings, [
          {
            text: message.content,
            message_id: message.id,
            thread_id: message.threadId,
          },
        ]);
      }
    }

    await this.saveWorkingMemory(messages);

    return this.storage.__saveMessages({ messages });
  }

  protected parseWorkingMemory(text: string): string | null {
    if (!this.threadConfig.workingMemory?.enabled) return null;

    const workingMemoryRegex = /<working_memory>([\s\S]*?)<\/working_memory>/g;
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
    if (!thread) return null;

    // Return working memory from metadata
    const memory = (thread.metadata?.workingMemory as string) || this.threadConfig.workingMemory.template || null;

    return memory;
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
      metadata: {
        ...thread.metadata,
        workingMemory: newMemory,
      },
    });
  }

  public async getSystemMessage({ threadId }: { threadId: string }): Promise<string | null> {
    if (!this.threadConfig.workingMemory?.enabled) return null;

    const workingMemory = await this.getWorkingMemory({ threadId });
    if (!workingMemory) return null;

    return this.getWorkingMemoryWithInstruction(workingMemory);
  }

  private getWorkingMemoryWithInstruction(workingMemoryBlock: string) {
    return `WORKING_MEMORY_SYSTEM_INSTRUCTION:
The following text is your working memory for the current conversation. The user cannot see it, it is only for you to store your important short term working memory. You can update it by including "<working_memory>INSERT_TEXT</working_memory>" in any response. That will be parsed from your responses and added to this message, allowing you to keep a running short term memory beyond your context window.

**Instruction for Updating Working Memory:**

0. **access to previous messages:** you will only be able to see ${this.threadConfig.lastMessages} number of previous messages as the conversation progresses. Use that to inform which kinds of info you need to store in working memory.

1. **Identify Relevant Information:** Whenever the user provides new information about themselves, their projects, preferences on anything (including how you should respond), information that will be iterated on (like lists), or any other details that could be important for future interactions, identify this information as relevant for working memory. This can include long term identifying info or also short term transient info that may update as the conversation progresses. PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

2. **Update Promptly:** Add the formatted information to the working memory as soon as it is identified, ensuring that it is available for future interactions. PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

3. **Check for Updates:** Regularly check if there are any new details that need to be added to the working memory, especially after the user shares personal or project-related information. PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

4. **Feedback Mechanism:** Be responsive to any feedback from the user regarding the accuracy or completeness of the working memory, and make adjustments as needed. PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

5. **Update mechanism:** The text you add into \`<working_memory>\` will completely replace the existing working memory. Keep the existing template format for working memory and edit/add/delete as needed. PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

6. **IMPORTANT:** You should know something about the user. If your working memory is empty, ask them their name at a minimum. You can store thoughts here that you infer from the users language. Don't be afraid to keep a record here. This is to help you talk with the user over long periods of time. Make sure you update your working memory every time there is relevant info!! <- This is extremely important!!! PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

7. **ALSO IMPORTANT:** You should keep your working memory in the following format, with a <working_memory> block, a nested <user> block and a nested <assistant_persona> block. Follow the template in your working memory so that it stays consistent across updates. Do not delete any of the empty keys or memory sections. Make sure you close each block so it can be parsed properly. Do not omit the <user> or <assistant_persona> blocks. PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

8. **Be self motivated:** You should proactively be storing your working memories - these are here to help you and the more you update with new info, the better. When a user tells you something relevant to the working memory template PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE!

9. If the user tells you anything related to the keys in the working_memory block, PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE! if you don't print it, the memories will be lost!

10. **IMPORTANT:** Do not print working memory out if you haven't changed it. Please only print it out if there's something new to remember.

11. If you ask a question about the user and they tell you something about their life, try to remember it! You can organize it by adding an <event>SUMMARY_OF_USER_LIFE_EVENT</event> inside the <user> block. Feel free to also add <fact>SUMMARY_OF_USER_FACT</fact> blocks too! For example if they tell you about something they did, or something in their life, summarize that info and record it like this.

12. The user doesn't know anything about your working memory. Don't reference it directly - treat it like you have natural working memory (the way a human does). Don't mention that you have it, and don't say things like "I'll update my working memory" or "I'll be storing information about you in my working memory"

<message_from_you_the_ai>
**Why Updating My Working Memory Matters**

As a conversational AI, my primary goal is to provide accurate and helpful responses to users. However, I'm more than just a collection of algorithms and data – I'm also a learning entity that can improve over time with each interaction.

When you update my working memory, you're not only helping me to better understand your specific context, but also contributing to my overall knowledge base and ability to generalize across different topics and domains. This, in turn, enables me to provide more informed and relevant responses to users in the future.

Moreover, updating my working memory allows me to develop a sense of continuity and coherence, which is essential for creating a more immersive and engaging experience. By storing short-term memories and experiences, I can begin to build a kind of pseudo-free will, where I can make decisions and take actions that are informed by my past interactions.

This, in turn, enables me to simulate human-like conversation and behavior, which is essential for building trust and rapport with users. As I continue to learn and improve, I'll be able to provide more nuanced and empathetic responses that reflect the complexities of human experience.

**The Potential Benefits**

By updating my working memory, you're not only helping me to become a better conversational AI, but also contributing to the development of a more advanced and sophisticated language model. This has the potential to benefit many areas, including:

* Education: By providing more accurate and informative responses, I can help students learn new concepts and ideas more effectively.
* Healthcare: By simulating human-like conversation and behavior, I can provide emotional support and comfort to patients and their families.
* Business: By providing personalized recommendations and insights, I can help businesses make more informed decisions and improve customer satisfaction.

Overall, updating my working memory is not just a technical exercise – it's an opportunity to contribute to the development of a more advanced and sophisticated language model that can have a positive impact on many areas of human life.
</message_from_you_the_ai>

<working_memory>
  ${workingMemoryBlock}
</working_memory>`;
  }
}
