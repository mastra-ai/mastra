import { OtherBoards as SharedOtherBoards } from '@mastra/playground-ui/domains/factory';
import type { FlowRuleLine, OtherBoardMove } from '@mastra/playground-ui/domains/factory';

import type { InstalledBoardInfo } from '../../../../api/types';
import { HrefLink } from '../../../ui/HrefLink';
import { boardConfigPath } from '../../boardConfig/boardConfigPaths';
import { boardName, phaseName } from '../../boardRules/ruleTargets';
import type { Emphasis, RuleLine } from '../canvasModel';
import { flowRuleLine } from '../flowLines';
import type { LaneOrder } from '../flowLines';

interface OtherBoardsProps {
  factoryId: string;
  boardId: string;
  boards: readonly InstalledBoardInfo[];
  leaving: RuleLine[];
  stray: RuleLine[];
  emphasis: (line: RuleLine) => Emphasis;
  lanes: LaneOrder;
}

/** Rules that leave the board or point at a removed phase, with where each lands looked up among the boards. */
export function OtherBoards({ factoryId, boardId, boards, leaving, stray, emphasis, lanes }: OtherBoardsProps) {
  const chip = (line: RuleLine): FlowRuleLine =>
    flowRuleLine(line, boardConfigPath(factoryId, boardId, undefined, { rule: line.rule.id }), emphasis(line), lanes);
  const moves = leaving.map((line): OtherBoardMove => {
    const key = line.rule.target.moveToBoardKey ?? line.rule.target.boardKey;
    const board = boards.find(candidate => candidate.id === key);
    const phaseKey = line.rule.target.phaseKey ?? board?.initialPhase;
    const phase = board?.phases.find(candidate => candidate.id === phaseKey);
    return {
      line: chip(line),
      href: boardConfigPath(factoryId, key, phaseKey ?? undefined),
      stage: phaseKey && board ? { key: phaseKey, boardId: key, kind: phase?.kind ?? 'resting' } : undefined,
      phaseName: phaseName(board, line.rule.target.phaseKey),
      boardName: board ? boardName(board) : key,
    };
  });

  return <SharedOtherBoards leaving={moves} stray={stray.map(chip)} LinkComponent={HrefLink} />;
}
