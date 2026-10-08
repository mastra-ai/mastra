import { getModelReasoningOptions, ModelRouterLanguageModel } from '@mastra/core/llm';
import { wrapLanguageModel } from 'ai';
import type { JSONValue } from 'ai';
import { runThinkingLevel } from '../thinking.js';
import type { ThinkingLevelSetting } from '../thinking.js';
import { thinkingRequestFor } from './thinking-request.js';
import type { ThinkingProviderOptions } from './thinking-request.js';

type ProviderOptions = Record<string, Record<string, JSONValue | undefined>>;

export interface ProviderThinkingOptions {
  optionsKey: string;
  options: ThinkingProviderOptions;
  controlKeys: ReadonlySet<string>;
}

export function providerThinkingOptions(
  routedModelId: string,
  level: ThinkingLevelSetting | undefined,
): ProviderThinkingOptions | undefined {
  if (!level) return undefined;
  const reasoningOptions = getModelReasoningOptions(routedModelId);
  const request = thinkingRequestFor(routedModelId, reasoningOptions);
  if (!request) return undefined;
  const options = request.optionsByLevel.get(runThinkingLevel(routedModelId, level, reasoningOptions));
  if (!options) return undefined;
  const controlKeys = new Set(
    [...request.optionsByLevel.values()].flatMap(levelOptions => Object.keys(levelOptions ?? {})),
  );
  return { optionsKey: request.optionsKey, options, controlKeys };
}

function withThinkingOptions<CallOptions extends { providerOptions?: ProviderOptions }>(
  callOptions: CallOptions,
  thinking: ProviderThinkingOptions | undefined,
): CallOptions {
  if (!thinking) return callOptions;
  const callerOptions = callOptions.providerOptions?.[thinking.optionsKey] ?? {};
  const callerSetThinking = Object.keys(callerOptions).some(key => thinking.controlKeys.has(key));
  if (callerSetThinking) return callOptions;
  return {
    ...callOptions,
    providerOptions: {
      ...callOptions.providerOptions,
      [thinking.optionsKey]: { ...callerOptions, ...thinking.options },
    },
  };
}

type AiSdkLanguageModel = Parameters<typeof wrapLanguageModel>[0]['model'];

export function withThinkingOptionsModel(
  model: AiSdkLanguageModel,
  thinking: ProviderThinkingOptions | undefined,
): AiSdkLanguageModel {
  if (!thinking) return model;
  return wrapLanguageModel({
    model,
    middleware: {
      specificationVersion: 'v3',
      transformParams: async ({ params }) => withThinkingOptions(params, thinking),
    },
  });
}

type RouterConfig = ConstructorParameters<typeof ModelRouterLanguageModel>[0];
type RouterCallOptions = Parameters<ModelRouterLanguageModel['doStream']>[0];
type RouterCallResult = ReturnType<ModelRouterLanguageModel['doStream']>;

export class ModelRouterLanguageModelWithThinking extends ModelRouterLanguageModel {
  readonly #thinking: ProviderThinkingOptions | undefined;

  constructor(config: RouterConfig, thinking: ProviderThinkingOptions | undefined) {
    super(config);
    this.#thinking = thinking;
  }

  override doGenerate(options: RouterCallOptions): RouterCallResult {
    return super.doGenerate(withThinkingOptions(options, this.#thinking));
  }

  override doStream(options: RouterCallOptions): RouterCallResult {
    return super.doStream(withThinkingOptions(options, this.#thinking));
  }
}
