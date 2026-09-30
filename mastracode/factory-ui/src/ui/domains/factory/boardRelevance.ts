import { isHumanActorId } from '@mastra/factory/storage/domains/audit/actors';

import type { BoardCandidate } from './boardCandidates';
import type { BoardKind } from './boardStages';
import type { AuditActorProfile, AuditEventPage } from './services/audit';
import type { WorkItem } from './services/workItems';
import { workItemHumanActorIds } from './workItemActivity';

export const BOARD_RELEVANCE_TYPES = ['worked', 'authored', 'assigned', 'review-requested'] as const;
export type BoardRelevanceType = (typeof BOARD_RELEVANCE_TYPES)[number];

function isBoardRelevanceType(value: string): value is BoardRelevanceType {
  return BOARD_RELEVANCE_TYPES.some(type => type === value);
}

export function boardRelevanceFromQuery(value: string | null, kind: BoardKind): ReadonlySet<BoardRelevanceType> {
  const available = boardRelevanceOptions(kind).map(option => option.id);
  if (value === null) return new Set(available);
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
  return selected.length > 0 && selected.length < available.length ? selected.join(',') : undefined;
}

export interface BoardParticipant extends AuditActorProfile {
  source: 'factory' | 'github' | 'gitlab' | 'linear' | 'jira' | 'incidentio';
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
  if (source === 'gitlab-issue' || source === 'gitlab-pr') return `gitlab:${name.toLowerCase()}`;
  if (source === 'linear-issue') return `linear:${name.toLowerCase()}`;
  if (source === 'jira-issue') return `jira:${name.toLowerCase()}`;
  if (source === 'incidentio-follow-up') return `incidentio:${name.toLowerCase()}`;
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
  if (source === 'gitlab-issue' || source === 'gitlab-pr') return { id, name, source: 'gitlab' };
  return {
    id,
    name,
    source: source === 'jira-issue' ? 'jira' : source === 'incidentio-follow-up' ? 'incidentio' : 'linear',
  };
}

function externalCreator(target: RelevanceTarget): string | undefined {
  if (
    target.source === 'github-issue' ||
    target.source === 'github-pr' ||
    target.source === 'gitlab-issue' ||
    target.source === 'gitlab-pr'
  ) {
    return metadataString(target.metadata, 'author');
  }
  if (target.source === 'linear-issue' || target.source === 'jira-issue' || target.source === 'incidentio-follow-up') {
    return (
      metadataString(target.metadata, 'creator') ??
      metadataString(target.metadata, 'linearCreator') ??
      metadataString(target.metadata, 'author')
    );
  }
  return undefined;
}

function externalAssignees(target: RelevanceTarget): string[] {
  if (
    target.source === 'github-issue' ||
    target.source === 'github-pr' ||
    target.source === 'gitlab-issue' ||
    target.source === 'gitlab-pr'
  ) {
    const assignees = metadataStrings(target.metadata, 'assignees');
    const assignee = metadataString(target.metadata, 'assignee');
    return [...new Set([...assignees, ...(assignee ? [assignee] : [])])];
  }
  if (target.source === 'linear-issue' || target.source === 'jira-issue' || target.source === 'incidentio-follow-up') {
    const assignee = metadataString(target.metadata, 'assignee') ?? metadataString(target.metadata, 'linearAssignee');
    return assignee ? [assignee] : [];
  }
  return [];
}

function requestedReviewers(target: RelevanceTarget): string[] {
  if (target.source !== 'github-pr' && target.source !== 'gitlab-pr') return [];
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
    if (event.actorType === 'human' && isHumanActorId(event.actorId) && targetsWorkItem(event, item.id)) {
      worked.add(`factory:${event.actorId}`);
    }
  }
  const authored = new Set(external.authored);
  if (item.source === 'manual' && isHumanActorId(item.createdBy)) authored.add(`factory:${item.createdBy}`);
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

/**
 * The identity roster maps a Factory user to every match ID that represents
 * them on records — their `factory:<uid>` id plus every `${integrationId}:${externalId}`
 * they've claimed. When a picked teammate resolves through this map, matching
 * spans every one of their external identities in one predicate call, so
 * searching "Alice" surfaces her Linear issues, her GitHub PRs, and her
 * Factory-authored work items together.
 */
export type ParticipantExpansion = ReadonlyMap<string, ReadonlySet<string>>;

/**
 * Build a participant expansion from the org roster. Keys are the picker's
 * `factory:<uid>` ids; values are the full match-ID set for that user
 * (`factory:<uid>` + every claimed external id). Empty when the roster is
 * empty, which lets callers pass a stable reference unconditionally.
 */
export function participantExpansionFromRoster(
  roster: ReadonlyMap<string, ReadonlyMap<string, ReadonlySet<string>>>,
): ParticipantExpansion {
  const expansion = new Map<string, Set<string>>();
  for (const [userId, claims] of roster) {
    const ids = new Set<string>();
    ids.add(`factory:${userId}`);
    for (const [integrationId, externalIds] of claims) {
      for (const externalId of externalIds) {
        ids.add(`${integrationId}:${externalId.toLowerCase()}`);
      }
    }
    expansion.set(`factory:${userId}`, ids);
  }
  return expansion;
}

function matchesRelationsAnyOf(
  relations: Record<BoardRelevanceType, Set<string>>,
  ids: ReadonlySet<string>,
  selectedTypes: ReadonlySet<BoardRelevanceType>,
): boolean {
  if (ids.size === 0) return false;
  for (const type of selectedTypes) {
    for (const id of relations[type]) {
      if (ids.has(id)) return true;
    }
  }
  return false;
}

/**
 * The acting user's claimed external accounts, one set per integration.
 * Sourced from `useResolvedMe`; only the ids the user has explicitly
 * claimed appear here — a GitHub login the user hasn't claimed does not
 * belong even if it happens to be theirs on the provider.
 *
 * Cmd+K search still consumes this to expand its hidden `@me` token; the
 * board's teammate picker uses the org roster directly instead (picking
 * your own `factory:<uid>` expands across every identity you've claimed).
 */
export type ResolvedMe = ReadonlyMap<string, ReadonlySet<string>>;

export function workItemMatchesRelevance(
  item: WorkItem,
  activityPage: AuditEventPage | undefined,
  participantId: string | undefined,
  selectedTypes: ReadonlySet<BoardRelevanceType>,
  liveCandidate?: BoardCandidate,
  /**
   * Optional roster expansion. When the picked `participantId` is a Factory
   * user with claims, matches against every identity they've claimed so a
   * single picked coworker surfaces their records across every integration.
   * Absent participants fall through to the single-id path unchanged.
   */
  expansion?: ParticipantExpansion,
): boolean {
  if (!participantId) return true;
  const expanded = expansion?.get(participantId);
  if (expanded) {
    if (matchesRelationsAnyOf(workItemRelevance(item, activityPage), expanded, selectedTypes)) return true;
    return liveCandidate ? matchesRelationsAnyOf(candidateRelevance(liveCandidate), expanded, selectedTypes) : false;
  }
  if (matchesRelations(workItemRelevance(item, activityPage), participantId, selectedTypes)) return true;
  return liveCandidate ? matchesRelations(candidateRelevance(liveCandidate), participantId, selectedTypes) : false;
}

export function candidateMatchesRelevance(
  candidate: BoardCandidate,
  participantId: string | undefined,
  selectedTypes: ReadonlySet<BoardRelevanceType>,
  /** Optional roster expansion; see {@link workItemMatchesRelevance}. */
  expansion?: ParticipantExpansion,
): boolean {
  if (!participantId) return true;
  const expanded = expansion?.get(participantId);
  if (expanded) return matchesRelationsAnyOf(candidateRelevance(candidate), expanded, selectedTypes);
  return matchesRelations(candidateRelevance(candidate), participantId, selectedTypes);
}

export function boardParticipants({
  items,
  candidates,
  activityPage,
  currentUser,
  roster,
}: {
  items: readonly WorkItem[];
  candidates: readonly BoardCandidate[];
  activityPage: AuditEventPage | undefined;
  currentUser?: { userId?: string; name?: string; email?: string };
  /**
   * Optional org identity roster. When present, external ids that resolve
   * to a known Factory user via a claim are dropped from the picker so the
   * coworker appears once (as `factory:<uid>`) and picking them expands
   * across every identity they've claimed — see {@link workItemMatchesRelevance}.
   */
  roster?: ReadonlyMap<string, ReadonlyMap<string, ReadonlySet<string>>>;
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
    if (!isHumanActorId(actorId)) continue;
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

  // Collapse: any external participant whose id belongs to a claimed identity
  // of a known Factory user is dropped in favour of that Factory participant.
  // This keeps the picker at one row per person; the expansion built from the
  // same roster restores the full match set at filter time.
  if (roster && roster.size > 0) {
    const claimedExternalIds = new Set<string>();
    for (const [userId, claims] of roster) {
      if (!participants.has(`factory:${userId}`)) continue;
      for (const [integrationId, externalIds] of claims) {
        for (const externalId of externalIds) {
          claimedExternalIds.add(`${integrationId}:${externalId.toLowerCase()}`);
        }
      }
    }
    for (const id of claimedExternalIds) participants.delete(id);
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
