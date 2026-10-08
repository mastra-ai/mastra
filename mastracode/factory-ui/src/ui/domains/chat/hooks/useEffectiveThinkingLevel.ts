import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';

import { useThinkingConfigQuery } from '../../../../hooks/use-thinking';
import { useModelReasoningOptions } from '../../../../hooks/useAvailableModels';
import { useChatModes } from '../context/useChatModes';
import { resolveEffectiveThinkingLevel } from '../services/thinkingLevels';
import type { EffectiveThinkingLevel } from '../services/thinkingLevels';

export function useEffectiveThinkingLevel(
  modelId: string | undefined,
  override: ThinkingLevelSetting | undefined,
): { effective: EffectiveThinkingLevel | undefined; defaultsError: Error | undefined } {
  const { activeModeId } = useChatModes();
  const thinkingConfigQuery = useThinkingConfigQuery();
  const reasoningOptions = useModelReasoningOptions(modelId);
  const effective = resolveEffectiveThinkingLevel({
    modelId,
    reasoningOptions,
    override,
    defaults: thinkingConfigQuery.data,
    modeId: activeModeId,
  });
  return { effective, defaultsError: thinkingConfigQuery.error ?? undefined };
}
