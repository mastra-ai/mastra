import { Tooltip, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { TriangleAlert } from 'lucide-react';
import { Link } from 'react-router';

import { formatDuration } from '../../../../../../../lib/date/formatDuration';
import { clockTime, workItemPath } from '../../../../activity';
import type { StageToneClasses } from '../../../BoardIcons';
import { SourceIcon } from '../../../BoardIcons';
import { useBarSpotlight } from '../../spotlight';
import type { BarsInView } from '../../spotlight';
import type { RunBar } from '../runs/runBars';
import type { TimeWindow } from '../time/timeViewport';
import { DetailLinesTooltipContent, TrackChipBody } from '../track/TrackChip';
import { TRACK_CHIP_CLASS, trackChipStyle } from '../track/trackChipStyles';
import type { PlacedRun } from './layout/laneLayout';
import { drawnBarSpan, rowTopPx } from './layout/laneSizes';
import { RUN_STATUS_PRESENTATION } from './runStatusPresentation';

function runTiming(run: RunBar, nowMs: number): string {
  const end = run.endedAt === undefined ? 'now' : clockTime(run.endedAt);
  if (run.startedAt === undefined) return `Earlier – ${end}`;
  if (run.status === 'unaccounted') return `Started ${clockTime(run.startedAt)}`;
  return `${clockTime(run.startedAt)} – ${end} · ${formatDuration((run.endedAt ?? nowMs) - run.startedAt)}`;
}

export function LaneRunBar({
  placed,
  window,
  widthPx,
  nowMs,
  laneLabel,
  laneTone,
  barsInView,
  factoryProjectId,
}: {
  placed: PlacedRun;
  window: TimeWindow;
  widthPx: number;
  nowMs: number;
  laneLabel: string;
  laneTone: StageToneClasses;
  barsInView: BarsInView;
  factoryProjectId: string;
}) {
  const { run } = placed;
  const presentation = RUN_STATUS_PRESENTATION[run.status];
  const { Icon } = presentation;
  const spotlight = useBarSpotlight(run.id, run.workItemId, barsInView);
  const details = [run.title, `${laneLabel} · ${presentation.label}`, runTiming(run, nowMs)];
  const span = drawnBarSpan(placed, window, widthPx);
  const dimmed = spotlight.state === 'dimmed';
  const spotlit = spotlight.state === 'spotlit';
  const needsYou = run.status === 'needs-you';

  const barProps = {
    'aria-label': details.join(', '),
    className: cn(
      TRACK_CHIP_CLASS,
      'transition-[top,color] duration-200 motion-reduce:transition-none',
      needsYou && '@container',
      placed.startNotInView && 'rounded-l-none',
      presentation.text,
      presentation.edge,
      dimmed && 'text-muted-foreground',
    ),
    style: trackChipStyle(rowTopPx(placed.row), span, span),
    ...spotlight.handlers,
  };
  const content = (
    <TrackChipBody
      fade={span}
      surfaceClassName="bg-card"
      surface={
        <span
          className={cn(
            'absolute inset-0 rounded-[inherit] transition-[opacity,box-shadow] duration-200 motion-reduce:transition-none',
            presentation.statusLayer ?? laneTone.tint,
            presentation.statusAccent ?? laneTone.icon,
            dimmed && 'opacity-30',
            spotlit && 'shadow-[inset_0_0_0_9999px_var(--fill)] ring-1 ring-current ring-inset',
          )}
        />
      }
    >
      {run.card === undefined ? null : <SourceIcon source={run.card.source} className="size-3.5" />}
      {Icon === undefined ? null : <Icon aria-hidden className="size-3.5 shrink-0" />}
      <Txt as="span" variant="caption" className="min-w-0 truncate">
        {run.title}
      </Txt>
      {needsYou ? (
        <span className="bg-card ml-auto flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5">
          <TriangleAlert aria-hidden className="size-3" />
          <Txt as="span" variant="caption" className="hidden whitespace-nowrap @min-[12rem]:inline">
            Needs you
          </Txt>
        </span>
      ) : null}
    </TrackChipBody>
  );
  const bar =
    run.card === undefined ? (
      <span role="img" tabIndex={0} {...barProps}>
        {content}
      </span>
    ) : (
      <Link to={workItemPath(factoryProjectId, run.card)} {...barProps}>
        {content}
      </Link>
    );

  return (
    <Tooltip disableHoverablePopup>
      <TooltipTrigger render={bar} />
      <DetailLinesTooltipContent lines={details} />
    </Tooltip>
  );
}
