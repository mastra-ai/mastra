import { randomUUID } from 'crypto';
import * as AIV5 from 'ai';
import type * as AIV4 from './ai-sdk-4';
import { convertToV1Messages } from './prompt/convert-to-mastra-v1';
import { convertDataContentToBase64String } from './prompt/data-content';

type MastraMessageShared = {
  id: string;
  role: 'user' | 'assistant';
  createdAt: Date;
  threadId?: string;
  resourceId?: string;
  type?: string;
};

export type MastraMessageContentV2 = {
  format: 2; // format 2 === UIMessage in AI SDK v4
  // TODO: When we bump to AI SDK v5 and make "format: 3" we might need to inline these types with a copy/paste
  parts: AIV4.UIMessage['parts'];
  experimental_attachments?: AIV4.UIMessage['experimental_attachments'];
  content?: AIV4.UIMessage['content'];
  toolInvocations?: AIV4.UIMessage['toolInvocations'];
  reasoning?: AIV4.UIMessage['reasoning'];
  annotations?: AIV4.UIMessage['annotations'];
};

// maps to AI SDK V4 UIMessage
export type MastraMessageV2 = MastraMessageShared & {
  content: MastraMessageContentV2;
};

export type MastraMessageContentV3 = {
  format: 3; // format 3 === UIMessage in AI SDK v5
  parts: AIV5.UIMessage['parts'];
  metadata?: AIV5.UIMessage['metadata'];
};
// maps to AI SDK V5 UIMessage
export type MastraMessageV3 = MastraMessageShared & {
  role: AIV5.UIMessage['role'];
  content: MastraMessageContentV3;
};

export type MastraMessageV1 = {
  id: string;
  content: string | AIV4.UserContent | AIV4.AssistantContent | AIV4.ToolContent;
  role: 'system' | 'user' | 'assistant' | 'tool';
  createdAt: Date;
  threadId?: string;
  resourceId?: string;
  toolCallIds?: string[];
  toolCallArgs?: Record<string, unknown>[];
  toolNames?: string[];
  type: 'text' | 'tool-call' | 'tool-result';
};

export type MessageInput =
  | AIV5.UIMessage
  | AIV5.ModelMessage
  // db messages in AIV4.CoreMessage format
  | MastraMessageV1
  // db messages in AIV4.UIMessage format
  | MastraMessageV2
  // db messages in AIV5.UIMessage format
  | MastraMessageV3;

type MessageSource = 'memory' | 'response' | 'user' | 'system' | 'context';
type MemoryInfo = { threadId: string; resourceId?: string };

export class MessageList {
  private messages: MastraMessageV3[] = [];

  // passed in by dev in input or context
  private systemMessages: AIV5.CoreSystemMessage[] = [];
  // passed in by us for a specific purpose, eg memory system message
  private taggedSystemMessages: Record<string, AIV5.CoreSystemMessage[]> = {};

  private memoryInfo: null | MemoryInfo = null;

  // used to filter this.messages by how it was added: input/response/memory
  private memoryMessages = new Set<MastraMessageV3>();
  private newUserMessages = new Set<MastraMessageV3>();
  private newResponseMessages = new Set<MastraMessageV3>();
  private userContextMessages = new Set<MastraMessageV3>();

  private generateMessageId?: AIV5.IdGenerator;

  constructor({
    threadId,
    resourceId,
    generateMessageId,
  }: { threadId?: string; resourceId?: string; generateMessageId?: AIV5.IdGenerator } = {}) {
    if (threadId) {
      this.memoryInfo = { threadId, resourceId };
      this.generateMessageId = generateMessageId;
    }
  }

  public add(messages: string | string[] | MessageInput | MessageInput[], messageSource: MessageSource) {
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
    const currentUserMessages = this.all.aiV5.model().filter(m => m.role === 'user');
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
  private all = {
    v3: () => this.messages,
    v2: () => this.messages.map(MessageList.mastraMessageV3ToV2),
    v1: () => convertToV1Messages(this.all.v2()),

    aiV5: {
      model: () => this.convertToModelMessages(this.all.aiV5.ui()),
      ui: (): AIV5.UIMessage[] => this.messages.map(MessageList.toUIMessage),
    },

    prompt: () => {
      return [...this.systemMessages, ...Object.values(this.taggedSystemMessages).flat(), ...this.all.aiV5.model()];
    },
  };
  private remembered = {
    v3: () => this.messages.filter(m => this.memoryMessages.has(m)),
    v2: () => this.remembered.v3().map(MessageList.mastraMessageV3ToV2),
    v1: () => convertToV1Messages(this.remembered.v2()),

    aiV5: {
      model: () => this.convertToModelMessages(this.remembered.aiV5.ui()),
      ui: (): AIV5.UIMessage[] => this.messages.map(MessageList.toUIMessage),
    },
  };
  private input = {
    v3: () => this.messages.filter(m => this.newUserMessages.has(m)),
    v2: () => this.input.v3().map(MessageList.mastraMessageV3ToV2),
    v1: () => convertToV1Messages(this.input.v2()),

    aiV5: {
      model: () => this.convertToModelMessages(this.input.aiV5.ui()),
      ui: (): AIV5.UIMessage[] => this.input.v3().map(MessageList.toUIMessage),
    },
  };
  private response = {
    v3: () => this.messages.filter(m => this.newResponseMessages.has(m)),
    v2: () => this.response.v3().map(MessageList.mastraMessageV3ToV2),
  };
  public drainUnsavedMessages(): MastraMessageV3[] {
    const messages = this.messages.filter(m => this.newUserMessages.has(m) || this.newResponseMessages.has(m));
    this.newUserMessages.clear();
    this.newResponseMessages.clear();
    return messages;
  }
  public getSystemMessages(tag?: string): AIV5.CoreMessage[] {
    if (tag) {
      return this.taggedSystemMessages[tag] || [];
    }
    return this.systemMessages;
  }
  public addSystem(
    messages: AIV5.CoreSystemMessage | AIV5.CoreSystemMessage[] | string | string[] | null,
    tag?: string,
  ) {
    if (!messages) return this;
    for (const message of Array.isArray(messages) ? messages : [messages]) {
      this.addOneSystem(message, tag);
    }
    return this;
  }

  private convertToModelMessages(messages: AIV5.UIMessage[]): AIV5.ModelMessage[] {
    return AIV5.convertToModelMessages(this.sanitizeV5UIMessages(messages));
  }
  private sanitizeV5UIMessages(messages: AIV5.UIMessage[]): AIV5.UIMessage[] {
    const msgs = messages
      .map(m => {
        if (m.parts.length === 0) return false;
        const safeParts = m.parts.filter(
          p =>
            !AIV5.isToolUIPart(p) ||
            // calls and partial-calls should be updated to be results at this point
            // if they haven't we can't send them back to the llm and need to remove them.
            (p.state !== `input-available` && p.state !== `input-streaming`),
        );

        // fully remove this message if it has an empty parts array after stripping out incomplete tool calls.
        if (!safeParts.length) return false;

        const sanitized = {
          ...m,
          parts: safeParts,
        };

        return sanitized;
      })
      .filter((m): m is AIV5.UIMessage => Boolean(m));
    return msgs;
  }
  private addOneSystem(message: AIV5.CoreSystemMessage | string, tag?: string) {
    if (typeof message === `string`) message = { role: 'system', content: message };
    if (tag && !this.isDuplicateSystem(message, tag)) {
      this.taggedSystemMessages[tag] ||= [];
      this.taggedSystemMessages[tag].push(message);
    } else if (!this.isDuplicateSystem(message)) {
      this.systemMessages.push(message);
    }
  }
  private isDuplicateSystem(message: AIV5.CoreSystemMessage, tag?: string) {
    if (tag) {
      if (!this.taggedSystemMessages[tag]) return false;
      return this.taggedSystemMessages[tag].some(
        m => MessageList.cacheKeyFromContent(m.content) === MessageList.cacheKeyFromContent(message.content),
      );
    }
    return this.systemMessages.some(
      m => MessageList.cacheKeyFromContent(m.content) === MessageList.cacheKeyFromContent(message.content),
    );
  }
  private static toUIMessage(m: MastraMessageV3): AIV5.UIMessage {
    const metadata: Record<string, any> = {
      ...(m.content.metadata || {}),
    };
    if (m.createdAt) metadata.createdAt = m.createdAt;
    if (m.threadId) metadata.threadId = m.threadId;
    if (m.resourceId) metadata.resourceId = m.resourceId;
    return {
      id: m.id,
      role: m.role,
      metadata,
      parts: m.content.parts,
    };
  }
  private getMessageById(id: string) {
    return this.messages.find(m => m.id === id);
  }
  private shouldReplaceMessage(message: MastraMessageV3): { exists: boolean; shouldReplace?: boolean; id?: string } {
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
    if (message.role === `system` && MessageList.isAIV5CoreMessage(message)) return this.addSystem([message]);
    if (message.role === `system`) {
      throw new Error(
        `A non-CoreMessage system message was added - this is not supported as we didn't expect this could happen. Please open a Github issue and let us know what you did to get here. This is the non-CoreMessage system message we received:

messageSource: ${messageSource}

${JSON.stringify(message, null, 2)}`,
      );
    }

    const messageV3 = this.inputToMastraMessageV3(message, messageSource);

    const { exists, shouldReplace, id } = this.shouldReplaceMessage(messageV3);

    const latestMessage = this.messages.at(-1);

    const singleToolResult =
      MessageList.isAIV5CoreMessage(message) &&
      message.role === 'tool' &&
      message.content.filter(c => c.type === `tool-result`)?.length === 1 &&
      message.content[0];

    if (
      singleToolResult &&
      (latestMessage?.role !== `assistant` ||
        !latestMessage.content.parts.some(p => AIV5.isToolUIPart(p) && p.toolCallId === singleToolResult.toolCallId))
    ) {
      // remove any tool results that aren't updating a tool call for ModelMessages
      return;
    }

    if (messageSource === `memory`) {
      for (const existingMessage of this.messages) {
        // don't double store any messages
        if (MessageList.messagesAreEqual(existingMessage, messageV3)) {
          return;
        }
      }
    }
    // If the last message is an assistant message and the new message is also an assistant message, merge them together and update tool calls with results
    const latestMessagePartType = latestMessage?.content?.parts?.filter(p => p.type !== `step-start`)?.at?.(-1)?.type;

    const newMessageFirstPart = messageV3.content.parts.filter(p => p.type !== `step-start`).at(0);
    const newMessageFirstPartType = newMessageFirstPart?.type;
    const shouldAppendToLastAssistantMessage =
      latestMessage?.role === 'assistant' &&
      messageV3.role === 'assistant' &&
      latestMessage.threadId === messageV3.threadId;

    const shouldAppendToLastAssistantMessageParts =
      shouldAppendToLastAssistantMessage &&
      newMessageFirstPartType &&
      ((AIV5.isToolUIPart(newMessageFirstPart) && latestMessagePartType !== `text`) ||
        newMessageFirstPartType === latestMessagePartType);

    if (
      // backwards compat check!
      // this condition can technically be removed and it will make it so all new assistant parts will be added to the last assistant message parts instead of creating new db entries.
      // however, for any downstream code that isn't based around using message parts yet, this may cause tool invocations to show up in the wrong order in their UI, because they use the message.toolInvocations and message.content properties which do not indicate how each is ordered in relation to each other.
      // this code check then causes any tool invocation to be created as a new message and not update the previous assistant message parts.
      // without this condition we will see something like
      // parts: [{type:"step-start"}, {type: "text", text: "let me check the weather"}, {type: "tool-invocation", toolInvocation: x}, {type: "text", text: "the weather in x is y"}]
      // with this condition we will see
      // message1.parts: [{type:"step-start"}, {type: "text", text: "let me check the weather"}]
      // message2.parts: [{type: "tool-invocation", toolInvocation: x}]
      // message3.parts: [{type: "text", text: "the weather in x is y"}]
      shouldAppendToLastAssistantMessageParts
    ) {
      latestMessage.createdAt = messageV3.createdAt || latestMessage.createdAt;

      for (const [index, part] of messageV3.content.parts.entries()) {
        // If the incoming part is a tool-invocation result, find the corresponding call in the latest message
        if (AIV5.isToolUIPart(part) && part.state === 'output-available') {
          const existingCallPart = [...latestMessage.content.parts]
            .reverse()
            .find(p => AIV5.isToolUIPart(p) && p.toolCallId === part.toolCallId);

          if (existingCallPart && AIV5.isToolUIPart(existingCallPart)) {
            // Update the existing tool-call part with the result
            latestMessage.content.parts[latestMessage.content.parts.findIndex(p => p === existingCallPart)] = {
              ...existingCallPart,
              state: 'output-available',
              output: part.output,
            };
          }
        } else if (
          // if there's no part at this index yet in the existing message we're merging into
          !latestMessage.content.parts[index] ||
          // or there is and the parts are not identical
          MessageList.cacheKeyFromAIV5Parts([latestMessage.content.parts[index]]) !==
            MessageList.cacheKeyFromAIV5Parts([part])
        ) {
          // For all other part types that aren't already present, simply push them to the latest message's parts
          latestMessage.content.parts.push(part);
        }
      }
      if (latestMessage.createdAt.getTime() < messageV3.createdAt.getTime()) {
        latestMessage.createdAt = messageV3.createdAt;
      }
    }
    // Else the last message and this message are not both assistant messages OR an existing message has been updated and should be replaced. add a new message to the array or update an existing one.
    else {
      const existingIndex = (shouldReplace && this.messages.findIndex(m => m.id === id)) || -1;
      const existingMessage = existingIndex !== -1 && this.messages[existingIndex];

      if (shouldReplace && existingMessage) {
        this.messages[existingIndex] = messageV3;
      } else if (!exists) {
        this.messages.push(messageV3);
      }

      if (messageSource === `memory`) {
        this.memoryMessages.add(messageV3);
      } else if (messageSource === `response`) {
        this.newResponseMessages.add(messageV3);
      } else if (messageSource === `user`) {
        this.newUserMessages.add(messageV3);
      } else if (messageSource === `context`) {
        this.userContextMessages.add(messageV3);
      } else {
        throw new Error(`Missing message source for message ${messageV3}`);
      }
    }

    // make sure messages are always stored in order of when they were created!
    this.messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return this;
  }

  private inputToMastraMessageV3(message: MessageInput, messageSource: MessageSource): MastraMessageV3 {
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
      return this.mastraMessageV2ToMastraMessageV3(this.mastraMessageV1ToMastraMessageV2(message, messageSource));
    }
    if (MessageList.isMastraMessageV2(message)) {
      return this.mastraMessageV2ToMastraMessageV3(message);
    }
    if (MessageList.isMastraMessageV3(message)) {
      return this.hydrateMastraMessageV3Fields(message);
    }
    if (MessageList.isAIV5CoreMessage(message)) {
      return this.aiV5ModelMessageToMastraMessageV3(message, messageSource);
    }
    if (MessageList.isAIV5UIMessage(message)) {
      return this.aiV5UIMessageToMastraMessageV3(message, messageSource);
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

  // TODO: need this for easy migration path for playground (and users)
  // With this we can convert v2 -> uimessage(aiv4) or v2 -> coremessage(aiv4)
  // private mastraMessageV3ToMastraMessageV2(msg: MastraMessageV3): MastraMessageV2 {
  // }

  private mastraMessageV2ToMastraMessageV3(msg: MastraMessageV2): MastraMessageV3 {
    const parts: MastraMessageContentV3['parts'] = [];
    const msgBuffer = {
      id: msg.id,
      content: {
        format: 3 as const,
        parts,
      },
      role: msg.role,
      createdAt: msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt),
      resourceId: msg.resourceId,
      threadId: msg.threadId,
      type: msg.type,
    };

    const fileUrls = new Set<string>();
    for (const part of msg.content.parts) {
      switch (part.type) {
        case 'step-start':
        case 'text':
          parts.push(part);
          break;

        case 'tool-invocation':
          if (part.toolInvocation.state === `result`) {
            parts.push({
              type: `tool-${part.toolInvocation.toolName}`,
              toolCallId: part.toolInvocation.toolCallId,
              state: 'output-available',
              input: part.toolInvocation.args,
              output: part.toolInvocation.result,
            });
          } else {
            parts.push({
              type: `tool-${part.toolInvocation.toolName}`,
              toolCallId: part.toolInvocation.toolCallId,
              state: part.toolInvocation.state === `call` ? `input-available` : `input-streaming`,
              input: part.toolInvocation.args,
            });
          }
          break;

        case 'source':
          parts.push({
            type: 'source-url',
            sourceId: part.source.id,
            url: part.source.url,
            title: part.source.title,
            providerMetadata: part.source.providerMetadata,
          } satisfies Extract<AIV5.UIMessagePart<any, any>, { type: 'source-url' }>);
          break;

        case 'reasoning':
          const text =
            part.reasoning ||
            part.details.reduce((p, c) => {
              if (c.type === `text`) return p + c.text;
              return p;
            }, '');
          if (!text) {
            break;
          }
          parts.push({
            type: 'reasoning',
            text,
          } satisfies Extract<AIV5.UIMessagePart<any, any>, { type: 'reasoning' }>);
          break;

        case 'file':
          parts.push({
            type: 'file',
            url: part.data,
            mediaType: part.mimeType,
          } satisfies Extract<AIV5.UIMessagePart<any, any>, { type: 'file' }>);
          fileUrls.add(part.data);
          break;
      }
    }

    if (msg.content.experimental_attachments?.length) {
      for (const attachment of msg.content.experimental_attachments) {
        if (fileUrls.has(attachment.url)) continue;

        parts.push({
          url: attachment.url,
          mediaType: attachment.contentType || 'unknown',
          type: 'file',
        } satisfies Extract<AIV5.UIMessagePart<any, any>, { type: 'file' }>);
      }
    }

    return msgBuffer;
  }
  private mastraMessageV1ToMastraMessageV2(message: MastraMessageV1, messageSource: MessageSource): MastraMessageV2 {
    const coreV2 = this.aiV4CoreMessageToMastraMessageV2(
      {
        content: message.content,
        role: message.role,
      } as AIV4.CoreMessage,
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
  private static mastraMessageV3ToV2(message: MastraMessageV3): MastraMessageV2 {
    const toolInvocationParts = message.content.parts.filter(p => AIV5.isToolUIPart(p));
    const toolInvocations = toolInvocationParts.length
      ? toolInvocationParts.map(p => {
          if (p.state === `output-available`) {
            return {
              args: p.input,
              result: p.output,
              toolCallId: p.toolCallId,
              toolName: AIV5.getToolName(p),
              state: 'result',
            } satisfies AIV4.ToolInvocation;
          }
          return {
            args: p.input,
            state: 'call',
            toolName: AIV5.getToolName(p),
            toolCallId: p.toolCallId,
          } satisfies AIV4.ToolInvocation;
        })
      : undefined;

    const v2Msg: MastraMessageV2 = {
      id: message.id,
      resourceId: message.resourceId,
      threadId: message.threadId,
      createdAt: message.createdAt,
      role: message.role,
      content: {
        format: 2,
        parts: message.content.parts
          .map((p): MastraMessageV2['content']['parts'][0] | null => {
            if (AIV5.isToolUIPart(p)) {
              const shared = { state: p.state, args: p.input, toolCallId: p.toolCallId, toolName: AIV5.getToolName(p) };

              if (p.state === `output-available`) {
                return {
                  type: 'tool-invocation',
                  toolInvocation: {
                    ...shared,
                    state: 'result',
                    result: p.output,
                  },
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
                return {
                  type: 'file',
                  mimeType: p.mediaType,
                  data: p.url,
                };
              case 'reasoning':
                if (p.text === '') return null;
                return {
                  type: 'reasoning',
                  reasoning: '',
                  details: [{ type: 'text', text: p.text }],
                };
              case 'source-url':
                return {
                  type: 'source',
                  source: {
                    url: p.url,
                    id: p.sourceId,
                    sourceType: 'url',
                  },
                };
              case 'step-start':
                return p;
            }
            return null;
          })
          .filter((p): p is MastraMessageV2['content']['parts'][0] => Boolean(p)),
      },
    };

    if (toolInvocations?.length) {
      v2Msg.content.toolInvocations = toolInvocations;
    }
    if (message.type) v2Msg.type = message.type;

    return v2Msg;
  }
  private hydrateMastraMessageV3Fields(message: MastraMessageV3): MastraMessageV3 {
    if (!(message.createdAt instanceof Date)) message.createdAt = new Date(message.createdAt);
    return message;
  }
  private aiV5UIMessageToMastraMessageV3(message: AIV5.UIMessage, messageSource: MessageSource): MastraMessageV3 {
    const content: MastraMessageContentV3 = {
      format: 3,
      parts: message.parts,
    };

    // Not sure if this is correct, however they've removed the Message type that was a UIMessage w/ createdAt..
    const metadata = message.metadata as any;
    const createdAt =
      metadata && `createdAt` in metadata && metadata.createdAt instanceof Date ? metadata.createdAt : undefined;

    if (`experimental_attachments` in message && message.experimental_attachments) {
      const attachments = message.experimental_attachments as AIV4.UIMessage['experimental_attachments'];
      if (attachments?.length) {
        for (const attachment of attachments) {
          content.parts.push({
            type: 'file',
            url: attachment.url,
            mediaType: attachment.contentType || 'unknown',
          });
        }
      }
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
    coreMessage: AIV5.ModelMessage,
    messageSource: MessageSource,
  ): MastraMessageV3 {
    const id = `id` in coreMessage ? (coreMessage.id as string) : this.newMessageId();
    const parts: AIV5.UIMessage['parts'] = [];

    if (typeof coreMessage.content === 'string') {
      parts.push({
        type: 'text',
        text: coreMessage.content,
      });
    } else if (Array.isArray(coreMessage.content)) {
      for (const part of coreMessage.content) {
        switch (part.type) {
          case 'text':
            parts.push({
              type: 'text',
              text: part.text,
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
              output: part.output ?? '', // undefined will cause AI SDK to throw an error, but for client side tool calls this really could be undefined
              input: {}, // when we combine this invocation onto the existing tool-call part it will have args already
            });
            break;

          case 'reasoning':
            parts.push({
              type: 'reasoning',
              text: part.text,
            });
            break;
          case 'image':
            parts.push({ type: 'file', url: part.image.toString(), mediaType: part.mediaType || 'unknown' });
            break;
          case 'file':
            // CoreMessage file parts can have mimeType and data (binary/data URL) or just a URL
            if (part.data instanceof URL) {
              parts.push({
                type: 'file',
                url: part.data.toString(),
                mediaType: part.mediaType,
              });
            } else {
              // If it's binary data, convert to base64 and add to parts
              try {
                parts.push({
                  type: 'file',
                  mediaType: part.mediaType,
                  url: convertDataContentToBase64String(part.data),
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

    return {
      id,
      role: MessageList.getRole(coreMessage),
      createdAt: this.generateCreatedAt(messageSource),
      threadId: this.memoryInfo?.threadId,
      resourceId: this.memoryInfo?.resourceId,
      content,
    };
  }
  // this coreai4->mastrav2 is needed to convert mastrav1->mastrav2
  private aiV4CoreMessageToMastraMessageV2(
    coreMessage: AIV4.CoreMessage,
    messageSource: MessageSource,
  ): MastraMessageV2 {
    const id = `id` in coreMessage ? (coreMessage.id as string) : this.newMessageId();
    const parts: AIV4.UIMessage['parts'] = [];
    const experimentalAttachments: AIV4.UIMessage['experimental_attachments'] = [];
    const toolInvocations: AIV4.ToolInvocation[] = [];

    if (typeof coreMessage.content === 'string') {
      parts.push({
        type: 'text',
        text: coreMessage.content,
      });
    } else if (Array.isArray(coreMessage.content)) {
      for (const part of coreMessage.content) {
        switch (part.type) {
          case 'text':
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
            const invocation = {
              state: 'result' as const,
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              result: part.result ?? '', // undefined will cause AI SDK to throw an error, but for client side tool calls this really could be undefined
              args: {}, // when we combine this invocation onto the existing tool-call part it will have args already
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

    const role = (() => {
      if (coreMessage.role === `assistant` || coreMessage.role === `tool`) return `assistant`;
      if (coreMessage.role === `user`) return `user`;
      throw new Error(
        `BUG: add handling for role ${coreMessage.role} in message ${JSON.stringify(coreMessage, null, 2)}`,
      );
    })();

    return {
      id,
      role,
      createdAt: this.generateCreatedAt(messageSource),
      threadId: this.memoryInfo?.threadId,
      resourceId: this.memoryInfo?.resourceId,
      content,
    };
  }

  static isAIV5UIMessage(msg: MessageInput): msg is AIV5.UIMessage {
    return !MessageList.isMastraMessage(msg) && !MessageList.isAIV5CoreMessage(msg) && `parts` in msg;
  }
  static isAIV5CoreMessage(msg: MessageInput): msg is AIV5.CoreMessage {
    return !MessageList.isMastraMessage(msg) && !(`parts` in msg) && `content` in msg;
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
        // any newly saved Mastra message v3 shape will have content: { format: 3 }
        `format` in msg.content &&
        msg.content.format === 3,
    );
  }
  private static getRole(message: MessageInput): MastraMessageV2['role'] {
    if (message.role === `assistant` || message.role === `tool`) return `assistant`;
    if (message.role === `user`) return `user`;
    // TODO: how should we handle data role?
    throw new Error(
      `BUG: add handling for message role ${message.role} in message ${JSON.stringify(message, null, 2)}`,
    );
  }
  private static cacheKeyFromAIV4Parts(parts: AIV4.UIMessage['parts']): string {
    let key = ``;
    for (const part of parts) {
      key += part.type;
      if (part.type === `text`) {
        // TODO: we may need to hash this with something like xxhash instead of using length
        // for 99.999% of cases this will be fine though because we're comparing messages that have the same ID already.
        key += part.text.length;
      }
      if (part.type === `tool-invocation`) {
        key += part.toolInvocation.toolCallId;
        key += part.toolInvocation.state;
      }
      if (part.type === `reasoning`) {
        // TODO: we may need to hash this with something like xxhash instead of using length
        // for 99.999% of cases this will be fine though because we're comparing messages that have the same ID already.
        key += part.reasoning.length;
        key += part.details.reduce((prev, current) => {
          if (current.type === `text`) {
            return prev + current.text.length + (current.signature?.length || 0);
          }
          return prev;
        }, 0);
      }
      if (part.type === `file`) {
        // TODO: we may need to hash this with something like xxhash instead of using length
        // for 99.999% of cases this will be fine though because we're comparing messages that have the same ID already.
        key += part.data.length;
        key += part.mimeType;
      }
    }
    return key;
  }
  private static cacheKeyFromAIV5Parts(parts: AIV5.UIMessage['parts']): string {
    let key = ``;
    for (const part of parts) {
      key += part.type;
      if (part.type === `text`) {
        // TODO: we may need to hash this with something like xxhash instead of using length
        // for 99.999% of cases this will be fine though because we're comparing messages that have the same ID already.
        key += part.text.length;
      }
      if (AIV5.isToolUIPart(part)) {
        key += part.toolCallId;
        key += part.state;
      }
      if (part.type === `reasoning`) {
        // TODO: we may need to hash this with something like xxhash instead of using length
        // for 99.999% of cases this will be fine though because we're comparing messages that have the same ID already.
        key += part.text.length;
      }
      if (part.type === `file`) {
        // TODO: we may need to hash this with something like xxhash instead of using length
        // for 99.999% of cases this will be fine though because we're comparing messages that have the same ID already.
        key += part.url.length;
        key += part.mediaType;
        key += part.filename || '';
      }
    }
    return key;
  }
  private static coreContentToString(content: AIV5.CoreMessage['content']): string {
    if (typeof content === `string`) return content;

    return content.reduce((p, c) => {
      if (c.type === `text`) {
        p += c.text;
      }
      return p;
    }, '');
  }
  private static cacheKeyFromContent(content: AIV5.CoreMessage['content']): string {
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
        key += part.filename || '';
        key += part.mediaType;
        key += part.data instanceof URL ? part.data.toString() : part.data.toString().length;
      }
      if (part.type === `image`) {
        key += part.image instanceof URL ? part.image.toString() : part.image.toString().length;
        key += part.mediaType;
      }
    }
    return key;
  }
  private static cacheKeyFromV4Content(content: AIV4.CoreMessage['content']): string {
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
    const oneUI = MessageList.isAIV5UIMessage(one) && one;
    const twoUI = MessageList.isAIV5UIMessage(two) && two;
    if (oneUI && !twoUI) return false;
    if (oneUI && twoUI) {
      return MessageList.cacheKeyFromAIV5Parts(one.parts) === MessageList.cacheKeyFromAIV5Parts(two.parts);
    }

    const oneCM = MessageList.isAIV5CoreMessage(one) && one;
    const twoCM = MessageList.isAIV5CoreMessage(two) && two;
    if (oneCM && !twoCM) return false;
    if (oneCM && twoCM) {
      return MessageList.cacheKeyFromContent(oneCM.content) === MessageList.cacheKeyFromContent(twoCM.content);
    }

    const oneMM1 = MessageList.isMastraMessageV1(one) && one;
    const twoMM1 = MessageList.isMastraMessageV1(two) && two;
    if (oneMM1 && !twoMM1) return false;
    if (oneMM1 && twoMM1) {
      return (
        oneMM1.id === twoMM1.id &&
        MessageList.cacheKeyFromV4Content(oneMM1.content) === MessageList.cacheKeyFromV4Content(twoMM1.content)
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

    // default to it did change. we'll likely never reach this codepath
    return true;
  }
}
