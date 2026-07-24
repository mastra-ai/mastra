/**
 * The Metrics page's queue-health section: one bar per stage segmented by
 * work-item age, with a stripe overlay where agents are actively running, and
 * a click-to-filter drill-down list of the matching tasks below the chart.
 *
 * Unlike the rest of the Metrics dashboard this is a live snapshot — it is
 * not scoped by the page's date-range control. Aggregation is client-side
 * (`computeQueueHealth`) because the active-work signal is browser-only
 * (`useWorkspaceActivity`); the section merges that polled activity map with
 * the work items + age thresholds it fetches via React Query.
 */
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
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import type { QueueHealthSelection } from './QueueHealthChart';
import { QueueHealthChart, formatAgeSeconds } from './QueueHealthChart';
import type { AgeBucket, QueueHealthEntry } from '../queue-health';
import { computeQueueHealth } from '../queue-health';
import { stageLabel } from '../stages';

const BUCKET_LABEL: Record<AgeBucket, string> = {
  green: 'Fresh',
  amber: 'Aging',
  orange: 'Stale',
  red: 'Critical',
};

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
    return <Notice variant="destructive">{(workItemsQuery.error as Error).message}</Notice>;
  }
  if (thresholdsQuery.isError) {
    return <Notice variant="destructive">{(thresholdsQuery.error as Error).message}</Notice>;
  }

  const thresholds = health ? (thresholdsQuery.data?.thresholdsSeconds ?? [14400, 86400, 259200]) : [];
  const drillDown = selected
    ? health.entries.filter(entry => entry.stage === selected.stage && entry.bucket === selected.bucket)
    : null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border1 bg-surface2 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="m-0 text-ui-md font-medium text-icon5">Queue health</h2>
        <Txt as="span" variant="ui-xs" className="text-icon3">
          Live — not scoped to the date range
        </Txt>
      </div>
      {!workItemsQuery.data ? (
        <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
          Loading queue health…
        </Txt>
      ) : (
        <>
          <QueueHealthChart health={health} thresholdsSeconds={thresholds} selected={selected} onSelect={setSelected} />
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
  if (!selected || !entries || selected.bucket === null) {
    return (
      <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
        Select a segment above to see its tasks.
      </Txt>
    );
  }
  const bucket = selected.bucket;
  const heading = `${stageLabel(selected.stage)} · ${BUCKET_LABEL[bucket]}`;
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
            className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-border1 py-1.5 last:border-b-0"
          >
            {entry.url ? (
              <a
                href={entry.url}
                target="_blank"
                rel="noreferrer"
                className="truncate text-ui-sm text-icon5 no-underline hover:text-icon6 hover:underline"
              >
                {entry.title}
              </a>
            ) : (
              <span className="truncate text-ui-sm text-icon5">{entry.title}</span>
            )}
            <span className="rounded-full bg-surface5 px-1.5 py-0.5 text-ui-xs text-icon4">
              {stageLabel(entry.stage)}
            </span>
            <Txt as="span" variant="ui-xs" className="text-icon3">
              in stage {formatAgeSeconds(entry.ageSeconds)}
            </Txt>
            {entry.active ? (
              <span className="rounded-full bg-green-500/15 px-1.5 py-0.5 text-ui-xs text-green-500">active</span>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
