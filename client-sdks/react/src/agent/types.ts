import type { GenerateLegacyParams } from '@mastra/client-js';
import type { ToolsInput } from '@mastra/core/agent';

export type ClientToolsInput = ToolsInput;
export type ProviderOptionsInput = GenerateLegacyParams['providerOptions'];

export interface ModelSettings {
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxRetries?: number;
  maxSteps?: number;
  maxTokens?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  instructions?: string;
  providerOptions?: ProviderOptionsInput;
  chatWithGenerate?: boolean;
  chatWithStream?: boolean;
  chatWithNetwork?: boolean;
  requireToolApproval?: boolean;
}
