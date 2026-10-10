import { BaseListChatMessageHistory } from '@langchain/core/chat_history';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';

import { PlatformMemoryClient } from './client';
import type { MemoryMessageInput, PlatformMemoryClientOptions } from './client';

export type PlatformChatMessageHistoryOptions = PlatformMemoryClientOptions & {
  threadId: string;
  /** Who the memory belongs to. Defaults to `threadId`. */
  resourceId?: string;
  client?: PlatformMemoryClient;
};

function toInput(message: BaseMessage): MemoryMessageInput | null {
  const type = message.getType();
  const role = type === 'human' ? 'user' : type === 'ai' ? 'assistant' : null;
  const content = message.text;
  return role && content ? { role, content } : null;
}

/**
 * LangChain chat history backed by a hosted Platform Memory instance.
 *
 * `getMessages()` returns the instance's observations as a system message followed by
 * the unobserved message tail, so long conversations stay bounded. Only human and AI
 * text is saved; observation runs on the Platform.
 *
 * ```ts
 * const chain = new RunnableWithMessageHistory({
 *   runnable: prompt.pipe(model),
 *   getMessageHistory: sessionId => new PlatformChatMessageHistory({ threadId: sessionId, resourceId: userId }),
 *   inputMessagesKey: 'input',
 *   historyMessagesKey: 'history',
 * });
 * ```
 */
export class PlatformChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ['mastra', 'platform_memory'];

  readonly #client: PlatformMemoryClient;
  readonly #threadId: string;
  readonly #resourceId: string;

  constructor(options: PlatformChatMessageHistoryOptions) {
    super();
    this.#client = options.client ?? new PlatformMemoryClient(options);
    this.#threadId = options.threadId;
    this.#resourceId = options.resourceId ?? options.threadId;
  }

  async getMessages(): Promise<BaseMessage[]> {
    const context = await this.#client.getContext(this.#threadId, this.#resourceId);
    return [
      ...(context.system ? [new SystemMessage(context.system)] : []),
      ...context.messages.map(m => (m.role === 'assistant' ? new AIMessage(m.content) : new HumanMessage(m.content))),
    ];
  }

  async addMessage(message: BaseMessage): Promise<void> {
    await this.addMessages([message]);
  }

  async addMessages(messages: BaseMessage[]): Promise<void> {
    const inputs = messages.map(toInput).filter(m => m !== null);
    if (inputs.length) {
      await this.#client.saveMessages(this.#threadId, { resourceId: this.#resourceId, messages: inputs });
    }
  }

  /** Deletes the thread from Platform Memory. */
  async clear(): Promise<void> {
    await this.#client.deleteThread(this.#threadId);
  }
}
