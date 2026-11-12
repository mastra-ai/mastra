import { http, HttpResponse } from 'msw';

import type { IntakeCandidateInfo, IntakeCandidateListResponse } from '../../../api/types';

type Pass = IntakeCandidateListResponse['passes'][number];
type Extra = Partial<Pick<IntakeCandidateInfo, 'title' | 'author' | 'labels' | 'state' | 'createdAt'>> & {
  metadata?: Record<string, unknown>;
  url?: string;
};

const CREATED_AT = '2026-01-01T00:00:00.000Z';

function record(
  externalSource: IntakeCandidateInfo['externalSource'],
  key: string,
  url: string,
  metadata: Record<string, unknown>,
  extra: Extra,
): IntakeCandidateInfo {
  return {
    workItemId: `record-${externalSource.externalId}`,
    title: extra.title ?? key,
    externalSource: { ...externalSource, url: extra.url ?? url },
    key,
    url: extra.url ?? url,
    state: extra.state ?? 'open',
    labels: extra.labels ?? [],
    author: extra.author ?? null,
    metadata: { ...metadata, labels: extra.labels ?? [], ...extra.metadata },
    createdAt: extra.createdAt ?? CREATED_AT,
  };
}

/** The records the server keeps, in the shape each provider's pass stores them. */
export function githubIssueRecord(number: number, extra: Extra & { repositoryId?: number } = {}): IntakeCandidateInfo {
  const repositoryId = extra.repositoryId ?? 10;
  return record(
    { integrationId: 'github', type: 'issue', externalId: `github:${repositoryId}:issue:${number}` },
    `acme/repo#${number}`,
    `https://github.com/acme/repo/issues/${number}`,
    { number, githubRepositoryId: repositoryId, author: extra.author ?? null, assignee: null, assignees: [] },
    extra,
  );
}

export function githubPullRequestRecord(
  number: number,
  extra: Extra & { repositoryId?: number } = {},
): IntakeCandidateInfo {
  const repositoryId = extra.repositoryId ?? 10;
  return record(
    { integrationId: 'github', type: 'pull-request', externalId: `github:${repositoryId}:pull-request:${number}` },
    `acme/repo#${number}`,
    `https://github.com/acme/repo/pull/${number}`,
    {
      number,
      githubRepositoryId: repositoryId,
      author: extra.author ?? null,
      assignees: [],
      requestedReviewers: [],
      headBranch: `feature-${number}`,
      baseBranch: 'main',
    },
    extra,
  );
}

export function gitlabIssueRecord(externalId: string, identifier: string, extra: Extra = {}): IntakeCandidateInfo {
  return record(
    { integrationId: 'gitlab', type: 'issue', externalId },
    identifier,
    `https://gitlab.com/${identifier.replace('#', '/-/issues/')}`,
    {
      identifier,
      state: 'opened',
      stateType: 'unstarted',
      assignee: null,
      assignees: [],
      author: extra.author ?? null,
    },
    { state: 'opened', ...extra },
  );
}

export function gitlabMergeRequestRecord(externalId: string, iid: number, extra: Extra = {}): IntakeCandidateInfo {
  return record(
    { integrationId: 'gitlab', type: 'pull-request', externalId },
    `acme/repo!${iid}`,
    `https://gitlab.com/acme/repo/-/merge_requests/${iid}`,
    {
      gitlabMergeRequestIid: iid,
      author: extra.author ?? null,
      assignees: [],
      requestedReviewers: [],
      headBranch: `feature-${iid}`,
      baseBranch: 'main',
    },
    { state: 'opened', ...extra },
  );
}

export function linearRecord(identifier: string, extra: Extra & { projectId?: string } = {}): IntakeCandidateInfo {
  return record(
    { integrationId: 'linear', type: 'issue', externalId: `linear:${identifier}` },
    identifier,
    `https://linear.app/acme/issue/${identifier}`,
    {
      linearIssueId: `issue-${identifier}`,
      ...(extra.projectId ? { linearProjectId: extra.projectId } : {}),
      identifier,
      state: extra.state ?? 'Todo',
      linearState: extra.state ?? 'Todo',
      linearStateType: 'unstarted',
      assignee: null,
      creator: extra.author ?? null,
    },
    { state: 'Todo', ...extra },
  );
}

export function jiraRecord(id: string, identifier: string, extra: Extra = {}): IntakeCandidateInfo {
  return record(
    { integrationId: 'jira', type: 'issue', externalId: id },
    identifier,
    `https://acme.atlassian.net/browse/${identifier}`,
    {
      identifier,
      issueRef: id,
      state: extra.state ?? 'To Do',
      stateType: 'unstarted',
      assignee: null,
      assignees: [],
      creator: extra.author ?? null,
      author: extra.author ?? null,
    },
    { state: 'To Do', ...extra },
  );
}

export function incidentioRecord(id: string, identifier: string, extra: Extra = {}): IntakeCandidateInfo {
  return record(
    { integrationId: 'incidentio', type: 'issue', externalId: id },
    identifier,
    `https://app.incident.io/acme/follow-ups/${id}`,
    {
      identifier,
      issueRef: id,
      state: extra.state ?? 'outstanding',
      stateType: 'unstarted',
      assignee: null,
      assignees: [],
      creator: extra.author ?? null,
      author: extra.author ?? null,
    },
    { state: 'outstanding', ...extra },
  );
}

interface ListedGithubItem {
  number: number;
  title: string;
  url: string;
  author?: string | null;
  labels?: string[];
  assignee?: string | null;
  assignees?: string[];
  requestedReviewers?: string[];
  headBranch?: string;
  baseBranch?: string;
  createdAt?: string;
  repositoryId?: number;
}

/** `owner/repo#7` out of an issue or pull request URL, the key the server stores. */
function githubKey(item: ListedGithubItem) {
  const [, slug] = /github\.com\/([^/]+\/[^/]+)\//.exec(item.url) ?? [];
  return `${slug ?? 'acme/repo'}#${item.number}`;
}

function listed(base: IntakeCandidateInfo, item: ListedGithubItem, metadata: Record<string, unknown>) {
  return {
    ...base,
    key: githubKey(item),
    url: item.url,
    externalSource: { ...base.externalSource, url: item.url },
    metadata: { ...base.metadata, ...metadata },
  };
}

/** The record the server keeps for an issue a test describes the way GitHub lists it. */
export function recordOfGithubIssue(issue: ListedGithubItem): IntakeCandidateInfo {
  const assignees = issue.assignees ?? (issue.assignee ? [issue.assignee] : []);
  return listed(githubIssueRecord(issue.number, { ...issue, author: issue.author ?? null }), issue, {
    assignee: issue.assignee ?? assignees[0] ?? null,
    assignees,
  });
}

/** The record the server keeps for a pull request a test describes the way GitHub lists it. */
export function recordOfGithubPullRequest(pull: ListedGithubItem): IntakeCandidateInfo {
  return listed(githubPullRequestRecord(pull.number, { ...pull, author: pull.author ?? null }), pull, {
    assignees: pull.assignees ?? [],
    requestedReviewers: pull.requestedReviewers ?? [],
    ...(pull.headBranch ? { headBranch: pull.headBranch } : {}),
    ...(pull.baseBranch ? { baseBranch: pull.baseBranch } : {}),
  });
}

/** The records the server lists for a request: narrowed to its `source` and `label`, as the route does. */
export function narrowedIntakeCandidates(
  records: readonly IntakeCandidateInfo[],
  request: Request,
): IntakeCandidateInfo[] {
  const query = new URL(request.url).searchParams;
  const sources = query.getAll('source').map(source => source.split(':'));
  const label = query.get('label')?.toLowerCase();
  return records.filter(
    ({ externalSource, labels }) =>
      (sources.length === 0 ||
        sources.some(
          ([integrationId, kind]) =>
            integrationId === externalSource.integrationId && (!kind || kind === externalSource.type),
        )) &&
      (label === undefined || labels.some(item => item.toLowerCase() === label)),
  );
}

/**
 * A candidates route that answers the way the server does, narrowing the records to the request
 * and paging them by its `limit`, or with whatever `answer` returns per request.
 */
export function intakeCandidatesHandler(
  baseUrl: string,
  answer: readonly IntakeCandidateInfo[] | ((request: Request) => IntakeCandidateListResponse | Response),
  passes: readonly Pass[] = [],
) {
  return http.get(`${baseUrl}/web/factory/projects/:id/intake/candidates`, ({ request }) => {
    if (typeof answer !== 'function') {
      const query = new URL(request.url).searchParams;
      const matching = narrowedIntakeCandidates(answer, request);
      const from = Number(query.get('cursor') ?? 0);
      const to = from + Number(query.get('limit') ?? 50);
      return HttpResponse.json({
        candidates: matching.slice(from, to),
        ...(to < matching.length ? { nextCursor: String(to) } : {}),
        passes,
      });
    }
    const page = answer(request);
    return page instanceof Response ? page : HttpResponse.json(page);
  });
}
