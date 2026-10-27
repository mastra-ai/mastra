import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import { queryKeys } from '../../../api/keys';
import { workItem } from '../../__tests__/workBoardStubs';
import { createAppRoutes } from '../../router';
import { DRAFT_SESSION_ID, FACTORY_ID, stubDraftRoute } from './fixtures/draftRoute';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

function renderDraft() {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/user/new/${DRAFT_SESSION_ID}`],
  });
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

function card(id: string, stages: string[], board = 'work') {
  return { ...workItem(id, id, '2026-08-01T00:00:00.000Z', '2026-08-02T00:00:00.000Z'), stages, board };
}

function runStarted(id: string, occurredAt: Date) {
  return {
    id,
    actorId: 'agent:thread-1',
    actorType: 'agent' as const,
    action: 'factory.run.started',
    targets: [],
    metadata: {},
    occurredAt: occurredAt.toISOString(),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('the new session page', () => {
  it('asks the signed-in person, by first name, what to ship', async () => {
    stubDraftRoute();
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({
          authenticated: true,
          authEnabled: true,
          user: { userId: 'user-1', name: ' Dustin Moskovitz ' },
        }),
      ),
    );
    renderDraft();

    expect(await screen.findByRole('heading', { level: 1, name: 'What should we ship, Dustin?' })).toBeInTheDocument();
  });

  it('suggests triaging the cards waiting in Intake, previews a prompt that names none of them while hovered, gives my draft back after, and sends it on click', async () => {
    const route = stubDraftRoute({
      workItems: [card('Login fails on Safari', ['intake']), card('Add dark mode', ['intake'])],
    });
    const user = userEvent.setup();
    const { router, client } = renderDraft();

    const message = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.type(message, 'my own idea');

    const starters = await screen.findByRole('list', { name: 'Start from the board' });
    const starter = within(starters).getByRole('button', { name: 'Triage the 2 newest' });
    expect(starter).toHaveAccessibleDescription('Untriaged in Intake 2');
    await user.hover(starter);
    const previewed = message.value;
    expect(previewed).toContain('Triage');
    expect(previewed).not.toContain('Login fails on Safari');
    expect(previewed).not.toContain('Add dark mode');

    await user.unhover(starter);
    expect(message).toHaveValue('my own idea');

    await user.click(starter);

    await waitFor(() =>
      expect(route.createBodies).toEqual([{ sessionId: DRAFT_SESSION_ID, title: previewed, visibility: 'private' }]),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/user/threads/${DRAFT_SESSION_ID}`),
    );
    await waitFor(() => expect(route.posted).toEqual([previewed]));

    route.finishWorkspace();
    await waitForMutationsIdle(client);
  });

  it('offers no card when nothing on the board waits on anyone', async () => {
    stubDraftRoute({ workItems: [card('building', ['execute']), card('done', ['done'])] });
    renderDraft();

    expect(await screen.findByRole('region', { name: 'This week' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Start from the board' })).not.toBeInTheDocument();
  });

  it('gives the composer back empty when the prompts vanish under the pointer and later return', async () => {
    stubDraftRoute({ workItems: [card('Login fails on Safari', ['intake'])] });
    const user = userEvent.setup();
    const { client } = renderDraft();
    const answerProviders = (source: string) =>
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({ providers: [{ provider: 'openai', source }] }),
        ),
      );

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.hover(await screen.findByRole('button', { name: 'Triage it' }));

    answerProviders('none');
    await client.invalidateQueries({ queryKey: queryKeys.providers() });
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument());

    answerProviders('env');
    await client.invalidateQueries({ queryKey: queryKeys.providers() });

    const returned = await screen.findByRole('textbox', { name: 'Message' });
    expect(returned).toHaveValue('');
    expect(returned).not.toHaveAttribute('readonly');
  });

  it('keeps previewing the hovered card when a refresh takes another card away', async () => {
    const intakeCard = card('Login fails on Safari', ['intake']);
    stubDraftRoute({ workItems: [intakeCard, { ...card('Crash on save', ['triage']), triageType: 'bug' }] });
    const user = userEvent.setup();
    const { client } = renderDraft();

    const message = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.hover(await screen.findByRole('button', { name: 'Triage it' }));
    const previewed = message.value;
    expect(previewed).toContain('Triage');

    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({ workItems: [intakeCard] }),
      ),
    );
    await client.invalidateQueries({ queryKey: queryKeys.workItems(FACTORY_ID) });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Plan a fix' })).not.toBeInTheDocument());

    expect(message).toHaveValue(previewed);
  });

  it('totals what came in, what agents started and what shipped this week, offers a recap only when something shipped, and narrows to today without fetching again', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 27, 12));
    const daysAgo = (days: number) => new Date(2026, 9, 27 - days, 11);
    stubDraftRoute({
      workItems: [
        { ...card('arrived-today', ['intake']), createdAt: daysAgo(0).toISOString() },
        { ...card('arrived-this-week', ['intake']), createdAt: daysAgo(3).toISOString() },
        { ...card('arrived-last-month', ['intake']), createdAt: daysAgo(40).toISOString() },
        {
          ...card('shipped', ['done']),
          stageHistory: [{ stage: 'done', enteredAt: daysAgo(2).toISOString(), by: 'user-1' }],
        },
      ],
    });
    let runRequests = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/audit`, () => {
        runRequests += 1;
        return HttpResponse.json({
          events: [runStarted('today', daysAgo(0)), runStarted('this-week', daysAgo(5))],
          actors: {},
        });
      }),
    );
    const user = userEvent.setup();
    renderDraft();
    const totals = (region: HTMLElement) => within(region).getByRole('button', { name: /shipped/ });

    const week = await screen.findByRole('region', { name: 'This week' });
    await waitFor(() => expect(totals(week)).toHaveAccessibleName('2 came in, 2 agent runs, 1 shipped'));
    expect(within(week).getByRole('button', { name: 'Recap the week' })).toBeInTheDocument();
    const weekRequests = runRequests;

    await user.click(totals(week));
    await user.click(within(week).getByRole('button', { name: 'This week' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Today' }));

    const today = await screen.findByRole('region', { name: 'Today' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await waitFor(() => expect(totals(today)).toHaveAccessibleName('1 came in, 1 agent run, 0 shipped'));
    expect(within(today).queryByRole('button', { name: /^Recap/ })).not.toBeInTheDocument();
    expect(runRequests).toBe(weekRequests);
  });

  it('says nothing happened instead of drawing an empty chart when the period is quiet', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 27, 12));
    stubDraftRoute({
      workItems: [{ ...card('arrived-last-month', ['intake']), createdAt: new Date(2026, 8, 1).toISOString() }],
    });
    const user = userEvent.setup();
    renderDraft();

    const week = await screen.findByRole('region', { name: 'This week' });
    const totals = within(week).getByRole('button', { name: /shipped/ });
    await waitFor(() => expect(totals).toHaveAccessibleName('0 came in, 0 agent runs, 0 shipped'));
    await user.click(totals);

    expect(within(week).getByText('Nothing came in, ran or shipped this week.')).toBeInTheDocument();
    expect(within(week).queryByRole('img')).not.toBeInTheDocument();
  });
});
