import type { JSONValue, LanguageModelMiddleware } from 'ai';
import { runCatalogThinkingLevel } from '../thinking-catalog.js';
import type { ThinkingLevelSetting } from '../thinking.js';

type ThinkingProviderOptions = Record<string, JSONValue>;

function deepSeekThinkingOptions(runLevel: ThinkingLevelSetting): ThinkingProviderOptions {
  if (runLevel === 'off') return { thinking: { type: 'disabled' } };
  return { reasoningEffort: runLevel };
}

const THINKING_OPTIONS_BY_PROVIDER: Record<string, (runLevel: ThinkingLevelSetting) => ThinkingProviderOptions> = {
  deepseek: deepSeekThinkingOptions,
};

export function createProviderThinkingMiddleware(
  providerId: string,
  modelId: string,
  level: ThinkingLevelSetting | undefined,
): LanguageModelMiddleware | undefined {
  const thinkingOptionsFor = THINKING_OPTIONS_BY_PROVIDER[providerId];
  if (!thinkingOptionsFor || !level) return undefined;
  const thinkingOptions = thinkingOptionsFor(runCatalogThinkingLevel(`${providerId}/${modelId}`, level));

  return {
    specificationVersion: 'v3',
    transformParams: async ({ params }) => {
      params.providerOptions = {
        ...params.providerOptions,
        [providerId]: { ...thinkingOptions, ...params.providerOptions?.[providerId] },
      };
      return params;
    },
  };
}
