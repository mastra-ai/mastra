import { randomUUID } from 'crypto';
import { convertToCoreMessages } from 'ai';
import type { CoreMessage, CoreSystemMessage, IDGenerator, Message, ToolInvocation, UIMessage } from 'ai';
import type { MastraMessageV1 } from '../../memory';
import { isCoreMessage, isUiMessage } from '../../utils';
import { convertToV1Messages } from './prompt/convert-to-mastra-v1';
import { convertDataContentToBase64String } from './prompt/data-content';

export type MastraMessageContentV2 = {
  format: 2; // format 2 === UIMessage in AI SDK v4
  // TODO: When we bump to AI SDK v5 and make "format: 3" we might need to inline these types with a copy/paste
  parts: UIMessage['parts'];
  experimental_attachments?: UIMessage['experimental_attachments'];
  content?: UIMessage['content'];
  toolInvocations?: UIMessage['toolInvocations'];
  reasoning?: UIMessage['reasoning'];
  annotations?: UIMessage['annotations'];
  metadata?: Record<string, unknown>;
};

export type MastraMessageV2 = {
  id: string;
  content: MastraMessageContentV2;
  role: 'user' | 'assistant';
  createdAt: Date;
  threadId?: string;
  resourceId?: string;
  type?: string;
};

export type MessageInput = UIMessage | Message | MastraMessageV1 | CoreMessage | MastraMessageV2;
type MessageSource = 'memory' | 'response' | 'user' | 'system' | 'context';
type MemoryInfo = { threadId: string; resourceId?: string };

export class MessageList {
  private messages: MastraMessageV2[] = [];

  // passed in by dev in input or context
  private systemMessages: CoreSystemMessage[] = [];
  // passed in by us for a specific purpose, eg memory system message
  private taggedSystemMessages: Record<string, CoreSystemMessage[]> = {};

  private memoryInfo: null | MemoryInfo = null;

  // used to filter this.messages by how it was added: input/response/memory
  private memoryMessages = new Set<MastraMessageV2>();
  private newUserMessages = new Set<MastraMessageV2>();
  private newResponseMessages = new Set<MastraMessageV2>();
  private userContextMessages = new Set<MastraMessageV2>();

  private generateMessageId?: IDGenerator;

  constructor({
    threadId,
    resourceId,
    generateMessageId,
  }: { threadId?: string; resourceId?: string; generateMessageId?: IDGenerator } = {}) {
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
  private all = {
    v2: () => this.messages,
    v1: () => convertToV1Messages(this.messages),
    ui: () => this.messages.map(MessageList.toUIMessage),
    core: () => this.convertToCoreMessages(this.all.ui()),
    prompt: () => {
      return [...this.systemMessages, ...Object.values(this.taggedSystemMessages).flat(), ...this.all.core()];
    },
  };
  private remembered = {
    v2: () => this.messages.filter(m => this.memoryMessages.has(m)),
    v1: () => convertToV1Messages(this.remembered.v2()),
    ui: () => this.remembered.v2().map(MessageList.toUIMessage),
    core: () => this.convertToCoreMessages(this.remembered.ui()),
  };
  private input = {
    v2: () => this.messages.filter(m => this.newUserMessages.has(m)),
    v1: () => convertToV1Messages(this.input.v2()),
    ui: () => this.input.v2().map(MessageList.toUIMessage),
    core: () => this.convertToCoreMessages(this.input.ui()),
  };
  private response = {
    v2: () => this.messages.filter(m => this.newResponseMessages.has(m)),
  };
  public drainUnsavedMessages(): MastraMessageV2[] {
    const messages = this.messages.filter(m => this.newUserMessages.has(m) || this.newResponseMessages.has(m));
    this.newUserMessages.clear();
    this.newResponseMessages.clear();
    return messages;
  }
  public getSystemMessages(tag?: string): CoreMessage[] {
    if (tag) {
      return this.taggedSystemMessages[tag] || [];
    }
    return this.systemMessages;
  }
  public addSystem(messages: CoreSystemMessage | CoreSystemMessage[] | string | string[] | null, tag?: string) {
    if (!messages) return this;
    for (const message of Array.isArray(messages) ? messages : [messages]) {
      this.addOneSystem(message, tag);
    }
    return this;
  }

  private convertToCoreMessages(messages: UIMessage[]): CoreMessage[] {
    return convertToCoreMessages(this.sanitizeUIMessages(messages));
  }
  private sanitizeUIMessages(messages: UIMessage[]): UIMessage[] {
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
      .filter((m): m is UIMessage => Boolean(m));
    return msgs;
  }
  private addOneSystem(message: CoreSystemMessage | string, tag?: string) {
    if (typeof message === `string`) message = { role: 'system', content: message };
    if (tag && !this.isDuplicateSystem(message, tag)) {
      this.taggedSystemMessages[tag] ||= [];
      this.taggedSystemMessages[tag].push(message);
    } else if (!this.isDuplicateSystem(message)) {
      this.systemMessages.push(message);
    }
  }
  private isDuplicateSystem(message: CoreSystemMessage, tag?: string) {
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
  private static toUIMessage(m: MastraMessageV2): UIMessage {
    const experimentalAttachments: UIMessage['experimental_attachments'] = m.content.experimental_attachments
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
      return {
        id: m.id,
        role: m.role,
        content: m.content.content || contentString,
        createdAt: m.createdAt,
        parts,
        experimental_attachments: experimentalAttachments,
      };
    } else if (m.role === `assistant`) {
      return {
        id: m.id,
        role: m.role,
        content: m.content.content || contentString,
        createdAt: m.createdAt,
        parts,
        reasoning: undefined,
        toolInvocations: `toolInvocations` in m.content ? m.content.toolInvocations : undefined,
      };
    }

    return {
      id: m.id,
      role: m.role,
      content: m.content.content || contentString,
      createdAt: m.createdAt,
      parts,
      experimental_attachments: experimentalAttachments,
    };
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
    if (message.role === `system` && MessageList.isVercelCoreMessage(message)) return this.addSystem(message);
    if (message.role === `system`) {
      throw new Error(
        `A non-CoreMessage system message was added - this is not supported as we didn't expect this could happen. Please open a Github issue and let us know what you did to get here. This is the non-CoreMessage system message we received:

messageSource: ${messageSource}

${JSON.stringify(message, null, 2)}`,
      );
    }

    const messageV2 = this.inputToMastraMessageV2(message, messageSource);

    const { exists, shouldReplace, id } = this.shouldReplaceMessage(messageV2);

    const latestMessage = this.messages.at(-1);

    const singleToolResult =
      messageV2.role === `assistant` &&
      messageV2.content.parts.length === 1 &&
      messageV2.content.parts[0]?.type === `tool-invocation` &&
      messageV2.content.parts[0].toolInvocation.state === `result` &&
      messageV2.content.parts[0];

    if (
      singleToolResult &&
      (latestMessage?.role !== `assistant` ||
        !latestMessage.content.parts.some(
          p =>
            p.type === `tool-invocation` && p.toolInvocation.toolCallId === singleToolResult.toolInvocation.toolCallId,
        ))
    ) {
      // remove any tool results that aren't updating a tool call
      return;
    }

    if (messageSource === `memory`) {
      for (const existingMessage of this.messages) {
        // don't double store any messages
        if (MessageList.messagesAreEqual(existingMessage, messageV2)) {
          return;
        }
      }
    }
    // If the last message is an assistant message and the new message is also an assistant message, merge them together and update tool calls with results
    const latestMessagePartType = latestMessage?.content?.parts?.filter(p => p.type !== `step-start`)?.at?.(-1)?.type;
    const newMessageFirstPartType = messageV2.content.parts.filter(p => p.type !== `step-start`).at(0)?.type;
    const shouldAppendToLastAssistantMessage =
      latestMessage?.role === 'assistant' &&
      messageV2.role === 'assistant' &&
      latestMessage.threadId === messageV2.threadId;
    const shouldAppendToLastAssistantMessageParts =
      shouldAppendToLastAssistantMessage &&
      newMessageFirstPartType &&
      ((newMessageFirstPartType === `tool-invocation` && latestMessagePartType !== `text`) ||
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
      latestMessage.createdAt = messageV2.createdAt || latestMessage.createdAt;

      for (const [index, part] of messageV2.content.parts.entries()) {
        // If the incoming part is a tool-invocation result, find the corresponding call in the latest message
        if (part.type === 'tool-invocation' && part.toolInvocation.state === 'result') {
          const existingCallPart = [...latestMessage.content.parts]
            .reverse()
            .find(p => p.type === 'tool-invocation' && p.toolInvocation.toolCallId === part.toolInvocation.toolCallId);

          if (existingCallPart && existingCallPart.type === 'tool-invocation') {
            // Update the existing tool-call part with the result
            existingCallPart.toolInvocation = {
              ...existingCallPart.toolInvocation,
              state: 'result',
              result: part.toolInvocation.result,
            };
            if (!latestMessage.content.toolInvocations) {
              latestMessage.content.toolInvocations = [];
            }
            if (
              !latestMessage.content.toolInvocations.some(
                t => t.toolCallId === existingCallPart.toolInvocation.toolCallId,
              )
            ) {
              latestMessage.content.toolInvocations.push(existingCallPart.toolInvocation);
            }
          }
        } else if (
          // if there's no part at this index yet in the existing message we're merging into
          !latestMessage.content.parts[index] ||
          // or there is and the parts are not identical
          MessageList.cacheKeyFromParts([latestMessage.content.parts[index]]) !== MessageList.cacheKeyFromParts([part])
        ) {
          // For all other part types that aren't already present, simply push them to the latest message's parts
          latestMessage.content.parts.push(part);
        }
      }
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
      // This code would combine attachment only messages onto the prev message,
      // but for anyone using CoreMessage or MastraMessageV1 still they would lose the ordering in multi-step interactions
      // } else if (couldMoveAttachmentsToPreviousMessage && messageV2.content.experimental_attachments?.length) {
      //   latestMessage.content.experimental_attachments ||= [];
      //   latestMessage.content.experimental_attachments.push(...messageV2.content.experimental_attachments);
      //   if (latestMessage.createdAt.getTime() < messageV2.createdAt.getTime()) {
      //     latestMessage.createdAt = messageV2.createdAt;
      //   }
    }
    // Else the last message and this message are not both assistant messages OR an existing message has been updated and should be replaced. add a new message to the array or update an existing one.
    else {
      if (messageV2.role === 'assistant' && messageV2.content.parts[0]?.type !== `step-start`) {
        // Add step-start part for new assistant messages
        messageV2.content.parts.unshift({ type: 'step-start' });
      }

      const existingIndex = (shouldReplace && this.messages.findIndex(m => m.id === id)) || -1;
      const existingMessage = existingIndex !== -1 && this.messages[existingIndex];

      if (shouldReplace && existingMessage) {
        this.messages[existingIndex] = messageV2;
      } else if (!exists) {
        this.messages.push(messageV2);
      }

      if (messageSource === `memory`) {
        this.memoryMessages.add(messageV2);
      } else if (messageSource === `response`) {
        this.newResponseMessages.add(messageV2);
      } else if (messageSource === `user`) {
        this.newUserMessages.add(messageV2);
      } else if (messageSource === `context`) {
        this.userContextMessages.add(messageV2);
      } else {
        throw new Error(`Missing message source for message ${messageV2}`);
      }
    }

    // make sure messages are always stored in order of when they were created!
    this.messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return this;
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
    if (MessageList.isVercelCoreMessage(message)) {
      return this.vercelCoreMessageToMastraMessageV2(message, messageSource);
    }
    if (MessageList.isVercelUIMessage(message)) {
      return this.vercelUIMessageToMastraMessageV2(message, messageSource);
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
    const coreV2 = this.vercelCoreMessageToMastraMessageV2(
      {
        content: message.content,
        role: message.role,
      } as CoreMessage,
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
  private hydrateMastraMessageV2Fields(message: MastraMessageV2): MastraMessageV2 {
    if (!(message.createdAt instanceof Date)) message.createdAt = new Date(message.createdAt);
    return message;
  }
  private vercelUIMessageToMastraMessageV2(message: UIMessage, messageSource: MessageSource): MastraMessageV2 {
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

    return {
      id: message.id || this.newMessageId(),
      role: MessageList.getRole(message),
      createdAt: this.generateCreatedAt(messageSource, message.createdAt),
      threadId: this.memoryInfo?.threadId,
      resourceId: this.memoryInfo?.resourceId,
      content,
    } satisfies MastraMessageV2;
  }
  private vercelCoreMessageToMastraMessageV2(coreMessage: CoreMessage, messageSource: MessageSource): MastraMessageV2 {
    const id = `id` in coreMessage ? (coreMessage.id as string) : this.newMessageId();
    const parts: UIMessage['parts'] = [];
    const experimentalAttachments: UIMessage['experimental_attachments'] = [];
    const toolInvocations: ToolInvocation[] = [];

    if (typeof coreMessage.content === 'string') {
      parts.push({ type: 'step-start' });
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

    return {
      id,
      role: MessageList.getRole(coreMessage),
      createdAt: this.generateCreatedAt(messageSource),
      threadId: this.memoryInfo?.threadId,
      resourceId: this.memoryInfo?.resourceId,
      content,
    };
  }

  static isVercelUIMessage(msg: MessageInput): msg is UIMessage {
    return !MessageList.isMastraMessage(msg) && isUiMessage(msg);
  }
  static isVercelCoreMessage(msg: MessageInput): msg is CoreMessage {
    return !MessageList.isMastraMessage(msg) && isCoreMessage(msg);
  }
  static isMastraMessage(msg: MessageInput): msg is MastraMessageV2 | MastraMessageV1 {
    return MessageList.isMastraMessageV2(msg) || MessageList.isMastraMessageV1(msg);
  }
  static isMastraMessageV1(msg: MessageInput): msg is MastraMessageV1 {
    return !MessageList.isMastraMessageV2(msg) && (`threadId` in msg || `resourceId` in msg);
  }
  static isMastraMessageV2(msg: MessageInput): msg is MastraMessageV2 {
    return Boolean(
      msg.content &&
        !Array.isArray(msg.content) &&
        typeof msg.content !== `string` &&
        // any newly saved Mastra message v2 shape will have content: { format: 2 }
        `format` in msg.content &&
        msg.content.format === 2,
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
  private static cacheKeyFromParts(parts: UIMessage['parts']): string {
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
  private static coreContentToString(content: CoreMessage['content']): string {
    if (typeof content === `string`) return content;

    return content.reduce((p, c) => {
      if (c.type === `text`) {
        p += c.text;
      }
      return p;
    }, '');
  }
  private static cacheKeyFromContent(content: CoreMessage['content']): string {
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
    const oneUI = MessageList.isVercelUIMessage(one) && one;
    const twoUI = MessageList.isVercelUIMessage(two) && two;
    if (oneUI && !twoUI) return false;
    if (oneUI && twoUI) {
      return MessageList.cacheKeyFromParts(one.parts) === MessageList.cacheKeyFromParts(two.parts);
    }

    const oneCM = MessageList.isVercelCoreMessage(one) && one;
    const twoCM = MessageList.isVercelCoreMessage(two) && two;
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
        MessageList.cacheKeyFromContent(oneMM1.content) === MessageList.cacheKeyFromContent(twoMM1.content)
      );
    }

    const oneMM2 = MessageList.isMastraMessageV2(one) && one;
    const twoMM2 = MessageList.isMastraMessageV2(two) && two;
    if (oneMM2 && !twoMM2) return false;
    if (oneMM2 && twoMM2) {
      return (
        oneMM2.id === twoMM2.id &&
        MessageList.cacheKeyFromParts(oneMM2.content.parts) === MessageList.cacheKeyFromParts(twoMM2.content.parts)
      );
    }

    // default to it did change. we'll likely never reach this codepath
    return true;
  }
}
