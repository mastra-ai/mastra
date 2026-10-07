import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';

import { useThinkingConfigQuery } from '../../../../hooks/use-thinking';
import { useChatModes } from '../context/useChatModes';
import { resolveEffectiveThinkingLevel } from '../services/thinkingLevels';

export function useEffectiveThinkingLevel(
  modelId: string | undefined,
  override: ThinkingLevelSetting | undefined,
): ThinkingLevelSetting | undefined {
  const { activeModeId } = useChatModes();
  const { data: thinkingDefaults } = useThinkingConfigQuery();
  return resolveEffectiveThinkingLevel({ modelId, override, defaults: thinkingDefaults, modeId: activeModeId });
}
