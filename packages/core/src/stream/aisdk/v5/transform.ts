import type {
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
  LanguageModelV2Usage,
  SharedV2ProviderMetadata,
} from '@ai-sdk/provider-v5';
import type { LanguageModelV3FinishReason, LanguageModelV3Usage } from '@ai-sdk/provider-v6';
import type { ModelMessage, ObjectStreamPart, TextStreamPart, ToolSet } from '@internal/ai-sdk-v5';
import type { AIV5ResponseMessage } from '../../../agent/message-list';
import type { ChunkType, LanguageModelUsage } from '../../types';
import { ChunkFrom } from '../../types';
import { DefaultGeneratedFile, DefaultGeneratedFileWithType } from './file';

export type StreamPart =
  | Exclude<LanguageModelV2StreamPart, { type: 'finish' }>
  | {
      type: 'finish';
      /** Includes 'tripwire' and 'retry' for processor scenarios */
      finishReason: LanguageModelV2FinishReason | 'tripwire' | 'retry';
      usage: LanguageModelV2Usage;
      providerMetadata: SharedV2ProviderMetadata;
      messages: {
        all: ModelMessage[];
        user: ModelMessage[];
        nonUser: AIV5ResponseMessage[];
      };
    };

export function convertFullStreamChunkToMastra(value: StreamPart, ctx: { runId: string }): ChunkType | undefined {
  switch (value.type) {
    case 'response-metadata':
      return {
        type: 'response-metadata',
        runId: ctx.runId,
        from: ChunkFrom.AGENT,
        payload: { ...value },
      };
    case 'text-start':
      return {
        type: 'text-start',
        runId: ctx.runId,
        from: ChunkFrom.AGENT,
        payload: {
          id: value.id,
          providerMetadata: value.providerMetadata,
        },
      };
    case 'text-delta':
      if (value.delta) {
        return {
          type: 'text-delta',
          runId: ctx.runId,
          from: ChunkFrom.AGENT,
          payload: {
            id: value.id,
            providerMetadata: value.providerMetadata,
            text: value.delta,
          },
        };
      }
      return;

    case 'text-end':
      return {
        type: 'text-end',
        runId: ctx.runId,
        from: ChunkFrom.AGENT,
        payload: value,
      };

    case 'reasoning-start':
      return {
        type: 'reasoning-start',
        runId: ctx.runId,
        from: ChunkFrom.AGENT,
        payload: {
          id: value.id,
          providerMetadata: value.providerMetadata,
        },
      };

    case 'reasoning-delta':
      return {
        type: 'reasoning-delta',
        runId: ctx.runId,
        from: ChunkFrom.AGENT,
        payload: {
          id: value.id,
          providerMetadata: value.providerMetadata,
          text: value.delta,
        },
      };

    case 'reasoning-end':
      return {
        type: 'reasoning-end',
        runId: ctx.runId,
        from: ChunkFrom.AGENT,
        payload: {
          id: value.id,
          providerMetadata: value.providerMetadata,
        },
      };

    case 'source':
      return {
        type: 'source',
        runId: ctx.runId,
        from: ChunkFrom.AGENT,
        payload: {
          id: value.id,
          sourceType: value.sourceType,
          title: value.title || '',
          mimeType: value.sourceType === 'document' ? value.mediaType : undefined,
          filename: value.sourceType === 'document' ? value.filename : undefined,
          url: value.sourceType === 'url' ? value.url : undefined,
          providerMetadata: value.providerMetadata,
        },
      };

    case 'file':
      return {
        type: 'file',
        runId: ctx.runId,
        from: ChunkFrom.AGENT,
        payload: {
          data: value.data,
          base64: typeof value.data === 'string' ? value.data : undefined,
          mimeType: value.mediaType,
        },
      };

    case 'tool-call': {
      let toolCallInput: Record<string, any> | undefined = undefined;

      if (value.input) {
        try {
          toolCallInput = JSON.parse(value.input);
        } catch (error) {
          console.error('Error converting tool call input to JSON', {
            error,
            input: value.input,
          });
          toolCallInput = undefined;
        }
      }

      return {
        type: 'tool-call',
        runId: ctx.runId,
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: value.toolCallId,
          toolName: value.toolName,
          args: toolCallInput,
          providerExecuted: value.providerExecuted,
          providerMetadata: value.providerMetadata,
        },
      };
    }

    case 'tool-result':
      return {
        type: 'tool-result',
        runId: ctx.runId,
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: value.toolCallId,
          toolName: value.toolName,
          result: value.result,
          isError: value.isError,
          providerExecuted: value.providerExecuted,
          providerMetadata: value.providerMetadata,
        },
      };

    case 'tool-input-start':
      return {
        type: 'tool-call-input-streaming-start',
        runId: ctx.runId,
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: value.id,
          toolName: value.toolName,
          providerExecuted: value.providerExecuted,
          providerMetadata: value.providerMetadata,
        },
      };

    case 'tool-input-delta':
      if (value.delta) {
        return {
          type: 'tool-call-delta',
          runId: ctx.runId,
          from: ChunkFrom.AGENT,
          payload: {
            argsTextDelta: value.delta,
            toolCallId: value.id,
            providerMetadata: value.providerMetadata,
          },
        };
      }
      return;

    case 'tool-input-end':
      return {
        type: 'tool-call-input-streaming-end',
        runId: ctx.runId,
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: value.id,
          providerMetadata: value.providerMetadata,
        },
      };

    case 'finish':
      const { finishReason, usage, providerMetadata, messages, ...rest } = value;
      return {
        type: 'finish',
        runId: ctx.runId,
        from: ChunkFrom.AGENT,
        payload: {
          stepResult: {
            reason: normalizeFinishReason(value.finishReason),
          },
          output: {
            // Normalize usage to handle both V2 (flat) and V3 (nested) formats
            usage: normalizeUsage(value.usage),
          },
          metadata: {
            providerMetadata: value.providerMetadata,
          },
          messages,
          ...rest,
        },
      };
    case 'error':
      return {
        type: 'error',
        runId: ctx.runId,
        from: ChunkFrom.AGENT,
        payload: value,
      };

    case 'raw':
      return {
        type: 'raw',
        runId: ctx.runId,
        from: ChunkFrom.AGENT,
        payload: value.rawValue as Record<string, unknown>,
      };
  }
  return;
}

export type OutputChunkType<OUTPUT = undefined> =
  | TextStreamPart<ToolSet>
  | ObjectStreamPart<Partial<OUTPUT>>
  | undefined;

export function convertMastraChunkToAISDKv5<OUTPUT = undefined>({
  chunk,
  mode = 'stream',
}: {
  chunk: ChunkType<OUTPUT>;
  mode?: 'generate' | 'stream';
}): OutputChunkType<OUTPUT> {
  switch (chunk.type) {
    case 'start':
      return {
        type: 'start',
      };
    case 'step-start':
      const { messageId: _messageId, ...rest } = chunk.payload;
      return {
        type: 'start-step',
        request: rest.request,
        warnings: rest.warnings || [],
      };
    case 'raw':
      return {
        type: 'raw',
        rawValue: chunk.payload,
      };

    case 'finish': {
      return {
        type: 'finish',
        // Cast needed: Mastra extends reason with 'tripwire' | 'retry' for processor scenarios
        finishReason: chunk.payload.stepResult.reason as LanguageModelV2FinishReason,
        // Cast needed: Mastra's LanguageModelUsage has optional properties, V2 has required-but-nullable
        totalUsage: chunk.payload.output.usage as LanguageModelV2Usage,
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
      throw new Error('AISDKv5 chunk type "reasoning-signature" not supported');
    case 'redacted-reasoning':
      throw new Error('AISDKv5 chunk type "redacted-reasoning" not supported');

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
        usage: chunk.payload.output.usage,
        finishReason: chunk.payload.stepResult.reason,
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

    default:
      if (chunk.type && 'payload' in chunk && chunk.payload) {
        return {
          type: chunk.type as string,
          ...(chunk.payload || {}),
        } as OutputChunkType<OUTPUT>;
      }
      return;
  }
}

/**
 * Type guard to check if usage is in V3 format (nested objects)
 */
function isV3Usage(usage: unknown): usage is LanguageModelV3Usage {
  if (!usage || typeof usage !== 'object') return false;
  const u = usage as Record<string, unknown>;
  return (
    typeof u.inputTokens === 'object' &&
    u.inputTokens !== null &&
    'total' in (u.inputTokens as object) &&
    typeof u.outputTokens === 'object' &&
    u.outputTokens !== null &&
    'total' in (u.outputTokens as object)
  );
}

/**
 * Normalizes usage from either V2 (flat) or V3 (nested) format to Mastra's flat format.
 * V2 format: { inputTokens: number, outputTokens: number, totalTokens?: number }
 * V3 format: { inputTokens: { total, noCache, cacheRead, cacheWrite }, outputTokens: { total, text, reasoning } }
 *
 * The original usage data is preserved in the `raw` field for advanced use cases.
 */
function normalizeUsage(usage: LanguageModelV2Usage | LanguageModelV3Usage | undefined): LanguageModelUsage {
  if (!usage) {
    return {
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
      reasoningTokens: undefined,
      cachedInputTokens: undefined,
      raw: undefined,
    };
  }

  if (isV3Usage(usage)) {
    // V3 format - extract from nested structure
    const inputTokens = usage.inputTokens.total;
    const outputTokens = usage.outputTokens.total;
    return {
      inputTokens,
      outputTokens,
      totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0),
      reasoningTokens: usage.outputTokens.reasoning,
      cachedInputTokens: usage.inputTokens.cacheRead,
      raw: usage,
    };
  }

  // V2 format - already flat
  const v2Usage = usage as LanguageModelV2Usage;
  return {
    inputTokens: v2Usage.inputTokens,
    outputTokens: v2Usage.outputTokens,
    totalTokens: v2Usage.totalTokens ?? (v2Usage.inputTokens ?? 0) + (v2Usage.outputTokens ?? 0),
    reasoningTokens: (v2Usage as { reasoningTokens?: number }).reasoningTokens,
    cachedInputTokens: (v2Usage as { cachedInputTokens?: number }).cachedInputTokens,
    raw: usage,
  };
}

/**
 * Type guard to check if a finish reason is V3 format (object with unified/raw properties)
 */
function isV3FinishReason(
  finishReason: LanguageModelV2FinishReason | LanguageModelV3FinishReason | 'tripwire' | 'retry' | undefined,
): finishReason is LanguageModelV3FinishReason {
  return typeof finishReason === 'object' && finishReason !== null && 'unified' in finishReason;
}

/**
 * Normalize finish reason from either V2/V5 (string) or V3/V6 (object) format to a string.
 *
 * V2/V5 format: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown'
 * V3/V6 format: { unified: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other', raw: string | undefined }
 *
 * We normalize to the unified string value for internal Mastra use.
 * Note: V6 removed 'unknown' and merged it into 'other'.
 */
function normalizeFinishReason(
  finishReason: LanguageModelV2FinishReason | LanguageModelV3FinishReason | 'tripwire' | 'retry' | undefined,
): LanguageModelV2FinishReason | 'tripwire' | 'retry' {
  if (!finishReason) {
    return 'other';
  }

  // Handle Mastra-specific finish reasons
  if (finishReason === 'tripwire' || finishReason === 'retry') {
    return finishReason;
  }

  // V3/V6 format - extract unified value
  if (isV3FinishReason(finishReason)) {
    return finishReason.unified;
  }

  // V2/V5 format - already a string, but normalize 'unknown' to 'other' for consistency with V6
  return finishReason === 'unknown' ? 'other' : finishReason;
}
