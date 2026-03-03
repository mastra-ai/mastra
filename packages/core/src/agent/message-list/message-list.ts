import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import type { LanguageModelV1Prompt, CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';
import type * as AIV4Type from '@internal/ai-sdk-v4';
import { v4 as randomUUID } from '@lukeed/uuid';

import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import type { IdGeneratorContext } from '../../types';
import { AIV4Adapter, AIV5Adapter } from './adapters';
import { CacheKeyGenerator } from './cache/CacheKeyGenerator';
import {
  aiV4CoreMessageToV1PromptMessage,
  aiV5ModelMessageToV2PromptMessage,
  coreContentToString,
  messagesAreEqual,
  inputToMastraDBMessage as convertInputToMastraDBMessage,
  aiV4UIMessagesToAIV4CoreMessages,
  aiV5UIMessagesToAIV5ModelMessages as convertAIV5UIToModelMessages,
  aiV4CoreMessagesToAIV5ModelMessages as convertAIV4CoreToAIV5ModelMessages,
  systemMessageToAIV4Core,
  StepContentExtractor,
} from './conversion';
import { TypeDetector } from './detection/TypeDetector';
import { MessageMerger } from './merge';
import { convertImageFilePart } from './prompt/convert-file';
import { convertToV1Messages } from './prompt/convert-to-mastra-v1';
import { downloadAssetsFromMessages } from './prompt/download-assets';
import { MessageStateManager } from './state';
import type {
  MastraDBMessage,
  MastraMessageV1,
  MessageSource,
  MemoryInfo,
  UIMessageWithMetadata,
  SerializedMessageListState,
} from './state';
import type { AIV5Type, AIV5ResponseMessage, MessageInput, MessageListInput } from './types';
import { ensureGeminiCompatibleMessages } from './utils/provider-compat';

export class MessageList {
  private messages: MastraDBMessage[] = [];

  // passed in by dev in input or context
  private systemMessages: AIV4Type.CoreSystemMessage[] = [];
  // passed in by us for a specific purpose, eg memory system message
  private taggedSystemMessages: Record<string, AIV4Type.CoreSystemMessage[]> = {};

  private memoryInfo: null | MemoryInfo = null;

  // Centralized state management for message tracking
  private stateManager = new MessageStateManager();

  // Legacy getters for backward compatibility - delegate to stateManager
  private get memoryMessages() {
    return this.stateManager.getMemoryMessages();
  }
  private get newUserMessages() {
    return this.stateManager.getUserMessages();
  }
  private get newResponseMessages() {
    return this.stateManager.getResponseMessages();
  }
  private get userContextMessages() {
    return this.stateManager.getContextMessages();
  }
  private get memoryMessagesPersisted() {
    return this.stateManager.getMemoryMessagesPersisted();
  }
  private get newUserMessagesPersisted() {
    return this.stateManager.getUserMessagesPersisted();
  }
  private get newResponseMessagesPersisted() {
    return this.stateManager.getResponseMessagesPersisted();
  }
  private get userContextMessagesPersisted() {
    return this.stateManager.getContextMessagesPersisted();
  }

  private generateMessageId?: (context?: IdGeneratorContext) => string;
  private _agentNetworkAppend = false;

  // Event recording for observability
  private isRecording = false;
  private recordedEvents: Array<{
    type: 'add' | 'addSystem' | 'removeByIds' | 'clear';
    source?: MessageSource;
    count?: number;
    ids?: string[];
    text?: string;
    tag?: string;
    message?: CoreMessageV4;
  }> = [];

  constructor({
    threadId,
    resourceId,
    generateMessageId,
    // @ts-expect-error Flag for agent network messages
    _agentNetworkAppend,
  }: { threadId?: string; resourceId?: string; generateMessageId?: (context?: IdGeneratorContext) => string } = {}) {
    if (threadId) {
      this.memoryInfo = { threadId, resourceId };
    }
    this.generateMessageId = generateMessageId;
    this._agentNetworkAppend = _agentNetworkAppend || false;
  }

  /**
   * Start recording mutations to the MessageList for observability/tracing
   */
  public startRecording(): void {
    this.isRecording = true;
    this.recordedEvents = [];
  }

  public hasRecordedEvents(): boolean {
    return this.recordedEvents.length > 0;
  }

  public getRecordedEvents(): Array<{
    type: 'add' | 'addSystem' | 'removeByIds' | 'clear';
    source?: MessageSource;
    count?: number;
    ids?: string[];
    text?: string;
    tag?: string;
    message?: CoreMessageV4;
  }> {
    const events = [...this.recordedEvents];
    return events;
  }

  /**
   * Stop recording and return the list of recorded events
   */
  public stopRecording(): Array<{
    type: 'add' | 'addSystem' | 'removeByIds' | 'clear';
    source?: MessageSource;
    count?: number;
    ids?: string[];
    text?: string;
    tag?: string;
    message?: CoreMessageV4;
  }> {
    this.isRecording = false;
    const events = this.getRecordedEvents();
    this.recordedEvents = [];
    return events;
  }

  public add(messages: MessageListInput, messageSource: MessageSource) {
    if (messageSource === `user`) messageSource = `input`;

    if (!messages) return this;
    const messageArray = Array.isArray(messages) ? messages : [messages];

    // Record event if recording is enabled
    if (this.isRecording) {
      this.recordedEvents.push({
        type: 'add',
        source: messageSource,
        count: messageArray.length,
      });
    }

    for (const message of messageArray) {
      this.addOne(
        typeof message === `string`
          ? {
              role: 'user',
              content: message,
            }
          : message,
        messageSource,
      );
    }
    return this;
  }

  public serialize(): SerializedMessageListState {
    return this.stateManager.serializeAll({
      messages: this.messages,
      systemMessages: this.systemMessages,
      taggedSystemMessages: this.taggedSystemMessages,
      memoryInfo: this.memoryInfo,
      agentNetworkAppend: this._agentNetworkAppend,
    });
  }

  /**
   * Custom serialization for tracing/observability spans.
   * Returns a clean representation with just the essential data,
   * excluding internal state tracking, methods, and implementation details.
   *
   * This is automatically called by the span serialization system when
   * a MessageList instance appears in span input/output/attributes.
   */
  public serializeForSpan(): {
    messages: Array<{ role: string; content: unknown }>;
    systemMessages: Array<{ role: string; content: unknown; tag?: string }>;
  } {
    const coreMessages = this.all.aiV4.core();

    return {
      messages: coreMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      systemMessages: [
        // Untagged first (base instructions)
        ...this.systemMessages.map(m => ({ role: m.role, content: m.content })),
        // Tagged after (contextual additions)
        ...Object.entries(this.taggedSystemMessages).flatMap(([tag, msgs]) =>
          msgs.map(m => ({ role: m.role, content: m.content, tag })),
        ),
      ],
    };
  }

  public deserialize(state: SerializedMessageListState) {
    const data = this.stateManager.deserializeAll(state);
    this.messages = data.messages;
    this.systemMessages = data.systemMessages;
    this.taggedSystemMessages = data.taggedSystemMessages;
    this.memoryInfo = data.memoryInfo;
    this._agentNetworkAppend = data.agentNetworkAppend;
    return this;
  }

  public makeMessageSourceChecker(): {
    memory: Set<string>;
    input: Set<string>;
    output: Set<string>;
    context: Set<string>;
    getSource: (message: MastraDBMessage) => MessageSource | null;
  } {
    return this.stateManager.createSourceChecker();
  }

  public getLatestUserContent(): string | null {
    const currentUserMessages = this.all.core().filter(m => m.role === 'user');
    const content = currentUserMessages.at(-1)?.content;
    if (!content) return null;
    return coreContentToString(content);
  }

  public get get() {
    return {
      all: this.all,
      remembered: this.remembered,
      input: this.input,
      response: this.response,
    };
  }
  public get getPersisted() {
    return {
      remembered: this.rememberedPersisted,
      input: this.inputPersisted,
      taggedSystemMessages: this.taggedSystemMessages,
      response: this.responsePersisted,
    };
  }

  public get clear() {
    return {
      all: {
        db: (): MastraDBMessage[] => {
          const allMessages = [...this.messages];
          this.messages = [];
          this.stateManager.clearAll();
          if (this.isRecording && allMessages.length > 0) {
            this.recordedEvents.push({
              type: 'clear',
              count: allMessages.length,
            });
          }
          return allMessages;
        },
      },
      input: {
        db: (): MastraDBMessage[] => {
          const userMessages = Array.from(this.stateManager.getUserMessages());
          this.messages = this.messages.filter(m => !this.stateManager.isUserMessage(m));
          this.stateManager.clearUserMessages();
          if (this.isRecording && userMessages.length > 0) {
            this.recordedEvents.push({
              type: 'clear',
              source: 'input',
              count: userMessages.length,
            });
          }
          return userMessages;
        },
      },
      response: {
        db: () => {
          const responseMessages = Array.from(this.stateManager.getResponseMessages());
          this.messages = this.messages.filter(m => !this.stateManager.isResponseMessage(m));
          this.stateManager.clearResponseMessages();
          if (this.isRecording && responseMessages.length > 0) {
            this.recordedEvents.push({
              type: 'clear',
              source: 'response',
              count: responseMessages.length,
            });
          }
          return responseMessages;
        },
      },
    };
  }

  /**
   * Remove messages by ID
   * @param ids - Array of message IDs to remove
   * @returns Array of removed messages
   */
  public removeByIds(ids: string[]): MastraDBMessage[] {
    const idsSet = new Set(ids);
    const removed: MastraDBMessage[] = [];
    this.messages = this.messages.filter(m => {
      if (idsSet.has(m.id)) {
        removed.push(m);
        this.stateManager.removeMessage(m);
        return false;
      }
      return true;
    });
    if (this.isRecording && removed.length > 0) {
      this.recordedEvents.push({
        type: 'removeByIds',
        ids,
        count: removed.length,
      });
    }
    return removed;
  }

  private all = {
    db: (): MastraDBMessage[] => this.messages,
    v1: (): MastraMessageV1[] => convertToV1Messages(this.all.db()),

    aiV5: {
      model: (): AIV5Type.ModelMessage[] => convertAIV5UIToModelMessages(this.all.aiV5.ui(), this.messages),
      ui: (): AIV5Type.UIMessage[] => this.all.db().map(AIV5Adapter.toUIMessage),

      // Used when calling AI SDK streamText/generateText
      prompt: (): AIV5Type.ModelMessage[] => {
        const systemMessages = convertAIV4CoreToAIV5ModelMessages(
          [...this.systemMessages, ...Object.values(this.taggedSystemMessages).flat()],
          `system`,
          this.createAdapterContext(),
          this.messages,
        );
        // Filter incomplete tool calls when sending messages TO the LLM
        const modelMessages = convertAIV5UIToModelMessages(this.all.aiV5.ui(), this.messages, true);

        const messages = [...systemMessages, ...modelMessages];

        return ensureGeminiCompatibleMessages(messages);
      },

      // Used for creating LLM prompt messages without AI SDK streamText/generateText
      llmPrompt: async (
        options: {
          downloadConcurrency?: number;
          downloadRetries?: number;
          supportedUrls?: Record<string, RegExp[]>;
        } = {
          downloadConcurrency: 10,
          downloadRetries: 3,
        },
      ): Promise<LanguageModelV2Prompt> => {
        // Filter incomplete tool calls when sending messages TO the LLM
        // Stored toModelOutput results from providerMetadata are applied automatically
        const modelMessages = convertAIV5UIToModelMessages(this.all.aiV5.ui(), this.messages, true);
        const systemMessages = convertAIV4CoreToAIV5ModelMessages(
          [...this.systemMessages, ...Object.values(this.taggedSystemMessages).flat()],
          `system`,
          this.createAdapterContext(),
          this.messages,
        );

        const downloadedAssets = await downloadAssetsFromMessages({
          messages: modelMessages,
          downloadConcurrency: options?.downloadConcurrency,
          downloadRetries: options?.downloadRetries,
          supportedUrls: options?.supportedUrls,
        });

        let messages = [...systemMessages, ...modelMessages];

        // Check if any messages have image/file content that needs processing
        const hasImageOrFileContent = modelMessages.some(
          message =>
            message.role === 'user' &&
            typeof message.content !== 'string' &&
            message.content.some(part => part.type === 'image' || part.type === 'file'),
        );

        if (hasImageOrFileContent) {
          messages = messages.map(message => {
            if (message.role === 'user') {
              if (typeof message.content === 'string') {
                return {
                  role: 'user' as const,
                  content: [{ type: 'text' as const, text: message.content }],
                  providerOptions: message.providerOptions,
                } as AIV5Type.ModelMessage;
              }

              const convertedContent = message.content
                .map(part => {
                  if (part.type === 'image' || part.type === 'file') {
                    return convertImageFilePart(part, downloadedAssets);
                  }
                  return part;
                })
                .filter(part => part.type !== 'text' || part.text !== '');

              return {
                role: 'user' as const,
                content: convertedContent,
                providerOptions: message.providerOptions,
              } as AIV5Type.ModelMessage;
            }

            return message;
          });
        }

        messages = ensureGeminiCompatibleMessages(messages);

        return messages.map(aiV5ModelMessageToV2PromptMessage);
      },
    },

    /* @deprecated use list.get.all.aiV4.prompt() instead */
    prompt: () => this.all.aiV4.prompt(),
    /* @deprecated use list.get.all.aiV4.ui() */
    ui: (): UIMessageWithMetadata[] => this.all.db().map(AIV4Adapter.toUIMessage),
    /* @deprecated use list.get.all.aiV4.core() */
    core: (): CoreMessageV4[] => aiV4UIMessagesToAIV4CoreMessages(this.all.aiV4.ui()),
    aiV4: {
      ui: (): UIMessageWithMetadata[] => this.all.db().map(AIV4Adapter.toUIMessage),
      core: (): CoreMessageV4[] => aiV4UIMessagesToAIV4CoreMessages(this.all.aiV4.ui()),

      // Used when calling AI SDK streamText/generateText
      prompt: () => {
        const coreMessages = this.all.aiV4.core();
        const messages = [...this.systemMessages, ...Object.values(this.taggedSystemMessages).flat(), ...coreMessages];

        return ensureGeminiCompatibleMessages(messages);
      },

      // Used for creating LLM prompt messages without AI SDK streamText/generateText
      llmPrompt: (): LanguageModelV1Prompt => {
        const coreMessages = this.all.aiV4.core();

        const systemMessages = [...this.systemMessages, ...Object.values(this.taggedSystemMessages).flat()];
        let messages = [...systemMessages, ...coreMessages];

        messages = ensureGeminiCompatibleMessages(messages);

        return messages.map(aiV4CoreMessageToV1PromptMessage);
      },
    },
  };

  private remembered = {
    db: () => this.messages.filter(m => this.memoryMessages.has(m)),
    v1: () => convertToV1Messages(this.remembered.db()),

    aiV5: {
      model: () => convertAIV5UIToModelMessages(this.remembered.aiV5.ui(), this.messages),
      ui: (): AIV5Type.UIMessage[] => this.remembered.db().map(AIV5Adapter.toUIMessage),
    },

    /* @deprecated use list.get.remembered.aiV4.ui() */
    ui: (): UIMessageWithMetadata[] => this.remembered.db().map(AIV4Adapter.toUIMessage),
    /* @deprecated use list.get.remembered.aiV4.core() */
    core: (): CoreMessageV4[] => aiV4UIMessagesToAIV4CoreMessages(this.all.aiV4.ui()),
    aiV4: {
      ui: (): UIMessageWithMetadata[] => this.remembered.db().map(AIV4Adapter.toUIMessage),
      core: (): CoreMessageV4[] => aiV4UIMessagesToAIV4CoreMessages(this.all.aiV4.ui()),
    },
  };
  private rememberedPersisted = {
    db: () => this.all.db().filter(m => this.memoryMessagesPersisted.has(m)),
    v1: () => convertToV1Messages(this.rememberedPersisted.db()),

    aiV5: {
      model: () => convertAIV5UIToModelMessages(this.rememberedPersisted.aiV5.ui(), this.messages),
      ui: (): AIV5Type.UIMessage[] => this.rememberedPersisted.db().map(AIV5Adapter.toUIMessage),
    },

    /* @deprecated use list.getPersisted.remembered.aiV4.ui() */
    ui: () => this.rememberedPersisted.db().map(AIV4Adapter.toUIMessage),
    /* @deprecated use list.getPersisted.remembered.aiV4.core() */
    core: () => aiV4UIMessagesToAIV4CoreMessages(this.rememberedPersisted.ui()),
    aiV4: {
      ui: (): UIMessageWithMetadata[] => this.rememberedPersisted.db().map(AIV4Adapter.toUIMessage),
      core: (): CoreMessageV4[] => aiV4UIMessagesToAIV4CoreMessages(this.rememberedPersisted.aiV4.ui()),
    },
  };

  private input = {
    db: () => this.messages.filter(m => this.newUserMessages.has(m)),
    v1: () => convertToV1Messages(this.input.db()),

    aiV5: {
      model: () => convertAIV5UIToModelMessages(this.input.aiV5.ui(), this.messages),
      ui: (): AIV5Type.UIMessage[] => this.input.db().map(AIV5Adapter.toUIMessage),
    },

    /* @deprecated use list.get.input.aiV4.ui() instead */
    ui: () => this.input.db().map(AIV4Adapter.toUIMessage),
    /* @deprecated use list.get.core.aiV4.ui() instead */
    core: () => aiV4UIMessagesToAIV4CoreMessages(this.input.ui()),
    aiV4: {
      ui: (): UIMessageWithMetadata[] => this.input.db().map(AIV4Adapter.toUIMessage),
      core: (): CoreMessageV4[] => aiV4UIMessagesToAIV4CoreMessages(this.input.aiV4.ui()),
    },
  };
  private inputPersisted = {
    db: (): MastraDBMessage[] => this.messages.filter(m => this.newUserMessagesPersisted.has(m)),
    v1: (): MastraMessageV1[] => convertToV1Messages(this.inputPersisted.db()),

    aiV5: {
      model: () => convertAIV5UIToModelMessages(this.inputPersisted.aiV5.ui(), this.messages),
      ui: (): AIV5Type.UIMessage[] => this.inputPersisted.db().map(AIV5Adapter.toUIMessage),
    },

    /* @deprecated use list.getPersisted.input.aiV4.ui() */
    ui: (): UIMessageWithMetadata[] => this.inputPersisted.db().map(AIV4Adapter.toUIMessage),
    /* @deprecated use list.getPersisted.input.aiV4.core() */
    core: () => aiV4UIMessagesToAIV4CoreMessages(this.inputPersisted.ui()),
    aiV4: {
      ui: (): UIMessageWithMetadata[] => this.inputPersisted.db().map(AIV4Adapter.toUIMessage),
      core: (): CoreMessageV4[] => aiV4UIMessagesToAIV4CoreMessages(this.inputPersisted.aiV4.ui()),
    },
  };

  private response = {
    db: (): MastraDBMessage[] => this.messages.filter(m => this.newResponseMessages.has(m)),
    v1: (): MastraMessageV1[] => convertToV1Messages(this.response.db()),

    aiV5: {
      ui: (): AIV5Type.UIMessage[] => this.response.db().map(AIV5Adapter.toUIMessage),
      model: (): AIV5ResponseMessage[] =>
        convertAIV5UIToModelMessages(this.response.aiV5.ui(), this.messages).filter(
          m => m.role === `tool` || m.role === `assistant`,
        ),
      modelContent: (stepNumber?: number): AIV5Type.StepResult<any>['content'] => {
        if (typeof stepNumber === 'number') {
          // Delegate to StepContentExtractor for step-specific content extraction
          return StepContentExtractor.extractStepContent(
            this.response.aiV5.ui(),
            stepNumber,
            this.response.aiV5.stepContent,
          );
        }

        return this.response.aiV5.model().map(this.response.aiV5.stepContent).flat();
      },
      stepContent: (message?: AIV5Type.ModelMessage): AIV5Type.StepResult<any>['content'] => {
        // Delegate to StepContentExtractor for content conversion
        return StepContentExtractor.convertToStepContent(message, this.messages, () =>
          this.response.aiV5.model().at(-1),
        );
      },
    },

    aiV4: {
      ui: (): UIMessageWithMetadata[] => this.response.db().map(AIV4Adapter.toUIMessage),
      core: (): CoreMessageV4[] => aiV4UIMessagesToAIV4CoreMessages(this.response.aiV4.ui()),
    },
  };
  private responsePersisted = {
    db: (): MastraDBMessage[] => this.messages.filter(m => this.newResponseMessagesPersisted.has(m)),

    aiV5: {
      model: () => convertAIV5UIToModelMessages(this.responsePersisted.aiV5.ui(), this.messages),
      ui: (): AIV5Type.UIMessage[] => this.responsePersisted.db().map(AIV5Adapter.toUIMessage),
    },

    /* @deprecated use list.getPersisted.response.aiV4.ui() */
    ui: (): UIMessageWithMetadata[] => this.responsePersisted.db().map(AIV4Adapter.toUIMessage),
    aiV4: {
      ui: (): UIMessageWithMetadata[] => this.responsePersisted.db().map(AIV4Adapter.toUIMessage),
      core: (): CoreMessageV4[] => aiV4UIMessagesToAIV4CoreMessages(this.responsePersisted.aiV4.ui()),
    },
  };

  public drainUnsavedMessages(): MastraDBMessage[] {
    const messages = this.messages.filter(m => this.newUserMessages.has(m) || this.newResponseMessages.has(m));
    this.newUserMessages.clear();
    this.newResponseMessages.clear();
    return messages;
  }

  public getEarliestUnsavedMessageTimestamp(): number | undefined {
    const unsavedMessages = this.messages.filter(m => this.newUserMessages.has(m) || this.newResponseMessages.has(m));
    if (unsavedMessages.length === 0) return undefined;
    // Find the earliest createdAt among unsaved messages
    return Math.min(...unsavedMessages.map(m => new Date(m.createdAt).getTime()));
  }

  /**
   * Check if a message is a new user or response message that should be saved.
   * Checks by message ID to handle cases where the message object may be a copy.
   */
  public isNewMessage(messageOrId: MastraDBMessage | string): boolean {
    return this.stateManager.isNewMessage(messageOrId);
  }

  public getSystemMessages(tag?: string): CoreMessageV4[] {
    if (tag) {
      return this.taggedSystemMessages[tag] || [];
    }
    return this.systemMessages;
  }

  /**
   * Get all system messages (both tagged and untagged)
   * @returns Array of all system messages
   */
  public getAllSystemMessages(): CoreMessageV4[] {
    return [...this.systemMessages, ...Object.values(this.taggedSystemMessages).flat()];
  }

  /**
   * Clear system messages, optionally for a specific tag
   * @param tag - If provided, only clears messages with this tag. Otherwise clears untagged messages.
   */
  public clearSystemMessages(tag?: string): this {
    if (tag) {
      delete this.taggedSystemMessages[tag];
    } else {
      this.systemMessages = [];
    }
    return this;
  }

  /**
   * Replace all system messages with new ones
   * This clears both tagged and untagged system messages and replaces them with the provided array
   * @param messages - Array of system messages to set
   */
  public replaceAllSystemMessages(messages: CoreMessageV4[]): this {
    // Clear existing system messages
    this.systemMessages = [];
    this.taggedSystemMessages = {};

    // Add all new messages as untagged (processors don't need to preserve tags)
    for (const message of messages) {
      if (message.role === 'system') {
        this.systemMessages.push(message);
      }
    }

    return this;
  }

  public addSystem(
    messages:
      | CoreMessageV4
      | CoreMessageV4[]
      | AIV5Type.ModelMessage
      | AIV5Type.ModelMessage[]
      | MastraDBMessage
      | MastraDBMessage[]
      | string
      | string[]
      | null,
    tag?: string,
  ) {
    if (!messages) return this;
    for (const message of Array.isArray(messages) ? messages : [messages]) {
      this.addOneSystem(message, tag);
    }
    return this;
  }

  private addOneSystem(message: CoreMessageV4 | AIV5Type.ModelMessage | MastraDBMessage | string, tag?: string) {
    const coreMessage = systemMessageToAIV4Core(message);

    if (coreMessage.role !== `system`) {
      throw new Error(
        `Expected role "system" but saw ${coreMessage.role} for message ${JSON.stringify(coreMessage, null, 2)}`,
      );
    }

    if (tag && !this.isDuplicateSystem(coreMessage, tag)) {
      this.taggedSystemMessages[tag] ||= [];
      this.taggedSystemMessages[tag].push(coreMessage);
      if (this.isRecording) {
        this.recordedEvents.push({
          type: 'addSystem',
          tag,
          message: coreMessage,
        });
      }
    } else if (!tag && !this.isDuplicateSystem(coreMessage)) {
      this.systemMessages.push(coreMessage);
      if (this.isRecording) {
        this.recordedEvents.push({
          type: 'addSystem',
          message: coreMessage,
        });
      }
    }
  }

  private isDuplicateSystem(message: CoreMessageV4, tag?: string) {
    if (tag) {
      if (!this.taggedSystemMessages[tag]) return false;
      return this.taggedSystemMessages[tag].some(
        m =>
          CacheKeyGenerator.fromAIV4CoreMessageContent(m.content) ===
          CacheKeyGenerator.fromAIV4CoreMessageContent(message.content),
      );
    }
    return this.systemMessages.some(
      m =>
        CacheKeyGenerator.fromAIV4CoreMessageContent(m.content) ===
        CacheKeyGenerator.fromAIV4CoreMessageContent(message.content),
    );
  }

  private getMessageById(id: string) {
    return this.messages.find(m => m.id === id);
  }

  private shouldReplaceMessage(message: MastraDBMessage): { exists: boolean; shouldReplace?: boolean; id?: string } {
    if (!this.messages.length) return { exists: false };

    if (!(`id` in message) || !message?.id) {
      return { exists: false };
    }

    const existingMessage = this.getMessageById(message.id);
    if (!existingMessage) return { exists: false };

    return {
      exists: true,
      shouldReplace: !messagesAreEqual(existingMessage, message),
      id: existingMessage.id,
    };
  }

  private addOne(message: MessageInput, messageSource: MessageSource) {
    if (
      (!(`content` in message) ||
        (!message.content &&
          // allow empty strings
          typeof message.content !== 'string')) &&
      (!(`parts` in message) || !message.parts)
    ) {
      throw new MastraError({
        id: 'INVALID_MESSAGE_CONTENT',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Message with role "${message.role}" must have either a 'content' property (string or array) or a 'parts' property (array) that is not empty, null, or undefined. Received message: ${JSON.stringify(message, null, 2)}`,
        details: {
          role: message.role as string,
          messageSource,
          hasContent: 'content' in message,
          hasParts: 'parts' in message,
        },
      });
    }

    if (message.role === `system`) {
      // In the past system messages were accidentally stored in the db. these should be ignored because memory is not supposed to store system messages.
      if (messageSource === `memory`) return null;

      // Check if the message is in a supported format for system messages
      const isSupportedSystemFormat =
        TypeDetector.isAIV4CoreMessage(message) ||
        TypeDetector.isAIV5CoreMessage(message) ||
        TypeDetector.isMastraDBMessage(message);

      if (isSupportedSystemFormat) {
        return this.addSystem(message);
      }

      // if we didn't add the message and we didn't ignore this intentionally, then it's a problem!
      throw new MastraError({
        id: 'INVALID_SYSTEM_MESSAGE_FORMAT',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Invalid system message format. System messages must be CoreMessage format with 'role' and 'content' properties. The content should be a string or valid content array.`,
        details: {
          messageSource,
          receivedMessage: JSON.stringify(message, null, 2),
        },
      });
    }

    const messageV2 = convertInputToMastraDBMessage(message, messageSource, this.createAdapterContext());

    const { exists, shouldReplace, id } = this.shouldReplaceMessage(messageV2);

    const latestMessage = this.messages.at(-1);

    if (messageSource === `memory`) {
      for (const existingMessage of this.messages) {
        // don't double store any messages
        if (messagesAreEqual(existingMessage, messageV2)) {
          return;
        }
      }
    }
    // If the last message is an assistant message and the new message is also an assistant message, merge them together and update tool calls with results
    // Use MessageMerger to handle the complex merge logic
    const isLatestFromMemory = latestMessage ? this.memoryMessages.has(latestMessage) : false;
    const shouldMerge = MessageMerger.shouldMerge(
      latestMessage,
      messageV2,
      messageSource,
      isLatestFromMemory,
      this._agentNetworkAppend,
    );

    if (shouldMerge && latestMessage) {
      // Delegate merge logic to MessageMerger
      MessageMerger.merge(latestMessage, messageV2);

      // If latest message gets appended to, it should be added to the proper source
      this.pushMessageToSource(latestMessage, messageSource);
    }
    // Else the last message and this message are not both assistant messages OR an existing message has been updated and should be replaced. add a new message to the array or update an existing one.
    else {
      let existingIndex = -1;
      if (shouldReplace) {
        existingIndex = this.messages.findIndex(m => m.id === id);
      }
      const existingMessage = existingIndex !== -1 && this.messages[existingIndex];

      if (shouldReplace && existingMessage) {
        // If the existing message is sealed (e.g., after observation), don't replace it.
        // Instead, generate a new ID for the incoming message and add it as a new message.
        if (MessageMerger.isSealed(existingMessage)) {
          // Find the last part with sealedAt metadata in the EXISTING message.
          // The existing message has the seal boundary marker from insertObservationMarker.
          const existingParts = existingMessage.content?.parts || [];
          let sealedPartCount = 0;

          for (let i = existingParts.length - 1; i >= 0; i--) {
            const part = existingParts[i] as { metadata?: { mastra?: { sealedAt?: number } } };
            if (part?.metadata?.mastra?.sealedAt) {
              // The seal is at index i, so sealed content is parts 0 through i (inclusive)
              sealedPartCount = i + 1;
              break;
            }
          }

          // If no sealedAt found, use the entire existing message length as the boundary
          if (sealedPartCount === 0) {
            sealedPartCount = existingParts.length;
          }

          // Get parts from incoming message that are beyond the sealed boundary
          const incomingParts = messageV2.content.parts;

          let newParts: typeof incomingParts;

          if (incomingParts.length <= sealedPartCount) {
            // Incoming message has fewer or equal parts than the sealed boundary.
            // Check if these are truly stale (same content as the sealed message) or
            // new content flushed independently (e.g., text deltas flushed with the
            // same messageId but only containing a text part).
            if (messagesAreEqual(existingMessage, messageV2)) {
              // Stale message, ignore - don't replace, don't create new
              return this;
            }
            // Not stale — these are fresh parts (e.g., a text flush). Treat all as new.
            newParts = incomingParts;
          } else {
            newParts = incomingParts.slice(sealedPartCount);
          }

          // Only create a new message if there are actually new parts
          if (newParts.length > 0) {
            // Generate a new ID for the incoming message
            messageV2.id = this.generateMessageId?.({ idType: 'message', source: 'memory' }) ?? randomUUID();
            // Replace the parts with only the new ones
            messageV2.content.parts = newParts;
            // Ensure the new message has a timestamp after the sealed message
            if (messageV2.createdAt <= existingMessage.createdAt) {
              messageV2.createdAt = new Date(existingMessage.createdAt.getTime() + 1);
            }
            this.messages.push(messageV2);
          }
          // If no new parts, don't add anything (the sealed message already has all the content)
        } else {
          const isExistingFromMemory = this.memoryMessages.has(existingMessage);
          const shouldMergeIntoExisting = MessageMerger.shouldMerge(
            existingMessage,
            messageV2,
            messageSource,
            isExistingFromMemory,
            this._agentNetworkAppend,
          );
          if (shouldMergeIntoExisting) {
            MessageMerger.merge(existingMessage, messageV2);
            this.pushMessageToSource(existingMessage, messageSource);
            // Sort messages and return early — existingMessage stays in messages[] and its Sets
            this.messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
            return this;
          }
          this.messages[existingIndex] = messageV2;
        }
      } else if (!exists) {
        this.messages.push(messageV2);
      }

      this.pushMessageToSource(messageV2, messageSource);
    }

    // make sure messages are always stored in order of when they were created!
    this.messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return this;
  }

  private pushMessageToSource(messageV2: MastraDBMessage, messageSource: MessageSource) {
    this.stateManager.addToSource(messageV2, messageSource);
  }

  private lastCreatedAt?: number;
  // this makes sure messages added in order will always have a date atleast 1ms apart.
  private generateCreatedAt(messageSource: MessageSource, start?: unknown): Date {
    // Normalize timestamp
    const startDate: Date | undefined =
      start instanceof Date
        ? start
        : typeof start === 'string' || typeof start === 'number'
          ? new Date(start)
          : undefined;

    if (startDate && !this.lastCreatedAt) {
      this.lastCreatedAt = startDate.getTime();
      return startDate;
    }

    if (startDate && messageSource === `memory`) {
      // Preserve user-provided timestamps for memory messages to avoid re-ordering
      // Messages without timestamps will fall through to get generated incrementing timestamps
      return startDate;
    }

    const now = new Date();
    const nowTime = startDate?.getTime() || now.getTime();
    // find the latest createdAt in all stored messages
    const lastTime = this.messages.reduce((p, m) => {
      if (m.createdAt.getTime() > p) return m.createdAt.getTime();
      return p;
    }, this.lastCreatedAt || 0);

    // make sure our new message is created later than the latest known message time
    // it's expected that messages are added to the list in order if they don't have a createdAt date on them
    if (nowTime <= lastTime) {
      const newDate = new Date(lastTime + 1);
      this.lastCreatedAt = newDate.getTime();
      return newDate;
    }

    this.lastCreatedAt = nowTime;
    return now;
  }

  private newMessageId(role?: string): string {
    if (this.generateMessageId) {
      return this.generateMessageId({
        idType: 'message',
        source: 'agent',
        threadId: this.memoryInfo?.threadId,
        resourceId: this.memoryInfo?.resourceId,
        role,
      });
    }
    return randomUUID();
  }

  private createAdapterContext() {
    return {
      memoryInfo: this.memoryInfo,
      newMessageId: () => this.newMessageId(),
      generateCreatedAt: (messageSource: MessageSource, start?: unknown) =>
        this.generateCreatedAt(messageSource, start),
      dbMessages: this.messages,
    };
  }
}
