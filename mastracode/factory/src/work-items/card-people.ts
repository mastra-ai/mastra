import type { WorkItemBranchSource } from '../work-item-branch.js';
import type { SourceFacts } from './card-source-filters.js';

/** How a person relates to a card. `worked` is Factory's own record; the others are what the source says. */
export const BOARD_PERSON_ROLES = ['worked', 'authored', 'assigned', 'review-requested'] as const;
export type BoardPersonRole = (typeof BOARD_PERSON_ROLES)[number];
export type ProviderPersonRole = Exclude<BoardPersonRole, 'worked'>;

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

/** The participant ids related to a card, by role. */
export type BoardRelations = Record<BoardPersonRole, ReadonlySet<string>>;
export type BoardPeopleFilters = Record<BoardPersonFieldId, ReadonlySet<string>>;

export type ProviderPersonSource = 'github' | 'gitlab' | 'linear' | 'jira' | 'incidentio';

/** A person as a source names them. The id is `<provider>:<lowercased name>`. */
export interface ProviderPerson {
  id: string;
  name: string;
  source: ProviderPersonSource;
}

/** The participant id of a Factory user. */
export function factoryParticipantId(userId: string): string {
  return `factory:${userId}`;
}

/** The provider whose people a source names; undefined for a card no provider filed. */
function personSource(source: WorkItemBranchSource): ProviderPersonSource | undefined {
  switch (source) {
    case 'github-issue':
    case 'github-pr':
      return 'github';
    case 'gitlab-issue':
    case 'gitlab-pr':
      return 'gitlab';
    case 'linear-issue':
      return 'linear';
    case 'jira-issue':
      return 'jira';
    case 'incidentio-follow-up':
      return 'incidentio';
    default:
      return undefined;
  }
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

function creator(provider: ProviderPersonSource, metadata: Record<string, unknown>): string | undefined {
  if (provider === 'github' || provider === 'gitlab') return metadataString(metadata, 'author');
  return (
    metadataString(metadata, 'creator') ??
    metadataString(metadata, 'linearCreator') ??
    metadataString(metadata, 'author')
  );
}

function assignees(provider: ProviderPersonSource, metadata: Record<string, unknown>): string[] {
  if (provider === 'github' || provider === 'gitlab') {
    const assignee = metadataString(metadata, 'assignee');
    return [...new Set([...metadataStrings(metadata, 'assignees'), ...(assignee ? [assignee] : [])])];
  }
  const assignee = metadataString(metadata, 'assignee') ?? metadataString(metadata, 'linearAssignee');
  return assignee ? [assignee] : [];
}

/** Only a pull request has reviewers asked of it. */
function requestedReviewers(item: SourceFacts): string[] {
  if (item.source !== 'github-pr' && item.source !== 'gitlab-pr') return [];
  return metadataStrings(item.metadata, 'requestedReviewers');
}

/** The people the item's source names, by what they are to it. None for an item no provider filed. */
export function providerPeople(item: SourceFacts): Record<ProviderPersonRole, ProviderPerson[]> {
  const source = personSource(item.source);
  if (!source) return { authored: [], assigned: [], 'review-requested': [] };
  const person = (name: string): ProviderPerson => ({ id: `${source}:${name.toLowerCase()}`, name, source });
  const author = creator(source, item.metadata);
  return {
    authored: author ? [person(author)] : [],
    assigned: assignees(source, item.metadata).map(person),
    'review-requested': requestedReviewers(item).map(person),
  };
}

/** Each person filter must match (AND); within one, any picked person in any of its roles will do (OR). */
export function matchesPeople(relations: BoardRelations, picked: BoardPeopleFilters): boolean {
  return BOARD_PERSON_FIELDS.every(field => {
    const ids = picked[field];
    if (ids.size === 0) return true;
    return PERSON_FIELD_ROLES[field].some(role => {
      for (const id of ids) {
        if (relations[role].has(id)) return true;
      }
      return false;
    });
  });
}
