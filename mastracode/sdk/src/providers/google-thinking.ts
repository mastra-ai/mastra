/**
 * Google (Gemini) thinking-level middleware.
 *
 * The Mastra Code session thinking level (`off|low|medium|high|xhigh|max`) is
 * broader than Google's `thinkingLevel`, which for Gemini 3+ accepts
 * `minimal|low|medium|high`. This middleware maps the session level onto
 * Google's scale and injects
 * `providerOptions.google.thinkingConfig.thinkingLevel` before the request is
 * sent, mirroring how the Anthropic/Codex middlewares forward their own
 * reasoning controls.
 */

import type { LanguageModelMiddleware } from 'ai';
import type { ThinkingLevelSetting } from '../thinking.js';

type GoogleThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

/**
 * Map a session thinking level to Google's `thinkingLevel`.
 *
 * Returns `undefined` for `off` (thinking omitted). Levels above Google's
 * `high` (`xhigh`, `max`) clamp down to `high`, its deepest supported setting.
 */
export function thinkingLevelToGoogleThinkingLevel(level: ThinkingLevelSetting): GoogleThinkingLevel | undefined {
  switch (level) {
    case 'off':
      return undefined;
    case 'low':
      return 'low';
    case 'medium':
      return 'medium';
    case 'high':
    case 'xhigh':
    case 'max':
      return 'high';
  }
}

/**
 * Create middleware that forwards the session thinking level to Google as
 * `providerOptions.google.thinkingConfig.thinkingLevel`.
 *
 * Returns `undefined` when the level is unset or maps to no thinking (`off`),
 * so callers wrap nothing and the request carries no thinking config.
 */
export function createGoogleThinkingMiddleware(
  level: ThinkingLevelSetting | undefined,
): LanguageModelMiddleware | undefined {
  if (!level) return undefined;
  const thinkingLevel = thinkingLevelToGoogleThinkingLevel(level);
  if (!thinkingLevel) return undefined;

  return {
    specificationVersion: 'v3',
    transformParams: async ({ params }) => {
      const google = (params.providerOptions?.google ?? {}) as Record<string, unknown>;
      const thinkingConfig = (google.thinkingConfig ?? {}) as Record<string, unknown>;
      params.providerOptions = {
        ...params.providerOptions,
        google: {
          ...google,
          thinkingConfig: {
            ...thinkingConfig,
            thinkingLevel,
          },
        },
      } as typeof params.providerOptions;

      return params;
    },
  };
}
