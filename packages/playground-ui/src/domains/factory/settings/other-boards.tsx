import type { InstalledBoardInfo, IntakeRouteInfo } from '@mastra/client-js';
import { boardName, phaseName } from '..';
import type { FlowRuleLine, OtherBoardMove } from '..';

import { OtherBoards as SharedOtherBoards } from '../canvas';
import { useBoardSettingsHost } from './board-settings-host';
import type { Emphasis, RuleLine } from './canvas-model';
import { flowIncomingRule, flowRuleLine } from './flow-lines';
import type { LaneOrder } from './flow-lines';

interface OtherBoardsProps {
  factoryId: string;
  boardId: string;
  boards: readonly InstalledBoardInfo[];
  leaving: RuleLine[];
  stray: RuleLine[];
  /** Other boards' rules into a phase this board no longer has. */
  strayIncoming: IntakeRouteInfo[];
  emphasis: (line: RuleLine) => Emphasis;
  /** How another board's rule reads beside the selection. */
  outside: (ruleId: string) => Emphasis;
  lanes: LaneOrder;
}

/** Rules that leave the board or point at a removed phase, with where each lands looked up among the boards. */
export function BoardSettingsOtherBoards({
  factoryId,
  boardId,
  boards,
  leaving,
  stray,
  strayIncoming,
  emphasis,
  outside,
  lanes,
}: OtherBoardsProps) {
  const host = useBoardSettingsHost();
  const board = boards.find(candidate => candidate.id === boardId);
  const chip = (line: RuleLine): FlowRuleLine =>
    flowRuleLine(line, host.configHref(boardId, undefined, { rule: line.rule.id }), emphasis(line), lanes, board);
  const moves = leaving.map((line): OtherBoardMove => {
    const key = line.rule.target.moveToBoardKey ?? line.rule.target.boardKey;
    const target = boards.find(candidate => candidate.id === key);
    const phaseKey = line.rule.target.phaseKey ?? target?.initialPhase;
    const phase = target?.phases.find(candidate => candidate.id === phaseKey);
    return {
      line: chip(line),
      href: host.configHref(key, phaseKey ?? undefined),
      stage: phaseKey && target ? { key: phaseKey, boardId: key, kind: phase?.kind ?? 'resting' } : undefined,
      phaseName: phaseName(target, line.rule.target.phaseKey),
      boardName: target ? boardName(target) : key,
    };
  });

  return (
    <SharedOtherBoards
      leaving={moves}
      stray={stray.map(chip)}
      strayIncoming={strayIncoming.map(rule =>
        flowIncomingRule(
          rule,
          boards,
          host.configHref(rule.target.boardKey, undefined, { rule: rule.id }),
          outside(rule.id),
        ),
      )}
      LinkComponent={host.LinkComponent}
    />
  );
}
