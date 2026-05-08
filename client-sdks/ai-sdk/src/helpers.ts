import type {
  InferUIMessageChunk,
  LanguageModelUsage as AISDKLanguageModelUsage,
  ObjectStreamPart,
  TextStreamPart,
  ToolSet,
  UIMessage,
  FinishReason,
} from '@internal/ai-sdk-v5';
import type {
  CallWarning as AISDKCallWarningV6,
  FinishReason as FinishReasonV6,
  InferUIMessageChunk as InferUIMessageChunkV6,
  LanguageModelUsage as AISDKLanguageModelUsageV6,
  ToolApprovalRequest,
  UIMessage as UIMessageV6,
} from '@internal/ai-v6';
import { DefaultGeneratedFile, DefaultGeneratedFileWithType } from '@mastra/core/stream';
import type { DataChunkType, ChunkType, MastraFinishReason } from '@mastra/core/stream';
import { isDataChunkType } from './utils';

/**
 * Separator used to encode both runId and toolCallId into a single approvalId string.
 * Chosen because neither runId nor toolCallId can contain ":" in normal usage
 * (UUIDs are hex + hyphens; provider tool call IDs are alphanumeric + underscores).
 * The server splits on this separator to recover the runId for resumeStream.
 */
export const APPROVAL_ID_SEPARATOR = '::';

/**
 * Maps Mastra's extended finish reasons to AI SDK-compatible values.
 * 'tripwire' and 'retry' are Mastra-specific reasons for processor scenarios,
 * which are mapped to 'other' for AI SDK compatibility.
 */
export function toAISDKFinishReason(reason: MastraFinishReason): FinishReason {
  if (reason === 'tripwire' || reason === 'retry') {
    return 'other';
  }
  return reason;
}

export type OutputChunkType<OUTPUT = undefined> =
  | TextStreamPart<ToolSet>
  | ObjectStreamPart<Partial<OUTPUT>>
  | ToolApprovalRequest
  | DataChunkType
  | undefined;

export type ToolAgentChunkType = { type: 'tool-agent'; toolCallId: string; payload: any };
export type ToolWorkflowChunkType = { type: 'tool-workflow'; toolCallId: string; payload: any };
export type ToolNetworkChunkType = { type: 'tool-network'; toolCallId: string; payload: any };

type ConvertMastraChunkToAISDKOptions<OUTPUT> = {
  chunk: ChunkType<OUTPUT>;
  mode?: 'generate' | 'stream';
  normalizeWarnings: (warnings: any[] | undefined) => any[];
  normalizeUsage: (usage: any) => any;
  normalizeFinishReason: (reason: MastraFinishReason) => string;
  includeRawFinishReason?: boolean;
};

export function convertMastraChunkToAISDKBase<OUTPUT = undefined>({
  chunk,
  mode = 'stream',
  normalizeWarnings,
  normalizeUsage,
  normalizeFinishReason,
  includeRawFinishReason = false,
}: ConvertMastraChunkToAISDKOptions<OUTPUT>): OutputChunkType<OUTPUT> {
  switch (chunk.type) {
    case 'start':
      return {
        type: 'start',
        // Preserve messageId from the payload so it can be sent to useChat
        ...(chunk.payload?.messageId ? { messageId: chunk.payload.messageId } : {}),
      };
    case 'step-start':
      const { messageId: _messageId, ...rest } = chunk.payload;
      return {
        type: 'start-step',
        request: rest.request,
        warnings: normalizeWarnings(rest.warnings),
      };
    case 'raw':
      return {
        type: 'raw',
        rawValue: chunk.payload,
      };

    case 'finish': {
      return {
        type: 'finish',
        finishReason: normalizeFinishReason(chunk.payload.stepResult.reason) as FinishReason,
        ...(includeRawFinishReason ? { rawFinishReason: chunk.payload.stepResult.reason } : {}),
        totalUsage: normalizeUsage(chunk.payload.output.usage),
      };
    }
    case 'reasoning-start':
      return {
        type: 'reasoning-start',
        id: chunk.payload.id,
        providerMetadata: chunk.payload.providerMetadata,
      };
    case 'reasoning-delta':
      return {
        type: 'reasoning-delta',
        id: chunk.payload.id,
        text: chunk.payload.text,
        providerMetadata: chunk.payload.providerMetadata,
      };
    case 'reasoning-signature':
      return;
    // return {
    //   type: 'reasoning-signature' as const,
    //   id: chunk.payload.id,
    //   signature: chunk.payload.signature,
    // };
    case 'redacted-reasoning':
      return;
    // return {
    //   type: 'redacted-reasoning',
    //   id: chunk.payload.id,
    //   data: chunk.payload.data,
    // };
    case 'reasoning-end':
      return {
        type: 'reasoning-end',
        id: chunk.payload.id,
        providerMetadata: chunk.payload.providerMetadata,
      };
    case 'source':
      if (chunk.payload.sourceType === 'url') {
        return {
          type: 'source',
          sourceType: 'url',
          id: chunk.payload.id,
          url: chunk.payload.url!,
          title: chunk.payload.title,
          providerMetadata: chunk.payload.providerMetadata,
        };
      } else {
        return {
          type: 'source',
          sourceType: 'document',
          id: chunk.payload.id,
          mediaType: chunk.payload.mimeType!,
          title: chunk.payload.title,
          filename: chunk.payload.filename,
          providerMetadata: chunk.payload.providerMetadata,
        };
      }
    case 'file':
      if (mode === 'generate') {
        return {
          type: 'file',
          file: new DefaultGeneratedFile({
            data: chunk.payload.data,
            mediaType: chunk.payload.mimeType,
          }),
        };
      }

      return {
        type: 'file',
        file: new DefaultGeneratedFileWithType({
          data: chunk.payload.data,
          mediaType: chunk.payload.mimeType,
        }),
      };
    case 'tool-call':
      return {
        type: 'tool-call',
        toolCallId: chunk.payload.toolCallId,
        providerMetadata: chunk.payload.providerMetadata,
        providerExecuted: chunk.payload.providerExecuted,
        toolName: chunk.payload.toolName,
        input: chunk.payload.args,
      };
    case 'tool-call-approval':
      return {
        type: 'data-tool-call-approval',
        id: chunk.payload.toolCallId,
        data: {
          state: 'data-tool-call-approval',
          runId: chunk.runId,
          toolCallId: chunk.payload.toolCallId,
          toolName: chunk.payload.toolName,
          args: chunk.payload.args,
          resumeSchema: chunk.payload.resumeSchema,
        },
      } satisfies DataChunkType;
    case 'tool-call-suspended':
      return {
        type: 'data-tool-call-suspended',
        id: chunk.payload.toolCallId,
        data: {
          state: 'data-tool-call-suspended',
          runId: chunk.runId,
          toolCallId: chunk.payload.toolCallId,
          toolName: chunk.payload.toolName,
          suspendPayload: chunk.payload.suspendPayload,
          resumeSchema: chunk.payload.resumeSchema,
        },
      } satisfies DataChunkType;
    case 'tool-call-input-streaming-start':
      return {
        type: 'tool-input-start',
        id: chunk.payload.toolCallId,
        toolName: chunk.payload.toolName,
        dynamic: !!chunk.payload.dynamic,
        providerMetadata: chunk.payload.providerMetadata,
        providerExecuted: chunk.payload.providerExecuted,
      };
    case 'tool-call-input-streaming-end':
      return {
        type: 'tool-input-end',
        id: chunk.payload.toolCallId,
        providerMetadata: chunk.payload.providerMetadata,
      };
    case 'tool-call-delta':
      return {
        type: 'tool-input-delta',
        id: chunk.payload.toolCallId,
        delta: chunk.payload.argsTextDelta,
        providerMetadata: chunk.payload.providerMetadata,
      };
    case 'step-finish': {
      const { request: _request, providerMetadata, ...rest } = chunk.payload.metadata;
      return {
        type: 'finish-step',
        response: {
          id: chunk.payload.id || '',
          timestamp: new Date(),
          modelId: (rest.modelId as string) || '',
          ...rest,
        },
        usage: normalizeUsage(chunk.payload.output.usage),
        finishReason: normalizeFinishReason(chunk.payload.stepResult.reason) as FinishReason,
        ...(includeRawFinishReason ? { rawFinishReason: chunk.payload.stepResult.reason } : {}),
        providerMetadata,
      };
    }
    case 'text-delta':
      return {
        type: 'text-delta',
        id: chunk.payload.id,
        text: chunk.payload.text,
        providerMetadata: chunk.payload.providerMetadata,
      };
    case 'text-end':
      return {
        type: 'text-end',
        id: chunk.payload.id,
        providerMetadata: chunk.payload.providerMetadata,
      };
    case 'text-start':
      return {
        type: 'text-start',
        id: chunk.payload.id,
        providerMetadata: chunk.payload.providerMetadata,
      };
    case 'tool-result':
      return {
        type: 'tool-result',
        input: chunk.payload.args,
        toolCallId: chunk.payload.toolCallId,
        providerExecuted: chunk.payload.providerExecuted,
        toolName: chunk.payload.toolName,
        output: chunk.payload.result,
        // providerMetadata: chunk.payload.providerMetadata, // AI v5 types don't show this?
      };
    case 'tool-error':
      return {
        type: 'tool-error',
        error: chunk.payload.error,
        input: chunk.payload.args,
        toolCallId: chunk.payload.toolCallId,
        providerExecuted: chunk.payload.providerExecuted,
        toolName: chunk.payload.toolName,
        // providerMetadata: chunk.payload.providerMetadata, // AI v5 types don't show this?
      };

    case 'abort':
      return {
        type: 'abort',
      };

    case 'error':
      return {
        type: 'error',
        error: chunk.payload.error,
      };

    case 'object':
      return {
        type: 'object',
        object: chunk.object,
      };
    case 'tripwire':
      return {
        type: 'data-tripwire',
        data: {
          reason: chunk.payload.reason,
          retry: chunk.payload.retry,
          metadata: chunk.payload.metadata,
          processorId: chunk.payload.processorId,
        },
      };
    default:
      if (chunk.type && 'payload' in chunk && chunk.payload) {
        return {
          type: chunk.type as string,
          ...(chunk.payload || {}),
        } as OutputChunkType<OUTPUT>;
      }
      if ('type' in chunk && chunk.type?.startsWith('data-')) {
        return chunk as any;
      }
      return;
  }
}

export function convertMastraChunkToAISDKv5<OUTPUT = undefined>({
  chunk,
  mode = 'stream',
}: {
  chunk: ChunkType<OUTPUT>;
  mode?: 'generate' | 'stream';
}): OutputChunkType<OUTPUT> {
  return convertMastraChunkToAISDKBase({
    chunk,
    mode,
    normalizeWarnings: warnings => warnings || [],
    normalizeUsage: usage => usage as AISDKLanguageModelUsage,
    normalizeFinishReason: toAISDKFinishReason,
  });
}

export function toAISDKFinishReasonV6(reason: MastraFinishReason): FinishReasonV6 {
  switch (reason) {
    case 'stop':
    case 'length':
    case 'content-filter':
    case 'tool-calls':
    case 'error':
    case 'other':
      return reason;
    default:
      return 'other';
  }
}

function normalizeV6Warnings(warnings: any[] | undefined): AISDKCallWarningV6[] {
  return (warnings ?? []).map(warning => {
    switch (warning?.type) {
      case 'unsupported-setting':
        return {
          type: 'compatibility',
          feature: warning.setting,
          details: warning.details,
        } satisfies AISDKCallWarningV6;
      case 'unsupported-tool':
        return {
          type: 'unsupported',
          feature: warning.tool?.name ?? 'tool',
          details: warning.details,
        } satisfies AISDKCallWarningV6;
      case 'other':
        return {
          type: 'other',
          message: warning.message,
        } satisfies AISDKCallWarningV6;
      default:
        return {
          type: 'other',
          message: String(warning),
        } satisfies AISDKCallWarningV6;
    }
  });
}

function normalizeV6Usage(usage: any): AISDKLanguageModelUsageV6 {
  return {
    inputTokens: usage?.inputTokens,
    inputTokenDetails: {
      noCacheTokens: usage?.inputTokens,
      cacheReadTokens: usage?.cachedInputTokens,
      cacheWriteTokens: undefined,
    },
    outputTokens: usage?.outputTokens,
    outputTokenDetails: {
      textTokens: usage?.outputTokens,
      reasoningTokens: usage?.reasoningTokens,
    },
    totalTokens: usage?.totalTokens,
    reasoningTokens: usage?.reasoningTokens,
    cachedInputTokens: usage?.cachedInputTokens,
  };
}

export function convertMastraChunkToAISDKv6<OUTPUT = undefined>({
  chunk,
  mode = 'stream',
}: {
  chunk: ChunkType<OUTPUT>;
  mode?: 'generate' | 'stream';
}): OutputChunkType<OUTPUT> | OutputChunkType<OUTPUT>[] {
  if (chunk.type === 'tool-call-approval') {
    // Emit both the native v6 tool-approval-request AND the legacy data-tool-call-approval
    // so that consumers using the data stream protocol remain backwards-compatible.
    return [
      {
        type: 'tool-approval-request',
        approvalId: `${chunk.runId}${APPROVAL_ID_SEPARATOR}${chunk.payload.toolCallId}`,
        toolCallId: chunk.payload.toolCallId,
      } as OutputChunkType<OUTPUT>,
      {
        type: 'data-tool-call-approval',
        id: chunk.payload.toolCallId,
        data: {
          state: 'data-tool-call-approval',
          runId: chunk.runId,
          toolCallId: chunk.payload.toolCallId,
          toolName: chunk.payload.toolName,
          args: chunk.payload.args,
          resumeSchema: chunk.payload.resumeSchema,
        },
      } satisfies DataChunkType,
    ];
  }

  return convertMastraChunkToAISDKBase({
    chunk,
    mode,
    normalizeWarnings: normalizeV6Warnings,
    normalizeUsage: normalizeV6Usage,
    normalizeFinishReason: toAISDKFinishReasonV6,
    includeRawFinishReason: true,
  });
}

export function convertFullStreamChunkToUIMessageStream<UI_MESSAGE extends UIMessage>({
  part,
  messageMetadataValue,
  sendReasoning,
  sendSources,
  onError,
  sendStart,
  sendFinish,
  responseMessageId,
}: {
  // tool-output is a custom mastra chunk type used in ToolStream
  part:
    | TextStreamPart<ToolSet>
    | DataChunkType
    | ToolApprovalRequest
    | { type: 'tool-output'; toolCallId: string; output: any };
  messageMetadataValue?: unknown;
  sendReasoning?: boolean;
  sendSources?: boolean;
  onError: (error: unknown) => string;
  sendStart?: boolean;
  sendFinish?: boolean;
  responseMessageId?: string;
}):
  | InferUIMessageChunk<UI_MESSAGE>
  | InferUIMessageChunkV6<UIMessageV6>
  | ToolAgentChunkType
  | ToolWorkflowChunkType
  | ToolNetworkChunkType
  | undefined {
  const partType = part?.type;

  switch (partType) {
    case 'text-start': {
      return {
        type: 'text-start',
        id: part.id,
        ...(part.providerMetadata != null ? { providerMetadata: part.providerMetadata } : {}),
      };
    }

    case 'text-delta': {
      return {
        type: 'text-delta',
        id: part.id,
        delta: part.text,
        ...(part.providerMetadata != null ? { providerMetadata: part.providerMetadata } : {}),
      };
    }

    case 'text-end': {
      return {
        type: 'text-end',
        id: part.id,
        ...(part.providerMetadata != null ? { providerMetadata: part.providerMetadata } : {}),
      };
    }

    case 'reasoning-start': {
      if (!sendReasoning) {
        return;
      }
      return {
        type: 'reasoning-start',
        id: part.id,
        ...(part.providerMetadata != null ? { providerMetadata: part.providerMetadata } : {}),
      };
    }

    case 'reasoning-delta': {
      if (sendReasoning) {
        return {
          type: 'reasoning-delta',
          id: part.id,
          delta: part.text,
          ...(part.providerMetadata != null ? { providerMetadata: part.providerMetadata } : {}),
        };
      }
      return;
    }

    case 'reasoning-end': {
      if (!sendReasoning) {
        return;
      }
      return {
        type: 'reasoning-end',
        id: part.id,
        ...(part.providerMetadata != null ? { providerMetadata: part.providerMetadata } : {}),
      };
    }

    case 'file': {
      return {
        type: 'file',
        mediaType: part.file.mediaType,
        url: `data:${part.file.mediaType};base64,${part.file.base64}`,
      };
    }

    case 'source': {
      if (sendSources && part.sourceType === 'url') {
        return {
          type: 'source-url',
          sourceId: part.id,
          url: part.url,
          title: part.title,
          ...(part.providerMetadata != null ? { providerMetadata: part.providerMetadata } : {}),
        };
      }

      if (sendSources && part.sourceType === 'document') {
        return {
          type: 'source-document',
          sourceId: part.id,
          mediaType: part.mediaType,
          title: part.title,
          filename: part.filename,
          ...(part.providerMetadata != null ? { providerMetadata: part.providerMetadata } : {}),
        };
      }
      return;
    }

    case 'tool-input-start': {
      return {
        type: 'tool-input-start',
        toolCallId: part.id,
        toolName: part.toolName,
        ...(part.providerExecuted != null ? { providerExecuted: part.providerExecuted } : {}),
        ...(part.dynamic != null ? { dynamic: part.dynamic } : {}),
      };
    }

    case 'tool-input-delta': {
      return {
        type: 'tool-input-delta',
        toolCallId: part.id,
        inputTextDelta: part.delta,
      };
    }

    case 'tool-call': {
      return {
        type: 'tool-input-available',
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        input: part.input,
        ...(part.providerExecuted != null ? { providerExecuted: part.providerExecuted } : {}),
        ...(part.providerMetadata != null ? { providerMetadata: part.providerMetadata } : {}),
        ...(part.dynamic != null ? { dynamic: part.dynamic } : {}),
      };
    }

    case 'tool-approval-request': {
      return {
        type: 'tool-approval-request',
        approvalId: part.approvalId,
        toolCallId: part.toolCallId,
      };
    }

    case 'tool-result': {
      return {
        type: 'tool-output-available',
        toolCallId: part.toolCallId,
        output: part.output,
        ...(part.providerExecuted != null ? { providerExecuted: part.providerExecuted } : {}),
        ...(part.dynamic != null ? { dynamic: part.dynamic } : {}),
      };
    }

    case 'tool-output': {
      if (part.output.from === 'AGENT') {
        return {
          type: 'tool-agent',
          toolCallId: part.toolCallId,
          payload: part.output,
        };
      } else if (part.output.from === 'WORKFLOW') {
        return {
          type: 'tool-workflow',
          toolCallId: part.toolCallId,
          payload: part.output,
        };
      } else if (part.output.from === 'NETWORK') {
        return {
          type: 'tool-network',
          toolCallId: part.toolCallId,
          payload: part.output,
        };
      } else if (isDataChunkType(part.output)) {
        if (!('data' in part.output)) {
          throw new Error(
            `UI Messages require a data property when using data- prefixed chunks \n ${JSON.stringify(part)}`,
          );
        }
        const { type, data, id } = part.output;
        return { type, data, ...(id !== undefined && { id }) } as InferUIMessageChunk<UI_MESSAGE>;
      }
      return;
    }

    case 'tool-error': {
      return {
        type: 'tool-output-error',
        toolCallId: part.toolCallId,
        errorText: onError(part.error),
        ...(part.providerExecuted != null ? { providerExecuted: part.providerExecuted } : {}),
        ...(part.dynamic != null ? { dynamic: part.dynamic } : {}),
      };
    }

    case 'error': {
      return {
        type: 'error',
        errorText: onError(part.error),
      };
    }

    case 'start-step': {
      return { type: 'start-step' };
    }

    case 'finish-step': {
      return { type: 'finish-step' };
    }

    case 'start': {
      if (sendStart) {
        // Prefer responseMessageId (from client's last assistant message) when set,
        // fall back to messageId from the chunk (server-generated).
        // This ensures continuation flows (e.g. addToolResult) use the client's
        // existing message ID so the response appends to the correct message.
        const messageId = responseMessageId || ('messageId' in part ? part.messageId : undefined);
        return {
          type: 'start' as const,
          ...(messageMetadataValue != null ? { messageMetadata: messageMetadataValue } : {}),
          ...(messageId != null ? { messageId } : {}),
        } as InferUIMessageChunk<UI_MESSAGE>;
      }
      return;
    }

    case 'finish': {
      if (sendFinish) {
        return {
          type: 'finish' as const,
          ...(messageMetadataValue != null ? { messageMetadata: messageMetadataValue } : {}),
        } as InferUIMessageChunk<UI_MESSAGE>;
      }
      return;
    }

    case 'abort': {
      return part;
    }

    case 'tool-input-end': {
      return;
    }

    case 'raw': {
      // Raw chunks are not included in UI message streams
      // as they contain provider-specific data for developer use
      return;
    }

    default: {
      // return the chunk as is if it's not a known type
      if (isDataChunkType(part)) {
        if (!('data' in part)) {
          throw new Error(
            `UI Messages require a data property when using data- prefixed chunks \n ${JSON.stringify(part)}`,
          );
        }
        const { type, data, id } = part;
        return { type, data, ...(id !== undefined && { id }) } as InferUIMessageChunk<UI_MESSAGE>;
      }

      return;
    }
  }
}
