import type { AgentBackgroundConfig, ToolBackgroundConfig } from './types';

/**
 * Determines if a tool is background-eligible based on tool and agent config.
 */
export function isBackgroundEligible(
  toolName: string,
  toolConfig?: ToolBackgroundConfig,
  agentConfig?: AgentBackgroundConfig,
): boolean {
  // Agent config takes priority
  if (agentConfig?.tools) {
    if (agentConfig.tools === 'all') return true;
    const entry = agentConfig.tools[toolName];
    if (entry !== undefined) {
      return typeof entry === 'boolean' ? entry : entry.enabled;
    }
  }

  // Fall back to tool config
  return toolConfig?.enabled ?? false;
}

/**
 * JSON Schema definition for the `_background` override field.
 * Injected into background-eligible tool schemas so the LLM can override behavior per-call.
 */
export const backgroundOverrideJsonSchema = {
  type: 'object' as const,
  description:
    'Optional: override background execution behavior for this specific call. ' +
    'Set enabled=false to force foreground, enabled=true to force background. ' +
    'Omit entirely to use the default configuration.',
  properties: {
    enabled: {
      type: 'boolean' as const,
      description: 'Force background (true) or foreground (false) execution for this call.',
    },
    timeoutMs: {
      type: 'number' as const,
      description: 'Override timeout in milliseconds for this call.',
    },
    maxRetries: {
      type: 'number' as const,
      description: 'Override maximum retry attempts for this call.',
    },
  },
  additionalProperties: false,
};

/**
 * Injects the `_background` property into a tool's JSON Schema parameters.
 * Returns a new schema object — does not mutate the input.
 *
 * Only injects if the tool is background-eligible.
 */
export function injectBackgroundSchema(
  toolName: string,
  parametersJsonSchema: Record<string, unknown>,
  toolConfig?: ToolBackgroundConfig,
  agentConfig?: AgentBackgroundConfig,
): Record<string, unknown> {
  if (!isBackgroundEligible(toolName, toolConfig, agentConfig)) {
    return parametersJsonSchema;
  }

  // Only inject into object schemas with properties
  if (parametersJsonSchema.type !== 'object' || !parametersJsonSchema.properties) {
    return parametersJsonSchema;
  }

  return {
    ...parametersJsonSchema,
    properties: {
      ...(parametersJsonSchema.properties as Record<string, unknown>),
      _background: backgroundOverrideJsonSchema,
    },
  };
}
