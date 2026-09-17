import type { LLMStepResult } from '@mastra/core/agent';

export interface ModelSettingsValues {
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxRetries?: number;
  maxSteps?: number;
  maxTokens?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  seed?: number;
  providerOptions?: LLMStepResult['providerMetadata'];
}
