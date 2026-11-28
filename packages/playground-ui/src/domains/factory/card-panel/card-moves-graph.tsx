import type { WorkItemStageEntry } from '@internal/factory-contract';
import type { InstalledBoardInfo } from '@mastra/client-js';

import type { MovesGraphLabels } from '..';
import { MovesGraph as SharedMovesGraph, elapsedLabel } from '../session';
import { movesGraphPhases } from './card-moves-graph-phases';
import { trackMomentLabel, trackStartLabel } from './session-track';

const labels: MovesGraphLabels = { elapsed: elapsedLabel, moment: trackMomentLabel, start: trackStartLabel };

export function CardPanelMovesGraph({
  history,
  board,
  now,
}: {
  history: readonly WorkItemStageEntry[];
  board: InstalledBoardInfo | undefined;
  now: number;
}) {
  return <SharedMovesGraph history={history} phases={movesGraphPhases(history, board)} now={now} labels={labels} />;
}
