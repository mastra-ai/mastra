import type { AgentSettingsType, ModelSettings } from '@/types';

type AgentDefaultOptions = {
  maxSteps?: number;
  // Code-defined defaults share the UI `ModelSettings` shape, except the model
  // size is the AI SDK v5 `maxOutputTokens` (mapped to `maxTokens` below).
  modelSettings?: Partial<ModelSettings> & { maxOutputTokens?: number };
  providerOptions?: ModelSettings['providerOptions'];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Narrows the untyped `defaultOptions` from the agent response into the shape we
 * consume, validating each field at runtime so a mismatched payload degrades to
 * the relevant default instead of leaking a bad value into the chat surfaces.
 */
function parseAgentDefaultOptions(value: unknown): AgentDefaultOptions {
  if (!isRecord(value)) {
    return {};
  }

  const result: AgentDefaultOptions = {};

  if (typeof value.maxSteps === 'number') {
    result.maxSteps = value.maxSteps;
  }
  if (isRecord(value.modelSettings)) {
    result.modelSettings = value.modelSettings as AgentDefaultOptions['modelSettings'];
  }
  if (isRecord(value.providerOptions)) {
    result.providerOptions = value.providerOptions as ModelSettings['providerOptions'];
  }

  return result;
}

/**
 * Maps an agent's code-defined `defaultOptions` to the playground settings shape.
 * Single source of defaults for every chat surface (chat page, session view,
 * editor test chat) so they can't drift apart.
 */
export function buildAgentDefaultSettings(agent: { defaultOptions?: unknown } | null | undefined): AgentSettingsType {
  if (!agent) {
    return { modelSettings: {} };
  }

  const agentDefaultOptions = parseAgentDefaultOptions(agent.defaultOptions);

  // Map AI SDK v5 names back to UI names (maxOutputTokens -> maxTokens)
  const { maxOutputTokens, ...restModelSettings } = agentDefaultOptions.modelSettings ?? {};

  return {
    modelSettings: {
      ...restModelSettings,
      // Only include properties if they have actual values (to not override fallback defaults)
      ...(maxOutputTokens !== undefined && { maxTokens: maxOutputTokens }),
      ...(agentDefaultOptions.maxSteps !== undefined && { maxSteps: agentDefaultOptions.maxSteps }),
      ...(agentDefaultOptions.providerOptions !== undefined && {
        providerOptions: agentDefaultOptions.providerOptions,
      }),
    },
  };
}
