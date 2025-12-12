import { randomUUID } from 'node:crypto';

/**
 * Converts a doGenerate result to a ReadableStream format.
 * This is shared between V2 and V3 model wrappers since the content/result structure is compatible.
 */
export function createStreamFromGenerateResult(result: {
  warnings: unknown[];
  response?: {
    id?: string;
    modelId?: string;
    timestamp?: Date;
  };
  content: Array<{
    type: string;
    [key: string]: unknown;
  }>;
  finishReason: unknown;
  usage: unknown;
  providerMetadata?: unknown;
}): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: result.warnings });
      controller.enqueue({
        type: 'response-metadata',
        id: result.response?.id,
        modelId: result.response?.modelId,
        timestamp: result.response?.timestamp,
      });

      for (const message of result.content) {
        if (message.type === 'tool-call') {
          const toolCall = message as {
            type: 'tool-call';
            toolCallId: string;
            toolName: string;
            input: unknown;
          };
          controller.enqueue({
            type: 'tool-input-start',
            id: toolCall.toolCallId,
            toolName: toolCall.toolName,
          });
          controller.enqueue({
            type: 'tool-input-delta',
            id: toolCall.toolCallId,
            delta: toolCall.input,
          });
          controller.enqueue({
            type: 'tool-input-end',
            id: toolCall.toolCallId,
          });
          controller.enqueue(toolCall);
        } else if (message.type === 'tool-result') {
          controller.enqueue(message);
        } else if (message.type === 'text') {
          const text = message as {
            type: 'text';
            text: string;
            providerMetadata?: unknown;
          };
          const id = `msg_${randomUUID()}`;
          controller.enqueue({
            type: 'text-start',
            id,
            providerMetadata: text.providerMetadata,
          });
          controller.enqueue({
            type: 'text-delta',
            id,
            delta: text.text,
          });
          controller.enqueue({
            type: 'text-end',
            id,
          });
        } else if (message.type === 'reasoning') {
          const id = `reasoning_${randomUUID()}`;
          const reasoning = message as {
            type: 'reasoning';
            text: string;
            providerMetadata?: unknown;
          };
          controller.enqueue({
            type: 'reasoning-start',
            id,
            providerMetadata: reasoning.providerMetadata,
          });
          controller.enqueue({
            type: 'reasoning-delta',
            id,
            delta: reasoning.text,
            providerMetadata: reasoning.providerMetadata,
          });
          controller.enqueue({
            type: 'reasoning-end',
            id,
            providerMetadata: reasoning.providerMetadata,
          });
        } else if (message.type === 'file') {
          const file = message as {
            type: 'file';
            mediaType: string;
            data: unknown;
          };
          controller.enqueue({
            type: 'file',
            mediaType: file.mediaType,
            data: file.data,
          });
        } else if (message.type === 'source') {
          const source = message as {
            type: 'source';
            sourceType: 'url' | 'document';
            id: string;
            url?: string;
            mediaType?: string;
            filename?: string;
            title?: string;
            providerMetadata?: unknown;
          };
          if (source.sourceType === 'url') {
            controller.enqueue({
              type: 'source',
              id: source.id,
              sourceType: 'url',
              url: source.url,
              title: source.title,
              providerMetadata: source.providerMetadata,
            });
          } else {
            controller.enqueue({
              type: 'source',
              id: source.id,
              sourceType: 'document',
              mediaType: source.mediaType,
              filename: source.filename,
              title: source.title,
              providerMetadata: source.providerMetadata,
            });
          }
        }
      }

      controller.enqueue({
        type: 'finish',
        finishReason: result.finishReason,
        usage: result.usage,
        providerMetadata: result.providerMetadata,
      });

      controller.close();
    },
  });
}
