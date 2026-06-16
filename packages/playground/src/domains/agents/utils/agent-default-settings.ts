import type { AgentSettingsType, ModelSettings } from '@/types';

type AgentDefaultOptions = {
  maxSteps?: number;
  // Code-defined defaults share the UI `ModelSettings` shape, except the model
  // size is the AI SDK v5 `maxOutputTokens` (mapped to `maxTokens` below).
  modelSettings?: Partial<ModelSettings> & { maxOutputTokens?: number };
  providerOptions?: ModelSettings['providerOptions'];
};

/**
 * Maps an agent's code-defined `defaultOptions` to the playground settings shape.
 * Single source of defaults for every chat surface (chat page, session view,
 * editor test chat) so they can't drift apart.
 */
export function buildAgentDefaultSettings(agent: { defaultOptions?: unknown } | null | undefined): AgentSettingsType {
  if (!agent) {
    return { modelSettings: {} };
  }

  const agentDefaultOptions = agent.defaultOptions as AgentDefaultOptions | undefined;

  // Map AI SDK v5 names back to UI names (maxOutputTokens -> maxTokens)
  const { maxOutputTokens, ...restModelSettings } = agentDefaultOptions?.modelSettings ?? {};

  return {
    modelSettings: {
      ...restModelSettings,
      // Only include properties if they have actual values (to not override fallback defaults)
      ...(maxOutputTokens !== undefined && { maxTokens: maxOutputTokens }),
      ...(agentDefaultOptions?.maxSteps !== undefined && { maxSteps: agentDefaultOptions.maxSteps }),
      ...(agentDefaultOptions?.providerOptions !== undefined && {
        providerOptions: agentDefaultOptions.providerOptions,
      }),
    },
  };
}
