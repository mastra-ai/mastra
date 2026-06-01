import type { Heartbeat, HeartbeatBroadcastMode } from '@mastra/client-js';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Txt,
} from '@mastra/playground-ui';
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

function NameRow({ heartbeat }: { heartbeat: Heartbeat }) {
  const update = useUpdateHeartbeat(heartbeat.agentId, heartbeat.id);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(heartbeat.name ?? '');

  const startEdit = () => {
    setValue(heartbeat.name ?? '');
    setEditing(true);
  };
  const cancel = () => {
    setValue(heartbeat.name ?? '');
    setEditing(false);
  };
  const save = () => {
    const trimmed = value.trim();
    if (trimmed === (heartbeat.name ?? '')) {
      cancel();
      return;
    }
    update.mutate(
      { name: trimmed },
      {
        onSuccess: () => setEditing(false),
      },
    );
  };

  return (
    <MetaItem
      label="Name"
      action={!editing ? <EditIconButton onClick={startEdit} label="Edit name" testId="heartbeat-name-edit" /> : null}
    >
      {editing ? (
        <div className="flex items-center gap-2">
          <Input
            value={value}
            onChange={e => setValue(e.target.value)}
            disabled={update.isPending}
            placeholder="optional label"
            data-testid="heartbeat-name-input"
            autoFocus
          />
          <Button onClick={save} disabled={update.isPending} size="sm" data-testid="heartbeat-name-save">
            <CheckIcon className="h-3.5 w-3.5" />
          </Button>
          <Button onClick={cancel} disabled={update.isPending} size="sm" variant="ghost">
            <XIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : heartbeat.name ? (
        <span className="text-ui-md">{heartbeat.name}</span>
      ) : (
        <span className="text-neutral4 text-ui-sm">Unnamed</span>
      )}
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

const BROADCAST_LABELS: Record<HeartbeatBroadcastMode, string> = {
  live: 'Live — stream every step',
  'on-complete': 'On complete — only final text',
  never: 'Never — silent run',
};

const SIGNAL_TYPE_OPTIONS = ['system-reminder', 'user-message'] as const;
type KnownSignalType = (typeof SIGNAL_TYPE_OPTIONS)[number];

const SIGNAL_TYPE_LABELS: Record<KnownSignalType, string> = {
  'system-reminder': 'System reminder',
  'user-message': 'User message',
};

function SignalTypeRow({ heartbeat }: { heartbeat: Heartbeat }) {
  const update = useUpdateHeartbeat(heartbeat.agentId, heartbeat.id);
  const current = heartbeat.signalType ?? 'system-reminder';
  // If the stored value is a custom string (not one of the known options),
  // surface it as a read-only fallback rather than silently snapping it to a
  // dropdown choice on first save.
  const isCustom = !SIGNAL_TYPE_OPTIONS.includes(current as KnownSignalType);

  const handleChange = (next: string) => {
    if (next === current) return;
    update.mutate({ signalType: next });
  };

  if (isCustom) {
    return <MetaItem label="Message type">{current}</MetaItem>;
  }

  return (
    <MetaItem label="Message type">
      <Select value={current} onValueChange={handleChange} disabled={update.isPending}>
        <SelectTrigger size="sm" aria-label="Message type" data-testid="heartbeat-signal-type-trigger">
          <SelectValue placeholder="Select message type" />
        </SelectTrigger>
        <SelectContent>
          {SIGNAL_TYPE_OPTIONS.map(option => (
            <SelectItem key={option} value={option} data-testid={`heartbeat-signal-type-option-${option}`}>
              {SIGNAL_TYPE_LABELS[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </MetaItem>
  );
}

function BroadcastRow({ heartbeat }: { heartbeat: Heartbeat }) {
  const update = useUpdateHeartbeat(heartbeat.agentId, heartbeat.id);
  const current: HeartbeatBroadcastMode = heartbeat.broadcast ?? 'live';

  const handleChange = (next: string) => {
    const nextMode = next as HeartbeatBroadcastMode;
    if (nextMode === current) return;
    update.mutate({ broadcast: nextMode });
  };

  return (
    <MetaItem label="Broadcast">
      <Select value={current} onValueChange={handleChange} disabled={update.isPending}>
        <SelectTrigger size="sm" aria-label="Broadcast mode" data-testid="heartbeat-broadcast-trigger">
          <SelectValue placeholder="Select broadcast mode" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="live" data-testid="heartbeat-broadcast-option-live">
            {BROADCAST_LABELS.live}
          </SelectItem>
          <SelectItem value="on-complete" data-testid="heartbeat-broadcast-option-on-complete">
            {BROADCAST_LABELS['on-complete']}
          </SelectItem>
          <SelectItem value="never" data-testid="heartbeat-broadcast-option-never">
            {BROADCAST_LABELS.never}
          </SelectItem>
        </SelectContent>
      </Select>
    </MetaItem>
  );
}

export function HeartbeatMetaCard({ heartbeat }: { heartbeat: Heartbeat }) {
  const { paths } = useLinkComponent();

  return (
    <div className="flex flex-col gap-4 border border-border1 rounded-md p-4 h-fit">
      <MetaItem label="Agent">
        <Link to={paths.agentLink(heartbeat.agentId)} className="text-accent1 hover:underline">
          {heartbeat.agentId}
        </Link>
      </MetaItem>

      <NameRow heartbeat={heartbeat} />

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
        {heartbeat.status === 'paused' ? (
          <span className="text-neutral4">Paused</span>
        ) : (
          <span title={formatRelativeTime(heartbeat.nextFireAt)}>{formatScheduleTimestamp(heartbeat.nextFireAt)}</span>
        )}
      </MetaItem>

      <PromptRow heartbeat={heartbeat} />

      <BroadcastRow heartbeat={heartbeat} />

      {heartbeat.threadId ? (
        <>
          <SignalTypeRow heartbeat={heartbeat} />
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
