import type { BoardRegistry } from '../boards/index.js';
import type {
  FactoryLinearEventName,
  FactoryLinearRuleLeaf,
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
    board: string;
    source: FactoryRuleSource;
    fromStage: FactoryRuleStage;
    toStage: FactoryRuleStage;
    initialEntry?: boolean;
    reenter?: boolean;
  },
  boardRegistry?: BoardRegistry,
): ResolvedFactoryStageRule[] {
  if (input.fromStage === input.toStage && !input.initialEntry && !input.reenter) return [];
  const boardRules =
    input.board === 'work'
      ? rules.work
      : input.board === 'review'
        ? rules.review
        : boardRegistry?.get(input.board)?.rules;
  if (!boardRules) return [];
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

export function resolveFactoryLinearRule(
  rules: FactoryRules,
  event: FactoryLinearEventName,
): FactoryLinearRuleLeaf['onEvent'] {
  return rules.linear[event]?.onEvent;
}

export type ResolvedFactoryToolRule = FactoryRuleHandler<FactoryToolResultRuleContext>;
