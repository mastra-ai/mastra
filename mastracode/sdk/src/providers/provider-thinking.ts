import { ModelRouterLanguageModel } from '@mastra/core/llm';
import type { JSONValue } from 'ai';
import { runCatalogThinkingLevel } from '../thinking-catalog.js';
import type { ThinkingLevelSetting } from '../thinking.js';

type ThinkingProviderOptions = Record<string, JSONValue>;
type ProviderOptions = Record<string, Record<string, JSONValue | undefined>>;

function deepSeekThinkingOptions(runLevel: ThinkingLevelSetting): ThinkingProviderOptions {
  if (runLevel === 'off') return { thinking: { type: 'disabled' } };
  return { reasoningEffort: runLevel };
}

const THINKING_OPTIONS_BY_PROVIDER: Record<string, (runLevel: ThinkingLevelSetting) => ThinkingProviderOptions> = {
  deepseek: deepSeekThinkingOptions,
};

export function providerThinkingOptions(
  providerId: string,
  modelId: string,
  level: ThinkingLevelSetting | undefined,
): ProviderOptions | undefined {
  const thinkingOptionsFor = THINKING_OPTIONS_BY_PROVIDER[providerId];
  if (!thinkingOptionsFor || !level) return undefined;
  return { [providerId]: thinkingOptionsFor(runCatalogThinkingLevel(`${providerId}/${modelId}`, level)) };
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
