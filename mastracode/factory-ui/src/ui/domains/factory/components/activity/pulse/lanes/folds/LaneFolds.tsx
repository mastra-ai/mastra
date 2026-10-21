import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Link } from 'react-router';

import { clockTime, workItemPath } from '../../../../../activity';
import type { RunBar } from '../../runs/runBars';
import type { TimeWindow } from '../../time/timeViewport';
import { edgeFade } from '../../track/edgeFade';
import { TrackChipBody } from '../../track/TrackChip';
import { TRACK_CHIP_CLASS, trackChipStyle } from '../../track/trackChipStyles';
import type { Lane, PlacedRun } from '../layout/laneLayout';
import { rowTopPx } from '../layout/laneSizes';
import { RUN_STATUS_PRESENTATION } from '../runStatusPresentation';
import { MIN_FOLD_PX, runFolds } from './runFolds';
import type { RunFold } from './runFolds';

const MAX_FOLD_MENU_RUNS = 20;

function runCount(count: number): string {
  return `${count} ${count === 1 ? 'run' : 'runs'}`;
}

function FoldedRunItem({ run, factoryProjectId }: { run: RunBar; factoryProjectId: string }) {
  const startedAt = run.startedAt === undefined ? 'Earlier' : clockTime(run.startedAt);
  const cardLink = run.card === undefined ? undefined : <Link to={workItemPath(factoryProjectId, run.card)} />;
  return (
    <DropdownMenu.Item render={cardLink}>
      <span className="min-w-0 flex-1 truncate">{run.title}</span>
      <Txt as="span" variant="caption" tone="muted" className="shrink-0">
        {`${RUN_STATUS_PRESENTATION[run.status].label} · ${startedAt}`}
      </Txt>
    </DropdownMenu.Item>
  );
}

function FoldMenuItems({
  runs,
  factoryProjectId,
  onExpandLane,
}: {
  runs: PlacedRun[];
  factoryProjectId: string;
  onExpandLane: (() => void) | undefined;
}) {
  return (
    <>
      {runs
        .slice(-MAX_FOLD_MENU_RUNS)
        .toReversed()
        .map(({ run }) => (
          <FoldedRunItem key={run.id} run={run} factoryProjectId={factoryProjectId} />
        ))}
      {onExpandLane === undefined ? null : (
        <>
          <DropdownMenu.Separator />
          <DropdownMenu.Item onClick={onExpandLane}>{`Show all ${runCount(runs.length)}`}</DropdownMenu.Item>
        </>
      )}
    </>
  );
}

function RunFoldChip({
  fold,
  topPx,
  window,
  widthPx,
  factoryProjectId,
  onExpandLane,
}: {
  fold: RunFold;
  topPx: number;
  window: TimeWindow;
  widthPx: number;
  factoryProjectId: string;
  onExpandLane: (() => void) | undefined;
}) {
  const fade = edgeFade(fold.leftPx, fold.rightPx, window, widthPx, MIN_FOLD_PX);
  const label = `+${runCount(fold.runs.length)}`;
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <button
            type="button"
            aria-label={`${label}, folded`}
            className={cn(TRACK_CHIP_CLASS, 'group text-muted-foreground hover:text-foreground transition-colors')}
            style={trackChipStyle(topPx, fold, fade)}
          />
        }
      >
        <TrackChipBody
          fade={fade}
          surfaceClassName="border-border-strong group-hover:bg-surface-panel border border-dashed transition-colors"
        >
          <Txt as="span" variant="caption" className="truncate">
            {label}
          </Txt>
        </TrackChipBody>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="max-w-96">
        <FoldMenuItems runs={fold.runs} factoryProjectId={factoryProjectId} onExpandLane={onExpandLane} />
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

export function LaneFolds({
  lane,
  window,
  widthPx,
  factoryProjectId,
  onExpandLane,
}: {
  lane: Lane;
  window: TimeWindow;
  widthPx: number;
  factoryProjectId: string;
  onExpandLane: (() => void) | undefined;
}) {
  return runFolds(lane.overflowRuns, window, widthPx).map(fold => (
    <RunFoldChip
      key={fold.runs[0].run.id}
      fold={fold}
      topPx={rowTopPx(lane.overflowRow)}
      window={window}
      widthPx={widthPx}
      factoryProjectId={factoryProjectId}
      onExpandLane={onExpandLane}
    />
  ));
}
