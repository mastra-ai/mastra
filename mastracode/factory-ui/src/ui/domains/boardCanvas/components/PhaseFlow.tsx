import { PhaseFlow as SharedPhaseFlow } from '@mastra/playground-ui/domains/factory';
import type { PhaseFlowModel } from '@mastra/playground-ui/domains/factory';

import type { InstalledBoardInfo, IntakeOrderResponse } from '../../../../api/types';
import { HrefLink } from '../../../ui/HrefLink';
import { boardConfigPath, boardIntakePath, INTAKE_ORDER_ANCHOR } from '../../boardConfig/boardConfigPaths';
import { keyFromName, keyProblem, nextPhasesOf } from '../../boardConfig/boardDraft';
import { approvalText, toolLabel } from '../../boardConfig/phaseSummary';
import { boardName } from '../../boardRules/ruleTargets';
import { intakeSentence, movesOnItsOwn, sessionSpans } from '../canvasModel';
import type { CanvasEmphasis, CanvasModel } from '../canvasModel';
import { flowRuleLine } from '../flowLines';
import type { LaneOrder } from '../flowLines';

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
}

/** The board's phases top to bottom, with the rules, moves and sessions the canvas model works out for each. */
export function PhaseFlow({
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
}: PhaseFlowProps) {
  const phases = model.rows.map(row => row.phase);
  const flow: PhaseFlowModel = {
    rows: model.rows.map(row => {
      const { phase } = row;
      return {
        phase,
        lines: row.lines.map(line =>
          flowRuleLine(
            line,
            boardConfigPath(factoryId, boardId, undefined, { rule: line.rule.id }),
            emphasis.line(line, phase.key),
            lanes,
          ),
        ),
        incoming: row.incoming.map(rule => {
          const from = boards.find(board => board.id === rule.target.boardKey);
          return {
            ruleId: rule.id,
            name: rule.name,
            boardName: from ? boardName(from) : rule.target.boardKey,
            href: boardConfigPath(factoryId, rule.target.boardKey, undefined, { rule: rule.id }),
            emphasis: emphasis.outside(rule.id),
          };
        }),
        unreached: row.unreached,
        emphasis: emphasis.node(phase.key),
        next: nextPhasesOf(phase, phases).filter(key => key !== phase.key),
        automatic: movesOnItsOwn(phase, phases),
        work:
          phase.kind === 'working'
            ? {
                skill: phase.runner?.skill,
                autoStart: Boolean(phase.autoStart),
                exit: phase.exitTool ? { id: phase.exitTool.id, approval: approvalText(phase.exitTool) } : undefined,
                goal: phase.runner?.goal,
                tools: (phase.tools ?? []).map(toolLabel).join(', '),
              }
            : undefined,
        href: boardConfigPath(factoryId, boardId, phase.key),
        newRuleHref: boardConfigPath(factoryId, boardId, undefined, { newRule: { into: phase.key } }),
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
        reorderHref: boardIntakePath(factoryId, boardId, { anchor: INTAKE_ORDER_ANCHOR }),
        // The old route list still files by these rules; a board left out of the order never gets the chance.
        asked:
          order !== undefined &&
          (order.evaluator === 'route-list' || order.boards.some(board => board.boardKey === boardId)),
      }}
      LinkComponent={HrefLink}
    />
  );
}
