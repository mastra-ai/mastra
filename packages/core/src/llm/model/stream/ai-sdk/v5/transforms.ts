import { DefaultGeneratedFileWithType } from './file';

export function convertFullStreamChunkToMastra(value: any, ctx: { runId: string }) {
  if (value.type === 'step-start') {
    return {
      type: 'step-start',
      runId: ctx.runId,
      from: 'AGENT',
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
      from: 'AGENT',
      payload: {
        id: value.id,
        providerMetadata: value.providerMetadata,
        providerExecuted: value.providerExecuted,
        toolCallId: value.toolCallId,
        args: value.input ? JSON.parse(value.input) : undefined,
        toolName: value.toolName,
      },
    };
  } else if (value.type === 'tool-result') {
    return {
      type: 'tool-result',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        id: value.id,
        providerMetadata: value.providerMetadata,
        toolCallId: value.toolCallId,
        toolName: value.toolName,
        args: value.args,
        result: value.result,
      },
    };
  } else if (value.type === 'tool-error') {
    return {
      type: 'tool-error',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        id: value.id,
        providerMetadata: value.providerMetadata,
        toolCallId: value.toolCallId,
        toolName: value.toolName,
        args: value.args,
        error: value.error,
      },
    };
  } else if (value.type === 'tool-input-delta') {
    return {
      type: 'tool-call-delta',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        providerMetadata: value.providerMetadata,
        argsTextDelta: value.delta,
        toolCallId: value.id,
      },
    };
  } else if (value.type === 'tool-input-start') {
    return {
      type: 'tool-call-input-streaming-start',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        toolCallId: value.id,
        toolName: value.toolName,
        dynamic: value.dynamic,
      },
    };
  } else if (value.type === 'tool-input-end') {
    return {
      type: 'tool-call-input-streaming-end',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        toolCallId: value.id,
      },
    };
  } else if (value.type === 'text-start') {
    return {
      type: 'text-start',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        id: value.id,
        providerMetadata: value.providerMetadata,
      },
    };
  } else if (value.type === 'text-end') {
    return {
      type: 'text-end',
      runId: ctx.runId,
      from: 'AGENT',
      payload: value,
    };
  } else if (value.type === 'text-delta') {
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
  } else if (value.type === 'step-finish') {
    return {
      type: 'step-finish',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        id: value.id,
        providerMetadata: value.providerMetadata,
        reason: value.finishReason,
        totalUsage: value.usage,
        response: value.response,
        messageId: value.messageId,
      },
    };
  } else if (value.type === 'finish') {
    const { finishReason, usage, providerMetadata, messages: _messages, ...rest } = value;
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
            totalTokens: value?.usage?.totalTokens ?? value.usage?.promptTokens + value.usage?.completionTokens,
          },
        },
        metadata: {
          providerMetadata: value.providerMetadata,
        },
        messages: {
          all: [],
          user: [],
          nonUser: [],
        },
        ...rest,
      },
    };
  } else if (value.type === 'response-metadata') {
    return {
      type: 'response-metadata',
      runId: ctx.runId,
      from: 'AGENT',
      payload: value,
    };
  } else if (value.type === 'reasoning-start') {
    return {
      type: 'reasoning-start',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        id: value.id,
        providerMetadata: value.providerMetadata,
      },
    };
  } else if (value.type === 'reasoning-delta') {
    return {
      type: 'reasoning-delta',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        id: value.id,
        text: value.delta,
        providerMetadata: value.providerMetadata,
      },
    };
  } else if (value.type === 'reasoning-signature') {
    return {
      type: 'reasoning-signature',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        id: value.id,
        signature: value.signature,
        providerMetadata: value.providerMetadata,
      },
    };
  } else if (value.type === 'redacted-reasoning') {
    return {
      type: 'redacted-reasoning',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        id: value.id,
        data: value.data,
        providerMetadata: value.providerMetadata,
      },
    };
  } else if (value.type === 'reasoning-end') {
    return {
      type: 'reasoning-end',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        id: value.id,
        providerMetadata: value.providerMetadata,
      },
    };
  } else if (value.type === 'source') {
    return {
      type: 'source',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        id: value.id,
        sourceType: value.sourceType,
        title: value.title,
        mimeType: value.mediaType,
        filename: value.filename,
        url: value.url,
        providerMetadata: value.providerMetadata,
      },
    };
  } else if (value.type === 'file') {
    return {
      type: 'file',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        id: value.id,
        providerMetadata: value.providerMetadata,
        data: value.data,
        base64: value.base64,
        mimeType: value.mediaType,
      },
    };
  } else if (value.type === 'error') {
    return {
      type: 'error',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        id: value.id,
        providerMetadata: value.providerMetadata,
        error: value.error,
      },
    };
  }
}

export function convertFullStreamChunkToAISDKv5({
  chunk,
  sendReasoning,
  sendSources,
  sendUsage = true,
  experimental_sendFinish = true,
  toolCallArgsDeltas,
  getErrorMessage,
}: {
  chunk: any;
  sendReasoning: boolean;
  sendSources: boolean;
  sendUsage: boolean;
  experimental_sendFinish?: boolean;
  toolCallArgsDeltas?: Record<string, string[]>;
  getErrorMessage: (error: string) => string;
}) {
  if (chunk.type === 'text-delta') {
    return {
      type: 'text-delta',
      id: chunk.payload.id,
      text: chunk.payload.text,
      providerMetadata: chunk.payload.providerMetadata,
    };
  } else if (chunk.type === 'text-start') {
    return {
      type: 'text-start',
      id: chunk.payload.id,
      ...(chunk.payload.providerMetadata ? { providerMetadata: chunk.payload.providerMetadata } : {}),
    };
  } else if (chunk.type === 'text-end') {
    return {
      type: 'text-end',
      id: chunk.payload.id,
      ...(chunk.payload.providerMetadata ? { providerMetadata: chunk.payload.providerMetadata } : {}),
    };
  } else if (chunk.type === 'step-start') {
    const { messageId: _messageId, ...rest } = chunk.payload;
    return {
      type: 'start-step',
      ...(rest || {}),
    };
  } else if (chunk.type === 'step-finish') {
    const { providerMetadata, request, ...otherMetadata } = chunk.payload.metadata;
    return {
      usage: chunk.payload.output.usage,
      response: otherMetadata,
      providerMetadata: providerMetadata,
      finishReason: chunk.payload.stepResult.reason,
      type: 'finish-step',
    };
  } else if (chunk.type === 'start') {
    return {
      type: 'start',
    };
  } else if (chunk.type === 'finish') {
    return {
      type: 'finish',
      finishReason: chunk.payload.stepResult.reason,
      totalUsage: chunk.payload.output.usage,
    };
  } else if (chunk.type === 'reasoning-start') {
    return {
      type: 'reasoning-start',
      id: chunk.payload.id,
      ...(chunk.payload.providerMetadata ? { providerMetadata: chunk.payload.providerMetadata } : {}),
    };
  } else if (chunk.type === 'reasoning-delta') {
    return {
      type: 'reasoning-delta',
      id: chunk.payload.id,
      text: chunk.payload.text,
      providerMetadata: chunk.payload.providerMetadata,
    };
  } else if (chunk.type === 'reasoning-signature') {
    return {
      type: 'reasoning-signature',
      id: chunk.payload.id,
      signature: chunk.payload.signature,
    };
  } else if (chunk.type === 'redacted-reasoning') {
    return {
      type: 'redacted-reasoning',
      id: chunk.payload.id,
      data: chunk.payload.data,
    };
  } else if (chunk.type === 'reasoning-end') {
    return {
      type: 'reasoning-end',
      id: chunk.payload.id,
      ...(chunk.payload.providerMetadata ? { providerMetadata: chunk.payload.providerMetadata } : {}),
    };
  } else if (chunk.type === 'source') {
    return {
      type: 'source',
      id: chunk.payload.id,
      ...(chunk.payload.sourceType ? { sourceType: chunk.payload.sourceType } : {}),
      ...(chunk.payload.mimeType ? { mediaType: chunk.payload.mimeType } : {}),
      ...(chunk.payload.filename ? { filename: chunk.payload.filename } : {}),
      ...(chunk.payload.title ? { title: chunk.payload.title } : {}),
      url: chunk.payload.url,
      ...(chunk.payload.providerMetadata ? { providerMetadata: chunk.payload.providerMetadata } : {}),
    };
  } else if (chunk.type === 'file') {
    return {
      type: 'file',
      file: new DefaultGeneratedFileWithType({
        data: chunk.payload.data,
        mediaType: chunk.payload.mimeType,
      }),
    };
  } else if (chunk.type === 'tool-call') {
    return {
      type: 'tool-call',
      toolCallId: chunk.payload.toolCallId,
      providerMetadata: chunk.payload.providerMetadata,
      providerExecuted: chunk.payload.providerExecuted,
      toolName: chunk.payload.toolName,
      input: chunk.payload.args,
    };
  } else if (chunk.type === 'tool-call-input-streaming-start') {
    console.log('tool-call-input-streaming-start', chunk.payload);
    return {
      type: 'tool-input-start',
      id: chunk.payload.toolCallId,
      toolName: chunk.payload.toolName,
      dynamic: !!chunk.payload.dynamic,
    };
  } else if (chunk.type === 'tool-call-input-streaming-end') {
    return {
      type: 'tool-input-end',
      id: chunk.payload.toolCallId,
    };
  } else if (chunk.type === 'tool-call-delta') {
    return {
      type: 'tool-input-delta',
      id: chunk.payload.toolCallId,
      delta: chunk.payload.argsTextDelta,
    };
  } else if (chunk.type === 'tool-result') {
    return {
      type: 'tool-result',
      input: chunk.payload.args,
      toolCallId: chunk.payload.toolCallId,
      providerMetadata: chunk.payload.providerMetadata,
      providerExecuted: chunk.payload.providerExecuted,
      toolName: chunk.payload.toolName,
      output: chunk.payload.result,
    };
  } else if (chunk.type === 'tool-error') {
    return {
      type: 'tool-error',
      error: chunk.payload.error,
      input: chunk.payload.args,
      toolCallId: chunk.payload.toolCallId,
      providerMetadata: chunk.payload.providerMetadata,
      providerExecuted: chunk.payload.providerExecuted,
      toolName: chunk.payload.toolName,
    };
  } else if (chunk.type === 'error') {
    return {
      type: 'error',
      error: chunk.payload.error,
    };
  } else {
    return;
  }
}
