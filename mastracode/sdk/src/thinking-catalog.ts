import { getModelReasoningOptions } from '@mastra/core/llm';
import { getAvailableThinkingLevelsForModel, runThinkingLevel } from './thinking.js';
import type { ThinkingLevelSetting } from './thinking.js';

export function runCatalogThinkingLevel(modelId: string, level: ThinkingLevelSetting): ThinkingLevelSetting {
  return runThinkingLevel(modelId, level, getModelReasoningOptions(modelId));
}

export function getCatalogThinkingLevels(modelId: string): ThinkingLevelSetting[] {
  return getAvailableThinkingLevelsForModel(modelId, getModelReasoningOptions(modelId));
}
