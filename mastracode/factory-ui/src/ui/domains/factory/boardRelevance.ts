import type { BoardCandidate } from './boardCandidates';
import type { BoardKind } from './boardStages';
import type { AuditActorProfile, AuditEventPage } from './services/audit';
import type { WorkItem } from './services/workItems';
import { isHumanActor, workItemHumanActorIds } from './workItemActivity';

export const BOARD_RELEVANCE_TYPES = ['worked', 'authored', 'assigned', 'review-requested'] as const;
export type BoardRelevanceType = (typeof BOARD_RELEVANCE_TYPES)[number];

const NO_RELEVANCE = 'none';

function isBoardRelevanceType(value: string): value is BoardRelevanceType {
  return BOARD_RELEVANCE_TYPES.some(type => type === value);
}

export function boardRelevanceFromQuery(value: string | null, kind: BoardKind): ReadonlySet<BoardRelevanceType> {
  const available = boardRelevanceOptions(kind).map(option => option.id);
  if (value === null) return new Set(available);
  if (value === NO_RELEVANCE) return new Set();
  const selected = value
    .split(',')
    .filter(isBoardRelevanceType)
    .filter(type => available.includes(type));
  return selected.length > 0 ? new Set(selected) : new Set(available);
}

export function boardRelevanceQueryValue(
  selectedTypes: ReadonlySet<BoardRelevanceType>,
  kind: BoardKind,
): string | undefined {
  const available = boardRelevanceOptions(kind).map(option => option.id);
  const selected = available.filter(type => selectedTypes.has(type));
  if (selected.length === available.length) return undefined;
  return selected.length > 0 ? selected.join(',') : NO_RELEVANCE;
}

export interface BoardParticipant extends AuditActorProfile {
  source: 'factory' | 'github' | 'linear';
}

interface RelevanceTarget {
  source: WorkItem['source'];
  metadata: Record<string, unknown>;
}

function metadataString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function metadataStrings(metadata: Record<string, unknown>, key: string): string[] {
  const value = metadata[key];
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => (typeof entry === 'string' && entry.trim() ? [entry.trim()] : []));
}

function externalId(source: RelevanceTarget['source'], name: string): string | undefined {
  if (source === 'github-issue' || source === 'github-pr') return `github:${name.toLowerCase()}`;
  if (source === 'linear-issue') return `linear:${name.toLowerCase()}`;
  return undefined;
}

function externalProfile(source: RelevanceTarget['source'], name: string): BoardParticipant | undefined {
  const id = externalId(source, name);
  if (!id) return undefined;
  if (source === 'github-issue' || source === 'github-pr') {
    return {
      id,
      name,
      avatarUrl: `https://github.com/${encodeURIComponent(name)}.png?size=64`,
      source: 'github',
    };
  }
  return { id, name, source: 'linear' };
}

function externalCreator(target: RelevanceTarget): string | undefined {
  if (target.source === 'github-issue' || target.source === 'github-pr') {
    return metadataString(target.metadata, 'author');
  }
  if (target.source === 'linear-issue') {
    return (
      metadataString(target.metadata, 'creator') ??
      metadataString(target.metadata, 'linearCreator') ??
      metadataString(target.metadata, 'author')
    );
  }
  return undefined;
}

function externalAssignees(target: RelevanceTarget): string[] {
  if (target.source === 'github-issue' || target.source === 'github-pr') {
    const assignees = metadataStrings(target.metadata, 'assignees');
    const assignee = metadataString(target.metadata, 'assignee');
    return [...new Set([...assignees, ...(assignee ? [assignee] : [])])];
  }
  if (target.source === 'linear-issue') {
    const assignee = metadataString(target.metadata, 'assignee') ?? metadataString(target.metadata, 'linearAssignee');
    return assignee ? [assignee] : [];
  }
  return [];
}

function requestedReviewers(target: RelevanceTarget): string[] {
  if (target.source !== 'github-pr') return [];
  return metadataStrings(target.metadata, 'requestedReviewers');
}

function targetRelations(target: RelevanceTarget): Record<Exclude<BoardRelevanceType, 'worked'>, Set<string>> {
  const creator = externalCreator(target);
  return {
    authored: new Set(creator ? [externalId(target.source, creator)].filter((id): id is string => Boolean(id)) : []),
    assigned: new Set(
      externalAssignees(target).flatMap(name => {
        const id = externalId(target.source, name);
        return id ? [id] : [];
      }),
    ),
    'review-requested': new Set(
      requestedReviewers(target).flatMap(name => {
        const id = externalId(target.source, name);
        return id ? [id] : [];
      }),
    ),
  };
}

function targetsWorkItem(event: NonNullable<AuditEventPage>['events'][number], workItemId: string): boolean {
  return event.targets.some(target => target.type === 'work_item' && target.id === workItemId);
}

export function workItemRelevance(
  item: WorkItem,
  activityPage: AuditEventPage | undefined,
): Record<BoardRelevanceType, Set<string>> {
  const external = targetRelations(item);
  const worked = new Set(workItemHumanActorIds(item).map(actorId => `factory:${actorId}`));
  for (const event of activityPage?.events ?? []) {
    if (event.actorType === 'human' && isHumanActor(event.actorId) && targetsWorkItem(event, item.id)) {
      worked.add(`factory:${event.actorId}`);
    }
  }
  const authored = new Set(external.authored);
  if (item.source === 'manual' && isHumanActor(item.createdBy)) authored.add(`factory:${item.createdBy}`);
  return { worked, authored, assigned: external.assigned, 'review-requested': external['review-requested'] };
}

export function candidateRelevance(candidate: BoardCandidate): Record<BoardRelevanceType, Set<string>> {
  const external = targetRelations(candidate);
  return {
    worked: new Set(),
    authored: external.authored,
    assigned: external.assigned,
    'review-requested': external['review-requested'],
  };
}

function matchesRelations(
  relations: Record<BoardRelevanceType, Set<string>>,
  participantId: string,
  selectedTypes: ReadonlySet<BoardRelevanceType>,
): boolean {
  return [...selectedTypes].some(type => relations[type].has(participantId));
}

export function workItemMatchesRelevance(
  item: WorkItem,
  activityPage: AuditEventPage | undefined,
  participantId: string | undefined,
  selectedTypes: ReadonlySet<BoardRelevanceType>,
  liveCandidate?: BoardCandidate,
): boolean {
  if (!participantId) return true;
  if (matchesRelations(workItemRelevance(item, activityPage), participantId, selectedTypes)) return true;
  return liveCandidate ? matchesRelations(candidateRelevance(liveCandidate), participantId, selectedTypes) : false;
}

export function candidateMatchesRelevance(
  candidate: BoardCandidate,
  participantId: string | undefined,
  selectedTypes: ReadonlySet<BoardRelevanceType>,
): boolean {
  if (!participantId) return true;
  return matchesRelations(candidateRelevance(candidate), participantId, selectedTypes);
}

export function boardParticipants({
  items,
  candidates,
  activityPage,
  currentUser,
}: {
  items: readonly WorkItem[];
  candidates: readonly BoardCandidate[];
  activityPage: AuditEventPage | undefined;
  currentUser?: { userId?: string; name?: string; email?: string };
}): BoardParticipant[] {
  const participants = new Map<string, BoardParticipant>();
  const add = (participant: BoardParticipant | undefined) => {
    if (!participant) return;
    const existing = participants.get(participant.id);
    participants.set(
      participant.id,
      existing
        ? {
            ...participant,
            name: existing.name,
            avatarUrl: existing.avatarUrl ?? participant.avatarUrl,
          }
        : participant,
    );
  };

  if (currentUser?.userId && (currentUser.name || currentUser.email)) {
    add({
      id: `factory:${currentUser.userId}`,
      name: currentUser.name ?? currentUser.email!,
      source: 'factory',
    });
  }

  for (const [actorId, profile] of Object.entries(activityPage?.actors ?? {})) {
    if (!isHumanActor(actorId)) continue;
    add({ ...profile, id: `factory:${actorId}`, source: 'factory' });
  }

  for (const item of items) {
    for (const actorId of workItemHumanActorIds(item)) {
      const profile = activityPage?.actors[actorId];
      if (profile) add({ ...profile, id: `factory:${actorId}`, source: 'factory' });
    }
    const creator = externalCreator(item);
    add(creator ? externalProfile(item.source, creator) : undefined);
    for (const assignee of externalAssignees(item)) add(externalProfile(item.source, assignee));
    for (const reviewer of requestedReviewers(item)) add(externalProfile(item.source, reviewer));
  }

  for (const candidate of candidates) {
    const creator = externalCreator(candidate);
    add(creator ? externalProfile(candidate.source, creator) : undefined);
    for (const assignee of externalAssignees(candidate)) add(externalProfile(candidate.source, assignee));
    for (const reviewer of requestedReviewers(candidate)) add(externalProfile(candidate.source, reviewer));
  }

  return [...participants.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function boardRelevanceOptions(kind: BoardKind): Array<{ id: BoardRelevanceType; label: string }> {
  const options: Array<{ id: BoardRelevanceType; label: string }> = [
    { id: 'worked', label: 'Worked on' },
    { id: 'authored', label: 'Authored' },
    { id: 'assigned', label: 'Assigned' },
  ];
  if (kind === 'review') options.push({ id: 'review-requested', label: 'Review requested' });
  return options;
}

function targetLabels(target: RelevanceTarget): string[] {
  return metadataStrings(target.metadata, 'labels');
}

export function workItemLabels(item: WorkItem): string[] {
  return targetLabels(item);
}

export function candidateLabels(candidate: BoardCandidate): string[] {
  return targetLabels(candidate);
}

export function boardLabels({
  items,
  candidates,
}: {
  items: readonly WorkItem[];
  candidates: readonly BoardCandidate[];
}): string[] {
  const labels = new Set<string>();
  for (const item of items) for (const label of targetLabels(item)) labels.add(label);
  for (const candidate of candidates) for (const label of targetLabels(candidate)) labels.add(label);
  return [...labels].sort((left, right) => left.localeCompare(right));
}

/**
 * Read selected labels from the `label` query parameter. Labels are stored as
 * repeated values (`?label=a&label=b`) so that individual labels can contain
 * commas without being split apart on reload.
 */
export function boardLabelsFromQuery(values: readonly string[]): ReadonlySet<string> {
  const labels = new Set<string>();
  for (const raw of values) {
    const trimmed = raw.trim();
    if (trimmed.length > 0) labels.add(trimmed);
  }
  return labels;
}

/**
 * Serialize selected labels as an array of query values to be written with
 * repeated `label` parameters via `URLSearchParams#append`.
 */
export function boardLabelsQueryValues(selectedLabels: ReadonlySet<string>): string[] {
  return [...selectedLabels].sort((left, right) => left.localeCompare(right));
}

export function workItemMatchesLabels(
  item: WorkItem,
  selectedLabels: ReadonlySet<string>,
  liveCandidate?: BoardCandidate,
): boolean {
  if (selectedLabels.size === 0) return true;
  const itemLabels = new Set(targetLabels(item));
  if (liveCandidate) for (const label of targetLabels(liveCandidate)) itemLabels.add(label);
  return [...selectedLabels].every(label => itemLabels.has(label));
}

export function candidateMatchesLabels(candidate: BoardCandidate, selectedLabels: ReadonlySet<string>): boolean {
  if (selectedLabels.size === 0) return true;
  const labels = new Set(targetLabels(candidate));
  return [...selectedLabels].every(label => labels.has(label));
}
