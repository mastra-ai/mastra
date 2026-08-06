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
 * Best-effort attribution for external items that no human has acted on yet.
 * GitHub issues/PRs expose the opener under `metadata.author`; Linear issues
 * expose the current assignee under `metadata.assignee`. GitHub also gives us
 * an avatar URL directly from `github.com/<login>.png` — Linear doesn't
 * publish a stable public avatar URL, so those fall through to initials.
 */
function externalAuthorProfile(item: WorkItem): AuditActorProfile | undefined {
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
    const assignee = metadataString(item.metadata, 'assignee') ?? metadataString(item.metadata, 'linearAssignee');
    if (!assignee) return undefined;
    return { id: `linear:${assignee}`, name: assignee };
  }
  return undefined;
}

const CREATED_ACTION = 'factory.work_item.created';

/**
 * Synthesize a "created" event from the item itself so review boards populated
 * by GitHub PRs (which have no audit event yet) still show *something* on the
 * timeline. Only emitted when no real create event is already in the audit
 * page, so we don't duplicate history when it exists.
 */
function syntheticCreatedEvent(item: WorkItem, hasRealCreateEvent: boolean): AuditEvent | undefined {
  if (hasRealCreateEvent) return undefined;
  const isHuman = isHumanActor(item.createdBy);
  return {
    id: `synthetic-created:${item.id}`,
    orgId: item.orgId,
    actorId: isHuman ? item.createdBy : (externalAuthorProfile(item)?.id ?? item.createdBy),
    actorType: 'human',
    action: CREATED_ACTION,
    targets: [{ type: 'work_item', id: item.id, name: item.title }],
    metadata: {},
    githubProjectId: item.githubProjectId,
    context: {},
    occurredAt: item.createdAt,
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
  const created = syntheticCreatedEvent(item, hasRealCreated);
  // Timeline is newest-first; the synthetic create event goes last.
  const events = created ? [...auditEvents, created] : auditEvents;

  const external = externalAuthorProfile(item);
  const extraActors: Record<string, AuditActorProfile> = external ? { [external.id]: external } : {};

  const latestHumanEvent = auditEvents.find(event => event.actorType === 'human' && isHumanActor(event.actorId));
  const latestStage = latestStageWorker(item);
  const sessionActorId = Object.values(item.sessions)
    .map(session => session.startedBy)
    .find(isHumanActor);
  const createdBy = isHumanActor(item.createdBy) ? item.createdBy : undefined;

  // Try each source in order; only pick one that has a resolvable profile.
  const candidateActorIds = [latestHumanEvent?.actorId, latestStage?.actorId, sessionActorId, createdBy].filter(
    isHumanActor,
  );
  for (const actorId of candidateActorIds) {
    const profile = actorProfile(actorId, actors);
    if (profile) return { events, lastWorker: profile, extraActors };
  }

  // Nothing internal resolves — fall back to the external author (e.g. the
  // GitHub PR/issue opener) so review cards created by the rule dispatcher
  // still show *someone*. Only when there's no external author either do we
  // render the card without attribution.
  return { events, extraActors, ...(external ? { lastWorker: external } : {}) };
}
