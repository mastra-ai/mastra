import { z } from 'zod/v4';

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

export const backgroundOverrideZodSchema = z
  .object({
    enabled: z.boolean().optional().describe('Force background (true) or foreground (false) execution for this call.'),
    timeoutMs: z.number().optional().describe('Override timeout in milliseconds for this call.'),
    maxRetries: z.number().optional().describe('Override maximum retry attempts for this call.'),
  })
  .optional()
  .describe(
    'Optional: override background execution behavior for this specific call. Set enabled=false to force foreground, enabled=true to force background. Omit entirely to use the default configuration.',
  );
