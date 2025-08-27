import type {
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
  LanguageModelV2Usage,
  SharedV2ProviderMetadata,
} from '@ai-sdk/provider-v5';
import type { CoreMessage, ObjectStreamPart, TextStreamPart, ToolSet } from 'ai-v5';
import type { ChunkType } from '../../types';
import { ChunkFrom } from '../../types';
import { DefaultGeneratedFile, DefaultGeneratedFileWithType } from './file';

type StreamPart =
  | Exclude<LanguageModelV2StreamPart, { type: 'finish' }>
  | {
      type: 'finish';
      finishReason: LanguageModelV2FinishReason;
      usage: LanguageModelV2Usage;
      providerMetadata: SharedV2ProviderMetadata;
      messages: {
        all: CoreMessage[];
        user: CoreMessage[];
        nonUser: CoreMessage[];
      };
    };

export function convertFullStreamChunkToMastra(value: StreamPart, ctx: { runId: string }): ChunkType | undefined {
  switch (value.type) {
    case 'response-metadata':
      return {
        type: 'response-metadata',
        runId: ctx.runId,
        from: ChunkFrom.AGENT,
        payload: value,
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

    case 'tool-call':
      return {
        type: 'tool-call',
        runId: ctx.runId,
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: value.toolCallId,
          toolName: value.toolName,
          args: value.input ? JSON.parse(value.input) : undefined,
          providerExecuted: value.providerExecuted,
          providerMetadata: value.providerMetadata,
        },
      };

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
            reason: value.finishReason,
          },
          output: {
            usage: {
              ...(value.usage ?? {}),
              totalTokens:
                value?.usage?.totalTokens ?? (value.usage?.inputTokens ?? 0) + (value.usage?.outputTokens ?? 0),
            },
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
  // if (value.type === 'step-start') {
  //     return {
  //         type: 'step-start',
  //         runId: ctx.runId,
  //         from: 'AGENT',
  //         payload: {
  //             messageId: value.messageId,
  //             request: { body: JSON.parse(value.request!.body ?? '{}') },
  //             warnings: value.warnings,
  //         },
  //     };
  // } else if (value.type === 'tool-error') {
  //     return {
  //         type: 'tool-error',
  //         runId: ctx.runId,
  //         from: 'AGENT',
  //         payload: {
  //             id: value.id,
  //             providerMetadata: value.providerMetadata,
  //             toolCallId: value.toolCallId,
  //             toolName: value.toolName,
  //             args: value.args,
  //             error: value.error,
  //         },
  //     };
  // } else if (value.type === 'step-finish') {
  //     return {
  //         type: 'step-finish',
  //         runId: ctx.runId,
  //         from: 'AGENT',
  //         payload: {
  //             id: value.id,
  //             providerMetadata: value.providerMetadata,
  //             reason: value.finishReason,
  //             totalUsage: value.usage,
  //             response: value.response,
  //             messageId: value.messageId,
  //         },
  //     };
  // else if (value.type === 'reasoning-signature') {
  //     return {
  //         type: 'reasoning-signature',
  //         runId: ctx.runId,
  //         from: 'AGENT',
  //         payload: {
  //             id: value.id,
  //             signature: value.signature,
  //             providerMetadata: value.providerMetadata,
  //         },
  //     };
  // } else if (value.type === 'redacted-reasoning') {
  //     return {
  //         type: 'redacted-reasoning',
  //         runId: ctx.runId,
  //         from: 'AGENT',
  //         payload: {
  //             id: value.id,
  //             data: value.data,
  //             providerMetadata: value.providerMetadata,
  //         },
  //     };
  //  else if (value.type === 'error') {
  //     return {
  //         type: 'error',
  //         runId: ctx.runId,
  //         from: 'AGENT',
  //         payload: {
  //             id: value.id,
  //             providerMetadata: value.providerMetadata,
  //             error: value.error,
  //         },
  //     };
  // }
}

export type OutputChunkType = TextStreamPart<ToolSet> | ObjectStreamPart<unknown> | undefined;

export function convertMastraChunkToAISDKv5({
  chunk,
  mode = 'stream',
}: {
  chunk: ChunkType;
  mode?: 'generate' | 'stream';
}): OutputChunkType {
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
        finishReason: chunk.payload.stepResult.reason,
        totalUsage: chunk.payload.output.usage,
      } as any;
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
    // return {
    //   type: 'reasoning-signature' as const,
    //   id: chunk.payload.id,
    //   signature: chunk.payload.signature,
    // };
    case 'redacted-reasoning':
      throw new Error('AISDKv5 chunk type "redacted-reasoning" not supported');
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
      return {
        type: 'source',
        id: chunk.payload.id,
        sourceType: chunk.payload.sourceType,
        filename: chunk.payload.filename,
        mediaType: chunk.payload.mimeType,
        title: chunk.payload.title,
        url: chunk.payload.url,
        providerMetadata: chunk.payload.providerMetadata,
      } as any;
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
        response: rest as any,
        usage: chunk.payload.output.usage, // ?
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
      if (chunk.type && chunk.payload) {
        return {
          type: chunk.type,
          ...(chunk.payload || {}),
        } as any;
      }
      return;
  }
}
