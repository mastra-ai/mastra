import { randomUUID } from 'crypto';
import type { LanguageModelV1Message } from '@ai-sdk/provider';
import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import * as AIV4 from 'ai';
import * as AIV5 from 'ai-v5';

import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import { DefaultGeneratedFileWithType } from '../../stream/aisdk/v5/file';
import { convertImageFilePart } from './prompt/convert-file';
import { convertToV1Messages } from './prompt/convert-to-mastra-v1';
import { convertDataContentToBase64String } from './prompt/data-content';
import { downloadAssetsFromMessages } from './prompt/download-assets';
import type { AIV4Type, AIV5Type } from './types';
import { getToolName } from './utils/ai-v5/tool';

type AIV5LanguageModelV2Message = LanguageModelV2Prompt[0];
type AIV5ResponseMessage = AIV5.StepResult<any>['response']['messages'][number];

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
  parts: (AIV4Type.UIMessage['parts'][number] & { providerMetadata?: AIV5Type.ProviderMetadata })[]; // add optional prov meta for AIV5 - v4 doesn't track this, and we're storing mmv2 in the db, so we need to extend
  experimental_attachments?: AIV4Type.UIMessage['experimental_attachments'];
  content?: AIV4Type.UIMessage['content'];
  toolInvocations?: AIV4Type.UIMessage['toolInvocations'];
  reasoning?: AIV4Type.UIMessage['reasoning'];
  annotations?: AIV4Type.UIMessage['annotations'];
  metadata?: Record<string, unknown>;
};

// maps to AI SDK V4 UIMessage
export type MastraMessageV2 = MastraMessageShared & {
  content: MastraMessageContentV2;
};

export type MastraMessageContentV3 = {
  format: 3; // format 3 === UIMessage in AI SDK v5
  parts: AIV5Type.UIMessage['parts'];
  metadata?: AIV5Type.UIMessage['metadata'];
};

// maps to AI SDK V5 UIMessage
export type MastraMessageV3 = MastraMessageShared & {
  role: AIV5Type.UIMessage['role'];
  content: MastraMessageContentV3;
};

export type MastraMessageV1 = {
  id: string;
  content: string | AIV4Type.CoreMessage['content'];
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
export type UIMessageWithMetadata = AIV4Type.UIMessage & {
  metadata?: Record<string, unknown>;
};

export type MessageInput =
  | AIV5Type.UIMessage
  | AIV5Type.ModelMessage
  | UIMessageWithMetadata
  | AIV4Type.Message
  | AIV4Type.CoreMessage // v4 CoreMessage support
  // db messages in various formats
  | MastraMessageV1
  | MastraMessageV2 // <- this is how we currently store in the DB
  | MastraMessageV3; // <- this could be stored in the db but is not currently. we do accept this as an input though, and we use it to transform from aiv4->v5 types as an intermediary type

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
  private messages: MastraMessageV2[] = [];

  // passed in by dev in input or context
  private systemMessages: AIV4Type.CoreSystemMessage[] = [];
  // passed in by us for a specific purpose, eg memory system message
  private taggedSystemMessages: Record<string, AIV4Type.CoreSystemMessage[]> = {};

  private memoryInfo: null | MemoryInfo = null;

  // used to filter this.messages by how it was added: input/response/memory
  private memoryMessages = new Set<MastraMessageV2>();
  private newUserMessages = new Set<MastraMessageV2>();
  private newResponseMessages = new Set<MastraMessageV2>();
  private userContextMessages = new Set<MastraMessageV2>();

  private memoryMessagesPersisted = new Set<MastraMessageV2>();
  private newUserMessagesPersisted = new Set<MastraMessageV2>();
  private newResponseMessagesPersisted = new Set<MastraMessageV2>();
  private userContextMessagesPersisted = new Set<MastraMessageV2>();

  private generateMessageId?: AIV4Type.IdGenerator;
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
        v2: (): MastraMessageV2[] => {
          const userMessages = Array.from(this.newUserMessages);
          this.messages = this.messages.filter(m => !this.newUserMessages.has(m));
          this.newUserMessages.clear();
          return userMessages;
        },
      },
      response: {
        v2: () => {
          const responseMessages = Array.from(this.newResponseMessages);
          this.messages = this.messages.filter(m => !this.newResponseMessages.has(m));
          this.newResponseMessages.clear();
          return responseMessages;
        },
      },
    };
  }

  private all = {
    v3: (): MastraMessageV3[] => this.cleanV3Metadata(this.messages.map(this.mastraMessageV2ToMastraMessageV3)),
    v2: (): MastraMessageV2[] => this.messages,
    v1: (): MastraMessageV1[] => convertToV1Messages(this.all.v2()),

    aiV5: {
      model: (): AIV5Type.ModelMessage[] => this.aiV5UIMessagesToAIV5ModelMessages(this.all.aiV5.ui()),
      ui: (): AIV5Type.UIMessage[] => this.all.v3().map(MessageList.mastraMessageV3ToAIV5UIMessage),

      // Used when calling AI SDK streamText/generateText
      prompt: (): AIV5Type.ModelMessage[] => {
        const messages = [
          ...this.aiV4CoreMessagesToAIV5ModelMessages(
            [...this.systemMessages, ...Object.values(this.taggedSystemMessages).flat()],
            `system`,
          ),
          ...this.all.aiV5.model(),
        ];

        const needsDefaultUserMessage = !messages.length || messages[0]?.role === 'assistant';
        if (needsDefaultUserMessage) {
          const defaultMessage: AIV5Type.ModelMessage = {
            role: 'user',
            content: '.',
          };
          messages.unshift(defaultMessage);
        }

        return messages;
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
        const modelMessages = this.all.aiV5.model();
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

        // Ensure we have at least one user message
        const needsDefaultUserMessage = !messages.length || messages[0]?.role === 'assistant';
        if (needsDefaultUserMessage) {
          const defaultMessage: AIV5Type.ModelMessage = {
            role: 'user',
            content: '.',
          };
          messages.unshift(defaultMessage);
        }

        return messages.map(MessageList.aiV5ModelMessageToV2PromptMessage);
      },
    },

    /* @deprecated use list.get.all.aiV4.prompt() instead */
    prompt: () => this.all.aiV4.prompt(),
    /* @deprecated use list.get.all.aiV4.ui() */
    ui: (): UIMessageWithMetadata[] => this.all.v2().map(MessageList.mastraMessageV2ToAIV4UIMessage),
    /* @deprecated use list.get.all.aiV4.core() */
    core: (): AIV4Type.CoreMessage[] => this.aiV4UIMessagesToAIV4CoreMessages(this.all.aiV4.ui()),
    aiV4: {
      ui: (): UIMessageWithMetadata[] => this.all.v2().map(MessageList.mastraMessageV2ToAIV4UIMessage),
      core: (): AIV4Type.CoreMessage[] => this.aiV4UIMessagesToAIV4CoreMessages(this.all.aiV4.ui()),

      // Used when calling AI SDK streamText/generateText
      prompt: () => {
        const coreMessages = this.all.aiV4.core();
        const messages = [...this.systemMessages, ...Object.values(this.taggedSystemMessages).flat(), ...coreMessages];

        const needsDefaultUserMessage = !messages.length || messages[0]?.role === 'assistant';
        if (needsDefaultUserMessage) {
          const defaultMessage: AIV4Type.CoreMessage = {
            role: 'user',
            content: '.',
          };
          messages.unshift(defaultMessage);
        }

        return messages;
      },

      // Used for creating LLM prompt messages without AI SDK streamText/generateText
      llmPrompt: (): AIV4Type.LanguageModelV1Prompt => {
        const coreMessages = this.all.aiV4.core();

        const systemMessages = [...this.systemMessages, ...Object.values(this.taggedSystemMessages).flat()];
        const messages = [...systemMessages, ...coreMessages];

        // Ensure we have at least one user message
        const needsDefaultUserMessage = !messages.length || messages[0]?.role === 'assistant';

        if (needsDefaultUserMessage) {
          const defaultMessage: AIV4Type.CoreMessage = {
            role: 'user',
            content: '.',
          };
          messages.unshift(defaultMessage);
        }

        return messages.map(MessageList.aiV4CoreMessageToV1PromptMessage);
      },
    },
  };

  private remembered = {
    v3: () => this.remembered.v2().map(this.mastraMessageV2ToMastraMessageV3),
    v2: () => this.messages.filter(m => this.memoryMessages.has(m)),
    v1: () => convertToV1Messages(this.remembered.v2()),

    aiV5: {
      model: () => this.aiV5UIMessagesToAIV5ModelMessages(this.remembered.aiV5.ui()),
      ui: (): AIV5Type.UIMessage[] => this.remembered.v3().map(MessageList.mastraMessageV3ToAIV5UIMessage),
    },

    /* @deprecated use list.get.remembered.aiV4.ui() */
    ui: (): UIMessageWithMetadata[] => this.remembered.v2().map(MessageList.mastraMessageV2ToAIV4UIMessage),
    /* @deprecated use list.get.remembered.aiV4.core() */
    core: (): AIV4Type.CoreMessage[] => this.aiV4UIMessagesToAIV4CoreMessages(this.all.aiV4.ui()),
    aiV4: {
      ui: (): UIMessageWithMetadata[] => this.remembered.v2().map(MessageList.mastraMessageV2ToAIV4UIMessage),
      core: (): AIV4Type.CoreMessage[] => this.aiV4UIMessagesToAIV4CoreMessages(this.all.aiV4.ui()),
    },
  };
  // TODO: need to update this for new .aiV4/5.x() pattern
  private rememberedPersisted = {
    v2: () => this.all.v2().filter(m => this.memoryMessagesPersisted.has(m)),
    v1: () => convertToV1Messages(this.rememberedPersisted.v2()),
    ui: () => this.rememberedPersisted.v2().map(MessageList.mastraMessageV2ToAIV4UIMessage),
    core: () => this.aiV4UIMessagesToAIV4CoreMessages(this.rememberedPersisted.ui()),
  };

  private input = {
    v3: () =>
      this.cleanV3Metadata(
        this.messages.filter(m => this.newUserMessages.has(m)).map(this.mastraMessageV2ToMastraMessageV3),
      ),
    v2: () => this.messages.filter(m => this.newUserMessages.has(m)),
    v1: () => convertToV1Messages(this.input.v2()),

    aiV5: {
      model: () => this.aiV5UIMessagesToAIV5ModelMessages(this.input.aiV5.ui()),
      ui: (): AIV5Type.UIMessage[] => this.input.v3().map(MessageList.mastraMessageV3ToAIV5UIMessage),
    },

    /* @deprecated use list.get.input.aiV4.ui() instead */
    ui: () => this.input.v2().map(MessageList.mastraMessageV2ToAIV4UIMessage),
    /* @deprecated use list.get.core.aiV4.ui() instead */
    core: () => this.aiV4UIMessagesToAIV4CoreMessages(this.input.ui()),
    aiV4: {
      ui: (): UIMessageWithMetadata[] => this.input.v2().map(MessageList.mastraMessageV2ToAIV4UIMessage),
      core: (): AIV4Type.CoreMessage[] => this.aiV4UIMessagesToAIV4CoreMessages(this.input.aiV4.ui()),
    },
  };
  // TODO: need to update this for new .aiV4/5.x() pattern
  private inputPersisted = {
    v3: (): MastraMessageV3[] =>
      this.cleanV3Metadata(
        this.messages.filter(m => this.newUserMessagesPersisted.has(m)).map(this.mastraMessageV2ToMastraMessageV3),
      ),
    v2: (): MastraMessageV2[] => this.messages.filter(m => this.newUserMessagesPersisted.has(m)),
    v1: (): MastraMessageV1[] => convertToV1Messages(this.inputPersisted.v2()),
    ui: (): UIMessageWithMetadata[] => this.inputPersisted.v2().map(MessageList.mastraMessageV2ToAIV4UIMessage),
    core: () => this.aiV4UIMessagesToAIV4CoreMessages(this.inputPersisted.ui()),
  };

  private response = {
    v3: (): MastraMessageV3[] => this.response.v2().map(this.mastraMessageV2ToMastraMessageV3),
    v2: (): MastraMessageV2[] => this.messages.filter(m => this.newResponseMessages.has(m)),
    v1: (): MastraMessageV1[] => convertToV1Messages(this.response.v3().map(MessageList.mastraMessageV3ToV2)),

    aiV5: {
      ui: (): AIV5Type.UIMessage[] => this.response.v3().map(MessageList.mastraMessageV3ToAIV5UIMessage),
      model: (): AIV5ResponseMessage[] =>
        this.aiV5UIMessagesToAIV5ModelMessages(this.response.aiV5.ui()).filter(
          m => m.role === `tool` || m.role === `assistant`,
        ),
      modelContent: (): AIV5Type.StepResult<any>['content'] => {
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
                    ? c.data
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
                    ? c.image
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
      ui: (): UIMessageWithMetadata[] => this.response.v2().map(MessageList.mastraMessageV2ToAIV4UIMessage),
      core: (): AIV4Type.CoreMessage[] => this.aiV4UIMessagesToAIV4CoreMessages(this.response.aiV4.ui()),
    },
  };
  // TODO: need to update this for new .aiV4/5.x() pattern
  private responsePersisted = {
    v3: (): MastraMessageV3[] =>
      this.cleanV3Metadata(
        this.messages.filter(m => this.newResponseMessagesPersisted.has(m)).map(this.mastraMessageV2ToMastraMessageV3),
      ),
    v2: (): MastraMessageV2[] => this.messages.filter(m => this.newResponseMessagesPersisted.has(m)),
    ui: (): UIMessageWithMetadata[] => this.responsePersisted.v2().map(MessageList.mastraMessageV2ToAIV4UIMessage),
  };

  public drainUnsavedMessages(): MastraMessageV2[] {
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

  public getSystemMessages(tag?: string): AIV4Type.CoreMessage[] {
    if (tag) {
      return this.taggedSystemMessages[tag] || [];
    }
    return this.systemMessages;
  }

  public addSystem(
    messages:
      | AIV4Type.CoreMessage
      | AIV4Type.CoreMessage[]
      | AIV5Type.ModelMessage
      | AIV5Type.ModelMessage[]
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

  private aiV4UIMessagesToAIV4CoreMessages(messages: AIV4Type.UIMessage[]): AIV4Type.CoreMessage[] {
    return AIV4.convertToCoreMessages(this.sanitizeAIV4UIMessages(messages));
  }
  private sanitizeAIV4UIMessages(messages: AIV4Type.UIMessage[]): AIV4Type.UIMessage[] {
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
      .filter((m): m is AIV4Type.UIMessage => Boolean(m));
    return msgs;
  }

  private addOneSystem(message: AIV4Type.CoreMessage | AIV5Type.ModelMessage | string, tag?: string) {
    if (typeof message === `string`) message = { role: 'system', content: message };

    const coreMessage = MessageList.isAIV4CoreMessage(message)
      ? message
      : this.aiV5ModelMessagesToAIV4CoreMessages([message], `system`)[0]!;

    if (coreMessage.role !== `system`) {
      throw new Error(
        `Expected role "system" but saw ${coreMessage.role} for message ${JSON.stringify(coreMessage, null, 2)}`,
      );
    }

    if (tag && !this.isDuplicateSystem(coreMessage, tag)) {
      this.taggedSystemMessages[tag] ||= [];
      this.taggedSystemMessages[tag].push(coreMessage);
    } else if (!this.isDuplicateSystem(coreMessage)) {
      this.systemMessages.push(coreMessage);
    }
  }

  private isDuplicateSystem(message: AIV4Type.CoreMessage, tag?: string) {
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

  private static mastraMessageV2ToAIV4UIMessage(m: MastraMessageV2): UIMessageWithMetadata {
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
  private getMessageById(id: string) {
    return this.messages.find(m => m.id === id);
  }

  private shouldReplaceMessage(message: MastraMessageV2): { exists: boolean; shouldReplace?: boolean; id?: string } {
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

      if (MessageList.isAIV4CoreMessage(message) || MessageList.isAIV5CoreMessage(message))
        return this.addSystem(message);

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

    const messageV2 = this.inputToMastraMessageV2(message, messageSource);

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

  private pushMessageToSource(messageV2: MastraMessageV2, messageSource: MessageSource) {
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
    latestMessage: MastraMessageV2;
    newMessage: MastraMessageV2;
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
    latestMessage: MastraMessageV2;
    messageV2: MastraMessageV2;
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

  private inputToMastraMessageV2(message: MessageInput, messageSource: MessageSource): MastraMessageV2 {
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
      return this.mastraMessageV1ToMastraMessageV2(message, messageSource);
    }
    if (MessageList.isMastraMessageV2(message)) {
      return this.hydrateMastraMessageV2Fields(message);
    }
    if (MessageList.isAIV4CoreMessage(message)) {
      return this.aiV4CoreMessageToMastraMessageV2(message, messageSource);
    }
    if (MessageList.isAIV4UIMessage(message)) {
      return this.aiV4UIMessageToMastraMessageV2(message, messageSource);
    }

    if (MessageList.isAIV5CoreMessage(message)) {
      return MessageList.mastraMessageV3ToV2(this.aiV5ModelMessageToMastraMessageV3(message, messageSource));
    }
    if (MessageList.isAIV5UIMessage(message)) {
      return MessageList.mastraMessageV3ToV2(this.aiV5UIMessageToMastraMessageV3(message, messageSource));
    }
    if (MessageList.isMastraMessageV3(message)) {
      return MessageList.mastraMessageV3ToV2(this.hydrateMastraMessageV3Fields(message));
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

  private mastraMessageV1ToMastraMessageV2(message: MastraMessageV1, messageSource: MessageSource): MastraMessageV2 {
    const coreV2 = this.aiV4CoreMessageToMastraMessageV2(
      {
        content: message.content,
        role: message.role,
      } as AIV4Type.CoreMessage,
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

  private hydrateMastraMessageV3Fields(message: MastraMessageV3): MastraMessageV3 {
    if (!(message.createdAt instanceof Date)) message.createdAt = new Date(message.createdAt);
    return message;
  }
  private hydrateMastraMessageV2Fields(message: MastraMessageV2): MastraMessageV2 {
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

  private aiV4UIMessageToMastraMessageV2(
    message: AIV4Type.UIMessage | UIMessageWithMetadata,
    messageSource: MessageSource,
  ): MastraMessageV2 {
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
    } satisfies MastraMessageV2;
  }
  private aiV4CoreMessageToMastraMessageV2(
    coreMessage: AIV4Type.CoreMessage,
    messageSource: MessageSource,
  ): MastraMessageV2 {
    const id = `id` in coreMessage ? (coreMessage.id as string) : this.newMessageId();
    const parts: AIV4Type.UIMessage['parts'] = [];
    const experimentalAttachments: AIV4Type.UIMessage['experimental_attachments'] = [];
    const toolInvocations: AIV4Type.ToolInvocation[] = [];

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
            parts.push({
              type: 'text',
              text: part.text,
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
            parts.push({ type: 'file', data: part.image.toString(), mimeType: part.mimeType! });
            break;
          case 'file':
            // CoreMessage file parts can have mimeType and data (binary/data URL) or just a URL
            if (part.data instanceof URL) {
              parts.push({
                type: 'file',
                data: part.data.toString(),
                mimeType: part.mimeType,
              });
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

    const content: MastraMessageV2['content'] = {
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

  static isAIV4UIMessage(msg: MessageInput): msg is AIV4Type.UIMessage {
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
  static isAIV4CoreMessage(msg: MessageInput): msg is AIV4Type.CoreMessage {
    // V4 CoreMessage has role and content like V5, but content can be array of parts
    return (
      !MessageList.isMastraMessage(msg) &&
      !(`parts` in msg) &&
      `content` in msg &&
      !MessageList.hasAIV5CoreMessageCharacteristics(msg)
    );
  }

  static isMastraMessage(msg: MessageInput): msg is MastraMessageV2 | MastraMessageV1 | MastraMessageV3 {
    return (
      MessageList.isMastraMessageV3(msg) || MessageList.isMastraMessageV2(msg) || MessageList.isMastraMessageV1(msg)
    );
  }

  static isMastraMessageV1(msg: MessageInput): msg is MastraMessageV1 {
    return (
      !MessageList.isMastraMessageV2(msg) &&
      !MessageList.isMastraMessageV3(msg) &&
      (`threadId` in msg || `resourceId` in msg)
    );
  }

  static isMastraMessageV2(msg: MessageInput): msg is MastraMessageV2 {
    return Boolean(
      `content` in msg &&
        msg.content &&
        !Array.isArray(msg.content) &&
        typeof msg.content !== `string` &&
        `format` in msg.content &&
        msg.content.format === 2,
    );
  }

  static isMastraMessageV3(msg: MessageInput): msg is MastraMessageV3 {
    return Boolean(
      `content` in msg &&
        msg.content &&
        !Array.isArray(msg.content) &&
        typeof msg.content !== `string` &&
        `format` in msg.content &&
        msg.content.format === 3,
    );
  }

  private static getRole(message: MessageInput): MastraMessageV2['role'] {
    if (message.role === `assistant` || message.role === `tool`) return `assistant`;
    if (message.role === `user`) return `user`;
    if (message.role === `system`) return `system`;
    throw new Error(
      `BUG: add handling for message role ${message.role} in message ${JSON.stringify(message, null, 2)}`,
    );
  }

  private static cacheKeyFromAIV4Parts(parts: AIV4Type.UIMessage['parts']): string {
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

  static coreContentToString(content: AIV4Type.CoreMessage['content']): string {
    if (typeof content === `string`) return content;

    return content.reduce((p, c) => {
      if (c.type === `text`) {
        p += c.text;
      }
      return p;
    }, '');
  }

  private static cacheKeyFromAIV4CoreMessageContent(content: AIV4Type.CoreMessage['content']): string {
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
        key += part.image instanceof URL ? part.image.toString() : part.image.toString().length;
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

    const oneMM2 = MessageList.isMastraMessageV2(one) && one;
    const twoMM2 = MessageList.isMastraMessageV2(two) && two;
    if (oneMM2 && !twoMM2) return false;
    if (oneMM2 && twoMM2) {
      return (
        oneMM2.id === twoMM2.id &&
        MessageList.cacheKeyFromAIV4Parts(oneMM2.content.parts) ===
          MessageList.cacheKeyFromAIV4Parts(twoMM2.content.parts)
      );
    }

    const oneMM3 = MessageList.isMastraMessageV3(one) && one;
    const twoMM3 = MessageList.isMastraMessageV3(two) && two;
    if (oneMM3 && !twoMM3) return false;
    if (oneMM3 && twoMM3) {
      return (
        oneMM3.id === twoMM3.id &&
        MessageList.cacheKeyFromAIV5Parts(oneMM3.content.parts) ===
          MessageList.cacheKeyFromAIV5Parts(twoMM3.content.parts)
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

  private cleanV3Metadata(messages: MastraMessageV3[]): MastraMessageV3[] {
    return messages.map(msg => {
      if (!msg.content.metadata || typeof msg.content.metadata !== 'object') {
        return msg;
      }

      const metadata = { ...msg.content.metadata } as any;
      const hasOriginalContent = '__originalContent' in metadata;
      const hasOriginalAttachments = '__originalExperimentalAttachments' in metadata;

      if (!hasOriginalContent && !hasOriginalAttachments) {
        return msg;
      }

      const { __originalContent, __originalExperimentalAttachments, ...cleanMetadata } = metadata;

      if (Object.keys(cleanMetadata).length === 0) {
        // Remove metadata entirely if it only had internal fields
        const { metadata, ...contentWithoutMetadata } = msg.content;
        return { ...msg, content: contentWithoutMetadata };
      }

      return { ...msg, content: { ...msg.content, metadata: cleanMetadata } };
    });
  }

  static aiV4CoreMessageToV1PromptMessage(coreMessage: AIV4Type.CoreMessage): LanguageModelV1Message {
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

  private static mastraMessageV3ToV2(v3Msg: MastraMessageV3): MastraMessageV2 {
    const toolInvocationParts = v3Msg.content.parts.filter(p => AIV5.isToolUIPart(p));

    // Check if the original V2 message had toolInvocations field
    const hadToolInvocations = (v3Msg.content.metadata as any)?.__hadToolInvocations === true;

    // Build tool invocations list
    let toolInvocations: MastraMessageV2['content']['toolInvocations'] = undefined;
    if (toolInvocationParts.length > 0) {
      // Build the invocations array from tool parts
      const invocations = toolInvocationParts.map(p => {
        const toolName = getToolName(p);
        if (p.state === `output-available`) {
          return {
            args: p.input,
            result:
              typeof p.output === 'object' && p.output && 'value' in p.output
                ? (p.output as { value: unknown }).value
                : p.output,
            toolCallId: p.toolCallId,
            toolName,
            state: 'result',
          } satisfies NonNullable<MastraMessageV2['content']['toolInvocations']>[0];
        }
        return {
          args: p.input,
          state: 'call',
          toolName,
          toolCallId: p.toolCallId,
        } satisfies NonNullable<MastraMessageV2['content']['toolInvocations']>[0];
      });
      toolInvocations = invocations;
    } else if (hadToolInvocations && v3Msg.role === 'assistant') {
      // Original V2 message had toolInvocations field but no tool parts remain
      // This happens when all tool invocations were 'call' state and got filtered
      toolInvocations = [];
    }

    // Get attachment URLs from metadata to filter out duplicate file parts
    const attachmentUrls = new Set<string>((v3Msg.content.metadata as any)?.__attachmentUrls || []);

    const v2Msg: MastraMessageV2 = {
      id: v3Msg.id,
      resourceId: v3Msg.resourceId,
      threadId: v3Msg.threadId,
      createdAt: v3Msg.createdAt,
      role: v3Msg.role,
      content: {
        format: 2,
        parts: v3Msg.content.parts
          .map((p): null | MastraMessageContentV2['parts'][number] => {
            if (AIV5.isToolUIPart(p) || p.type === 'dynamic-tool') {
              const toolName = getToolName(p);
              const shared = {
                state: p.state,
                args: p.input,
                toolCallId: p.toolCallId,
                toolName,
              };

              if (p.state === `output-available`) {
                return {
                  type: 'tool-invocation',
                  toolInvocation: {
                    ...shared,
                    state: 'result',
                    result: typeof p.output === 'object' && p.output && 'value' in p.output ? p.output.value : p.output,
                  },
                  providerMetadata: p.callProviderMetadata,
                };
              }
              return {
                type: 'tool-invocation',
                toolInvocation: {
                  ...shared,
                  state: p.state === `input-available` ? `call` : `partial-call`,
                },
              };
            }
            switch (p.type) {
              case 'text':
                return p;
              case 'file':
                // Skip file parts that came from experimental_attachments
                // They will be restored separately from __originalExperimentalAttachments
                if (attachmentUrls.has(p.url)) {
                  return null;
                }
                return {
                  type: 'file',
                  mimeType: p.mediaType,
                  data: p.url,
                  providerMetadata: p.providerMetadata,
                };
              case 'reasoning':
                if (p.text === '') return null;
                return {
                  type: 'reasoning',
                  reasoning: p.text,
                  details: [{ type: 'text', text: p.text }],
                  providerMetadata: p.providerMetadata,
                };

              case 'source-url':
                return {
                  type: 'source',
                  source: {
                    url: p.url,
                    id: p.sourceId,
                    sourceType: 'url',
                  },
                  providerMetadata: p.providerMetadata,
                };
              case 'step-start':
                return p;
            }
            return null;
          })
          .filter((p): p is MastraMessageContentV2['parts'][number] => Boolean(p)),
      },
    };

    // Assign toolInvocations if present
    if (toolInvocations !== undefined) {
      v2Msg.content.toolInvocations = toolInvocations;
    }

    // Copy metadata but exclude internal fields that will be handled separately
    if (v3Msg.content.metadata) {
      const { __originalContent, __originalExperimentalAttachments, __attachmentUrls, ...userMetadata } = v3Msg.content
        .metadata as any;
      v2Msg.content.metadata = userMetadata;
    }

    // Restore original content from metadata if it exists
    const originalContent = (v3Msg.content.metadata as any)?.__originalContent;
    if (originalContent !== undefined) {
      if (
        typeof originalContent !== `string` ||
        v2Msg.content.parts.every(p => p.type === `step-start` || p.type === `text`)
      ) {
        v2Msg.content.content = originalContent;
      }
    }
    // Note: We don't synthesize content from parts - only use __originalContent
    // This preserves the original V2 format where content.content was optional

    // Restore experimental_attachments from metadata if it exists
    const originalAttachments = (v3Msg.content.metadata as any)?.__originalExperimentalAttachments;
    if (originalAttachments && Array.isArray(originalAttachments)) {
      v2Msg.content.experimental_attachments = originalAttachments || [];
    }

    // Set toolInvocations on V2
    // Only add toolInvocations if there are actual result invocations
    if (toolInvocations && toolInvocations.length > 0) {
      const resultToolInvocations = toolInvocations.filter(t => t.state === 'result');
      if (resultToolInvocations.length > 0) {
        v2Msg.content.toolInvocations = resultToolInvocations;
      }
    }
    if (v3Msg.type) v2Msg.type = v3Msg.type;

    return v2Msg;
  }

  private mastraMessageV2ToMastraMessageV3(v2Msg: MastraMessageV2): MastraMessageV3 {
    const parts: MastraMessageContentV3['parts'] = [];
    const v3Msg: MastraMessageV3 = {
      id: v2Msg.id,
      content: {
        format: 3 as const,
        parts,
      },
      role: v2Msg.role,
      createdAt: v2Msg.createdAt instanceof Date ? v2Msg.createdAt : new Date(v2Msg.createdAt),
      resourceId: v2Msg.resourceId,
      threadId: v2Msg.threadId,
      type: v2Msg.type,
    };

    if (v2Msg.content.metadata) {
      v3Msg.content.metadata = { ...v2Msg.content.metadata };
    }

    // Preserve original content and experimental_attachments for round-trip
    if (v2Msg.content.content !== undefined) {
      v3Msg.content.metadata = {
        ...(v3Msg.content.metadata || {}),
        __originalContent: v2Msg.content.content,
      };
    }

    if (v2Msg.content.experimental_attachments !== undefined) {
      v3Msg.content.metadata = {
        ...(v3Msg.content.metadata || {}),
        __originalExperimentalAttachments: v2Msg.content.experimental_attachments,
      };
    }

    const fileUrls = new Set<string>();
    for (const part of v2Msg.content.parts) {
      switch (part.type) {
        case 'step-start':
        case 'text':
          parts.push(part);
          break;

        case 'tool-invocation':
          // Convert to dynamic-tool format for v5
          if (part.toolInvocation.state === `result`) {
            parts.push({
              type: `tool-${part.toolInvocation.toolName}` as const,
              toolCallId: part.toolInvocation.toolCallId,
              state: 'output-available',
              input: part.toolInvocation.args,
              output: part.toolInvocation.result,
              callProviderMetadata: part.providerMetadata,
            } satisfies AIV5Type.UIMessagePart<any, any>);
          } else {
            parts.push({
              type: `tool-${part.toolInvocation.toolName}` as const,
              toolCallId: part.toolInvocation.toolCallId,
              state: part.toolInvocation.state === `call` ? `input-available` : `input-streaming`,
              input: part.toolInvocation.args,
            } satisfies AIV5Type.UIMessagePart<any, any>);
          }
          break;

        case 'source':
          parts.push({
            type: 'source-url',
            sourceId: part.source.id,
            url: part.source.url,
            title: part.source.title,
            providerMetadata: part.source.providerMetadata || part.providerMetadata,
          });
          break;

        case 'reasoning':
          const text =
            part.reasoning ||
            (part.details?.reduce((p, c) => {
              if (c.type === `text`) return p + c.text;
              return p;
            }, '') ??
              '');
          if (text || part.details?.length) {
            parts.push({
              type: 'reasoning',
              text: text || '',
              state: 'done',
              providerMetadata: part.providerMetadata,
            });
          }
          break;

        case 'file':
          parts.push({
            type: 'file',
            url: part.data,
            mediaType: part.mimeType,
            providerMetadata: part.providerMetadata,
          });
          fileUrls.add(part.data);
          break;
      }
    }

    if (v2Msg.content.content && !v3Msg.content.parts?.some(p => p.type === `text`)) {
      v3Msg.content.parts.push({ type: 'text', text: v2Msg.content.content });
    }

    // Track which file URLs came from experimental_attachments
    const attachmentUrls: string[] = [];
    if (v2Msg.content.experimental_attachments?.length) {
      for (const attachment of v2Msg.content.experimental_attachments) {
        if (fileUrls.has(attachment.url)) continue;
        attachmentUrls.push(attachment.url);
        parts.push({
          url: attachment.url,
          mediaType: attachment.contentType || 'unknown',
          type: 'file',
        });
      }
    }

    // Store attachment URLs in metadata so we can filter them out when converting back to V2
    if (attachmentUrls.length > 0) {
      v3Msg.content.metadata = {
        ...(v3Msg.content.metadata || {}),
        __attachmentUrls: attachmentUrls,
      };
    }

    return v3Msg;
  }

  private aiV5UIMessagesToAIV5ModelMessages(messages: AIV5Type.UIMessage[]): AIV5Type.ModelMessage[] {
    const preprocessed = this.addStartStepPartsForAIV5(this.sanitizeV5UIMessages(messages));
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
  private sanitizeV5UIMessages(messages: AIV5Type.UIMessage[]): AIV5Type.UIMessage[] {
    const msgs = messages
      .map(m => {
        if (m.parts.length === 0) return false;
        // Filter out streaming states and input-available (which isn't supported by convertToModelMessages)
        const safeParts = m.parts.filter(p => {
          if (!AIV5.isToolUIPart(p)) return true;
          // Only keep tool parts with output states for model messages
          return p.state === 'output-available' || p.state === 'output-error';
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

  private static mastraMessageV3ToAIV5UIMessage(m: MastraMessageV3): AIV5Type.UIMessage {
    const metadata: Record<string, any> = {
      ...(m.content.metadata || {}),
    };
    if (m.createdAt) metadata.createdAt = m.createdAt;
    if (m.threadId) metadata.threadId = m.threadId;
    if (m.resourceId) metadata.resourceId = m.resourceId;

    // Convert parts, keeping all v5 tool parts regardless of state
    const filteredParts = m.content.parts;

    return {
      id: m.id,
      role: m.role,
      metadata,
      parts: filteredParts,
    };
  }

  private aiV5ModelMessagesToAIV4CoreMessages(
    messages: AIV5Type.ModelMessage[],
    messageSource: MessageSource,
  ): AIV4Type.CoreMessage[] {
    const v3 = messages.map(msg => this.aiV5ModelMessageToMastraMessageV3(msg, messageSource));
    const v2 = v3.map(MessageList.mastraMessageV3ToV2);
    const ui = v2.map(MessageList.mastraMessageV2ToAIV4UIMessage);
    const core = this.aiV4UIMessagesToAIV4CoreMessages(ui);
    return core;
  }

  private aiV4CoreMessagesToAIV5ModelMessages(
    messages: AIV4Type.CoreMessage[],
    source: MessageSource,
  ): AIV5Type.ModelMessage[] {
    // kinda janky but we can pipe from v5model->mastra3->mastra2->v4ui->v4core to convert our v5 messages to v4 messages
    // TODO: probably a good idea to make a direct v4->v5 converter
    return this.aiV5UIMessagesToAIV5ModelMessages(
      messages
        .map(m => this.aiV4CoreMessageToMastraMessageV2(m, source))
        .map(m => this.mastraMessageV2ToMastraMessageV3(m))
        .map(m => MessageList.mastraMessageV3ToAIV5UIMessage(m)),
    );
  }

  private aiV5UIMessageToMastraMessageV3(message: AIV5Type.UIMessage, messageSource: MessageSource): MastraMessageV3 {
    const content: MastraMessageContentV3 = {
      format: 3,
      parts: message.parts,
      metadata: message.metadata,
    };

    const metadata = message.metadata as any;
    // Check for createdAt in both direct property and metadata
    const createdAt = (() => {
      if ('createdAt' in message && message.createdAt instanceof Date) {
        return message.createdAt;
      }
      if (metadata && 'createdAt' in metadata && metadata.createdAt instanceof Date) {
        return metadata.createdAt;
      }
      return undefined;
    })();

    if ('metadata' in message && message.metadata) {
      content.metadata = { ...message.metadata } as Record<string, unknown>;
    }

    return {
      id: message.id || this.newMessageId(),
      role: MessageList.getRole(message),
      createdAt: this.generateCreatedAt(messageSource, createdAt),
      threadId: this.memoryInfo?.threadId,
      resourceId: this.memoryInfo?.resourceId,
      content,
    } satisfies MastraMessageV3;
  }

  private aiV5ModelMessageToMastraMessageV3(
    coreMessage: AIV5Type.ModelMessage,
    messageSource: MessageSource,
  ): MastraMessageV3 {
    const id = `id` in coreMessage && typeof coreMessage.id === `string` ? coreMessage.id : this.newMessageId();
    const parts: AIV5Type.UIMessage['parts'] = [];

    // Note: step-start should only be added after tool invocations for assistant messages, never for user messages

    if (typeof coreMessage.content === 'string') {
      parts.push({
        type: 'text',
        text: coreMessage.content,
      });
    } else if (Array.isArray(coreMessage.content)) {
      for (const part of coreMessage.content) {
        switch (part.type) {
          case 'text':
            // Add step-start only after tool results for assistant messages
            const prevPart = parts.at(-1);
            if (
              coreMessage.role === 'assistant' &&
              prevPart &&
              AIV5.isToolUIPart(prevPart) &&
              prevPart.state === 'output-available'
            ) {
              parts.push({
                type: 'step-start',
              });
            }
            parts.push({
              type: 'text',
              text: part.text,
              providerMetadata: part.providerOptions,
            });
            break;

          case 'tool-call':
            parts.push({
              type: `tool-${part.toolName}`,
              state: 'input-available',
              toolCallId: part.toolCallId,
              input: part.input,
            });
            break;

          case 'tool-result':
            parts.push({
              type: `tool-${part.toolName}`,
              state: 'output-available',
              toolCallId: part.toolCallId,
              output:
                typeof part.output === 'string'
                  ? { type: 'text', value: part.output }
                  : (part.output ?? { type: 'text', value: '' }),
              input: {},
              callProviderMetadata: part.providerOptions,
            });
            break;

          case 'reasoning':
            parts.push({
              type: 'reasoning',
              text: part.text,
              providerMetadata: part.providerOptions,
            });
            break;
          case 'image':
            parts.push({
              type: 'file',
              url: part.image.toString(),
              mediaType: part.mediaType || 'unknown',
              providerMetadata: part.providerOptions,
            });
            break;
          case 'file':
            if (part.data instanceof URL) {
              parts.push({
                type: 'file',
                url: part.data.toString(),
                mediaType: part.mediaType,
                providerMetadata: part.providerOptions,
              });
            } else {
              try {
                parts.push({
                  type: 'file',
                  mediaType: part.mediaType,
                  url: convertDataContentToBase64String(part.data),
                  providerMetadata: part.providerOptions,
                });
              } catch (error) {
                console.error(`Failed to convert binary data to base64 in CoreMessage file part: ${error}`, error);
              }
            }
            break;
        }
      }
    }

    const content: MastraMessageV3['content'] = {
      format: 3,
      parts,
    };

    // Preserve original string content for round-trip
    if (coreMessage.content) {
      content.metadata = {
        ...(content.metadata || {}),
        __originalContent: coreMessage.content,
      };
    }

    return {
      id,
      role: MessageList.getRole(coreMessage),
      createdAt: this.generateCreatedAt(messageSource),
      threadId: this.memoryInfo?.threadId,
      resourceId: this.memoryInfo?.resourceId,
      content,
    };
  }

  static hasAIV5UIMessageCharacteristics(
    msg: AIV5Type.UIMessage | AIV4Type.UIMessage | AIV4Type.Message,
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
      | AIV4Type.CoreMessage
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
        key += part.image instanceof URL ? part.image.toString() : part.image.toString().length;
        key += part.mediaType;
      }
    }
    return key;
  }
}
