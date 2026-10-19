import type { ModelPart, ModelStream, ProviderModel, ModelFactory } from '../../src/mastra/processing/model.ts';

// Exercise the actual V3 wire protocol even though the public router declaration says V2.
function v3Response(
  response: ModelStream,
  finish: {
    reason?: string;
  } = {},
): ModelStream {
  return {
    stream: new ReadableStream<ModelPart>({
      async start(controller) {
        try {
          for await (const part of response.stream) {
            if (part.type !== 'finish') {
              controller.enqueue(part);
              continue;
            }
            const input = part.usage.inputTokens;
            const output = part.usage.outputTokens;
            controller.enqueue({
              type: 'finish',
              finishReason: { unified: finish.reason ?? part.finishReason, raw: 'PRIVATE_RAW_FINISH_CANARY' },
              usage: {
                inputTokens: { total: input, noCache: input, cacheRead: 0, cacheWrite: undefined },
                outputTokens: {
                  total: output,
                  text: output === undefined ? undefined : output - (part.usage.reasoningTokens ?? 0),
                  reasoning: part.usage.reasoningTokens,
                },
                raw: { secret: 'PRIVATE_USAGE_CANARY' },
              },
              providerMetadata: { secret: 'PRIVATE_PROVIDER_CANARY' },
            } as unknown as ModelPart);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    }),
  };
}
export function v3Factory(
  factory: ModelFactory,
  overrides?: (phase: Parameters<ModelFactory>[0], questionId: string) => Parameters<typeof v3Response>[1],
): ModelFactory {
  return (phase, questionId) => {
    const provider = factory(phase, questionId);
    const call: ProviderModel['doStream'] = async options =>
      v3Response(await provider.doStream(options), overrides?.(phase, questionId));
    return { doStream: call, doGenerate: call };
  };
}
