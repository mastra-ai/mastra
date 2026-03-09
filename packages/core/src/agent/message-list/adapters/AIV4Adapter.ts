import type {
  UIMessage as UIMessageV4,
  CoreMessage as CoreMessageV4,
  ToolInvocation as ToolInvocationV4,
} from '@internal/ai-sdk-v4';

import { MastraError, ErrorDomain, ErrorCategory } from '../../../error';
import { TypeDetector } from '../detection/TypeDetector';
import { convertDataContentToBase64String } from '../prompt/data-content';
import { categorizeFileData, createDataUri, imageContentToString } from '../prompt/image-utils';
import type {
  MastraDBMessage,
  MastraMessageContentV2,
  MastraMessagePart,
  UIMessageV4Part,
  MessageSource,
  UIMessageWithMetadata,
} from '../state/types';
import { findToolCallArgs } from '../utils/provider-compat';

/**
 * Filter out data-* parts from MastraMessagePart[] to get V4-compatible parts.
 * Data parts are a Mastra extension for custom streaming data and aren't supported by AI SDK V4.
 */
function filterDataParts(parts: MastraMessagePart[]): UIMessageV4Part[] {
  return parts.filter((part): part is UIMessageV4Part => !part.type.startsWith('data-'));
}

/**
 * Filter out empty text parts from message parts array.
 * Empty text blocks are not allowed by Anthropic's API and cause request failures.
 * This can happen during streaming when text-start/text-end events occur without actual content.
 * However, if the only part is an empty text part, it is preserved as a legitimate placeholder
 * (e.g. empty assistant messages between tool results and user messages).
 */
function filterEmptyTextParts(parts: MastraMessagePart[]): MastraMessagePart[] {
  const hasNonEmptyParts = parts.some(part => !(part.type === 'text' && part.text === ''));
  if (!hasNonEmptyParts) return parts;
  return parts.filter(part => {
    if (part.type === 'text') {
      return part.text !== '';
    }
    return true;
  });
}

// Re-export for backward compatibility
export type { UIMessageWithMetadata };

export interface AIV4AdapterContext {
  memoryInfo: { threadId?: string; resourceId?: string } | null;
  newMessageId(): string;
  generateCreatedAt(messageSource: MessageSource, start?: unknown): Date;
  /** Messages array for looking up tool call args */
  dbMessages?: MastraDBMessage[];
}

/**
 * AIV4Adapter - Handles conversions between MastraDBMessage and AI SDK V4 formats
 *
 * This adapter centralizes all AI SDK V4 (UIMessage and CoreMessage) conversion logic.
 */
export class AIV4Adapter {
  /**
   * Convert MastraDBMessage to AI SDK V4 UIMessage
   */
  static toUIMessage(m: MastraDBMessage): UIMessageWithMetadata {
    const experimentalAttachments: UIMessageWithMetadata['experimental_attachments'] = m.content
      .experimental_attachments
      ? [...m.content.experimental_attachments]
      : [];
    const contentString =
      typeof m.content.content === `string` && m.content.content !== ''
        ? m.content.content
        : (m.content.parts ?? []).reduce((prev, part) => {
            if (part.type === `text`) {
              // return only the last text part like AI SDK does
              return part.text;
            }
            return prev;
          }, '');

    const parts: MastraMessageContentV2['parts'] = [];
    const sourceParts = m.content.parts ?? [];

    if (sourceParts.length) {
      for (const part of sourceParts) {
        if (part.type === `file`) {
          // Normalize part.data to ensure it's a valid URL or data URI
          let normalizedUrl: string;
          if (typeof part.data === 'string') {
            const categorized = categorizeFileData(part.data, part.mimeType);
            if (categorized.type === 'raw') {
              // Raw base64 - convert to data URI
              normalizedUrl = createDataUri(part.data, part.mimeType || 'application/octet-stream');
            } else {
              // Already a URL or data URI
              normalizedUrl = part.data;
            }
          } else {
            // It's a non-string (shouldn't happen in practice for file parts, but handle it)
            normalizedUrl = part.data;
          }

          experimentalAttachments.push({
            contentType: part.mimeType,
            url: normalizedUrl,
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
          for (const innerPart of sourceParts) {
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

    // Filter out data-* parts when converting to UIMessageV4 (V4 doesn't support them)
    const v4Parts = filterDataParts(parts);

    if (m.role === `user`) {
      const uiMessage: UIMessageWithMetadata = {
        id: m.id,
        role: m.role,
        content: m.content.content || contentString,
        createdAt: m.createdAt,
        parts: v4Parts,
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
        parts: v4Parts,
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
      parts: v4Parts,
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
   */
  static systemToV4Core(message: MastraDBMessage): CoreMessageV4 {
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

    const coreMessage: CoreMessageV4 = { role: 'system', content: message.content.content };

    // Preserve message-level providerMetadata as experimental_providerMetadata (V4 field name)
    if (message.content.providerMetadata) {
      coreMessage.experimental_providerMetadata = message.content.providerMetadata;
    }

    return coreMessage;
  }

  /**
   * Convert AI SDK V4 UIMessage to MastraDBMessage
   */
  static fromUIMessage(
    message: UIMessageV4 | UIMessageWithMetadata,
    ctx: AIV4AdapterContext,
    messageSource: MessageSource,
  ): MastraDBMessage {
    // Filter out empty text parts to prevent Anthropic API errors
    const filteredParts = message.parts ? filterEmptyTextParts(message.parts) : [];

    const content: MastraMessageContentV2 = {
      format: 2,
      parts: filteredParts,
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
      id: message.id || ctx.newMessageId(),
      role: TypeDetector.getRole(message),
      createdAt: ctx.generateCreatedAt(messageSource, message.createdAt),
      threadId: ctx.memoryInfo?.threadId,
      resourceId: ctx.memoryInfo?.resourceId,
      content,
    } satisfies MastraDBMessage;
  }

  /**
   * Convert AI SDK V4 CoreMessage to MastraDBMessage
   */
  static fromCoreMessage(
    coreMessage: CoreMessageV4,
    ctx: AIV4AdapterContext,
    messageSource: MessageSource,
  ): MastraDBMessage {
    const id = `id` in coreMessage ? (coreMessage.id as string) : ctx.newMessageId();
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
      });
    } else if (Array.isArray(coreMessage.content)) {
      for (const aiV4Part of coreMessage.content) {
        switch (aiV4Part.type) {
          case 'text': {
            // Add step-start only after tool invocations, not at the beginning
            const prevPart = parts.at(-1);
            if (coreMessage.role === 'assistant' && prevPart && prevPart.type === 'tool-invocation') {
              parts.push({ type: 'step-start' });
            }

            const part: MastraDBMessage['content']['parts'][number] = {
              type: 'text' as const,
              text: aiV4Part.text,
            };
            if (aiV4Part.providerOptions) {
              part.providerMetadata = aiV4Part.providerOptions;
            }
            parts.push(part);
            break;
          }

          case 'tool-call': {
            const part: MastraDBMessage['content']['parts'][number] = {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'call',
                toolCallId: aiV4Part.toolCallId,
                toolName: aiV4Part.toolName,
                args: aiV4Part.args,
              },
            };
            if (aiV4Part.providerOptions) {
              part.providerMetadata = aiV4Part.providerOptions;
            }
            parts.push(part);
            break;
          }

          case 'tool-result':
            {
              // Try to find args from the corresponding tool-call in previous messages
              let toolArgs: Record<string, unknown> = {};

              // First, check if there's a tool-call in the same message
              const toolCallInSameMsg = coreMessage.content.find(
                p => p.type === 'tool-call' && p.toolCallId === aiV4Part.toolCallId,
              );
              if (toolCallInSameMsg && toolCallInSameMsg.type === 'tool-call') {
                toolArgs = toolCallInSameMsg.args as Record<string, unknown>;
              }

              // If not found, look in previous messages for the corresponding tool-call
              if (Object.keys(toolArgs).length === 0 && ctx.dbMessages) {
                toolArgs = findToolCallArgs(ctx.dbMessages, aiV4Part.toolCallId);
              }

              // Only use part-level providerOptions if present
              const invocation: ToolInvocationV4 = {
                state: 'result' as const,
                toolCallId: aiV4Part.toolCallId,
                toolName: aiV4Part.toolName,
                result: aiV4Part.result ?? '',
                args: toolArgs,
              };

              const part: MastraDBMessage['content']['parts'][number] = {
                type: 'tool-invocation',
                toolInvocation: invocation,
              };

              if (aiV4Part.providerOptions) {
                part.providerMetadata = aiV4Part.providerOptions;
              }

              parts.push(part);
              toolInvocations.push(invocation);
            }
            break;

          case 'reasoning':
            {
              const part: MastraDBMessage['content']['parts'][number] = {
                type: 'reasoning',
                reasoning: '',
                details: [{ type: 'text', text: aiV4Part.text, signature: aiV4Part.signature }],
              };
              if (aiV4Part.providerOptions) {
                part.providerMetadata = aiV4Part.providerOptions;
              }
              parts.push(part);
            }
            break;
          case 'redacted-reasoning':
            {
              const part: MastraDBMessage['content']['parts'][number] = {
                type: 'reasoning',
                reasoning: '',
                details: [{ type: 'redacted', data: aiV4Part.data }],
              };
              if (aiV4Part.providerOptions) {
                part.providerMetadata = aiV4Part.providerOptions;
              }
              parts.push(part);
            }
            break;
          case 'image': {
            const part: MastraDBMessage['content']['parts'][number] = {
              type: 'file' as const,
              data: imageContentToString(aiV4Part.image),
              mimeType: aiV4Part.mimeType!,
            };
            if (aiV4Part.providerOptions) {
              part.providerMetadata = aiV4Part.providerOptions;
            }
            parts.push(part);
            break;
          }
          case 'file': {
            if (aiV4Part.data instanceof URL) {
              const part: MastraDBMessage['content']['parts'][number] = {
                type: 'file' as const,
                data: aiV4Part.data.toString(),
                mimeType: aiV4Part.mimeType,
              };
              if (aiV4Part.providerOptions) {
                part.providerMetadata = aiV4Part.providerOptions;
              }
              if (aiV4Part.filename) {
                (part as Record<string, unknown>).filename = aiV4Part.filename;
              }
              parts.push(part);
            } else if (typeof aiV4Part.data === 'string') {
              const categorized = categorizeFileData(aiV4Part.data, aiV4Part.mimeType);

              if (categorized.type === 'url' || categorized.type === 'dataUri') {
                const part: MastraDBMessage['content']['parts'][number] = {
                  type: 'file' as const,
                  data: aiV4Part.data,
                  mimeType: categorized.mimeType || 'image/png',
                };
                if (aiV4Part.providerOptions) {
                  part.providerMetadata = aiV4Part.providerOptions;
                }
                if (aiV4Part.filename) {
                  (part as Record<string, unknown>).filename = aiV4Part.filename;
                }
                parts.push(part);
              } else {
                try {
                  const part: MastraDBMessage['content']['parts'][number] = {
                    type: 'file' as const,
                    mimeType: categorized.mimeType || 'image/png',
                    data: convertDataContentToBase64String(aiV4Part.data),
                  };
                  if (aiV4Part.providerOptions) {
                    part.providerMetadata = aiV4Part.providerOptions;
                  }
                  if (aiV4Part.filename) {
                    (part as Record<string, unknown>).filename = aiV4Part.filename;
                  }
                  parts.push(part);
                } catch (error) {
                  console.error(`Failed to convert binary data to base64 in CoreMessage file part: ${error}`, error);
                }
              }
            } else {
              try {
                const part: MastraDBMessage['content']['parts'][number] = {
                  type: 'file' as const,
                  mimeType: aiV4Part.mimeType,
                  data: convertDataContentToBase64String(aiV4Part.data),
                };
                if (aiV4Part.providerOptions) {
                  part.providerMetadata = aiV4Part.providerOptions;
                }
                if (aiV4Part.filename) {
                  (part as Record<string, unknown>).filename = aiV4Part.filename;
                }
                parts.push(part);
              } catch (error) {
                console.error(`Failed to convert binary data to base64 in CoreMessage file part: ${error}`, error);
              }
            }
            break;
          }
        }
      }
    }

    // Filter out empty text parts to prevent Anthropic API errors
    const filteredParts = filterEmptyTextParts(parts);

    const content: MastraDBMessage['content'] = {
      format: 2,
      parts: filteredParts,
    };

    if (toolInvocations.length) content.toolInvocations = toolInvocations;
    if (typeof coreMessage.content === `string`) content.content = coreMessage.content;

    if (experimentalAttachments.length) content.experimental_attachments = experimentalAttachments;

    // V4 uses experimental_providerMetadata, V5 uses providerOptions
    if (coreMessage.providerOptions) {
      content.providerMetadata = coreMessage.providerOptions;
    } else if ('experimental_providerMetadata' in coreMessage && coreMessage.experimental_providerMetadata) {
      content.providerMetadata = coreMessage.experimental_providerMetadata;
    }

    if ('metadata' in coreMessage && coreMessage.metadata !== null && coreMessage.metadata !== undefined) {
      content.metadata = coreMessage.metadata as Record<string, unknown>;
    }

    const rawCreatedAt =
      'metadata' in coreMessage &&
      coreMessage.metadata &&
      typeof coreMessage.metadata === 'object' &&
      'createdAt' in coreMessage.metadata
        ? coreMessage.metadata.createdAt
        : undefined;

    return {
      id,
      role: TypeDetector.getRole(coreMessage),
      createdAt: ctx.generateCreatedAt(messageSource, rawCreatedAt),
      threadId: ctx.memoryInfo?.threadId,
      resourceId: ctx.memoryInfo?.resourceId,
      content,
    } satisfies MastraDBMessage;
  }
}
