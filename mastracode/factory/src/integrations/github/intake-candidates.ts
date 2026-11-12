import type { IntakeStorage } from '../../storage/domains/intake/base.js';
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import type { ExternalWorkItemSource, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import type { IntakeKind, IntakeRecord } from '../intake-pass.js';
import type { ParsedGithubWebhook } from './webhook.js';

export interface GithubIntakeIssue {
  number: number;
  title: string;
  url: string;
  author: string | null;
  assignees: string[];
  labels: string[];
  createdAt: string | null;
}

export interface GithubIntakePullRequest extends GithubIntakeIssue {
  requestedReviewers: string[];
  headBranch: string;
  baseBranch: string;
}

export type GithubIssueSelection = Pick<IntakeStorage, 'ensureReady' | 'getConfig'>;

/**
 * Which repositories an organization takes issues from: the ones picked in Settings › Intake.
 * Pull requests are offered for every linked repository, so only issues ask this.
 */
export async function githubIssueRepositories(
  intake: GithubIssueSelection | undefined,
  orgId: string,
): Promise<(slug: string) => boolean> {
  if (!intake) return () => true;
  await intake.ensureReady();
  const selection = (await intake.getConfig({ orgId, integrationIds: ['github'] })).github;
  const slugs = new Set(selection?.enabled ? selection.sourceIds : []);
  return slug => slugs.has(slug);
}

function createdAt(value: string | null): Date | null {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) ? new Date(time) : null;
}

/** The source a card filed for the record carries, which is what lets filing adopt the candidate. */
function githubIntakeSource(repositoryId: number, kind: IntakeKind, itemNumber: number, url?: string) {
  return {
    integrationId: 'github',
    type: kind,
    externalId: `github:${repositoryId}:${kind}:${itemNumber}`,
    ...(url ? { url } : {}),
  } satisfies ExternalWorkItemSource;
}

export function githubIssueRecord(repositoryId: number, issue: GithubIntakeIssue): IntakeRecord {
  return {
    source: githubIntakeSource(repositoryId, 'issue', issue.number, issue.url),
    title: issue.title,
    metadata: {
      number: issue.number,
      githubRepositoryId: repositoryId,
      ...(issue.author ? { author: issue.author } : {}),
      assignee: issue.assignees[0] ?? null,
      assignees: issue.assignees,
      labels: issue.labels,
    },
    createdAt: createdAt(issue.createdAt),
  };
}

export function githubPullRequestRecord(repositoryId: number, pullRequest: GithubIntakePullRequest): IntakeRecord {
  return {
    source: githubIntakeSource(repositoryId, 'pull-request', pullRequest.number, pullRequest.url),
    title: pullRequest.title,
    metadata: {
      number: pullRequest.number,
      githubRepositoryId: repositoryId,
      ...(pullRequest.author ? { author: pullRequest.author } : {}),
      assignees: pullRequest.assignees,
      requestedReviewers: pullRequest.requestedReviewers,
      labels: pullRequest.labels,
      headBranch: pullRequest.headBranch,
      baseBranch: pullRequest.baseBranch,
    },
    createdAt: createdAt(pullRequest.createdAt),
  };
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function names(value: unknown, key: 'login' | 'name'): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => string(typeof entry === 'string' ? entry : object(entry)?.[key]) ?? []);
}

interface GithubEventItem {
  kind: IntakeKind;
  /** `owner/name`, which is how Settings › Intake names an issue source. */
  slug: string | null;
  installationId: number;
  repositoryId: number;
  source: ExternalWorkItemSource;
  /** The key of a card filed before keys named the repository. */
  bareKey: string;
  /** Absent once the record is closed, deleted, or a draft. */
  record?: IntakeRecord;
}

/** The issue or pull request an event is about, when the event says whether it is still open. */
function githubEventItem(parsed: ParsedGithubWebhook): GithubEventItem | null {
  const kind = parsed.event === 'issues' ? 'issue' : parsed.event === 'pull_request' ? 'pull-request' : null;
  if (!kind) return null;
  const item = object(kind === 'issue' ? parsed.payload.issue : parsed.payload.pull_request);
  const installationId = object(parsed.payload.installation)?.id;
  const repositoryId = object(parsed.payload.repository)?.id;
  const itemNumber = item?.number;
  if (!item || (kind === 'issue' && item.pull_request !== undefined)) return null;
  if (typeof installationId !== 'number' || typeof repositoryId !== 'number' || typeof itemNumber !== 'number') {
    return null;
  }

  const action = string(parsed.payload.action);
  const title = string(item.title);
  const url = string(item.html_url);
  const open =
    item.state !== 'closed' &&
    action !== 'closed' &&
    action !== 'deleted' &&
    action !== 'transferred' &&
    item.draft !== true &&
    item.merged !== true;
  const facts: GithubIntakeIssue = {
    number: itemNumber,
    title: title ?? '',
    url: url ?? '',
    author: string(object(item.user)?.login) ?? null,
    assignees: names(item.assignees, 'login'),
    labels: names(item.labels, 'name'),
    createdAt: string(item.created_at) ?? null,
  };
  const record =
    !open || !title || !url
      ? undefined
      : kind === 'issue'
        ? githubIssueRecord(repositoryId, facts)
        : githubPullRequestRecord(repositoryId, {
            ...facts,
            requestedReviewers: names(item.requested_reviewers, 'login'),
            headBranch: string(object(item.head)?.ref) ?? '',
            baseBranch: string(object(item.base)?.ref) ?? '',
          });
  // An open record the event does not describe well enough to list is left to the next pass.
  if (open && !record) return null;
  return {
    kind,
    slug: string(object(parsed.payload.repository)?.full_name) ?? null,
    installationId,
    repositoryId,
    source: githubIntakeSource(repositoryId, kind, itemNumber),
    bareKey: kind === 'issue' ? `github-issue:${itemNumber}` : `github-pr:${itemNumber}`,
    ...(record ? { record } : {}),
  };
}

/**
 * Keep the candidates in step with an event the rules have just handled: a record that is no
 * longer open stops being offered, and an open one the rules filed no card for is offered. The
 * hourly pass corrects whatever an event lost on the way here leaves behind.
 */
export async function settleGithubIntakeEvent(
  deps: {
    storage: Pick<WorkItemsStorage, 'getByProjectSource' | 'storeIntakeCandidate' | 'removeIntakeCandidate'>;
    sourceControl: Pick<SourceControlStorageHandle, 'projectRepositories'>;
    intake?: GithubIssueSelection;
  },
  parsed: ParsedGithubWebhook,
): Promise<void> {
  const item = githubEventItem(parsed);
  if (!item) return;
  const projects = await deps.sourceControl.projectRepositories.listByExternalRepository({
    installationExternalId: String(item.installationId),
    repositoryExternalId: String(item.repositoryId),
  });
  for (const project of projects) {
    const scope = { orgId: project.orgId, factoryProjectId: project.factoryProjectId };
    const taken =
      item.kind !== 'issue' ||
      (item.slug !== null && (await githubIssueRepositories(deps.intake, project.orgId))(item.slug));
    if (!item.record || !taken) {
      await deps.storage.removeIntakeCandidate({ ...scope, source: item.source });
      continue;
    }
    if (await deps.storage.getByProjectSource({ ...scope, source: { ...item.source, externalId: item.bareKey } })) {
      continue;
    }
    await deps.storage.storeIntakeCandidate({ ...scope, ...item.record });
  }
}
