import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import {
  CARD_ID,
  CARD_IN_CHAT,
  deferred,
  linearCard,
  renderAt,
  stubCard,
  stubPageWidth,
  stubThreadReads,
  THREAD_PATH,
} from './fixtures/cardDraft';
import { DRAFT_SESSION_ID, FACTORY_ID, stubDraftRoute } from './fixtures/draftRoute';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

describe("a card draft's first prompt", () => {
  afterEach(() => vi.restoreAllMocks());

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
    await waitFor(() => expect(router.state.location.pathname).toBe(THREAD_PATH));
    await waitFor(() => expect(route.posted).toEqual(['repair the facts']));

    route.finishWorkspace();
    await waitForMutationsIdle(client);
  });

  it('keeps the first prompt, the picked model and the focus in the same conversation while the session starts and its thread opens', async () => {
    const created = deferred();
    const route = stubDraftRoute({ createGate: created.promise });
    stubCard();
    const user = userEvent.setup();
    const { router, client } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}`);

    const modelPicker = await screen.findByLabelText('Session model');
    await waitFor(() => expect(modelPicker).toHaveAttribute('title', expect.stringContaining('gpt-4o-mini')));
    await user.click(modelPicker);
    await user.click(await screen.findByRole('option', { name: /GPT-5\.4 Mini/ }));
    const composer = screen.getByRole('textbox', { name: 'Message' });
    await user.type(composer, 'repair the facts');
    await user.keyboard('{Enter}');

    const conversation = screen.getByRole('region', { name: 'Conversation' });
    expect(await within(conversation).findByText('repair the facts')).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(new RegExp(`^/factories/${FACTORY_ID}/cards/${CARD_ID}/new/`));

    created.resolve();
    await waitFor(() => expect(router.state.location.pathname).toBe(THREAD_PATH));
    await waitFor(() => expect(route.posted).toEqual(['repair the facts']));
    expect(route.bindingsBeforePrompt).toEqual(['model:openai/gpt-5.4-mini']);
    expect(within(conversation).getAllByText('repair the facts')).toHaveLength(1);
    expect(composer).toHaveFocus();

    route.finishWorkspace();
    await waitForMutationsIdle(client);
  });

  it("keeps the card's stage and panel in place when the first prompt opens the thread", async () => {
    stubPageWidth(1200);
    const route = stubDraftRoute();
    stubCard();
    const user = userEvent.setup();
    const { router, client } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}`);
    const threadReads = deferred();
    const onThread = () => router.state.location.pathname === THREAD_PATH;
    stubThreadReads(() => (onThread() ? threadReads.promise : undefined));
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, async ({ request }) => {
        if (!new URL(request.url).searchParams.has('sessionId')) return HttpResponse.json({ workItems: [linearCard] });
        if (onThread()) await threadReads.promise;
        return HttpResponse.json({ workItems: [CARD_IN_CHAT] });
      }),
    );

    const stage = await screen.findByRole('group', { name: 'Card stage' });
    const panel = screen.getByRole('complementary', { name: 'Session panel' });
    await user.type(await screen.findByRole('textbox', { name: 'Message' }), 'repair the facts');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(route.posted).toEqual(['repair the facts']));
    expect(router.state.location.pathname).toBe(THREAD_PATH);
    expect(screen.getByRole('complementary', { name: 'Session panel' })).toBe(panel);
    expect(within(panel).getByRole('region', { name: 'Workspace' })).toBeInTheDocument();
    expect(within(panel).getByRole('region', { name: 'Card' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Card stage' })).toBe(stage);

    threadReads.resolve();
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

    await waitFor(() => expect(router.state.location.pathname).toBe(THREAD_PATH));
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
});
