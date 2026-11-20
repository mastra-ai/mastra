import { metadataLabels } from '@mastra/factory/work-items/card-labels';
import { AUTO_TRIAGED_LABEL, NEEDS_APPROVAL_LABEL } from '@mastra/factory/rules/types';
import { workItemBranch, workItemThreadTitle } from '@mastra/factory/work-item-branch';
import { changeRequestNumber } from '@mastra/factory/work-items/change-requests';
import { sourceExternalId } from '@mastra/factory/work-items/source-external-id';
import { isValid } from 'date-fns';

import type { WorkItem } from './services/workItems';

const HIDDEN_CARD_LABELS = new Set([AUTO_TRIAGED_LABEL, NEEDS_APPROVAL_LABEL]);

export function cardLabels(metadata: Record<string, unknown>): string[] {
  return metadataLabels(metadata).filter(label => !HIDDEN_CARD_LABELS.has(label.toLowerCase()));
}

export function hasLabel(labels: readonly string[], label: string): boolean {
  return labels.some(item => item.toLowerCase() === label);
}

/** Native cards and unfiled candidates keep their facts in placement metadata. */
export function sourceMetadata(item: Pick<WorkItem, 'metadata' | 'workItem'>): Record<string, unknown> {
  if (!item.workItem || item.workItem.provider === 'factory') return item.metadata;
  return {
    ...item.workItem.metadata,
    labels: item.workItem.labels,
    author: item.workItem.author,
    state: item.workItem.state,
    identifier: item.workItem.key,
  };
}

export function metadataLabelColors(metadata: Record<string, unknown>): Record<string, string> {
  if (!metadata.labelColors || typeof metadata.labelColors !== 'object' || Array.isArray(metadata.labelColors))
    return {};
  return Object.fromEntries(
    Object.entries(metadata.labelColors).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' &&
        (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(entry[1]) || /^[a-z]+$/i.test(entry[1])),
    ),
  );
}

export function githubNumberForItem(item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>): number | undefined {
  const metadata = sourceMetadata(item);
  if (item.source !== 'github-issue' && item.source !== 'github-pr') return;
  const metadataKey = item.source === 'github-issue' ? 'githubIssueNumber' : 'githubPullRequestNumber';
  const itemNumber = metadata[metadataKey] ?? metadata.number;
  if (typeof itemNumber !== 'number' || !Number.isInteger(itemNumber) || itemNumber <= 0) return;
  return itemNumber;
}

/** The change-request number a review card carries: a GitHub PR number or a GitLab MR iid. */
export function changeRequestNumberForItem(
  item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>,
): number | undefined {
  return changeRequestNumber(item.source, sourceMetadata(item));
}

export function gitlabIdentifierForItem(item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>): string | undefined {
  const metadata = sourceMetadata(item);
  if (item.source === 'gitlab-issue' && typeof metadata.identifier === 'string') return metadata.identifier;
  if (item.source === 'gitlab-issue') {
    const iid = metadata.gitlabIssueIid;
    return typeof iid === 'number' && Number.isSafeInteger(iid) && iid > 0 ? `#${iid}` : undefined;
  }
  if (item.source !== 'gitlab-pr') return;
  const iid = metadata.gitlabMergeRequestIid;
  return typeof iid === 'number' && Number.isSafeInteger(iid) && iid > 0 ? `!${iid}` : undefined;
}

/** The human issue key a Linear card carries (`ENG-123`), when it has one. */
export function linearIdentifierForItem(item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>): string | undefined {
  const metadata = sourceMetadata(item);
  if (item.source !== 'linear-issue' || typeof metadata.identifier !== 'string') return;
  return metadata.identifier;
}
/** The opaque Linear issue id a card carries, when it has one. */
export function linearIssueIdForItem(item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>): string | undefined {
  const metadata = sourceMetadata(item);
  if (item.source !== 'linear-issue' || typeof metadata.linearIssueId !== 'string') return;
  return metadata.linearIssueId;
}

export function jiraIdentifierForItem(item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>): string | undefined {
  const metadata = sourceMetadata(item);
  if (item.source !== 'jira-issue' || typeof metadata.identifier !== 'string') return;
  return metadata.identifier;
}

export function jiraIssueRefForItem(item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>): string | undefined {
  const metadata = sourceMetadata(item);
  if (item.source !== 'jira-issue') return;
  return nonEmptyString(metadata.issueRef) ?? nonEmptyString(metadata.issueReference);
}

/** The human reference an incident.io follow-up card carries (`INC-42` or the item id), when it has one. */
export function incidentioIdentifierForItem(
  item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>,
): string | undefined {
  const metadata = sourceMetadata(item);
  if (item.source !== 'incidentio-follow-up' || typeof metadata.identifier !== 'string') return;
  return metadata.identifier;
}

/** The prefixed incident.io item reference a card carries, when it has one. */
export function incidentioIssueRefForItem(
  item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>,
): string | undefined {
  const metadata = sourceMetadata(item);
  if (item.source !== 'incidentio-follow-up') return;
  return nonEmptyString(metadata.issueRef) ?? nonEmptyString(metadata.issueReference);
}

/** Legacy metadata may hold `issueRef: ''` beside a populated `issueReference`; skip empty values. */
function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

/**
 * Source key for a GitHub issue or pull request. Numbers repeat across a
 * project's repositories, so the key is repository-scoped whenever the
 * repository is known; the bare-number form remains for legacy callers.
 */
export function githubSourceKey(kind: 'issue' | 'pull-request', itemNumber: number, repositoryId?: number): string {
  if (repositoryId !== undefined) return `github:${repositoryId}:${kind}:${itemNumber}`;
  return kind === 'issue' ? `github-issue:${itemNumber}` : `github-pr:${itemNumber}`;
}

/**
 * The candidate source key a card stands for. Cards stamped with their
 * repository match only that repository's candidate, even when the card
 * itself still carries a bare-number key from before keys were scoped.
 */
export function candidateSourceKeyForItem(item: WorkItem): string | undefined {
  const metadata = sourceMetadata(item);
  const itemNumber = githubNumberForItem(item);
  if (itemNumber === undefined) return;
  const repositoryId = typeof metadata.githubRepositoryId === 'number' ? metadata.githubRepositoryId : undefined;
  if (item.source === 'github-issue') return githubSourceKey('issue', itemNumber, repositoryId);
  if (item.source === 'github-pr') return githubSourceKey('pull-request', itemNumber, repositoryId);
  return undefined;
}

/** When the issue/PR was opened upstream; `createdAt` is only when the factory first saw it, "just now" for every backfilled card. */
export function sourceCreatedAt(metadata: Record<string, unknown>): string | undefined {
  const value = metadata.sourceCreatedAt;
  return typeof value === 'string' && isValid(new Date(value)) ? value : undefined;
}

/** The upstream key a card is known by: `#123` on GitHub, `ENG-42` on Linear. */
export function workItemKey(item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>): string | undefined {
  if (item.workItem?.provider !== 'factory' && item.workItem?.key) return item.workItem.key;
  const githubNumber = githubNumberForItem(item);
  if (githubNumber !== undefined) return `#${githubNumber}`;
  const cardNumber = item.source === 'manual' ? sourceMetadata(item).cardNumber : undefined;
  if (typeof cardNumber === 'number' && Number.isInteger(cardNumber) && cardNumber > 0) return `#${cardNumber}`;
  return (
    gitlabIdentifierForItem(item) ??
    linearIdentifierForItem(item) ??
    jiraIdentifierForItem(item) ??
    incidentioIdentifierForItem(item)
  );
}

/**
 * Branch + thread title for a card's session, shared with the server's runs
 * (`workItemBranch`), so the title click and a later run converge on one
 * worktree.
 */
export function itemSessionSpec(item: WorkItem): { branch: string; threadTitle: string } {
  const input = { ...item, metadata: { ...item.metadata, ...sourceMetadata(item) } };
  return { branch: workItemBranch(input), threadTitle: workItemThreadTitle(input) };
}

/** Source keys already materialized as cards, in either workflow — candidates matching one are dropped. */
export function persistedSourceKeys(items: readonly WorkItem[]): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const item of items) {
    if (item.sourceKey) keys.add(item.sourceKey);
    const candidateSourceKey = candidateSourceKeyForItem(item);
    if (candidateSourceKey) keys.add(candidateSourceKey);
    // The URL names the repository, covering cards filed before they were stamped with one.
    if (item.url && (item.source === 'github-issue' || item.source === 'github-pr')) keys.add(item.url);
    // A pull request attached to an issue card is filed on that card.
    for (const source of item.workItem?.sources ?? []) {
      keys.add(sourceExternalId(source));
      if (source.url) keys.add(source.url);
    }
  }
  return keys;
}

/** Whether a live candidate is already one of the given persisted cards. */
export function isPersistedCandidate(
  keys: ReadonlySet<string>,
  candidate: { sourceKey: string; url: string },
): boolean {
  return keys.has(candidate.sourceKey) || keys.has(candidate.url);
}
