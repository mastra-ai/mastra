import type {
  FactoryGithubEventName,
  FactoryGithubRuleLeaf,
  FactoryLinearEventName,
  FactoryLinearRuleLeaf,
  FactoryRuleBoard,
  FactoryRuleHandler,
  FactoryRuleSource,
  FactoryRuleStage,
  FactoryRules,
  FactoryStageRuleContext,
  FactoryToolResultRuleContext,
  FactoryToolRuleLeaf,
} from './types.js';

export interface ResolvedFactoryStageRule {
  phase: 'exit' | 'enter';
  handler: FactoryRuleHandler<FactoryStageRuleContext>;
}

export function resolveFactoryStageRules(
  rules: FactoryRules,
  input: {
    board: FactoryRuleBoard;
    source: FactoryRuleSource;
    fromStage: FactoryRuleStage;
    toStage: FactoryRuleStage;
    initialEntry?: boolean;
    reenter?: boolean;
  },
): ResolvedFactoryStageRule[] {
  if (input.fromStage === input.toStage && !input.initialEntry && !input.reenter) return [];
  const boardRules = rules[input.board];
  const resolved: ResolvedFactoryStageRule[] = [];
  // Same-stage reentry re-runs the stage's entry work; the item never left the
  // stage, so its exit rules must not fire.
  const sameStageReentry = input.fromStage === input.toStage && input.reenter === true;
  const onExit =
    input.initialEntry || sameStageReentry ? undefined : boardRules[input.fromStage]?.[input.source]?.onExit;
  if (onExit) resolved.push({ phase: 'exit', handler: onExit });
  const onEnter = boardRules[input.toStage]?.[input.source]?.onEnter;
  if (onEnter) resolved.push({ phase: 'enter', handler: onEnter });
  return resolved;
}

export function resolveFactoryToolRule(rules: FactoryRules, toolName: string): FactoryToolRuleLeaf['onResult'] {
  return rules.tools[toolName]?.onResult;
}

export function resolveFactoryGithubRule(
  rules: FactoryRules,
  event: FactoryGithubEventName,
): FactoryGithubRuleLeaf['onEvent'] {
  return rules.github[event]?.onEvent;
}

export function resolveFactoryLinearRule(
  rules: FactoryRules,
  event: FactoryLinearEventName,
): FactoryLinearRuleLeaf['onEvent'] {
  return rules.linear[event]?.onEvent;
}

export type ResolvedFactoryToolRule = FactoryRuleHandler<FactoryToolResultRuleContext>;
