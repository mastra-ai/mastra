import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import type { ToolInvocationUIPart } from '@ai-sdk/ui-utils-v5';
import { convertToCoreMessages as convertToCoreMessagesV4 } from '@internal/ai-sdk-v4';
import type {
  LanguageModelV1Message,
  IdGenerator,
  LanguageModelV1Prompt,
  CoreMessage as CoreMessageV4,
  UIMessage as UIMessageV4,
  ToolInvocation as ToolInvocationV4,
} from '@internal/ai-sdk-v4';
import type * as AIV4Type from '@internal/ai-sdk-v4';
import { v4 as randomUUID } from '@lukeed/uuid';
import * as AIV5 from 'ai-v5';

import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import { DefaultGeneratedFileWithType } from '../../stream/aisdk/v5/file';
import { convertImageFilePart } from './prompt/convert-file';
import { convertToV1Messages } from './prompt/convert-to-mastra-v1';
import { convertDataContentToBase64String } from './prompt/data-content';
import { downloadAssetsFromMessages } from './prompt/download-assets';
import {
  categorizeFileData,
  createDataUri,
  getImageCacheKey,
  imageContentToString,
  parseDataUri,
} from './prompt/image-utils';
import type { AIV5Type } from './types';
import { ensureGeminiCompatibleMessages } from './utils/ai-v5/gemini-compatibility';
import { getToolName } from './utils/ai-v5/tool';

type AIV5LanguageModelV2Message = LanguageModelV2Prompt[0];
export type AIV5ResponseMessage = AIV5Type.AssistantModelMessage | AIV5Type.ToolModelMessage;

type MastraMessageShared = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  createdAt: Date;
  threadId?: string;
  resourceId?: string;
  type?: string;
};

export type MastraMessageContentV2 = {
  format: 2; // format 2 === UIMessage in AI SDK v4
  parts: (UIMessageV4['parts'][number] & { providerMetadata?: AIV5Type.ProviderMetadata })[]; // add optional prov meta for AIV5 - v4 doesn't track this, and we're storing mmv2 in the db, so we need to extend
  experimental_attachments?: UIMessageV4['experimental_attachments'];
  content?: UIMessageV4['content'];
  toolInvocations?: UIMessageV4['toolInvocations'];
  reasoning?: UIMessageV4['reasoning'];
  annotations?: UIMessageV4['annotations'];
  metadata?: Record<string, unknown>;
};

// maps to AI SDK V4 UIMessage
export type MastraDBMessage = MastraMessageShared & {
  content: MastraMessageContentV2;
};

// maps to AI SDK V5 UIMessage
export type MastraMessageV1 = {
  id: string;
  content: string | CoreMessageV4['content'];
  role: 'system' | 'user' | 'assistant' | 'tool';
  createdAt: Date;
  threadId?: string;
  resourceId?: string;
  toolCallIds?: string[];
  toolCallArgs?: Record<string, unknown>[];
  toolNames?: string[];
  type: 'text' | 'tool-call' | 'tool-result';
};

// Extend UIMessage to include optional metadata field
export type UIMessageWithMetadata = UIMessageV4 & {
  metadata?: Record<string, unknown>;
};

export type MessageInput =
  | AIV5Type.UIMessage
  | AIV5Type.ModelMessage
  | UIMessageWithMetadata
  | AIV4Type.Message
  | CoreMessageV4 // v4 CoreMessage support
  // db messages in various formats
  | MastraMessageV1
  | MastraDBMessage; // <- this is how we currently store in the DB

export { convertMessages } from './utils/convert-messages';
export type { OutputFormat } from './utils/convert-messages';

type MessageSource =
  | 'memory'
  | 'response'
  | 'input'
  | 'system'
  | 'context'
  /* @deprecated use input instead. "user" was a confusing source type because the user can send messages that don't have role: "user" */
  | 'user';

type MemoryInfo = { threadId: string; resourceId?: string };

export type MessageListInput = string | string[] | MessageInput | MessageInput[];

export class MessageList {
  private messages: MastraDBMessage[] = [];

  // passed in by dev in input or context
  private systemMessages: AIV4Type.CoreSystemMessage[] = [];
  // passed in by us for a specific purpose, eg memory system message
  private taggedSystemMessages: Record<string, AIV4Type.CoreSystemMessage[]> = {};

  private memoryInfo: null | MemoryInfo = null;

  // used to filter this.messages by how it was added: input/response/memory
  private memoryMessages = new Set<MastraDBMessage>();
  private newUserMessages = new Set<MastraDBMessage>();
  private newResponseMessages = new Set<MastraDBMessage>();
  private userContextMessages = new Set<MastraDBMessage>();

  private memoryMessagesPersisted = new Set<MastraDBMessage>();
  private newUserMessagesPersisted = new Set<MastraDBMessage>();
  private newResponseMessagesPersisted = new Set<MastraDBMessage>();
  private userContextMessagesPersisted = new Set<MastraDBMessage>();

  private generateMessageId?: IdGenerator;
  private _agentNetworkAppend = false;

  constructor({
    threadId,
    resourceId,
    generateMessageId,
    // @ts-ignore Flag for agent network messages
    _agentNetworkAppend,
  }: { threadId?: string; resourceId?: string; generateMessageId?: AIV4Type.IdGenerator } = {}) {
    if (threadId) {
      this.memoryInfo = { threadId, resourceId };
    }
    this.generateMessageId = generateMessageId;
    this._agentNetworkAppend = _agentNetworkAppend || false;
  }

  public add(messages: MessageListInput, messageSource: MessageSource) {
    if (messageSource === `user`) messageSource = `input`;

    if (!messages) return this;
    for (const message of Array.isArray(messages) ? messages : [messages]) {
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

  private serializeSet(set: Set<MastraDBMessage>) {
    return Array.from(set).map(value => value.id);
  }

  private deserializeSet(ids: string[]) {
    return new Set(ids.map(id => this.messages.find(m => m.id === id)).filter(Boolean) as MastraDBMessage[]);
  }

  private serializeMessage(message: MastraDBMessage) {
    return {
      ...message,
      createdAt: message.createdAt.toUTCString(),
    };
  }

  private deserializeMessage(state: ReturnType<typeof this.serializeMessage>) {
    return {
      ...state,
      createdAt: new Date(state.createdAt),
    } as MastraDBMessage;
  }

  public serialize() {
    return {
      messages: this.messages.map(this.serializeMessage),
      systemMessages: this.systemMessages,
      taggedSystemMessages: this.taggedSystemMessages,
      memoryInfo: this.memoryInfo,
      _agentNetworkAppend: this._agentNetworkAppend,
      memoryMessages: this.serializeSet(this.memoryMessages),
      newUserMessages: this.serializeSet(this.newUserMessages),
      newResponseMessages: this.serializeSet(this.newResponseMessages),
      userContextMessages: this.serializeSet(this.userContextMessages),
      memoryMessagesPersisted: this.serializeSet(this.memoryMessagesPersisted),
      newUserMessagesPersisted: this.serializeSet(this.newUserMessagesPersisted),
      newResponseMessagesPersisted: this.serializeSet(this.newResponseMessagesPersisted),
      userContextMessagesPersisted: this.serializeSet(this.userContextMessagesPersisted),
    };
  }

  public deserialize(state: ReturnType<typeof this.serialize>) {
    this.messages = state.messages.map(this.deserializeMessage);
    this.systemMessages = state.systemMessages;
    this.taggedSystemMessages = state.taggedSystemMessages;
    this.memoryInfo = state.memoryInfo;
    this._agentNetworkAppend = state._agentNetworkAppend;
    this.memoryMessages = this.deserializeSet(state.memoryMessages);
    this.newUserMessages = this.deserializeSet(state.newUserMessages);
    this.newResponseMessages = this.deserializeSet(state.newResponseMessages);
    this.userContextMessages = this.deserializeSet(state.userContextMessages);
    this.memoryMessagesPersisted = this.deserializeSet(state.memoryMessagesPersisted);
    this.newUserMessagesPersisted = this.deserializeSet(state.newUserMessagesPersisted);
    this.newResponseMessagesPersisted = this.deserializeSet(state.newResponseMessagesPersisted);
    this.userContextMessagesPersisted = this.deserializeSet(state.userContextMessagesPersisted);

    return this;
  }

  public getLatestUserContent(): string | null {
    const currentUserMessages = this.all.core().filter(m => m.role === 'user');
    const content = currentUserMessages.at(-1)?.content;
    if (!content) return null;
    return MessageList.coreContentToString(content);
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
      input: {
        db: (): MastraDBMessage[] => {
          const userMessages = Array.from(this.newUserMessages);
          this.messages = this.messages.filter(m => !this.newUserMessages.has(m));
          this.newUserMessages.clear();
          return userMessages;
        },
      },
      response: {
        db: () => {
          const responseMessages = Array.from(this.newResponseMessages);
          this.messages = this.messages.filter(m => !this.newResponseMessages.has(m));
          this.newResponseMessages.clear();
          return responseMessages;
        },
      },
    };
  }

  private all = {
    db: (): MastraDBMessage[] => this.messages,
    v1: (): MastraMessageV1[] => convertToV1Messages(this.all.db()),

    aiV5: {
      model: (): AIV5Type.ModelMessage[] => this.aiV5UIMessagesToAIV5ModelMessages(this.all.aiV5.ui()),
      ui: (): AIV5Type.UIMessage[] => this.all.db().map(MessageList.mastraDBMessageToAIV5UIMessage),

      // Used when calling AI SDK streamText/generateText
      prompt: (): AIV5Type.ModelMessage[] => {
        const systemMessages = this.aiV4CoreMessagesToAIV5ModelMessages(
          [...this.systemMessages, ...Object.values(this.taggedSystemMessages).flat()],
          `system`,
        );
        // Filter incomplete tool calls when sending messages TO the LLM
        const modelMessages = this.aiV5UIMessagesToAIV5ModelMessages(this.all.aiV5.ui(), true);

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
        const modelMessages = this.aiV5UIMessagesToAIV5ModelMessages(this.all.aiV5.ui(), true);
        const systemMessages = this.aiV4CoreMessagesToAIV5ModelMessages(
          [...this.systemMessages, ...Object.values(this.taggedSystemMessages).flat()],
          `system`,
        );

        const downloadedAssets = await downloadAssetsFromMessages({
          messages: modelMessages,
          downloadConcurrency: options?.downloadConcurrency,
          downloadRetries: options?.downloadRetries,
          supportedUrls: options?.supportedUrls,
        });

        let messages = [...systemMessages, ...modelMessages];

        if (Object.keys(downloadedAssets || {}).length > 0) {
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

        return messages.map(MessageList.aiV5ModelMessageToV2PromptMessage);
      },
    },

    /* @deprecated use list.get.all.aiV4.prompt() instead */
    prompt: () => this.all.aiV4.prompt(),
    /* @deprecated use list.get.all.aiV4.ui() */
    ui: (): UIMessageWithMetadata[] => this.all.db().map(MessageList.mastraDBMessageToAIV4UIMessage),
    /* @deprecated use list.get.all.aiV4.core() */
    core: (): CoreMessageV4[] => this.aiV4UIMessagesToAIV4CoreMessages(this.all.aiV4.ui()),
    aiV4: {
      ui: (): UIMessageWithMetadata[] => this.all.db().map(MessageList.mastraDBMessageToAIV4UIMessage),
      core: (): CoreMessageV4[] => this.aiV4UIMessagesToAIV4CoreMessages(this.all.aiV4.ui()),

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

        return messages.map(MessageList.aiV4CoreMessageToV1PromptMessage);
      },
    },
  };

  private remembered = {
    db: () => this.messages.filter(m => this.memoryMessages.has(m)),
    v1: () => convertToV1Messages(this.remembered.db()),

    aiV5: {
      model: () => this.aiV5UIMessagesToAIV5ModelMessages(this.remembered.aiV5.ui()),
      ui: (): AIV5Type.UIMessage[] => this.remembered.db().map(MessageList.mastraDBMessageToAIV5UIMessage),
    },

    /* @deprecated use list.get.remembered.aiV4.ui() */
    ui: (): UIMessageWithMetadata[] => this.remembered.db().map(MessageList.mastraDBMessageToAIV4UIMessage),
    /* @deprecated use list.get.remembered.aiV4.core() */
    core: (): CoreMessageV4[] => this.aiV4UIMessagesToAIV4CoreMessages(this.all.aiV4.ui()),
    aiV4: {
      ui: (): UIMessageWithMetadata[] => this.remembered.db().map(MessageList.mastraDBMessageToAIV4UIMessage),
      core: (): CoreMessageV4[] => this.aiV4UIMessagesToAIV4CoreMessages(this.all.aiV4.ui()),
    },
  };
  // TODO: need to update this for new .aiV4/5.x() pattern
  private rememberedPersisted = {
    db: () => this.all.db().filter(m => this.memoryMessagesPersisted.has(m)),
    v1: () => convertToV1Messages(this.rememberedPersisted.db()),
    ui: () => this.rememberedPersisted.db().map(MessageList.mastraDBMessageToAIV4UIMessage),
    core: () => this.aiV4UIMessagesToAIV4CoreMessages(this.rememberedPersisted.ui()),
  };

  private input = {
    db: () => this.messages.filter(m => this.newUserMessages.has(m)),
    v1: () => convertToV1Messages(this.input.db()),

    aiV5: {
      model: () => this.aiV5UIMessagesToAIV5ModelMessages(this.input.aiV5.ui()),
      ui: (): AIV5Type.UIMessage[] => this.input.db().map(MessageList.mastraDBMessageToAIV5UIMessage),
    },

    /* @deprecated use list.get.input.aiV4.ui() instead */
    ui: () => this.input.db().map(MessageList.mastraDBMessageToAIV4UIMessage),
    /* @deprecated use list.get.core.aiV4.ui() instead */
    core: () => this.aiV4UIMessagesToAIV4CoreMessages(this.input.ui()),
    aiV4: {
      ui: (): UIMessageWithMetadata[] => this.input.db().map(MessageList.mastraDBMessageToAIV4UIMessage),
      core: (): CoreMessageV4[] => this.aiV4UIMessagesToAIV4CoreMessages(this.input.aiV4.ui()),
    },
  };
  // TODO: need to update this for new .aiV4/5.x() pattern
  private inputPersisted = {
    db: (): MastraDBMessage[] => this.messages.filter(m => this.newUserMessagesPersisted.has(m)),
    v1: (): MastraMessageV1[] => convertToV1Messages(this.inputPersisted.db()),
    ui: (): UIMessageWithMetadata[] => this.inputPersisted.db().map(MessageList.mastraDBMessageToAIV4UIMessage),
    core: () => this.aiV4UIMessagesToAIV4CoreMessages(this.inputPersisted.ui()),
  };

  private response = {
    db: (): MastraDBMessage[] => this.messages.filter(m => this.newResponseMessages.has(m)),
    v1: (): MastraMessageV1[] => convertToV1Messages(this.response.db()),

    aiV5: {
      ui: (): AIV5Type.UIMessage[] => this.response.db().map(MessageList.mastraDBMessageToAIV5UIMessage),
      model: (): AIV5ResponseMessage[] =>
        this.aiV5UIMessagesToAIV5ModelMessages(this.response.aiV5.ui()).filter(
          m => m.role === `tool` || m.role === `assistant`,
        ),
      modelContent: (stepNumber?: number): AIV5Type.StepResult<any>['content'] => {
        if (typeof stepNumber === 'number') {
          const uiMessages = this.response.aiV5.ui();
          const uiMessagesParts = uiMessages.flatMap(item => item.parts);

          // Find step boundaries by looking for step-start markers
          const stepBoundaries: number[] = [];
          uiMessagesParts.forEach((part, index) => {
            if (part.type === 'step-start') {
              stepBoundaries.push(index);
            }
          });

          // Handle -1 to get the last step (the current/most recent step)
          if (stepNumber === -1) {
            // For tool-only steps without step-start markers, we need different logic
            // Each tool part represents a complete step (tool call + result)
            const toolParts = uiMessagesParts.filter(p => p.type?.startsWith('tool-'));
            const hasStepStart = stepBoundaries.length > 0;

            if (!hasStepStart && toolParts.length > 0) {
              // No step-start markers but we have tool parts
              // Each tool part is a separate step, so return only the last tool
              const lastToolPart = toolParts[toolParts.length - 1];
              if (!lastToolPart) {
                return [];
              }
              const lastToolIndex = uiMessagesParts.indexOf(lastToolPart);
              const previousToolPart = toolParts[toolParts.length - 2];
              const previousToolIndex = previousToolPart ? uiMessagesParts.indexOf(previousToolPart) : -1;

              const startIndex = previousToolIndex + 1;
              const stepParts = uiMessagesParts.slice(startIndex, lastToolIndex + 1);

              const stepUiMessages: AIV5Type.UIMessage[] = [
                {
                  id: 'last-step',
                  role: 'assistant',
                  parts: stepParts,
                },
              ];
              const modelMessages = AIV5.convertToModelMessages(this.sanitizeV5UIMessages(stepUiMessages));
              return modelMessages.flatMap(this.response.aiV5.stepContent);
            }

            // Count total steps (1 + number of step-start markers)
            const totalSteps = stepBoundaries.length + 1;

            // Get the content for the last step using the regular step logic
            if (totalSteps === 1 && !hasStepStart) {
              // Only one step, return all content
              const stepUiMessages: AIV5Type.UIMessage[] = [
                {
                  id: 'last-step',
                  role: 'assistant',
                  parts: uiMessagesParts,
                },
              ];
              const modelMessages = AIV5.convertToModelMessages(this.sanitizeV5UIMessages(stepUiMessages));
              return modelMessages.flatMap(this.response.aiV5.stepContent);
            }

            // Multiple steps - get content after the last step-start marker
            const lastStepStart = stepBoundaries[stepBoundaries.length - 1];
            if (lastStepStart === undefined) {
              return [];
            }
            const stepParts = uiMessagesParts.slice(lastStepStart + 1);

            if (stepParts.length === 0) {
              return [];
            }

            const stepUiMessages: AIV5Type.UIMessage[] = [
              {
                id: 'last-step',
                role: 'assistant',
                parts: stepParts,
              },
            ];

            const modelMessages = AIV5.convertToModelMessages(this.sanitizeV5UIMessages(stepUiMessages));
            return modelMessages.flatMap(this.response.aiV5.stepContent);
          }

          // Step 1 is everything before the first step-start
          if (stepNumber === 1) {
            const firstStepStart = stepBoundaries[0] ?? uiMessagesParts.length;
            if (firstStepStart === 0) {
              // No content before first step-start
              return [];
            }

            const stepParts = uiMessagesParts.slice(0, firstStepStart);
            const stepUiMessages: AIV5Type.UIMessage[] = [
              {
                id: 'step-1',
                role: 'assistant',
                parts: stepParts,
              },
            ];

            // Convert to model messages without adding extra step-start markers
            const modelMessages = AIV5.convertToModelMessages(this.sanitizeV5UIMessages(stepUiMessages));
            return modelMessages.flatMap(this.response.aiV5.stepContent);
          }

          // For steps 2+, content is between (stepNumber-1)th and stepNumber-th step-start markers
          const stepIndex = stepNumber - 2; // -2 because step 2 is at index 0 in boundaries
          if (stepIndex < 0 || stepIndex >= stepBoundaries.length) {
            return [];
          }

          const startIndex = (stepBoundaries[stepIndex] ?? 0) + 1; // Start after the step-start marker
          const endIndex = stepBoundaries[stepIndex + 1] ?? uiMessagesParts.length;

          if (startIndex >= endIndex) {
            return [];
          }

          const stepParts = uiMessagesParts.slice(startIndex, endIndex);
          const stepUiMessages: AIV5Type.UIMessage[] = [
            {
              id: `step-${stepNumber}`,
              role: 'assistant',
              parts: stepParts,
            },
          ];

          // Convert to model messages without adding extra step-start markers
          const modelMessages = AIV5.convertToModelMessages(this.sanitizeV5UIMessages(stepUiMessages));
          return modelMessages.flatMap(this.response.aiV5.stepContent);
        }

        return this.response.aiV5.model().map(this.response.aiV5.stepContent).flat();
      },
      stepContent: (message?: AIV5Type.ModelMessage): AIV5Type.StepResult<any>['content'] => {
        const latest = message ? message : this.response.aiV5.model().at(-1);
        if (!latest) return [];
        if (typeof latest.content === `string`) {
          return [{ type: 'text', text: latest.content }];
        }
        return latest.content.map(c => {
          if (c.type === `tool-result`)
            return {
              type: 'tool-result',
              input: {}, // TODO: we need to find the tool call here and add the input from it
              output: c.output,
              toolCallId: c.toolCallId,
              toolName: c.toolName,
            } satisfies AIV5Type.StaticToolResult<any>;
          if (c.type === `file`)
            return {
              type: 'file',
              file: new DefaultGeneratedFileWithType({
                data:
                  typeof c.data === `string`
                    ? parseDataUri(c.data).base64Content // Strip data URI prefix if present
                    : c.data instanceof URL
                      ? c.data.toString()
                      : convertDataContentToBase64String(c.data),
                mediaType: c.mediaType,
              }),
            } satisfies Extract<AIV5Type.StepResult<any>['content'][number], { type: 'file' }>;
          if (c.type === `image`) {
            return {
              type: 'file',
              file: new DefaultGeneratedFileWithType({
                data:
                  typeof c.image === `string`
                    ? parseDataUri(c.image).base64Content // Strip data URI prefix if present
                    : c.image instanceof URL
                      ? c.image.toString()
                      : convertDataContentToBase64String(c.image),
                mediaType: c.mediaType || 'unknown',
              }),
            };
          }
          return { ...c };
        });
      },
    },

    aiV4: {
      ui: (): UIMessageWithMetadata[] => this.response.db().map(MessageList.mastraDBMessageToAIV4UIMessage),
      core: (): CoreMessageV4[] => this.aiV4UIMessagesToAIV4CoreMessages(this.response.aiV4.ui()),
    },
  };
  // TODO: need to update this for new .aiV4/5.x() pattern
  private responsePersisted = {
    db: (): MastraDBMessage[] => this.messages.filter(m => this.newResponseMessagesPersisted.has(m)),
    ui: (): UIMessageWithMetadata[] => this.responsePersisted.db().map(MessageList.mastraDBMessageToAIV4UIMessage),
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

  public getSystemMessages(tag?: string): CoreMessageV4[] {
    if (tag) {
      return this.taggedSystemMessages[tag] || [];
    }
    return this.systemMessages;
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

  private aiV4UIMessagesToAIV4CoreMessages(messages: UIMessageV4[]): CoreMessageV4[] {
    return convertToCoreMessagesV4(this.sanitizeAIV4UIMessages(messages));
  }
  private sanitizeAIV4UIMessages(messages: UIMessageV4[]): UIMessageV4[] {
    const msgs = messages
      .map(m => {
        if (m.parts.length === 0) return false;
        const safeParts = m.parts.filter(
          p =>
            p.type !== `tool-invocation` ||
            // calls and partial-calls should be updated to be results at this point
            // if they haven't we can't send them back to the llm and need to remove them.
            (p.toolInvocation.state !== `call` && p.toolInvocation.state !== `partial-call`),
        );

        // fully remove this message if it has an empty parts array after stripping out incomplete tool calls.
        if (!safeParts.length) return false;

        const sanitized = {
          ...m,
          parts: safeParts,
        };

        // ensure toolInvocations are also updated to only show results
        if (`toolInvocations` in m && m.toolInvocations) {
          sanitized.toolInvocations = m.toolInvocations.filter(t => t.state === `result`);
        }

        return sanitized;
      })
      .filter((m): m is UIMessageV4 => Boolean(m));
    return msgs;
  }

  /**
   * Converts various message formats to AIV4 CoreMessage format for system messages
   * @param message - The message to convert (can be string, MastraDBMessage, or AI SDK message types)
   * @returns AIV4 CoreMessage in the proper format
   */
  private systemMessageToAICore(
    message: CoreMessageV4 | AIV5Type.ModelMessage | MastraDBMessage | string,
  ): CoreMessageV4 {
    if (typeof message === `string`) {
      return { role: 'system', content: message };
    }

    if (MessageList.isAIV5CoreMessage(message)) {
      const dbMsg = MessageList.aiV5ModelMessageToMastraDBMessage(message as AIV5Type.ModelMessage, 'system');
      return MessageList.mastraDBMessageSystemToV4Core(dbMsg);
    }

    if (MessageList.isMastraDBMessage(message)) {
      return MessageList.mastraDBMessageSystemToV4Core(message);
    }

    return message;
  }

  private addOneSystem(message: CoreMessageV4 | AIV5Type.ModelMessage | MastraDBMessage | string, tag?: string) {
    const coreMessage = this.systemMessageToAICore(message);

    if (coreMessage.role !== `system`) {
      throw new Error(
        `Expected role "system" but saw ${coreMessage.role} for message ${JSON.stringify(coreMessage, null, 2)}`,
      );
    }

    if (tag && !this.isDuplicateSystem(coreMessage, tag)) {
      this.taggedSystemMessages[tag] ||= [];
      this.taggedSystemMessages[tag].push(coreMessage);
    } else if (!tag && !this.isDuplicateSystem(coreMessage)) {
      this.systemMessages.push(coreMessage);
    }
  }

  private isDuplicateSystem(message: CoreMessageV4, tag?: string) {
    if (tag) {
      if (!this.taggedSystemMessages[tag]) return false;
      return this.taggedSystemMessages[tag].some(
        m =>
          MessageList.cacheKeyFromAIV4CoreMessageContent(m.content) ===
          MessageList.cacheKeyFromAIV4CoreMessageContent(message.content),
      );
    }
    return this.systemMessages.some(
      m =>
        MessageList.cacheKeyFromAIV4CoreMessageContent(m.content) ===
        MessageList.cacheKeyFromAIV4CoreMessageContent(message.content),
    );
  }

  private static mastraDBMessageToAIV4UIMessage(m: MastraDBMessage): UIMessageWithMetadata {
    const experimentalAttachments: UIMessageWithMetadata['experimental_attachments'] = m.content
      .experimental_attachments
      ? [...m.content.experimental_attachments]
      : [];
    const contentString =
      typeof m.content.content === `string` && m.content.content !== ''
        ? m.content.content
        : m.content.parts.reduce((prev, part) => {
            if (part.type === `text`) {
              // return only the last text part like AI SDK does
              return part.text;
            }
            return prev;
          }, '');

    const parts: MastraMessageContentV2['parts'] = [];

    if (m.content.parts.length) {
      for (const part of m.content.parts) {
        if (part.type === `file`) {
          experimentalAttachments.push({
            contentType: part.mimeType,
            url: part.data,
          });
        } else if (
          part.type === 'tool-invocation' &&
          (part.toolInvocation.state === 'call' || part.toolInvocation.state === 'partial-call')
        ) {
          // Filter out tool invocations with call or partial-call states
          continue;
        } else if (part.type === 'tool-invocation') {
          // Handle tool invocations with step number logic
          const toolInvocation = { ...part.toolInvocation };

          // Find the step number for this tool invocation
          let currentStep = -1;
          let toolStep = -1;
          for (const innerPart of m.content.parts) {
            if (innerPart.type === `step-start`) currentStep++;
            if (
              innerPart.type === `tool-invocation` &&
              innerPart.toolInvocation.toolCallId === part.toolInvocation.toolCallId
            ) {
              toolStep = currentStep;
              break;
            }
          }

          if (toolStep >= 0) {
            const preparedInvocation = {
              step: toolStep,
              ...toolInvocation,
            };
            parts.push({
              type: 'tool-invocation',
              toolInvocation: preparedInvocation,
            });
          } else {
            parts.push({
              type: 'tool-invocation',
              toolInvocation,
            });
          }
        } else {
          parts.push(part);
        }
      }
    }

    if (parts.length === 0 && experimentalAttachments.length > 0) {
      // make sure we have atleast one part so this message doesn't get removed when converting to core message
      parts.push({ type: 'text', text: '' });
    }

    if (m.role === `user`) {
      const uiMessage: UIMessageWithMetadata = {
        id: m.id,
        role: m.role,
        content: m.content.content || contentString,
        createdAt: m.createdAt,
        parts,
        experimental_attachments: experimentalAttachments,
      };
      // Preserve metadata if present
      if (m.content.metadata) {
        uiMessage.metadata = m.content.metadata;
      }
      return uiMessage;
    } else if (m.role === `assistant`) {
      const isSingleTextContentArray =
        Array.isArray(m.content.content) && m.content.content.length === 1 && m.content.content[0].type === `text`;

      const uiMessage: UIMessageWithMetadata = {
        id: m.id,
        role: m.role,
        content: isSingleTextContentArray ? contentString : m.content.content || contentString,
        createdAt: m.createdAt,
        parts,
        reasoning: undefined,
        toolInvocations:
          `toolInvocations` in m.content ? m.content.toolInvocations?.filter(t => t.state === 'result') : undefined,
      };
      // Preserve metadata if present
      if (m.content.metadata) {
        uiMessage.metadata = m.content.metadata;
      }
      return uiMessage;
    }

    const uiMessage: UIMessageWithMetadata = {
      id: m.id,
      role: m.role,
      content: m.content.content || contentString,
      createdAt: m.createdAt,
      parts,
      experimental_attachments: experimentalAttachments,
    };
    // Preserve metadata if present
    if (m.content.metadata) {
      uiMessage.metadata = m.content.metadata;
    }
    return uiMessage;
  }

  /**
   * Converts a MastraDBMessage system message directly to AIV4 CoreMessage format
   * This is more efficient than converting to UI message first and then to core
   * @param message - The MastraDBMessage message to convert
   * @returns AIV4 CoreMessage with system role
   */
  private static mastraDBMessageSystemToV4Core(message: MastraDBMessage): CoreMessageV4 {
    if (message.role !== `system` || !message.content.content)
      throw new MastraError({
        id: 'INVALID_SYSTEM_MESSAGE_FORMAT',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Invalid system message format. System messages must include 'role' and 'content' properties. The content should be a string.`,
        details: {
          receivedMessage: JSON.stringify(message, null, 2),
        },
      });

    return { role: 'system', content: message.content.content };
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
      shouldReplace: !MessageList.messagesAreEqual(existingMessage, message),
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
        MessageList.isAIV4CoreMessage(message) ||
        MessageList.isAIV5CoreMessage(message) ||
        MessageList.isMastraDBMessage(message);

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

    const messageV2 = this.inputToMastraDBMessage(message, messageSource);

    const { exists, shouldReplace, id } = this.shouldReplaceMessage(messageV2);

    const latestMessage = this.messages.at(-1);

    if (messageSource === `memory`) {
      for (const existingMessage of this.messages) {
        // don't double store any messages
        if (MessageList.messagesAreEqual(existingMessage, messageV2)) {
          return;
        }
      }
    }
    // If the last message is an assistant message and the new message is also an assistant message, merge them together and update tool calls with results
    const shouldAppendToLastAssistantMessage =
      latestMessage?.role === 'assistant' &&
      messageV2.role === 'assistant' &&
      latestMessage.threadId === messageV2.threadId &&
      // If the message is from memory, don't append to the last assistant message
      messageSource !== 'memory';
    // This flag is for agent network messages. We should change the agent network formatting and remove this flag after.
    const appendNetworkMessage =
      (this._agentNetworkAppend && latestMessage && !this.memoryMessages.has(latestMessage)) ||
      !this._agentNetworkAppend;
    if (shouldAppendToLastAssistantMessage && appendNetworkMessage) {
      latestMessage.createdAt = messageV2.createdAt || latestMessage.createdAt;

      // Used for mapping indexes for messageV2 parts to corresponding indexes in latestMessage
      const toolResultAnchorMap = new Map<number, number>();
      const partsToAdd = new Map<number, MastraMessageContentV2['parts'][number]>();

      for (const [index, part] of messageV2.content.parts.entries()) {
        // If the incoming part is a tool-invocation result, find the corresponding call in the latest message
        if (part.type === 'tool-invocation') {
          const existingCallPart = [...latestMessage.content.parts]
            .reverse()
            .find(p => p.type === 'tool-invocation' && p.toolInvocation.toolCallId === part.toolInvocation.toolCallId);

          const existingCallToolInvocation = !!existingCallPart && existingCallPart.type === 'tool-invocation';

          if (existingCallToolInvocation) {
            if (part.toolInvocation.state === 'result') {
              // Update the existing tool-call part with the result
              existingCallPart.toolInvocation = {
                ...existingCallPart.toolInvocation,
                step: part.toolInvocation.step,
                state: 'result',
                result: part.toolInvocation.result,
                args: {
                  ...existingCallPart.toolInvocation.args,
                  ...part.toolInvocation.args,
                },
              };
              if (!latestMessage.content.toolInvocations) {
                latestMessage.content.toolInvocations = [];
              }
              const toolInvocationIndex = latestMessage.content.toolInvocations.findIndex(
                t => t.toolCallId === existingCallPart.toolInvocation.toolCallId,
              );
              if (toolInvocationIndex === -1) {
                latestMessage.content.toolInvocations.push(existingCallPart.toolInvocation);
              } else {
                latestMessage.content.toolInvocations[toolInvocationIndex] = existingCallPart.toolInvocation;
              }
            }
            // Map the index of the tool call in messageV2 to the index of the tool call in latestMessage
            const existingIndex = latestMessage.content.parts.findIndex(p => p === existingCallPart);
            toolResultAnchorMap.set(index, existingIndex);
            // Otherwise we do nothing, as we're not updating the tool call
          } else {
            partsToAdd.set(index, part);
          }
        } else {
          partsToAdd.set(index, part);
        }
      }
      this.addPartsToLatestMessage({
        latestMessage,
        messageV2,
        anchorMap: toolResultAnchorMap,
        partsToAdd,
      });
      if (latestMessage.createdAt.getTime() < messageV2.createdAt.getTime()) {
        latestMessage.createdAt = messageV2.createdAt;
      }
      if (!latestMessage.content.content && messageV2.content.content) {
        latestMessage.content.content = messageV2.content.content;
      }
      if (
        latestMessage.content.content &&
        messageV2.content.content &&
        latestMessage.content.content !== messageV2.content.content
      ) {
        // Match what AI SDK does - content string is always the latest text part.
        latestMessage.content.content = messageV2.content.content;
      }

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
        this.messages[existingIndex] = messageV2;
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
    if (messageSource === `memory`) {
      this.memoryMessages.add(messageV2);
      this.memoryMessagesPersisted.add(messageV2);
    } else if (messageSource === `response`) {
      this.newResponseMessages.add(messageV2);
      this.newResponseMessagesPersisted.add(messageV2);
    } else if (messageSource === `input`) {
      this.newUserMessages.add(messageV2);
      this.newUserMessagesPersisted.add(messageV2);
    } else if (messageSource === `context`) {
      this.userContextMessages.add(messageV2);
      this.userContextMessagesPersisted.add(messageV2);
    } else {
      throw new Error(`Missing message source for message ${messageV2}`);
    }
  }

  /**
   * Pushes a new message part to the latest message.
   * @param latestMessage - The latest message to push the part to.
   * @param newMessage - The new message to push the part from.
   * @param part - The part to push.
   * @param insertAt - The index at which to insert the part. Optional.
   */
  private pushNewMessagePart({
    latestMessage,
    newMessage,
    part,
    insertAt, // optional
  }: {
    latestMessage: MastraDBMessage;
    newMessage: MastraDBMessage;
    part: MastraMessageContentV2['parts'][number];
    insertAt?: number;
  }) {
    const partKey = MessageList.cacheKeyFromAIV4Parts([part]);
    const latestPartCount = latestMessage.content.parts.filter(
      p => MessageList.cacheKeyFromAIV4Parts([p]) === partKey,
    ).length;
    const newPartCount = newMessage.content.parts.filter(
      p => MessageList.cacheKeyFromAIV4Parts([p]) === partKey,
    ).length;
    // If the number of parts in the latest message is less than the number of parts in the new message, insert the part
    if (latestPartCount < newPartCount) {
      // Check if we need to add a step-start before text parts when merging assistant messages
      // Only add after tool invocations, and only if the incoming message doesn't already have step-start
      const partIndex = newMessage.content.parts.indexOf(part);
      const hasStepStartBefore = partIndex > 0 && newMessage.content.parts[partIndex - 1]?.type === 'step-start';

      const needsStepStart =
        latestMessage.role === 'assistant' &&
        part.type === 'text' &&
        !hasStepStartBefore &&
        latestMessage.content.parts.length > 0 &&
        latestMessage.content.parts.at(-1)?.type === 'tool-invocation';

      if (typeof insertAt === 'number') {
        if (needsStepStart) {
          latestMessage.content.parts.splice(insertAt, 0, { type: 'step-start' });
          latestMessage.content.parts.splice(insertAt + 1, 0, part);
        } else {
          latestMessage.content.parts.splice(insertAt, 0, part);
        }
      } else {
        if (needsStepStart) {
          latestMessage.content.parts.push({ type: 'step-start' });
        }
        latestMessage.content.parts.push(part);
      }
    }
  }

  /**
   * Upserts parts of messageV2 into latestMessage based on the anchorMap.
   * This is used when appending a message to the last assistant message to ensure that parts are inserted in the correct order.
   * @param latestMessage - The latest message to upsert parts into.
   * @param messageV2 - The message to upsert parts from.
   * @param anchorMap - The anchor map to use for upserting parts.
   */
  private addPartsToLatestMessage({
    latestMessage,
    messageV2,
    anchorMap,
    partsToAdd,
  }: {
    latestMessage: MastraDBMessage;
    messageV2: MastraDBMessage;
    anchorMap: Map<number, number>;
    partsToAdd: Map<number, MastraMessageContentV2['parts'][number]>;
  }) {
    // Walk through messageV2, inserting any part not present at the canonical position
    for (let i = 0; i < messageV2.content.parts.length; ++i) {
      const part = messageV2.content.parts[i];
      if (!part) continue;
      const key = MessageList.cacheKeyFromAIV4Parts([part]);
      const partToAdd = partsToAdd.get(i);
      if (!key || !partToAdd) continue;
      if (anchorMap.size > 0) {
        if (anchorMap.has(i)) continue; // skip anchors
        // Find left anchor in messageV2
        const leftAnchorV2 = [...anchorMap.keys()].filter(idx => idx < i).pop() ?? -1;
        // Find right anchor in messageV2
        const rightAnchorV2 = [...anchorMap.keys()].find(idx => idx > i) ?? -1;

        // Map to latestMessage
        const leftAnchorLatest = leftAnchorV2 !== -1 ? anchorMap.get(leftAnchorV2)! : 0;

        // Compute offset from anchor
        const offset = leftAnchorV2 === -1 ? i : i - leftAnchorV2;

        // Insert at proportional position
        const insertAt = leftAnchorLatest + offset;

        const rightAnchorLatest =
          rightAnchorV2 !== -1 ? anchorMap.get(rightAnchorV2)! : latestMessage.content.parts.length;

        if (
          insertAt >= 0 &&
          insertAt <= rightAnchorLatest &&
          !latestMessage.content.parts
            .slice(insertAt, rightAnchorLatest)
            .some(p => MessageList.cacheKeyFromAIV4Parts([p]) === MessageList.cacheKeyFromAIV4Parts([part]))
        ) {
          this.pushNewMessagePart({
            latestMessage,
            newMessage: messageV2,
            part,
            insertAt,
          });
          for (const [v2Idx, latestIdx] of anchorMap.entries()) {
            if (latestIdx >= insertAt) {
              anchorMap.set(v2Idx, latestIdx + 1);
            }
          }
        }
      } else {
        this.pushNewMessagePart({
          latestMessage,
          newMessage: messageV2,
          part,
        });
      }
    }
  }

  private inputToMastraDBMessage(message: MessageInput, messageSource: MessageSource): MastraDBMessage {
    if (
      // we can't throw if the threadId doesn't match and this message came from memory
      // this is because per-user semantic recall can retrieve messages from other threads
      messageSource !== `memory` &&
      `threadId` in message &&
      message.threadId &&
      this.memoryInfo &&
      message.threadId !== this.memoryInfo.threadId
    ) {
      throw new Error(
        `Received input message with wrong threadId. Input ${message.threadId}, expected ${this.memoryInfo.threadId}`,
      );
    }

    if (
      `resourceId` in message &&
      message.resourceId &&
      this.memoryInfo?.resourceId &&
      message.resourceId !== this.memoryInfo.resourceId
    ) {
      throw new Error(
        `Received input message with wrong resourceId. Input ${message.resourceId}, expected ${this.memoryInfo.resourceId}`,
      );
    }

    if (MessageList.isMastraMessageV1(message)) {
      return this.mastraMessageV1ToMastraDBMessage(message, messageSource);
    }
    if (MessageList.isMastraDBMessage(message)) {
      return this.hydrateMastraDBMessageFields(message);
    }
    if (MessageList.isAIV4CoreMessage(message)) {
      return this.aiV4CoreMessageToMastraDBMessage(message, messageSource);
    }
    if (MessageList.isAIV4UIMessage(message)) {
      return this.aiV4UIMessageToMastraDBMessage(message, messageSource);
    }

    if (MessageList.isAIV5CoreMessage(message)) {
      const dbMsg = MessageList.aiV5ModelMessageToMastraDBMessage(message, messageSource);
      const result = {
        ...dbMsg,
        threadId: this.memoryInfo?.threadId,
        resourceId: this.memoryInfo?.resourceId,
      };
      return result;
    }
    if (MessageList.isAIV5UIMessage(message)) {
      const dbMsg = MessageList.aiV5UIMessageToMastraDBMessage(message);
      return {
        ...dbMsg,
        threadId: this.memoryInfo?.threadId,
        resourceId: this.memoryInfo?.resourceId,
      };
    }

    throw new Error(`Found unhandled message ${JSON.stringify(message)}`);
  }

  private lastCreatedAt?: number;
  // this makes sure messages added in order will always have a date atleast 1ms apart.
  private generateCreatedAt(messageSource: MessageSource, start?: Date | number): Date {
    start = start instanceof Date ? start : start ? new Date(start) : undefined;

    if (start && !this.lastCreatedAt) {
      this.lastCreatedAt = start.getTime();
      return start;
    }

    if (start && messageSource === `memory`) {
      // we don't want to modify start time if the message came from memory or we may accidentally re-order old messages
      return start;
    }

    const now = new Date();
    const nowTime = start?.getTime() || now.getTime();
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

  private newMessageId(): string {
    if (this.generateMessageId) {
      return this.generateMessageId();
    }
    return randomUUID();
  }

  private mastraMessageV1ToMastraDBMessage(message: MastraMessageV1, messageSource: MessageSource): MastraDBMessage {
    const coreV2 = this.aiV4CoreMessageToMastraDBMessage(
      {
        content: message.content,
        role: message.role,
      } as CoreMessageV4,
      messageSource,
    );

    return {
      id: message.id,
      role: coreV2.role,
      createdAt: this.generateCreatedAt(messageSource, message.createdAt),
      threadId: message.threadId,
      resourceId: message.resourceId,
      content: coreV2.content,
    };
  }

  private hydrateMastraDBMessageFields(message: MastraDBMessage): MastraDBMessage {
    // Generate ID if missing
    if (!message.id) {
      message.id = this.newMessageId();
    }

    if (!(message.createdAt instanceof Date)) message.createdAt = new Date(message.createdAt);

    // Fix toolInvocations with empty args by looking in the parts array
    // This handles messages restored from database where toolInvocations might have lost their args
    if (message.content.toolInvocations && message.content.parts) {
      message.content.toolInvocations = message.content.toolInvocations.map(ti => {
        if (!ti.args || Object.keys(ti.args).length === 0) {
          // Find the corresponding tool-invocation part with args
          const partWithArgs = message.content.parts.find(
            part =>
              part.type === 'tool-invocation' &&
              part.toolInvocation &&
              part.toolInvocation.toolCallId === ti.toolCallId &&
              part.toolInvocation.args &&
              Object.keys(part.toolInvocation.args).length > 0,
          );
          if (partWithArgs && partWithArgs.type === 'tool-invocation') {
            return { ...ti, args: partWithArgs.toolInvocation.args };
          }
        }
        return ti;
      });
    }

    return message;
  }

  private aiV4UIMessageToMastraDBMessage(
    message: UIMessageV4 | UIMessageWithMetadata,
    messageSource: MessageSource,
  ): MastraDBMessage {
    const content: MastraMessageContentV2 = {
      format: 2,
      parts: message.parts,
    };

    if (message.toolInvocations) content.toolInvocations = message.toolInvocations;
    if (message.reasoning) content.reasoning = message.reasoning;
    if (message.annotations) content.annotations = message.annotations;
    if (message.experimental_attachments) {
      content.experimental_attachments = message.experimental_attachments;
    }
    // Preserve metadata field if present
    if ('metadata' in message && message.metadata !== null && message.metadata !== undefined) {
      content.metadata = message.metadata as Record<string, unknown>;
    }

    return {
      id: message.id || this.newMessageId(),
      role: MessageList.getRole(message),
      createdAt: this.generateCreatedAt(messageSource, message.createdAt),
      threadId: this.memoryInfo?.threadId,
      resourceId: this.memoryInfo?.resourceId,
      content,
    } satisfies MastraDBMessage;
  }
  private aiV4CoreMessageToMastraDBMessage(coreMessage: CoreMessageV4, messageSource: MessageSource): MastraDBMessage {
    const id = `id` in coreMessage ? (coreMessage.id as string) : this.newMessageId();
    const parts: UIMessageV4['parts'] = [];
    const experimentalAttachments: UIMessageV4['experimental_attachments'] = [];
    const toolInvocations: ToolInvocationV4[] = [];

    const isSingleTextContent =
      messageSource === `response` &&
      Array.isArray(coreMessage.content) &&
      coreMessage.content.length === 1 &&
      coreMessage.content[0] &&
      coreMessage.content[0].type === `text` &&
      `text` in coreMessage.content[0] &&
      coreMessage.content[0].text;

    if (isSingleTextContent && messageSource === `response`) {
      coreMessage.content = isSingleTextContent;
    }

    if (typeof coreMessage.content === 'string') {
      parts.push({
        type: 'text',
        text: coreMessage.content,
        // Preserve providerOptions from CoreMessage (e.g., for system messages with cacheControl)
        ...('providerOptions' in coreMessage && coreMessage.providerOptions
          ? { providerMetadata: coreMessage.providerOptions }
          : {}),
      });
    } else if (Array.isArray(coreMessage.content)) {
      for (const part of coreMessage.content) {
        switch (part.type) {
          case 'text':
            // Add step-start only after tool invocations, not at the beginning
            const prevPart = parts.at(-1);
            if (coreMessage.role === 'assistant' && prevPart && prevPart.type === 'tool-invocation') {
              parts.push({ type: 'step-start' });
            }
            // Merge part-level and message-level providerOptions
            // Part-level takes precedence over message-level
            const mergedProviderMetadata = {
              ...('providerOptions' in coreMessage && coreMessage.providerOptions ? coreMessage.providerOptions : {}),
              ...('providerOptions' in part && part.providerOptions ? part.providerOptions : {}),
            };

            parts.push({
              type: 'text',
              text: part.text,
              ...(Object.keys(mergedProviderMetadata).length > 0 ? { providerMetadata: mergedProviderMetadata } : {}),
            });
            break;

          case 'tool-call':
            parts.push({
              type: 'tool-invocation',
              toolInvocation: {
                state: 'call',
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                args: part.args,
              },
            });
            break;

          case 'tool-result':
            // Try to find args from the corresponding tool-call in previous messages
            let toolArgs: Record<string, unknown> = {};

            // First, check if there's a tool-call in the same message
            const toolCallInSameMsg = coreMessage.content.find(
              p => p.type === 'tool-call' && p.toolCallId === part.toolCallId,
            );
            if (toolCallInSameMsg && toolCallInSameMsg.type === 'tool-call') {
              toolArgs = toolCallInSameMsg.args as Record<string, unknown>;
            }

            // If not found, look in previous messages for the corresponding tool-call
            // Search from most recent messages first (more likely to find the match)
            if (Object.keys(toolArgs).length === 0) {
              // Iterate in reverse order (most recent first) for better performance
              for (let i = this.messages.length - 1; i >= 0; i--) {
                const msg = this.messages[i];
                if (msg && msg.role === 'assistant' && msg.content.parts) {
                  const toolCallPart = msg.content.parts.find(
                    p =>
                      p.type === 'tool-invocation' &&
                      p.toolInvocation.toolCallId === part.toolCallId &&
                      p.toolInvocation.state === 'call',
                  );
                  if (toolCallPart && toolCallPart.type === 'tool-invocation' && toolCallPart.toolInvocation.args) {
                    toolArgs = toolCallPart.toolInvocation.args;
                    break;
                  }
                }
              }
            }

            const invocation = {
              state: 'result' as const,
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              result: part.result ?? '', // undefined will cause AI SDK to throw an error, but for client side tool calls this really could be undefined
              args: toolArgs, // Use the args from the corresponding tool-call
            };
            parts.push({
              type: 'tool-invocation',
              toolInvocation: invocation,
            });
            toolInvocations.push(invocation);
            break;

          case 'reasoning':
            parts.push({
              type: 'reasoning',
              reasoning: '', // leave this blank so we aren't double storing it in the db along with details
              details: [{ type: 'text', text: part.text, signature: part.signature }],
            });
            break;
          case 'redacted-reasoning':
            parts.push({
              type: 'reasoning',
              reasoning: '', // No text reasoning for redacted parts
              details: [{ type: 'redacted', data: part.data }],
            });
            break;
          case 'image':
            parts.push({
              type: 'file',
              data: imageContentToString(part.image),
              mimeType: part.mimeType!,
            });
            break;
          case 'file':
            // CoreMessage file parts can have mimeType and data (binary/data URL) or just a URL
            if (part.data instanceof URL) {
              parts.push({
                type: 'file',
                data: part.data.toString(),
                mimeType: part.mimeType,
              });
            } else if (typeof part.data === 'string') {
              const categorized = categorizeFileData(part.data, part.mimeType);

              if (categorized.type === 'url' || categorized.type === 'dataUri') {
                // It's a URL or data URI, use it directly
                parts.push({
                  type: 'file',
                  data: part.data,
                  mimeType: categorized.mimeType || 'image/png',
                });
              } else {
                // Raw data, convert to base64
                try {
                  parts.push({
                    type: 'file',
                    mimeType: categorized.mimeType || 'image/png',
                    data: convertDataContentToBase64String(part.data),
                  });
                } catch (error) {
                  console.error(`Failed to convert binary data to base64 in CoreMessage file part: ${error}`, error);
                }
              }
            } else {
              // If it's binary data, convert to base64 and add to parts
              try {
                parts.push({
                  type: 'file',
                  mimeType: part.mimeType,
                  data: convertDataContentToBase64String(part.data),
                });
              } catch (error) {
                console.error(`Failed to convert binary data to base64 in CoreMessage file part: ${error}`, error);
              }
            }
            break;
        }
      }
    }

    const content: MastraDBMessage['content'] = {
      format: 2,
      parts,
    };

    if (toolInvocations.length) content.toolInvocations = toolInvocations;
    if (typeof coreMessage.content === `string`) content.content = coreMessage.content;

    if (experimentalAttachments.length) content.experimental_attachments = experimentalAttachments;

    return {
      id,
      role: MessageList.getRole(coreMessage),
      createdAt: this.generateCreatedAt(messageSource),
      threadId: this.memoryInfo?.threadId,
      resourceId: this.memoryInfo?.resourceId,
      content,
    };
  }

  static isAIV4UIMessage(msg: MessageInput): msg is UIMessageV4 {
    return (
      !MessageList.isMastraMessage(msg) &&
      !MessageList.isAIV4CoreMessage(msg) &&
      `parts` in msg &&
      !MessageList.hasAIV5UIMessageCharacteristics(msg)
    );
  }

  static isAIV5CoreMessage(msg: MessageInput): msg is AIV5Type.ModelMessage {
    return (
      !MessageList.isMastraMessage(msg) &&
      !(`parts` in msg) &&
      `content` in msg &&
      MessageList.hasAIV5CoreMessageCharacteristics(msg)
    );
  }
  static isAIV4CoreMessage(msg: MessageInput): msg is CoreMessageV4 {
    // V4 CoreMessage has role and content like V5, but content can be array of parts
    return (
      !MessageList.isMastraMessage(msg) &&
      !(`parts` in msg) &&
      `content` in msg &&
      !MessageList.hasAIV5CoreMessageCharacteristics(msg)
    );
  }

  static isMastraMessage(msg: MessageInput): msg is MastraDBMessage | MastraMessageV1 {
    return MessageList.isMastraDBMessage(msg) || MessageList.isMastraMessageV1(msg);
  }

  static isMastraMessageV1(msg: MessageInput): msg is MastraMessageV1 {
    return !MessageList.isMastraDBMessage(msg) && (`threadId` in msg || `resourceId` in msg);
  }

  static isMastraDBMessage(msg: MessageInput): msg is MastraDBMessage {
    return Boolean(
      `content` in msg &&
        msg.content &&
        !Array.isArray(msg.content) &&
        typeof msg.content !== `string` &&
        `format` in msg.content &&
        msg.content.format === 2,
    );
  }

  private static getRole(message: MessageInput): MastraDBMessage['role'] {
    if (message.role === `assistant` || message.role === `tool`) return `assistant`;
    if (message.role === `user`) return `user`;
    if (message.role === `system`) return `system`;
    throw new Error(
      `BUG: add handling for message role ${message.role} in message ${JSON.stringify(message, null, 2)}`,
    );
  }

  private static cacheKeyFromAIV4Parts(parts: UIMessageV4['parts']): string {
    let key = ``;
    for (const part of parts) {
      key += part.type;
      if (part.type === `text`) {
        key += part.text;
      }
      if (part.type === `tool-invocation`) {
        key += part.toolInvocation.toolCallId;
        key += part.toolInvocation.state;
      }
      if (part.type === `reasoning`) {
        key += part.reasoning;
        key += part.details.reduce((prev, current) => {
          if (current.type === `text`) {
            return prev + current.text.length + (current.signature?.length || 0);
          }
          return prev;
        }, 0);
      }
      if (part.type === `file`) {
        key += part.data;
        key += part.mimeType;
      }
    }
    return key;
  }

  static coreContentToString(content: CoreMessageV4['content']): string {
    if (typeof content === `string`) return content;

    return content.reduce((p, c) => {
      if (c.type === `text`) {
        p += c.text;
      }
      return p;
    }, '');
  }

  private static cacheKeyFromAIV4CoreMessageContent(content: CoreMessageV4['content']): string {
    if (typeof content === `string`) return content;
    let key = ``;
    for (const part of content) {
      key += part.type;
      if (part.type === `text`) {
        key += part.text.length;
      }
      if (part.type === `reasoning`) {
        key += part.text.length;
      }
      if (part.type === `tool-call`) {
        key += part.toolCallId;
        key += part.toolName;
      }
      if (part.type === `tool-result`) {
        key += part.toolCallId;
        key += part.toolName;
      }
      if (part.type === `file`) {
        key += part.filename;
        key += part.mimeType;
      }
      if (part.type === `image`) {
        key += getImageCacheKey(part.image);
        key += part.mimeType;
      }
      if (part.type === `redacted-reasoning`) {
        key += part.data.length;
      }
    }
    return key;
  }

  private static messagesAreEqual(one: MessageInput, two: MessageInput) {
    const oneUIV4 = MessageList.isAIV4UIMessage(one) && one;
    const twoUIV4 = MessageList.isAIV4UIMessage(two) && two;
    if (oneUIV4 && !twoUIV4) return false;
    if (oneUIV4 && twoUIV4) {
      return MessageList.cacheKeyFromAIV4Parts(one.parts) === MessageList.cacheKeyFromAIV4Parts(two.parts);
    }

    const oneCMV4 = MessageList.isAIV4CoreMessage(one) && one;
    const twoCMV4 = MessageList.isAIV4CoreMessage(two) && two;
    if (oneCMV4 && !twoCMV4) return false;
    if (oneCMV4 && twoCMV4) {
      return (
        MessageList.cacheKeyFromAIV4CoreMessageContent(oneCMV4.content) ===
        MessageList.cacheKeyFromAIV4CoreMessageContent(twoCMV4.content)
      );
    }

    const oneMM1 = MessageList.isMastraMessageV1(one) && one;
    const twoMM1 = MessageList.isMastraMessageV1(two) && two;
    if (oneMM1 && !twoMM1) return false;
    if (oneMM1 && twoMM1) {
      return (
        oneMM1.id === twoMM1.id &&
        MessageList.cacheKeyFromAIV4CoreMessageContent(oneMM1.content) ===
          MessageList.cacheKeyFromAIV4CoreMessageContent(twoMM1.content)
      );
    }

    const oneMM2 = MessageList.isMastraDBMessage(one) && one;
    const twoMM2 = MessageList.isMastraDBMessage(two) && two;
    if (oneMM2 && !twoMM2) return false;
    if (oneMM2 && twoMM2) {
      return (
        oneMM2.id === twoMM2.id &&
        MessageList.cacheKeyFromAIV4Parts(oneMM2.content.parts) ===
          MessageList.cacheKeyFromAIV4Parts(twoMM2.content.parts)
      );
    }

    const oneUIV5 = MessageList.isAIV5UIMessage(one) && one;
    const twoUIV5 = MessageList.isAIV5UIMessage(two) && two;
    if (oneUIV5 && !twoUIV5) return false;
    if (oneUIV5 && twoUIV5) {
      return MessageList.cacheKeyFromAIV5Parts(one.parts) === MessageList.cacheKeyFromAIV5Parts(two.parts);
    }

    const oneCMV5 = MessageList.isAIV5CoreMessage(one) && one;
    const twoCMV5 = MessageList.isAIV5CoreMessage(two) && two;
    if (oneCMV5 && !twoCMV5) return false;
    if (oneCMV5 && twoCMV5) {
      return (
        MessageList.cacheKeyFromAIV5ModelMessageContent(oneCMV5.content) ===
        MessageList.cacheKeyFromAIV5ModelMessageContent(twoCMV5.content)
      );
    }

    // default to it did change. we'll likely never reach this codepath
    return true;
  }

  static aiV4CoreMessageToV1PromptMessage(coreMessage: CoreMessageV4): LanguageModelV1Message {
    if (coreMessage.role === `system`) {
      return coreMessage;
    }

    if (typeof coreMessage.content === `string` && (coreMessage.role === `assistant` || coreMessage.role === `user`)) {
      return {
        ...coreMessage,
        content: [{ type: 'text', text: coreMessage.content }],
      };
    }

    if (typeof coreMessage.content === `string`) {
      throw new Error(
        `Saw text content for input CoreMessage, but the role is ${coreMessage.role}. This is only allowed for "system", "assistant", and "user" roles.`,
      );
    }

    const roleContent: {
      user: Exclude<Extract<LanguageModelV1Message, { role: 'user' }>['content'], string>;
      assistant: Exclude<Extract<LanguageModelV1Message, { role: 'assistant' }>['content'], string>;
      tool: Exclude<Extract<LanguageModelV1Message, { role: 'tool' }>['content'], string>;
    } = {
      user: [],
      assistant: [],
      tool: [],
    };

    const role = coreMessage.role;

    for (const part of coreMessage.content) {
      const incompatibleMessage = `Saw incompatible message content part type ${part.type} for message role ${role}`;

      switch (part.type) {
        case 'text': {
          if (role === `tool`) {
            throw new Error(incompatibleMessage);
          }
          roleContent[role].push(part);
          break;
        }

        case 'redacted-reasoning':
        case 'reasoning': {
          if (role !== `assistant`) {
            throw new Error(incompatibleMessage);
          }
          roleContent[role].push(part);
          break;
        }

        case 'tool-call': {
          if (role === `tool` || role === `user`) {
            throw new Error(incompatibleMessage);
          }
          roleContent[role].push(part);
          break;
        }

        case 'tool-result': {
          if (role === `assistant` || role === `user`) {
            throw new Error(incompatibleMessage);
          }
          roleContent[role].push(part);
          break;
        }

        case 'image': {
          if (role === `tool` || role === `assistant`) {
            throw new Error(incompatibleMessage);
          }
          roleContent[role].push({
            ...part,
            image:
              part.image instanceof URL || part.image instanceof Uint8Array
                ? part.image
                : Buffer.isBuffer(part.image) || part.image instanceof ArrayBuffer
                  ? new Uint8Array(part.image)
                  : new URL(part.image),
          });
          break;
        }

        case 'file': {
          if (role === `tool`) {
            throw new Error(incompatibleMessage);
          }
          roleContent[role].push({
            ...part,
            data:
              part.data instanceof URL
                ? part.data
                : typeof part.data === 'string'
                  ? part.data
                  : convertDataContentToBase64String(part.data),
          });
          break;
        }
      }
    }

    if (role === `tool`) {
      return {
        ...coreMessage,
        content: roleContent[role],
      };
    }
    if (role === `user`) {
      return {
        ...coreMessage,
        content: roleContent[role],
      };
    }
    if (role === `assistant`) {
      return {
        ...coreMessage,
        content: roleContent[role],
      };
    }

    throw new Error(
      `Encountered unknown role ${role} when converting V4 CoreMessage -> V4 LanguageModelV1Prompt, input message: ${JSON.stringify(coreMessage, null, 2)}`,
    );
  }

  static aiV5ModelMessageToV2PromptMessage(modelMessage: AIV5Type.ModelMessage): AIV5LanguageModelV2Message {
    if (modelMessage.role === `system`) {
      return modelMessage;
    }

    if (
      typeof modelMessage.content === `string` &&
      (modelMessage.role === `assistant` || modelMessage.role === `user`)
    ) {
      return {
        role: modelMessage.role,
        content: [{ type: 'text', text: modelMessage.content }],
        providerOptions: modelMessage.providerOptions,
      };
    }

    if (typeof modelMessage.content === `string`) {
      throw new Error(
        `Saw text content for input ModelMessage, but the role is ${modelMessage.role}. This is only allowed for "system", "assistant", and "user" roles.`,
      );
    }

    const roleContent: {
      user: Extract<AIV5LanguageModelV2Message, { role: 'user' }>['content'];
      assistant: Extract<AIV5LanguageModelV2Message, { role: 'assistant' }>['content'];
      tool: Extract<AIV5LanguageModelV2Message, { role: 'tool' }>['content'];
    } = {
      user: [],
      assistant: [],
      tool: [],
    };

    const role = modelMessage.role;

    for (const part of modelMessage.content) {
      const incompatibleMessage = `Saw incompatible message content part type ${part.type} for message role ${role}`;

      switch (part.type) {
        case 'text': {
          if (role === `tool`) {
            throw new Error(incompatibleMessage);
          }
          roleContent[role].push(part);
          break;
        }

        case 'reasoning': {
          if (role === `tool` || role === `user`) {
            throw new Error(incompatibleMessage);
          }
          roleContent[role].push(part);
          break;
        }

        case 'tool-call': {
          if (role !== `assistant`) {
            throw new Error(incompatibleMessage);
          }
          roleContent[role].push(part);
          break;
        }

        case 'tool-result': {
          if (role === `assistant` || role === `user`) {
            throw new Error(incompatibleMessage);
          }
          roleContent[role].push(part);
          break;
        }

        case 'file': {
          if (role === `tool`) {
            throw new Error(incompatibleMessage);
          }
          roleContent[role].push({
            ...part,
            data: part.data instanceof ArrayBuffer ? new Uint8Array(part.data) : part.data,
          });
          break;
        }

        case 'image': {
          if (role === `tool`) {
            throw new Error(incompatibleMessage);
          }
          roleContent[role].push({
            ...part,
            mediaType: part.mediaType || 'image/unknown',
            type: 'file',
            data: part.image instanceof ArrayBuffer ? new Uint8Array(part.image) : part.image,
          });
          break;
        }
      }
    }

    if (role === `tool`) {
      return {
        ...modelMessage,
        content: roleContent[role],
      };
    }
    if (role === `user`) {
      return {
        ...modelMessage,
        content: roleContent[role],
      };
    }
    if (role === `assistant`) {
      return {
        ...modelMessage,
        content: roleContent[role],
      };
    }

    throw new Error(
      `Encountered unknown role ${role} when converting V5 ModelMessage -> V5 LanguageModelV2Message, input message: ${JSON.stringify(modelMessage, null, 2)}`,
    );
  }

  /**
   * Direct conversion from MastraDBMessage to AIV5 UIMessage
   */
  public static mastraDBMessageToAIV5UIMessage(dbMsg: MastraDBMessage): AIV5Type.UIMessage {
    const parts: AIV5Type.UIMessage['parts'] = [];
    const metadata: Record<string, unknown> = { ...(dbMsg.content.metadata || {}) };

    // Add Mastra-specific metadata
    if (dbMsg.createdAt) metadata.createdAt = dbMsg.createdAt;
    if (dbMsg.threadId) metadata.threadId = dbMsg.threadId;
    if (dbMsg.resourceId) metadata.resourceId = dbMsg.resourceId;

    // 1. Handle tool invocations (only if not already in parts array)
    // Parts array takes precedence because it has providerMetadata
    const hasToolInvocationParts = dbMsg.content.parts?.some(p => p.type === 'tool-invocation');
    if (dbMsg.content.toolInvocations && !hasToolInvocationParts) {
      for (const invocation of dbMsg.content.toolInvocations) {
        if (invocation.state === 'result') {
          parts.push({
            type: `tool-${invocation.toolName}`,
            toolCallId: invocation.toolCallId,
            state: 'output-available',
            input: invocation.args,
            output: invocation.result,
          } as unknown as AIV5Type.UIMessage['parts'][number]);
        } else {
          parts.push({
            type: `tool-${invocation.toolName}`,
            toolCallId: invocation.toolCallId,
            state: invocation.state === 'call' ? 'input-available' : 'input-streaming',
            input: invocation.args,
          } as unknown as AIV5Type.UIMessage['parts'][number]);
        }
      }
    }

    // 2. Check if we have parts with providerMetadata first
    const hasReasoningInParts = dbMsg.content.parts?.some(p => p.type === 'reasoning');
    const hasFileInParts = dbMsg.content.parts?.some(p => p.type === 'file');

    // 3. Handle reasoning (AIV4 reasoning is a string) - only if not in parts
    if (dbMsg.content.reasoning && !hasReasoningInParts) {
      parts.push({
        type: 'reasoning',
        text: dbMsg.content.reasoning,
      });
    }

    // 4. Handle files (experimental_attachments) - only if not in parts
    // Track attachment URLs to avoid duplicates when processing parts
    const attachmentUrls = new Set<string>();
    if (dbMsg.content.experimental_attachments && !hasFileInParts) {
      for (const attachment of dbMsg.content.experimental_attachments) {
        attachmentUrls.add(attachment.url);
        parts.push({
          type: 'file',
          url: attachment.url,
          mediaType: attachment.contentType || 'unknown',
        });
      }
    }

    // 5. Handle parts directly (if present in V2) - check this first as it has providerMetadata
    let hasNonToolReasoningParts = false;
    if (dbMsg.content.parts) {
      for (const part of dbMsg.content.parts) {
        // Handle tool-invocation parts
        if (part.type === 'tool-invocation' && part.toolInvocation) {
          const inv = part.toolInvocation;

          if (inv.state === 'result') {
            parts.push({
              type: `tool-${inv.toolName}`,
              toolCallId: inv.toolCallId,
              input: inv.args,
              output: inv.result,
              state: 'output-available',
              callProviderMetadata: part.providerMetadata,
            } satisfies AIV5Type.ToolUIPart);
          } else {
            parts.push({
              type: `tool-${inv.toolName}`,
              toolCallId: inv.toolCallId,
              input: inv.args,
              state: 'input-available',
              callProviderMetadata: part.providerMetadata,
            } satisfies AIV5Type.ToolUIPart);
          }
          continue;
        }

        // Handle reasoning parts
        if (part.type === 'reasoning') {
          // V2 reasoning parts can have either text directly or details array
          type V2ReasoningPart = {
            type: 'reasoning';
            text?: string;
            reasoning?: string;
            details?: Array<{ type: string; text?: string }>;
            providerMetadata?: AIV5Type.ProviderMetadata;
          };
          const reasoningPart = part as V2ReasoningPart;
          const text =
            reasoningPart.text ||
            reasoningPart.reasoning ||
            (reasoningPart.details?.reduce((p: string, c) => {
              if (c.type === `text` && c.text) return p + c.text;
              return p;
            }, '') ??
              '');
          if (text || reasoningPart.details?.length) {
            parts.push({
              type: 'reasoning',
              text: text || '',
              state: 'done',
              ...(part.providerMetadata && { providerMetadata: part.providerMetadata }),
            });
          }
          continue;
        }

        // Skip tool-invocation parts without toolInvocation object and other tool- parts
        if (part.type === 'tool-invocation' || part.type.startsWith('tool-')) {
          continue;
        }

        // Convert file parts from V2 format (data) to AIV5 format (url)
        if (part.type === 'file') {
          // Skip file parts that came from experimental_attachments to avoid duplicates
          if (typeof part.data === 'string' && attachmentUrls.has(part.data)) {
            continue;
          }

          const categorized =
            typeof part.data === 'string'
              ? categorizeFileData(part.data, part.mimeType)
              : { type: 'raw' as const, mimeType: part.mimeType, data: part.data };

          if (categorized.type === 'url' && typeof part.data === 'string') {
            // It's a URL, use the 'url' field directly
            parts.push({
              type: 'file',
              url: part.data,
              mediaType: categorized.mimeType || 'image/png',
              providerMetadata: part.providerMetadata,
            });
          } else {
            // For AI SDK V5 compatibility with inline images (especially Google Gemini),
            // file parts need a 'url' field with data URI
            let filePartData: string;
            let extractedMimeType = part.mimeType;

            // Parse data URI if present to extract base64 content and MIME type
            if (typeof part.data === 'string') {
              const parsed = parseDataUri(part.data);

              if (parsed.isDataUri) {
                // It's already a data URI, extract the base64 content and MIME type
                filePartData = parsed.base64Content;
                if (parsed.mimeType) {
                  extractedMimeType = extractedMimeType || parsed.mimeType;
                }
              } else {
                // It's not a data URI, treat it as raw base64 or plain text
                filePartData = part.data;
              }
            } else {
              filePartData = part.data;
            }

            // Ensure we always have a valid MIME type - default to image/png for better compatibility
            const finalMimeType = extractedMimeType || 'image/png';

            // Only create a data URI if it's not already one
            let dataUri: string;
            if (typeof filePartData === 'string' && filePartData.startsWith('data:')) {
              // Already a data URI
              dataUri = filePartData;
            } else {
              // Create a data URI from the base64 data
              dataUri = createDataUri(filePartData, finalMimeType);
            }

            parts.push({
              type: 'file',
              url: dataUri, // Use url field with data URI
              mediaType: finalMimeType,
              providerMetadata: part.providerMetadata,
            });
          }
        } else if (part.type === 'source') {
          // Convert V2 source parts to AIV5 source-url parts
          type V2SourcePart = {
            type: 'source';
            source: {
              url: string;
              sourceType: string;
              id: string;
              providerMetadata?: AIV5Type.ProviderMetadata;
            };
            providerMetadata?: AIV5Type.ProviderMetadata;
          };
          const sourcePart = part as V2SourcePart;
          parts.push({
            type: 'source-url',
            url: sourcePart.source.url,
            ...(part.providerMetadata && { providerMetadata: part.providerMetadata }),
          } as AIV5Type.SourceUrlUIPart);
        } else if (part.type === 'text') {
          // Text parts need providerMetadata preserved (only if defined)
          parts.push({
            type: 'text',
            text: part.text,
            ...(part.providerMetadata && { providerMetadata: part.providerMetadata }),
          });
          hasNonToolReasoningParts = true;
        } else {
          // Other parts (step-start, etc.) can be pushed as-is
          parts.push(part);
          hasNonToolReasoningParts = true;
        }
      }
    }

    // 5. Handle text content (fallback if no parts)
    if (dbMsg.content.content && !hasNonToolReasoningParts) {
      parts.push({ type: 'text', text: dbMsg.content.content });
    }

    return {
      id: dbMsg.id,
      role: dbMsg.role,
      metadata,
      parts,
    };
  }

  /**
   * Direct conversion from AIV5 UIMessage to MastraDBMessage
   * Combines logic from aiV5UIMessageToMastraMessageV3 + mastraMessageV3ToV2
   */
  private static aiV5UIMessageToMastraDBMessage(uiMsg: AIV5Type.UIMessage): MastraDBMessage {
    const { parts, metadata: rawMetadata } = uiMsg;
    const metadata = (rawMetadata || {}) as Record<string, unknown>;

    // Extract Mastra-specific metadata
    const createdAtValue = metadata.createdAt;
    const createdAt = createdAtValue
      ? typeof createdAtValue === 'string'
        ? new Date(createdAtValue)
        : createdAtValue instanceof Date
          ? createdAtValue
          : new Date()
      : new Date();
    const threadId = metadata.threadId as string | undefined;
    const resourceId = metadata.resourceId as string | undefined;

    // Remove Mastra-specific metadata from the metadata object
    const cleanMetadata = { ...metadata };
    delete cleanMetadata.createdAt;
    delete cleanMetadata.threadId;
    delete cleanMetadata.resourceId;

    // Process parts to build V2 content
    const toolInvocationParts = parts.filter(p => AIV5.isToolUIPart(p));
    const reasoningParts = parts.filter(p => p.type === 'reasoning');
    const fileParts = parts.filter(p => p.type === 'file');
    const textParts = parts.filter(p => p.type === 'text');

    // Build tool invocations array
    let toolInvocations: MastraDBMessage['content']['toolInvocations'] = undefined;
    if (toolInvocationParts.length > 0) {
      toolInvocations = toolInvocationParts.map(p => {
        const toolName = getToolName(p);
        if (p.state === 'output-available') {
          return {
            args: p.input,
            result:
              typeof p.output === 'object' && p.output && 'value' in p.output
                ? (p.output as { value: unknown }).value
                : p.output,
            toolCallId: p.toolCallId,
            toolName,
            state: 'result',
          } satisfies NonNullable<MastraDBMessage['content']['toolInvocations']>[0];
        }
        return {
          args: p.input,
          toolCallId: p.toolCallId,
          toolName,
          state: 'call',
        } satisfies NonNullable<MastraDBMessage['content']['toolInvocations']>[0];
      });
    }

    // Build reasoning string (AIV4 reasoning is a string, not an array)
    let reasoning: MastraDBMessage['content']['reasoning'] = undefined;
    if (reasoningParts.length > 0) {
      reasoning = reasoningParts.map(p => p.text).join('\n');
    }

    // Build experimental_attachments from file parts
    let experimental_attachments: MastraDBMessage['content']['experimental_attachments'] = undefined;
    if (fileParts.length > 0) {
      experimental_attachments = fileParts.map(p => ({
        url: p.url || '',
        contentType: p.mediaType,
      }));
    }

    // Build content from text parts (AIV4 content is a string)
    let content: MastraDBMessage['content']['content'] = undefined;
    if (textParts.length > 0) {
      content = textParts.map(p => p.text).join('');
    }
    // Build V2-compatible parts array
    const v2Parts = parts
      .map(p => {
        // Convert AIV5 UI parts to V2 parts
        if (AIV5.isToolUIPart(p)) {
          const toolName = getToolName(p);
          // AIV5 tool parts have callProviderMetadata, map it to V2's providerMetadata
          const callProviderMetadata = 'callProviderMetadata' in p ? p.callProviderMetadata : undefined;
          if (p.state === 'output-available') {
            return {
              type: 'tool-invocation' as const,
              toolInvocation: {
                toolCallId: p.toolCallId,
                toolName,
                args: p.input,
                result:
                  typeof p.output === 'object' && p.output && 'value' in p.output
                    ? (p.output as { value: unknown }).value
                    : p.output,
                state: 'result' as const,
              },
              providerMetadata: callProviderMetadata,
            } satisfies ToolInvocationUIPart & { providerMetadata?: AIV5Type.ProviderMetadata };
          }
          return {
            type: 'tool-invocation' as const,
            toolInvocation: {
              toolCallId: p.toolCallId,
              toolName,
              args: p.input,
              state: 'call' as const,
            },
            providerMetadata: callProviderMetadata,
          } satisfies ToolInvocationUIPart & { providerMetadata?: AIV5Type.ProviderMetadata };
        }

        if (p.type === 'reasoning') {
          return {
            type: 'reasoning' as const,
            reasoning: '',
            details: [
              {
                type: 'text' as const,
                text: p.text,
              },
            ],
            providerMetadata: p.providerMetadata,
          };
        }

        if (p.type === 'file') {
          // Convert AIV5 file part (url) to V2 file part (data)
          return {
            type: 'file' as const,
            mimeType: p.mediaType,
            data: p.url || '',
            providerMetadata: p.providerMetadata,
          };
        }

        if (p.type === 'source-url') {
          return {
            type: 'source' as const,
            source: {
              url: p.url,
              sourceType: 'url',
              id: p.url, // Use URL as ID
              providerMetadata: p.providerMetadata,
            },
            providerMetadata: p.providerMetadata,
          };
        }

        if (p.type === 'text') {
          type V2TextPart = {
            type: 'text';
            text: string;
            providerMetadata?: AIV5Type.ProviderMetadata;
          };
          return {
            type: 'text' as const,
            text: p.text,
            providerMetadata: p.providerMetadata,
          } satisfies V2TextPart;
        }

        if (p.type === 'step-start') {
          return p;
        }

        return null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    return {
      id: uiMsg.id,
      role: uiMsg.role,
      createdAt,
      threadId,
      resourceId,
      content: {
        format: 2,
        parts: v2Parts as MastraMessageContentV2['parts'],
        toolInvocations,
        reasoning,
        experimental_attachments,
        content,
        metadata: Object.keys(cleanMetadata).length > 0 ? cleanMetadata : undefined,
      },
    };
  }

  /**
   * Direct conversion from AIV5 ModelMessage to MastraDBMessage
   * Combines logic from aiV5ModelMessageToMastraMessageV3 + mastraMessageV3ToV2
   */
  private static aiV5ModelMessageToMastraDBMessage(
    modelMsg: AIV5Type.ModelMessage,
    _messageSource?: MessageSource,
  ): MastraDBMessage {
    const content = Array.isArray(modelMsg.content) ? modelMsg.content : [{ type: 'text', text: modelMsg.content }];

    // Process parts to build V2 content structure
    const v2Parts: MastraMessageContentV2['parts'] = [];
    const toolInvocations: NonNullable<MastraDBMessage['content']['toolInvocations']> = [];
    const reasoningParts: string[] = [];
    const experimental_attachments: NonNullable<MastraDBMessage['content']['experimental_attachments']> = [];
    const textParts: Array<{ text: string; providerMetadata?: Record<string, unknown> }> = [];

    let lastPartWasToolResult = false;

    // Type helper for objects that may have providerMetadata at runtime
    type WithProviderMetadata = { providerMetadata?: Record<string, unknown> };

    for (const part of content) {
      // Merge part-level and message-level providerMetadata
      const providerMetadata = {
        ...((modelMsg as WithProviderMetadata).providerMetadata || {}),
        ...((part as WithProviderMetadata).providerMetadata || {}),
      };
      const hasProviderMetadata = Object.keys(providerMetadata).length > 0;

      if (part.type === 'text') {
        const textPart: AIV4Type.TextPart = {
          type: 'text',
          text: part.text,
          ...(hasProviderMetadata && { experimental_providerMetadata: providerMetadata as AIV5Type.ProviderMetadata }),
        };
        v2Parts.push(textPart);
        textParts.push({ text: part.text, providerMetadata: hasProviderMetadata ? providerMetadata : undefined });
        lastPartWasToolResult = false;
      } else if (part.type === 'tool-call') {
        const toolCallPart = part as AIV5Type.ToolCallPart;
        const toolInvocationPart: UIMessageV4['parts'][number] & {
          providerMetadata?: AIV5Type.ProviderMetadata;
        } = {
          type: 'tool-invocation',
          toolInvocation: {
            toolCallId: toolCallPart.toolCallId,
            toolName: toolCallPart.toolName,
            args: toolCallPart.input,
            state: 'call',
          },
          ...(hasProviderMetadata && { providerMetadata: providerMetadata as AIV5Type.ProviderMetadata }),
        };
        v2Parts.push(toolInvocationPart);
        toolInvocations.push({
          toolCallId: toolCallPart.toolCallId,
          toolName: toolCallPart.toolName,
          args: toolCallPart.input,
          state: 'call',
        });
        lastPartWasToolResult = false;
      } else if (part.type === 'tool-result') {
        const toolResultPart = part as AIV5Type.ToolResultPart;
        // Find matching tool call and update it to result state
        const matchingCall = toolInvocations.find(inv => inv.toolCallId === toolResultPart.toolCallId);

        // Type guard for tool-invocation parts
        type ToolInvocationPart = Extract<UIMessageV4['parts'][number], { type: 'tool-invocation' }>;
        const matchingV2Part = v2Parts.find(
          (p): p is ToolInvocationPart =>
            p.type === 'tool-invocation' &&
            'toolInvocation' in p &&
            p.toolInvocation.toolCallId === toolResultPart.toolCallId,
        );

        if (matchingCall) {
          // Update the matching call to result state
          matchingCall.state = 'result';
          (matchingCall as ToolInvocationV4 & { result: unknown }).result =
            typeof toolResultPart.output === 'object' && toolResultPart.output && 'value' in toolResultPart.output
              ? (toolResultPart.output as { value: unknown }).value
              : toolResultPart.output;
        } else {
          // No matching call, create a result-only invocation
          // toolResultPart may have toolName at runtime even though it's not in the type
          type ToolResultWithName = AIV5Type.ToolResultPart & { toolName?: string };
          const resultPartWithName = toolResultPart as ToolResultWithName;

          toolInvocations.push({
            toolCallId: toolResultPart.toolCallId,
            toolName: resultPartWithName.toolName || 'unknown',
            args: {},
            result:
              typeof toolResultPart.output === 'object' && toolResultPart.output && 'value' in toolResultPart.output
                ? (toolResultPart.output as { value: unknown }).value
                : toolResultPart.output,
            state: 'result',
          });
        }

        if (matchingV2Part && matchingV2Part.type === 'tool-invocation') {
          // Update the matching part to result state
          matchingV2Part.toolInvocation.state = 'result';
          (matchingV2Part.toolInvocation as ToolInvocationV4 & { result: unknown }).result =
            typeof toolResultPart.output === 'object' && toolResultPart.output && 'value' in toolResultPart.output
              ? (toolResultPart.output as { value: unknown }).value
              : toolResultPart.output;
          if (hasProviderMetadata) {
            (
              matchingV2Part as typeof matchingV2Part & { providerMetadata: AIV5Type.ProviderMetadata }
            ).providerMetadata = providerMetadata as AIV5Type.ProviderMetadata;
          }
        } else {
          // No matching call, create a result-only part
          // toolResultPart may have toolName at runtime even though it's not in the type
          type ToolResultWithName = AIV5Type.ToolResultPart & { toolName?: string };
          const resultPartWithName = toolResultPart as ToolResultWithName;

          const toolInvocationPart: UIMessageV4['parts'][number] & {
            providerMetadata?: AIV5Type.ProviderMetadata;
          } = {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: toolResultPart.toolCallId,
              toolName: resultPartWithName.toolName || 'unknown',
              args: {},
              result:
                typeof toolResultPart.output === 'object' && toolResultPart.output && 'value' in toolResultPart.output
                  ? (toolResultPart.output as { value: unknown }).value
                  : toolResultPart.output,
              state: 'result',
            } as ToolInvocationV4 & { result: unknown },
            ...(hasProviderMetadata && { providerMetadata: providerMetadata as AIV5Type.ProviderMetadata }),
          };
          v2Parts.push(toolInvocationPart);
        }
        lastPartWasToolResult = true;
      } else if (part.type === 'reasoning') {
        const reasoningPart = part as AIV5Type.ReasoningUIPart;
        const v2ReasoningPart: UIMessageV4['parts'][number] & { providerMetadata?: AIV5Type.ProviderMetadata } = {
          type: 'reasoning',
          reasoning: reasoningPart.text,
          details: [{ type: 'text', text: reasoningPart.text }],
          ...(hasProviderMetadata && { providerMetadata: providerMetadata as AIV5Type.ProviderMetadata }),
        };
        v2Parts.push(v2ReasoningPart);
        reasoningParts.push(reasoningPart.text);
        lastPartWasToolResult = false;
      } else if (part.type === 'image') {
        const imagePart = part as AIV5Type.ImagePart;
        // Convert image to data URI or URL for V2 file part
        let imageData: string;
        // ImagePart may have mimeType at runtime even though it's not in the type
        type ImagePartWithMimeType = AIV5Type.ImagePart & { mimeType?: string };
        const mimeType = (imagePart as ImagePartWithMimeType).mimeType || 'image/jpeg';

        if ('url' in imagePart && typeof imagePart.url === 'string') {
          imageData = imagePart.url;
        } else if ('data' in imagePart) {
          if (typeof imagePart.data === 'string') {
            imageData =
              imagePart.data.startsWith('data:') || imagePart.data.startsWith('http')
                ? imagePart.data
                : `data:${mimeType};base64,${imagePart.data}`;
          } else {
            const base64 = Buffer.from(imagePart.data as Uint8Array).toString('base64');
            imageData = `data:${mimeType};base64,${base64}`;
          }
        } else {
          imageData = '';
        }

        const imageFilePart: UIMessageV4['parts'][number] & { providerMetadata?: AIV5Type.ProviderMetadata } = {
          type: 'file',
          data: imageData,
          mimeType,
          ...(hasProviderMetadata && { providerMetadata: providerMetadata as AIV5Type.ProviderMetadata }),
        };
        v2Parts.push(imageFilePart);
        experimental_attachments.push({
          url: imageData,
          contentType: mimeType,
        });
        lastPartWasToolResult = false;
      } else if (part.type === 'file') {
        const filePart = part as AIV5Type.FilePart;
        // AIV5 ModelMessage file parts use 'mediaType'
        // V2 file parts use 'mimeType'
        const mimeType = filePart.mediaType || 'application/octet-stream';
        let fileData: string;
        if ('url' in filePart && typeof filePart.url === 'string') {
          fileData = filePart.url;
        } else if ('data' in filePart) {
          if (typeof filePart.data === 'string') {
            fileData =
              filePart.data.startsWith('data:') || filePart.data.startsWith('http')
                ? filePart.data
                : `data:${mimeType};base64,${filePart.data}`;
          } else {
            const base64 = Buffer.from(filePart.data as Uint8Array).toString('base64');
            fileData = `data:${mimeType};base64,${base64}`;
          }
        } else {
          fileData = '';
        }

        const v2FilePart: UIMessageV4['parts'][number] & { providerMetadata?: AIV5Type.ProviderMetadata } = {
          type: 'file',
          data: fileData,
          mimeType,
          ...(hasProviderMetadata && { providerMetadata: providerMetadata as AIV5Type.ProviderMetadata }),
        };
        v2Parts.push(v2FilePart);
        experimental_attachments.push({
          url: fileData,
          contentType: mimeType,
        });
        lastPartWasToolResult = false;
      }
    }

    // Insert step-start if assistant message starts after tool result
    if (modelMsg.role === 'assistant' && lastPartWasToolResult && v2Parts.length > 0) {
      const lastPart = v2Parts[v2Parts.length - 1];
      if (lastPart && lastPart.type !== 'text') {
        const emptyTextPart: UIMessageV4['parts'][number] = { type: 'text', text: '' };
        v2Parts.push(emptyTextPart);
        textParts.push({ text: '' });
      }
    }

    // Build V2 content string
    let contentString: MastraDBMessage['content']['content'] = undefined;
    if (textParts.length > 0) {
      contentString = textParts.map(p => p.text).join('\n');
    }

    // Store original content in metadata for round-trip
    const metadata: Record<string, unknown> = {};

    // Generate ID from modelMsg if available, otherwise create a new one
    const id =
      `id` in modelMsg && typeof modelMsg.id === `string`
        ? modelMsg.id
        : `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      id,
      role: MessageList.getRole(modelMsg),
      createdAt: new Date(),
      content: {
        format: 2,
        parts: v2Parts,
        toolInvocations: toolInvocations.length > 0 ? toolInvocations : undefined,
        reasoning: reasoningParts.length > 0 ? reasoningParts.join('\n') : undefined,
        experimental_attachments: experimental_attachments.length > 0 ? experimental_attachments : undefined,
        content: contentString,
        metadata,
      },
    };
  }

  private aiV4CoreMessagesToAIV5ModelMessages(
    messages: CoreMessageV4[],
    source: MessageSource,
  ): AIV5Type.ModelMessage[] {
    return this.aiV5UIMessagesToAIV5ModelMessages(
      messages
        .map(m => this.aiV4CoreMessageToMastraDBMessage(m, source))
        .map(m => MessageList.mastraDBMessageToAIV5UIMessage(m)),
    );
  }

  private aiV5UIMessagesToAIV5ModelMessages(
    messages: AIV5Type.UIMessage[],
    filterIncompleteToolCalls = false,
  ): AIV5Type.ModelMessage[] {
    const sanitized = this.sanitizeV5UIMessages(messages, filterIncompleteToolCalls);
    const preprocessed = this.addStartStepPartsForAIV5(sanitized);
    const result = AIV5.convertToModelMessages(preprocessed);
    return result;
  }

  private addStartStepPartsForAIV5(messages: AIV5Type.UIMessage[]): AIV5Type.UIMessage[] {
    for (const message of messages) {
      if (message.role !== `assistant`) continue;
      for (const [index, part] of message.parts.entries()) {
        if (!AIV5.isToolUIPart(part)) continue;
        // If we don't insert step-start between tools and other parts, AIV5.convertToModelMessages will incorrectly add extra tool parts in the wrong order
        // ex: ui message with parts: [tool-result, text] becomes [assistant-message-with-both-parts, tool-result-message], when it should become [tool-call-message, tool-result-message, text-message]
        if (message.parts.at(index + 1)?.type !== `step-start`) {
          message.parts.splice(index + 1, 0, { type: 'step-start' });
        }
      }
    }
    return messages;
  }

  private sanitizeV5UIMessages(
    messages: AIV5Type.UIMessage[],
    filterIncompleteToolCalls = false,
  ): AIV5Type.UIMessage[] {
    const msgs = messages
      .map(m => {
        if (m.parts.length === 0) return false;
        // Filter out streaming states and optionally input-available (which aren't supported by convertToModelMessages)
        const safeParts = m.parts.filter(p => {
          if (!AIV5.isToolUIPart(p)) return true;

          // When sending messages TO the LLM: only keep completed tool calls (output-available/output-error)
          // This filters out input-available (incomplete client-side tool calls) and input-streaming
          if (filterIncompleteToolCalls) {
            return p.state === 'output-available' || p.state === 'output-error';
          }

          // When processing response messages FROM the LLM: keep input-available states
          // (tool calls waiting for client-side execution) but filter out input-streaming
          return p.state !== 'input-streaming';
        });

        if (!safeParts.length) return false;

        const sanitized = {
          ...m,
          parts: safeParts.map(part => {
            if (AIV5.isToolUIPart(part) && part.state === 'output-available') {
              return {
                ...part,
                output:
                  typeof part.output === 'object' && part.output && 'value' in part.output
                    ? part.output.value
                    : part.output,
              };
            }
            return part;
          }),
        };

        return sanitized;
      })
      .filter((m): m is AIV5Type.UIMessage => Boolean(m));
    return msgs;
  }

  static hasAIV5UIMessageCharacteristics(
    msg: AIV5Type.UIMessage | UIMessageV4 | AIV4Type.Message,
  ): msg is AIV5Type.UIMessage {
    // ai v4 has these separated arrays of parts that don't record overall order
    // so we can check for their presence as a faster/early check
    if (
      `toolInvocations` in msg ||
      `reasoning` in msg ||
      `experimental_attachments` in msg ||
      `data` in msg ||
      `annotations` in msg
      // don't check `content` in msg because it fully narrows the type to v5 and there's a chance someone might mess up and add content to a v5 message, that's more likely than the other keys
    )
      return false;

    if (!msg.parts) return false; // this is likely an AIV4Type.Message

    for (const part of msg.parts) {
      if (`metadata` in part) return true;

      // tools are annoying cause ai v5 has the type as
      // tool-${toolName}
      // in v4 we had tool-invocation
      // technically
      // v4 tool
      if (`toolInvocation` in part) return false;
      // v5 tool
      if (`toolCallId` in part) return true;

      if (part.type === `source`) return false;
      if (part.type === `source-url`) return true;

      if (part.type === `reasoning`) {
        if (`state` in part || `text` in part) return true; // v5
        if (`reasoning` in part || `details` in part) return false; // v4
      }

      if (part.type === `file` && `mediaType` in part) return true;
    }

    return false; // default to v4 for backwards compat
  }
  static isAIV5UIMessage(msg: MessageInput): msg is AIV5Type.UIMessage {
    return (
      !MessageList.isMastraMessage(msg) &&
      !MessageList.isAIV5CoreMessage(msg) &&
      `parts` in msg &&
      MessageList.hasAIV5UIMessageCharacteristics(msg)
    );
  }

  static hasAIV5CoreMessageCharacteristics(
    msg:
      | CoreMessageV4
      | AIV5Type.ModelMessage
      // This is here because AIV4 "Message" type can omit parts! 😱
      | AIV4Type.Message,
  ): msg is AIV5Type.ModelMessage {
    if (`experimental_providerMetadata` in msg) return false; // is v4 cause v5 doesn't have this property

    // it's compatible with either if content is a string, no difference
    if (typeof msg.content === `string`) return false; // default to v4 for backwards compat

    for (const part of msg.content) {
      if (part.type === `tool-result` && `output` in part) return true; // v5 renamed result->output,
      if (part.type === `tool-call` && `input` in part) return true; // v5 renamed args->input
      if (part.type === `tool-result` && `result` in part) return false; // v5 renamed result->output,
      if (part.type === `tool-call` && `args` in part) return false; // v5 renamed args->input

      // for file and image
      if (`mediaType` in part) return true; // v5 renamed mimeType->mediaType
      if (`mimeType` in part) return false;

      // applies to multiple part types
      if (`experimental_providerMetadata` in part) return false; // was in v4 but deprecated for providerOptions, v4+5 have providerOptions though, can't check the other way

      if (part.type === `reasoning` && `signature` in part) return false; // v5 doesn't have signature, which is optional in v4

      if (part.type === `redacted-reasoning`) return false; // only in v4, seems like in v5 they add it to providerOptions or something? https://github.com/vercel/ai/blob/main/packages/codemod/src/codemods/v5/replace-redacted-reasoning-type.ts#L90
    }

    return false; // default to v4 for backwards compat
  }

  private static cacheKeyFromAIV5Parts(parts: AIV5Type.UIMessage['parts']): string {
    let key = ``;
    for (const part of parts) {
      key += part.type;
      if (part.type === `text`) {
        key += part.text;
      }
      if (AIV5.isToolUIPart(part) || part.type === 'dynamic-tool') {
        key += part.toolCallId;
        key += part.state;
      }
      if (part.type === `reasoning`) {
        key += part.text;
      }
      if (part.type === `file`) {
        key += part.url.length;
        key += part.mediaType;
        key += part.filename || '';
      }
    }
    return key;
  }

  private static cacheKeyFromAIV5ModelMessageContent(content: AIV5Type.ModelMessage['content']): string {
    if (typeof content === `string`) return content;
    let key = ``;
    for (const part of content) {
      key += part.type;
      if (part.type === `text`) {
        key += part.text.length;
      }
      if (part.type === `reasoning`) {
        key += part.text.length;
      }
      if (part.type === `tool-call`) {
        key += part.toolCallId;
        key += part.toolName;
      }
      if (part.type === `tool-result`) {
        key += part.toolCallId;
        key += part.toolName;
      }
      if (part.type === `file`) {
        key += part.filename;
        key += part.mediaType;
      }
      if (part.type === `image`) {
        key += getImageCacheKey(part.image);
        key += part.mediaType;
      }
    }
    return key;
  }
}
