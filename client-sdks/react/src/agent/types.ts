import type {
  GenerateLegacyParams,
  VersionOverrides as ClientVersionOverrides,
  VersionSelector as ClientVersionSelector,
} from '@mastra/client-js';
import type { ToolsInput } from '@mastra/core/agent';

export type ClientToolsInput = ToolsInput;
export type ProviderOptionsInput = GenerateLegacyParams['providerOptions'];
export type VersionOverrides = ClientVersionOverrides;
export type VersionSelector = ClientVersionSelector;

/** Public, execution-scoped version identity derived from trusted server resolution metadata. */
export interface AgentRunVersionIdentity {
  requested: VersionSelector;
  resolvedVersionId: string;
}

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
