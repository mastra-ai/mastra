import type { WorkItemRow } from '@mastra/factory/storage/domains/work-items/work-item-schema';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listedRepository } from '../../../../e2e/ui/factory-projects';
import { server } from '../../../../e2e/ui/msw-server';
import { findPageHeader, renderWithProviders, TEST_BASE_URL } from '../../../../e2e/ui/render';
import { sessionCardsWhileBoardLoads } from '../../../../e2e/ui/session-cards';
import type { PullRequestSubscription } from '../../domains/factory/services/githubSubscriptions';
import { createAppRoutes } from '../../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'ghp-1';
const SESSION_ID = 'sess-1';
const THREAD_ID = 'thread-1';
const ISSUE_NUMBER = 20337;
const ISSUE_URL = `https://github.com/mastra-ai/mastra/issues/${ISSUE_NUMBER}`;
const PULL_REQUEST_NUMBER = 20338;
const PULL_REQUEST_URL = `https://github.com/mastra-ai/mastra/pull/${PULL_REQUEST_NUMBER}`;
const OTHER_PULL_REQUEST_NUMBER = 20339;
const OTHER_PULL_REQUEST_URL = `https://github.com/mastra-ai/mastra/pull/${OTHER_PULL_REQUEST_NUMBER}`;
const MALFORMED_PULL_REQUEST_URL = 'https://github.com/mastra-ai/mastra/pull/20340';
const NON_POSITIVE_PULL_REQUEST_URL = 'https://github.com/mastra-ai/mastra/pull/0';
const AC = `${TEST_BASE_URL}/api/agent-controller/code`;

const workspaceSession = {
  id: 'row-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPO_ID,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'factory/item-1',
  baseBranch: 'main',
  sandboxId: 'sb-1',
  sandboxWorkdir: '/local/mastra',
  materializedAt: '2026-07-29T00:00:00.000Z',
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
};

const pullRequestSubscription: PullRequestSubscription = {
  id: 'subscription-1',
  repoFullName: 'mastra-ai/mastra',
  pullRequestNumber: PULL_REQUEST_NUMBER,
  status: 'open',
  url: PULL_REQUEST_URL,
};

const otherPullRequestSubscription: PullRequestSubscription = {
  id: 'subscription-2',
  repoFullName: 'mastra-ai/mastra',
  pullRequestNumber: OTHER_PULL_REQUEST_NUMBER,
  status: 'open',
  url: OTHER_PULL_REQUEST_URL,
};

const sessionRef = { sessionId: SESSION_ID, branch: 'factory/item-1', threadId: THREAD_ID, startedBy: 'user-1' };

/** The Review card a pull request opens: its source is the pull request itself. */
function pullRequestCard() {
  return {
    id: 'work-item-pull-request',
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: FACTORY_ID,
    externalSource: {
      integrationId: 'github',
      type: 'pull-request',
      externalId: String(PULL_REQUEST_NUMBER),
      url: PULL_REQUEST_URL,
    },
    parentWorkItemId: null,
    title: 'Move the pull request link',
    stages: ['pr-review'],
    stageHistory: [] as { stage: string; enteredAt: string; by: string; exitedAt?: string }[],
    sessions: { review: sessionRef },
    metadata: { githubPullRequestNumber: PULL_REQUEST_NUMBER, number: PULL_REQUEST_NUMBER, state: 'open' },
    revision: 1,
    createdAt: '2026-07-29T00:00:00.000Z',
    updatedAt: '2026-07-29T00:00:00.000Z',
  };
}

/** A card worked from a GitHub issue, being built in this session; `null` leaves its issue without a URL. */
function issueCard(url: string | null = ISSUE_URL) {
  return {
    ...pullRequestCard(),
    id: 'work-item-issue',
    externalSource: {
      integrationId: 'github',
      type: 'issue',
      externalId: `github-issue:${ISSUE_NUMBER}`,
      ...(url ? { url } : {}),
    },
    title: 'Track the pull request link',
    stages: ['execute'],
    sessions: { work: sessionRef },
    metadata: { number: ISSUE_NUMBER },
  };
}

function stubThreadRoute(workItems: unknown[], subscriptions: unknown[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          {
            id: FACTORY_ID,
            name: 'Mastra Factory',
            repositories: [
              listedRepository(REPO_ID, 'mastra-ai/mastra', { branch: 'main', sandboxWorkdir: '/local/mastra' }),
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () => HttpResponse.json({ config: {} })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`, () =>
      HttpResponse.json({ project: { id: FACTORY_ID, name: 'Mastra Factory', defaultModelId: 'openai/gpt-4o-mini' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
      HttpResponse.json({ modelId: null, thinkingLevel: null }),
    ),
    http.get(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/feed-events`,
      () =>
        new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [workspaceSession] }),
    ),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, () =>
      HttpResponse.json({ session: workspaceSession }),
    ),
    http.post(`${AC}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: SESSION_ID, threadId: THREAD_ID }),
    ),
    http.get(`${AC}/sessions/:sessionId`, () =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: SESSION_ID,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: THREAD_ID,
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      }),
    ),
    http.put(`${AC}/sessions/:sessionId/state`, () => HttpResponse.json({ ok: true })),
    http.get(
      `${AC}/sessions/:sessionId/stream`,
      () =>
        new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ),
    http.get(`${AC}/sessions/:sessionId/permissions`, () => HttpResponse.json({})),
    http.get(`${AC}/sessions/:sessionId/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${AC}/sessions/:sessionId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ workspacePath: `/ws/${SESSION_ID}`, root: '.artifacts', rootPath: '', entries: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/workspace/changes`, () =>
      HttpResponse.json({ workspacePath: SESSION_ID, available: true, changes: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () => HttpResponse.json({ workItems })),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions })),
  );
}

function renderThreadRoute(path = `/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${THREAD_ID}`) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  return renderWithProviders(<RouterProvider router={router} />);
}

/** The docked session panel, once its summary has drawn. */
async function findSessionPanel(name: 'Card' | 'Pull requests' = 'Card') {
  const panel = await screen.findByTestId('workspace-files-card');
  await within(panel).findByRole('region', { name });
  return panel;
}

const linksTo = (container: HTMLElement, url: string) =>
  within(container)
    .queryAllByRole('link')
    .filter(link => link.getAttribute('href')?.toLowerCase() === url.toLowerCase());

/** Links the session panel owns now, which the header and the composer no longer repeat. */
async function expectOnlyInPanel(url: string) {
  expect(linksTo(await findPageHeader(), url)).toHaveLength(0);
  expect(linksTo(await screen.findByRole('region', { name: 'Thread composer' }), url)).toHaveLength(0);
}

function pullRequestSource(number: number, state: 'open' | 'merged'): NonNullable<WorkItemRow['sources']>[number] {
  return {
    id: `source-pr-${number}`,
    workItemId: 'work-item-issue',
    provider: 'github',
    integrationId: 'github',
    sourceType: 'pull-request',
    workspaceId: null,
    externalId: `pull-request:github-pr:${number}`,
    sourceKey: `github:pull-request:github-pr:${number}`,
    key: `mastra-ai/mastra#${number}`,
    url: `https://github.com/mastra-ai/mastra/pull/${number}`,
    state: state === 'merged' ? 'closed' : 'open',
    labels: [],
    author: 'factory-bot',
    metadata: { number, state, merged: state === 'merged', factoryAuthored: true },
    revision: 1,
    syncedAt: null,
    createdAt: new Date('2026-07-29T00:00:00.000Z'),
    updatedAt: new Date('2026-07-29T00:00:00.000Z'),
  };
}

function issueCardWithSources(sources: NonNullable<WorkItemRow['sources']>) {
  const card = issueCard();
  return {
    ...card,
    workItem: {
      provider: 'github' as const,
      key: `mastra-ai/mastra#${ISSUE_NUMBER}`,
      url: ISSUE_URL,
      title: card.title,
      state: 'open',
      labels: [],
      author: 'octocat',
      metadata: {},
      sources,
    },
  };
}

describe('ThreadPage session panel', () => {
  // Wide enough to dock the panel beside the conversation.
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 1200, 800));
  });
  afterEach(() => vi.restoreAllMocks());

  describe('when the session reviews a pull request card', () => {
    it("heads the panel with the reviewed pull request and lists the thread's other ones under Links", async () => {
      stubThreadRoute([pullRequestCard()], [otherPullRequestSubscription]);
      renderThreadRoute();

      const panel = await findSessionPanel();
      const card = within(panel).getByRole('region', { name: 'Card' });
      const reviewed = await within(card).findByRole('link', { name: `Open PR #${PULL_REQUEST_NUMBER}` });
      expect(reviewed).toHaveAttribute('href', PULL_REQUEST_URL);
      const title = within(card).getByRole('heading', { level: 2 });
      expect(reviewed.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(await within(card).findByRole('link', { name: `Open PR #${OTHER_PULL_REQUEST_NUMBER}` })).toHaveAttribute(
        'href',
        OTHER_PULL_REQUEST_URL,
      );
      // The reviewed pull request is the card itself, so Links counts only the other one.
      expect(within(card).getByRole('heading', { name: 'Links 1' })).toBeInTheDocument();
      await expectOnlyInPanel(PULL_REQUEST_URL);
      await expectOnlyInPanel(OTHER_PULL_REQUEST_URL);
    });

    it.each([
      ['Merged', { state: 'merged' }],
      ['Draft', { state: 'open', draft: true }],
    ])('marks the reviewed pull request %s beside its reference', async (status, state) => {
      const card = pullRequestCard();
      stubThreadRoute([{ ...card, metadata: { ...card.metadata, ...state } }], []);
      renderThreadRoute();

      const panel = await findSessionPanel();
      const cardRegion = within(panel).getByRole('region', { name: 'Card' });
      await within(cardRegion).findByRole('link', { name: `Open PR #${PULL_REQUEST_NUMBER}` });
      expect(within(cardRegion).getByText(status)).toBeInTheDocument();
      expect(within(cardRegion).queryByRole('heading', { name: /^Links/ })).not.toBeInTheDocument();
    });

    it('names the reviewed pull request by its number alone, leaving its author and age to GitHub', async () => {
      const card = pullRequestCard();
      stubThreadRoute(
        [
          {
            ...card,
            workItem: {
              provider: 'github' as const,
              key: `mastra-ai/mastra#${PULL_REQUEST_NUMBER}`,
              url: PULL_REQUEST_URL,
              title: card.title,
              state: 'open',
              labels: [],
              author: 'mastra-platform[bot]',
              metadata: { githubPullRequestNumber: PULL_REQUEST_NUMBER, state: 'open' },
            },
          },
        ],
        [],
      );
      renderThreadRoute();

      const panel = await findSessionPanel();
      const cardRegion = within(panel).getByRole('region', { name: 'Card' });
      const reviewed = await within(cardRegion).findByRole('link', { name: `Open PR #${PULL_REQUEST_NUMBER}` });
      expect(reviewed).toHaveTextContent(new RegExp(`^PR #${PULL_REQUEST_NUMBER}$`));
      expect(within(cardRegion).queryByText(/mastra-platform/)).not.toBeInTheDocument();
      expect(within(cardRegion).queryByText(/mastra-ai\/mastra/)).not.toBeInTheDocument();
    });

    it.each([
      ['as the card links it', pullRequestSubscription],
      [
        'with the repository spelled differently',
        {
          ...pullRequestSubscription,
          repoFullName: 'Mastra-AI/Mastra',
          url: 'https://github.com/Mastra-AI/Mastra/pull/20338',
        },
      ],
    ])('lists the reviewed pull request once when the thread also subscribes to it %s', async (_case, subscription) => {
      stubThreadRoute([pullRequestCard()], [subscription]);
      renderThreadRoute();

      const panel = await findSessionPanel();
      await within(panel).findByRole('link', { name: `Open PR #${PULL_REQUEST_NUMBER}` });
      expect(linksTo(panel, PULL_REQUEST_URL)).toHaveLength(1);
    });

    it.each([
      ['an unknown status', MALFORMED_PULL_REQUEST_URL, { pullRequestNumber: 20340, status: 'draft' }],
      ['a number that is not positive', NON_POSITIVE_PULL_REQUEST_URL, { pullRequestNumber: 0 }],
    ])('drops a subscription with %s and keeps the valid ones', async (_case, url, fields) => {
      stubThreadRoute(
        [pullRequestCard()],
        [{ ...otherPullRequestSubscription, id: 'subscription-invalid', url, ...fields }, otherPullRequestSubscription],
      );
      renderThreadRoute();

      const panel = await findSessionPanel();
      await within(panel).findByRole('link', { name: `Open PR #${OTHER_PULL_REQUEST_NUMBER}` });
      expect(linksTo(panel, url)).toHaveLength(0);
    });

    it('still lists the reviewed pull request when the subscriptions request fails', async () => {
      stubThreadRoute([pullRequestCard()], []);
      server.use(http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => new HttpResponse(null, { status: 500 })));
      renderThreadRoute();

      const panel = await findSessionPanel();
      expect(await within(panel).findByRole('link', { name: `Open PR #${PULL_REQUEST_NUMBER}` })).toHaveAttribute(
        'href',
        PULL_REQUEST_URL,
      );
    });
  });

  describe('when the session works an issue card', () => {
    it("links the issue beside its title, with the thread's pull request under Links", async () => {
      stubThreadRoute([issueCard()], [pullRequestSubscription]);
      renderThreadRoute();

      const panel = await findSessionPanel();
      const card = within(panel).getByRole('region', { name: 'Card' });
      expect(within(card).getByRole('heading', { name: 'Track the pull request link' })).toBeInTheDocument();
      const issue = within(card).getByRole('link', { name: `Open Issue #${ISSUE_NUMBER}` });
      expect(issue).toHaveAttribute('href', ISSUE_URL);
      expect(issue).toHaveAttribute('target', '_blank');
      expect(issue.querySelector('[data-source="github-issue"]')).toBeInTheDocument();
      const pullRequest = await within(card).findByRole('link', { name: `Open PR #${PULL_REQUEST_NUMBER}` });
      expect(issue.compareDocumentPosition(pullRequest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // The issue is the card itself, so Links counts only what the work touched.
      expect(within(card).getByRole('heading', { name: 'Links 1' })).toBeInTheDocument();
      await expectOnlyInPanel(PULL_REQUEST_URL);
    });

    it('links each pull request the card carries, the open one first and a merged one marked', async () => {
      stubThreadRoute([issueCardWithSources([pullRequestSource(4, 'merged'), pullRequestSource(5, 'open')])], []);
      renderThreadRoute();

      const panel = await findSessionPanel();
      const open = await within(panel).findByRole('link', { name: 'Open PR #5' });
      const merged = within(panel).getByRole('link', { name: 'Open PR #4 merged' });
      expect(open).toHaveAttribute('href', 'https://github.com/mastra-ai/mastra/pull/5');
      expect(merged).toHaveTextContent('Merged');
      expect(open.compareDocumentPosition(merged) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("leaves a pull request that has its own Review card to that card's link", async () => {
      const card = issueCardWithSources([pullRequestSource(5, 'open')]);
      const reviewCard = {
        ...pullRequestCard(),
        id: 'review-card-5',
        parentWorkItemId: card.id,
        title: 'Review the fix',
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github-pr:5',
          url: 'https://github.com/mastra-ai/mastra/pull/5',
        },
        sessions: {},
        metadata: { number: 5 },
      };
      stubThreadRoute([card, reviewCard], []);
      renderThreadRoute();

      const panel = await findSessionPanel();
      const row = await within(panel).findByRole('link', { name: 'Open Review: PR #5: Review the fix' });
      // The section heading already says it is a card, so the row names only which one.
      expect(row).toHaveTextContent(/^PR #5/);
      expect(within(panel).queryByRole('link', { name: 'Open PR #5' })).not.toBeInTheDocument();
    });

    it.each([true, false])(
      'links a separate card to its live session when live=%s, or to its board otherwise',
      async live => {
        const card = issueCard();
        const relatedSession = { ...workspaceSession, id: 'related-row', sessionId: 'related-session' };
        const followUp = {
          ...issueCard(null),
          id: 'related-item',
          parentWorkItemId: card.id,
          title: 'Follow-up work',
          metadata: { number: 8 },
          sessions: { work: { ...sessionRef, sessionId: 'related-session', threadId: 'related-thread' } },
        };
        stubThreadRoute([card, followUp], []);
        server.use(
          http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () =>
            HttpResponse.json({ sessions: live ? [workspaceSession, relatedSession] : [workspaceSession] }),
          ),
        );
        renderThreadRoute();

        const panel = await findSessionPanel();
        expect(await within(panel).findByRole('link', { name: /^Open .*: Follow-up work$/ })).toHaveAttribute(
          'href',
          live
            ? `/factories/${FACTORY_ID}/workspaces/related-session/threads/related-thread`
            : `/factories/${FACTORY_ID}/work`,
        );
      },
    );

    it('links a Linear issue by its identifier', async () => {
      const url = 'https://linear.app/acme/issue/ENG-123/fix-sandbox-setup';
      stubThreadRoute(
        [
          {
            ...issueCard(),
            externalSource: { integrationId: 'linear', type: 'issue', externalId: 'linear-issue:ENG-123', url },
            metadata: { identifier: 'ENG-123' },
          },
        ],
        [],
      );
      renderThreadRoute();

      const panel = await findSessionPanel();
      const link = within(panel).getByRole('link', { name: 'Open ENG-123' });
      expect(link).toHaveAttribute('href', url);
      expect(link.querySelector('[data-source="linear-issue"]')).toBeInTheDocument();
    });

    it('lists no source link for a card without a URL', async () => {
      stubThreadRoute([issueCard(null)], []);
      renderThreadRoute();

      const panel = await findSessionPanel();
      expect(within(panel).queryByRole('heading', { name: /^Links/ })).not.toBeInTheDocument();
      expect(within(panel).queryByRole('link', { name: `Open Issue #${ISSUE_NUMBER}` })).not.toBeInTheDocument();
    });

    it('graphs the stays that brought the card to its stage and reads each out as you step through them', async () => {
      const user = userEvent.setup();
      const hour = 60 * 60_000;
      const start = Date.now() - 7 * hour;
      const stages = ['intake', 'planning', 'execute', 'planning', 'execute', 'planning', 'execute'];
      const card = {
        ...issueCard(),
        stageHistory: stages.map((stage, index) => ({
          stage,
          enteredAt: new Date(start + index * hour).toISOString(),
          by: 'user-1',
          ...(index < stages.length - 1 ? { exitedAt: new Date(start + (index + 1) * hour).toISOString() } : {}),
        })),
      };
      stubThreadRoute([card], []);
      renderThreadRoute();

      const panel = await findSessionPanel();
      // The stage bar already shows Building, where the card is now, so the moves are the six stays before it.
      expect(within(panel).getByRole('heading', { name: 'Moves 6' })).toBeInTheDocument();
      const moves = within(panel).getByRole('slider', { name: 'Moves' });
      expect(moves).toHaveAttribute('aria-valuetext', expect.stringMatching(/^Planning, 1h, entered /));

      await user.click(moves);
      await user.keyboard('{Home}');
      expect(moves).toHaveAttribute('aria-valuetext', expect.stringMatching(/^Intake, 1h, entered /));
      await user.keyboard('{ArrowRight}{ArrowRight}');
      expect(moves).toHaveAttribute('aria-valuetext', expect.stringMatching(/^Building, 1h, entered /));
    });
  });

  describe('when the session is a personal one, held by no card', () => {
    it("lists the thread's pull requests in the panel", async () => {
      stubThreadRoute([], [pullRequestSubscription]);
      renderThreadRoute(`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`);

      const panel = await findSessionPanel('Pull requests');
      expect(within(panel).queryByRole('region', { name: 'Card' })).not.toBeInTheDocument();
      expect(await within(panel).findByRole('link', { name: `Open PR #${PULL_REQUEST_NUMBER}` })).toHaveAttribute(
        'href',
        PULL_REQUEST_URL,
      );
      await expectOnlyInPanel(PULL_REQUEST_URL);
    });
  });

  describe('while the board is still loading', () => {
    it("shows the session's card with its pull request and related work", async () => {
      const card = pullRequestCard();
      const followUp = {
        ...issueCard(null),
        id: 'related-item',
        parentWorkItemId: card.id,
        title: 'Follow-up work',
        sessions: {},
      };
      stubThreadRoute([], []);
      server.use(sessionCardsWhileBoardLoads(FACTORY_ID, SESSION_ID, [card, followUp]));
      renderThreadRoute();

      const panel = await findSessionPanel();
      expect(await within(panel).findByRole('link', { name: `Open PR #${PULL_REQUEST_NUMBER}` })).toHaveAttribute(
        'href',
        PULL_REQUEST_URL,
      );
      expect(within(panel).getByRole('link', { name: /^Open .*: Follow-up work$/ })).toHaveAttribute(
        'href',
        `/factories/${FACTORY_ID}/work`,
      );
    });
  });

  describe('when the window is too narrow to dock the panel', () => {
    it('opens the panel over the conversation from the header', async () => {
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 800, 800));
      const user = userEvent.setup();
      stubThreadRoute([issueCard()], []);
      renderThreadRoute();

      const header = await findPageHeader();
      await user.click(await within(header).findByRole('button', { name: 'Session panel' }));

      const dialog = await screen.findByRole('dialog');
      expect(await within(dialog).findByRole('link', { name: `Open Issue #${ISSUE_NUMBER}` })).toHaveAttribute(
        'href',
        ISSUE_URL,
      );
    });
  });
});
