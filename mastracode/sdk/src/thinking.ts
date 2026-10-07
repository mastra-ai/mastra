import type { ModelReasoningOption } from '@mastra/core/llm';
import {
  ANTHROPIC_THINKING_BUDGET_TOKENS,
  getAnthropicThinkingCapability,
  supportsAnthropicXhighEffort,
} from './providers/anthropic-thinking.js';
import { runGeminiThinkingLevel } from './providers/google-thinking.js';
import { normalizeAnthropicModelId, stripMastraGatewayPrefix } from './providers/model-ids.js';

export type ThinkingLevelSetting = 'off' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type ActiveThinkingLevel = Exclude<ThinkingLevelSetting, 'off'>;

export type ThinkingLevelSource = 'mode-default' | 'global';

export interface ThinkingDefaults {
  globalDefault: ThinkingLevelSetting;
  modeDefaults: Readonly<Record<string, ThinkingLevelSetting>>;
}

export const THINKING_LEVEL_VALUES: ThinkingLevelSetting[] = ['off', 'low', 'medium', 'high', 'xhigh', 'max'];

const ACTIVE_THINKING_LEVELS: ActiveThinkingLevel[] = ['low', 'medium', 'high', 'xhigh', 'max'];

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

function splitProvider(modelId: string): { provider: string; bareModelId: string } {
  const routedModelId = stripMastraGatewayPrefix(modelId);
  const slash = routedModelId.indexOf('/');
  if (slash === -1) return { provider: '', bareModelId: routedModelId };
  return { provider: routedModelId.slice(0, slash), bareModelId: routedModelId.slice(slash + 1) };
}

function offeredEffortLevels(reasoningOptions: readonly ModelReasoningOption[] | undefined): ActiveThinkingLevel[] {
  const effortValues = reasoningOptions?.flatMap(option => (option.type === 'effort' ? option.values : [])) ?? [];
  return ACTIVE_THINKING_LEVELS.filter(level => effortValues.includes(level));
}

function closestOfferedEffort(
  level: ActiveThinkingLevel,
  reasoningOptions: readonly ModelReasoningOption[] | undefined,
): ActiveThinkingLevel | undefined {
  const offered = offeredEffortLevels(reasoningOptions);
  const requestedRank = ACTIVE_THINKING_LEVELS.indexOf(level);
  const atOrBelow = offered.filter(candidate => ACTIVE_THINKING_LEVELS.indexOf(candidate) <= requestedRank);
  return atOrBelow.at(-1) ?? offered[0];
}

function lowestLevelWithSameBudget(level: ActiveThinkingLevel): ActiveThinkingLevel {
  const budget = ANTHROPIC_THINKING_BUDGET_TOKENS[level];
  return ACTIVE_THINKING_LEVELS.find(candidate => ANTHROPIC_THINKING_BUDGET_TOKENS[candidate] === budget) ?? level;
}

function runAnthropicThinkingLevel(
  modelId: string,
  level: ActiveThinkingLevel,
  reasoningOptions: readonly ModelReasoningOption[] | undefined,
): ThinkingLevelSetting {
  const capability = getAnthropicThinkingCapability(modelId);
  if (capability === 'none') return 'off';
  if (capability === 'budget') return lowestLevelWithSameBudget(level);
  const offeredEffort = closestOfferedEffort(level, reasoningOptions);
  if (offeredEffort) return offeredEffort;
  return level === 'xhigh' && !supportsAnthropicXhighEffort(modelId) ? 'high' : level;
}

function runOpenAIThinkingLevel(
  modelId: string,
  level: ActiveThinkingLevel,
  reasoningOptions: readonly ModelReasoningOption[] | undefined,
): ActiveThinkingLevel {
  const offeredEffort = closestOfferedEffort(level, reasoningOptions);
  if (offeredEffort) return offeredEffort;
  return level === 'max' && !supportsMaxReasoningEffort(modelId) ? 'xhigh' : level;
}

export function runThinkingLevel(
  modelId: string,
  level: ThinkingLevelSetting,
  reasoningOptions: readonly ModelReasoningOption[] | undefined,
): ThinkingLevelSetting {
  if (level === 'off') return 'off';
  const { provider, bareModelId } = splitProvider(modelId);
  if (provider === 'google') return runGeminiThinkingLevel(bareModelId, level);
  if (provider === 'anthropic') {
    return runAnthropicThinkingLevel(normalizeAnthropicModelId(bareModelId), level, reasoningOptions);
  }
  const listedWithoutReasoningControls = reasoningOptions?.length === 0;
  if (listedWithoutReasoningControls) return 'off';
  if (provider === 'openai') return runOpenAIThinkingLevel(bareModelId, level, reasoningOptions);
  return closestOfferedEffort(level, reasoningOptions) ?? level;
}

export function getAvailableThinkingLevelsForModel(
  modelId: string,
  reasoningOptions?: readonly ModelReasoningOption[],
): ThinkingLevelSetting[] {
  return THINKING_LEVEL_VALUES.filter(level => runThinkingLevel(modelId, level, reasoningOptions) === level);
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
