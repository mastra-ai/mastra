import { isAuditAction } from '@mastra/factory/storage/domains/audit/actions';
import type { AuditAction } from '@mastra/factory/storage/domains/audit/actions';
import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { History } from 'lucide-react';

import { relativeTime } from '../../../../lib/date/relativeTime';
import { SYSTEM_ACTOR_NAME } from '../auditPresentation';
import type { AuditActorProfile, AuditEvent } from '../services/audit';
import { ASSIGNED_ACTION, CREATED_ACTION } from '../workItemActivity';
import type { WorkItemActivity as WorkItemActivityData } from '../workItemActivity';
import { Txt } from '@mastra/playground-ui/components/Txt';

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const ACTION_LABELS: Partial<Record<AuditAction | typeof ASSIGNED_ACTION, string>> = {
  [ASSIGNED_ACTION]: 'Assigned the item',
  'factory.work_item.updated': 'Updated the item',
  'factory.work_item.stage_moved': 'Moved the item',
  'factory.work_item.deleted': 'Removed the item',
  'factory.run.started': 'Started a run',
  'factory.run.ended': 'Run ended',
  'factory.run.approved': 'Started a suggested run',
  'factory.run.dismissed': 'Dismissed a suggested run',
};

function knownActionLabel(action: string): string | undefined {
  if (isAuditAction(action) || action === ASSIGNED_ACTION) return ACTION_LABELS[action];
  return undefined;
}

function actionLabel(action: string): string {
  return (
    knownActionLabel(action) ??
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
  if (event.actorType === 'system') return { id: event.actorId, name: SYSTEM_ACTOR_NAME };
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
        <Txt as="span" variant="meta" tone="ink" className="truncate">
          {actor.name}
          {modelId ? (
            <Txt as="span" variant="meta" tone="muted">
              {' '}
              · {modelId}
            </Txt>
          ) : null}
        </Txt>
        <Txt as="span" variant="meta" tone="muted" className="flex items-baseline justify-between gap-3">
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
        </Txt>
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
          <Txt
            as="button"
            variant="meta"
            tone="muted"
            type="button"
            draggable={false}
            className={`hover:text-foreground relative flex min-w-0 items-center gap-1.5 rounded-full ${focusRing}`}
            aria-label={`View activity by ${worker.name}`}
            onPointerDown={event => event.stopPropagation()}
          >
            <span className="max-w-32 truncate">{worker.name}</span>
            <Avatar src={worker.avatarUrl} name={worker.name} size="sm" interactive />
          </Txt>
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
            <History size={14} className="text-muted-foreground" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Txt as="span" variant="column" tone="ink">
                Activity
              </Txt>
              <Txt as="span" variant="meta" tone="muted" className="truncate">
                Last worked on by {worker.name}
              </Txt>
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
            <Txt as="span" variant="meta" tone="muted">
              No recorded activity yet.
            </Txt>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
