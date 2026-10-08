import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';

import { useThinkingConfigQuery } from '../../../../hooks/use-thinking';
import { useModelReasoningOptions } from '../../../../hooks/useAvailableModels';
import { useChatModes } from '../context/useChatModes';
import { resolveEffectiveThinkingLevel } from '../services/thinkingLevels';
import type { EffectiveThinkingLevel } from '../services/thinkingLevels';

export function useEffectiveThinkingLevel(
  modelId: string | undefined,
  override: ThinkingLevelSetting | undefined,
): { level: EffectiveThinkingLevel | undefined; loadError: Error | undefined } {
  const { activeModeId } = useChatModes();
  const thinkingConfigQuery = useThinkingConfigQuery();
  const reasoningOptions = useModelReasoningOptions(modelId);
  const level = resolveEffectiveThinkingLevel({
    modelId,
    reasoningOptions,
    override,
    defaults: thinkingConfigQuery.data,
    modeId: activeModeId,
  });
  const loadError = thinkingConfigQuery.error ?? undefined;
  return { level, loadError: level ? undefined : loadError };
}
