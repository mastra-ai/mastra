/**
 * The Metrics page's live queue-health section: a compact age distribution,
 * stage totals, and click-to-filter task drill-down.
 *
 * Unlike the rest of the Metrics dashboard this is a live snapshot — it is
 * not scoped by the page's date-range control. Aggregation is client-side
 * (`computeQueueHealth`) because the active-work signal is browser-only
 * (`useWorkspaceActivity`); the section merges that polled activity map with
 * the work items + age thresholds it fetches via React Query.
 */
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Card, CardContent } from '@mastra/playground-ui/components/Card';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router';

import { useApiConfig } from '../../../../../shared/api/config';
import { useEnsureMaterializedSandbox } from '../../../../../shared/hooks/useEnsureMaterializedSandbox';
import { useFactoryQuery } from '../../../../../shared/hooks/useFactories';
import { useQueueHealthThresholds } from '../../../../../shared/hooks/useQueueHealthThresholds';
import { useWorkItemsQuery } from '../../../../../shared/hooks/useWorkItems';
import { useWorkspaceActivity } from '../../../../../shared/hooks/useWorkspaceActivity';
import { useWorkspacesQuery } from '../../../../../shared/hooks/useWorkspaces';
import { relativeTime } from '../../../../../shared/lib/date/relativeTime';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import type { QueueHealthSelection } from './QueueHealthChart';
import { QueueHealthChart } from './QueueHealthChart';
import type { AgeBucket, QueueHealthEntry } from '../queue-health';
import { computeQueueHealth } from '../queue-health';
import { stageLabel } from '../stages';

const BUCKET_LABEL: Record<AgeBucket, string> = {
  green: 'Fresh',
  amber: 'Aging',
  orange: 'Stale',
  red: 'Critical',
};

function entriesForBucket(entries: QueueHealthEntry[], bucket: AgeBucket): QueueHealthEntry[] {
  const entriesByItem = new Map<string, QueueHealthEntry>();
  for (const entry of entries) {
    if (entry.bucket === bucket && !entriesByItem.has(entry.itemId)) entriesByItem.set(entry.itemId, entry);
  }
  return [...entriesByItem.values()];
}

function formatAgeSeconds(ageSeconds: number): string {
  return relativeTime(new Date(Date.now() - ageSeconds * 1000).toISOString()) || 'just now';
}

export function QueueHealthSection({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const workItemsQuery = useWorkItemsQuery(factoryProjectId);
  const thresholdsQuery = useQueueHealthThresholds(factoryProjectId);
  const activePaths = useActivePaths();
  const [selected, setSelected] = useState<QueueHealthSelection | null>(null);

  const health = useMemo(() => {
    const items = workItemsQuery.data ?? [];
    const config = thresholdsQuery.data ?? { thresholdsSeconds: [14400, 86400, 259200] };
    return computeQueueHealth(items, activePaths, config, new Date());
  }, [workItemsQuery.data, activePaths, thresholdsQuery.data]);

  if (workItemsQuery.isError) {
    return (
      <Notice variant="destructive">
        {workItemsQuery.error instanceof Error ? workItemsQuery.error.message : 'Failed to load queue health'}
      </Notice>
    );
  }
  if (thresholdsQuery.isError) {
    return (
      <Notice variant="destructive">
        {thresholdsQuery.error instanceof Error ? thresholdsQuery.error.message : 'Failed to load queue thresholds'}
      </Notice>
    );
  }

  const thresholds = thresholdsQuery.data?.thresholdsSeconds ?? [14400, 86400, 259200];
  const drillDown = selected ? entriesForBucket(health.entries, selected.bucket) : null;

  const currentItemIds = new Set<string>();
  const activeItemIds = new Set<string>();
  for (const entry of health.entries) {
    currentItemIds.add(entry.itemId);
    if (entry.active) activeItemIds.add(entry.itemId);
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-1">
          <Txt as="h2" variant="ui-md" className="m-0 font-medium text-icon6">
            Queue health
          </Txt>
          <Txt as="p" variant="ui-sm" className="m-0 text-pretty text-icon3">
            Current work by age and stage. Hover for details; select an age segment to inspect its tasks.
          </Txt>
        </div>
        <Badge size="sm" variant="success">
          Live
        </Badge>
      </div>
      {!workItemsQuery.data ? (
        <Card>
          <CardContent>
            <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
              Loading queue health…
            </Txt>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <Txt as="span" variant="ui-sm" className="text-icon3">
                    Current total
                  </Txt>
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="text-header-lg font-medium tabular-nums text-icon6">{currentItemIds.size}</span>
                    <Txt as="span" variant="ui-sm" className="text-icon4">
                      {currentItemIds.size === 1 ? 'task' : 'tasks'}
                    </Txt>
                  </div>
                </div>
                {activeItemIds.size > 0 ? (
                  <Badge size="xs" variant="success">
                    {activeItemIds.size} active
                  </Badge>
                ) : null}
              </div>
              <QueueHealthChart
                health={health}
                thresholdsSeconds={thresholds}
                selected={selected}
                onSelect={setSelected}
              />
            </CardContent>
          </Card>
          <DrillDownList selected={selected} entries={drillDown} />
        </>
      )}
    </section>
  );
}

/** Set of worktree paths with an agent run in flight (the sidebar dot source). */
function useActivePaths(): ReadonlySet<string> {
  const { baseUrl } = useApiConfig();
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const repository = factoryQuery.data?.repositories[0];
  const materializeQuery = useEnsureMaterializedSandbox(repository?.projectRepositoryId);
  const workspaces = useWorkspacesQuery(repository?.projectRepositoryId);
  const workspaceSessions = workspaces.data?.workspaces ?? [];
  const resourceId = materializeQuery.data?.resourceId;
  const runningByPath = useWorkspaceActivity({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId: resourceId ?? '',
    scope: repository?.projectRepositoryId,
    worktreePaths: workspaceSessions.map(workspace => workspace.sessionId),
    baseUrl,
    enabled: materializeQuery.isSuccess && Boolean(resourceId && repository?.projectRepositoryId),
  });
  return useMemo(() => new Set(Object.keys(runningByPath).filter(path => runningByPath[path])), [runningByPath]);
}

function DrillDownList({
  selected,
  entries,
}: {
  selected: QueueHealthSelection | null;
  entries: QueueHealthEntry[] | null;
}) {
  if (!selected || !entries) return null;
  const bucket = selected.bucket;
  const heading = `${BUCKET_LABEL[bucket]} work`;
  if (entries.length === 0) {
    return (
      <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
        No tasks in {heading.toLowerCase()}.
      </Txt>
    );
  }
  return (
    <>
      <Txt as="p" variant="ui-sm" className="m-0 text-icon4">
        {heading} — {entries.length} {entries.length === 1 ? 'task' : 'tasks'}
      </Txt>
      <ul className="m-0 flex list-none flex-col p-0">
        {entries.map(entry => (
          <li
            key={`${entry.itemId}:${entry.stage}`}
            className="flex min-w-0 flex-col gap-2 border-b border-border1 py-2.5 last:border-b-0 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              {entry.url ? (
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-ui-sm font-medium text-icon5 no-underline hover:text-icon6 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent1"
                >
                  {entry.title}
                </a>
              ) : (
                <span className="block truncate text-ui-sm font-medium text-icon5">{entry.title}</span>
              )}
              <Txt as="span" variant="ui-xs" className="mt-0.5 block text-icon3">
                In this stage {formatAgeSeconds(entry.ageSeconds)}
              </Txt>
            </div>
            <div className="flex items-center gap-2">
              <Badge size="xs">{stageLabel(entry.stage)}</Badge>
              {entry.active ? (
                <Badge size="xs" variant="success">
                  Active
                </Badge>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
