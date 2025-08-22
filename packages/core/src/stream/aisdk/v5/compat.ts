import type {
  LanguageModelV2FunctionTool,
  LanguageModelV2ProviderDefinedTool,
  LanguageModelV2ToolChoice,
} from '@ai-sdk/provider-v5';
import { TypeValidationError } from '@ai-sdk/provider-v5';
import { asSchema, tool as toolFn } from 'ai-v5';
import type { Schema, TextStreamPart, Tool, ToolChoice, ToolSet, UIMessage } from 'ai-v5';

export function convertFullStreamChunkToUIMessageStream({
  part,
  messageMetadataValue,
  sendReasoning,
  sendSources,
  onError,
  sendStart,
  sendFinish,
  responseMessageId,
}: {
  part: TextStreamPart<ToolSet>;
  messageMetadataValue?: any;
  sendReasoning?: boolean;
  sendSources?: boolean;
  onError: (error: any) => string;
  sendStart?: boolean;
  sendFinish?: boolean;
  responseMessageId?: string;
}) {
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

export type ConsumeStreamOptions = {
  onError?: (error: unknown) => void;
};

export type ValidationResult<T> =
  | {
      success: true;
      value: T;
    }
  | {
      success: false;
      error: Error;
    };

/**
 * Safely validates the types of an unknown object using a schema.
 * Based on @ai-sdk/provider-utils safeValidateTypes
 */
export async function safeValidateTypes<OBJECT>({
  value,
  schema,
}: {
  value: unknown;
  schema: Schema<OBJECT>;
}): Promise<ValidationResult<OBJECT>> {
  try {
    // Check if validate method exists (it's optional on Schema)
    if (!schema.validate) {
      // If no validate method, we can't validate - just pass through
      return {
        success: true,
        value: value as OBJECT,
      };
    }

    const result = await schema.validate(value);

    if (!result.success) {
      return {
        success: false,
        error: new TypeValidationError({
          value,
          cause: 'Validation failed',
        }),
      };
    }

    return {
      success: true,
      value: result.value,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export async function consumeStream({
  stream,
  onError,
}: {
  stream: ReadableStream;
  onError?: (error: unknown) => void;
}): Promise<void> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  } catch (error) {
    console.log('consumeStream error', error);
    onError?.(error);
  } finally {
    reader.releaseLock();
  }
}

export function prepareToolsAndToolChoice<TOOLS extends Record<string, Tool>>({
  tools,
  toolChoice,
  activeTools,
}: {
  tools: TOOLS | undefined;
  toolChoice: ToolChoice<TOOLS> | undefined;
  activeTools: Array<keyof TOOLS> | undefined;
}): {
  tools: Array<LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool> | undefined;
  toolChoice: LanguageModelV2ToolChoice | undefined;
} {
  if (Object.keys(tools || {}).length === 0) {
    return {
      tools: undefined,
      toolChoice: undefined,
    };
  }

  // when activeTools is provided, we only include the tools that are in the list:
  const filteredTools =
    activeTools != null
      ? Object.entries(tools || {}).filter(([name]) => activeTools.includes(name as keyof TOOLS))
      : Object.entries(tools || {});

  return {
    tools: filteredTools
      .map(([name, tool]) => {
        try {
          let inputSchema;
          if ('inputSchema' in tool) {
            inputSchema = tool.inputSchema;
          } else if ('parameters' in tool) {
            // @ts-ignore tool is not part
            inputSchema = tool.parameters;
          }

          const sdkTool = toolFn({
            type: 'function',
            ...tool,
            inputSchema,
          } as any);

          const toolType = sdkTool?.type ?? 'function';

          switch (toolType) {
            case undefined:
            case 'dynamic':
            case 'function':
              return {
                type: 'function' as const,
                name,
                description: sdkTool.description,
                inputSchema: asSchema(sdkTool.inputSchema).jsonSchema,
                providerOptions: sdkTool.providerOptions,
              };
            case 'provider-defined':
              return {
                type: 'provider-defined' as const,
                name,
                // TODO: as any seems wrong here. are there cases where we don't have an id?
                id: (sdkTool as any).id,
                args: (sdkTool as any).args,
              };
            default: {
              const exhaustiveCheck: never = toolType;
              throw new Error(`Unsupported tool type: ${exhaustiveCheck}`);
            }
          }
        } catch (e) {
          console.error('Error preparing tool', e);
          return null;
        }
      })
      .filter(tool => tool !== null) as (LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool)[],
    toolChoice:
      toolChoice == null
        ? { type: 'auto' }
        : typeof toolChoice === 'string'
          ? { type: toolChoice }
          : { type: 'tool' as const, toolName: toolChoice.toolName as string },
  };
}

/**
 * Delayed promise. It is only constructed once the value is accessed.
 * This is useful to avoid unhandled promise rejections when the promise is created
 * but not accessed.
 */
export class DelayedPromise<T> {
  public status: { type: 'pending' } | { type: 'resolved'; value: T } | { type: 'rejected'; error: unknown } = {
    type: 'pending',
  };
  private _promise: Promise<T> | undefined;
  private _resolve: undefined | ((value: T) => void) = undefined;
  private _reject: undefined | ((error: unknown) => void) = undefined;

  get promise(): Promise<T> {
    if (this._promise) {
      return this._promise;
    }

    this._promise = new Promise<T>((resolve, reject) => {
      if (this.status.type === 'resolved') {
        resolve(this.status.value);
      } else if (this.status.type === 'rejected') {
        reject(this.status.error);
      }

      this._resolve = resolve;
      this._reject = reject;
    });

    return this._promise;
  }

  resolve(value: T): void {
    this.status = { type: 'resolved', value };

    if (this._promise) {
      this._resolve?.(value);
    }
  }

  reject(error: unknown): void {
    this.status = { type: 'rejected', error };

    if (this._promise) {
      this._reject?.(error);
    }
  }
}
