import { getModelReasoningOptions, ModelRouterLanguageModel } from '@mastra/core/llm';
import type { JSONValue } from 'ai';
import { runThinkingLevel } from '../thinking.js';
import type { ThinkingLevelSetting } from '../thinking.js';
import { thinkingRequestFor } from './thinking-request.js';

type ProviderOptions = Record<string, Record<string, JSONValue | undefined>>;

export function providerThinkingOptions(
  routedModelId: string,
  level: ThinkingLevelSetting | undefined,
): ProviderOptions | undefined {
  if (!level) return undefined;
  const reasoningOptions = getModelReasoningOptions(routedModelId);
  const request = thinkingRequestFor(routedModelId, reasoningOptions);
  if (!request) return undefined;
  const options = request.optionsByLevel.get(runThinkingLevel(routedModelId, level, reasoningOptions));
  return options && { [request.optionsKey]: options };
}

function withDefaultProviderOptions<CallOptions extends { providerOptions?: ProviderOptions }>(
  callOptions: CallOptions,
  defaults: ProviderOptions | undefined,
): CallOptions {
  if (!defaults) return callOptions;
  const providerOptions: ProviderOptions = { ...callOptions.providerOptions };
  for (const [key, options] of Object.entries(defaults)) {
    providerOptions[key] = { ...options, ...callOptions.providerOptions?.[key] };
  }
  return { ...callOptions, providerOptions };
}

type RouterConfig = ConstructorParameters<typeof ModelRouterLanguageModel>[0];
type RouterCallOptions = Parameters<ModelRouterLanguageModel['doStream']>[0];
type RouterCallResult = ReturnType<ModelRouterLanguageModel['doStream']>;

export class ModelRouterLanguageModelWithProviderOptions extends ModelRouterLanguageModel {
  readonly #defaultProviderOptions: ProviderOptions | undefined;

  constructor(config: RouterConfig, defaultProviderOptions: ProviderOptions | undefined) {
    super(config);
    this.#defaultProviderOptions = defaultProviderOptions;
  }

  override doGenerate(options: RouterCallOptions): RouterCallResult {
    return super.doGenerate(withDefaultProviderOptions(options, this.#defaultProviderOptions));
  }

  override doStream(options: RouterCallOptions): RouterCallResult {
    return super.doStream(withDefaultProviderOptions(options, this.#defaultProviderOptions));
  }
}
