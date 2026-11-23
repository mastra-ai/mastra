import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import {
  CARD_ID,
  CARD_IN_TRIAGE,
  deferred,
  linearCard,
  renderAt,
  stubCard,
  stubPageWidth,
  stubThreadReads,
  stubTransitions,
  THREAD_PATH,
} from './fixtures/cardDraft';
import { DRAFT_SESSION_ID, FACTORY_ID, OTHER_DRAFT_SESSION_ID, stubDraftRoute } from './fixtures/draftRoute';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

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

  it("opens the card's draft, ready to start, when it is opened from an open thread", async () => {
    const route = stubDraftRoute();
    const runStarts = stubCard();
    const user = userEvent.setup();
    const { router, client } = renderAt(THREAD_PATH);
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
    const transitions = stubTransitions();
    const user = userEvent.setup();
    const { client } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}/new/${DRAFT_SESSION_ID}`);

    const suggested = await screen.findByRole('group', { name: 'Suggested actions' });
    await user.click(within(suggested).getByRole('button', { name: 'Investigate' }));

    await waitFor(() => expect(transitions).toEqual([expect.objectContaining({ stage: 'triage' })]));
    expect(runStarts).toEqual([]);
    await waitForMutationsIdle(client);
  });

  it("keeps the conversation, what was typed, the card's stage and the panel when the card's next step opens its session", async () => {
    stubPageWidth(1200);
    const route = stubDraftRoute();
    stubCard();
    const transitions = stubTransitions();
    const threadReads = deferred();
    const history = deferred();
    const onThread = () => router.state.location.pathname === THREAD_PATH;
    stubThreadReads(() => (onThread() ? threadReads.promise : undefined));
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, async ({ request }) => {
        if (new URL(request.url).searchParams.has('sessionId') && onThread()) await threadReads.promise;
        return HttpResponse.json({ workItems: [transitions.length > 0 ? CARD_IN_TRIAGE : linearCard] });
      }),
      http.get(
        `${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/threads/:threadId/messages`,
        async () => {
          await history.promise;
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
    );
    const user = userEvent.setup();
    const { router, client } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}/new/${OTHER_DRAFT_SESSION_ID}`);
    const suggested = await screen.findByRole('group', { name: 'Suggested actions' });
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'half a thought');
    const conversation = screen.getByRole('region', { name: 'Conversation' });
    const stage = screen.getByRole('group', { name: 'Card stage' });
    const panel = screen.getByRole('complementary', { name: 'Session panel' });

    await user.click(within(suggested).getByRole('button', { name: 'Investigate' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(THREAD_PATH);
      expect(
        within(conversation).queryByText('No session yet. Your first message starts one.'),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('half a thought');
    expect(screen.getByRole('group', { name: 'Card stage' })).toBe(stage);
    expect(screen.getByRole('complementary', { name: 'Session panel' })).toBe(panel);
    expect(within(panel).getByRole('region', { name: 'Card' })).toBeInTheDocument();
    threadReads.resolve();
    history.resolve();
    expect(await within(conversation).findByText('Looking into ENG-42')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('half a thought');
    route.finishWorkspace();
    await waitForMutationsIdle(client);
  });

  it("starts nothing more from the draft while the card's next step opens its session, keeping what was typed for it", async () => {
    const route = stubDraftRoute();
    const runStarts = stubCard();
    const transitions = stubTransitions();
    const sessionCard = deferred();
    stubThreadReads();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, async ({ request }) => {
        if (new URL(request.url).searchParams.has('sessionId')) await sessionCard.promise;
        return HttpResponse.json({ workItems: [transitions.length > 0 ? CARD_IN_TRIAGE : linearCard] });
      }),
    );
    const user = userEvent.setup();
    const { router, client } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}/new/${OTHER_DRAFT_SESSION_ID}`);
    const suggested = await screen.findByRole('group', { name: 'Suggested actions' });
    const composer = screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(composer).toBeEnabled());
    await user.type(composer, 'one more thing');
    const conversation = screen.getByRole('region', { name: 'Conversation' });
    expect(conversation).toHaveAttribute('aria-busy', 'false');

    await user.click(within(suggested).getByRole('button', { name: 'Investigate' }));
    await waitFor(() => expect(conversation).toHaveAttribute('aria-busy', 'true'));
    await user.type(composer, '{Enter}');

    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    sessionCard.resolve();
    await waitFor(() => expect(router.state.location.pathname).toBe(THREAD_PATH));
    expect(route.createBodies).toEqual([]);
    expect(runStarts).toEqual([]);
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('one more thing');
    route.finishWorkspace();
    await waitForMutationsIdle(client);
  });

  it("opens the session the card's next step starts after the first prompt failed to start one", async () => {
    const route = stubDraftRoute({ failedCreates: 1 });
    const runStarts = stubCard();
    const transitions = stubTransitions();
    stubThreadReads();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({ workItems: [transitions.length > 0 ? CARD_IN_TRIAGE : linearCard] }),
      ),
    );
    const user = userEvent.setup();
    const { router, client } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}/new/${OTHER_DRAFT_SESSION_ID}`);
    await screen.findByRole('group', { name: 'Suggested actions' });
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'repair the facts');
    await user.keyboard('{Enter}');
    expect(await screen.findByText(/Could not create the session/, undefined, { timeout: 5000 })).toBeInTheDocument();

    const suggested = screen.getByRole('group', { name: 'Suggested actions' });
    await user.click(within(suggested).getByRole('button', { name: 'Investigate' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(THREAD_PATH));
    expect(runStarts).toEqual([]);
    route.finishWorkspace();
    await waitForMutationsIdle(client);
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
