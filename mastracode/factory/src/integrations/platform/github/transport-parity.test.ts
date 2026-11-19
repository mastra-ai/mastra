import { describe, expect, it } from 'vitest';

import { startFakePlatform } from '../foundation/test-utils.js';
import { GithubConnectTokens } from './connect-tokens.js';
import { ConnectGithubTransport } from './connect-transport.js';
import { LegacyGithubTransport } from './legacy-transport.js';
import { startFakeGithub } from './test-utils.js';
import type { GithubTransport } from './transport.js';

/**
 * Both transports answer every operation the same way. The legacy stub serves
 * the platform's response shapes (written to match the platform's own
 * normalizers in `github-resources.ts`); the GitHub stub serves the raw REST
 * bodies those shapes come from.
 */

const REPO = 'acme/widgets';
const LEGACY = `/v1/server/github/repos/acme/widgets`;
const GITHUB = `/repos/acme/widgets`;
const FUTURE = '2099-01-01T00:00:00.000Z';

const rawActor = { login: 'octocat', avatar_url: 'https://avatars/octocat', html_url: 'https://github.com/octocat' };
const actor = { login: 'octocat', avatarUrl: 'https://avatars/octocat', htmlUrl: 'https://github.com/octocat' };
const rawBot = {
  login: 'mastra-factory-reviews[bot]',
  avatar_url: 'https://avatars/bot',
  html_url: 'https://github.com/apps/x',
};
const bot = {
  login: 'mastra-factory-reviews[bot]',
  avatarUrl: 'https://avatars/bot',
  htmlUrl: 'https://github.com/apps/x',
};

const rawPullRequest = {
  number: 7,
  title: 'Fix',
  body: 'Body',
  state: 'closed',
  html_url: 'https://github.com/acme/widgets/pull/7',
  merged: undefined,
  merged_at: '2026-11-13T11:00:00Z',
  mergeable: null,
  draft: false,
  head: { ref: 'fix', sha: 'h1' },
  base: { ref: 'main', repo: { id: 42, full_name: REPO } },
  user: rawActor,
  assignees: [{ login: 'octocat' }],
  requested_reviewers: [{ login: 'hubot' }],
  created_at: '2026-11-13T10:00:00Z',
  updated_at: '2026-11-13T11:00:00Z',
};
const pullRequest = {
  number: 7,
  title: 'Fix',
  body: 'Body',
  state: 'closed',
  htmlUrl: 'https://github.com/acme/widgets/pull/7',
  merged: true,
  mergeable: null,
  draft: false,
  head: { ref: 'fix', sha: 'h1' },
  base: { ref: 'main', repo: { id: 42, fullName: REPO } },
  user: actor,
  assignees: ['octocat'],
  requestedReviewers: ['hubot'],
  createdAt: '2026-11-13T10:00:00Z',
  updatedAt: '2026-11-13T11:00:00Z',
};

const rawIssue = {
  number: 3,
  state: 'open',
  title: 'Bug',
  body: null,
  html_url: 'https://github.com/acme/widgets/issues/3',
  labels: ['triage', { name: 'bug' }, { name: '' }],
  assignees: [{ login: 'octocat' }],
  comments: 2,
  user: rawActor,
  created_at: '2026-11-13T09:00:00Z',
  updated_at: '2026-11-13T09:30:00Z',
};
const issue = {
  number: 3,
  state: 'open',
  title: 'Bug',
  body: null,
  htmlUrl: 'https://github.com/acme/widgets/issues/3',
  labels: ['triage', 'bug'],
  assignees: ['octocat'],
  commentCount: 2,
  user: actor,
  createdAt: '2026-11-13T09:00:00Z',
  updatedAt: '2026-11-13T09:30:00Z',
};

const rawComment = {
  id: 21,
  body: 'Hello',
  html_url: 'https://github.com/acme/widgets/pull/7#issuecomment-21',
  user: rawActor,
  created_at: '2026-11-13T10:10:00Z',
  updated_at: '2026-11-13T10:10:00Z',
};
const comment = {
  id: 21,
  body: 'Hello',
  htmlUrl: 'https://github.com/acme/widgets/pull/7#issuecomment-21',
  user: actor,
  createdAt: '2026-11-13T10:10:00Z',
  updatedAt: '2026-11-13T10:10:00Z',
};

const rawReviewComment = {
  ...rawComment,
  id: 31,
  path: 'src/a.ts',
  line: 4,
  side: 'RIGHT',
  commit_id: 'h1',
  in_reply_to_id: 30,
};
const reviewComment = { ...comment, id: 31, path: 'src/a.ts', line: 4, side: 'RIGHT', commitId: 'h1', replyToId: 30 };

const rawReview = {
  id: 11,
  html_url: 'https://github.com/acme/widgets/pull/7#pullrequestreview-11',
  body: '  ',
  state: 'approved',
  commit_id: 'h1',
  submitted_at: '2026-11-13T10:20:00Z',
  user: rawBot,
};
const review = {
  id: 11,
  htmlUrl: 'https://github.com/acme/widgets/pull/7#pullrequestreview-11',
  body: null,
  state: 'APPROVED',
  commitId: 'h1',
  submittedAt: '2026-11-13T10:20:00Z',
  user: bot,
};

const rawReviewers = { users: [{ login: 'hubot' }], teams: [{ slug: 'core' }] };
const rawPullRequestWithReviewers = {
  ...rawPullRequest,
  requested_reviewers: [{ login: 'hubot' }],
  requested_teams: [{ slug: 'core' }],
};
const reviewers = { users: ['hubot'], teams: ['core'] };
const alerts = [{ number: 1, state: 'open', html_url: 'https://github.com/acme/widgets/security/dependabot/1' }];

interface Operation {
  name: keyof GithubTransport;
  run: (transport: GithubTransport) => Promise<unknown>;
  legacy: { method: string; path: string; body?: unknown };
  github: { method: string; path: string; body?: unknown };
}

const call = { repository: REPO };
const OPERATIONS: Operation[] = [
  {
    name: 'getPullRequest',
    run: t => t.getPullRequest(call, 7),
    legacy: { method: 'GET', path: `${LEGACY}/pulls/7`, body: pullRequest },
    github: { method: 'GET', path: `${GITHUB}/pulls/7`, body: rawPullRequest },
  },
  {
    name: 'listPullRequests',
    run: t => t.listPullRequests(call, { state: 'all', page: 1, perPage: 30 }),
    legacy: { method: 'GET', path: `${LEGACY}/pulls`, body: { pullRequests: [pullRequest] } },
    github: { method: 'GET', path: `${GITHUB}/pulls`, body: [rawPullRequest] },
  },
  {
    name: 'createPullRequest',
    run: t => t.createPullRequest(call, { head: 'fix', base: 'main', title: 'Fix', body: 'Body' }),
    legacy: { method: 'POST', path: `${LEGACY}/pulls`, body: pullRequest },
    github: { method: 'POST', path: `${GITHUB}/pulls`, body: rawPullRequest },
  },
  {
    name: 'updatePullRequest',
    run: t => t.updatePullRequest(call, 7, { title: 'Fix' }),
    legacy: { method: 'PATCH', path: `${LEGACY}/pulls/7`, body: pullRequest },
    github: { method: 'PATCH', path: `${GITHUB}/pulls/7`, body: rawPullRequest },
  },
  {
    name: 'mergePullRequest',
    run: t => t.mergePullRequest(call, 7, { method: 'squash' }),
    legacy: { method: 'PUT', path: `${LEGACY}/pulls/7/merge`, body: { merged: true, message: 'Merged', sha: 'm1' } },
    github: { method: 'PUT', path: `${GITHUB}/pulls/7/merge`, body: { merged: true, message: 'Merged', sha: 'm1' } },
  },
  {
    name: 'getIssue',
    run: t => t.getIssue(call, 3),
    legacy: { method: 'GET', path: `${LEGACY}/issues/3`, body: issue },
    github: { method: 'GET', path: `${GITHUB}/issues/3`, body: rawIssue },
  },
  {
    name: 'listIssues',
    run: t => t.listIssues(call, { state: 'open', page: 1, perPage: 30, labels: ['bug'] }),
    legacy: { method: 'GET', path: `${LEGACY}/issues`, body: { issues: [issue] } },
    // GitHub lists pull requests among issues; the platform drops them.
    github: { method: 'GET', path: `${GITHUB}/issues`, body: [rawIssue, { ...rawIssue, number: 7, pull_request: {} }] },
  },
  {
    name: 'updateIssue',
    run: t => t.updateIssue(call, 3, { state: 'closed', stateReason: 'completed' }),
    legacy: { method: 'PATCH', path: `${LEGACY}/issues/3`, body: issue },
    github: { method: 'PATCH', path: `${GITHUB}/issues/3`, body: rawIssue },
  },
  {
    name: 'addIssueLabels',
    run: t => t.addIssueLabels(call, 3, ['bug']),
    legacy: { method: 'POST', path: `${LEGACY}/issues/3/labels`, body: { labels: ['triage', 'bug'] } },
    github: { method: 'POST', path: `${GITHUB}/issues/3/labels`, body: [{ name: 'triage' }, { name: 'bug' }] },
  },
  {
    name: 'removeIssueLabel',
    run: t => t.removeIssueLabel(call, 3, 'bug'),
    legacy: { method: 'DELETE', path: `${LEGACY}/issues/3/labels/bug` },
    github: { method: 'DELETE', path: `${GITHUB}/issues/3/labels/bug`, body: [] },
  },
  {
    name: 'listIssueComments',
    run: t => t.listIssueComments(call, 7, { page: 1, perPage: 30 }),
    legacy: { method: 'GET', path: `${LEGACY}/issues/7/comments`, body: { comments: [comment] } },
    github: { method: 'GET', path: `${GITHUB}/issues/7/comments`, body: [rawComment] },
  },
  {
    name: 'createIssueComment',
    run: t => t.createIssueComment(call, 7, 'Hello'),
    legacy: { method: 'POST', path: `${LEGACY}/issues/7/comments`, body: comment },
    github: { method: 'POST', path: `${GITHUB}/issues/7/comments`, body: rawComment },
  },
  {
    name: 'updateIssueComment',
    run: t => t.updateIssueComment(call, 21, 'Hello'),
    legacy: { method: 'PATCH', path: `${LEGACY}/issues/comments/21`, body: comment },
    github: { method: 'PATCH', path: `${GITHUB}/issues/comments/21`, body: rawComment },
  },
  {
    name: 'deleteIssueComment',
    run: t => t.deleteIssueComment(call, 21),
    legacy: { method: 'DELETE', path: `${LEGACY}/issues/comments/21` },
    github: { method: 'DELETE', path: `${GITHUB}/issues/comments/21` },
  },
  {
    name: 'listReviews',
    run: t => t.listReviews(call, 7, { page: 1, perPage: 30 }),
    legacy: { method: 'GET', path: `${LEGACY}/pulls/7/reviews`, body: { reviews: [review] } },
    github: { method: 'GET', path: `${GITHUB}/pulls/7/reviews`, body: [rawReview] },
  },
  {
    name: 'getReview',
    run: t => t.getReview(call, 7, 11),
    legacy: { method: 'GET', path: `${LEGACY}/pulls/7/reviews/11`, body: review },
    github: { method: 'GET', path: `${GITHUB}/pulls/7/reviews/11`, body: rawReview },
  },
  {
    name: 'createReview',
    run: t => t.createReview(call, 7, { body: 'ok', event: 'APPROVE' }),
    legacy: { method: 'POST', path: `${LEGACY}/pulls/7/reviews`, body: review },
    github: { method: 'POST', path: `${GITHUB}/pulls/7/reviews`, body: rawReview },
  },
  {
    name: 'updateReview',
    run: t => t.updateReview(call, 7, 11, 'ok'),
    legacy: { method: 'PUT', path: `${LEGACY}/pulls/7/reviews/11`, body: review },
    github: { method: 'PUT', path: `${GITHUB}/pulls/7/reviews/11`, body: rawReview },
  },
  {
    name: 'submitReview',
    run: t => t.submitReview(call, 7, 11, { event: 'APPROVE' }),
    legacy: { method: 'POST', path: `${LEGACY}/pulls/7/reviews/11/events`, body: review },
    github: { method: 'POST', path: `${GITHUB}/pulls/7/reviews/11/events`, body: rawReview },
  },
  {
    name: 'dismissReview',
    run: t => t.dismissReview(call, 7, 11, 'Stale'),
    legacy: { method: 'PUT', path: `${LEGACY}/pulls/7/reviews/11/dismissals`, body: review },
    github: { method: 'PUT', path: `${GITHUB}/pulls/7/reviews/11/dismissals`, body: rawReview },
  },
  {
    name: 'deletePendingReview',
    run: t => t.deletePendingReview(call, 7, 11),
    legacy: { method: 'DELETE', path: `${LEGACY}/pulls/7/reviews/11` },
    github: { method: 'DELETE', path: `${GITHUB}/pulls/7/reviews/11`, body: rawReview },
  },
  {
    name: 'listReviewComments',
    run: t => t.listReviewComments(call, 7, { page: 1, perPage: 30 }),
    legacy: { method: 'GET', path: `${LEGACY}/pulls/7/comments`, body: { comments: [reviewComment] } },
    github: { method: 'GET', path: `${GITHUB}/pulls/7/comments`, body: [rawReviewComment] },
  },
  {
    name: 'createReviewComment',
    run: t =>
      t.createReviewComment(call, 7, { body: 'Hello', commitId: 'h1', path: 'src/a.ts', line: 4, side: 'RIGHT' }),
    legacy: { method: 'POST', path: `${LEGACY}/pulls/7/comments`, body: reviewComment },
    github: { method: 'POST', path: `${GITHUB}/pulls/7/comments`, body: rawReviewComment },
  },
  {
    name: 'updateReviewComment',
    run: t => t.updateReviewComment(call, 31, 'Hello'),
    legacy: { method: 'PATCH', path: `${LEGACY}/pulls/comments/31`, body: reviewComment },
    github: { method: 'PATCH', path: `${GITHUB}/pulls/comments/31`, body: rawReviewComment },
  },
  {
    name: 'deleteReviewComment',
    run: t => t.deleteReviewComment(call, 31),
    legacy: { method: 'DELETE', path: `${LEGACY}/pulls/comments/31` },
    github: { method: 'DELETE', path: `${GITHUB}/pulls/comments/31` },
  },
  {
    name: 'listRequestedReviewers',
    run: t => t.listRequestedReviewers(call, 7),
    legacy: { method: 'GET', path: `${LEGACY}/pulls/7/requested-reviewers`, body: reviewers },
    github: { method: 'GET', path: `${GITHUB}/pulls/7/requested_reviewers`, body: rawReviewers },
  },
  {
    name: 'requestReviewers',
    run: t => t.requestReviewers(call, 7, { users: ['hubot'], teams: ['core'] }),
    legacy: { method: 'POST', path: `${LEGACY}/pulls/7/requested-reviewers`, body: reviewers },
    github: { method: 'POST', path: `${GITHUB}/pulls/7/requested_reviewers`, body: rawPullRequestWithReviewers },
  },
  {
    name: 'removeRequestedReviewers',
    run: t => t.removeRequestedReviewers(call, 7, { users: ['hubot'] }),
    legacy: { method: 'DELETE', path: `${LEGACY}/pulls/7/requested-reviewers`, body: reviewers },
    github: { method: 'DELETE', path: `${GITHUB}/pulls/7/requested_reviewers`, body: rawPullRequestWithReviewers },
  },
  {
    name: 'createCheckRun',
    run: t =>
      t.createCheckRun(call, {
        name: 'Factory',
        headSha: 'h1',
        status: 'completed',
        conclusion: 'success',
        output: { title: 'Done', summary: 'ok' },
      }),
    legacy: { method: 'POST', path: `${LEGACY}/check-runs`, body: { id: 5, htmlUrl: 'https://github.com/c/5' } },
    github: { method: 'POST', path: `${GITHUB}/check-runs`, body: { id: 5, html_url: 'https://github.com/c/5' } },
  },
  {
    name: 'getCollaboratorPermission',
    run: t => t.getCollaboratorPermission(call, 'octocat'),
    legacy: { method: 'GET', path: `${LEGACY}/collaborators/octocat/permission`, body: { permission: 'write' } },
    github: {
      method: 'GET',
      path: `${GITHUB}/collaborators/octocat/permission`,
      body: { permission: 'write', role_name: 'maintain' },
    },
  },
  {
    name: 'listDependabotAlerts',
    run: t => t.listDependabotAlerts(call, 'open'),
    legacy: { method: 'GET', path: `${LEGACY}/dependabot/alerts`, body: { alerts } },
    github: { method: 'GET', path: `${GITHUB}/dependabot/alerts`, body: alerts },
  },
];

async function transports(): Promise<{ legacy: LegacyGithubTransport; connect: ConnectGithubTransport }> {
  const platform = await startFakePlatform();
  const github = await startFakeGithub();
  platform.credentials.set('conn-github', { type: 'oauth2', accessToken: 'tok-github', expiresAt: FUTURE });
  platform.credentials.set('conn-reviews', { type: 'oauth2', accessToken: 'tok-reviews', expiresAt: FUTURE });
  platform.route = (method, path) => {
    const operation = OPERATIONS.find(
      candidate => candidate.legacy.method === method && candidate.legacy.path === path,
    );
    if (!operation) return undefined;
    return operation.legacy.body === undefined ? { status: 204 } : { status: 200, body: operation.legacy.body };
  };
  github.route = request => {
    const operation = OPERATIONS.find(
      candidate => candidate.github.method === request.method && candidate.github.path === request.path,
    );
    if (!operation) return undefined;
    return operation.github.body === undefined ? { status: 204 } : { status: 200, body: operation.github.body };
  };
  return {
    legacy: new LegacyGithubTransport(platform.connect()),
    connect: new ConnectGithubTransport({
      orgId: 'org-1',
      installation: {
        accountLogin: 'acme',
        installationId: 900,
        connectionId: 'conn-github',
        reviewsConnectionId: 'conn-reviews',
      },
      tokens: new GithubConnectTokens(platform.connect()),
      isFactoryLogin: login => login === 'mastra-factory-reviews[bot]',
      baseUrl: github.baseUrl,
    }),
  };
}

describe('GitHub transport parity', () => {
  it('covers every repository operation of the transport contract', () => {
    const contract = Object.getOwnPropertyNames(LegacyGithubTransport.prototype).filter(
      name =>
        name !== 'constructor' &&
        ![
          'listInstallations',
          'listInstallationRepositories',
          'mintRepositoryToken',
          'installUrl',
          'authenticateUrl',
          'userConnection',
        ].includes(name),
    );
    expect(new Set(OPERATIONS.map(operation => operation.name))).toEqual(new Set(contract));
  });

  it.each(OPERATIONS.map(operation => [operation.name, operation] as const))(
    '%s answers the same through both transports',
    async (_name, operation) => {
      const { legacy, connect } = await transports();
      const fromLegacy = await operation.run(legacy);
      const fromConnect = await operation.run(connect);
      expect(fromConnect).toEqual(fromLegacy);
    },
  );
});
