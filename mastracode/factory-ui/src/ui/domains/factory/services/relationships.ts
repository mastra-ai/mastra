import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import { relatedCardIndex } from '@mastra/factory/work-items/related-cards';
import type { PullRequestFacts } from '@mastra/factory/work-items/related-cards';
import { githubNumberForItem, SOURCE_LABELS, sourceCreatedAt, sourceMetadata, workItemKey } from '../boardItems';
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

export function inferredParentWorkItemId(
  metadata: Record<string, unknown>,
  allItems: readonly WorkItem[],
): string | undefined {
  const headBranch = metadata.headBranch;
  if (typeof headBranch !== 'string') return undefined;
  return allItems.find(
    item =>
      !isPullRequestSource(item.source) && Object.values(item.sessions).some(session => session.branch === headBranch),
  )?.id;
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
  const reference =
    workItemIdentifier(item) === undefined ? item.title : workItemReferenceLabel(item, contextRepository);
  return isPullRequestSource(item.source) ? `Review: ${reference}` : `Work item: ${reference}`;
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

export interface CodeHostReference {
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

export function referenceLabel(
  { kind, sigil, number, repository }: CodeHostReference,
  contextRepository?: string,
): string {
  return `${kind} ${repositoryElsewhere(repository, contextRepository) ?? ''}${sigil}${number}`;
}

const CODE_HOST_REFERENCES: Partial<Record<WorkItemSource, Pick<CodeHostReference, 'kind' | 'sigil'>>> = {
  'github-issue': { kind: 'Issue', sigil: '#' },
  'gitlab-issue': { kind: 'Issue', sigil: '#' },
  'github-pr': { kind: 'PR', sigil: '#' },
  'gitlab-pr': { kind: 'MR', sigil: '!' },
};

export function workItemReferenceLabel(item: IdentifiableItem, contextRepository?: string): string {
  const codeHost = CODE_HOST_REFERENCES[item.source];
  const identifier = workItemIdentifier(item);
  if (!codeHost) return identifier ?? SOURCE_LABELS[item.source];
  const key = /^(.+\/[^#!/]+)?[#!](\d+)$/.exec(identifier ?? '');
  if (!key) return codeHost.kind;
  return referenceLabel({ ...codeHost, number: key[2], repository: key[1] }, contextRepository);
}

export function workItemMeta(item: WorkItem, contextRepository?: string): readonly string[] {
  const metadata = sourceMetadata(item);
  const author = typeof metadata.author === 'string' ? metadata.author : undefined;
  const assignee = typeof metadata.assignee === 'string' ? metadata.assignee : undefined;
  const age = relativeTime(sourceCreatedAt(metadata) ?? item.createdAt);
  if (workItemIdentifier(item) === undefined) return [SOURCE_LABELS[item.source], age];
  const owner = githubNumberForItem(item) === undefined ? (assignee ?? author) : author;
  return [workItemReferenceLabel(item, contextRepository), ...(owner ? [owner] : []), age];
}
