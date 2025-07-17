export function convertFullStreamChunkToMastra(value: any, ctx: { runId: string }, write: (chunk: any) => void) {
  if (value.type === 'step-start') {
    write({
      type: 'step-start',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        messageId: value.messageId,
        request: { body: JSON.parse(value.request!.body ?? '{}') },
        warnings: value.warnings,
      },
    });
  } else if (value.type === 'tool-call') {
    write({
      type: 'tool-call',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        toolCallId: value.toolCallId,
        args: value.args,
        toolName: value.toolName,
      },
    });
  } else if (value.type === 'tool-result') {
    write({
      type: 'tool-result',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        toolCallId: value.toolCallId,
        toolName: value.toolName,
        result: value.result,
      },
    });
  } else if (value.type === 'text-delta') {
    write({
      type: 'text-delta',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        text: value.textDelta,
      },
    });
  } else if (value.type === 'step-finish') {
    write({
      type: 'step-finish',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        reason: value.finishReason,
        usage: value.usage,
        response: value.response,
        messageId: value.messageId,
        providerMetadata: value.providerMetadata,
      },
    });
  } else if (value.type === 'finish') {
    write({
      type: 'finish',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        usage: value.usage,
        providerMetadata: value.providerMetadata,
      },
    });
  }
}
