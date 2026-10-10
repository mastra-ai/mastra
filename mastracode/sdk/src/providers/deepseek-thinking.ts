import { runCatalogThinkingLevel } from '../thinking-catalog.js';
import type { ThinkingLevelSetting } from '../thinking.js';
import type { ProviderThinkingOptions } from './provider-thinking.js';

export function deepseekThinkingOptions(
  routedModelId: string,
  level: ThinkingLevelSetting | undefined,
): ProviderThinkingOptions | undefined {
  if (!level || level === 'off') return undefined;
  const reasoningEffort = runCatalogThinkingLevel(routedModelId, level);
  if (reasoningEffort === 'off') return undefined;
  return {
    optionsKey: 'deepseek',
    options: { reasoningEffort },
    controlKeys: new Set(['thinking', 'reasoningEffort']),
  };
}
