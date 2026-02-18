import type { ToolInvocationUIPart } from '@ai-sdk/ui-utils-v5';
import * as AIV5 from '@internal/ai-sdk-v5';

import { MastraError, ErrorDomain, ErrorCategory } from '../../../error';
import { categorizeFileData, createDataUri, parseDataUri } from '../prompt/image-utils';
import type { MastraDBMessage, MastraMessageContentV2, MastraMessagePart, MessageSource } from '../state/types';
import type { AIV5Type } from '../types';

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

/**
 * Extract tool name from AI SDK v5 tool type string
 *
 * V5 format: "tool-${toolName}" or "dynamic-tool"
 * V4 format: "tool-invocation"
 *
 * @param type - The tool type string from AI SDK v5
 * @returns The tool name or 'dynamic-tool' if it's a dynamic tool
 */
function getToolName(type: string | { type: string }): string {
  // Handle objects with type property
  if (typeof type === 'object' && type && 'type' in type) {
    type = type.type;
  }

  // Ensure type is a string
  if (typeof type !== 'string') {
    return 'unknown';
  }

  if (type === 'dynamic-tool') {
    return 'dynamic-tool';
  }

  // Extract tool name from "tool-${toolName}" format
  if (type.startsWith('tool-')) {
    return type.slice('tool-'.length); // Remove "tool-" prefix
  }

  // Fallback for unexpected formats
  return type;
}

export interface AIV5AdapterContext {
  memoryInfo: { threadId?: string; resourceId?: string } | null;
  newMessageId?(): string;
  generateCreatedAt?(messageSource: MessageSource, start?: unknown): Date;
}

/**
 * AIV5Adapter - Handles conversions between MastraDBMessage and AI SDK V5 formats
 *
 * This adapter centralizes all AI SDK V5 (UIMessage and ModelMessage) conversion logic.
 */
export class AIV5Adapter {
  /**
   * Direct conversion from MastraDBMessage to AIV5 UIMessage
   */
  static toUIMessage(dbMsg: MastraDBMessage): AIV5Type.UIMessage {
    const parts: AIV5Type.UIMessage['parts'] = [];
    const metadata: Record<string, unknown> = { ...(dbMsg.content.metadata || {}) };

    // Add Mastra-specific metadata
    if (dbMsg.createdAt) metadata.createdAt = dbMsg.createdAt;
    if (dbMsg.threadId) metadata.threadId = dbMsg.threadId;
    if (dbMsg.resourceId) metadata.resourceId = dbMsg.resourceId;

    // Preserve message-level providerMetadata in metadata so it survives UI → Model conversion
    if (dbMsg.content.providerMetadata) {
      metadata.providerMetadata = dbMsg.content.providerMetadata;
    }

    // 1. Handle tool invocations (only if not already in parts array)
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
          });
        } else {
          parts.push({
            type: `tool-${invocation.toolName}`,
            toolCallId: invocation.toolCallId,
            state: invocation.state === 'call' ? 'input-available' : 'input-streaming',
            input: invocation.args,
          });
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

    // 5. Handle parts directly (if present in V2)
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
              providerExecuted: (part as { providerExecuted?: boolean }).providerExecuted,
            } satisfies AIV5Type.ToolUIPart);
          } else {
            parts.push({
              type: `tool-${inv.toolName}`,
              toolCallId: inv.toolCallId,
              input: inv.args,
              state: 'input-available',
              callProviderMetadata: part.providerMetadata,
              providerExecuted: (part as { providerExecuted?: boolean }).providerExecuted,
            } satisfies AIV5Type.ToolUIPart);
          }
          continue;
        }

        // Handle reasoning parts
        if (part.type === 'reasoning') {
          const text =
            part.reasoning ||
            (part.details?.reduce((p: string, c) => {
              if (c.type === `text` && c.text) return p + c.text;
              return p;
            }, '') ??
              '');
          if (text || part.details?.length) {
            const v5UIPart: AIV5Type.ReasoningUIPart = {
              type: 'reasoning' as const,
              text: text || '',
              state: 'done' as const,
            };
            if (part.providerMetadata) {
              v5UIPart.providerMetadata = part.providerMetadata;
            }
            parts.push(v5UIPart);
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
            const v5UIPart: AIV5Type.FileUIPart = {
              type: 'file' as const,
              url: part.data,
              mediaType: categorized.mimeType || 'image/png',
            };
            if (part.providerMetadata) {
              v5UIPart.providerMetadata = part.providerMetadata;
            }
            parts.push(v5UIPart);
          } else {
            let filePartData: string;
            let extractedMimeType = part.mimeType;

            if (typeof part.data === 'string') {
              const parsed = parseDataUri(part.data);

              if (parsed.isDataUri) {
                filePartData = parsed.base64Content;
                if (parsed.mimeType) {
                  extractedMimeType = extractedMimeType || parsed.mimeType;
                }
              } else {
                filePartData = part.data;
              }
            } else {
              filePartData = part.data;
            }

            const finalMimeType = extractedMimeType || 'image/png';

            let dataUri: string;
            if (typeof filePartData === 'string' && filePartData.startsWith('data:')) {
              dataUri = filePartData;
            } else {
              dataUri = createDataUri(filePartData, finalMimeType);
            }

            const v5UIPart: AIV5Type.FileUIPart = {
              type: 'file' as const,
              url: dataUri,
              mediaType: finalMimeType,
            };
            if (part.providerMetadata) {
              v5UIPart.providerMetadata = part.providerMetadata;
            }
            parts.push(v5UIPart);
          }
        } else if (part.type === 'source') {
          const v5UIPart: AIV5Type.SourceUrlUIPart = {
            type: 'source-url' as const,
            url: part.source.url,
            sourceId: part.source.id,
            title: part.source.title,
          };
          if (part.providerMetadata) {
            v5UIPart.providerMetadata = part.providerMetadata;
          }

          parts.push(v5UIPart);
        } else if (part.type === 'text') {
          const v5UIPart: AIV5Type.TextUIPart = {
            type: 'text' as const,
            text: part.text,
          };
          if (part.providerMetadata) {
            v5UIPart.providerMetadata = part.providerMetadata;
          }
          parts.push(v5UIPart);
          hasNonToolReasoningParts = true;
        } else {
          // Other parts (step-start, etc.) can be pushed as-is
          parts.push(part);
          hasNonToolReasoningParts = true;
        }
      }
    }

    // 6. Handle text content (fallback if no parts)
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
   */
  static fromUIMessage(uiMsg: AIV5Type.UIMessage): MastraDBMessage {
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
              id: p.url,
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

        // Handle data-* parts (custom parts emitted by tools via writer.custom())
        if (typeof p.type === 'string' && p.type.startsWith('data-')) {
          return {
            type: p.type,
            data: 'data' in p ? (p as any).data : undefined,
          };
        }

        return null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    // Filter out empty text parts to prevent Anthropic API errors
    const filteredV2Parts = filterEmptyTextParts(v2Parts as MastraMessagePart[]);

    return {
      id: uiMsg.id,
      role: uiMsg.role,
      createdAt,
      threadId,
      resourceId,
      content: {
        format: 2,
        parts: filteredV2Parts as MastraMessageContentV2['parts'],
        toolInvocations,
        reasoning,
        experimental_attachments,
        content,
        metadata: Object.keys(cleanMetadata).length > 0 ? cleanMetadata : undefined,
      },
    };
  }

  /**
   * Convert image or file to data URI or URL for V2 file part
   */
  private static getDataStringFromAIV5DataPart(part: AIV5Type.ImagePart | AIV5Type.FilePart): string {
    let mimeType: string;
    let data: AIV5.FilePart['data'] | AIV5.ImagePart['image'];
    if ('data' in part) {
      mimeType = part.mediaType || 'application/octet-stream';
      data = part.data;
    } else if ('image' in part) {
      mimeType = part.mediaType || 'image/jpeg';
      data = part.image;
    } else {
      throw new MastraError({
        id: 'MASTRA_AIV5_DATA_PART_INVALID',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'Invalid AIV5 data part in getDataStringFromAIV5DataPart',
        details: {
          part,
        },
      });
    }

    if (data instanceof URL) {
      return data.toString();
    } else {
      if (data instanceof Buffer) {
        const base64 = data.toString('base64');
        return `data:${mimeType};base64,${base64}`;
      } else if (typeof data === 'string') {
        return data.startsWith('data:') || data.startsWith('http') ? data : `data:${mimeType};base64,${data}`;
      } else if (data instanceof Uint8Array) {
        const base64 = Buffer.from(data).toString('base64');
        return `data:${mimeType};base64,${base64}`;
      } else if (data instanceof ArrayBuffer) {
        const base64 = Buffer.from(data).toString('base64');
        return `data:${mimeType};base64,${base64}`;
      } else {
        return '';
      }
    }
  }

  /**
   * Direct conversion from AIV5 ModelMessage to MastraDBMessage
   */
  static fromModelMessage(modelMsg: AIV5Type.ModelMessage, _messageSource?: MessageSource): MastraDBMessage {
    const content = Array.isArray(modelMsg.content)
      ? modelMsg.content
      : [{ type: 'text', text: modelMsg.content } satisfies AIV5.TextPart];

    const mastraDBParts: MastraMessageContentV2['parts'] = [];
    const toolInvocations: NonNullable<MastraDBMessage['content']['toolInvocations']> = [];
    const reasoningParts: string[] = [];
    const experimental_attachments: NonNullable<MastraDBMessage['content']['experimental_attachments']> = [];

    for (const part of content) {
      if (part.type === 'text') {
        const textPart: MastraDBMessage['content']['parts'][number] = {
          type: 'text' as const,
          text: part.text,
        };
        if (part.providerOptions) {
          textPart.providerMetadata = part.providerOptions;
        }
        mastraDBParts.push(textPart);
      } else if (part.type === 'tool-call') {
        const toolCallPart = part as AIV5Type.ToolCallPart;
        const toolInvocationPart: MastraDBMessage['content']['parts'][number] = {
          type: 'tool-invocation' as const,
          toolInvocation: {
            toolCallId: toolCallPart.toolCallId,
            toolName: toolCallPart.toolName,
            args: toolCallPart.input,
            state: 'call',
          },
        };
        if (part.providerOptions) {
          toolInvocationPart.providerMetadata = part.providerOptions;
        }
        mastraDBParts.push(toolInvocationPart);
        toolInvocations.push({
          toolCallId: toolCallPart.toolCallId,
          toolName: toolCallPart.toolName,
          args: toolCallPart.input,
          state: 'call',
        });
      } else if (part.type === 'tool-result') {
        const toolResultPart = part;
        const matchingCall = toolInvocations.find(inv => inv.toolCallId === toolResultPart.toolCallId);

        const matchingV2Part = mastraDBParts.find(
          (p): p is Extract<MastraDBMessage['content']['parts'][number], { type: 'tool-invocation' }> =>
            p.type === 'tool-invocation' &&
            'toolInvocation' in p &&
            p.toolInvocation.toolCallId === toolResultPart.toolCallId,
        );

        const updateMatchingCallInvocationResult = (toolResultPart: AIV5Type.ToolResultPart, matchingCall: any) => {
          matchingCall.state = 'result';
          matchingCall.result =
            typeof toolResultPart.output === 'object' && toolResultPart.output && 'value' in toolResultPart.output
              ? toolResultPart.output.value
              : toolResultPart.output;
        };

        if (matchingCall) {
          updateMatchingCallInvocationResult(toolResultPart, matchingCall);
        } else {
          const call: any = {
            state: 'call',
            toolCallId: toolResultPart.toolCallId,
            toolName: toolResultPart.toolName || 'unknown',
            args: {},
          };
          updateMatchingCallInvocationResult(toolResultPart, call);
          toolInvocations.push(call);
        }

        if (matchingV2Part && matchingV2Part.type === 'tool-invocation') {
          updateMatchingCallInvocationResult(toolResultPart, matchingV2Part.toolInvocation);
        } else {
          const toolInvocationPart: MastraDBMessage['content']['parts'][number] = {
            type: 'tool-invocation' as const,
            toolInvocation: {
              toolCallId: toolResultPart.toolCallId,
              toolName: toolResultPart.toolName || 'unknown',
              args: {},
              state: 'call',
            },
          };
          updateMatchingCallInvocationResult(toolResultPart, toolInvocationPart.toolInvocation);
          mastraDBParts.push(toolInvocationPart);
        }
      } else if (part.type === 'reasoning') {
        const v2ReasoningPart: MastraDBMessage['content']['parts'][number] = {
          type: 'reasoning',
          reasoning: '',
          details: [{ type: 'text', text: part.text }],
        };
        if (part.providerOptions) {
          v2ReasoningPart.providerMetadata = part.providerOptions;
        }
        mastraDBParts.push(v2ReasoningPart);
        reasoningParts.push(part.text);
      } else if (part.type === 'image') {
        const imagePart = part;
        const mimeType = imagePart.mediaType || 'image/jpeg';
        const imageData = this.getDataStringFromAIV5DataPart(imagePart);

        const imageFilePart: MastraDBMessage['content']['parts'][number] = {
          type: 'file',
          data: imageData,
          mimeType,
        };
        if (part.providerOptions) {
          imageFilePart.providerMetadata = part.providerOptions;
        }
        mastraDBParts.push(imageFilePart);
        experimental_attachments.push({
          url: imageData,
          contentType: mimeType,
        });
      } else if (part.type === 'file') {
        const filePart = part;
        const mimeType = filePart.mediaType || 'application/octet-stream';
        const fileData = this.getDataStringFromAIV5DataPart(filePart);

        const v2FilePart: MastraDBMessage['content']['parts'][number] = {
          type: 'file',
          data: fileData,
          mimeType,
        };
        if (part.providerOptions) {
          v2FilePart.providerMetadata = part.providerOptions;
        }
        mastraDBParts.push(v2FilePart);
        experimental_attachments.push({
          url: fileData,
          contentType: mimeType,
        });
      }
    }

    // Filter out empty text parts to prevent Anthropic API errors
    const filteredMastraDBParts = filterEmptyTextParts(mastraDBParts);

    // Build V2 content string
    const contentString = filteredMastraDBParts
      .filter(p => p.type === 'text')
      .map(p => p.text)
      .join('\n');

    // Preserve metadata from the input message if present
    const metadata: Record<string, unknown> =
      'metadata' in modelMsg && modelMsg.metadata !== null && modelMsg.metadata !== undefined
        ? (modelMsg.metadata as Record<string, unknown>)
        : {};

    // Generate ID from modelMsg if available, otherwise create a new one
    const id =
      `id` in modelMsg && typeof modelMsg.id === `string`
        ? modelMsg.id
        : `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const message: MastraDBMessage = {
      id,
      role: modelMsg.role === 'tool' ? 'assistant' : modelMsg.role,
      createdAt: new Date(),
      content: {
        format: 2,
        parts: filteredMastraDBParts,
        toolInvocations: toolInvocations.length > 0 ? toolInvocations : undefined,
        reasoning: reasoningParts.length > 0 ? reasoningParts.join('\n') : undefined,
        experimental_attachments: experimental_attachments.length > 0 ? experimental_attachments : undefined,
        content: contentString || undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      },
    };
    // Add message-level providerOptions if present
    if (modelMsg.providerOptions) {
      message.content.providerMetadata = modelMsg.providerOptions;
    }

    return message;
  }
}
