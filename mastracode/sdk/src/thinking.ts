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

export function isThinkingLevelSetting(value: unknown): value is ThinkingLevelSetting {
  return typeof value === 'string' && THINKING_LEVEL_VALUES.some(level => level === value);
}

export function supportsMaxReasoningEffort(modelId: string): boolean {
  const bareModelId = modelId.startsWith('openai/') ? modelId.slice('openai/'.length) : modelId;
  const match = GPT_VERSION_RE.exec(bareModelId);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2] ?? 0);
  return major > 5 || (major === 5 && minor >= 6);
}

export function getAvailableThinkingLevelsForModel(modelId: string): ThinkingLevelSetting[] {
  if (!modelId.startsWith('openai/') || supportsMaxReasoningEffort(modelId)) {
    return [...THINKING_LEVEL_VALUES];
  }
  return THINKING_LEVEL_VALUES.filter(level => level !== 'max');
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
