import { BaseListChatMessageHistory } from '@langchain/core/chat_history';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';

import { PlatformMemoryClient } from './client';
import type { MemoryMessage, MemoryMessageInput, MemoryMessagePart, PlatformMemoryClientOptions } from './client';
import {
  attachToolResult,
  filePart,
  messageInput,
  partsOf,
  reasoningOf,
  reasoningPart,
  textOfParts,
  textPart,
  toolInvocationsOf,
  toolPart,
  promptOf,
} from './parts';

export type PlatformChatMessageHistoryOptions = PlatformMemoryClientOptions & {
  threadId: string;
  /** Who the memory belongs to. Defaults to `threadId`. */
  resourceId?: string;
  client?: PlatformMemoryClient;
};

export function toParts(message: BaseMessage): MemoryMessagePart[] {
  const parts: MemoryMessagePart[] = [];
  for (const block of message.contentBlocks) {
    if (block.type === 'text' && block.text) parts.push(textPart(block.text));
    else if (block.type === 'reasoning' && block.reasoning) parts.push(reasoningPart(block.reasoning));
    else if (block.type === 'tool_call') {
      parts.push(toolPart({ toolCallId: block.id ?? '', toolName: block.name, args: block.args }));
    } else if ((block.type === 'image' || block.type === 'file' || block.type === 'audio') && block.mimeType) {
      const data = 'data' in block && block.data ? block.data : 'url' in block ? block.url : undefined;
      if (typeof data === 'string') parts.push(filePart(data, block.mimeType));
    }
  }
  return parts;
}

/**
 * Human and AI messages become user/assistant messages with their parts; tool results
 * are attached to the AI message that called them.
 */
function toInputs(messages: BaseMessage[]): MemoryMessageInput[] {
  const inputs: MemoryMessageInput[] = [];
  for (const message of messages) {
    const type = message.getType();
    if (type === 'tool' && ToolMessage.isInstance(message)) {
      const result = typeof message.content === 'string' ? message.content : message.contentBlocks;
      for (const input of inputs) attachToolResult(input.parts ?? [], message.tool_call_id, result);
      continue;
    }
    const role = type === 'human' ? 'user' : type === 'ai' ? 'assistant' : null;
    const input = role && messageInput(role, toParts(message));
    if (input) inputs.push(input);
  }
  return inputs;
}

/** Replays a recalled message, including tool calls and their results, as LangChain messages. */
export function fromMemory(message: MemoryMessage): BaseMessage[] {
  if (message.role === 'system') return [new SystemMessage(message.content)];
  const parts = partsOf(message);
  if (message.role !== 'assistant') {
    const files = parts.filter(p => p.type === 'file');
    if (!files.length) return [new HumanMessage(textOfParts(parts))];
    return [
      new HumanMessage({
        contentBlocks: [
          ...(textOfParts(parts) ? [{ type: 'text' as const, text: textOfParts(parts) }] : []),
          ...files.map(f => ({ type: 'file' as const, data: f.data as string, mimeType: f.mimeType as string })),
        ],
      }),
    ];
  }

  // A tool call is only valid in history alongside its result.
  const results = toolInvocationsOf(parts).filter(t => t.state === 'result');
  const reasoning = reasoningOf(parts);
  const ai = new AIMessage({
    content: textOfParts(parts),
    tool_calls: results.map(t => ({ id: t.toolCallId, name: t.toolName, args: t.args as Record<string, unknown> })),
    ...(reasoning ? { additional_kwargs: { reasoning_content: reasoning } } : {}),
  });
  return [
    ai,
    ...results.map(
      t =>
        new ToolMessage({
          tool_call_id: t.toolCallId,
          name: t.toolName,
          content: typeof t.result === 'string' ? t.result : JSON.stringify(t.result ?? null),
        }),
    ),
  ];
}

/**
 * LangChain chat history backed by a hosted Platform Memory instance.
 *
 * `getMessages()` returns the instance's observations as a system message followed by
 * the unobserved message tail, so long conversations stay bounded. Human and AI messages
 * are saved with tool calls (and their results), reasoning, and files; observation runs on
 * the Platform.
 *
 * Limitation: LangChain reads chat history once before a turn and writes it once after, and
 * its callbacks can't rewrite the prompt, so a long tool loop within one turn is not compressed
 * mid-turn (unlike `PlatformMemory` and the AI SDK middleware). It is observed after the turn.
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
    return promptOf(context).flatMap(fromMemory);
  }

  async addMessage(message: BaseMessage): Promise<void> {
    await this.addMessages([message]);
  }

  async addMessages(messages: BaseMessage[]): Promise<void> {
    const inputs = toInputs(messages);
    if (inputs.length) {
      await this.#client.saveMessages(this.#threadId, { resourceId: this.#resourceId, messages: inputs });
    }
  }

  /** Deletes the thread from Platform Memory. */
  async clear(): Promise<void> {
    await this.#client.deleteThread(this.#threadId);
  }
}
