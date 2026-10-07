import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';

import { useThinkingConfigQuery } from '../../../../hooks/use-thinking';
import { useModelReasoningOptions } from '../../../../hooks/useAvailableModels';
import { useChatModes } from '../context/useChatModes';
import { resolveEffectiveThinkingLevel } from '../services/thinkingLevels';

export function useEffectiveThinkingLevel(
  modelId: string | undefined,
  override: ThinkingLevelSetting | undefined,
): ThinkingLevelSetting | undefined {
  const { activeModeId } = useChatModes();
  const { data: thinkingDefaults } = useThinkingConfigQuery();
  const reasoningOptions = useModelReasoningOptions(modelId);
  return resolveEffectiveThinkingLevel({
    modelId,
    reasoningOptions,
    override,
    defaults: thinkingDefaults,
    modeId: activeModeId,
  });
}
