import type { InferUIMessageChunk, TextStreamPart, ToolSet, UIMessage } from 'ai-v5';

export function getResponseUIMessageId({
  originalMessages,
  responseMessageId,
}: {
  originalMessages: UIMessage[] | undefined;
  responseMessageId: string | any;
}) {
  // when there are no original messages (i.e. no persistence),
  // the assistant message id generation is handled on the client side.
  if (originalMessages == null) {
    return undefined;
  }

  const lastMessage = originalMessages[originalMessages.length - 1];

  return lastMessage?.role === 'assistant'
    ? lastMessage.id
    : typeof responseMessageId === 'function'
      ? responseMessageId()
      : responseMessageId;
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
  part: TextStreamPart<ToolSet> | { type: 'tool-output'; toolCallId: string; output: any };
  messageMetadataValue?: any;
  sendReasoning?: boolean;
  sendSources?: boolean;
  onError: (error: any) => string;
  sendStart?: boolean;
  sendFinish?: boolean;
  responseMessageId?: string;
}): InferUIMessageChunk<UI_MESSAGE> | undefined {
  const partType = part.type;

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
      return {
        id: part.toolCallId,
        ...part.output,
      };
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
          type: 'start',
          ...(messageMetadataValue != null ? { messageMetadata: messageMetadataValue } : {}),
          ...(responseMessageId != null ? { messageId: responseMessageId } : {}),
        };
      }
      return;
    }

    case 'finish': {
      if (sendFinish) {
        return {
          type: 'finish',
          ...(messageMetadataValue != null ? { messageMetadata: messageMetadataValue } : {}),
        };
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
      const exhaustiveCheck: never = partType;
      throw new Error(`Unknown chunk type: ${exhaustiveCheck}`);
    }
  }
}
