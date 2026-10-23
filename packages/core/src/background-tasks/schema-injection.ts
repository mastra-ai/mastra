import { z } from 'zod/v4';

/**
 * JSON Schema definition for the `_background` override field.
 * Injected into background-eligible tool schemas so the LLM can override behavior per-call.
 */
export const backgroundOverrideJsonSchema = {
  type: 'object' as const,
  description:
    'Optional: override how this specific call executes (foreground, deferred, or awaited). ' +
    "When omitted, the tool's configured default disposition applies. " +
    'The enabled boolean remains supported for compatibility.',
  properties: {
    enabled: {
      type: 'boolean' as const,
      description: 'Force deferred (true) or foreground (false) execution for this call.',
    },
    disposition: {
      type: 'string' as const,
      enum: ['foreground', 'deferred', 'awaited'],
      description: 'Choose foreground, deferred, or awaited execution for this call.',
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
    enabled: z.boolean().optional().describe('Force deferred (true) or foreground (false) execution for this call.'),
    disposition: z
      .enum(['foreground', 'deferred', 'awaited'])
      .optional()
      .describe('Choose foreground, deferred, or awaited execution for this call.'),
    timeoutMs: z.number().optional().describe('Override timeout in milliseconds for this call.'),
    maxRetries: z.number().optional().describe('Override maximum retry attempts for this call.'),
  })
  .optional()
  .describe(
    "Optional: override how this specific call executes (foreground, deferred, or awaited). When omitted, the tool's configured default disposition applies. The enabled boolean remains supported for compatibility.",
  );
