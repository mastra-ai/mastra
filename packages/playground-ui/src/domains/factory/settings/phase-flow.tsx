import type { InstalledBoardInfo, IntakeOrderResponse } from '@mastra/client-js';
import { keyFromName, keyProblem, nextPhasesOf, approvalText, toolLabel } from '..';
import type { PhaseFlowModel } from '..';

import { PhaseFlow as SharedPhaseFlow } from '../canvas';
import type { BoardSettingsSkill } from './board-settings-host';
import { useBoardSettingsHost } from './board-settings-host';
import { intakeSentence, movesOnItsOwn, sessionSpans } from './canvas-model';
import type { CanvasEmphasis, CanvasModel } from './canvas-model';
import { flowIncomingRule, flowRuleLine } from './flow-lines';
import type { LaneOrder } from './flow-lines';

interface PhaseFlowProps {
  factoryId: string;
  boardId: string;
  model: CanvasModel;
  boards: readonly InstalledBoardInfo[];
  totals: ReadonlyMap<string, number>;
  emphasis: CanvasEmphasis;
  /** How numbered chips show the order of the rules on their trigger. */
  lanes: LaneOrder;
  /** The phase whose panel is open: its "+ Rule" stays shown. */
  selectedPhase: string | undefined;
  /** The rule whose panel is open: its row unfolds to show it. */
  selectedRule: string | undefined;
  problems: ReadonlySet<string>;
  /** Whether rules can be added here; editing one is up to its panel. */
  rulesEditable: boolean;
  /** Absent when the board can't be changed here. */
  edit?: {
    required: (phaseKey: string) => ReadonlySet<string>;
    onMoves: (phaseKey: string, nextPhases: string[]) => void;
    onReorder: (from: number, to: number) => void;
    /** Adds a resting phase at `at`, opening its panel when `open`. */
    onAdd: (phase: { key: string; name: string }, at: number, open: boolean) => void;
  };
  /** Where the board stands in the intake order; unset until it loads. */
  order: IntakeOrderResponse | undefined;
  /** The project's skills; undefined until they load, so no skill is called missing early. */
  skills: readonly BoardSettingsSkill[] | undefined;
}

/** Why a phase's skill can't run: the project has no such skill, or agents can't load it. */
function skillProblem(name: string | undefined, skills: readonly BoardSettingsSkill[] | undefined) {
  if (!name || skills === undefined) return undefined;
  const skill = skills.find(candidate => candidate.name === name);
  if (!skill) return 'Skill not found';
  return skill.error === undefined ? undefined : 'Skill failed to load';
}

/** The board's phases top to bottom, with the rules, moves and sessions the canvas model works out for each. */
export function BoardSettingsPhaseFlow({
  factoryId,
  boardId,
  model,
  boards,
  totals,
  emphasis,
  lanes,
  selectedPhase,
  selectedRule,
  problems,
  rulesEditable,
  edit,
  order,
  skills,
}: PhaseFlowProps) {
  const host = useBoardSettingsHost();
  const phases = model.rows.map(row => row.phase);
  const board = boards.find(candidate => candidate.id === boardId);
  const flow: PhaseFlowModel = {
    rows: model.rows.map(row => {
      const { phase } = row;
      return {
        phase,
        lines: row.lines.map(line =>
          flowRuleLine(
            line,
            host.configHref(boardId, undefined, { rule: line.rule.id }),
            emphasis.line(line, phase.key),
            lanes,
            board,
          ),
        ),
        incoming: row.incoming.map(rule =>
          flowIncomingRule(
            rule,
            boards,
            host.configHref(rule.target.boardKey, undefined, { rule: rule.id }),
            emphasis.outside(rule.id),
          ),
        ),
        unreached: row.unreached,
        start: row.start,
        emphasis: emphasis.node(phase.key),
        next: nextPhasesOf(phase, phases).filter(key => key !== phase.key),
        automatic: movesOnItsOwn(phase, phases),
        work:
          phase.kind === 'working'
            ? {
                skill: phase.runner?.skill,
                skillProblem: skillProblem(phase.runner?.skill, skills),
                autoStart: Boolean(phase.autoStart),
                exit: phase.exitTool ? { id: phase.exitTool.id, approval: approvalText(phase.exitTool) } : undefined,
                goal: phase.runner?.goal,
                tools: (phase.tools ?? []).map(toolLabel).join(', '),
              }
            : undefined,
        href: host.configHref(boardId, phase.key),
        newRuleHref: host.configHref(boardId, undefined, { newRule: { into: phase.key } }),
      };
    }),
    sessions: sessionSpans(phases),
  };

  return (
    <SharedPhaseFlow
      boardId={boardId}
      model={flow}
      totals={totals}
      selectedPhase={selectedPhase}
      selectedRule={selectedRule}
      problems={problems}
      rulesEditable={rulesEditable}
      edit={edit && { ...edit, keyFromName, keyProblem }}
      intake={{
        sentence: order && intakeSentence(order.boards, order.evaluator, boardId),
        reorderHref: host.routingHref(boardId, { intakeOrder: true }),
        // The old route list still files by these rules; a board left out of the order never gets the chance.
        asked:
          order !== undefined &&
          (order.evaluator === 'route-list' || order.boards.some(board => board.boardKey === boardId)),
      }}
      LinkComponent={host.LinkComponent}
    />
  );
}
