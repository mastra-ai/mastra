import { modelSupportsStructuredOutput } from '../llm/model/provider-registry';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { StructuredOutputOptions } from './types';

type JsonPromptInjection = StructuredOutputOptions<unknown>['jsonPromptInjection'];
type ResolvedJsonPromptInjection = Exclude<JsonPromptInjection, 'auto'>;

export function resolveJsonPromptInjection(
  value: JsonPromptInjection,
  capability: boolean | undefined,
): ResolvedJsonPromptInjection {
  if (value !== 'auto') return value;
  return capability === true ? undefined : 'inline';
}

export function resolveJsonPromptInjectionForModel(
  value: JsonPromptInjection,
  model: MastraLanguageModel,
): ResolvedJsonPromptInjection {
  if (value !== 'auto') return value;

  const modelRoute = `${model.provider.split('.')[0]}/${model.modelId}`;
  return resolveJsonPromptInjection(value, modelSupportsStructuredOutput(modelRoute));
}
