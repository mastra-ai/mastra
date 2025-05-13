import { randomUUID } from 'crypto';
import type { CoreMessage, UIMessage } from 'ai';
import type { MessageType } from '../memory';
import { isCoreMessage, isUiMessage } from '../utils';

export type MastraMessageContentV2 = {
  format: 2;
  parts: UIMessage['parts'];
  experimental_attachments?: UIMessage['experimental_attachments'];
};

export type MastraMessageV2 = {
  id: string;
  content: MastraMessageContentV2;
  role: 'system' | 'user' | 'assistant' | 'data';
  createdAt: Date;
  threadId?: string;
  resourceId?: string;
};

type MessageInput = UIMessage | MessageType | CoreMessage | MastraMessageV2;
// type MessageContentOriginal = UserContent | AssistantContent | ToolContent | MastraMessageContentV2;

export type MessageListItem = {
  id: MastraMessageV2['id'];
  role: MastraMessageV2['role'];
  createdAt: MastraMessageV2['createdAt'];
  originalMessage: MessageInput;
  contentSource: 'memory' | 'new-message';
  content: MastraMessageContentV2;
  threadId?: string;
  resourceId?: string;
};

export class MessageList {
  private messages: MessageListItem[] = [];
  private lastCreatedAt: Date | undefined;
  private memoryInfo: null | { threadId: string; resourceId?: string } = null;

  constructor({
    threadId,
    resourceId,
  }: { threadId?: string; resourceId?: string } | { threadId: string; resourceId?: string } = {}) {
    if (threadId) {
      this.memoryInfo = { threadId, resourceId };
    }
  }

  private generateCreatedAt(): Date {
    const now = new Date();
    if (this.lastCreatedAt && now.getTime() <= this.lastCreatedAt.getTime()) {
      const newDate = new Date(this.lastCreatedAt.getTime() + 1);
      this.lastCreatedAt = newDate;
      return newDate;
    }
    this.lastCreatedAt = now;
    return now;
  }

  private isVercelUIMessage(msg: MessageInput): msg is UIMessage {
    return !this.isMastraMessage(msg) && isUiMessage(msg);
  }
  private isVercelCoreMessage(msg: MessageInput): msg is CoreMessage {
    return !this.isMastraMessage(msg) && isCoreMessage(msg);
  }
  private isMastraMessage(msg: MessageInput): msg is MastraMessageV2 | MessageType {
    return this.isMastraMessageV2(msg) || this.isMastraMessageV1(msg);
  }
  private isMastraMessageV1(msg: MessageInput): msg is MessageType {
    return !this.isMastraMessageV2(msg) && (`threadId` in msg || `resourceId` in msg);
  }
  private isMastraMessageV2(msg: MessageInput): msg is MastraMessageV2 {
    return Boolean(
      msg.content &&
        !Array.isArray(msg.content) &&
        typeof msg.content !== `string` &&
        // any newly saved Mastra message v2 shape will have content: { format: 2 }
        `format` in msg.content &&
        msg.content.format === 2,
    );
  }
  // TODO: need to differentiate AI SDK v4 and v5 messages?
  private mastraMessageV1ToMastraMessageV2(message: MessageType): MastraMessageV2 {
    const createdAt = message.createdAt || this.generateCreatedAt();
    const parts: UIMessage['parts'] = [];

    if (typeof message.content === 'string') {
      parts.push({
        type: 'text',
        text: message.content,
      });
    } else if (Array.isArray(message.content)) {
      for (const part of message.content) {
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
          // TODO: Handle reasoning, redacted-reasoning, and file types if necessary
          default:
            // Ignore unknown part types for now
            console.warn(`Ignoring unknown MessageType content part type: ${part.type}`);
            break;
        }
      }
    }

    return {
      id: message.id,
      role: message.role as any, // TODO: Refine role mapping if necessary
      createdAt,
      threadId: message.threadId,
      resourceId: message.resourceId,
      content: {
        format: 2,
        parts,
      },
    };
  }

  private vercelUIMessageToMastraMessageV2(message: UIMessage): MastraMessageV2 {
    return {
      id: message.id || randomUUID(),
      role: message.role,
      createdAt: message.createdAt || this.generateCreatedAt(),
      threadId: this.memoryInfo?.threadId,
      resourceId: this.memoryInfo?.resourceId,
      content: {
        format: 2,
        parts: message.parts,
        experimental_attachments: message.experimental_attachments,
      },
    };
  }
  // TODO: need to differentiate AI SDK v4 and v5 messages?
  private vercelCoreMessageToMastraMessageV2(coreMessage: CoreMessage): MastraMessageV2 {
    const id = randomUUID();
    const createdAt = this.generateCreatedAt();
    const parts: UIMessage['parts'] = [];

    if (typeof coreMessage.content === 'string' && coreMessage.content !== ``) {
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
            const callIndex = parts.findIndex(
              p =>
                p.type === `tool-invocation` &&
                p.toolInvocation.toolCallId === part.toolCallId &&
                p.toolInvocation.state !== `result`,
            );
            const call = parts[callIndex];
            if (call) {
              delete parts[callIndex];
            }
            parts.push({
              type: 'tool-invocation',
              toolInvocation: {
                toolName: part.toolName,
                result: part.result,
                toolCallId: part.toolCallId,
                args: call && `args` in call && call.args ? call.args : {},
                state: `result`,
              },
            });
            break;

          // TODO: Handle reasoning, redacted-reasoning, and file types
          default:
            throw new Error(`Found unknown CoreMessage content part type: ${part.type}`);
        }
      }
    }

    return {
      id,
      role: coreMessage.role === `tool` ? `assistant` : coreMessage.role,
      createdAt,
      threadId: this.memoryInfo?.threadId,
      resourceId: this.memoryInfo?.resourceId,
      content: {
        format: 2,
        parts,
      },
    };
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

    if (this.isMastraMessageV1(message)) return this.mastraMessageV1ToMastraMessageV2(message);
    if (this.isMastraMessageV2(message)) return message;
    if (this.isVercelCoreMessage(message)) return this.vercelCoreMessageToMastraMessageV2(message);
    if (this.isVercelUIMessage(message)) return this.vercelUIMessageToMastraMessageV2(message);

    throw new Error(`Found unhandled message ${JSON.stringify(message)}`);
  }

  private addOne(message: MessageInput, contentSource: MessageListItem['contentSource']) {
    const messageV2 = this.inputToMastraMessageV2(message);

    const latestMessage = this.messages.at(-1);
    if (latestMessage?.role === `assistant` && messageV2.role === `assistant`) {
      latestMessage.createdAt = messageV2.createdAt || latestMessage.createdAt;

      for (const part of messageV2.content.parts) {
        if (part.type === `tool-invocation` && part.toolInvocation.state === `result`) {
          const existingPart = latestMessage.content.parts.find(
            p => p.type === `tool-invocation` && p.toolInvocation.toolCallId === part.toolInvocation.toolCallId,
          );
          if (existingPart && existingPart.type === `tool-invocation`) {
            existingPart.toolInvocation = {
              state: 'result',
              toolCallId: existingPart.toolInvocation.toolCallId,
              result: part.toolInvocation.result,
              args: existingPart.toolInvocation.args,
              toolName: existingPart.toolInvocation.toolName,
            };
          }
        } else {
          latestMessage.content.parts.push(part);
        }
      }
    } else {
      if (messageV2.role === `assistant`) {
        messageV2.content.parts.unshift({ type: 'step-start' });
      }
      this.messages.push({
        ...messageV2,
        originalMessage: message,
        contentSource,
      });
    }

    return this;
  }
  public add(messages: MessageInput | MessageInput[], contentSource: MessageListItem['contentSource']) {
    if (Array.isArray(messages)) {
      for (const message of messages) {
        this.addOne(message, contentSource);
      }
    } else {
      this.addOne(messages, contentSource);
    }

    return this;
  }

  public toUIMessages(): UIMessage[] {
    return this.messages.map(m => ({
      id: m.id,
      role: m.role,
      content: '',
      createdAt: m.createdAt,
      parts: m.content.parts,
      experimental_attachments: m.content.experimental_attachments || [],
    }));
  }

  public getMessages(): MessageListItem[] {
    return this.messages;
  }
}
