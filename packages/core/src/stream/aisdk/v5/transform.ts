import type {
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
  LanguageModelV2Usage,
  SharedV2ProviderMetadata,
} from '@ai-sdk/provider-v5';
import type { ChunkType } from '../../types';

type StreamPart =
  | Exclude<LanguageModelV2StreamPart, { type: 'finish' }>
  | {
    type: 'finish';
    finishReason: LanguageModelV2FinishReason;
    usage: LanguageModelV2Usage;
    providerMetadata: SharedV2ProviderMetadata;
    messages: {
      all: any[];
      user: any[];
      nonUser: any[];
    };
  };

export function convertFullStreamChunkToMastra(value: StreamPart, ctx: { runId: string }) {
  switch (value.type) {
    case 'response-metadata':
      return {
        type: 'response-metadata',
        runId: ctx.runId,
        from: 'AGENT',
        payload: value,
      };
    case 'text-start':
      return {
        type: 'text-start',
        runId: ctx.runId,
        from: 'AGENT',
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
          from: 'AGENT',
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
        from: 'AGENT',
        payload: value,
      };

    case 'reasoning-start':
      return {
        type: 'reasoning-start',
        runId: ctx.runId,
        from: 'AGENT',
        payload: {
          id: value.id,
          providerMetadata: value.providerMetadata,
        },
      };

    case 'reasoning-delta':
      if (value.delta) {
        return {
          type: 'reasoning-delta',
          runId: ctx.runId,
          from: 'AGENT',
          payload: {
            id: value.id,
            providerMetadata: value.providerMetadata,
            text: value.delta,
          },
        };
      }
      return;

    case 'reasoning-end':
      return {
        type: 'reasoning-end',
        runId: ctx.runId,
        from: 'AGENT',
        payload: {
          id: value.id,
          providerMetadata: value.providerMetadata,
        },
      };

    case 'source':
      return {
        type: 'source',
        runId: ctx.runId,
        from: 'AGENT',
        payload: {
          id: value.id,
          sourceType: value.sourceType,
          title: value.title,
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
        from: 'AGENT',
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
        from: 'AGENT',
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
        from: 'AGENT',
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
        from: 'AGENT',
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
          from: 'AGENT',
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
        from: 'AGENT',
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
        from: 'AGENT',
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

export function convertFullStreamChunkToAISDKv5({
  chunk,
  getErrorMessage,
}: {
  chunk: ChunkType,
  getErrorMessage: (error: Error) => string,
}) {

}