import { ChunkFrom } from '../../types';
import type { ChunkType } from '../../types';

export function convertFullStreamChunkToMastra(value: any, ctx: { runId: string }): ChunkType | undefined {
  if (value.type === 'step-start') {
    return {
      type: 'step-start',
      runId: ctx.runId,
      from: ChunkFrom.AGENT,
      payload: {
        messageId: value.messageId,
        request: { body: JSON.parse(value.request!.body ?? '{}') },
        warnings: value.warnings,
      },
    };
  } else if (value.type === 'tool-call') {
    return {
      type: 'tool-call',
      runId: ctx.runId,
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: value.toolCallId,
        args: value.args,
        toolName: value.toolName,
      },
    };
  } else if (value.type === 'tool-result') {
    return {
      type: 'tool-result',
      runId: ctx.runId,
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: value.toolCallId,
        toolName: value.toolName,
        result: value.result,
      },
    };
  } else if (value.type === 'text-delta') {
    return {
      type: 'text-delta',
      runId: ctx.runId,
      from: ChunkFrom.AGENT,
      payload: {
        id: value.id,
        text: value.textDelta,
      },
    };
  } else if (value.type === 'step-finish') {
    return {
      type: 'step-finish',
      runId: ctx.runId,
      from: ChunkFrom.AGENT,
      payload: {
        id: value.id,
        reason: value.finishReason,
        usage: value.usage,
        response: value.response,
        messageId: value.messageId,
        providerMetadata: value.providerMetadata,
        stepResult: {
          reason: value.finishReason,
          warnings: value.warnings,
          isContinued: value.isContinued,
          logprobs: value.logprobs,
        },
        output: {
          usage: value.usage,
        },
        metadata: {
          request: value.request,
          providerMetadata: value.providerMetadata,
        },
        messages: {
          all: value.messages.all,
          user: value.messages.user,
          nonUser: value.messages.nonUser,
        },
      },
    };
  } else if (value.type === 'finish') {
    return {
      type: 'finish',
      runId: ctx.runId,
      from: ChunkFrom.AGENT,
      payload: {
        id: value.id,
        usage: value.usage,
        totalUsage: value.totalUsage,
        providerMetadata: value.providerMetadata,
        stepResult: {
          reason: value.finishReason,
          warnings: value.warnings,
          isContinued: value.isContinued,
          logprobs: value.logprobs,
        },
        output: {
          usage: value.usage,
        },
        metadata: {
          request: value.request,
          providerMetadata: value.providerMetadata,
        },
        messages: {
          all: value.messages?.all || [],
          user: value.messages?.user || [],
          nonUser: value.messages?.nonUser || [],
        },
      },
    };
  } else if (value.type === 'tripwire') {
    return {
      type: 'tripwire',
      runId: ctx.runId,
      from: ChunkFrom.AGENT,
      payload: {
        tripwireReason: value.tripwireReason,
      },
    };
  }
}
