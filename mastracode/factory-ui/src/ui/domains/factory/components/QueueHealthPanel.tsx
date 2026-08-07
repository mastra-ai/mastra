import { Badge } from '@mastra/playground-ui/components/Badge';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { X } from 'lucide-react';
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
import { AGE_BUCKETS, computeQueueHealth } from '../queue-health';
import { stageLabel } from '../stages';

const BUCKET_LABEL: Record<AgeBucket, string> = {
  green: 'Fresh',
  amber: 'Aging',
  orange: 'Stale',
  red: 'Critical',
};

const DEFAULT_THRESHOLDS = [14400, 86400, 259200];

function worstCohort(health: QueueHealth): QueueHealthSelection | null {
  for (let index = AGE_BUCKETS.length - 1; index >= 0; index--) {
    const bucket = AGE_BUCKETS[index]!;
    if (health.stages.some(stage => stage.buckets[bucket] > 0)) return { stage: null, bucket };
  }
  return null;
}

export function QueueHealthPanel({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const workItemsQuery = useWorkItemsQuery(factoryProjectId);
  const thresholdsQuery = useQueueHealthThresholds(factoryProjectId);
  const activePaths = useActivePaths();
  const [selected, setSelected] = useState<QueueHealthSelection | null>(null);
  const [touched, setTouched] = useState(false);

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

  const thresholds = thresholdsQuery.data?.thresholdsSeconds ?? DEFAULT_THRESHOLDS;
  const cohort = touched ? selected : worstCohort(health);
  const drillDown = cohort
    ? health.entries
        .filter(entry => entry.bucket === cohort.bucket && (cohort.stage === null || entry.stage === cohort.stage))
        .sort((a, b) => b.ageSeconds - a.ageSeconds)
    : null;

  return (
    <div className="flex flex-col gap-5">
      {!workItemsQuery.data || !thresholdsQuery.data ? (
        <div role="status" aria-label="Loading queue health" className="flex flex-col gap-5">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          <QueueHealthChart
            health={health}
            thresholdsSeconds={thresholds}
            selected={cohort}
            onSelect={next => {
              setTouched(true);
              setSelected(next);
            }}
          />
          <DrillDownList
            selected={cohort}
            entries={drillDown}
            onClear={() => {
              setTouched(true);
              setSelected(null);
            }}
          />
        </>
      )}
    </div>
  );
}

function useActivePaths(): ReadonlySet<string> {
  const { baseUrl } = useApiConfig();
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const repository = factoryQuery.data?.repositories[0];
  const workspaces = useWorkspacesQuery(repository?.projectRepositoryId);
  const workspaceSessions = workspaces.data?.workspaces ?? [];
  // The factory-level session address is the factory project id, so read
  // activity without materializing a sandbox for a page that only renders counts.
  const resourceId = factoryQuery.data?.id;
  const runningByPath = useWorkspaceActivity({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId: resourceId ?? '',
    scope: repository?.projectRepositoryId,
    worktreePaths: workspaceSessions.map(workspace => workspace.sessionId),
    baseUrl,
    enabled: Boolean(resourceId && repository?.projectRepositoryId),
  });
  return useMemo(() => new Set(Object.keys(runningByPath).filter(path => runningByPath[path])), [runningByPath]);
}

function DrillDownList({
  selected,
  entries,
  onClear,
}: {
  selected: QueueHealthSelection | null;
  entries: QueueHealthEntry[] | null;
  onClear: () => void;
}) {
  if (!selected || !entries) return null;

  const cohort =
    selected.stage === null
      ? BUCKET_LABEL[selected.bucket]
      : `${stageLabel(selected.stage)} · ${BUCKET_LABEL[selected.bucket]}`;

  return (
    <div className="border-border1 flex flex-col gap-1 border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <Txt as="p" variant="ui-sm" className="text-icon5 m-0 font-medium">
          {cohort}
          <Txt as="span" variant="ui-xs" className="text-icon3 ml-2 font-normal">
            {entries.length} {entries.length === 1 ? 'task' : 'tasks'}
          </Txt>
        </Txt>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="text-icon3 hover:text-icon5 hover:bg-surface4 focus-visible:outline-accent1 -mr-1 flex size-6 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-2"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      </div>

      {entries.length === 0 ? (
        <Txt as="p" variant="ui-sm" className="text-icon3 m-0 py-2">
          No tasks in this cohort.
        </Txt>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {entries.map(entry => (
            <li
              key={`${entry.itemId}:${entry.stage}`}
              // rule sits in the 1px gap below the row — rounded hover bg never meets it
              className={`hover:bg-surface4 after:bg-border1 has-[a:focus-visible]:outline-accent1 relative -mx-2 mb-px flex min-w-0 items-center gap-3 rounded-md px-2 py-2 transition-colors after:absolute after:inset-x-2 after:-bottom-px after:h-px last:mb-0 last:after:hidden has-[a:focus-visible]:outline-2 ${entry.url ? 'cursor-pointer' : ''}`}
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
              {selected.stage === null ? <Badge size="xs">{stageLabel(entry.stage)}</Badge> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
