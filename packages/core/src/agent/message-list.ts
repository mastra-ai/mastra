import { randomUUID } from 'crypto';
import type { CoreMessage, FilePart, Message, UIMessage } from 'ai';
import type { MessageType } from '../memory';
import { isCoreMessage, isUiMessage } from '../utils';

export type MastraMessageContentV2 = {
  format: 2; // format 2 === UIMessage in AI SDK v4
  // TODO: When we bump to AI SDK v5 and make "format: 3" we might need to inline these types with a copy/paste
  parts: UIMessage['parts'];
  experimental_attachments?: UIMessage['experimental_attachments'];
  content?: UIMessage['content'];
  toolInvocations?: UIMessage['toolInvocations'];
  reasoning?: UIMessage['reasoning'];
  annotations?: UIMessage['annotations'];
};

export type MastraMessageV2 = {
  id: string;
  content: MastraMessageContentV2;
  role: 'user' | 'assistant';
  createdAt: Date;
  threadId?: string;
  resourceId?: string;
};

type MessageInput = UIMessage | Message | MessageType | CoreMessage | MastraMessageV2;

export class MessageList {
  private messages: MastraMessageV2[] = [];
  private memoryInfo: null | { threadId: string; resourceId?: string } = null;

  constructor({
    threadId,
    resourceId,
  }: { threadId?: string; resourceId?: string } | { threadId: string; resourceId?: string } = {}) {
    if (threadId) {
      this.memoryInfo = { threadId, resourceId };
    }
  }

  public add(messages: MessageInput | MessageInput[]) {
    if (Array.isArray(messages)) {
      for (const message of messages) {
        this.addOne(message);
      }
    } else {
      this.addOne(messages);
    }

    return this;
  }
  public getMessages(): MastraMessageV2[] {
    return this.messages;
  }
  public toUIMessages(): UIMessage[] {
    return this.messages.map(MessageList.toUIMessage);
  }
  private static toUIMessage(m: MastraMessageV2): UIMessage {
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

    if (m.role === `user`) {
      return {
        id: m.id,
        role: m.role,
        content: contentString,
        createdAt: m.createdAt,
        parts: m.content.parts,
        experimental_attachments: m.content.experimental_attachments || [],
      };
    } else if (m.role === `assistant`) {
      return {
        id: m.id,
        role: m.role,
        content: contentString,
        createdAt: m.createdAt,
        parts: m.content.parts,
        reasoning: undefined,
        toolInvocations: `toolInvocations` in m.content ? m.content.toolInvocations : undefined,
      };
    }

    return {
      id: m.id,
      role: m.role,
      content: contentString,
      createdAt: m.createdAt,
      parts: m.content.parts,
    };
  }

  private getMessageById(id: string) {
    return this.messages.find(m => m.id === id);
  }
  private shouldUpdateMessage(message: MessageInput): { exists: boolean; shouldUpdate?: boolean; id?: string } {
    if (!this.messages.length) return { exists: false };

    if (!(`id` in message) || !message?.id) {
      return { exists: false };
    }

    const existingMessage = this.getMessageById(message.id);
    if (!existingMessage) return { exists: false };

    return {
      exists: true,
      shouldUpdate: !MessageList.messagesAreEqual(existingMessage, message),
      id: existingMessage.id,
    };
  }
  private addOne(message: MessageInput) {
    if (message.role === `system`) {
      // TODO: should we handle this more gracefully?
      throw new Error(`Cannot add system messages to MessageList class.`);
    }

    const messageV2 = this.inputToMastraMessageV2(message);

    const { exists, shouldUpdate, id } = this.shouldUpdateMessage(message);

    const latestMessage = this.messages.at(-1);

    // Handle non-tool messages (user, assistant, system, data)
    // If the last message is an assistant message and the new message is also an assistant message, merge them.
    if (latestMessage?.role === 'assistant' && messageV2.role === 'assistant' && !shouldUpdate) {
      latestMessage.createdAt = messageV2.createdAt || latestMessage.createdAt;

      for (const part of messageV2.content.parts) {
        // If the incoming part is a tool-invocation result, find the corresponding call in the latest message
        if (part.type === 'tool-invocation' && part.toolInvocation.state === 'result') {
          const existingCallPart = latestMessage.content.parts.find(
            p => p.type === 'tool-invocation' && p.toolInvocation.toolCallId === part.toolInvocation.toolCallId,
          );

          if (existingCallPart && existingCallPart.type === 'tool-invocation') {
            // Update the existing tool-call part with the result
            existingCallPart.toolInvocation = {
              ...existingCallPart.toolInvocation,
              state: 'result',
              result: part.toolInvocation.result,
            };
            // Keep the existing args from the call part
          } else {
            // This indicates a tool result for a call not found in the preceding assistant message
            // TODO: use logger
            console.warn(
              `Tool call part not found in preceding assistant message for result: ${part.toolInvocation.toolCallId}. Skipping result part.`,
              part,
            );
          }
        } else {
          // For all other part types, simply push them to the latest message's parts
          latestMessage.content.parts.push(part);
        }
      }
    } else {
      // Add new message if not merging with the last assistant message
      if (messageV2.role === 'assistant' && messageV2.content.parts[0]?.type !== `step-start`) {
        // Add step-start part for new assistant messages
        messageV2.content.parts.unshift({ type: 'step-start' });
      }

      const existingIndex = (shouldUpdate && this.messages.findIndex(m => m.id === id)) || -1;

      if (shouldUpdate && existingIndex !== -1) {
        this.messages[existingIndex] = messageV2;
      } else if (!exists) {
        this.messages.push(messageV2);
      }
    }

    return this;
  }

  private inputToMastraMessageV2(message: MessageInput): MastraMessageV2 {
    if (`threadId` in message && message.threadId && this.memoryInfo && message.threadId !== this.memoryInfo.threadId) {
      throw new Error(
        `Received input message with wrong threadId. Input ${message.threadId}, expected ${this.memoryInfo.threadId}`,
      );
    }

    if (
      `resourceId` in message &&
      message.resourceId &&
      this.memoryInfo &&
      message.resourceId !== this.memoryInfo.resourceId
    ) {
      throw new Error(
        `Received input message with wrong resourceId. Input ${message.resourceId}, expected ${this.memoryInfo.resourceId}`,
      );
    }

    if (MessageList.isMastraMessageV1(message)) return this.mastraMessageV1ToMastraMessageV2(message);
    if (MessageList.isMastraMessageV2(message)) return message;
    if (MessageList.isVercelCoreMessage(message)) return this.vercelCoreMessageToMastraMessageV2(message);
    if (MessageList.isVercelUIMessage(message)) return this.vercelUIMessageToMastraMessageV2(message);

    throw new Error(`Found unhandled message ${JSON.stringify(message)}`);
  }

  private lastCreatedAt: Date | undefined;
  private generateCreatedAt(): Date {
    const now = new Date();

    if (this.lastCreatedAt) {
      const lastTime = this.lastCreatedAt.getTime();

      if (now.getTime() <= lastTime) {
        const newDate = new Date(lastTime + 1);
        this.lastCreatedAt = newDate;
        return newDate;
      }
    }

    this.lastCreatedAt = now;
    return now;
  }

  private mastraMessageV1ToMastraMessageV2(message: MessageType): MastraMessageV2 {
    const coreV2 = this.vercelCoreMessageToMastraMessageV2({
      content: message.content,
      role: message.role,
    } as CoreMessage);

    return {
      id: message.id,
      role: coreV2.role,
      createdAt: message.createdAt || this.generateCreatedAt(),
      threadId: message.threadId,
      resourceId: message.resourceId,
      content: coreV2.content,
    };
  }

  private vercelUIMessageToMastraMessageV2(message: UIMessage): MastraMessageV2 {
    const content: MastraMessageContentV2 = {
      format: 2,
      parts: message.parts,
    };

    if (message.toolInvocations) content.toolInvocations = message.toolInvocations;
    if (message.reasoning) content.reasoning = message.reasoning;
    if (message.annotations) content.annotations = message.annotations;
    if (message.experimental_attachments) content.experimental_attachments = message.experimental_attachments;

    return {
      id: message.id || randomUUID(),
      role: MessageList.getRole(message),
      createdAt: message.createdAt || this.generateCreatedAt(),
      threadId: this.memoryInfo?.threadId,
      resourceId: this.memoryInfo?.resourceId,
      content,
    } satisfies MastraMessageV2;
  }
  private vercelCoreMessageToMastraMessageV2(coreMessage: CoreMessage): MastraMessageV2 {
    const id = randomUUID();
    const createdAt = this.generateCreatedAt();
    const parts: UIMessage['parts'] = [];
    const experimentalAttachments: UIMessage['experimental_attachments'] = [];

    if (typeof coreMessage.content === 'string' && coreMessage.content !== ``) {
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
            parts.push({
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                result: part.result,
                args: {}, // Args are unknown at this stage
              },
            });
            break;

          case 'reasoning':
            // CoreMessage reasoning parts have text and signature
            parts.push({
              type: 'reasoning',
              reasoning: part.text, // Assuming text is the main reasoning content
              details: [{ type: 'text', text: part.text, signature: part.signature }],
            });
            break;
          case 'redacted-reasoning':
            // CoreMessage redacted-reasoning parts have data
            parts.push({
              type: 'reasoning',
              reasoning: '', // No text reasoning for redacted parts
              details: [{ type: 'redacted', data: part.data }],
            });
            break;
          case 'file':
            // CoreMessage file parts can have mimeType and data (binary/data URL) or just a URL
            const { type, string } = MessageList.urlDataContentToString(part.data);
            if (type === `file`) {
              parts.push({
                type: 'file',
                mimeType: part.mimeType,
                data: string,
              });
            } else if (type === `attachment`) {
              experimentalAttachments.push({
                name: part.filename,
                url: string,
                contentType: part.mimeType,
              });
            }
            break;
          default:
            throw new Error(`Found unknown CoreMessage content part type: ${part.type}`);
        }
      }
    }

    const content: MastraMessageV2['content'] = {
      format: 2,
      parts,
    };

    if (typeof coreMessage.content === `string`) content.content = coreMessage.content;
    if (experimentalAttachments.length) content.experimental_attachments = experimentalAttachments;

    return {
      id,
      role: MessageList.getRole(coreMessage),
      createdAt,
      threadId: this.memoryInfo?.threadId,
      resourceId: this.memoryInfo?.resourceId,
      content,
    };
  }

  private static isVercelUIMessage(msg: MessageInput): msg is UIMessage {
    return !MessageList.isMastraMessage(msg) && isUiMessage(msg);
  }
  private static isVercelCoreMessage(msg: MessageInput): msg is CoreMessage {
    return !MessageList.isMastraMessage(msg) && isCoreMessage(msg);
  }
  private static isMastraMessage(msg: MessageInput): msg is MastraMessageV2 | MessageType {
    return MessageList.isMastraMessageV2(msg) || MessageList.isMastraMessageV1(msg);
  }
  private static isMastraMessageV1(msg: MessageInput): msg is MessageType {
    return !MessageList.isMastraMessageV2(msg) && (`threadId` in msg || `resourceId` in msg);
  }
  private static isMastraMessageV2(msg: MessageInput): msg is MastraMessageV2 {
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
        key += part.text.length;
      }
      if (part.type === `tool-invocation`) {
        key += part.toolInvocation.toolCallId;
        key += part.toolInvocation.state;
      }
      if (part.type === `reasoning`) {
        key += part.reasoning.length;
      }
      if (part.type === `file`) {
        key += part.data.length;
        key += part.mimeType;
      }
    }
    return key;
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
    const oneCreatedAt = `createdAt` in one ? one.createdAt?.getTime() || 0 : undefined;
    const twoCreatedAt = `createdAt` in two ? two.createdAt?.getTime() || 0 : undefined;

    if (oneCreatedAt !== twoCreatedAt) {
      return false;
    }

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
      return MessageList.cacheKeyFromContent(oneMM1.content) === MessageList.cacheKeyFromContent(twoMM1.content);
    }

    const oneMM2 = MessageList.isMastraMessageV2(one) && one;
    const twoMM2 = MessageList.isMastraMessageV2(two) && two;
    if (oneMM2 && !twoMM2) return false;
    if (oneMM2 && twoMM2) {
      return (
        MessageList.cacheKeyFromParts(oneMM2.content.parts) === MessageList.cacheKeyFromParts(twoMM2.content.parts)
      );
    }

    // default to it did change. we'll likely never reach this codepath
    return true;
  }
  private static urlDataContentToString(data: FilePart['data']): { string: string; type: 'file' | 'attachment' } {
    if (data instanceof URL) {
      try {
        // Validate URL object
        new URL(data.toString()); // Check if it's a valid URL format
        if (data.protocol !== 'data:') {
          // If it's a non-data URL, add it to experimental_attachments
          return { type: 'attachment', string: data.toString() };
        } else {
          // If it's a data URL object, convert to base64 and add to parts
          return { type: 'file', string: toBase64String(data) };
        }
      } catch (error) {
        console.error(`Invalid URL in CoreMessage file part`, error);
      }
    } else if (typeof data === 'string') {
      try {
        // Validate URL string or data URL string
        if (data.startsWith('http://') || data.startsWith('https://')) {
          // If it's a non-data URL string, add it to experimental_attachments
          return { type: 'attachment', string: data };
        } else if (data.startsWith('data:')) {
          // If it's a data URL string, convert to base64 and add to parts
          return { type: 'file', string: toBase64String(data) };
        } else {
          // Assume it's base64 data directly
          return { type: 'file', string: data };
        }
      } catch (error) {
        console.error(`Invalid URL or data URL string in CoreMessage file part`, error);
      }
    } else {
      // Otherwise (binary data), convert to base64 and add to parts
      try {
        return { type: 'file', string: toBase64String(data) };
      } catch (error) {
        console.error(`Failed to convert binary data to base64 in CoreMessage file part: ${error}`, error);
      }
    }

    throw new Error(`Unhandled DataContent URL in file part`);
  }
}

export function toBase64String(data: Uint8Array | ArrayBuffer | string | URL): string {
  if (typeof data === 'string') {
    // If it's a string, assume it's already base64 or should be treated as such.
    return data;
  }

  if (data instanceof Uint8Array) {
    return Buffer.from(data).toString('base64');
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString('base64');
  }

  if (data instanceof URL) {
    // If it's a URL, check if it's a data URL and extract the base64 data
    if (data.protocol === 'data:') {
      const base64Match = data.toString().match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match && base64Match[1]) {
        return base64Match[1];
      } else {
        // TODO: is this right?
        throw new Error(`Invalid data URL format: ${data}`);
      }
    } else {
      // If it's a non-data URL, throw an error or handle as needed
      // TODO: is this right?
      throw new Error(`Unsupported URL protocol for base64 conversion: ${data.protocol}`);
    }
  }

  // TODO: is this right?
  throw new Error(
    `Unsupported data type for base64 conversion: ${typeof data}. Expected Uint8Array, ArrayBuffer, string, or URL.`,
  );
}
