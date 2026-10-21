import { isHumanActorId } from '@mastra/factory/storage/domains/audit/actors';

import type { BoardCandidate } from './boardCandidates';
import type { BoardFilterFieldId, BoardFilterState } from './boardFilters';
import type { AuditActorProfile, AuditEventPage } from './services/audit';
import type { WorkItem } from './services/workItems';
import { metadataString, workItemHumanActorIds } from './workItemActivity';

const BOARD_PERSON_ROLES = ['worked', 'authored', 'assigned', 'review-requested'] as const;
type BoardPersonRole = (typeof BOARD_PERSON_ROLES)[number];
type BoardRelations = Record<BoardPersonRole, Set<string>>;

/** One filter per person role, plus `teammate` (shown as Involves) for any role. */
export const BOARD_PERSON_FIELDS = ['teammate', 'author', 'assignee', 'reviewer', 'worked'] as const;
export type BoardPersonFieldId = (typeof BOARD_PERSON_FIELDS)[number];

const PERSON_FIELD_ROLES: Record<BoardPersonFieldId, readonly BoardPersonRole[]> = {
  teammate: BOARD_PERSON_ROLES,
  author: ['authored'],
  assignee: ['assigned'],
  reviewer: ['review-requested'],
  worked: ['worked'],
};

export type BoardPeopleFilters = Pick<BoardFilterState, BoardPersonFieldId>;

export interface BoardParticipant extends AuditActorProfile {
  source: 'factory' | 'github' | 'gitlab' | 'linear' | 'jira' | 'incidentio';
}

export function factoryParticipantId(userId: string): string {
  return `factory:${userId}`;
}

/** `fold` names every identity of one person by one participant id; `aliases` lists every id that one stands for. */
export interface PersonIdentity {
  fold: (participantId: string) => string;
  aliases: (participantId: string) => string[];
}

/** Only the signed-in user's GitHub link is known to the browser; everyone else stays one identity per provider. */
export function boardPersonIdentity(
  currentUserId: string | undefined,
  githubLogin: string | null | undefined,
): PersonIdentity {
  if (!currentUserId || !githubLogin)
    return { fold: participantId => participantId, aliases: participantId => [participantId] };
  const githubId = `github:${githubLogin.toLowerCase()}`;
  const factoryId = factoryParticipantId(currentUserId);
  return {
    fold: participantId => (participantId === githubId ? factoryId : participantId),
    aliases: participantId => (participantId === factoryId ? [factoryId, githubId] : [participantId]),
  };
}

function withPeopleMapped(filters: BoardFilterState, ids: (picked: string) => string[]): BoardFilterState {
  const mapped: Record<BoardFilterFieldId, ReadonlySet<string>> = { ...filters };
  for (const fieldId of BOARD_PERSON_FIELDS) mapped[fieldId] = new Set([...filters[fieldId]].flatMap(ids));
  return mapped;
}

export function withPeopleFolded(filters: BoardFilterState, personId: PersonIdentity): BoardFilterState {
  return withPeopleMapped(filters, picked => [personId.fold(picked)]);
}

/** What links and saved views store: every id a pick stands for, so they still match for someone who can't fold it. */
export function withPeopleUnfolded(filters: BoardFilterState, personId: PersonIdentity): BoardFilterState {
  return withPeopleMapped(filters, personId.aliases);
}

interface RelatedCard {
  source: WorkItem['source'];
  metadata: Record<string, unknown>;
}

function metadataStrings(metadata: Record<string, unknown>, key: string): string[] {
  const value = metadata[key];
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => (typeof entry === 'string' && entry.trim() ? [entry.trim()] : []));
}

function externalId(source: RelatedCard['source'], name: string): string | undefined {
  if (source === 'github-issue' || source === 'github-pr') return `github:${name.toLowerCase()}`;
  if (source === 'gitlab-issue' || source === 'gitlab-pr') return `gitlab:${name.toLowerCase()}`;
  if (source === 'linear-issue') return `linear:${name.toLowerCase()}`;
  if (source === 'jira-issue') return `jira:${name.toLowerCase()}`;
  if (source === 'incidentio-follow-up') return `incidentio:${name.toLowerCase()}`;
  return undefined;
}

function externalProfile(source: RelatedCard['source'], name: string): BoardParticipant | undefined {
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
  if (source === 'gitlab-issue' || source === 'gitlab-pr') return { id, name, source: 'gitlab' };
  if (source === 'jira-issue') return { id, name, source: 'jira' };
  if (source === 'incidentio-follow-up') return { id, name, source: 'incidentio' };
  return { id, name, source: 'linear' };
}

function externalCreator(card: RelatedCard): string | undefined {
  if (
    card.source === 'github-issue' ||
    card.source === 'github-pr' ||
    card.source === 'gitlab-issue' ||
    card.source === 'gitlab-pr'
  ) {
    return metadataString(card.metadata, 'author');
  }
  if (card.source === 'linear-issue' || card.source === 'jira-issue' || card.source === 'incidentio-follow-up') {
    return (
      metadataString(card.metadata, 'creator') ??
      metadataString(card.metadata, 'linearCreator') ??
      metadataString(card.metadata, 'author')
    );
  }
  return undefined;
}

function externalAssignees(card: RelatedCard): string[] {
  if (
    card.source === 'github-issue' ||
    card.source === 'github-pr' ||
    card.source === 'gitlab-issue' ||
    card.source === 'gitlab-pr'
  ) {
    const assignees = metadataStrings(card.metadata, 'assignees');
    const assignee = metadataString(card.metadata, 'assignee');
    return [...new Set([...assignees, ...(assignee ? [assignee] : [])])];
  }
  if (card.source === 'linear-issue' || card.source === 'jira-issue' || card.source === 'incidentio-follow-up') {
    const assignee = metadataString(card.metadata, 'assignee') ?? metadataString(card.metadata, 'linearAssignee');
    return assignee ? [assignee] : [];
  }
  return [];
}

function requestedReviewers(card: RelatedCard): string[] {
  if (card.source !== 'github-pr' && card.source !== 'gitlab-pr') return [];
  return metadataStrings(card.metadata, 'requestedReviewers');
}

function externalIds(source: RelatedCard['source'], names: readonly string[]): Set<string> {
  return new Set(
    names.flatMap(name => {
      const id = externalId(source, name);
      return id ? [id] : [];
    }),
  );
}

function cardRelations(card: RelatedCard): BoardRelations {
  const creator = externalCreator(card);
  return {
    worked: new Set(),
    authored: externalIds(card.source, creator ? [creator] : []),
    assigned: externalIds(card.source, externalAssignees(card)),
    'review-requested': externalIds(card.source, requestedReviewers(card)),
  };
}

function targetsWorkItem(event: NonNullable<AuditEventPage>['events'][number], workItemId: string): boolean {
  return event.targets.some(target => target.type === 'work_item' && target.id === workItemId);
}

/** The item's own relations, plus whatever its live intake candidate now says (a reassignment, a new reviewer). */
function workItemRelations(
  item: WorkItem,
  activityPage: AuditEventPage | undefined,
  liveCandidate: BoardCandidate | undefined,
): BoardRelations {
  const relations = cardRelations(item);
  for (const actorId of workItemHumanActorIds(item)) relations.worked.add(factoryParticipantId(actorId));
  for (const event of activityPage?.events ?? []) {
    if (event.actorType === 'human' && isHumanActorId(event.actorId) && targetsWorkItem(event, item.id)) {
      relations.worked.add(factoryParticipantId(event.actorId));
    }
  }
  if (item.source === 'manual' && isHumanActorId(item.createdBy)) {
    relations.authored.add(factoryParticipantId(item.createdBy));
  }
  if (liveCandidate) {
    const live = cardRelations(liveCandidate);
    for (const role of BOARD_PERSON_ROLES) for (const id of live[role]) relations[role].add(id);
  }
  return relations;
}

/** Each person filter must match (AND); within one, any picked person in any of its roles will do (OR). */
function matchesPeople(relations: BoardRelations, people: BoardPeopleFilters, personId: PersonIdentity): boolean {
  return BOARD_PERSON_FIELDS.every(fieldId => {
    const picked = people[fieldId];
    if (picked.size === 0) return true;
    return PERSON_FIELD_ROLES[fieldId].some(role => [...relations[role]].some(id => picked.has(personId.fold(id))));
  });
}

export function workItemMatchesPeople(
  item: WorkItem,
  activityPage: AuditEventPage | undefined,
  people: BoardPeopleFilters,
  personId: PersonIdentity,
  liveCandidate?: BoardCandidate,
): boolean {
  if (BOARD_PERSON_FIELDS.every(fieldId => people[fieldId].size === 0)) return true;
  return matchesPeople(workItemRelations(item, activityPage, liveCandidate), people, personId);
}

export function candidateMatchesPeople(
  candidate: BoardCandidate,
  people: BoardPeopleFilters,
  personId: PersonIdentity,
): boolean {
  return matchesPeople(cardRelations(candidate), people, personId);
}

export function boardParticipants({
  items,
  candidates,
  activityPage,
  currentUser,
  personId,
}: {
  items: readonly WorkItem[];
  candidates: readonly BoardCandidate[];
  activityPage: AuditEventPage | undefined;
  currentUser?: { userId?: string; name?: string; email?: string };
  personId: PersonIdentity;
}): BoardParticipant[] {
  const participants = new Map<string, BoardParticipant>();
  const add = (participant: BoardParticipant | undefined) => {
    if (!participant) return;
    const id = personId.fold(participant.id);
    const existing = participants.get(id);
    if (!existing) {
      participants.set(id, { ...participant, id });
      return;
    }
    participants.set(id, {
      ...existing,
      avatarUrl: existing.avatarUrl ?? participant.avatarUrl,
    });
  };

  const currentUserName = currentUser?.name || currentUser?.email;
  if (currentUser?.userId && currentUserName) {
    add({
      id: factoryParticipantId(currentUser.userId),
      name: currentUserName,
      source: 'factory',
    });
  }

  for (const [actorId, profile] of Object.entries(activityPage?.actors ?? {})) {
    if (!isHumanActorId(actorId)) continue;
    add({ ...profile, id: factoryParticipantId(actorId), source: 'factory' });
  }

  for (const item of items) {
    for (const actorId of workItemHumanActorIds(item)) {
      const profile = activityPage?.actors[actorId];
      if (profile) add({ ...profile, id: factoryParticipantId(actorId), source: 'factory' });
    }
  }

  for (const card of [...items, ...candidates]) {
    const creator = externalCreator(card);
    add(creator ? externalProfile(card.source, creator) : undefined);
    for (const assignee of externalAssignees(card)) add(externalProfile(card.source, assignee));
    for (const reviewer of requestedReviewers(card)) add(externalProfile(card.source, reviewer));
  }

  return [...participants.values()].sort((left, right) => left.name.localeCompare(right.name));
}
