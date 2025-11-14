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
  providerOptions?: Record<string, unknown>;
  chatWithGenerate?: boolean;
  chatWithStream?: boolean;
  chatWithNetwork?: boolean;
  requireToolApproval?: boolean;
}
