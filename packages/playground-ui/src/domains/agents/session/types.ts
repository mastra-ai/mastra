import type { GetAgentResponse } from '@mastra/client-js';
import type { LLMStepResult } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';

export interface ModelSettings {
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
  chatWithGenerateLegacy?: boolean;
  chatWithGenerate?: boolean;
  chatWithLegacyStream?: boolean;
  chatWithNetwork?: boolean;
  requireToolApproval?: boolean;
}

export interface AgentSettingsType {
  modelSettings: ModelSettings;
}

export interface ChatProps {
  agentId: string;
  agentName?: string;
  modelVersion?: string;
  agentVersionId?: string;
  supportsMemory?: boolean;
  threadId: string;
  initialMessages?: MastraDBMessage[];
  refreshThreadList?: () => void;
  settings?: AgentSettingsType;
  requestContext?: Record<string, any>;
  onInputChange?: (value: string) => void;
  modelList?: GetAgentResponse['modelList'];
}
