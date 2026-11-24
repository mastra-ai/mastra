import { getModelReasoningOptions } from '@mastra/core/llm';
import { parseCodexModelSelection } from './providers/model-ids.js';
import { getAvailableThinkingLevelsForModel, runThinkingLevel } from './thinking.js';
import type { ThinkingLevelSetting } from './thinking.js';

export function runCatalogThinkingLevel(selectionId: string, level: ThinkingLevelSetting): ThinkingLevelSetting {
  const { modelId } = parseCodexModelSelection(selectionId);
  return runThinkingLevel(modelId, level, getModelReasoningOptions(modelId));
}

export function getCatalogThinkingLevels(selectionId: string): ThinkingLevelSetting[] {
  const { modelId } = parseCodexModelSelection(selectionId);
  return getAvailableThinkingLevelsForModel(modelId, getModelReasoningOptions(modelId));
}
