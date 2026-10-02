import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';

import { clampThinkingLevel } from '../../settings/services/thinkingLevels';

export interface ModelSwitch {
  modelId?: string;
  thinkingLevel?: ThinkingLevelSetting;
}

export interface ModelSelection {
  modelId: string | undefined;
  thinkingLevel: ThinkingLevelSetting | undefined;
}

export function planModelSwitch(current: ModelSelection, requested: ModelSwitch): ModelSwitch {
  const modelId = requested.modelId ?? current.modelId;
  const wantedLevel = requested.thinkingLevel ?? current.thinkingLevel;
  const thinkingLevel = modelId && wantedLevel ? clampThinkingLevel(modelId, wantedLevel) : wantedLevel;
  const thinkingChanged = requested.thinkingLevel !== undefined || thinkingLevel !== current.thinkingLevel;
  return {
    modelId: modelId !== current.modelId ? modelId : undefined,
    thinkingLevel: thinkingChanged ? thinkingLevel : undefined,
  };
}
