import type { Heartbeat } from '@mastra/client-js';
import { Button, Input, Textarea, Txt } from '@mastra/playground-ui';
import { CheckIcon, PencilIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useUpdateHeartbeat } from '@/domains/heartbeats/hooks/use-heartbeats';
import { useThread } from '@/domains/memory/hooks/use-memory';
import { ScheduleStatusText } from '@/domains/schedules/components/schedule-status-badge';
import { formatRelativeTime, formatScheduleTimestamp } from '@/domains/schedules/utils/format';
import { useLinkComponent } from '@/lib/framework';

function MetaItem({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <Txt variant="ui-xs" className="text-neutral4 uppercase tracking-wide">
          {label}
        </Txt>
        {action}
      </div>
      <div className="text-ui-md">{children}</div>
    </div>
  );
}

function EditIconButton({ onClick, label, testId }: { onClick: () => void; label: string; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-neutral4 hover:text-icon6 transition-colors"
      aria-label={label}
      data-testid={testId}
    >
      <PencilIcon className="h-3.5 w-3.5" />
    </button>
  );
}

function ThreadRow({ agentId, threadId }: { agentId: string; threadId: string }) {
  const { paths } = useLinkComponent();
  const { data: thread } = useThread({ agentId, threadId });
  const label = thread?.title?.trim() ? thread.title : threadId;

  return (
    <MetaItem label="Thread">
      <Link
        to={paths.agentThreadLink(agentId, threadId)}
        className="text-accent1 hover:underline break-all"
        data-testid="heartbeat-thread-link"
      >
        {label}
      </Link>
    </MetaItem>
  );
}

function CronRow({ heartbeat }: { heartbeat: Heartbeat }) {
  const update = useUpdateHeartbeat(heartbeat.agentId, heartbeat.id);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(heartbeat.cron);

  const startEdit = () => {
    setValue(heartbeat.cron);
    setEditing(true);
  };
  const cancel = () => {
    setValue(heartbeat.cron);
    setEditing(false);
  };
  const save = () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === heartbeat.cron) {
      cancel();
      return;
    }
    update.mutate(
      { cron: trimmed },
      {
        onSuccess: () => setEditing(false),
      },
    );
  };

  return (
    <MetaItem
      label="Cron"
      action={!editing ? <EditIconButton onClick={startEdit} label="Edit cron" testId="heartbeat-cron-edit" /> : null}
    >
      {editing ? (
        <div className="flex items-center gap-2">
          <Input
            value={value}
            onChange={e => setValue(e.target.value)}
            disabled={update.isPending}
            data-testid="heartbeat-cron-input"
            autoFocus
          />
          <Button onClick={save} disabled={update.isPending} size="sm" data-testid="heartbeat-cron-save">
            <CheckIcon className="h-3.5 w-3.5" />
          </Button>
          <Button onClick={cancel} disabled={update.isPending} size="sm" variant="ghost">
            <XIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <code className="font-mono text-ui-md">{heartbeat.cron}</code>
          {heartbeat.timezone ? <span className="text-neutral4 text-ui-sm">{heartbeat.timezone}</span> : null}
        </div>
      )}
    </MetaItem>
  );
}

function PromptRow({ heartbeat }: { heartbeat: Heartbeat }) {
  const update = useUpdateHeartbeat(heartbeat.agentId, heartbeat.id);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(heartbeat.prompt ?? '');

  const startEdit = () => {
    setValue(heartbeat.prompt ?? '');
    setEditing(true);
  };
  const cancel = () => {
    setValue(heartbeat.prompt ?? '');
    setEditing(false);
  };
  const save = () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === (heartbeat.prompt ?? '').trim()) {
      cancel();
      return;
    }
    update.mutate(
      { prompt: trimmed },
      {
        onSuccess: () => setEditing(false),
      },
    );
  };

  if (!editing && !heartbeat.prompt) {
    return (
      <MetaItem
        label="Prompt"
        action={<EditIconButton onClick={startEdit} label="Edit prompt" testId="heartbeat-prompt-edit" />}
      >
        <span className="text-neutral4 text-ui-sm">No prompt</span>
      </MetaItem>
    );
  }

  return (
    <MetaItem
      label="Prompt"
      action={
        !editing ? <EditIconButton onClick={startEdit} label="Edit prompt" testId="heartbeat-prompt-edit" /> : null
      }
    >
      {editing ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            disabled={update.isPending}
            rows={4}
            data-testid="heartbeat-prompt-input"
            autoFocus
          />
          <div className="flex items-center gap-2 justify-end">
            <Button onClick={cancel} disabled={update.isPending} size="sm" variant="ghost">
              Cancel
            </Button>
            <Button onClick={save} disabled={update.isPending} size="sm" data-testid="heartbeat-prompt-save">
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-ui-sm">{heartbeat.prompt}</p>
      )}
    </MetaItem>
  );
}

export function HeartbeatMetaCard({ heartbeat }: { heartbeat: Heartbeat }) {
  const { paths } = useLinkComponent();
  const mode = heartbeat.threadId ? 'Threaded' : 'Threadless';

  return (
    <div className="flex flex-col gap-4 border border-border1 rounded-md p-4 h-fit">
      <MetaItem label="Agent">
        <Link to={paths.agentLink(heartbeat.agentId)} className="text-accent1 hover:underline">
          {heartbeat.agentId}
        </Link>
      </MetaItem>

      <MetaItem label="Mode">{mode}</MetaItem>

      {heartbeat.threadId ? <ThreadRow agentId={heartbeat.agentId} threadId={heartbeat.threadId} /> : null}

      {heartbeat.resourceId ? (
        <MetaItem label="Resource">
          <code className="font-mono text-ui-sm break-all">{heartbeat.resourceId}</code>
        </MetaItem>
      ) : null}

      <CronRow heartbeat={heartbeat} />

      <MetaItem label="Status">
        <ScheduleStatusText status={heartbeat.status} />
      </MetaItem>

      <MetaItem label="Next fire">
        <span title={formatScheduleTimestamp(heartbeat.nextFireAt)}>{formatRelativeTime(heartbeat.nextFireAt)}</span>
      </MetaItem>

      <PromptRow heartbeat={heartbeat} />

      {heartbeat.threadId ? (
        <>
          {heartbeat.signalType ? <MetaItem label="Signal type">{heartbeat.signalType}</MetaItem> : null}
          {heartbeat.ifActive ? <MetaItem label="If active">{heartbeat.ifActive}</MetaItem> : null}
          {heartbeat.ifIdle ? <MetaItem label="If idle">{heartbeat.ifIdle}</MetaItem> : null}
        </>
      ) : null}

      {heartbeat.activeHours ? (
        <MetaItem label="Active hours">
          {heartbeat.activeHours.start} – {heartbeat.activeHours.end}
          {heartbeat.activeHours.timezone ? (
            <span className="text-neutral4 ml-2 text-ui-sm">{heartbeat.activeHours.timezone}</span>
          ) : null}
        </MetaItem>
      ) : null}

      {heartbeat.idleThresholdMs ? <MetaItem label="Idle threshold">{heartbeat.idleThresholdMs} ms</MetaItem> : null}
    </div>
  );
}
