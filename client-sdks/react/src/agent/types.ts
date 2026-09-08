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
  /**
   * Additional system context appended to the agent's resolved instructions.
   *
   * Unlike `instructions`, which replaces the agent's configured instructions,
   * `system` is additive: the agent keeps its own instructions and this text is
   * appended as a separate system message. Use it to send per-turn state to an
   * agent whose base prompt must be preserved.
   */
  system?: string;
  providerOptions?: ProviderOptionsInput;
  chatWithGenerate?: boolean;
  chatWithStream?: boolean;
  chatWithNetwork?: boolean;
  requireToolApproval?: boolean;
}
