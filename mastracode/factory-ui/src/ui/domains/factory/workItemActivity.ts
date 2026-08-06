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
}

export function isHumanActor(actorId: string | undefined): actorId is string {
  if (!actorId) return false;
  return !AUTOMATION_ACTORS.has(actorId) && !actorId.startsWith('agent:') && !actorId.startsWith('github:');
}

function actorProfile(actorId: string, actors: Record<string, AuditActorProfile>): AuditActorProfile | undefined {
  return actors[actorId];
}

function externalAuthorProfile(item: WorkItem): AuditActorProfile | undefined {
  const author = item.metadata['author'];
  if (typeof author !== 'string' || !author.trim()) return undefined;
  const name = author.trim();
  const isGithubSource = item.source === 'github-issue' || item.source === 'github-pr';
  if (!isGithubSource) return { id: `external:${name}`, name };
  return {
    id: `github:${name}`,
    name,
    avatarUrl: `https://github.com/${encodeURIComponent(name)}.png?size=64`,
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
  const events = page?.events.filter(event => targetsWorkItem(event, item.id)) ?? [];

  const latestHumanEvent = events.find(event => event.actorType === 'human' && isHumanActor(event.actorId));
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
    if (profile) return { events, lastWorker: profile };
  }

  // Nothing internal resolves — fall back to the external author (e.g. the
  // GitHub PR/issue opener) so review cards created by the rule dispatcher
  // still show *someone*. Only when there's no external author either do we
  // render the card without attribution.
  const external = externalAuthorProfile(item);
  return { events, ...(external ? { lastWorker: external } : {}) };
}
