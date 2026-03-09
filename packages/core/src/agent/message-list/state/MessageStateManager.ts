import type { CoreSystemMessage } from '@internal/ai-sdk-v4';

import { serializeMessages, deserializeMessages } from './serialization';
import type { SerializedMessage } from './serialization';
import type { MastraDBMessage, MessageSource, MemoryInfo } from './types';

// Re-export for backward compatibility
export type { MessageSource };

/**
 * MessageStateManager - Manages the state of messages in a MessageList
 *
 * Handles:
 * - Tracking messages by their source (memory, input, response, context)
 * - Tracking which messages have been persisted
 * - Providing efficient lookups for message categorization
 *
 * This replaces the 8 Sets in the original MessageList with a more manageable interface.
 */
export class MessageStateManager {
  // Messages tracked by source
  private memoryMessages = new Set<MastraDBMessage>();
  private newUserMessages = new Set<MastraDBMessage>();
  private newResponseMessages = new Set<MastraDBMessage>();
  private userContextMessages = new Set<MastraDBMessage>();

  // Persisted message tracking
  private memoryMessagesPersisted = new Set<MastraDBMessage>();
  private newUserMessagesPersisted = new Set<MastraDBMessage>();
  private newResponseMessagesPersisted = new Set<MastraDBMessage>();
  private userContextMessagesPersisted = new Set<MastraDBMessage>();

  /**
   * Add a message to the appropriate source set and persisted set
   */
  addToSource(message: MastraDBMessage, source: MessageSource): void {
    switch (source) {
      case 'memory':
        this.memoryMessages.add(message);
        this.memoryMessagesPersisted.add(message);
        break;
      case 'response':
        this.newResponseMessages.add(message);
        this.newResponseMessagesPersisted.add(message);
        // Handle case where a client-side tool response was added as user input
        if (this.newUserMessages.has(message)) {
          this.newUserMessages.delete(message);
        }
        break;
      case 'input':
      case 'user': // deprecated alias for input
        this.newUserMessages.add(message);
        this.newUserMessagesPersisted.add(message);
        break;
      case 'context':
        this.userContextMessages.add(message);
        this.userContextMessagesPersisted.add(message);
        break;
      default:
        throw new Error(`Missing message source for message ${message}`);
    }
  }

  /**
   * Check if a message belongs to the memory source
   */
  isMemoryMessage(message: MastraDBMessage): boolean {
    return this.memoryMessages.has(message);
  }

  /**
   * Check if a message belongs to the input source
   */
  isUserMessage(message: MastraDBMessage): boolean {
    return this.newUserMessages.has(message);
  }

  /**
   * Check if a message belongs to the response source
   */
  isResponseMessage(message: MastraDBMessage): boolean {
    return this.newResponseMessages.has(message);
  }

  /**
   * Check if a message belongs to the context source
   */
  isContextMessage(message: MastraDBMessage): boolean {
    return this.userContextMessages.has(message);
  }

  /**
   * Get all memory messages
   */
  getMemoryMessages(): Set<MastraDBMessage> {
    return this.memoryMessages;
  }

  /**
   * Get all user/input messages
   */
  getUserMessages(): Set<MastraDBMessage> {
    return this.newUserMessages;
  }

  /**
   * Get all response messages
   */
  getResponseMessages(): Set<MastraDBMessage> {
    return this.newResponseMessages;
  }

  /**
   * Get all context messages
   */
  getContextMessages(): Set<MastraDBMessage> {
    return this.userContextMessages;
  }

  /**
   * Get persisted memory messages
   */
  getMemoryMessagesPersisted(): Set<MastraDBMessage> {
    return this.memoryMessagesPersisted;
  }

  /**
   * Get persisted user/input messages
   */
  getUserMessagesPersisted(): Set<MastraDBMessage> {
    return this.newUserMessagesPersisted;
  }

  /**
   * Get persisted response messages
   */
  getResponseMessagesPersisted(): Set<MastraDBMessage> {
    return this.newResponseMessagesPersisted;
  }

  /**
   * Get persisted context messages
   */
  getContextMessagesPersisted(): Set<MastraDBMessage> {
    return this.userContextMessagesPersisted;
  }

  /**
   * Remove a message from all source sets
   */
  removeMessage(message: MastraDBMessage): void {
    this.memoryMessages.delete(message);
    this.newUserMessages.delete(message);
    this.newResponseMessages.delete(message);
    this.userContextMessages.delete(message);
  }

  /**
   * Clear all user messages
   */
  clearUserMessages(): void {
    this.newUserMessages.clear();
  }

  /**
   * Clear all response messages
   */
  clearResponseMessages(): void {
    this.newResponseMessages.clear();
  }

  /**
   * Clear all context messages
   */
  clearContextMessages(): void {
    this.userContextMessages.clear();
  }

  /**
   * Clear all messages from all sources (but not persisted tracking)
   */
  clearAll(): void {
    this.newUserMessages.clear();
    this.newResponseMessages.clear();
    this.userContextMessages.clear();
  }

  /**
   * Create a lookup function to determine message source
   */
  createSourceChecker(): {
    memory: Set<string>;
    input: Set<string>;
    output: Set<string>;
    context: Set<string>;
    getSource: (message: MastraDBMessage) => MessageSource | null;
  } {
    const sources = {
      memory: new Set(Array.from(this.memoryMessages.values()).map(m => m.id)),
      output: new Set(Array.from(this.newResponseMessages.values()).map(m => m.id)),
      input: new Set(Array.from(this.newUserMessages.values()).map(m => m.id)),
      context: new Set(Array.from(this.userContextMessages.values()).map(m => m.id)),
    };

    return {
      ...sources,
      getSource: (msg: MastraDBMessage): MessageSource | null => {
        if (sources.memory.has(msg.id)) return 'memory';
        if (sources.input.has(msg.id)) return 'input';
        if (sources.output.has(msg.id)) return 'response';
        if (sources.context.has(msg.id)) return 'context';
        return null;
      },
    };
  }

  /**
   * Check if a message is a new (unsaved) user or response message by ID
   */
  isNewMessage(messageOrId: MastraDBMessage | string): boolean {
    const id = typeof messageOrId === 'string' ? messageOrId : messageOrId.id;

    // Check by object reference first (fast path)
    if (typeof messageOrId !== 'string') {
      if (this.newUserMessages.has(messageOrId) || this.newResponseMessages.has(messageOrId)) {
        return true;
      }
    }

    // Check by ID (handles copies)
    return (
      Array.from(this.newUserMessages).some(m => m.id === id) ||
      Array.from(this.newResponseMessages).some(m => m.id === id)
    );
  }

  /**
   * Serialize source tracking state (message IDs only)
   */
  private serializeSourceTracking(): {
    memoryMessages: string[];
    newUserMessages: string[];
    newResponseMessages: string[];
    userContextMessages: string[];
    memoryMessagesPersisted: string[];
    newUserMessagesPersisted: string[];
    newResponseMessagesPersisted: string[];
    userContextMessagesPersisted: string[];
  } {
    const serializeSet = (set: Set<MastraDBMessage>) => Array.from(set).map(value => value.id);

    return {
      memoryMessages: serializeSet(this.memoryMessages),
      newUserMessages: serializeSet(this.newUserMessages),
      newResponseMessages: serializeSet(this.newResponseMessages),
      userContextMessages: serializeSet(this.userContextMessages),
      memoryMessagesPersisted: serializeSet(this.memoryMessagesPersisted),
      newUserMessagesPersisted: serializeSet(this.newUserMessagesPersisted),
      newResponseMessagesPersisted: serializeSet(this.newResponseMessagesPersisted),
      userContextMessagesPersisted: serializeSet(this.userContextMessagesPersisted),
    };
  }

  /**
   * Deserialize source tracking state from message IDs
   */
  private deserializeSourceTracking(
    state: ReturnType<typeof this.serializeSourceTracking>,
    messages: MastraDBMessage[],
  ): void {
    const deserializeSet = (ids: string[]) =>
      new Set(ids.map(id => messages.find(m => m.id === id)).filter(Boolean) as MastraDBMessage[]);

    this.memoryMessages = deserializeSet(state.memoryMessages);
    this.newUserMessages = deserializeSet(state.newUserMessages);
    this.newResponseMessages = deserializeSet(state.newResponseMessages);
    this.userContextMessages = deserializeSet(state.userContextMessages);
    this.memoryMessagesPersisted = deserializeSet(state.memoryMessagesPersisted);
    this.newUserMessagesPersisted = deserializeSet(state.newUserMessagesPersisted);
    this.newResponseMessagesPersisted = deserializeSet(state.newResponseMessagesPersisted);
    this.userContextMessagesPersisted = deserializeSet(state.userContextMessagesPersisted);
  }

  /**
   * Serialize all MessageList state for workflow suspend/resume
   */
  serializeAll(data: {
    messages: MastraDBMessage[];
    systemMessages: CoreSystemMessage[];
    taggedSystemMessages: Record<string, CoreSystemMessage[]>;
    memoryInfo: MemoryInfo | null;
    agentNetworkAppend: boolean;
  }): SerializedMessageListState {
    return {
      messages: serializeMessages(data.messages),
      systemMessages: data.systemMessages,
      taggedSystemMessages: data.taggedSystemMessages,
      memoryInfo: data.memoryInfo,
      _agentNetworkAppend: data.agentNetworkAppend,
      ...this.serializeSourceTracking(),
    };
  }

  /**
   * Deserialize all MessageList state from workflow suspend/resume
   */
  deserializeAll(state: SerializedMessageListState): {
    messages: MastraDBMessage[];
    systemMessages: CoreSystemMessage[];
    taggedSystemMessages: Record<string, CoreSystemMessage[]>;
    memoryInfo: MemoryInfo | null;
    agentNetworkAppend: boolean;
  } {
    const messages = deserializeMessages(state.messages);

    this.deserializeSourceTracking(
      {
        memoryMessages: state.memoryMessages,
        newUserMessages: state.newUserMessages,
        newResponseMessages: state.newResponseMessages,
        userContextMessages: state.userContextMessages,
        memoryMessagesPersisted: state.memoryMessagesPersisted,
        newUserMessagesPersisted: state.newUserMessagesPersisted,
        newResponseMessagesPersisted: state.newResponseMessagesPersisted,
        userContextMessagesPersisted: state.userContextMessagesPersisted,
      },
      messages,
    );

    return {
      messages,
      systemMessages: state.systemMessages,
      taggedSystemMessages: state.taggedSystemMessages,
      memoryInfo: state.memoryInfo,
      agentNetworkAppend: state._agentNetworkAppend,
    };
  }
}

/**
 * Serialized form of the complete MessageList state
 */
export interface SerializedMessageListState {
  messages: SerializedMessage[];
  systemMessages: CoreSystemMessage[];
  taggedSystemMessages: Record<string, CoreSystemMessage[]>;
  memoryInfo: MemoryInfo | null;
  _agentNetworkAppend: boolean;
  memoryMessages: string[];
  newUserMessages: string[];
  newResponseMessages: string[];
  userContextMessages: string[];
  memoryMessagesPersisted: string[];
  newUserMessagesPersisted: string[];
  newResponseMessagesPersisted: string[];
  userContextMessagesPersisted: string[];
}
