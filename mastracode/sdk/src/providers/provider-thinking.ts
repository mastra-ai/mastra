import { getModelReasoningOptions, ModelRouterLanguageModel } from '@mastra/core/llm';
import type { ModelReasoningOption } from '@mastra/core/llm';
import { wrapLanguageModel } from 'ai';
import type { JSONValue } from 'ai';
import { requestableReasoningOptions, runThinkingLevel } from '../thinking.js';
import type { ActiveThinkingLevel, ThinkingLevelSetting } from '../thinking.js';
import { thinkingOffOptions, thinkingRequestFormatFor } from './thinking-request.js';
import type { ThinkingRequestFormat } from './thinking-request.js';

type ProviderOptions = Record<string, Record<string, JSONValue | undefined>>;

export interface ProviderThinkingOptions {
  optionsKey: string;
  options: Record<string, JSONValue>;
  controlKeys: ReadonlySet<string>;
}

export function providerThinkingOptions(
  routedModelId: string,
  level: ThinkingLevelSetting | undefined,
): ProviderThinkingOptions | undefined {
  const format = thinkingRequestFormatFor(routedModelId);
  if (!format || !level) return undefined;
  const catalogOptions = getModelReasoningOptions(routedModelId);
  const runLevel = runThinkingLevel(routedModelId, level, catalogOptions);
  const options =
    runLevel === 'off'
      ? thinkingOffOptions(format, catalogOptions)
      : thinkingOnOptions(format, requestableReasoningOptions(routedModelId, catalogOptions), runLevel);
  if (!options) return undefined;
  return { optionsKey: format.optionsKey, options, controlKeys: thinkingControlKeys(format) };
}

function thinkingOnOptions(
  format: ThinkingRequestFormat,
  requestable: readonly ModelReasoningOption[] | undefined,
  runLevel: ActiveThinkingLevel,
): Record<string, JSONValue> | undefined {
  if (!requestable?.length) return undefined;
  const sendsEffort = requestable.some(option => option.type === 'effort');
  return sendsEffort ? format.sendEffort?.(runLevel) : format.enableThinking;
}

function thinkingControlKeys(format: ThinkingRequestFormat): ReadonlySet<string> {
  const formatOptions = [format.sendEffort?.('none'), format.enableThinking, format.disableThinking];
  return new Set(formatOptions.flatMap(options => Object.keys(options ?? {})));
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
