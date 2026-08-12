import { Badge } from '@mastra/playground-ui/components/Badge';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Popover, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useQueueHealthThresholds } from '../../../../hooks/useQueueHealthThresholds';
import { useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { useWorkspaceActivity } from '../../../../hooks/useWorkspaceActivity';
import { useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import type { QueueHealthSelection } from './QueueHealthChart';
import { QueueHealthChart, formatAgeSeconds } from './QueueHealthChart';
import type { AgeBucket, QueueHealth, QueueHealthEntry } from '../queue-health';
import { computeQueueHealth } from '../queue-health';
import { stageLabel } from '../stages';

const BUCKET_LABEL: Record<AgeBucket, string> = {
  green: 'Fresh',
  amber: 'Aging',
  orange: 'Stale',
  red: 'Critical',
};

const DEFAULT_THRESHOLDS = [14400, 86400, 259200];

/** An open drill-down is a cohort plus the cell it hangs off. */
interface DrillDown {
  selection: QueueHealthSelection;
  anchor: HTMLElement;
}

export function QueueHealthPanel({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const workItemsQuery = useWorkItemsQuery(factoryProjectId);
  const thresholdsQuery = useQueueHealthThresholds(factoryProjectId);
  const activePaths = useActivePaths();
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);

  const health = useMemo(() => {
    const items = workItemsQuery.data ?? [];
    const config = thresholdsQuery.data ?? { thresholdsSeconds: DEFAULT_THRESHOLDS };
    return computeQueueHealth(items, activePaths, config, new Date());
  }, [workItemsQuery.data, activePaths, thresholdsQuery.data]);

  if (workItemsQuery.isError) {
    return <Notice variant="destructive">{(workItemsQuery.error as Error).message}</Notice>;
  }
  if (thresholdsQuery.isError) {
    return <Notice variant="destructive">{(thresholdsQuery.error as Error).message}</Notice>;
  }

  if (!workItemsQuery.data || !thresholdsQuery.data) {
    return (
      <div role="status" aria-label="Loading queue health" className="flex flex-col gap-5">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const thresholds = thresholdsQuery.data.thresholdsSeconds;
  const entries = drillDown ? cohortEntries(health, drillDown.selection) : [];
  // Work items refetch on a timer: a cohort emptying unmounts the cell the
  // popover hangs off, leaving the anchor detached.
  if (drillDown && entries.length === 0) setDrillDown(null);
  const cohort = drillDown?.selection ?? null;

  return (
    <>
      <QueueHealthChart
        health={health}
        thresholdsSeconds={thresholds}
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

function useActivePaths(): ReadonlySet<string> {
  const { baseUrl } = useApiConfig();
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const repository = factoryQuery.data?.repositories[0];
  const workspaces = useWorkspacesQuery(repository?.projectRepositoryId);
  const workspaceSessions = workspaces.data?.workspaces ?? [];
  const resourceId = factoryQuery.data?.id;
  const workspaceIds = workspaceSessions.map(workspace => workspace.sessionId);
  const runningByPath = useWorkspaceActivity({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId: resourceId ?? '',
    workspaceIds,
    baseUrl,
    enabled: Boolean(resourceId && repository?.projectRepositoryId),
  });
  return useMemo(() => new Set(Object.keys(runningByPath).filter(path => runningByPath[path])), [runningByPath]);
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
          <li
            key={`${entry.itemId}:${entry.stage}`}
            // rule sits in the 1px gap below the row — rounded hover bg never meets it
            className={`hover:bg-surface4 after:bg-border1 has-[a:focus-visible]:outline-accent1 relative mb-px flex min-w-0 items-center gap-3 rounded-md px-2 py-2 transition-colors after:absolute after:inset-x-2 after:-bottom-px after:h-px last:mb-0 last:after:hidden has-[a:focus-visible]:outline-2 ${entry.url ? 'cursor-pointer' : ''}`}
          >
            <span className="min-w-0 flex-1">
              {entry.url ? (
                // stretched link — the whole row is the hit area
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ui-sm text-icon5 hover:text-icon6 block truncate no-underline after:absolute after:inset-0 hover:underline focus-visible:outline-none"
                >
                  {entry.title}
                </a>
              ) : (
                <span className="text-ui-sm text-icon5 block truncate">{entry.title}</span>
              )}
              <Txt as="span" variant="ui-xs" className="text-icon3 mt-0.5 block">
                In stage {formatAgeSeconds(entry.ageSeconds)}
              </Txt>
            </span>
            {entry.active ? (
              <span
                role="img"
                aria-label="Agent running"
                className="bg-accent1 inline-flex size-1.5 shrink-0 rounded-full"
              />
            ) : null}
            {selection.stage === null ? <Badge size="xs">{stageLabel(entry.stage)}</Badge> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
