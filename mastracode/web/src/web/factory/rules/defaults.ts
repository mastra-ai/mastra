import { assertFactoryRules, FactoryRuleValidationError } from './validation.js';
import type {
  FactoryBoardRuleLeaf,
  FactoryBoardRules,
  FactoryGithubRuleLeaf,
  FactoryGithubEventName,
  FactoryRules,
  FactoryRulesOverrides,
  FactoryRuleSource,
  FactoryRuleStage,
  FactoryToolRuleLeaf,
} from './types.js';

export const DEFAULT_FACTORY_RULE_VERSION = 'factory-default-v1';

const PASS_THROUGH_DEFAULTS: FactoryRulesOverrides = {};

function mergeBoardRules(
  base: FactoryBoardRules | undefined,
  overrides: FactoryBoardRules | undefined,
): FactoryBoardRules {
  const result: FactoryBoardRules = {};
  const stages = new Set([...Object.keys(base ?? {}), ...Object.keys(overrides ?? {})]) as Set<FactoryRuleStage>;
  for (const stage of stages) {
    const baseSources = base?.[stage];
    const overrideSources = overrides?.[stage];
    const sources = new Set([
      ...Object.keys(baseSources ?? {}),
      ...Object.keys(overrideSources ?? {}),
    ]) as Set<FactoryRuleSource>;
    const mergedSources: Partial<Record<FactoryRuleSource, FactoryBoardRuleLeaf>> = {};
    for (const source of sources) {
      const baseLeaf = baseSources?.[source];
      const overrideLeaf = overrideSources?.[source];
      mergedSources[source] = {
        ...(baseLeaf?.onEnter ? { onEnter: baseLeaf.onEnter } : {}),
        ...(baseLeaf?.onExit ? { onExit: baseLeaf.onExit } : {}),
        ...(overrideLeaf && 'onEnter' in overrideLeaf ? { onEnter: overrideLeaf.onEnter } : {}),
        ...(overrideLeaf && 'onExit' in overrideLeaf ? { onExit: overrideLeaf.onExit } : {}),
      };
    }
    result[stage] = mergedSources;
  }
  return result;
}

function mergeToolRules(
  base: Record<string, FactoryToolRuleLeaf> | undefined,
  overrides: Record<string, FactoryToolRuleLeaf> | undefined,
): Record<string, FactoryToolRuleLeaf> {
  const result: Record<string, FactoryToolRuleLeaf> = {};
  for (const name of new Set([...Object.keys(base ?? {}), ...Object.keys(overrides ?? {})])) {
    const baseLeaf = base?.[name];
    const overrideLeaf = overrides?.[name];
    result[name] = {
      ...(baseLeaf?.onResult ? { onResult: baseLeaf.onResult } : {}),
      ...(overrideLeaf && 'onResult' in overrideLeaf ? { onResult: overrideLeaf.onResult } : {}),
    };
  }
  return result;
}

function mergeGithubRules(
  base: FactoryRulesOverrides['github'],
  overrides: FactoryRulesOverrides['github'],
): NonNullable<FactoryRulesOverrides['github']> {
  const result: Partial<Record<FactoryGithubEventName, FactoryGithubRuleLeaf>> = {};
  const events = new Set([...Object.keys(base ?? {}), ...Object.keys(overrides ?? {})]) as Set<FactoryGithubEventName>;
  for (const event of events) {
    const baseLeaf = base?.[event];
    const overrideLeaf = overrides?.[event];
    result[event] = {
      ...(baseLeaf?.onEvent ? { onEvent: baseLeaf.onEvent } : {}),
      ...(overrideLeaf && 'onEvent' in overrideLeaf ? { onEvent: overrideLeaf.onEvent } : {}),
    };
  }
  return result;
}

export function mergeFactoryRuleOverrides(
  base: FactoryRulesOverrides,
  overrides: FactoryRulesOverrides = {},
): Omit<FactoryRules, 'version'> {
  return {
    work: mergeBoardRules(base.work, overrides.work),
    review: mergeBoardRules(base.review, overrides.review),
    tools: mergeToolRules(base.tools, overrides.tools),
    github: mergeGithubRules(base.github, overrides.github),
  };
}

export function defaultFactoryRules(input: { version: string; overrides?: FactoryRulesOverrides }): FactoryRules {
  if (typeof input?.version !== 'string' || input.version.trim().length === 0) {
    throw new FactoryRuleValidationError('Factory rule version is required.');
  }

  const rules: FactoryRules = {
    version: input.version.trim(),
    ...mergeFactoryRuleOverrides(PASS_THROUGH_DEFAULTS, input.overrides),
  };
  assertFactoryRules(rules);
  return rules;
}

export function builtInFactoryRules(): FactoryRules {
  return defaultFactoryRules({ version: DEFAULT_FACTORY_RULE_VERSION });
}
