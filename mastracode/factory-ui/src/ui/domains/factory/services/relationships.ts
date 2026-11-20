import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import { relatedCardIndex } from '@mastra/factory/work-items/related-cards';
import type { PullRequestFacts } from '@mastra/factory/work-items/related-cards';
import { githubNumberForItem, sourceCreatedAt, sourceMetadata, workItemKey } from '../boardItems';
import { CARD_SOURCES } from '../cardSources';
import { CHANGE_REQUEST_TERMS } from '../changeRequestState';
import { relativeTime } from '../../../../lib/date/relativeTime';
import { rememberedBoardPath } from './boardViews';
import type { WorkItem, WorkItemSource } from './workItems';
import { isPullRequestSource } from './workItems';

/** Intake candidates carry a source and metadata but no card, so identifiers work on both. */
type IdentifiableItem = Pick<WorkItem, 'source' | 'workItem' | 'metadata' | 'sourceKey'>;

export function workItemNumber(item: IdentifiableItem): string | undefined {
  const githubNumber = githubNumberForItem(item);
  if (githubNumber !== undefined) return String(githubNumber);
  if (item.source === 'gitlab-pr') {
    const iid = sourceMetadata(item).gitlabMergeRequestIid;
    return typeof iid === 'number' && Number.isSafeInteger(iid) && iid > 0 ? String(iid) : undefined;
  }

  const number = sourceMetadata(item).number;
  if (typeof number === 'number' || typeof number === 'string') return String(number);
  return item.sourceKey?.split(':').at(-1) || undefined;
}

const PULL_REQUEST_FACTS: PullRequestFacts<WorkItem> = {
  isPullRequest: item => isPullRequestSource(item.source),
  headBranch: item => {
    const branch = sourceMetadata(item).headBranch;
    return typeof branch === 'string' ? branch : undefined;
  },
};

/** Relations across `allItems`, read the way the server reads them to scope a session's cards. */
export function relatedWorkItemIndex(allItems: readonly WorkItem[]): (item: WorkItem) => WorkItem[] {
  return relatedCardIndex(allItems, PULL_REQUEST_FACTS);
}

/** A pull request opens the board that holds its card; an unfiled one, or one with no board, opens the default board. */
export function relationshipPath(
  item: Pick<WorkItem, 'source'> & { readonly board?: string | null },
  factoryId: string,
): string {
  if (!isPullRequestSource(item.source) || item.board === undefined)
    return rememberedBoardPath(factoryId, DEFAULT_BOARD_ID);
  return rememberedBoardPath(factoryId, item.board ?? DEFAULT_BOARD_ID);
}

export function relationshipLabel(item: WorkItem, contextRepository?: string): string {
  const reference = workItemReference(item, contextRepository) ?? item.title;
  return isPullRequestSource(item.source) ? `Review: ${reference}` : `Work item: ${reference}`;
}

export function relatedCardName(item: WorkItem, contextRepository?: string): string {
  const relation = relationshipLabel(item, contextRepository);
  return workItemReference(item, contextRepository) === undefined ? relation : `${relation}: ${item.title}`;
}

/** What a person types to find the item: `#20456` on GitHub, `ENG-123` on Linear or Jira. */
export function workItemIdentifier(item: IdentifiableItem): string | undefined {
  const key = workItemKey(item);
  if (key !== undefined) return key;
  // Linear source key already reads `linear:ENG-123` — hashing it would invent `#ENG-123`.
  if (item.source === 'linear-issue') return workItemNumber(item);
  if (item.source === 'github-pr' || item.source === 'github-issue') {
    const number = workItemNumber(item);
    return number ? `#${number}` : undefined;
  }
  return undefined;
}

interface CodeHostReference {
  kind: 'Issue' | 'PR' | 'MR';
  sigil: '#' | '!';
  number: string | number;
  repository: string | undefined;
}

export function repositoryElsewhere(
  repository: string | undefined,
  contextRepository: string | undefined,
): string | undefined {
  return repository !== undefined && repository.toLowerCase() !== contextRepository?.toLowerCase()
    ? repository
    : undefined;
}

/** A repository by its own name, without the owner or group: `mastra` for `mastra-ai/mastra`. */
function repositoryName(repository: string): string {
  return repository.slice(repository.lastIndexOf('/') + 1);
}

export function referenceLabel(
  { kind, sigil, number, repository }: CodeHostReference,
  contextRepository?: string,
): string {
  return `${kind} ${repositoryElsewhere(repository, contextRepository) ?? ''}${sigil}${number}`;
}

const CODE_HOST_REFERENCES: Partial<Record<WorkItemSource, Pick<CodeHostReference, 'kind' | 'sigil'>>> = {
  'github-issue': { kind: 'Issue', sigil: '#' },
  'gitlab-issue': { kind: 'Issue', sigil: '#' },
  'github-pr': CHANGE_REQUEST_TERMS.github,
  'gitlab-pr': CHANGE_REQUEST_TERMS.gitlab,
};

function codeHostReference(item: IdentifiableItem, identifier: string): CodeHostReference | undefined {
  const codeHost = CODE_HOST_REFERENCES[item.source];
  const key = codeHost && /^(.+\/[^#!/]+)?[#!](\d+)$/.exec(identifier);
  return codeHost && key ? { ...codeHost, number: key[2], repository: key[1] } : undefined;
}

export function workItemReference(item: IdentifiableItem, contextRepository?: string): string | undefined {
  const identifier = workItemIdentifier(item);
  const codeHost = CODE_HOST_REFERENCES[item.source];
  if (identifier === undefined || !codeHost) return identifier;
  const reference = codeHostReference(item, identifier);
  return reference ? referenceLabel(reference, contextRepository) : codeHost.kind;
}

/** A work item's key without the repository owner, for links whose source icon already tells an issue from a PR: `app#42`, `ENG-123`. */
export function workItemShortReference(item: IdentifiableItem): string | undefined {
  const identifier = workItemIdentifier(item);
  if (identifier === undefined) return undefined;
  const reference = codeHostReference(item, identifier);
  if (!reference) return workItemReference(item);
  return `${reference.repository === undefined ? '' : repositoryName(reference.repository)}${reference.sigil}${reference.number}`;
}

export function workItemMeta(item: WorkItem, contextRepository?: string): readonly string[] {
  const metadata = sourceMetadata(item);
  const author = typeof metadata.author === 'string' ? metadata.author : undefined;
  const assignee = typeof metadata.assignee === 'string' ? metadata.assignee : undefined;
  const age = relativeTime(sourceCreatedAt(metadata) ?? item.createdAt);
  const reference = workItemReference(item, contextRepository);
  if (reference === undefined) return [CARD_SOURCES[item.source].label, age];
  const owner = githubNumberForItem(item) === undefined ? (assignee ?? author) : author;
  return [reference, ...(owner ? [owner] : []), age];
}
