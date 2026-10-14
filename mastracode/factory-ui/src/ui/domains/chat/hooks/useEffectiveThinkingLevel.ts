import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';

import { useThinkingConfigQuery } from '../../../../hooks/use-thinking';
import { useModelReasoningOptions } from '../../../../hooks/useAvailableModels';
import { resolveEffectiveThinkingLevel } from '../services/thinkingLevels';
import type { EffectiveThinkingLevel } from '../services/thinkingLevels';

export function useEffectiveThinkingLevel(
  modelId: string | undefined,
  override: ThinkingLevelSetting | undefined,
  factoryProjectId?: string,
): { level: EffectiveThinkingLevel | undefined; loadError: Error | undefined } {
  const thinkingConfigQuery = useThinkingConfigQuery();
  const reasoningOptions = useModelReasoningOptions(modelId, { factoryProjectId });
  const level = resolveEffectiveThinkingLevel({
    modelId,
    reasoningOptions,
    override,
    globalDefault: thinkingConfigQuery.data?.globalDefault,
  });
  const loadError = thinkingConfigQuery.error ?? undefined;
  return { level, loadError: level ? undefined : loadError };
}
