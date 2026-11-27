import type { JSONValue } from 'ai';
import type { ThinkingLevelSetting } from '../thinking.js';
import { anthropicThinkingOptions } from './claude-max.js';
import { resolveGoogleThinkingConfig } from './google-thinking.js';
import { stripMastraGatewayPrefix } from './model-ids.js';
import { getEffectiveThinkingLevel, THINKING_LEVEL_TO_REASONING_EFFORT } from './openai-codex.js';
import { providerThinkingOptions } from './provider-thinking.js';

export type ThinkingProviderOptions = Record<string, Record<string, JSONValue>>;

/**
 * The `providerOptions` that ask a model for a thinking level, for hosts that pass thinking per request instead of
 * wrapping the model (e.g. a stream's `providerOptions`). Covers the same providers as the MastraCode model adapters.
 * Returns `undefined` when the level is unset or `off`, or the model doesn't think.
 */
export function thinkingProviderOptions(
  modelId: string,
  level: ThinkingLevelSetting | undefined,
): ThinkingProviderOptions | undefined {
  if (!level || level === 'off') return undefined;
  const bare = stripMastraGatewayPrefix(modelId);
  const slash = bare.indexOf('/');
  const provider = slash === -1 ? '' : bare.slice(0, slash);
  const model = bare.slice(slash + 1);

  if (provider === 'anthropic') {
    const anthropic = anthropicThinkingOptions(model, level);
    return anthropic && { anthropic };
  }
  if (provider === 'openai') {
    const reasoningEffort = THINKING_LEVEL_TO_REASONING_EFFORT[getEffectiveThinkingLevel(model, level)];
    return reasoningEffort ? { openai: { reasoningEffort } } : undefined;
  }
  if (provider === 'google') {
    const thinkingConfig = resolveGoogleThinkingConfig(model, level);
    return thinkingConfig && { google: { thinkingConfig: { ...thinkingConfig } } };
  }
  const routed = providerThinkingOptions(modelId, level);
  return routed && { [routed.optionsKey]: routed.options };
}
