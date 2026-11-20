import { DiffStat } from '@mastra/playground-ui/components/DiffStat';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { pluralize } from '@mastra/playground-ui/utils/string';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';

import type { WorkspaceChange } from '../../../../api/types';
import {
  FILE_ROWS_LIMIT,
  additionShare,
  changeLines,
  changeTone,
  conflictCount,
  mosaicCapacity,
  overviewOrder,
  splitPath,
  tileOpacity,
} from './changes/changes-overview';
import type { ChangeTone } from './changes/changes-overview';
import { IconChanges } from '@mastra/playground-ui/icons/central/IconChanges';
import { IconCheckmark2Medium } from '@mastra/playground-ui/icons/central/IconCheckmark2Medium';
import { IconChevronRightMedium } from '@mastra/playground-ui/icons/central/IconChevronRightMedium';
import { IconExclamationTriangle } from '@mastra/playground-ui/icons/central/IconExclamationTriangle';
import { IconPageCross } from '@mastra/playground-ui/icons/central/IconPageCross';

interface WorkspaceRepositoryCounts {
  total: number;
  changed: number;
  unreadable: number;
}

interface WorkspaceChangeStats {
  files: readonly WorkspaceChange[];
  additions?: number;
  deletions?: number;
  repositories?: WorkspaceRepositoryCounts;
}

export type WorkspaceChangesSummary =
  | { state: 'unread' }
  | { state: 'loading' }
  | { state: 'failed' }
  | { state: 'read'; stats: WorkspaceChangeStats };

function filesLabel({ files, repositories }: WorkspaceChangeStats): string {
  const label = pluralize(files.length, 'file');
  if (!repositories || files.length === 0) return label;
  return `${label} in ${repositories.changed} of ${repositories.total} repos`;
}

function unreadableLabel({ repositories }: WorkspaceChangeStats): string | undefined {
  return repositories?.unreadable ? `${pluralize(repositories.unreadable, 'repo')} unreadable` : undefined;
}

function conflictsLabel({ files }: WorkspaceChangeStats): string | undefined {
  const conflicts = conflictCount(files);
  return conflicts > 0 ? pluralize(conflicts, 'conflict') : undefined;
}

function changesName(changes: WorkspaceChangesSummary): string {
  if (changes.state === 'loading') return 'Changes, loading';
  if (changes.state === 'failed') return 'Changes, unavailable';
  if (changes.state === 'unread') return 'Show changes';
  return ['Changes', filesLabel(changes.stats), conflictsLabel(changes.stats), unreadableLabel(changes.stats)]
    .filter(Boolean)
    .join(', ');
}

const chevron = <IconChevronRightMedium aria-hidden className="text-muted-foreground size-icon-sm ml-auto shrink-0" />;

function StateRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="text-muted-foreground [&>svg]:size-icon-sm flex h-7 items-center gap-1.5 [&>svg]:shrink-0">
      {icon}
      <Txt as="span" variant="caption" tone="muted" className="min-w-0 truncate">
        {children}
      </Txt>
      {chevron}
    </span>
  );
}

function RatioBar({ change }: { change: WorkspaceChange }) {
  const share = additionShare(change);
  return (
    <span aria-hidden className="bg-fill flex h-1.5 w-4.5 shrink-0 overflow-hidden rounded-[3px]">
      {share === undefined ? null : (
        <>
          <span className="bg-success-indicator" style={{ width: `${share * 100}%` }} />
          <span className="bg-destructive-foreground grow" />
        </>
      )}
    </span>
  );
}

const conflictIcon = (
  <IconExclamationTriangle aria-hidden className="text-destructive-foreground size-icon-xs shrink-0" />
);

function FileRow({ change }: { change: WorkspaceChange }) {
  const { name, directory } = splitPath(change.path);
  return (
    <span className="flex h-6 min-w-0 items-center gap-2" title={change.path}>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        {change.status === 'conflicted' ? conflictIcon : null}
        <Txt as="span" variant="body-sm" tone="ink" className="max-w-full shrink-0 truncate">
          {name}
        </Txt>
        <Txt as="span" variant="caption" tone="faint" className="min-w-0 truncate">
          {directory}
        </Txt>
      </span>
      {change.additions !== undefined && change.deletions !== undefined ? (
        <Txt as="span" variant="caption">
          <DiffStat additions={change.additions} deletions={change.deletions} />
        </Txt>
      ) : null}
      <RatioBar change={change} />
    </span>
  );
}

const TILE_TONES: Record<ChangeTone, string> = {
  conflict: 'outline-destructive-foreground outline-[1.5px] -outline-offset-1',
  addition: 'bg-success-indicator',
  deletion: 'bg-destructive-foreground',
  unsized: 'bg-muted-foreground',
};

// Card padding inside the 336px dock, so the first paint already shows the tiles the dock fits.
const DOCK_MOSAIC_WIDTH = 308;

function useMeasuredWidth() {
  const [width, setWidth] = useState(DOCK_MOSAIC_WIDTH);
  const measure = (node: HTMLElement | null) => {
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0) setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  };
  return [width, measure] as const;
}

function Mosaic({
  files,
  capacity,
  measure,
}: {
  files: readonly WorkspaceChange[];
  capacity: number;
  measure: (node: HTMLElement | null) => void;
}) {
  const [pointed, setPointed] = useState<WorkspaceChange>();
  const largest = Math.max(0, ...files.map(changeLines));
  return (
    <Tooltip trackCursorAxis="x">
      <TooltipTrigger
        delay={0}
        closeDelay={0}
        render={
          <span
            ref={measure}
            aria-hidden
            onPointerLeave={() => setPointed(undefined)}
            className="flex flex-wrap gap-[3px] pt-1 pb-0.5"
          />
        }
      >
        {files.slice(0, capacity).map(change => {
          const tone = changeTone(change);
          const isPointed = change === pointed;
          return (
            <span
              key={change.path}
              data-path={change.path}
              onPointerEnter={() => setPointed(change)}
              className={cn(
                'size-2.5 rounded-[2px] motion-safe:transition-[opacity,scale] motion-safe:duration-100',
                TILE_TONES[tone],
                isPointed && 'scale-125',
                pointed && !isPointed && 'opacity-40',
              )}
              style={
                tone === 'conflict' || pointed ? undefined : { opacity: tileOpacity(changeLines(change), largest) }
              }
            />
          );
        })}
      </TooltipTrigger>
      {pointed ? (
        <TooltipContent side="top" sideOffset={8} className="max-w-72 px-3 py-2">
          <TileDetails change={pointed} />
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}

function TileDetails({ change }: { change: WorkspaceChange }) {
  const { name, directory } = splitPath(change.path);
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex min-w-0 items-center gap-1.5">
        {change.status === 'conflicted' ? conflictIcon : null}
        <Txt as="span" variant="caption" tone="ink" className="min-w-0 truncate font-medium">
          {name}
        </Txt>
        {change.additions !== undefined && change.deletions !== undefined ? (
          <Txt as="span" variant="caption" className="ml-auto shrink-0 pl-3">
            <DiffStat additions={change.additions} deletions={change.deletions} />
          </Txt>
        ) : null}
      </span>
      {directory ? (
        <Txt as="span" variant="meta" tone="muted" className="truncate">
          {directory}
        </Txt>
      ) : null}
    </span>
  );
}

function RepositoriesRow({ repositories }: { repositories: WorkspaceRepositoryCounts }) {
  return (
    <Txt as="span" variant="caption" tone="muted" className="flex h-6 min-w-0 items-center gap-2.5">
      <span className="shrink-0">
        {repositories.changed} of {repositories.total} repos
      </span>
      {repositories.unreadable > 0 ? (
        <span className="text-warning-foreground flex min-w-0 items-center gap-1">
          <IconExclamationTriangle aria-hidden className="size-icon-xs shrink-0" />
          <span className="truncate">{repositories.unreadable} unreadable</span>
        </span>
      ) : null}
    </Txt>
  );
}

function ReadChanges({ stats, linesId }: { stats: WorkspaceChangeStats; linesId: string }) {
  const [width, measure] = useMeasuredWidth();
  const files = overviewOrder(stats.files);
  const asRows = files.length <= FILE_ROWS_LIMIT;
  const capacity = mosaicCapacity(width);
  const hidden = asRows ? 0 : Math.max(0, files.length - capacity);
  const conflicts = conflictCount(files);
  const lines =
    files.length > 0 && stats.additions !== undefined && stats.deletions !== undefined
      ? { additions: stats.additions, deletions: stats.deletions }
      : undefined;
  return (
    <>
      {asRows ? (
        files.length > 0 ? (
          <span className="flex flex-col">
            {files.map(change => (
              <FileRow key={change.path} change={change} />
            ))}
          </span>
        ) : null
      ) : (
        <Mosaic files={files} capacity={capacity} measure={measure} />
      )}
      <span className="flex h-7 min-w-0 items-center gap-2">
        <Txt as="span" variant="body-sm" tone="ink" className="shrink-0 tabular-nums">
          {pluralize(files.length, 'file')}
        </Txt>
        {lines ? (
          <Txt as="span" variant="caption" id={linesId}>
            <DiffStat additions={lines.additions} deletions={lines.deletions} />
          </Txt>
        ) : null}
        {hidden > 0 ? (
          <Txt as="span" variant="caption" tone="faint" className="shrink-0 tabular-nums">
            +{hidden} more
          </Txt>
        ) : null}
        {conflicts > 0 ? (
          <Txt as="span" variant="caption" className="text-destructive-foreground flex shrink-0 items-center gap-1">
            {conflictIcon}
            {pluralize(conflicts, 'conflict')}
          </Txt>
        ) : null}
        {chevron}
      </span>
      {stats.repositories ? <RepositoriesRow repositories={stats.repositories} /> : null}
    </>
  );
}

function hasLines(changes: WorkspaceChangesSummary): boolean {
  return (
    changes.state === 'read' &&
    changes.stats.files.length > 0 &&
    changes.stats.additions !== undefined &&
    changes.stats.deletions !== undefined
  );
}

export function WorkspaceChangesCard({
  changes,
  onOpen,
  autoFocus,
}: {
  changes: WorkspaceChangesSummary;
  onOpen: () => void;
  autoFocus?: boolean;
}) {
  const linesId = useId();
  const clean = changes.state === 'read' && changes.stats.files.length === 0 && !changes.stats.repositories?.unreadable;
  return (
    <button
      type="button"
      autoFocus={autoFocus}
      aria-label={changesName(changes)}
      aria-describedby={hasLines(changes) ? linesId : undefined}
      onClick={onOpen}
      className={cn(
        'bg-fill-subtle hover:bg-fill flex w-full min-w-0 cursor-pointer flex-col gap-1 rounded-[14px] px-2 pt-1.5 pb-1 text-left transition-colors duration-150 motion-reduce:transition-none',
        focusRing,
      )}
    >
      {changes.state === 'loading' ? (
        <span className="text-muted-foreground [&>svg]:size-icon-sm flex h-7 items-center gap-1.5 [&>svg]:shrink-0">
          <IconChanges aria-hidden />
          <Txt as="span" variant="caption" tone="muted" className="shrink-0">
            Reading changes
          </Txt>
          <Skeleton aria-hidden className="h-3 w-16 motion-reduce:before:animate-none" />
          {chevron}
        </span>
      ) : null}
      {changes.state === 'failed' ? (
        <StateRow icon={<IconPageCross aria-hidden />}>Changes unavailable</StateRow>
      ) : null}
      {changes.state === 'unread' ? <StateRow icon={<IconChanges aria-hidden />}>Show changes</StateRow> : null}
      {clean ? <StateRow icon={<IconCheckmark2Medium aria-hidden />}>No changes</StateRow> : null}
      {changes.state === 'read' && !clean ? <ReadChanges stats={changes.stats} linesId={linesId} /> : null}
    </button>
  );
}
