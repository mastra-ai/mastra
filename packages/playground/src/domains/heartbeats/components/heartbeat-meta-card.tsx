import type { ScheduleResponse } from '@mastra/client-js';
import { Txt } from '@mastra/playground-ui';
import { Link } from 'react-router';
import { parseHeartbeatInput } from '../utils/parse-heartbeat-input';
import { ScheduleStatusText } from '@/domains/schedules/components/schedule-status-badge';
import { formatRelativeTime, formatScheduleTimestamp } from '@/domains/schedules/utils/format';
import { useLinkComponent } from '@/lib/framework';

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Txt variant="ui-xs" className="text-neutral4 uppercase tracking-wide">
        {label}
      </Txt>
      <div className="text-ui-md">{children}</div>
    </div>
  );
}

export function HeartbeatMetaCard({ schedule }: { schedule: ScheduleResponse }) {
  const { paths } = useLinkComponent();
  const parsed = parseHeartbeatInput(schedule);

  return (
    <div className="flex flex-col gap-4 border border-border1 rounded-md p-4 h-fit">
      <MetaItem label="Agent">
        {parsed?.agentId ? (
          <Link to={paths.agentLink(parsed.agentId)} className="text-accent1 hover:underline">
            {parsed.agentId}
          </Link>
        ) : (
          (schedule.ownerId ?? '—')
        )}
      </MetaItem>

      <MetaItem label="Mode">{parsed?.mode === 'threaded' ? 'Threaded' : 'Threadless'}</MetaItem>

      {parsed?.threadId ? (
        <MetaItem label="Thread">
          <code className="font-mono text-ui-sm break-all">{parsed.threadId}</code>
        </MetaItem>
      ) : null}

      {parsed?.resourceId ? (
        <MetaItem label="Resource">
          <code className="font-mono text-ui-sm break-all">{parsed.resourceId}</code>
        </MetaItem>
      ) : null}

      <MetaItem label="Cron">
        <code className="font-mono text-ui-md">{schedule.cron}</code>
        {schedule.timezone ? <span className="text-neutral4 ml-2 text-ui-sm">{schedule.timezone}</span> : null}
      </MetaItem>

      <MetaItem label="Status">
        <ScheduleStatusText status={schedule.status} />
      </MetaItem>

      <MetaItem label="Next fire">
        <span title={formatScheduleTimestamp(schedule.nextFireAt)}>{formatRelativeTime(schedule.nextFireAt)}</span>
      </MetaItem>

      {parsed?.prompt ? (
        <MetaItem label="Prompt">
          <p className="whitespace-pre-wrap text-ui-sm">{parsed.prompt}</p>
        </MetaItem>
      ) : null}

      {parsed?.mode === 'threaded' ? (
        <>
          {parsed.signalType ? <MetaItem label="Signal type">{parsed.signalType}</MetaItem> : null}
          {parsed.ifActive ? <MetaItem label="If active">{parsed.ifActive}</MetaItem> : null}
          {parsed.ifIdle ? <MetaItem label="If idle">{parsed.ifIdle}</MetaItem> : null}
        </>
      ) : null}

      {parsed?.activeHours ? (
        <MetaItem label="Active hours">
          {parsed.activeHours.start} – {parsed.activeHours.end}
          {parsed.activeHours.timezone ? (
            <span className="text-neutral4 ml-2 text-ui-sm">{parsed.activeHours.timezone}</span>
          ) : null}
        </MetaItem>
      ) : null}

      {parsed?.idleThresholdMs ? <MetaItem label="Idle threshold">{parsed.idleThresholdMs} ms</MetaItem> : null}
    </div>
  );
}
