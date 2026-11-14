import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';

import type { InstalledBoardInfo } from '../../../../api/types';
import { trackMomentLabel } from '../../workspaces/services/sessionTrack';
import { phaseOf } from '../boardFlow';
import { elapsedLabel, phaseName } from '../cardStageBar';
import { movesGraph } from '../movesGraph';
import type { WorkItemStageEntry } from '../services/workItems';
import { stageLabel } from '../stages';
import { phaseIconKind, stageColorClass } from './BoardIcons';

/** Each lane is 1.25rem tall; a stay's bar is 0.5rem, centred in its lane. */
const LANE_REM = 1.25;

/** Where a mark sits in the plot: its lane's offset from the top, and its span along the axis. */
interface MarkStyle extends CSSProperties {
  '--top': string;
  '--start'?: string;
  '--width'?: string;
  '--height'?: string;
}

const percent = (share: number) => `${share * 100}%`;

/**
 * A card's moves drawn like a sleep graph: a lane per phase it has been in, a bar per stay, a step between lanes
 * at each move, so a card sent back from Review to Building reads as a step back up. Pointing at a stay, or
 * stepping through them with the arrow keys, reads it out under the graph.
 */
export function MovesGraph({
  history,
  board,
  now,
}: {
  history: readonly WorkItemStageEntry[];
  board: InstalledBoardInfo | undefined;
  now: number;
}) {
  const [active, setActive] = useState<number>();
  const { lanes, stays, risers } = movesGraph(history, board, now);
  const describe = (stage: string) => {
    const phase = phaseOf(board, stage);
    return {
      name: phase ? phaseName(phase) : stageLabel(stage),
      kind: board && phase ? phaseIconKind(board.id, phase.kind) : undefined,
    };
  };
  // The stays the card is in now are the stage bar's; the moves are the stays it left.
  const moves = stays.flatMap(stay => {
    if (!stay.entry.exitedAt) return [];
    const enteredAt = Date.parse(stay.entry.enteredAt);
    return [
      {
        ...stay,
        name: describe(stay.entry.stage).name,
        lasted: elapsedLabel(enteredAt, Date.parse(stay.entry.exitedAt)),
        moment: trackMomentLabel(enteredAt, now),
      },
    ];
  });
  const shown = active === undefined ? undefined : moves[active];
  const last = moves.length - 1;
  // Before anyone points at a stay, the slider rests on the latest move.
  const announced = shown ?? moves[last];
  const first = stays[0];
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
    setActive(to);
  };
  const point = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const at = (event.clientX - bounds.left) / bounds.width;
    const lane = Math.floor(((event.clientY - bounds.top) / bounds.height) * lanes.length);
    // Stays that ran at once share the axis, so the lane under the pointer picks between them.
    const under = moves.filter(move => at >= move.start && at < move.start + move.width);
    const hit = under.find(move => move.lane === lane) ?? under.at(0);
    setActive(hit ? moves.indexOf(hit) : undefined);
  };

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 px-2">
      <ul aria-hidden className="m-0 flex list-none flex-col p-0">
        {lanes.map(stage => (
          <li key={stage} className="flex h-5 items-center">
            <Txt as="span" variant="meta" tone="muted" className="max-w-24 truncate">
              {describe(stage).name}
            </Txt>
          </li>
        ))}
      </ul>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Moves"
        aria-valuemin={1}
        aria-valuemax={moves.length}
        aria-valuenow={(active ?? last) + 1}
        aria-valuetext={announced ? `${announced.name}, ${announced.lasted}, entered ${announced.moment}` : undefined}
        onKeyDown={step}
        onFocus={() => setActive(current => current ?? last)}
        onBlur={() => setActive(undefined)}
        onPointerMove={point}
        onPointerLeave={event => {
          if (document.activeElement !== event.currentTarget) setActive(undefined);
        }}
        className={cn('relative rounded-sm', focusRing)}
      >
        {lanes.map((stage, lane) => {
          const guide: MarkStyle = { '--top': `${lane * LANE_REM + LANE_REM / 2}rem` };
          return (
            <span key={stage} aria-hidden className="bg-border/50 absolute inset-x-0 top-(--top) h-px" style={guide} />
          );
        })}
        {risers.map(riser => {
          const style: MarkStyle = {
            '--top': `${Math.min(riser.from, riser.to) * LANE_REM + LANE_REM / 2}rem`,
            '--height': `${Math.abs(riser.to - riser.from) * LANE_REM}rem`,
            '--start': percent(riser.at),
          };
          return (
            <span
              key={`riser:${riser.at}:${riser.from}:${riser.to}`}
              aria-hidden
              className="bg-border absolute top-(--top) left-(--start) h-(--height) w-px"
              style={style}
            />
          );
        })}
        {stays.map(stay => {
          const { kind } = describe(stay.entry.stage);
          const bar: MarkStyle = {
            '--top': `${stay.lane * LANE_REM + (LANE_REM - 0.5) / 2}rem`,
            '--start': percent(stay.start),
            '--width': percent(stay.width),
          };
          const live = !stay.entry.exitedAt && !stay.waiting;
          return (
            <span
              key={`${stay.entry.stage}:${stay.entry.enteredAt}`}
              aria-hidden
              className={cn(
                'absolute top-(--top) left-(--start) h-2 w-(--width) min-w-1 rounded-full motion-safe:transition-opacity',
                stageColorClass(stay.entry.stage, kind),
                // A wait is drawn hollow: the card sat there, and a long one is folded to keep the work readable.
                stay.waiting ? 'border border-dashed border-current' : 'bg-current',
                shown && stay.entry !== shown.entry && 'opacity-30',
              )}
              style={bar}
            >
              {live ? (
                <span className="absolute -top-0.5 -right-1 size-3 rounded-full bg-current opacity-40 motion-safe:animate-ping" />
              ) : null}
            </span>
          );
        })}
      </div>
      <span />
      <div aria-hidden className="flex min-h-5 items-center gap-1.5">
        {shown ? (
          <>
            <Txt as="span" variant="meta" tone="ink" className="min-w-0 truncate">
              {shown.name}
            </Txt>
            <Txt as="span" variant="meta" tone="muted" className="shrink-0 tabular-nums">
              {shown.lasted}
            </Txt>
            <Txt as="span" variant="meta" tone="faint" className="ml-auto shrink-0 tabular-nums">
              {shown.moment}
            </Txt>
          </>
        ) : (
          <>
            <Txt as="span" variant="meta" tone="faint" className="tabular-nums">
              {first ? trackMomentLabel(Date.parse(first.entry.enteredAt), now) : null}
            </Txt>
            <Txt as="span" variant="meta" tone="faint" className="ml-auto">
              now
            </Txt>
          </>
        )}
      </div>
    </div>
  );
}
