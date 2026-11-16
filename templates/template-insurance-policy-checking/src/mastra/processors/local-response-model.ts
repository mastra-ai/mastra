import type { ProcessInputStepResult } from '@mastra/core/processors';

type LocalResponseModel = Extract<NonNullable<ProcessInputStepResult['model']>, { specificationVersion: 'v2' }>;

/** Adapt a verified local result to the native agent response lifecycle without external inference. */
export function createLocalResponseModel(text: string): LocalResponseModel {
  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  return {
    specificationVersion: 'v2',
    provider: 'local-response',
    modelId: 'verified-local-response',
    supportedUrls: {},
    async doGenerate() {
      return { content: [{ type: 'text' as const, text }], finishReason: 'stop' as const, usage, warnings: [] };
    },
    async doStream() {
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'text-start', id: 'local-response' });
            controller.enqueue({ type: 'text-delta', id: 'local-response', delta: text });
            controller.enqueue({ type: 'text-end', id: 'local-response' });
            controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
            controller.close();
          },
        }),
      };
    },
  };
}
