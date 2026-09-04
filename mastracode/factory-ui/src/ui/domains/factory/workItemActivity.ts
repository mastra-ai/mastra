import type { AuditActorProfile, AuditEvent, AuditEventPage } from './services/audit';
import type { WorkItem } from './services/workItems';

const AUTOMATION_ACTORS = new Set([
  'factory',
  'system',
  'automation',
  'factory-rule-dispatcher',
  'factory-tool-result-rule',
]);

export interface WorkItemActivity {
  events: AuditEvent[];
  lastWorker?: AuditActorProfile;
  /**
   * Extra actor profiles derived locally (from external metadata like
   * `metadata.author` on GitHub items). Merged with the server-side
   * `AuditEventPage.actors` when the UI renders the timeline so external
   * authors on synthetic "created" events resolve to a name + avatar.
   */
  extraActors: Record<string, AuditActorProfile>;
}

export function isHumanActor(actorId: string | undefined): actorId is string {
  if (!actorId) return false;
  return !AUTOMATION_ACTORS.has(actorId) && !actorId.startsWith('agent:') && !actorId.startsWith('github:');
}

function actorProfile(actorId: string, actors: Record<string, AuditActorProfile>): AuditActorProfile | undefined {
  return actors[actorId];
}

function metadataString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Best-effort creator attribution for external items. GitHub issues/PRs expose
 * the opener under `metadata.author`; Linear issues store the reporter under
 * `metadata.creator`/`metadata.linearCreator`. GitHub also gives us an avatar
 * URL directly from `github.com/<login>.png` — Linear doesn't publish a stable
 * public avatar URL, so those fall through to initials.
 */
function externalCreatorProfile(item: WorkItem): AuditActorProfile | undefined {
  if (item.source === 'github-issue' || item.source === 'github-pr') {
    const author = metadataString(item.metadata, 'author');
    if (!author) return undefined;
    return {
      id: `github:${author}`,
      name: author,
      avatarUrl: `https://github.com/${encodeURIComponent(author)}.png?size=64`,
    };
  }
  if (item.source === 'linear-issue') {
    const creator = metadataString(item.metadata, 'creator') ?? metadataString(item.metadata, 'linearCreator');
    if (!creator) return undefined;
    return { id: `linear:${creator}`, name: creator };
  }
  return undefined;
}

/**
 * Best-effort current-assignee attribution for Linear issues. When present the
 * card treats the assignee as the "last worker" (they own the issue right
 * now), and the timeline gets a separate `assigned` event so the reporter and
 * assignee are both visible.
 */
function externalAssigneeProfile(item: WorkItem): AuditActorProfile | undefined {
  if (item.source !== 'linear-issue') return undefined;
  const assignee = metadataString(item.metadata, 'assignee') ?? metadataString(item.metadata, 'linearAssignee');
  if (!assignee) return undefined;
  return { id: `linear:${assignee}`, name: assignee };
}

export const CREATED_ACTION = 'factory.work_item.created';
const ASSIGNED_ACTION = 'factory.work_item.assigned';

/**
 * Synthesize a "created" event from the item itself so review boards populated
 * by external ingestion (which have no audit event yet) still show *something*
 * on the timeline. Only emitted when no real create event is already in the
 * audit page, so we don't duplicate history when it exists.
 */
function syntheticCreatedEvent(item: WorkItem, hasRealCreateEvent: boolean): AuditEvent | undefined {
  if (hasRealCreateEvent) return undefined;
  const isHuman = isHumanActor(item.createdBy);
  const creator = externalCreatorProfile(item);
  return {
    id: `synthetic-created:${item.id}`,
    actorId: isHuman ? item.createdBy : (creator?.id ?? item.createdBy),
    actorType: 'human',
    action: CREATED_ACTION,
    targets: [{ type: 'work_item', id: item.id, name: item.title }],
    metadata: {},
    occurredAt: item.createdAt,
  };
}

/**
 * Synthesize an "assigned" event when the assignee is known and differs from
 * the reporter/creator. Currently only Linear issues expose a stable
 * assignee, and we anchor the event at `updatedAt` so it sorts after the
 * creation entry in a newest-first timeline.
 */
function syntheticAssignedEvent(
  item: WorkItem,
  creator: AuditActorProfile | undefined,
  assignee: AuditActorProfile | undefined,
  auditEvents: AuditEvent[],
): AuditEvent | undefined {
  if (!assignee) return undefined;
  if (creator && creator.id === assignee.id) return undefined;
  if (auditEvents.some(event => event.action === ASSIGNED_ACTION)) return undefined;
  return {
    id: `synthetic-assigned:${item.id}`,
    actorId: assignee.id,
    actorType: 'human',
    action: ASSIGNED_ACTION,
    targets: [{ type: 'work_item', id: item.id, name: item.title }],
    metadata: {},
    occurredAt: item.updatedAt,
  };
}

function targetsWorkItem(event: AuditEvent, workItemId: string): boolean {
  return event.targets.some(target => target.type === 'work_item' && target.id === workItemId);
}

function latestStageWorker(item: WorkItem): { actorId: string; occurredAt: string } | undefined {
  const candidates = item.stageHistory.flatMap(entry => {
    const actors: Array<{ actorId: string; occurredAt: string }> = [];
    if (isHumanActor(entry.by)) actors.push({ actorId: entry.by, occurredAt: entry.enteredAt });
    if (entry.exitedAt && isHumanActor(entry.exitedBy)) {
      actors.push({ actorId: entry.exitedBy, occurredAt: entry.exitedAt });
    }
    return actors;
  });
  return candidates.reduce<{ actorId: string; occurredAt: string } | undefined>((latest, candidate) => {
    if (!latest || candidate.occurredAt > latest.occurredAt) return candidate;
    return latest;
  }, undefined);
}

export function workItemHumanActorIds(item: WorkItem): string[] {
  const actorIds = [
    item.createdBy,
    ...item.stageHistory.flatMap(entry => [entry.by, entry.exitedBy]),
    ...Object.values(item.sessions).map(session => session.startedBy),
  ].filter(isHumanActor);
  return [...new Set(actorIds)];
}

export function workItemActivity(item: WorkItem, page: AuditEventPage | undefined): WorkItemActivity {
  const actors = page?.actors ?? {};
  const auditEvents = page?.events.filter(event => targetsWorkItem(event, item.id)) ?? [];
  const hasRealCreated = auditEvents.some(event => event.action === CREATED_ACTION);

  const creator = externalCreatorProfile(item);
  const assignee = externalAssigneeProfile(item);

  const created = syntheticCreatedEvent(item, hasRealCreated);
  const assigned = syntheticAssignedEvent(item, creator, assignee, auditEvents);
  // Timeline is newest-first; synthetic entries go at the end (older).
  // `assigned` happened after `created`, so it appears higher in the list.
  const syntheticTail = [assigned, created].filter((event): event is AuditEvent => event !== undefined);
  const events = syntheticTail.length > 0 ? [...auditEvents, ...syntheticTail] : auditEvents;

  const extraActors: Record<string, AuditActorProfile> = {};
  if (creator) extraActors[creator.id] = creator;
  if (assignee) extraActors[assignee.id] = assignee;

  const latestHumanEvent = auditEvents.find(event => event.actorType === 'human' && isHumanActor(event.actorId));
  const latestStage = latestStageWorker(item);
  const sessionActorId = Object.values(item.sessions)
    .map(session => session.startedBy)
    .find(isHumanActor);
  const createdBy = isHumanActor(item.createdBy) ? item.createdBy : undefined;

  // Try each internal source in order; only pick one that has a resolvable
  // profile.
  const candidateActorIds = [latestHumanEvent?.actorId, latestStage?.actorId, sessionActorId, createdBy].filter(
    isHumanActor,
  );
  for (const actorId of candidateActorIds) {
    const profile = actorProfile(actorId, actors);
    if (profile) return { events, lastWorker: profile, extraActors };
  }

  // Nothing internal resolves — fall back to the external contributor. Prefer
  // the current assignee ("who owns this now") over the reporter/opener.
  const externalFallback = assignee ?? creator;
  return { events, extraActors, ...(externalFallback ? { lastWorker: externalFallback } : {}) };
}

/** Comments render as themselves; the audit row each one also writes would show it twice. */
export function timelineEvents(activity: WorkItemActivity): AuditEvent[] {
  return activity.events.filter(event => !event.action.includes('.comment_'));
}
