type ModelCall = { abortSignal?: AbortSignal; maxOutputTokens?: number; prompt: unknown; tools?: unknown };
type FixtureOptions = {
  error?: Error | (() => Error);
  finishReason?: string;
  onCall?: (call: ModelCall) => void;
  textForCall?: (call: ModelCall) => string;
  usage?: unknown;
  waitForAbort?: boolean;
};

export function fixedLanguageModel(text: string, options: FixtureOptions = {}) {
  const errorForCall = () => (typeof options.error === 'function' ? options.error() : options.error);
  const textForCall = (call: ModelCall) => options.textForCall?.(call) ?? text;
  return {
    specificationVersion: 'v3' as const,
    provider: 'controlled-test-provider',
    modelId: 'controlled-test-model',
    supportedUrls: async () => ({}),
    doGenerate: async (call: ModelCall) => {
      options.onCall?.(call);
      const error = errorForCall();
      if (error) throw error;
      if (options.waitForAbort) {
        await new Promise<void>((_resolve, reject) => {
          if (call.abortSignal?.aborted) {
            reject(call.abortSignal.reason);
            return;
          }
          call.abortSignal?.addEventListener('abort', () => reject(call.abortSignal?.reason), { once: true });
        });
      }
      return {
        content: [{ type: 'text', text: textForCall(call) }],
        finishReason: options.finishReason ?? 'stop',
        usage: options.usage ?? { inputTokens: { total: 1 }, outputTokens: { total: 1 }, totalTokens: 2 },
        warnings: [],
        response: { id: 'controlled-response', timestamp: new Date(0), modelId: 'controlled-test-model' },
      };
    },
    doStream: async (call: ModelCall) => {
      options.onCall?.(call);
      const error = errorForCall();
      if (error) throw error;
      if (options.waitForAbort) {
        await new Promise<void>((_resolve, reject) => {
          if (call.abortSignal?.aborted) {
            reject(call.abortSignal.reason);
            return;
          }
          call.abortSignal?.addEventListener('abort', () => reject(call.abortSignal?.reason), { once: true });
        });
      }
      const responseText = textForCall(call);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'controlled-response',
              modelId: 'controlled-test-model',
              timestamp: new Date(0),
            });
            controller.enqueue({ type: 'text-start', id: 'controlled-text' });
            controller.enqueue({ type: 'text-delta', id: 'controlled-text', delta: responseText });
            controller.enqueue({ type: 'text-end', id: 'controlled-text' });
            controller.enqueue({
              type: 'finish',
              finishReason: options.finishReason ?? 'stop',
              usage: options.usage ?? { inputTokens: { total: 1 }, outputTokens: { total: 1 }, totalTokens: 2 },
            });
            controller.close();
          },
        }),
      };
    },
  };
}
