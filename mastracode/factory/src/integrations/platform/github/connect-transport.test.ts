import { describe, expect, it } from 'vitest';

import { REVIEW_STATUS_COMMENT_MARKER } from '../../github/review-status-comment.js';
import { startFakePlatform } from '../foundation/test-utils.js';
import type { FakePlatform } from '../foundation/test-utils.js';
import { FACTORY_GITHUB_PROVIDER_KEY } from './connect-events.js';
import { GithubConnectTokens } from './connect-tokens.js';
import {
  ConnectGithubTransport,
  GithubApiError,
  GithubReviewAuthorRequiredError,
  githubErrorStatus,
} from './connect-transport.js';
import type { GithubTokenClass } from './connect-transport.js';
import { startFakeGithub } from './test-utils.js';
import type { FakeGithub, FakeGithubRequest } from './test-utils.js';

const REPO = 'acme/widgets';
const FUTURE = '2099-01-01T00:00:00.000Z';
const INSTALLATION = {
  accountLogin: 'acme',
  installationId: 900,
  connectionId: 'conn-github',
  reviewsConnectionId: 'conn-reviews',
};

const rawUser = (login: string) => ({
  login,
  avatar_url: `https://avatars.example/${login}`,
  html_url: `https://github.com/${login}`,
});

const rawComment = (id: number, body: string, login = 'mastra-factory[bot]') => ({
  id,
  body,
  html_url: `https://github.com/${REPO}/pull/7#issuecomment-${id}`,
  user: rawUser(login),
  created_at: '2026-11-13T10:00:00Z',
  updated_at: '2026-11-13T10:00:00Z',
});

const rawReview = (id: number, login: string, state = 'PENDING') => ({
  id,
  html_url: `https://github.com/${REPO}/pull/7#pullrequestreview-${id}`,
  body: 'Looks good',
  state,
  commit_id: 'abc123',
  submitted_at: state === 'PENDING' ? null : '2026-11-13T10:05:00Z',
  user: rawUser(login),
});

interface Harness {
  platform: FakePlatform;
  github: FakeGithub;
  transport: ConnectGithubTransport;
  tokens: GithubConnectTokens;
  tokenClasses: Array<{ operation: string; tokenClass: GithubTokenClass }>;
  now: { value: number };
}

/**
 * `users` connect GitHub as an end-user `factory-github` connection (token
 * `tok-<userId>`); `pats` paste a PAT instead (token `pat-<userId>`). PATs are
 * read for org `org-1` only.
 */
async function harness(
  options: { users?: Record<string, string>; pats?: Record<string, string> } = {},
): Promise<Harness> {
  const platform = await startFakePlatform();
  const github = await startFakeGithub();
  // The org's own `factory-github` connection shares the provider key with users' connections.
  platform.orgConnections.push({ id: 'conn-github', integrationId: FACTORY_GITHUB_PROVIDER_KEY, status: 'active' });
  platform.linked.add('conn-github');
  platform.credentials.set('conn-github', { type: 'oauth2', accessToken: 'tok-github', expiresAt: FUTURE });
  platform.credentials.set('conn-reviews', { type: 'oauth2', accessToken: 'tok-reviews', expiresAt: FUTURE });
  const answerUser = (token: string, login: string) => {
    const previous = github.route;
    github.route = request =>
      request.path === '/user' && request.token === token ? { status: 200, body: { login } } : previous(request);
  };
  for (const [userId, login] of Object.entries(options.users ?? {})) {
    const id = `conn-user-${userId}`;
    platform.orgConnections.push({
      id,
      integrationId: FACTORY_GITHUB_PROVIDER_KEY,
      status: 'active',
      resourceId: userId,
    });
    platform.linked.add(id);
    platform.credentials.set(id, { type: 'oauth2', accessToken: `tok-${userId}`, expiresAt: FUTURE });
    answerUser(`tok-${userId}`, login);
  }
  for (const [userId, login] of Object.entries(options.pats ?? {})) answerUser(`pat-${userId}`, login);
  const now = { value: Date.parse('2026-11-13T12:00:00Z') };
  const tokens = new GithubConnectTokens(platform.connect(), {
    now: () => now.value,
    userPat: async (orgId, userId) => (orgId === 'org-1' && options.pats?.[userId] ? `pat-${userId}` : null),
  });
  const tokenClasses: Harness['tokenClasses'] = [];
  const transport = new ConnectGithubTransport({
    orgId: 'org-1',
    installation: INSTALLATION,
    tokens,
    isFactoryLogin: login => login === 'mastra-factory[bot]' || login === 'mastra-factory-reviews[bot]',
    baseUrl: github.baseUrl,
    onToken: event => tokenClasses.push(event),
  });
  return { platform, github, transport, tokens, tokenClasses, now };
}

/** Answers `route` for requests matching method and path; everything else falls through. */
function answer(
  github: FakeGithub,
  method: string,
  path: string,
  reply: (request: FakeGithubRequest) => { status: number; body?: unknown },
): void {
  const previous = github.route;
  github.route = request => (request.method === method && request.path === path ? reply(request) : previous(request));
}

describe('ConnectGithubTransport', () => {
  describe('which app a call runs as', () => {
    it('reads and writes pull requests and issues as factory-github', async () => {
      const { github, transport } = await harness();
      answer(github, 'GET', `/repos/${REPO}/issues/3`, () => ({
        status: 200,
        body: {
          number: 3,
          state: 'open',
          title: 'Bug',
          html_url: 'u',
          labels: [],
          created_at: 't',
          updated_at: 't',
        },
      }));
      answer(github, 'POST', `/repos/${REPO}/issues/3/labels`, () => ({ status: 200, body: [{ name: 'bug' }] }));

      await transport.getIssue({ repository: REPO }, 3);
      expect(await transport.addIssueLabels({ repository: REPO }, 3, ['bug'])).toEqual(['bug']);

      expect(github.requests.map(request => request.token)).toEqual(['tok-github', 'tok-github']);
    });

    it('runs reviews, review comments and check runs as factory-reviews-github', async () => {
      const { github, transport, tokenClasses } = await harness();
      answer(github, 'GET', `/repos/${REPO}/pulls/7/reviews`, () => ({ status: 200, body: [] }));
      answer(github, 'POST', `/repos/${REPO}/pulls/7/reviews`, () => ({
        status: 200,
        body: rawReview(11, 'mastra-factory-reviews[bot]', 'APPROVED'),
      }));
      answer(github, 'GET', `/repos/${REPO}/pulls/7/comments`, () => ({ status: 200, body: [] }));
      answer(github, 'POST', `/repos/${REPO}/check-runs`, () => ({
        status: 201,
        body: { id: 5, html_url: 'https://github.com/check/5' },
      }));

      await transport.listReviews({ repository: REPO }, 7, { page: 1, perPage: 30 });
      await transport.createReview({ repository: REPO }, 7, { body: 'ok', event: 'APPROVE' });
      await transport.listReviewComments({ repository: REPO }, 7, { page: 1, perPage: 30 });
      expect(
        await transport.createCheckRun(
          { repository: REPO },
          { name: 'Factory review', headSha: 'abc', status: 'completed', output: { title: 't', summary: 's' } },
        ),
      ).toEqual({ id: 5, htmlUrl: 'https://github.com/check/5' });

      expect(github.requests.map(request => request.token)).toEqual([
        'tok-reviews',
        'tok-reviews',
        'tok-reviews',
        'tok-reviews',
      ]);
      expect(new Set(tokenClasses.map(event => event.tokenClass))).toEqual(new Set(['review']));
    });

    it('posts the review-status comment as the Reviews app and other comments as factory-github', async () => {
      const { github, transport } = await harness();
      answer(github, 'POST', `/repos/${REPO}/issues/7/comments`, request => ({
        status: 201,
        body: rawComment(1, (request.body as { body: string }).body),
      }));
      answer(github, 'PATCH', `/repos/${REPO}/issues/comments/1`, request => ({
        status: 200,
        body: rawComment(1, (request.body as { body: string }).body),
      }));

      await transport.createIssueComment({ repository: REPO }, 7, `${REVIEW_STATUS_COMMENT_MARKER}\nReviewing`);
      await transport.updateIssueComment({ repository: REPO }, 1, `${REVIEW_STATUS_COMMENT_MARKER}\nApproved`);
      await transport.createIssueComment({ repository: REPO }, 7, 'Handing off to the builder');

      expect(github.requests.map(request => request.token)).toEqual(['tok-reviews', 'tok-reviews', 'tok-github']);
    });
  });

  describe('writes made for a person', () => {
    // Legacy parity: the platform writes as the app naming the person. Only a person's own
    // pending review, which nobody else can see or change, is written with their token.
    it('comments as the app, naming the person by their GitHub login, even when they have their own token', async () => {
      const { github, transport } = await harness({ users: { 'user-1': 'octocat' } });
      answer(github, 'POST', `/repos/${REPO}/issues/7/comments`, request => ({
        status: 201,
        body: rawComment(1, (request.body as { body: string }).body),
      }));

      const comment = await transport.createIssueComment({ repository: REPO, actingUserId: 'user-1' }, 7, 'Done');

      const [request] = github.calls(`/repos/${REPO}/issues/7/comments`);
      expect(request?.token).toBe('tok-github');
      expect(request?.body).toEqual({ body: '> Opened by @octocat\n\nDone' });
      // Still Factory's own comment, so the self-loop guards recognise it.
      expect(comment.user?.login).toBe('mastra-factory[bot]');
    });

    it('reviews and merges as the apps, naming the person, even when they have their own token', async () => {
      const { github, transport } = await harness({ users: { 'user-1': 'octocat' }, pats: { 'user-3': 'hubot' } });
      answer(github, 'POST', `/repos/${REPO}/pulls/7/reviews`, () => ({
        status: 200,
        body: rawReview(21, 'mastra-factory-reviews[bot]'),
      }));
      answer(github, 'PUT', `/repos/${REPO}/pulls/7/merge`, () => ({
        status: 200,
        body: { merged: true, message: 'Merged', sha: 'm1' },
      }));

      // A verdict review must stay Factory's: its stale-review dismissal finds it by author,
      // and GitHub refuses a person approving their own pull request.
      await transport.createReview({ repository: REPO, actingUserId: 'user-1' }, 7, {
        event: 'APPROVE',
        body: 'Ship it',
      });
      await transport.createReview({ repository: REPO, actingUserId: 'user-3' }, 7, { body: 'Thanks' });
      await transport.mergePullRequest({ repository: REPO, actingUserId: 'user-1' }, 7, {});

      const reviews = github.calls(`/repos/${REPO}/pulls/7/reviews`, 'POST');
      expect(reviews.map(request => [request.token, (request.body as { body: string }).body])).toEqual([
        ['tok-reviews', '> Opened by @octocat\n\nShip it'],
        ['tok-reviews', '> Opened by @hubot\n\nThanks'],
      ]);
      expect(github.calls(`/repos/${REPO}/pulls/7/merge`, 'PUT')[0]?.token).toBe('tok-github');
    });

    it("dismisses another person's submitted review as the Reviews app", async () => {
      const { github, transport } = await harness({ users: { 'user-1': 'octocat' } });
      answer(github, 'PUT', `/repos/${REPO}/pulls/7/reviews/31/dismissals`, () => ({
        status: 200,
        body: rawReview(31, 'grace', 'DISMISSED'),
      }));

      const review = await transport.dismissReview({ repository: REPO, actingUserId: 'user-1' }, 7, 31, 'Addressed');

      const [request] = github.calls(`/repos/${REPO}/pulls/7/reviews/31/dismissals`, 'PUT');
      expect(request?.token).toBe('tok-reviews');
      expect(request?.body).toEqual({ message: '> Opened by @octocat\n\nAddressed' });
      expect(review.state).toBe('DISMISSED');
    });

    it('reviews as the Reviews app, naming the person, when they have no token of their own', async () => {
      const { github, transport } = await harness();
      answer(github, 'POST', `/repos/${REPO}/pulls/7/reviews`, () => ({
        status: 200,
        body: rawReview(21, 'mastra-factory-reviews[bot]'),
      }));

      await transport.createReview({ repository: REPO, actingUserId: 'user-2' }, 7, { body: 'LGTM' });

      const [request] = github.calls(`/repos/${REPO}/pulls/7/reviews`, 'POST');
      expect(request?.token).toBe('tok-reviews');
      expect(request?.body).toEqual({ body: '> Opened by @user-2\n\nLGTM' });
    });

    it("never takes the org's own factory-github connection for a person's token", async () => {
      const { tokens } = await harness();

      expect(await tokens.userToken('org-1', 'user-9')).toBeNull();
    });

    it('reads a PAT only in the org it was pasted in', async () => {
      const { tokens } = await harness({ pats: { 'user-3': 'hubot' } });

      expect(await tokens.userToken('org-1', 'user-3')).toEqual({ source: 'pat', token: 'pat-user-3' });
      expect(await tokens.userToken('org-2', 'user-3')).toBeNull();
    });

    it('runs as the app and names the person when they have no GitHub connection', async () => {
      const { github, transport } = await harness();
      answer(github, 'POST', `/repos/${REPO}/pulls`, request => ({
        status: 201,
        body: {
          number: 9,
          title: 'Fix',
          body: (request.body as { body: string }).body,
          state: 'open',
          html_url: 'u',
          head: { ref: 'fix', sha: 'h' },
          base: { ref: 'main', repo: { id: 42, full_name: REPO } },
          created_at: 't',
          updated_at: 't',
        },
      }));

      await transport.createPullRequest(
        { repository: REPO, actingUserId: 'user-2' },
        { head: 'fix', base: 'main', title: 'Fix', body: 'Fixes the bug' },
      );

      const [request] = github.calls(`/repos/${REPO}/pulls`, 'POST');
      expect(request?.token).toBe('tok-github');
      expect((request?.body as { body: string }).body).toBe('> Opened by @user-2\n\nFixes the bug');
    });

    it('never attributes a read or a write made for no one', async () => {
      const { github, transport } = await harness();
      answer(github, 'POST', `/repos/${REPO}/issues/7/comments`, request => ({
        status: 201,
        body: rawComment(1, (request.body as { body: string }).body),
      }));

      await transport.createIssueComment({ repository: REPO }, 7, 'Plain');

      expect(github.calls(`/repos/${REPO}/issues/7/comments`)[0]?.body).toEqual({ body: 'Plain' });
    });

    it('assigns as the person with their own token', async () => {
      const { github, transport } = await harness({ users: { 'user-1': 'octocat' } });
      answer(github, 'POST', `/repos/${REPO}/issues/9/assignees`, () => ({
        status: 201,
        body: { assignees: [{ login: 'octocat' }] },
      }));

      expect(await transport.userLogin('user-1')).toBe('octocat');
      expect(await transport.userLogin('user-2')).toBeNull();
      const data = await transport.asUser('user-1', 'assign', async octokit => {
        const response = await octokit.issues.addAssignees({
          owner: 'acme',
          repo: 'widgets',
          issue_number: 9,
          assignees: ['octocat'],
        });
        return response.data;
      });

      expect(data?.assignees?.[0]?.login).toBe('octocat');
      expect(github.calls(`/repos/${REPO}/issues/9/assignees`)[0]?.token).toBe('tok-user-1');
    });
  });

  describe('changing an existing review', () => {
    it("changes Factory's own pending review as the Reviews app", async () => {
      const { github, transport } = await harness();
      answer(github, 'GET', `/repos/${REPO}/pulls/7/reviews/11`, () => ({
        status: 200,
        body: rawReview(11, 'mastra-factory-reviews[bot]'),
      }));
      answer(github, 'POST', `/repos/${REPO}/pulls/7/reviews/11/events`, () => ({
        status: 200,
        body: rawReview(11, 'mastra-factory-reviews[bot]', 'APPROVED'),
      }));

      const review = await transport.submitReview({ repository: REPO }, 7, 11, { event: 'APPROVE' });

      expect(review.state).toBe('APPROVED');
      expect(github.calls(`/repos/${REPO}/pulls/7/reviews/11/events`)[0]?.token).toBe('tok-reviews');
    });

    it("finds a person's pending review through their token and changes it as them", async () => {
      const { github, transport } = await harness({ users: { 'user-1': 'octocat' } });
      // The app can't see a human's pending review; its author can.
      answer(github, 'GET', `/repos/${REPO}/pulls/7/reviews/12`, request =>
        request.token === 'tok-user-1'
          ? { status: 200, body: rawReview(12, 'octocat') }
          : { status: 404, body: { message: 'Not Found' } },
      );
      answer(github, 'PUT', `/repos/${REPO}/pulls/7/reviews/12`, () => ({
        status: 200,
        body: rawReview(12, 'octocat'),
      }));

      await transport.updateReview({ repository: REPO, actingUserId: 'user-1' }, 7, 12, 'Updated');

      const [update] = github.calls(`/repos/${REPO}/pulls/7/reviews/12`, 'PUT');
      expect(update?.token).toBe('tok-user-1');
      expect(update?.body).toEqual({ body: 'Updated' });
    });

    it("refuses to change another person's review", async () => {
      const { github, transport } = await harness({ users: { 'user-1': 'octocat' } });
      answer(github, 'GET', `/repos/${REPO}/pulls/7/reviews/13`, () => ({
        status: 200,
        body: rawReview(13, 'someone-else'),
      }));

      await expect(
        transport.deletePendingReview({ repository: REPO, actingUserId: 'user-1' }, 7, 13),
      ).rejects.toBeInstanceOf(GithubReviewAuthorRequiredError);
      await expect(transport.deletePendingReview({ repository: REPO }, 7, 13)).rejects.toBeInstanceOf(
        GithubReviewAuthorRequiredError,
      );
      expect(github.calls(`/repos/${REPO}/pulls/7/reviews/13`, 'DELETE')).toEqual([]);
    });
  });

  describe('tokens', () => {
    it('reuses a token until shortly before it expires', async () => {
      const { platform, github, transport, now } = await harness();
      platform.credentials.set('conn-github', {
        type: 'oauth2',
        accessToken: 'tok-github',
        expiresAt: '2026-11-13T13:00:00.000Z',
      });
      answer(github, 'GET', `/repos/${REPO}/pulls`, () => ({ status: 200, body: [] }));
      const mints = () =>
        platform.requests.filter(request => request.path === '/v2/connections/conn-github/github/installation-token')
          .length;

      await transport.listPullRequests({ repository: REPO }, { state: 'open', page: 1, perPage: 30 });
      await transport.listPullRequests({ repository: REPO }, { state: 'open', page: 1, perPage: 30 });
      expect(mints()).toBe(1);

      // Within a minute of expiry the token is refreshed.
      now.value = Date.parse('2026-11-13T12:59:30Z');
      await transport.listPullRequests({ repository: REPO }, { state: 'open', page: 1, perPage: 30 });
      expect(mints()).toBe(2);
    });

    it('mints a scoped token per repository set, reuses it, and drops it with the installation', async () => {
      const { platform, tokens } = await harness();
      const mints = () =>
        platform.requests.filter(request => request.path === '/v2/connections/conn-github/github/installation-token');
      const scope = { repositories: ['web', 'api'], permissions: { contents: 'write', issues: 'write' } } as const;

      expect(await tokens.repositoryToken('conn-github', scope)).toBe('tok-github@api,web');
      // Same set in another order, same permissions in another order: one token.
      expect(
        await tokens.repositoryToken('conn-github', {
          repositories: ['api', 'web'],
          permissions: { issues: 'write', contents: 'write' },
        }),
      ).toBe('tok-github@api,web');
      expect(await tokens.repositoryToken('conn-github', { ...scope, repositories: ['web'] })).toBe('tok-github@web');
      expect(await tokens.installationToken('conn-github')).toBe('tok-github');
      expect(mints().map(request => request.body)).toEqual([
        { repositories: ['api', 'web'], permissions: { contents: 'write', issues: 'write' } },
        { repositories: ['web'], permissions: { contents: 'write', issues: 'write' } },
        {},
      ]);

      tokens.invalidateInstallation('conn-github');
      await tokens.repositoryToken('conn-github', scope);
      await tokens.installationToken('conn-github');
      expect(mints()).toHaveLength(5);
    });

    it('drops a token GitHub rejects and retries once with a fresh one', async () => {
      const { platform, github, transport } = await harness();
      let rejected = 0;
      answer(github, 'GET', `/repos/${REPO}/pulls/7`, request => {
        if (request.token === 'tok-github') {
          rejected++;
          // The token was revoked; the platform's next credential is a fresh one.
          platform.credentials.set('conn-github', { type: 'oauth2', accessToken: 'tok-github-2', expiresAt: FUTURE });
          return { status: 401, body: { message: 'Bad credentials' } };
        }
        return {
          status: 200,
          body: {
            number: 7,
            title: 'T',
            state: 'open',
            html_url: 'u',
            head: { ref: 'h', sha: 's' },
            base: { ref: 'main', repo: { id: 42, full_name: REPO } },
            created_at: 't',
            updated_at: 't',
          },
        };
      });
      expect((await transport.getPullRequest({ repository: REPO }, 7)).number).toBe(7);
      expect(rejected).toBe(1);
      expect(github.requests.map(request => request.token)).toEqual(['tok-github', 'tok-github-2']);
    });

    it('surfaces a second rejection with its status', async () => {
      const { github, transport } = await harness();
      answer(github, 'GET', `/repos/${REPO}/pulls/7`, () => ({ status: 401, body: { message: 'Bad credentials' } }));

      const error = await transport.getPullRequest({ repository: REPO }, 7).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(GithubApiError);
      expect(githubErrorStatus(error)).toBe(401);
      expect(github.requests).toHaveLength(2);
    });

    it('reports GitHub failures with their status', async () => {
      const { transport } = await harness();

      const error = await transport.getIssue({ repository: REPO }, 404).catch((caught: unknown) => caught);

      expect(githubErrorStatus(error)).toBe(404);
    });
  });

  it('lists every repository the installation reaches, page by page', async () => {
    const { github, transport } = await harness();
    const repositories = Array.from({ length: 130 }, (_, index) => ({
      id: index + 1,
      name: `repo-${index + 1}`,
      full_name: `acme/repo-${index + 1}`,
      private: index % 2 === 0,
      default_branch: 'main',
      html_url: `https://github.com/acme/repo-${index + 1}`,
      owner: { login: 'acme', type: 'Organization' },
    }));
    answer(github, 'GET', '/installation/repositories', request => {
      const page = Number(request.query.get('page'));
      return { status: 200, body: { repositories: repositories.slice((page - 1) * 100, page * 100) } };
    });

    const listed = await transport.listInstallationRepositories();

    expect(listed).toHaveLength(130);
    expect(listed[0]).toEqual({
      id: 1,
      owner: 'acme',
      name: 'repo-1',
      fullName: 'acme/repo-1',
      private: true,
      defaultBranch: 'main',
      htmlUrl: 'https://github.com/acme/repo-1',
      pushedAt: null,
    });
    expect(github.requests.every(request => request.token === 'tok-github')).toBe(true);
  });
});
