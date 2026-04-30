import type { ScheduleTriggerResponse } from '@mastra/client-js';
import { Badge, EntityList, EntityListSkeleton, Txt } from '@mastra/playground-ui';
import { formatScheduleTimestamp, formatRelativeTime } from '../utils/format';
import { WorkflowRunStatusBadge } from '@/domains/workflows/components/workflow-run-status-badge';
import { useLinkComponent } from '@/lib/framework';

export interface ScheduleTriggersListProps {
  triggers: ScheduleTriggerResponse[];
  isLoading: boolean;
  workflowId?: string;
}

const COLUMNS = 'auto auto auto auto auto';

function formatDuration(durationMs?: number): string {
  if (durationMs === undefined) return '—';
  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)}s`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.floor((durationMs % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function driftLabel(driftMs: number): string {
  if (Math.abs(driftMs) < 1000) return `${driftMs}ms drift`;
  return `${(driftMs / 1000).toFixed(1)}s drift`;
}

export function ScheduleTriggersList({ triggers, isLoading, workflowId }: ScheduleTriggersListProps) {
  const { Link, paths } = useLinkComponent();

  if (isLoading) {
    return <EntityListSkeleton columns={COLUMNS} />;
  }

  if (triggers.length === 0) {
    return (
      <Txt variant="ui-md" className="text-neutral4 p-4">
        No trigger history yet.
      </Txt>
    );
  }

  return (
    <EntityList columns={COLUMNS}>
      <EntityList.Top>
        <EntityList.TopCell>Run</EntityList.TopCell>
        <EntityList.TopCell>Status</EntityList.TopCell>
        <EntityList.TopCell>Started</EntityList.TopCell>
        <EntityList.TopCell>Duration</EntityList.TopCell>
        <EntityList.TopCell>Notes</EntityList.TopCell>
      </EntityList.Top>

      {triggers.map(t => {
        const driftMs = t.actualFireAt - t.scheduledFireAt;
        const tooltip = `Scheduled ${formatScheduleTimestamp(t.scheduledFireAt)} — actual ${formatScheduleTimestamp(t.actualFireAt)} (${driftLabel(driftMs)})`;
        const isPublishFailure = t.status === 'failed';
        const showRunPending = !isPublishFailure && !t.run;

        return (
          <EntityList.Row key={`${t.scheduleId}-${t.runId}-${t.actualFireAt}`}>
            <EntityList.NameCell>
              {workflowId && !isPublishFailure ? (
                <Link to={paths.workflowRunLink(workflowId, t.runId)} className="text-accent1 hover:underline">
                  <span className="font-mono text-ui-sm">{t.runId}</span>
                </Link>
              ) : (
                <span className="font-mono text-ui-sm text-neutral3">{t.runId}</span>
              )}
            </EntityList.NameCell>

            <EntityList.TextCell>
              {isPublishFailure ? (
                <Badge variant="error" title={t.error ?? 'publish failed'}>
                  publish failed
                </Badge>
              ) : t.run ? (
                <WorkflowRunStatusBadge status={t.run.status} />
              ) : (
                <Badge variant="default">pending</Badge>
              )}
            </EntityList.TextCell>

            <EntityList.TextCell>
              <span title={tooltip}>{formatRelativeTime(t.actualFireAt)}</span>
              {Math.abs(driftMs) > 30_000 ? (
                <span className="text-accent3 text-ui-xs ml-2" title={driftLabel(driftMs)}>
                  ⚠
                </span>
              ) : null}
            </EntityList.TextCell>

            <EntityList.TextCell>
              {t.run ? <span>{formatDuration(t.run.durationMs)}</span> : <span className="text-neutral4">—</span>}
            </EntityList.TextCell>

            <EntityList.TextCell>
              {isPublishFailure && t.error ? (
                <span className="text-accent2 text-ui-sm" title={t.error}>
                  {t.error}
                </span>
              ) : t.run?.error ? (
                <span className="text-accent2 text-ui-sm" title={t.run.error}>
                  {t.run.error}
                </span>
              ) : showRunPending ? (
                <span className="text-neutral4 text-ui-sm">Run pending…</span>
              ) : null}
            </EntityList.TextCell>
          </EntityList.Row>
        );
      })}
    </EntityList>
  );
}
