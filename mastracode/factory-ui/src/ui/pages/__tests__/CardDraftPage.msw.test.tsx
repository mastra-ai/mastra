import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import { createQueryClient } from '../../../query-client';
import { providerFactsCard } from '../../__tests__/fixtures/providerFactsCard';
import { createAppRoutes } from '../../router';
import { DRAFT_SESSION_ID, FACTORY_ID, stubDraftRoute } from './fixtures/draftRoute';

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

function stubCard(metadata: Record<string, string | boolean> = linearCard.metadata) {
  const runStarts: unknown[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [{ ...linearCard, metadata }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/${CARD_ID}/session-repository`, () =>
      HttpResponse.json({ status: 'resolved', projectRepositoryId: 'repository-draft-handoff', slug: 'acme/app' }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/runs/start`, async ({ request }) => {
      runStarts.push(await request.json());
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

describe('a card without a session', () => {
  it('opens on a draft titled after the card that creates nothing until the first prompt', async () => {
    const route = stubDraftRoute();
    const runStarts = stubCard();
    const { router } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}`);

    expect(await screen.findByRole('heading', { level: 2, name: linearCard.title })).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(
      new RegExp(`^/factories/${FACTORY_ID}/cards/${CARD_ID}/new/[0-9a-f-]{36}$`),
    );
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled());
    expect(route.createBodies).toEqual([]);
    expect(runStarts).toEqual([]);
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
    const hint = 'Source-control repository acme/elsewhere is not linked to this Factory.';
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
