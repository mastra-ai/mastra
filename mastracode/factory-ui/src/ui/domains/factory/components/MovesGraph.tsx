import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';

import type { InstalledBoardInfo } from '../../../../api/types';
import { PanelHeading } from '../../workspace-viewer/components/PanelHeading';
import { trackMomentLabel, trackStartLabel } from '../../workspaces/services/sessionTrack';
import { phaseLabel } from '../boardStages';
import { elapsedLabel } from '../cardStageBar';
import { movesGraph } from '../movesGraph';
import type { WorkItemStageEntry } from '../services/workItems';
import { BoardStageIcon, boardPhaseIconKind, stageColorClass, unfocusedStageClass } from './BoardIcons';

const laneClass = 'h-5';

interface StaySpanStyle extends CSSProperties {
  '--start': string;
  '--width': string;
}

export function MovesGraph({
  history,
  board,
  now,
}: {
  history: readonly WorkItemStageEntry[];
  board: InstalledBoardInfo | undefined;
  now: number;
}) {
  const [pointed, setPointed] = useState<number>();
  const [stepped, setStepped] = useState<number>();
  const { lanes, stays } = movesGraph(history, board, now);
  const describe = (stage: string) => ({ name: phaseLabel(board, stage), kind: boardPhaseIconKind(board, stage) });
  const points = stays.map((stay, index) => {
    const current = stay.entry.exitedAt === undefined;
    const lasted = elapsedLabel(stay.from, stay.to);
    return {
      ...stay,
      ...describe(stay.entry.stage),
      index,
      current,
      lasted: current ? `${lasted} so far` : lasted,
      moment: trackMomentLabel(stay.from, now),
    };
  });
  const moved = points.filter(point => !point.current).length;
  const last = points.length - 1;
  const active = pointed ?? stepped;
  const shown = active === undefined ? undefined : points[active];
  const announced = shown ?? points[last];
  const first = points[0];
  const step = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = active ?? last;
    const next: Partial<Record<string, number>> = {
      ArrowLeft: Math.max(0, at - 1),
      ArrowDown: Math.max(0, at - 1),
      ArrowRight: Math.min(last, at + 1),
      ArrowUp: Math.min(last, at + 1),
      Home: 0,
      End: last,
    };
    const to = next[event.key];
    if (to === undefined) return;
    event.preventDefault();
    setPointed(undefined);
    setStepped(to);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-w-0 items-center justify-between gap-3 pr-2">
        <PanelHeading detail={moved}>Moves</PanelHeading>
        <div aria-hidden className="flex min-w-0 items-center gap-1.5 [&>svg]:size-3.5">
          {shown ? (
            <>
              <BoardStageIcon stage={shown.entry.stage} kind={shown.kind} decorative />
              <Txt as="span" variant="caption" tone="ink" className="min-w-0 truncate">
                {shown.name}
              </Txt>
              <Txt as="span" variant="caption" tone="muted" className="shrink-0">
                {shown.lasted}
              </Txt>
              <Txt as="span" variant="caption" tone="faint" className="shrink-0">
                {shown.moment}
              </Txt>
            </>
          ) : first ? (
            <Txt as="span" variant="caption" tone="faint" className="shrink-0">
              Since {trackStartLabel(first.from, now)}
            </Txt>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 px-2">
        <ul aria-hidden className="m-0 flex list-none flex-col p-0">
          {lanes.map(stage => {
            const { name, kind } = describe(stage);
            return (
              <li key={stage} className={cn('flex min-w-0 items-center gap-1.5 [&>:first-child]:size-3.5', laneClass)}>
                <BoardStageIcon stage={stage} kind={kind} decorative />
                <Txt as="span" variant="caption" tone="muted" className="max-w-24 truncate">
                  {name}
                </Txt>
              </li>
            );
          })}
        </ul>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Moves"
          aria-valuemin={1}
          aria-valuemax={points.length}
          aria-valuenow={(active ?? last) + 1}
          aria-valuetext={announced ? `${announced.name}, ${announced.lasted}, entered ${announced.moment}` : undefined}
          onKeyDown={step}
          onFocus={() => setStepped(current => current ?? pointed ?? last)}
          onBlur={() => setStepped(undefined)}
          className={cn('flex flex-col rounded-sm [--bar:--spacing(2)]', focusRing)}
        >
          {lanes.map((stage, lane) => (
            <div key={stage} aria-hidden className={cn('relative flex items-center', laneClass)}>
              <span className="bg-fill-subtle h-(--bar) w-full rounded-full" />
              {points
                .filter(stay => stay.lane === lane)
                .map(stay => {
                  const span: StaySpanStyle = { '--start': `${stay.start * 100}%`, '--width': `${stay.width * 100}%` };
                  return (
                    <span
                      key={`${stay.entry.stage}:${stay.entry.enteredAt}`}
                      className="absolute inset-y-0 left-[min(var(--start),calc(100%-var(--bar)))] flex w-(--width) min-w-(--bar) items-center"
                      style={span}
                      onPointerEnter={() => setPointed(stay.index)}
                      onPointerLeave={() => setPointed(undefined)}
                    >
                      <span
                        className={cn(
                          'relative h-(--bar) w-full rounded-full motion-safe:transition-opacity',
                          stageColorClass(stay.entry.stage, stay.kind),
                          stay.working ? 'bg-current' : 'bg-current/30',
                          shown && stay.index !== shown.index && unfocusedStageClass,
                        )}
                      >
                        {stay.current && stay.working ? (
                          <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-current opacity-40 motion-safe:animate-ping" />
                        ) : null}
                      </span>
                    </span>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
