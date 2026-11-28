import { MovesGraph as SharedMovesGraph } from '@mastra/playground-ui/domains/factory';
import type { MovesGraphLabels } from '@mastra/playground-ui/domains/factory';

import type { InstalledBoardInfo } from '@mastra/client-js';
import { trackMomentLabel, trackStartLabel } from '../../workspaces/services/sessionTrack';
import { elapsedLabel } from '../cardStageBar';
import { movesGraphPhases } from '../movesGraph';
import type { WorkItemStageEntry } from '@internal/factory-contract';

const labels: MovesGraphLabels = { elapsed: elapsedLabel, moment: trackMomentLabel, start: trackStartLabel };

export function MovesGraph({
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
