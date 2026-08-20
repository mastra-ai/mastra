import { Badge } from '@mastra/playground-ui/components/Badge';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Popover, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import type { QueueHealthSelection } from './QueueHealthChart';
import { QueueHealthChart, formatAgeSeconds } from './QueueHealthChart';
import { QueueEntryRow } from './QueueEntryRow';
import type { AgeBucket, QueueHealth, QueueHealthEntry } from '../queue-health';
import { stageLabel } from '../stages';

const BUCKET_LABEL: Record<AgeBucket, string> = {
  green: 'Fresh',
  amber: 'Aging',
  orange: 'Stale',
  red: 'Critical',
};

/** An open drill-down is a cohort plus the cell it hangs off. */
interface DrillDown {
  selection: QueueHealthSelection;
  anchor: HTMLElement;
}

export function QueueHealthPanel({
  health,
  thresholdsSeconds,
  isPending,
  error,
}: {
  health: QueueHealth;
  thresholdsSeconds: number[];
  isPending: boolean;
  error: unknown;
}) {
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);

  if (error) return <Notice variant="destructive">{error instanceof Error ? error.message : 'Failed to load'}</Notice>;

  if (isPending) {
    return (
      <div role="status" aria-label="Loading queue health" className="flex flex-col gap-5">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const entries = drillDown ? cohortEntries(health, drillDown.selection) : [];
  // Work items refetch on a timer: a cohort emptying unmounts the cell the
  // popover hangs off, leaving the anchor detached.
  if (drillDown && entries.length === 0) setDrillDown(null);
  const cohort = drillDown?.selection ?? null;

  return (
    <>
      <QueueHealthChart
        health={health}
        thresholdsSeconds={thresholdsSeconds}
        selected={cohort}
        onSelect={(selection, anchor) => setDrillDown(selection && anchor ? { selection, anchor } : null)}
      />
      <Popover
        open={drillDown !== null}
        onOpenChange={open => {
          if (!open) setDrillDown(null);
        }}
      >
        {drillDown ? (
          <PopoverContent
            anchor={drillDown.anchor}
            side="bottom"
            aria-label={`${cohortLabel(drillDown.selection)} tasks`}
            className="w-80 p-0"
          >
            <CohortTasks selection={drillDown.selection} entries={entries} />
          </PopoverContent>
        ) : null}
      </Popover>
    </>
  );
}

function cohortLabel(selection: QueueHealthSelection): string {
  return selection.stage === null
    ? BUCKET_LABEL[selection.bucket]
    : `${stageLabel(selection.stage)} · ${BUCKET_LABEL[selection.bucket]}`;
}

function cohortEntries(health: QueueHealth, selection: QueueHealthSelection): QueueHealthEntry[] {
  return health.entries
    .filter(entry => entry.bucket === selection.bucket && (selection.stage === null || entry.stage === selection.stage))
    .sort((a, b) => b.ageSeconds - a.ageSeconds);
}

function CohortTasks({ selection, entries }: { selection: QueueHealthSelection; entries: QueueHealthEntry[] }) {
  return (
    <div className="flex max-h-80 flex-col">
      <Txt as="p" variant="ui-sm" className="text-icon5 m-0 px-3 pt-3 pb-1 font-medium">
        {cohortLabel(selection)}
        <Txt as="span" variant="ui-xs" className="text-icon3 ml-2 font-normal">
          {entries.length} {entries.length === 1 ? 'task' : 'tasks'}
        </Txt>
      </Txt>

      <ul className="m-0 flex list-none flex-col overflow-y-auto p-1 pt-0">
        {entries.map(entry => (
          <QueueEntryRow
            key={`${entry.itemId}:${entry.stage}`}
            entry={entry}
            detail={`In stage ${formatAgeSeconds(entry.ageSeconds)}`}
            trailing={selection.stage === null ? <Badge size="xs">{stageLabel(entry.stage)}</Badge> : undefined}
          />
        ))}
      </ul>
    </div>
  );
}
