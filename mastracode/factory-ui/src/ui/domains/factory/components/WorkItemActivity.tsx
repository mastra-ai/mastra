import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { cn } from '@mastra/playground-ui/utils/cn';
import { History } from 'lucide-react';

import { relativeTime } from '../../../../lib/date/relativeTime';
import type { AuditActorProfile, AuditEvent } from '../services/audit';
import { CREATED_ACTION } from '../workItemActivity';
import type { WorkItemActivity as WorkItemActivityData } from '../workItemActivity';

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const ACTION_LABELS: Record<string, string> = {
  'factory.work_item.assigned': 'Assigned the item',
  'factory.work_item.updated': 'Updated the item',
  'factory.work_item.stage_moved': 'Moved the item',
  'factory.work_item.deleted': 'Removed the item',
  'factory.run.started': 'Started a run',
  'factory.run.approved': 'Started a suggested run',
  'factory.run.dismissed': 'Dismissed a suggested run',
};

function actionLabel(action: string): string {
  return (
    ACTION_LABELS[action] ??
    action
      .replace(/^factory\./, '')
      .replaceAll('.', ' ')
      .replaceAll('_', ' ')
  );
}

function metadataString(event: AuditEvent, key: string): string | undefined {
  const value = event.metadata[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function eventActor(event: AuditEvent, actors: Record<string, AuditActorProfile>): AuditActorProfile | undefined {
  if (event.actorType === 'agent') {
    return { id: event.actorId, name: metadataString(event, 'agentName') ?? 'Factory agent' };
  }
  return actors[event.actorId];
}

export function ActivityEvent({
  event,
  actors,
  className,
}: {
  event: AuditEvent;
  actors: Record<string, AuditActorProfile>;
  className?: string;
}) {
  const actor = eventActor(event, actors);
  if (!actor) return null;
  const modelId = event.actorType === 'agent' ? metadataString(event, 'modelId') : undefined;
  const isCreated = event.action === CREATED_ACTION;
  return (
    <div className={cn('flex items-start gap-2', className)}>
      <Avatar src={actor.avatarUrl} name={actor.name} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-ui-xs text-icon5 truncate font-medium">
          {actor.name}
          {modelId ? <span className="text-icon3 font-normal"> · {modelId}</span> : null}
        </span>
        <span className="text-ui-xs text-icon3 flex items-baseline justify-between gap-3">
          <span className={cn('min-w-0', isCreated ? 'normal-case' : 'truncate first-letter:uppercase')}>
            {isCreated ? (
              <time dateTime={event.occurredAt}>
                Created at: {timestampFormatter.format(new Date(event.occurredAt))}
              </time>
            ) : (
              actionLabel(event.action)
            )}
          </span>
          {isCreated ? null : (
            <time className="shrink-0" dateTime={event.occurredAt}>
              {relativeTime(event.occurredAt)}
            </time>
          )}
        </span>
      </div>
    </div>
  );
}

export function WorkItemActivity({
  activity,
  actors,
}: {
  activity: WorkItemActivityData;
  actors: Record<string, AuditActorProfile>;
}) {
  const worker = activity.lastWorker;
  const timeline = activity.events.slice(0, 8);
  const mergedActors = { ...actors, ...activity.extraActors };
  if (!worker) return null;

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={150}
        closeDelay={100}
        render={
          <button
            type="button"
            draggable={false}
            className="text-ui-xs text-icon4 hover:text-icon6 focus-visible:outline-accent1 relative flex min-w-0 items-center gap-1.5 rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label={`View activity by ${worker.name}`}
            onPointerDown={event => event.stopPropagation()}
          >
            <span className="max-w-32 truncate">{worker.name}</span>
            <Avatar src={worker.avatarUrl} name={worker.name} size="sm" interactive />
          </button>
        }
      />
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={8}
        collisionPadding={8}
        showArrow={false}
        className="w-80 max-w-[calc(100vw-2rem)]"
        aria-label="Work item activity"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <History size={14} className="text-icon3" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-ui-sm text-icon6 font-medium">Activity</span>
              <span className="text-ui-xs text-icon3 truncate">Last worked on by {worker.name}</span>
            </div>
          </div>
          {timeline.length > 0 ? (
            <ol className="flex flex-col gap-2.5">
              {timeline.map(event => (
                <li key={event.id}>
                  <ActivityEvent event={event} actors={mergedActors} />
                </li>
              ))}
            </ol>
          ) : (
            <span className="text-ui-xs text-icon3">No recorded activity yet.</span>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
