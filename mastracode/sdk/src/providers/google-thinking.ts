/** Wraps the Gemini thinking config from core in AI SDK middleware. */

import { resolveGoogleThinkingConfig } from '@mastra/core/llm/reasoning';
import type { ThinkingLevelSetting } from '@mastra/core/llm/reasoning';
import type { LanguageModelMiddleware } from 'ai';

export { resolveGoogleThinkingConfig, runGeminiThinkingLevel } from '@mastra/core/llm/reasoning';

/**
 * Create middleware that injects the resolved config into
 * `providerOptions.google.thinkingConfig`. Returns `undefined` when there is
 * nothing to inject, so callers wrap nothing.
 */
export function createGoogleThinkingMiddleware(
  modelId: string,
  level: ThinkingLevelSetting | undefined,
): LanguageModelMiddleware | undefined {
  const config = resolveGoogleThinkingConfig(modelId, level);
  if (!config) return undefined;

  return {
    specificationVersion: 'v4',
    transformParams: async ({ params }) => {
      const google = (params.providerOptions?.google ?? {}) as Record<string, unknown>;
      const thinkingConfig = (google.thinkingConfig ?? {}) as Record<string, unknown>;
      // Explicit caller settings win; Google rejects budget and level together.
      if (thinkingConfig.thinkingBudget !== undefined || thinkingConfig.thinkingLevel !== undefined) return params;
      params.providerOptions = {
        ...params.providerOptions,
        google: { ...google, thinkingConfig: { ...thinkingConfig, ...config } },
      } as typeof params.providerOptions;
      return params;
    },
  };
}
