import { isHumanActorId } from '@mastra/factory/storage/domains/audit/actors';
import { BOARD_PERSON_FIELDS, factoryParticipantId, providerPeople } from '@mastra/factory/work-items/card-people';
import type { ProviderPerson } from '@mastra/factory/work-items/card-people';

import type { BoardCandidate } from './boardCandidates';
import type { BoardFilterFieldId, BoardFilterState } from './boardFilters';
import type { AuditActorProfile, AuditEventPage } from './services/audit';

export interface BoardParticipant extends AuditActorProfile {
  source: 'factory' | ProviderPerson['source'];
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

/**
 * What links, saved views and the server's listing read: every id a pick stands for, so they
 * still match for someone who can't fold it.
 */
export function withPeopleUnfolded(filters: BoardFilterState, personId: PersonIdentity): BoardFilterState {
  return withPeopleMapped(filters, personId.aliases);
}

function providerParticipant(person: ProviderPerson): BoardParticipant {
  if (person.source !== 'github') return person;
  return { ...person, avatarUrl: `https://github.com/${encodeURIComponent(person.name)}.png?size=64` };
}

/**
 * The people a person filter offers: the signed-in user, everyone who acted on the project's
 * cards, and everyone a card or an issue not filed yet names.
 */
export function boardParticipants({
  people,
  candidates,
  activityPage,
  currentUser,
  personId,
}: {
  /** The people the project's cards name, as the server lists them. */
  people: readonly ProviderPerson[];
  candidates: readonly BoardCandidate[];
  activityPage: AuditEventPage | undefined;
  currentUser?: { userId?: string; name?: string; email?: string };
  personId: PersonIdentity;
}): BoardParticipant[] {
  const participants = new Map<string, BoardParticipant>();
  const add = (participant: BoardParticipant) => {
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

  for (const person of people) add(providerParticipant(person));
  for (const candidate of candidates) {
    for (const named of Object.values(providerPeople(candidate))) {
      for (const person of named) add(providerParticipant(person));
    }
  }

  return [...participants.values()].sort((left, right) => left.name.localeCompare(right.name));
}
