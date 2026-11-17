import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import { createQueryClient } from '../../../query-client';
import { providerFactsCard } from '../../__tests__/fixtures/providerFactsCard';
import { createAppRoutes } from '../../router';
import { DRAFT_SESSION_ID, FACTORY_ID, OTHER_DRAFT_SESSION_ID, stubDraftRoute } from './fixtures/draftRoute';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const CARD_ID = 'card-eng-42';
const linearCard = {
  ...providerFactsCard,
  id: CARD_ID,
  factoryProjectId: FACTORY_ID,
  title: 'ENG-42: Repair source facts',
  stages: ['triage'],
  sessions: {},
  externalSource: { integrationId: 'linear', type: 'issue', externalId: 'linear:ENG-42' },
  metadata: { repository: 'acme/app', authorTrusted: true },
  workItem: {
    ...providerFactsCard.workItem,
    provider: 'linear',
    key: 'ENG-42',
    title: 'ENG-42: Repair source facts',
    metadata: {},
  },
};

const PULL_REQUEST_NUMBER = 30647;
const PULL_REQUEST_URL = `https://github.com/acme/app/pull/${PULL_REQUEST_NUMBER}`;
const PULL_REQUEST_BODY = 'Stops the unhandled rejection when a stream aborts.';
const pullRequestCard = {
  ...linearCard,
  title: 'fix(core): stop the unhandled rejection',
  externalSource: {
    integrationId: 'github',
    type: 'pull-request',
    externalId: String(PULL_REQUEST_NUMBER),
    url: PULL_REQUEST_URL,
  },
  metadata: { githubPullRequestNumber: PULL_REQUEST_NUMBER, number: PULL_REQUEST_NUMBER, state: 'open' },
  workItem: null,
};

function stubCard(metadata: Record<string, string | boolean> = linearCard.metadata) {
  const runStarts: unknown[] = [];
  const sessions = {
    chat: {
      sessionId: DRAFT_SESSION_ID,
      branch: 'factory/linear-eng-42',
      threadId: DRAFT_SESSION_ID,
      startedBy: 'user-1',
    },
  };
  let bound = false;
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [{ ...linearCard, metadata, ...(bound ? { sessions } : {}) }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/${CARD_ID}/session-repository`, () =>
      HttpResponse.json({ status: 'resolved', projectRepositoryId: 'repository-draft-handoff', slug: 'acme/app' }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/runs/start`, async ({ request }) => {
      runStarts.push(await request.json());
      bound = true;
      return HttpResponse.json({
        prepared: {
          workItemId: CARD_ID,
          threadId: DRAFT_SESSION_ID,
          sessionId: DRAFT_SESSION_ID,
          kickoffStatus: 'sent',
        },
      });
    }),
  );
  return runStarts;
}

function renderAt(path: string) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  return { router, ...renderWithProviders(<RouterProvider router={router} />, createQueryClient()) };
}

function stubPageWidth(width: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, width, 800));
}

describe('a card with sessions', () => {
  it("opens the thread of the session its current phase runs in, as a chat's link to the card does", async () => {
    stubDraftRoute();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({
          workItems: [
            {
              ...linearCard,
              stages: ['execute'],
              sessions: {
                triage: { sessionId: 'session-triage', threadId: 'thread-triage' },
                work: { sessionId: 'session-work', threadId: 'thread-work' },
              },
            },
          ],
        }),
      ),
    );
    const { router } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}`);

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/factories/${FACTORY_ID}/workspaces/session-work/threads/thread-work`,
      ),
    );
  });
});

describe('a card without a session', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens on a draft titled after the card that creates nothing until the first prompt', async () => {
    const route = stubDraftRoute();
    const runStarts = stubCard();
    const { router } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}`);

    expect(await screen.findByRole('heading', { level: 2, name: linearCard.title })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'New session' })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(
      new RegExp(`^/factories/${FACTORY_ID}/cards/${CARD_ID}/new/[0-9a-f-]{36}$`),
    );
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled());
    expect(route.createBodies).toEqual([]);
    expect(runStarts).toEqual([]);
  });

  it("opens the card's draft, ready to start, when Back returns to it from an open thread", async () => {
    const route = stubDraftRoute();
    const runStarts = stubCard();
    const user = userEvent.setup();
    const { router, client } = renderAt(
      `/factories/${FACTORY_ID}/workspaces/${DRAFT_SESSION_ID}/threads/${DRAFT_SESSION_ID}`,
    );
    await screen.findByRole('textbox', { name: 'Message' });

    await router.navigate(`/factories/${FACTORY_ID}/cards/${CARD_ID}/new/${OTHER_DRAFT_SESSION_ID}`);

    expect(await screen.findByRole('heading', { level: 2, name: linearCard.title })).toBeInTheDocument();
    const message = screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.type(message, 'repair the facts');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(runStarts).toEqual([expect.objectContaining({ sessionId: DRAFT_SESSION_ID })]));
    await waitFor(() => expect(route.posted).toEqual(['repair the facts']));

    route.finishWorkspace();
    await waitForMutationsIdle(client);
  });

  it("shows the card's pull request and description in the session panel before any session exists", async () => {
    stubPageWidth(1200);
    const route = stubDraftRoute();
    stubCard();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({ workItems: [pullRequestCard] }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/projects/:repository/prs/:number`, ({ params }) =>
        HttpResponse.json({ number: Number(params.number), description: PULL_REQUEST_BODY }),
      ),
    );
    renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}/new/${DRAFT_SESSION_ID}`);

    const panel = await screen.findByRole('complementary', { name: 'Session panel' });
    const card = await within(panel).findByRole('region', { name: 'Card' });
    expect(await within(card).findByRole('link', { name: `Open PR #${PULL_REQUEST_NUMBER}` })).toHaveAttribute(
      'href',
      PULL_REQUEST_URL,
    );
    expect(await within(card).findByText(PULL_REQUEST_BODY)).toBeInTheDocument();
    expect(within(panel).queryByRole('region', { name: 'Workspace' })).not.toBeInTheDocument();
    expect(route.createBodies).toEqual([]);
  });

  it("offers the card's next step on the draft and moves the card into it", async () => {
    stubDraftRoute();
    const runStarts = stubCard();
    const transitions: unknown[] = [];
    server.use(
      http.post(
        `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/:itemId/transition`,
        async ({ params, request }) => {
          transitions.push(await request.json());
          return HttpResponse.json({
            result: {
              status: 'accepted',
              transitionId: 'transition-1',
              itemId: String(params.itemId),
              revision: 9,
              stage: 'triage',
              decisions: [],
            },
          });
        },
      ),
    );
    const user = userEvent.setup();
    const { client } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}/new/${DRAFT_SESSION_ID}`);

    const suggested = await screen.findByRole('group', { name: 'Suggested actions' });
    await user.click(within(suggested).getByRole('button', { name: 'Investigate' }));

    await waitFor(() => expect(transitions).toEqual([expect.objectContaining({ stage: 'triage' })]));
    expect(runStarts).toEqual([]);
    await waitForMutationsIdle(client);
  });

  it("keeps the conversation and the composer when the card's next step opens its session", async () => {
    const route = stubDraftRoute();
    stubCard();
    const threadPath = `/factories/${FACTORY_ID}/workspaces/${DRAFT_SESSION_ID}/threads/${DRAFT_SESSION_ID}`;
    const triage = { sessionId: DRAFT_SESSION_ID, threadId: DRAFT_SESSION_ID, branch: 'factory/linear-eng-42' };
    let moved = false;
    let answerHistory = () => {};
    const historyAnswered = new Promise<void>(resolve => {
      answerHistory = resolve;
    });
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({ workItems: [moved ? { ...linearCard, sessions: { triage } } : linearCard] }),
      ),
      http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/:itemId/transition`, ({ params }) => {
        moved = true;
        return HttpResponse.json({
          result: {
            status: 'accepted',
            transitionId: 'transition-1',
            itemId: String(params.itemId),
            revision: 9,
            stage: 'triage',
            decisions: [],
          },
        });
      }),
      http.get(
        `${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/threads/:threadId/messages`,
        async () => {
          await historyAnswered;
          return HttpResponse.json({
            messages: [
              {
                id: 'investigation',
                role: 'assistant',
                createdAt: '2026-08-07T09:00:01.000Z',
                content: { format: 2, parts: [{ type: 'text', text: 'Looking into ENG-42' }] },
              },
            ],
          });
        },
      ),
      http.get(
        `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/feed-events`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );
    const user = userEvent.setup();
    const { router, client } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}/new/${OTHER_DRAFT_SESSION_ID}`);
    const suggested = await screen.findByRole('group', { name: 'Suggested actions' });
    const composer = screen.getByRole('textbox', { name: 'Message' });
    const conversation = screen.getByRole('region', { name: 'Conversation' });

    await user.click(within(suggested).getByRole('button', { name: 'Investigate' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(threadPath));
    expect(screen.getByRole('textbox', { name: 'Message' })).toBe(composer);
    expect(screen.getByRole('region', { name: 'Conversation' })).toBe(conversation);
    expect(within(conversation).queryByText('No session yet. Your first message starts one.')).not.toBeInTheDocument();
    answerHistory();
    expect(await within(conversation).findByText('Looking into ENG-42')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBe(composer);
    route.finishWorkspace();
    await waitForMutationsIdle(client);
  });

  it("starts the card's session on its branch with the first prompt, then opens the thread of the session the server gave", async () => {
    const route = stubDraftRoute();
    const runStarts = stubCard();
    const user = userEvent.setup();
    const { router, client } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}`);

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await user.type(message, 'repair the facts');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(route.createBodies).toEqual([{ branch: 'factory/linear-eng-42' }]));
    await waitFor(() =>
      expect(runStarts).toEqual([
        expect.objectContaining({
          sessionId: DRAFT_SESSION_ID,
          workItem: expect.objectContaining({ id: CARD_ID, role: 'chat' }),
        }),
      ]),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/factories/${FACTORY_ID}/workspaces/${DRAFT_SESSION_ID}/threads/${DRAFT_SESSION_ID}`,
      ),
    );
    await waitFor(() => expect(route.posted).toEqual(['repair the facts']));

    route.finishWorkspace();
    await waitForMutationsIdle(client);
  });

  it('keeps the first prompt, the model and the focus in the same conversation while the session starts and its thread opens', async () => {
    let releaseCreate = () => {};
    const createGate = new Promise<void>(resolve => {
      releaseCreate = resolve;
    });
    const route = stubDraftRoute({ createGate });
    stubCard();
    const user = userEvent.setup();
    const { router, client } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}`);

    const composer = await screen.findByRole('textbox', { name: 'Message' });
    await user.type(composer, 'repair the facts');
    await user.keyboard('{Enter}');

    const conversation = screen.getByRole('region', { name: 'Conversation' });
    expect(await within(conversation).findByText('repair the facts')).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(new RegExp(`^/factories/${FACTORY_ID}/cards/${CARD_ID}/new/`));

    releaseCreate();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/factories/${FACTORY_ID}/workspaces/${DRAFT_SESSION_ID}/threads/${DRAFT_SESSION_ID}`,
      ),
    );
    await waitFor(() => expect(route.posted).toEqual(['repair the facts']));
    expect(screen.getByRole('region', { name: 'Conversation' })).toBe(conversation);
    expect(within(conversation).getAllByText('repair the facts')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Message' })).toBe(composer);
    expect(composer).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Session model' })).toHaveAttribute('title', 'openai/gpt-4o-mini');

    route.finishWorkspace();
    await waitForMutationsIdle(client);
  });

  it("keeps the card's stage and panel in place when the first prompt opens the thread", async () => {
    stubPageWidth(1200);
    const route = stubDraftRoute();
    stubCard();
    const user = userEvent.setup();
    const { router, client } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}`);
    const threadPath = `/factories/${FACTORY_ID}/workspaces/${DRAFT_SESSION_ID}/threads/${DRAFT_SESSION_ID}`;
    const cardInSession = {
      ...linearCard,
      sessions: {
        chat: {
          sessionId: DRAFT_SESSION_ID,
          branch: 'factory/linear-eng-42',
          threadId: DRAFT_SESSION_ID,
          startedBy: 'user-1',
        },
      },
    };
    let answerThreadReads = () => {};
    const threadReadsAnswered = new Promise<void>(resolve => {
      answerThreadReads = resolve;
    });
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, async ({ request }) => {
        if (!new URL(request.url).searchParams.has('sessionId')) return HttpResponse.json({ workItems: [linearCard] });
        if (router.state.location.pathname === threadPath) await threadReadsAnswered;
        return HttpResponse.json({ workItems: [cardInSession] });
      }),
      http.get(`${TEST_BASE_URL}/web/github/subscriptions`, async () => {
        if (router.state.location.pathname === threadPath) await threadReadsAnswered;
        return HttpResponse.json({ subscriptions: [] });
      }),
      http.get(`${TEST_BASE_URL}/web/linear/issues/:identifier`, () => HttpResponse.json({ description: null })),
      http.get(`${TEST_BASE_URL}/web/workspace/changes`, ({ request }) =>
        HttpResponse.json({
          workspacePath: new URL(request.url).searchParams.get('workspacePath'),
          available: true,
          additions: 0,
          deletions: 0,
          changes: [],
        }),
      ),
      http.get(
        `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/feed-events`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    expect(await screen.findByRole('group', { name: 'Card stage' })).toBeInTheDocument();
    await user.type(await screen.findByRole('textbox', { name: 'Message' }), 'repair the facts');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(route.posted).toEqual(['repair the facts']));
    expect(router.state.location.pathname).toBe(threadPath);
    const panel = screen.getByRole('complementary', { name: 'Session panel' });
    expect(within(panel).getByRole('region', { name: 'Workspace' })).toBeInTheDocument();
    expect(within(panel).getByRole('region', { name: 'Card' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Card stage' })).toBeInTheDocument();

    answerThreadReads();
    route.finishWorkspace();
    await waitForMutationsIdle(client);
  });

  it('keeps the prompt on the draft when the start fails, and the card reopened starts in the session it left', async () => {
    const route = stubDraftRoute();
    const runStarts = stubCard();
    server.use(
      http.post(
        `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/runs/start`,
        async ({ request }) => {
          runStarts.push(await request.json());
          return HttpResponse.json({ error: 'Run start failed' }, { status: 500 });
        },
        { once: true },
      ),
    );
    const user = userEvent.setup();
    const { router, client } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}`);

    await user.type(await screen.findByRole('textbox', { name: 'Message' }), 'repair the facts');
    await user.keyboard('{Enter}');

    expect(await screen.findByText(/Could not create the session/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('repair the facts');
    expect(
      within(screen.getByRole('region', { name: 'Conversation' })).queryByText('repair the facts'),
    ).not.toBeInTheDocument();
    const failedDraftPath = router.state.location.pathname;
    expect(failedDraftPath).toMatch(new RegExp(`^/factories/${FACTORY_ID}/cards/${CARD_ID}/new/`));

    await router.navigate(`/factories/${FACTORY_ID}/cards/${CARD_ID}`);
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/new\//));
    expect(router.state.location.pathname).not.toBe(failedDraftPath);
    const message = await screen.findByRole('textbox', { name: 'Message' });
    await user.clear(message);
    await user.type(message, 'repair the facts');
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/factories/${FACTORY_ID}/workspaces/${DRAFT_SESSION_ID}/threads/${DRAFT_SESSION_ID}`,
      ),
    );
    expect(route.createBodies).toEqual([{ branch: 'factory/linear-eng-42' }, { branch: 'factory/linear-eng-42' }]);
    expect(runStarts).toEqual([
      expect.objectContaining({ sessionId: DRAFT_SESSION_ID }),
      expect.objectContaining({ sessionId: DRAFT_SESSION_ID }),
    ]);
    await waitFor(() => expect(route.posted).toEqual(['repair the facts']));

    route.finishWorkspace();
    await waitForMutationsIdle(client);
  });

  it('keeps the prompt on the draft when the session cannot be read after the start bound the card', async () => {
    stubDraftRoute();
    const runStarts = stubCard();
    server.use(
      http.get(
        `${TEST_BASE_URL}/web/user-sessions/${DRAFT_SESSION_ID}`,
        () => HttpResponse.json({ error: 'Session read failed' }, { status: 500 }),
        { once: true },
      ),
    );
    const user = userEvent.setup();
    const { router, client } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}`);

    await user.type(await screen.findByRole('textbox', { name: 'Message' }), 'repair the facts');
    await user.keyboard('{Enter}');

    expect(await screen.findByText(/Could not create the session/)).toBeInTheDocument();
    expect(runStarts).toEqual([expect.objectContaining({ sessionId: DRAFT_SESSION_ID })]);
    await waitForMutationsIdle(client);
    expect(router.state.location.pathname).toMatch(new RegExp(`^/factories/${FACTORY_ID}/cards/${CARD_ID}/new/`));
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('repair the facts');
  });

  it('starts the session in the repository the server files the card under, leaving the card untouched', async () => {
    const route = stubDraftRoute();
    const runStarts = stubCard();
    const otherCreates: unknown[] = [];
    const patches: unknown[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/${CARD_ID}/session-repository`, () =>
        HttpResponse.json({ status: 'resolved', projectRepositoryId: 'repository-other', slug: 'acme/other' }),
      ),
      http.post(`${TEST_BASE_URL}/web/source-control/projects/repository-other/sessions`, async ({ request }) => {
        otherCreates.push(await request.json());
        return HttpResponse.json({
          session: {
            id: 'row-other',
            sessionId: DRAFT_SESSION_ID,
            projectRepositoryId: 'repository-other',
            orgId: 'org-1',
            userId: 'user-1',
            visibility: 'private',
            title: null,
            branch: 'factory/linear-eng-42',
            baseBranch: 'main',
            sandboxId: null,
            sandboxWorkdir: null,
            materializedAt: null,
            createdAt: '2026-08-07T09:00:00.000Z',
            updatedAt: '2026-08-07T09:00:00.000Z',
          },
        });
      }),
      http.patch(`${TEST_BASE_URL}/web/factory/work-items/${CARD_ID}`, async ({ request }) => {
        patches.push(await request.json());
        return HttpResponse.json({ workItem: linearCard });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}/new/${DRAFT_SESSION_ID}`);

    await user.type(await screen.findByRole('textbox', { name: 'Message' }), 'repair the facts');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(otherCreates).toEqual([{ branch: 'factory/linear-eng-42' }]));
    await waitFor(() => expect(runStarts).toHaveLength(1));
    expect(runStarts[0]).toHaveProperty('workItem.input.metadata', {});
    expect(patches).toEqual([]);
    expect(route.createBodies).toEqual([]);

    route.finishWorkspace();
    await waitForMutationsIdle(client);
  });

  it("says why nothing can start when the card's repository is not linked, and leads to repository settings", async () => {
    const route = stubDraftRoute();
    const runStarts = stubCard();
    const hint = 'Repository acme/elsewhere is not linked to this Factory.';
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/${CARD_ID}/session-repository`, () =>
        HttpResponse.json({ status: 'unlinked', hint }),
      ),
    );
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}/new/${DRAFT_SESSION_ID}`);

    expect(await screen.findByText(hint)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'repair the facts');
    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(route.createBodies).toEqual([]);
    expect(runStarts).toEqual([]);
    expect(screen.getByRole('link', { name: 'Open repository settings' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/settings/repositories`,
    );
  });

  it("says why nothing can start when the card's repository cannot be looked up, and starts once a retry finds it", async () => {
    const route = stubDraftRoute();
    const runStarts = stubCard();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/${CARD_ID}/session-repository`, () =>
        HttpResponse.json({ error: 'Intake config unavailable' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}/new/${DRAFT_SESSION_ID}`);

    expect(await screen.findByText(/Could not find this card's repository/)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'repair the facts');
    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(route.createBodies).toEqual([]);
    expect(runStarts).toEqual([]);

    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/${CARD_ID}/session-repository`, () =>
        HttpResponse.json({ status: 'resolved', projectRepositoryId: 'repository-draft-handoff', slug: 'acme/app' }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.queryByText(/Could not find this card's repository/)).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled();
  });

  it("stops the start when a later lookup of the card's repository fails", async () => {
    const route = stubDraftRoute();
    const runStarts = stubCard();
    const user = userEvent.setup();
    const { client } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}/new/${DRAFT_SESSION_ID}`);

    await user.type(await screen.findByRole('textbox', { name: 'Message' }), 'repair the facts');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled());
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/${CARD_ID}/session-repository`, () =>
        HttpResponse.json({ error: 'Intake config unavailable' }, { status: 500 }),
      ),
    );
    await client.invalidateQueries({ queryKey: ['factory', 'work-item-session-repository'] });

    expect(await screen.findByText(/Could not find this card's repository/)).toBeInTheDocument();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(route.createBodies).toEqual([]);
    expect(runStarts).toEqual([]);
  });

  it("starts once the card's repository is linked and the card is opened again", async () => {
    stubDraftRoute();
    stubCard();
    const hint = 'Repository acme/app is not linked to this Factory.';
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/${CARD_ID}/session-repository`, () =>
        HttpResponse.json({ status: 'unlinked', hint }),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}/new/${DRAFT_SESSION_ID}`);
    expect(await screen.findByText(hint)).toBeInTheDocument();

    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/${CARD_ID}/session-repository`, () =>
        HttpResponse.json({ status: 'resolved', projectRepositoryId: 'repository-draft-handoff', slug: 'acme/app' }),
      ),
    );
    await router.navigate(`/factories/${FACTORY_ID}/cards/${CARD_ID}`);
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/new\//));
    await user.type(await screen.findByRole('textbox', { name: 'Message' }), 'repair the facts');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled());
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
  });

  it("asks again which repository the card's session starts in when the card changes", async () => {
    stubDraftRoute();
    stubCard();
    const user = userEvent.setup();
    const { client } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}/new/${DRAFT_SESSION_ID}`);
    await user.type(await screen.findByRole('textbox', { name: 'Message' }), 'repair the facts');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled());

    const hint = 'Repository acme/elsewhere is not linked to this Factory.';
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({
          workItems: [
            { ...linearCard, metadata: { repository: 'acme/elsewhere' }, updatedAt: '2030-01-01T00:00:00.000Z' },
          ],
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/${CARD_ID}/session-repository`, () =>
        HttpResponse.json({ status: 'unlinked', hint }),
      ),
    );
    await client.invalidateQueries({ queryKey: ['factory', 'work-items'] });

    expect(await screen.findByText(hint)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it("keeps the card's title and next steps on the draft when the composer posts a notice", async () => {
    stubDraftRoute();
    stubCard();
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}/new/${DRAFT_SESSION_ID}`);

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.type(message, '/help');
    await user.keyboard('{Enter}');

    expect(await screen.findByText(/Available commands:/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: linearCard.title })).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Suggested actions' })).getByRole('button', { name: 'Investigate' }),
    ).toBeInTheDocument();
  });
});
