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
        throw new Error(`Invalid data URL format: ${data}`);
      }
    } else {
      // If it's a non-data URL, throw an error or handle as needed
      throw new Error(`Unsupported URL protocol for base64 conversion: ${data.protocol}`);
    }
  }

  throw new Error(
    `Unsupported data type for base64 conversion: ${typeof data}. Expected Uint8Array, ArrayBuffer, string, or URL.`,
  );
}

export class MessageList {
  private messages: MessageListItem[] = [];
  private memoryInfo: null | { threadId: string; resourceId?: string } = null;

  constructor({
    threadId,
    resourceId,
  }: { threadId?: string; resourceId?: string } | { threadId: string; resourceId?: string } = {}) {
    if (threadId) {
      this.memoryInfo = { threadId, resourceId };
    }
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

  private addOne(message: MessageInput, contentSource: MessageListItem['contentSource']) {
    const messageV2 = this.inputToMastraMessageV2(message);

    const latestMessage = this.messages.at(-1);

    // Handle non-tool messages (user, assistant, system, data)
    // If the last message is an assistant message and the new message is also an assistant message, merge them.
    if (latestMessage?.role === 'assistant' && messageV2.role === 'assistant') {
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
      if (messageV2.role === 'assistant') {
        // Add step-start part for new assistant messages
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
    const experimentalAttachments: UIMessage['experimental_attachments'] = [];

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
          case 'reasoning':
            parts.push({
              type: 'reasoning',
              reasoning: part.text, // Assuming reasoning text is directly in text for V1
              details: [{ type: 'text', text: part.text, signature: part.signature }], // Assuming simple text detail for V1
            });
            break;
          case 'redacted-reasoning':
            parts.push({
              type: 'reasoning',
              reasoning: '', // V1 might not have a separate reasoning field for redacted
              details: [{ type: 'redacted', data: part.data }],
            });
            break;
          case 'file':
            // Mastra V1 file parts can have mimeType and data (binary/data URL, URL object, or URL string)

            // Validate mimeType for non-image/text files
            if (
              !part.mimeType ||
              (part.mimeType !== 'image/jpeg' &&
                part.mimeType !== 'image/png' &&
                part.mimeType !== 'image/gif' &&
                part.mimeType !== 'text/plain' &&
                part.mimeType !== 'text/html' &&
                part.mimeType !== 'text/css' &&
                part.mimeType !== 'text/javascript' &&
                part.mimeType !== 'application/json' &&
                part.mimeType !== 'application/xml' &&
                part.mimeType !== 'application/pdf')
            ) {
              console.warn(
                `Missing or unsupported mimeType for file part: ${part.mimeType}. Treating as generic file.`,
              );
              // Decide how to handle this - for now, proceed but maybe log a warning or use a default mimeType?
              // For now, we'll proceed, but this might be a point for refinement.
            }

            if (part.data instanceof URL) {
              try {
                // Validate URL object
                new URL(part.data.toString()); // Check if it's a valid URL format
                if (part.data.protocol !== 'data:') {
                  // If it's a non-data URL object, add it to experimental_attachments
                  experimentalAttachments.push({
                    name: part.filename, // Assuming V1 MessageType FilePart might have a name, or leave undefined
                    url: part.data.toString(),
                    contentType: part.mimeType, // Use mimeType as contentType
                  });
                } else {
                  // If it's a data URL object, convert to base64 and add to parts
                  parts.push({
                    type: 'file',
                    mimeType: part.mimeType,
                    data: toBase64String(part.data),
                  });
                }
              } catch (error) {
                console.error(`Invalid URL in Mastra V1 file part: ${part.data}`, error);
                // Decide how to handle invalid URLs - skip the part, throw an error?
                // For now, we'll skip this part.
              }
            } else if (typeof part.data === 'string') {
              try {
                // Validate URL string or data URL string
                if (part.data.startsWith('http://') || part.data.startsWith('https://')) {
                  new URL(part.data); // Check if it's a valid URL format
                  // If it's a non-data URL string, add it to experimental_attachments
                  experimentalAttachments.push({
                    name: part.filename, // Assuming V1 MessageType FilePart might have a name, or leave undefined
                    url: part.data,
                    contentType: part.mimeType, // Use mimeType as contentType
                  });
                } else if (part.data.startsWith('data:')) {
                  // If it's a data URL string, convert to base64 and add to parts
                  parts.push({
                    type: 'file',
                    mimeType: part.mimeType,
                    data: toBase64String(part.data),
                  });
                } else {
                  // Assume it's base64 data directly
                  parts.push({
                    type: 'file',
                    mimeType: part.mimeType,
                    data: part.data, // Assume it's already base64
                  });
                }
              } catch (error) {
                console.error(`Invalid URL or data URL string in Mastra V1 file part: ${part.data}`, error);
                // Decide how to handle invalid URLs - skip the part, throw an error?
                // For now, we'll skip this part.
              }
            } else {
              // Otherwise (binary data), convert to base64 and add to parts
              try {
                parts.push({
                  type: 'file',
                  mimeType: part.mimeType,
                  data: toBase64String(part.data),
                });
              } catch (error) {
                console.error(`Failed to convert binary data to base64 in Mastra V1 file part: ${error}`, error);
                // Decide how to handle conversion errors - skip the part, throw an error?
                // For now, we'll skip this part.
              }
            }
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
          default:
            // Ignore unknown part types for now
            console.warn(`Ignoring unknown MessageType content part type: ${part.type}`);
            break;
        }
      }
    }

    const content: MastraMessageV2['content'] = {
      format: 2,
      parts,
    };
    if (experimentalAttachments.length) content.experimental_attachments = experimentalAttachments;

    return {
      id: message.id,
      role: message.role === `tool` ? `assistant` : message.role,
      createdAt,
      threadId: message.threadId,
      resourceId: message.resourceId,
      content,
    };
  }

  private vercelUIMessageToMastraMessageV2(message: UIMessage): MastraMessageV2 {
    const experimentalAttachments: UIMessage['experimental_attachments'] = [];

    if (message.experimental_attachments && Array.isArray(message.experimental_attachments)) {
      for (const attachment of message.experimental_attachments) {
        if (!attachment.url) {
          console.warn('Skipping attachment with missing URL:', attachment);
          continue;
        }

        try {
          const url = new URL(attachment.url);

          // Check for unsupported protocols
          if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'data:') {
            console.warn(`Skipping attachment with unsupported URL protocol: ${url.protocol}`, attachment);
            continue;
          }

          // Check for invalid data URL format
          if (url.protocol === 'data:') {
            // The toBase64String function already validates data URL format,
            // so we can rely on it throwing an error if invalid.
            // Just calling it here to trigger potential validation error.
            toBase64String(url);
          }

          // Check for missing contentType for non-image/text types (based on AI SDK test)
          // Note: AI SDK test specifically checked for 'file' type without contentType.
          // We'll do a broader check for non-image/text, but could refine if needed.
          if (
            !attachment.contentType &&
            !attachment.url.startsWith('data:image/') &&
            !attachment.url.startsWith('data:text/')
          ) {
            console.warn('Skipping attachment with missing contentType for non-image/text data:', attachment);
            continue;
          }

          // If all checks pass, add the attachment
          experimentalAttachments.push(attachment);
        } catch (error) {
          console.error(`Skipping attachment with invalid URL or data: ${attachment.url}`, error);
          continue;
        }
      }
    }

    return {
      id: message.id || randomUUID(),
      role: message.role,
      createdAt: message.createdAt || this.generateCreatedAt(),
      threadId: this.memoryInfo?.threadId,
      resourceId: this.memoryInfo?.resourceId,
      content: {
        format: 2,
        parts: message.parts || [], // Ensure parts is always an array
        experimental_attachments: experimentalAttachments.length > 0 ? experimentalAttachments : [], // Only include if not empty
      },
    };
  }

  // TODO: need to differentiate AI SDK v4 and v5 messages?
  private vercelCoreMessageToMastraMessageV2(coreMessage: CoreMessage): MastraMessageV2 {
    const id = randomUUID();
    const createdAt = this.generateCreatedAt();
    const parts: UIMessage['parts'] = [];
    const experimentalAttachments: UIMessage['experimental_attachments'] = [];

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

            // Validate mimeType for non-image/text files (CoreMessage file parts are typed, but defensive check)
            if (
              !part.mimeType ||
              (part.mimeType !== 'image/jpeg' &&
                part.mimeType !== 'image/png' &&
                part.mimeType !== 'image/gif' &&
                part.mimeType !== 'text/plain' &&
                part.mimeType !== 'text/html' &&
                part.mimeType !== 'text/css' &&
                part.mimeType !== 'text/javascript' &&
                part.mimeType !== 'application/json' &&
                part.mimeType !== 'application/xml' &&
                part.mimeType !== 'application/pdf')
            ) {
              console.warn(
                `Missing or unsupported mimeType for CoreMessage file part: ${part.mimeType}. Treating as generic file.`,
              );
              // Decide how to handle this - for now, proceed but maybe log a warning or use a default mimeType?
              // For now, we'll proceed, but this might be a point for refinement.
            }

            if (part.data instanceof URL) {
              try {
                // Validate URL object
                new URL(part.data.toString()); // Check if it's a valid URL format
                if (part.data.protocol !== 'data:') {
                  // If it's a non-data URL, add it to experimental_attachments
                  experimentalAttachments.push({
                    name: part.filename, // Assuming CoreMessage FilePart might have a name, or leave undefined
                    url: part.data.toString(),
                    contentType: part.mimeType, // Use mimeType as contentType
                  });
                } else {
                  // If it's a data URL object, convert to base64 and add to parts
                  parts.push({
                    type: 'file',
                    mimeType: part.mimeType,
                    data: toBase64String(part.data),
                  });
                }
              } catch (error) {
                console.error(`Invalid URL in CoreMessage file part: ${part.data}`, error);
                // Decide how to handle invalid URLs - skip the part, throw an error?
                // For now, we'll skip this part.
              }
            } else if (typeof part.data === 'string') {
              try {
                // Validate URL string or data URL string
                if (part.data.startsWith('http://') || part.data.startsWith('https://')) {
                  new URL(part.data); // Check if it's a valid URL format
                  // If it's a non-data URL string, add it to experimental_attachments
                  experimentalAttachments.push({
                    name: part.filename, // Assuming CoreMessage FilePart might have a name, or leave undefined
                    url: part.data,
                    contentType: part.mimeType, // Use mimeType as contentType
                  });
                } else if (part.data.startsWith('data:')) {
                  // If it's a data URL string, convert to base64 and add to parts
                  parts.push({
                    type: 'file',
                    mimeType: part.mimeType,
                    data: toBase64String(part.data),
                  });
                } else {
                  // Assume it's base64 data directly
                  parts.push({
                    type: 'file',
                    mimeType: part.mimeType,
                    data: part.data, // Assume it's already base64
                  });
                }
              } catch (error) {
                console.error(`Invalid URL or data URL string in CoreMessage file part: ${part.data}`, error);
                // Decide how to handle invalid URLs - skip the part, throw an error?
                // For now, we'll skip this part.
              }
            } else {
              // Otherwise (binary data), convert to base64 and add to parts
              try {
                parts.push({
                  type: 'file',
                  mimeType: part.mimeType,
                  data: toBase64String(part.data),
                });
              } catch (error) {
                console.error(`Failed to convert binary data to base64 in CoreMessage file part: ${error}`, error);
                // Decide how to handle conversion errors - skip the part, throw an error?
                // For now, we'll skip this part.
              }
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

    if (experimentalAttachments.length) content.experimental_attachments = experimentalAttachments;

    return {
      id,
      role: coreMessage.role === `tool` ? `assistant` : coreMessage.role,
      createdAt,
      threadId: this.memoryInfo?.threadId,
      resourceId: this.memoryInfo?.resourceId,
      content,
    };
  }
}
