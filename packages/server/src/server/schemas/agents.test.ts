import { describe, expect, it } from 'vitest';

import { agentExecutionBodySchema } from './agents';

/**
 * Regression tests for GitHub Issue #22617
 *
 * `providerOptions` was validated as a closed object listing only anthropic,
 * google, openai, and xai. Nested zod objects strip unknown keys and the outer
 * `.passthrough()` does not apply inside them, so every other provider
 * namespace (deepseek, bedrock, ...) was silently removed at the route
 * boundary before reaching the handler. In-process agent calls were
 * unaffected, which is why the same options worked via the raw client but not
 * over HTTP.
 */
describe('agentExecutionBodySchema providerOptions', () => {
  it('keeps provider namespaces beyond the previously allowlisted four', () => {
    const providerOptions = {
      deepseek: { thinking: { type: 'disabled' } },
      bedrock: { reasoningConfig: { type: 'enabled', budgetTokens: 1024 } },
      openai: { reasoningEffort: 'low' },
    };

    const result = agentExecutionBodySchema.safeParse({ messages: 'hi', providerOptions });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.providerOptions).toEqual(providerOptions);
    }
  });

  it('keeps nested option values intact for a single arbitrary namespace', () => {
    const result = agentExecutionBodySchema.safeParse({
      messages: 'hi',
      providerOptions: { groq: { serviceTier: 'flex', structuredOutputs: true } },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.providerOptions?.groq).toEqual({ serviceTier: 'flex', structuredOutputs: true });
    }
  });

  it('rejects a namespace whose value is not an object', () => {
    const result = agentExecutionBodySchema.safeParse({
      messages: 'hi',
      providerOptions: { deepseek: 'disabled' },
    });

    expect(result.success).toBe(false);
  });
});
