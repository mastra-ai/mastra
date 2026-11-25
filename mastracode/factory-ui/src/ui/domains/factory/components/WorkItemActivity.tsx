import { isAuditAction } from '@mastra/factory/storage/domains/audit/actions';
import type { AuditAction } from '@mastra/factory/storage/domains/audit/actions';
import { CardActivity } from '@mastra/playground-ui/domains/factory';
import type { CardActivityEntry } from '@mastra/playground-ui/domains/factory';
import { cn } from '@mastra/playground-ui/utils/cn';
import { relativeTime } from '../../../../lib/date/relativeTime';
import { SYSTEM_ACTOR_NAME } from '../auditPresentation';
import type { BoardInfo } from '../boardFlow';
import type { AuditActorProfile, AuditEvent } from '../services/audit';
import { ASSIGNED_ACTION, CREATED_ACTION } from '../workItemActivity';
import type { WorkItemActivity as WorkItemActivityData } from '../workItemActivity';

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const ACTION_LABELS: Partial<Record<AuditAction | typeof ASSIGNED_ACTION, string>> = {
  [ASSIGNED_ACTION]: 'Assigned the item',
  'factory.work_item.updated': 'Updated the item',
  'factory.work_item.stage_moved': 'Moved the item',
  'factory.work_item.transition_rejected': 'A move was rejected',
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

/** Actor id prefix of a session agent, whose moves carry the machine cause `factory_tools`. */
const SESSION_AGENT_PREFIX = 'agent:session:';

/** A bound agent's move carries its rationale as the cause; everyone else's cause is a machine code. */
function agentRationale(event: AuditEvent): string | undefined {
  if (event.actorType !== 'agent' || event.actorId.startsWith(SESSION_AGENT_PREFIX)) return undefined;
  return metadataString(event, 'cause');
}

/** "Move to Review rejected: <reason>", naming the phase from the card's own board: phase ids repeat across boards. */
function RejectedMove({ event, board }: { event: AuditEvent; board: BoardInfo | undefined }) {
  const to = metadataString(event, 'to');
  const phase = to === undefined ? undefined : board?.phases.find(phase => phase.id === to);
  const reason = metadataString(event, 'reason') ?? metadataString(event, 'code');
  const text = `Move to ${phase?.name ?? phase?.title ?? to ?? 'another phase'} rejected${reason ? `: ${reason}` : ''}`;
  const rationale = agentRationale(event);
  return (
    <span className="min-w-0 truncate" title={rationale ? `${text}\n\nWhy it was asked: ${rationale}` : text}>
      {text}
    </span>
  );
}

function eventActor(event: AuditEvent, actors: Record<string, AuditActorProfile>): AuditActorProfile | undefined {
  if (event.actorType === 'agent') {
    return { id: event.actorId, name: metadataString(event, 'agentName') ?? 'Factory agent' };
  }
  if (event.actorType === 'system') return { id: event.actorId, name: SYSTEM_ACTOR_NAME };
  return actors[event.actorId];
}

function RelativeTime({ iso }: { iso: string }) {
  return relativeTime(iso);
}

function activityEntry(
  event: AuditEvent,
  actors: Record<string, AuditActorProfile>,
  board: BoardInfo | undefined,
): CardActivityEntry | undefined {
  const actor = eventActor(event, actors);
  if (!actor) return undefined;
  const modelId = event.actorType === 'agent' ? metadataString(event, 'modelId') : undefined;
  const isCreated = event.action === CREATED_ACTION;
  return {
    id: event.id,
    actor,
    ...(modelId ? { detail: modelId } : {}),
    label: (
      <span className={cn('block', isCreated ? 'normal-case' : 'truncate first-letter:uppercase')}>
        {isCreated ? (
          <time dateTime={event.occurredAt}>Created at: {timestampFormatter.format(new Date(event.occurredAt))}</time>
        ) : event.action === 'factory.work_item.transition_rejected' ? (
          <RejectedMove event={event} board={board} />
        ) : (
          actionLabel(event.action)
        )}
      </span>
    ),
    ...(isCreated ? {} : { time: { dateTime: event.occurredAt, label: <RelativeTime iso={event.occurredAt} /> } }),
  };
}

export function WorkItemActivity({
  activity,
  actors,
  board,
  showName = true,
}: {
  activity: WorkItemActivityData;
  actors: Record<string, AuditActorProfile>;
  board: BoardInfo | undefined;
  showName?: boolean;
}) {
  const worker = activity.lastWorker;
  if (!worker) return null;
  const mergedActors = { ...actors, ...activity.extraActors };
  const entries = activity.events
    .slice(0, 8)
    .map(event => activityEntry(event, mergedActors, board))
    .filter((entry): entry is CardActivityEntry => entry !== undefined);
  return <CardActivity worker={worker} entries={entries} showName={showName} />;
}
