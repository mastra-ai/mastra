import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';

import { useModelReasoningOptions } from '../../../../hooks/useAvailableModels';
import { resolveEffectiveThinkingLevel } from '../services/thinkingLevels';
import type { EffectiveThinkingLevel } from '../services/thinkingLevels';

export function useEffectiveThinkingLevel(
  modelId: string | undefined,
  override: ThinkingLevelSetting | undefined,
  defaultLevel: ThinkingLevelSetting | undefined,
): EffectiveThinkingLevel | undefined {
  const reasoningOptions = useModelReasoningOptions(modelId);
  return resolveEffectiveThinkingLevel({ modelId, reasoningOptions, override, defaultLevel });
}
