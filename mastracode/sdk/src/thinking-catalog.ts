import { getModelReasoningOptions } from '@mastra/core/llm';
import { stripMastraGatewayPrefix } from './providers/model-ids.js';
import { getAvailableThinkingLevelsForModel, runThinkingLevel } from './thinking.js';
import type { ThinkingLevelSetting } from './thinking.js';

const OPENAI_GPT5_WITHOUT_REASONING_OFF = /^openai\/gpt-5(?:\.|-|$)/;

export function runCatalogThinkingLevel(modelId: string, level: ThinkingLevelSetting): ThinkingLevelSetting {
  return runThinkingLevel(modelId, level, getModelReasoningOptions(modelId));
}

export function appliedThinkingLevel(modelId: string, level: ThinkingLevelSetting): ThinkingLevelSetting {
  const requested =
    level === 'off' && OPENAI_GPT5_WITHOUT_REASONING_OFF.test(stripMastraGatewayPrefix(modelId)) ? 'low' : level;
  return runCatalogThinkingLevel(modelId, requested);
}

export function getCatalogThinkingLevels(modelId: string): ThinkingLevelSetting[] {
  return getAvailableThinkingLevelsForModel(modelId, getModelReasoningOptions(modelId));
}
