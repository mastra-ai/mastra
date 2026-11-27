import { INTAKE_ROUTE_RULE_FIELDS, routeEventsProblem } from '@mastra/factory/boards/board-events';
import { ruleGroupSchema } from '@mastra/factory/rules/rule-group';
import type { RuleCondition, RuleGroup } from '@mastra/factory/rules/rule-group';

import type { InstalledBoardInfo, IntakeDryRunBody, IntakeRouteInfo } from '../../../api/types';
import { describeRule } from '../settings/components/conditionFields';
import { LANE_EVENTS, laneRules, laneText, placesArrival, shadowedBy } from '../boardRules/ruleLanes';
import type { RuleEvent } from '../boardRules/ruleLanes';
import { boardName, phaseName, reorderWithin } from '../boardRules/ruleTargets';

type DraftRoute = NonNullable<IntakeDryRunBody['boards']>[number]['routes'][number];

export const MAX_RULE_NAME = 120;
const WHEN_SCHEMA = ruleGroupSchema(INTAKE_ROUTE_RULE_FIELDS);

/** What the panel saves: a new rule, or the whole of an existing one. */
export type RuleDraft = Pick<IntakeRouteInfo, 'name' | 'on' | 'when'> & {
  /** `moveToBoardKey` names another board a card-move rule sends cards to; null keeps them on this board. */
  target: { phaseKey: string; moveToBoardKey: string | null };
};

/**
 * Phases a rule may aim at. An item with no card yet can't land in a finished phase; any other
 * phase works, even one the board's first phase can't move to — the rule's author designs the
 * board too. A card already on a board can go to any phase.
 */
export function targetPhases(board: InstalledBoardInfo | undefined, placesNew: boolean) {
  const phases = board?.phases ?? [];
  if (!placesNew) return phases;
  return phases.filter(phase => phase.kind !== 'terminal');
}

/** What stops the rule saving, in words; undefined when it can save. */
export function ruleProblem(on: readonly RuleEvent[], when: RuleGroup | null): string | undefined {
  if (when) {
    const parsed = WHEN_SCHEMA.safeParse(when);
    if (!parsed.success) return parsed.error.issues[0]?.message;
  }
  return routeEventsProblem(on, when) ?? undefined;
}

/** The name a rule writes for itself until someone types one: "When issue opened, labels has bug, move to Triage". */
export function suggestName(on: readonly RuleEvent[], when: RuleGroup | null, target: string) {
  const event = on.map(type => laneText(type).label.toLowerCase()).join(' or ');
  const where = when ? `, ${describeRule(when).charAt(0).toLowerCase()}${describeRule(when).slice(1)}` : '';
  const name = `When ${event}${where}, move to ${target}`;
  return name.length > MAX_RULE_NAME ? `${name.slice(0, MAX_RULE_NAME - 1)}…` : name;
}

/**
 * Where a rule just added at the end of its board's list belongs: just above the earliest rule hiding it in any
 * lane it listens on, as a rule under one taking everything would never be reached. The board has one order shared
 * by every lane, so one slot keeps it above all of them. Undefined when nothing hides it.
 */
export function slotAboveCatchAll(
  boardRules: readonly IntakeRouteInfo[],
  id: string,
  on: readonly RuleEvent[],
): number | undefined {
  const ids = boardRules.map(rule => rule.id);
  const at = ids.indexOf(id);
  const catchAlls = on.flatMap(event => {
    const lane = laneRules(boardRules, event);
    const hider =
      lane[
        shadowedBy(
          lane,
          event,
          lane.findIndex(rule => rule.id === id),
        )
      ];
    return hider ? [ids.indexOf(hider.id)] : [];
  });
  const above = Math.min(...catchAlls);
  return at >= 0 && above < at ? above : undefined;
}

/** The rule as the panel shows it while someone changes it. */
export interface RuleEdit {
  /** The saved rule as the change started from it; undefined for a new rule. */
  base?: IntakeRouteInfo;
  on: RuleEvent[];
  when: RuleGroup | null;
  /** A condition line is still unfinished, so the rule leaves it out and can't save. */
  incomplete: boolean;
  boardKey: string;
  /** Unset, a saved rule aims at the target board's first phase, as the server reads it; a new one has none yet. */
  phaseKey?: string;
  /** Unset names the rule after what it does. */
  name?: string;
}

export function editOf(rule: IntakeRouteInfo): RuleEdit {
  return {
    base: rule,
    on: rule.on,
    when: rule.when,
    incomplete: false,
    boardKey: rule.target.moveToBoardKey ?? rule.target.boardKey,
    phaseKey: rule.target.phaseKey ?? undefined,
    name: rule.name,
  };
}

/** A new rule as the canvas seeded it: the trigger and phase it was added from, on `board`. */
export function newEdit(board: InstalledBoardInfo, seed: { on?: string; into?: string } | undefined): RuleEdit {
  const seedEvent = LANE_EVENTS.find(event => event === seed?.on);
  return {
    on: seedEvent ? [seedEvent] : [],
    when: null,
    incomplete: false,
    boardKey: board.id,
    phaseKey: seed?.into,
  };
}

/** `when` with one more condition every item must also meet. */
export function withCondition(when: RuleGroup | null, condition: RuleCondition): RuleGroup {
  if (when === null) return { operator: 'AND', conditions: [condition] };
  if (when.operator === 'AND') return { ...when, conditions: [...when.conditions, condition] };
  return { operator: 'AND', conditions: [when, condition] };
}

/** Where a rule sends items, as its suggested name says it: the phase alone on the rule's own board. */
function destinationOf(board: InstalledBoardInfo, targetBoard: InstalledBoardInfo, phaseKey: string): string {
  if (targetBoard.id === board.id) return phaseName(targetBoard, phaseKey) ?? phaseKey;
  return `${boardName(targetBoard)} › ${phaseName(targetBoard, phaseKey)}`;
}

/** What an edit amounts to on `board`, the rule's own board: where it sends items, its name, and the draft to save once it can. */
export function resolveEdit(edit: RuleEdit, board: InstalledBoardInfo, boards: readonly InstalledBoardInfo[]) {
  const placesNew = placesArrival(edit.on);
  const targetBoard = boards.find(candidate => candidate.id === edit.boardKey);
  const phases = targetPhases(targetBoard, placesNew);
  const phase = phases.find(candidate => candidate.id === (edit.phaseKey ?? (edit.base && targetBoard?.initialPhase)));
  const problem = edit.on.length ? ruleProblem(edit.on, edit.when) : undefined;
  const destination = phase && targetBoard ? destinationOf(board, targetBoard, phase.id) : '';
  const name = edit.name ?? (phase && edit.on.length > 0 ? suggestName(edit.on, edit.when, destination) : '');
  const draft: RuleDraft | undefined =
    edit.on.length > 0 && !edit.incomplete && !problem && phase && name.trim()
      ? {
          name: name.trim(),
          on: edit.on,
          when: edit.when,
          target: { phaseKey: phase.id, moveToBoardKey: edit.boardKey === board.id ? null : edit.boardKey },
        }
      : undefined;
  return { placesNew, targetBoard, phases, phase, problem, name, draft };
}

function routeOf(rule: IntakeRouteInfo): DraftRoute {
  const { phaseKey, moveToBoardKey, joinClosedIssue } = rule.target;
  return {
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    when: rule.when,
    on: rule.on,
    target: { phaseKey, moveToBoardKey, joinClosedIssue },
  };
}

/**
 * A board's rules with the draft in place, to run unsaved: the edited rule where it stands, or a new one where saving
 * would put it, above any rule that hides it.
 */
export function draftRoutes(
  boardRules: readonly IntakeRouteInfo[],
  draft: RuleDraft,
  rule: IntakeRouteInfo | undefined,
): DraftRoute[] {
  if (rule) {
    return boardRules.map(candidate =>
      candidate.id === rule.id
        ? {
            ...routeOf(candidate),
            name: draft.name,
            on: draft.on,
            when: draft.when,
            target: { ...draft.target, joinClosedIssue: candidate.target.joinClosedIssue },
          }
        : routeOf(candidate),
    );
  }
  const added: IntakeRouteInfo = {
    id: 'draft',
    name: draft.name,
    enabled: true,
    position: boardRules.length,
    when: draft.when,
    on: draft.on,
    target: { boardKey: boardRules[0]?.target.boardKey ?? '', joinClosedIssue: false, ...draft.target },
    revision: 0,
    createdBy: '',
    createdAt: '',
    updatedBy: '',
    updatedAt: '',
    problems: [],
  };
  const routes = [...boardRules, added];
  const ids = routes.map(candidate => candidate.id);
  const slot = slotAboveCatchAll(routes, added.id, draft.on);
  const order = slot === undefined ? ids : reorderWithin(routes, ids, ids.length - 1, slot);
  return order.flatMap(id => {
    if (id === added.id) {
      const { id: _unsaved, ...route } = routeOf(added);
      return [route];
    }
    const saved = boardRules.find(candidate => candidate.id === id);
    return saved ? [routeOf(saved)] : [];
  });
}
