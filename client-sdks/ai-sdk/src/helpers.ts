import { DefaultGeneratedFile, DefaultGeneratedFileWithType } from '@mastra/core/stream';
import type { ChunkType, PartialSchemaOutput, OutputSchema, DataChunkType } from '@mastra/core/stream';

import type { InferUIMessageChunk, ObjectStreamPart, TextStreamPart, ToolSet, UIMessage } from 'ai';
import { isDataChunkType } from './utils';

export type OutputChunkType<OUTPUT extends OutputSchema = undefined> =
  | TextStreamPart<ToolSet>
  | ObjectStreamPart<PartialSchemaOutput<OUTPUT>>
  | DataChunkType
  | undefined;

export type ToolAgentChunkType = { type: 'tool-agent'; toolCallId: string; payload: any };
export type ToolWorkflowChunkType = { type: 'tool-workflow'; toolCallId: string; payload: any };
export type ToolNetworkChunkType = { type: 'tool-network'; toolCallId: string; payload: any };

export function convertMastraChunkToAISDKv5<OUTPUT extends OutputSchema = undefined>({
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
        finishReason: chunk.payload.stepResult.reason,
        totalUsage: chunk.payload.output.usage,
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
          runId: chunk.runId,
          toolCallId: chunk.payload.toolCallId,
          toolName: chunk.payload.toolName,
          args: chunk.payload.args,
        },
      } satisfies DataChunkType;
    case 'tool-call-suspended':
      return {
        type: 'data-tool-call-suspended',
        id: chunk.payload.toolCallId,
        data: {
          runId: chunk.runId,
          toolCallId: chunk.payload.toolCallId,
          toolName: chunk.payload.toolName,
          suspendPayload: chunk.payload.suspendPayload,
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
    case 'tripwire':
      return {
        type: 'data-tripwire',
        data: {
          tripwireReason: chunk.payload.tripwireReason,
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
  part: TextStreamPart<ToolSet> | DataChunkType | { type: 'tool-output'; toolCallId: string; output: any };
  messageMetadataValue?: unknown;
  sendReasoning?: boolean;
  sendSources?: boolean;
  onError: (error: unknown) => string;
  sendStart?: boolean;
  sendFinish?: boolean;
  responseMessageId?: string;
}): InferUIMessageChunk<UI_MESSAGE> | ToolAgentChunkType | ToolWorkflowChunkType | ToolNetworkChunkType | undefined {
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
        return part.output;
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
        return {
          type: 'start' as const,
          ...(messageMetadataValue != null ? { messageMetadata: messageMetadataValue } : {}),
          ...(responseMessageId != null ? { messageId: responseMessageId } : {}),
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
        return part;
      }

      return;
    }
  }
}
