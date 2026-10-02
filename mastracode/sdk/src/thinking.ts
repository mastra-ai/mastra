import { normalizeAnthropicModelId, stripMastraGatewayPrefix } from './providers/model-ids.js';

export type ThinkingLevelSetting = 'off' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type ThinkingLevelSource = 'mode-default' | 'global';

export interface ThinkingDefaults {
  globalDefault: ThinkingLevelSetting;
  modeDefaults: Readonly<Record<string, ThinkingLevelSetting>>;
}

export const THINKING_LEVEL_VALUES: ThinkingLevelSetting[] = ['off', 'low', 'medium', 'high', 'xhigh', 'max'];

export const THINK_COMMAND_DESCRIPTOR = {
  name: 'think',
  args: '[status|default|off|low|medium|high|xhigh|max]',
  description: 'Show or set session thinking level',
};

export type ThinkCommandAction =
  | { kind: 'status' }
  | { kind: 'clear' }
  | { kind: 'set'; level: ThinkingLevelSetting }
  | { kind: 'invalid'; value: string; levels: readonly ThinkingLevelSetting[] };

const GPT_VERSION_RE = /^gpt-(\d+)(?:\.(\d+))?/;
const OPENAI_NO_REASONING_RE = /^chatgpt-/;
const OPENAI_LOW_HIGH_REASONING_RE = /^(?:o\d|codex-|gpt-oss)/;

const ANTHROPIC_XHIGH_EFFORT_RE = /claude-(?:opus-4-[78]|opus-5|sonnet-5|fable-5)/;
const ANTHROPIC_ADAPTIVE_THINKING_RE = /claude-(?:sonnet-4-6|opus-4-[678]|opus-5|sonnet-5|fable-5)/;
const ANTHROPIC_BUDGET_THINKING_RE = /claude-(?:3-7|sonnet-4|opus-4|haiku-4-5)/;
const ANTHROPIC_NO_THINKING_RE = /claude-(?:instant|v?2(?:[-.:]|$)|3(?:[-.]|$)|3-5)/;

const GEMINI_THINKING_LEVEL_RE = /^gemini-\d/;

export type AnthropicThinkingCapability = 'adaptive' | 'budget' | 'none';

export type GoogleThinkingFamily = 'budget' | 'low-high' | 'minimal-high' | 'level' | 'none';

export function isThinkingLevelSetting(value: unknown): value is ThinkingLevelSetting {
  return typeof value === 'string' && THINKING_LEVEL_VALUES.some(level => level === value);
}

export function getAnthropicThinkingCapability(modelId: string): AnthropicThinkingCapability {
  if (ANTHROPIC_ADAPTIVE_THINKING_RE.test(modelId)) return 'adaptive';
  if (ANTHROPIC_BUDGET_THINKING_RE.test(modelId)) return 'budget';
  if (ANTHROPIC_NO_THINKING_RE.test(modelId)) return 'none';
  // Unknown (i.e. newer) Claude models: assume the current API surface.
  return 'adaptive';
}

export function getGoogleThinkingFamily(modelId: string): GoogleThinkingFamily {
  const id = modelId.toLowerCase();
  if (id.startsWith('gemini-2.5')) return 'budget';
  // Only Gemini 3 Pro lacks `medium`; Gemini 3.1 Pro accepts it.
  if (id.startsWith('gemini-3-pro')) return 'low-high';
  if (id.startsWith('gemini-3.1-flash-image') || id.startsWith('gemini-3.1-flash-lite-image')) return 'minimal-high';
  if (GEMINI_THINKING_LEVEL_RE.test(id) && !id.startsWith('gemini-1') && !id.startsWith('gemini-2')) return 'level';
  return 'none';
}

export function resolveAnthropicThinkingLevel(modelId: string, level: ThinkingLevelSetting): ThinkingLevelSetting {
  const capability = getAnthropicThinkingCapability(modelId);
  if (capability === 'none') return 'off';
  // Budget-era models spend the same token budget on xhigh and max.
  if (capability === 'budget') return level === 'max' ? 'xhigh' : level;
  return level === 'xhigh' && !ANTHROPIC_XHIGH_EFFORT_RE.test(modelId) ? 'high' : level;
}

export function resolveGoogleThinkingLevel(modelId: string, level: ThinkingLevelSetting): ThinkingLevelSetting {
  const family = getGoogleThinkingFamily(modelId);
  if (family === 'none' || level === 'off') return 'off';
  const capped = level === 'xhigh' || level === 'max' ? 'high' : level;
  if (family === 'low-high' || family === 'minimal-high') return capped === 'low' ? 'low' : 'high';
  return capped;
}

function capAtHigh(level: ThinkingLevelSetting): ThinkingLevelSetting {
  return level === 'xhigh' || level === 'max' ? 'high' : level;
}

export function resolveOpenAIThinkingLevel(modelId: string, level: ThinkingLevelSetting): ThinkingLevelSetting {
  if (level === 'off' || OPENAI_NO_REASONING_RE.test(modelId)) return 'off';
  if (OPENAI_LOW_HIGH_REASONING_RE.test(modelId)) return capAtHigh(level);
  const version = GPT_VERSION_RE.exec(modelId);
  if (!version) return level === 'max' ? 'xhigh' : level;
  const major = Number(version[1]);
  const minor = Number(version[2] ?? 0);
  if (major < 5 || modelId.includes('-chat')) return 'off';
  const supportsXhigh = major > 5 || minor >= 2 || modelId.includes('codex-max');
  if (!supportsXhigh) return capAtHigh(level);
  return level === 'max' && !supportsMaxReasoningEffort(modelId) ? 'xhigh' : level;
}

/**
 * The level a request for `provider/model` actually runs with, mirroring how the
 * gateway routes by provider id. Providers without thinking support in the gateway
 * receive the requested level unchanged.
 */
export function resolveThinkingLevelForModel(modelId: string, level: ThinkingLevelSetting): ThinkingLevelSetting {
  const routedModelId = stripMastraGatewayPrefix(modelId);
  const separatorIndex = routedModelId.indexOf('/');
  if (separatorIndex === -1) return level;
  const providerId = routedModelId.slice(0, separatorIndex);
  const providerModelId = routedModelId.slice(separatorIndex + 1);
  if (providerId === 'anthropic')
    return resolveAnthropicThinkingLevel(normalizeAnthropicModelId(providerModelId), level);
  if (providerId === 'google') return resolveGoogleThinkingLevel(providerModelId, level);
  if (providerId === 'openai') return resolveOpenAIThinkingLevel(providerModelId, level);
  return level;
}

export function supportsMaxReasoningEffort(modelId: string): boolean {
  const bareModelId = modelId.startsWith('openai/') ? modelId.slice('openai/'.length) : modelId;
  const match = GPT_VERSION_RE.exec(bareModelId);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2] ?? 0);
  return major > 5 || (major === 5 && minor >= 6);
}

/** Levels that run as themselves on `modelId`; only `off` means the model cannot think. */
export function getAvailableThinkingLevelsForModel(modelId: string): ThinkingLevelSetting[] {
  return THINKING_LEVEL_VALUES.filter(level => resolveThinkingLevelForModel(modelId, level) === level);
}

export function parseThinkCommand(
  input: string,
  levels: readonly ThinkingLevelSetting[] = THINKING_LEVEL_VALUES,
): ThinkCommandAction {
  const value = input.trim().toLowerCase();
  if (!value || value === 'status') return { kind: 'status' };
  if (value === 'default' || value === 'clear') return { kind: 'clear' };
  const level = levels.find(candidate => candidate === value);
  return level ? { kind: 'set', level } : { kind: 'invalid', value, levels };
}

export function resolveDefaultThinkingLevel(
  defaults: ThinkingDefaults,
  mode?: string | null,
): { level: ThinkingLevelSetting; source: ThinkingLevelSource } {
  const modeLevel = mode ? defaults.modeDefaults[mode] : undefined;
  return modeLevel ? { level: modeLevel, source: 'mode-default' } : { level: defaults.globalDefault, source: 'global' };
}
