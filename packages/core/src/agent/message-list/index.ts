import { randomUUID } from 'crypto';
import { convertToCoreMessages } from 'ai';
import type { CoreMessage, CoreSystemMessage, IDGenerator, Message, ToolInvocation, UIMessage } from 'ai';
import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
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

// Extend UIMessage to include optional metadata field
export type UIMessageWithMetadata = UIMessage & {
  metadata?: Record<string, unknown>;
};

export type MessageInput =
  | UIMessage
  | UIMessageWithMetadata
  | Message
  | MastraMessageV1
  | CoreMessage
  | MastraMessageV2;
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
  private _agentNetworkAppend = false;

  constructor({
    threadId,
    resourceId,
    generateMessageId,
    // @ts-ignore Flag for agent network messages
    _agentNetworkAppend,
  }: { threadId?: string; resourceId?: string; generateMessageId?: IDGenerator } = {}) {
    if (threadId) {
      this.memoryInfo = { threadId, resourceId };
      this.generateMessageId = generateMessageId;
    }
    this._agentNetworkAppend = _agentNetworkAppend || false;
  }

  public add(messages: string | string[] | MessageInput | MessageInput[], messageSource: MessageSource) {
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
  public get clear() {
    return {
      input: {
        v2: () => {
          const userMessages = Array.from(this.newUserMessages);
          this.messages = this.messages.filter(m => !this.newUserMessages.has(m));
          this.newUserMessages.clear();
          return userMessages;
        },
      },
    };
  }
  private all = {
    v2: () => this.messages,
    v1: () => convertToV1Messages(this.messages),
    ui: () => this.messages.map(MessageList.toUIMessage),
    core: () => this.convertToCoreMessages(this.all.ui()),
    prompt: () => {
      const coreMessages = this.all.core();

      // Some LLM providers will throw an error if the first message is a tool call.

      const messages = [...this.systemMessages, ...Object.values(this.taggedSystemMessages).flat(), ...coreMessages];

      const needsDefaultUserMessage = !messages.length || messages[0]?.role === 'assistant';

      if (needsDefaultUserMessage) {
        const defaultMessage: CoreMessage = {
          role: 'user',
          content: '.',
        };

        messages.unshift(defaultMessage);
      }

      return messages;
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
  public getEarliestUnsavedMessageTimestamp(): number | undefined {
    const unsavedMessages = this.messages.filter(m => this.newUserMessages.has(m) || this.newResponseMessages.has(m));
    if (unsavedMessages.length === 0) return undefined;
    // Find the earliest createdAt among unsaved messages
    return Math.min(...unsavedMessages.map(m => new Date(m.createdAt).getTime()));
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
  private static toUIMessage(m: MastraMessageV2): UIMessageWithMetadata {
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
        } else if (
          part.type === 'tool-invocation' &&
          (part.toolInvocation.state === 'call' || part.toolInvocation.state === 'partial-call')
        ) {
          // Filter out tool invocations with call or partial-call states
          continue;
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
      const uiMessage: UIMessageWithMetadata = {
        id: m.id,
        role: m.role,
        content: m.content.content || contentString,
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

    if (message.role === `system` && MessageList.isVercelCoreMessage(message)) return this.addSystem(message);
    if (message.role === `system`) {
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
    const partKey = MessageList.cacheKeyFromParts([part]);
    const latestPartCount = latestMessage.content.parts.filter(
      p => MessageList.cacheKeyFromParts([p]) === partKey,
    ).length;
    const newPartCount = newMessage.content.parts.filter(p => MessageList.cacheKeyFromParts([p]) === partKey).length;
    // If the number of parts in the latest message is less than the number of parts in the new message, insert the part
    if (latestPartCount < newPartCount) {
      if (typeof insertAt === 'number') {
        latestMessage.content.parts.splice(insertAt, 0, part);
      } else {
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
      const key = MessageList.cacheKeyFromParts([part]);
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
            .some(p => MessageList.cacheKeyFromParts([p]) === MessageList.cacheKeyFromParts([part]))
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
  private vercelUIMessageToMastraMessageV2(
    message: UIMessage | UIMessageWithMetadata,
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

  static isVercelUIMessage(msg: MessageInput): msg is UIMessage | UIMessageWithMetadata {
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
        key += `${part.text.length}${part.text}`;
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
