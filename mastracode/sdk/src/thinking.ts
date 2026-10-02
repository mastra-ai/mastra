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
const OPENAI_MODEL_RE = /^(?:gpt-|o\d|codex-)/;
const OPENAI_LOW_HIGH_REASONING_RE = /^(?:o\d|codex-|gpt-oss)/;

const CLAUDE_MODEL_RE = /^claude-/;
const ANTHROPIC_XHIGH_EFFORT_RE = /claude-(?:opus-4-[78]|opus-5|sonnet-5|fable-5)/;
const ANTHROPIC_ADAPTIVE_THINKING_RE = /claude-(?:sonnet-4-6|opus-4-[678]|opus-5|sonnet-5|fable-5)/;
const ANTHROPIC_BUDGET_THINKING_RE = /claude-(?:3-7|sonnet-4|opus-4|haiku-4-5)/;
const ANTHROPIC_NO_THINKING_RE = /claude-(?:instant|v?2(?:[-.:]|$)|3(?:[-.]|$)|3-5)/;

const GEMINI_MODEL_RE = /^gemini-/;
const GEMINI_THINKING_LEVEL_RE = /^gemini-\d/;

export type AnthropicThinkingCapability = 'adaptive' | 'budget' | 'none';

export type GoogleThinkingFamily = 'budget' | 'low-high' | 'minimal-high' | 'level' | 'none';

export function isThinkingLevelSetting(value: unknown): value is ThinkingLevelSetting {
  return typeof value === 'string' && THINKING_LEVEL_VALUES.some(level => level === value);
}

function bareModelId(modelId: string): string {
  return modelId.slice(modelId.lastIndexOf('/') + 1);
}

export function getAnthropicThinkingCapability(modelId: string): AnthropicThinkingCapability {
  if (ANTHROPIC_ADAPTIVE_THINKING_RE.test(modelId)) return 'adaptive';
  if (ANTHROPIC_BUDGET_THINKING_RE.test(modelId)) return 'budget';
  if (ANTHROPIC_NO_THINKING_RE.test(modelId)) return 'none';
  // Unknown (i.e. newer) Claude models: assume the current API surface.
  return 'adaptive';
}

export function getGoogleThinkingFamily(modelId: string): GoogleThinkingFamily {
  const id = bareModelId(modelId).toLowerCase();
  if (id.startsWith('gemini-2.5')) return 'budget';
  // Only Gemini 3 Pro lacks `medium`; Gemini 3.1 Pro accepts it.
  if (id.startsWith('gemini-3-pro')) return 'low-high';
  if (id.startsWith('gemini-3.1-flash-image') || id.startsWith('gemini-3.1-flash-lite-image')) return 'minimal-high';
  if (GEMINI_THINKING_LEVEL_RE.test(id) && !id.startsWith('gemini-1') && !id.startsWith('gemini-2')) return 'level';
  return 'none';
}

function resolveAnthropicThinkingLevel(modelId: string, level: ThinkingLevelSetting): ThinkingLevelSetting {
  const capability = getAnthropicThinkingCapability(modelId);
  if (capability === 'none') return 'off';
  // Budget-era models spend the same token budget on xhigh and max.
  if (capability === 'budget') return level === 'max' ? 'xhigh' : level;
  return level === 'xhigh' && !ANTHROPIC_XHIGH_EFFORT_RE.test(modelId) ? 'high' : level;
}

function resolveGoogleThinkingLevel(modelId: string, level: ThinkingLevelSetting): ThinkingLevelSetting {
  const family = getGoogleThinkingFamily(modelId);
  if (family === 'none' || level === 'off') return 'off';
  const capped = level === 'xhigh' || level === 'max' ? 'high' : level;
  if (family === 'low-high' || family === 'minimal-high') return capped === 'low' ? 'low' : 'high';
  return capped;
}

function capAtHigh(level: ThinkingLevelSetting): ThinkingLevelSetting {
  return level === 'xhigh' || level === 'max' ? 'high' : level;
}

function resolveOpenAIThinkingLevel(modelId: string, level: ThinkingLevelSetting): ThinkingLevelSetting {
  if (level === 'off') return 'off';
  const version = GPT_VERSION_RE.exec(modelId);
  if (!version) return OPENAI_LOW_HIGH_REASONING_RE.test(modelId) ? capAtHigh(level) : 'off';
  const major = Number(version[1]);
  const minor = Number(version[2] ?? 0);
  if (major < 5 || modelId.includes('-chat')) return 'off';
  const supportsXhigh = major > 5 || minor >= 2 || modelId.includes('codex-max');
  if (!supportsXhigh) return capAtHigh(level);
  return level === 'max' && !supportsMaxReasoningEffort(modelId) ? 'xhigh' : level;
}

/**
 * The level a request for `modelId` actually runs with: provider middleware maps
 * requested levels the model cannot honour onto the nearest one it can.
 * Models from unrecognised providers receive the requested level unchanged.
 */
export function resolveThinkingLevelForModel(modelId: string, level: ThinkingLevelSetting): ThinkingLevelSetting {
  const bare = bareModelId(modelId);
  if (CLAUDE_MODEL_RE.test(bare)) return resolveAnthropicThinkingLevel(bare, level);
  if (GEMINI_MODEL_RE.test(bare)) return resolveGoogleThinkingLevel(bare, level);
  if (OPENAI_MODEL_RE.test(bare)) return resolveOpenAIThinkingLevel(bare, level);
  return level;
}

export function supportsMaxReasoningEffort(modelId: string): boolean {
  const match = GPT_VERSION_RE.exec(bareModelId(modelId));
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
