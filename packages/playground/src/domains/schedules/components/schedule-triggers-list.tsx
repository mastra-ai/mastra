import type { ScheduleTriggerResponse } from '@mastra/client-js';
import { Badge, EntityList, EntityListSkeleton, Txt } from '@mastra/playground-ui';
import { formatScheduleTimestamp } from '../utils/format';

export interface ScheduleTriggersListProps {
  triggers: ScheduleTriggerResponse[];
  isLoading: boolean;
}

const COLUMNS = 'auto auto auto auto auto';

export function ScheduleTriggersList({ triggers, isLoading }: ScheduleTriggersListProps) {
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
        <EntityList.TopCell>Run ID</EntityList.TopCell>
        <EntityList.TopCell>Status</EntityList.TopCell>
        <EntityList.TopCell>Scheduled fire</EntityList.TopCell>
        <EntityList.TopCell>Actual fire</EntityList.TopCell>
        <EntityList.TopCell>Drift</EntityList.TopCell>
      </EntityList.Top>

      {triggers.map(t => {
        const driftMs = t.actualFireAt - t.scheduledFireAt;
        return (
          <EntityList.Row key={`${t.scheduleId}-${t.runId}-${t.actualFireAt}`}>
            <EntityList.NameCell>{t.runId}</EntityList.NameCell>
            <EntityList.TextCell>
              <Badge variant={t.status === 'published' ? 'success' : 'error'}>{t.status}</Badge>
            </EntityList.TextCell>
            <EntityList.TextCell>{formatScheduleTimestamp(t.scheduledFireAt)}</EntityList.TextCell>
            <EntityList.TextCell>{formatScheduleTimestamp(t.actualFireAt)}</EntityList.TextCell>
            <EntityList.TextCell>{driftMs >= 0 ? `+${driftMs}ms` : `${driftMs}ms`}</EntityList.TextCell>
          </EntityList.Row>
        );
      })}
    </EntityList>
  );
}
