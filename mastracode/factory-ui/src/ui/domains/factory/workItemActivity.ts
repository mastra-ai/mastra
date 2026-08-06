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

function actorProfile(actorId: string, actors: Record<string, AuditActorProfile>): AuditActorProfile {
  return actors[actorId] ?? { id: actorId, name: actorId };
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
  if (latestHumanEvent) {
    return {
      events,
      lastWorker: actorProfile(latestHumanEvent.actorId, actors),
    };
  }

  const latestStage = latestStageWorker(item);
  const sessionActorId = Object.values(item.sessions)
    .map(session => session.startedBy)
    .find(isHumanActor);
  const createdBy = isHumanActor(item.createdBy) ? item.createdBy : undefined;
  const actorId = latestStage?.actorId ?? sessionActorId ?? createdBy;
  return {
    events,
    ...(actorId ? { lastWorker: actorProfile(actorId, actors) } : {}),
  };
}
