import { ModelRouterLanguageModel } from '@mastra/core/llm';
import type { JSONValue } from 'ai';

type ProviderOptions = Record<string, Record<string, JSONValue | undefined>>;

export interface ProviderThinkingOptions {
  optionsKey: string;
  options: Record<string, JSONValue>;
  controlKeys: ReadonlySet<string>;
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
