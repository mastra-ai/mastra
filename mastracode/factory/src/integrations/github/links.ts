/**
 * What a pull request implements.
 *
 * A Review card hangs off the Work item whose problem the pull request solves,
 * and that link has three independent sources: Factory's own provenance when a
 * run opened the pull request, the author's closing keyword (`Closes #12`), and
 * the head branch when it is a Factory session branch. They are asked in that
 * order — recorded fact, declared intent, then inference.
 */

import type { IntegrationStorageHandle } from '../../storage/domains/integrations/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import type { FactoryPullRequestProvenanceData } from './provenance.js';
import { resolveFactoryPullRequestParentWorkItemId } from './provenance.js';

export type GithubItemKind = 'issue' | 'pull-request';

export function canonicalSourceKey(kind: GithubItemKind, itemNumber: number): string {
  return kind === 'issue' ? `github-issue:${itemNumber}` : `github-pr:${itemNumber}`;
}

export function legacySourceKey(repositoryId: number, kind: GithubItemKind, itemNumber: number): string {
  return `github:${repositoryId}:${kind}:${itemNumber}`;
}

/**
 * A GitHub number only identifies a card together with its repository: a
 * project linked to several repositories has a `#12` in each. The card's
 * intake-stamped URL is authoritative; the intake-stamped `githubRepositoryId`
 * covers URL-less cards. Callers that cannot name the repository (the
 * dispatcher knows the id but not the slug) fall back to the id alone, which
 * misses cards predating that stamp rather than attributing them wrongly.
 */
export function cardBelongsToRepository(
  item: WorkItemRow,
  repositoryId: number,
  repositoryFullName: string | undefined,
): boolean {
  const url = item.externalSource?.url;
  if (url && repositoryFullName) {
    const match = /^https?:\/\/[^/]+\/(.+)\/(?:issues|pull)\/\d+(?:[/?#]|$)/.exec(url);
    if (match && match[1] === repositoryFullName) return true;
  }
  // A renamed repository leaves the old owner/name in the card URL, so a URL
  // mismatch still defers to the stable intake-stamped repository id.
  return item.metadata?.githubRepositoryId === repositoryId;
}

// GitHub's own closing keywords. Cross-repository references (`owner/repo#12`,
// and issue URLs) are matched too so they can be rejected when they name
// another repository — a card only ever links inside its own.
const CLOSING_REFERENCE =
  /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b\s*:?\s+(?:(?<slug>[\w.-]+\/[\w.-]+)#(?<crossRepo>\d+)|#(?<sameRepo>\d+)|https?:\/\/(?:www\.)?github\.com\/(?<urlSlug>[\w.-]+\/[\w.-]+)\/issues\/(?<urlNumber>\d+))/gi;

function referencedIssueNumber(
  groups: Record<string, string | undefined>,
  repositoryFullName: string,
): number | null {
  const { slug, crossRepo, sameRepo, urlSlug, urlNumber } = groups;
  const repository = slug ?? urlSlug;
  if (repository && repository.toLowerCase() !== repositoryFullName.toLowerCase()) return null;
  const issueNumber = Number(sameRepo ?? crossRepo ?? urlNumber);
  return Number.isInteger(issueNumber) && issueNumber > 0 ? issueNumber : null;
}

/** Issue numbers a pull request body declares it closes, in this repository only. */
export function closingIssueNumbers(body: string | null | undefined, repositoryFullName: string): number[] {
  if (!body) return [];
  const numbers = new Set<number>();
  for (const match of body.matchAll(CLOSING_REFERENCE)) {
    const issueNumber = referencedIssueNumber(match.groups ?? {}, repositoryFullName);
    if (issueNumber !== null) numbers.add(issueNumber);
  }
  return [...numbers];
}

export interface PullRequestLinkFacts {
  repositoryId: number;
  repositoryFullName?: string;
  closesIssues?: number[];
  headBranch?: string;
}

function issueCard(items: WorkItemRow[], issueNumber: number, facts: PullRequestLinkFacts): WorkItemRow | undefined {
  return (
    items.find(
      item =>
        item.externalSource?.externalId === canonicalSourceKey('issue', issueNumber) &&
        cardBelongsToRepository(item, facts.repositoryId, facts.repositoryFullName),
    ) ??
    items.find(item => item.externalSource?.externalId === legacySourceKey(facts.repositoryId, 'issue', issueNumber))
  );
}

function declaredClosedIssue(items: WorkItemRow[], facts: PullRequestLinkFacts): string | null {
  for (const issueNumber of facts.closesIssues ?? []) {
    const card = issueCard(items, issueNumber, facts);
    if (card) return card.id;
  }
  return null;
}

/**
 * Session branches are per-item (`factory/issue-N`), so a head-branch match
 * names the item that wrote the code even when no provenance was recorded.
 */
function branchAuthor(items: WorkItemRow[], headBranch: string | undefined): string | null {
  if (!headBranch) return null;
  const author = items.find(
    item =>
      item.externalSource?.type !== 'pull-request' &&
      Object.values(item.sessions).some(session => session.branch === headBranch),
  );
  return author?.id ?? null;
}

/**
 * The work item a pull request belongs to, from the facts the pull request
 * itself carries. Provenance is not consulted here — it is storage-backed and
 * asked first by {@link resolvePullRequestParentWorkItemId}.
 */
export function pullRequestParentWorkItemId(items: WorkItemRow[], facts: PullRequestLinkFacts): string | null {
  return declaredClosedIssue(items, facts) ?? branchAuthor(items, facts.headBranch);
}

/** The work item a recorded provenance names, when it still has a card here. */
export function provenanceParentWorkItemId(
  items: WorkItemRow[],
  provenance: { workItemId: string } | null,
): string | null {
  if (!provenance) return null;
  return items.some(item => item.id === provenance.workItemId) ? provenance.workItemId : null;
}

function numberList(value: unknown): number[] {
  return Array.isArray(value) ? value.filter(entry => typeof entry === 'number' && Number.isInteger(entry)) : [];
}

/**
 * The link facts a rule stamped on an `upsertLinkedWorkItem` decision. Returns
 * nothing when the decision does not name a pull request in a repository, the
 * one shape every link source needs.
 */
export function pullRequestLinkFacts(
  metadata: Record<string, unknown> | undefined,
): (PullRequestLinkFacts & { pullRequestNumber: number }) | null {
  const repositoryId = metadata?.githubRepositoryId;
  const pullRequestNumber = metadata?.githubPullRequestNumber;
  if (typeof repositoryId !== 'number' || typeof pullRequestNumber !== 'number') return null;
  const headBranch = metadata?.headBranch;
  return {
    repositoryId,
    pullRequestNumber,
    closesIssues: numberList(metadata?.closesIssues),
    ...(typeof headBranch === 'string' && headBranch ? { headBranch } : {}),
  };
}

export interface PullRequestParentDeps {
  integrationStorage: IntegrationStorageHandle<
    Record<string, unknown>,
    Record<string, unknown>,
    FactoryPullRequestProvenanceData
  >;
  workItems: Pick<WorkItemsStorage, 'list'>;
}

/** Every link source, in order, for one pull request in one project. */
export async function resolvePullRequestParentWorkItemId(
  deps: PullRequestParentDeps,
  input: { orgId: string; factoryProjectId: string; pullRequestNumber: number } & PullRequestLinkFacts,
): Promise<string | null> {
  const provenance = await resolveFactoryPullRequestParentWorkItemId(deps.integrationStorage, {
    orgId: input.orgId,
    repositoryId: input.repositoryId,
    pullRequestNumber: input.pullRequestNumber,
  });
  if (provenance) return provenance;
  if (!input.closesIssues?.length && !input.headBranch) return null;
  const items = await deps.workItems.list({ orgId: input.orgId, factoryProjectId: input.factoryProjectId });
  return pullRequestParentWorkItemId(items, input);
}
