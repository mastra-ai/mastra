import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import { queryKeys } from '../../../api/keys';
import { createQueryClient } from '../../../query-client';
import { createAppRoutes } from '../../router';
import { DRAFT_SESSION_ID, FACTORY_ID, stubDraftRoute, stubStarters } from './fixtures/draftRoute';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

/**
 * The routed draft page under the app's own client: how long a read stays fresh decides whether a
 * hook mounting later asks again.
 */
function renderDraft() {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/user/new/${DRAFT_SESSION_ID}`],
  });
  return { router, ...renderWithProviders(<RouterProvider router={router} />, createQueryClient()) };
}

const WORK_ITEMS_URL = `/web/factory/projects/${FACTORY_ID}/work-items`;
/** A card created long before any period the activity band shows. */
const OLD_CARD = { createdAt: '2026-08-01T00:00:00.000Z' };

/** Every read of the Factory's cards the page sends, as path and query. */
function recordCardReads() {
  const reads: string[] = [];
  const listener = ({ request }: { request: Request }) => {
    const { pathname, search } = new URL(request.url);
    if (request.method === 'GET' && pathname.startsWith(WORK_ITEMS_URL)) reads.push(`${pathname}${search}`);
  };
  server.events.on('request:start', listener);
  onTestFinished(() => server.events.removeListener('request:start', listener));
  return reads;
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

  it('suggests triaging the cards waiting in Intake, previews the prompt while hovered, gives my draft back after, and sends it on click', async () => {
    const route = stubDraftRoute({ starters: { untriaged: 2 } });
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

  it('sends the prompt on screen, not the draft behind it, when Enter is pressed while a card is hovered', async () => {
    const route = stubDraftRoute({ starters: { untriaged: 1 } });
    const user = userEvent.setup();
    const { client } = renderDraft();

    const message = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.type(message, 'my own idea');
    await user.hover(await screen.findByRole('button', { name: 'Triage it' }));
    const shown = message.value;
    expect(message).toHaveFocus();

    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(route.createBodies).toEqual([{ sessionId: DRAFT_SESSION_ID, title: shown, visibility: 'private' }]),
    );
    await waitFor(() => expect(route.posted).toEqual([shown]));
    route.finishWorkspace();
    await waitForMutationsIdle(client);
  });

  it('offers no card when nothing on the board waits on anyone', async () => {
    stubDraftRoute({ cards: [OLD_CARD, OLD_CARD] });
    renderDraft();

    expect(await screen.findByRole('region', { name: 'This week' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Start from the board' })).not.toBeInTheDocument();
  });

  it('gives the composer back empty when the prompts vanish under the pointer and later return', async () => {
    stubDraftRoute({ starters: { untriaged: 1 } });
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
    stubDraftRoute({ starters: { untriaged: 1, unplannedBugs: 1 } });
    const user = userEvent.setup();
    const { client } = renderDraft();

    const message = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.hover(await screen.findByRole('button', { name: 'Triage it' }));
    const previewed = message.value;
    expect(previewed).toContain('Triage');

    stubStarters({ untriaged: 1 });
    await client.invalidateQueries({ queryKey: queryKeys.boardFacts(FACTORY_ID) });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Plan a fix' })).not.toBeInTheDocument());

    expect(message).toHaveValue(previewed);
  });

  it('asks the server for the counts and dates it shows and for the cards holding a session, never for the whole board', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = new Date(2026, 9, 27, 12);
    vi.setSystemTime(now);
    stubDraftRoute({ starters: { untriaged: 1 }, cards: [{ createdAt: now.toISOString() }] });
    const reads = recordCardReads();
    renderDraft();

    expect(await screen.findByRole('button', { name: 'Triage it' })).toBeInTheDocument();
    const week = await screen.findByRole('region', { name: 'This week' });
    await waitFor(() =>
      expect(within(week).getByRole('button', { name: /shipped/ })).toHaveAccessibleName(
        '1 came in, 0 agent runs, 0 shipped',
      ),
    );

    const weekAgo = new Date(2026, 9, 20, 12).toISOString();
    expect(reads.toSorted()).toEqual(
      [
        `${WORK_ITEMS_URL}?scope=sessions`,
        `${WORK_ITEMS_URL}/starters`,
        `${WORK_ITEMS_URL}/activity?since=${encodeURIComponent(weekAgo)}`,
      ].toSorted(),
    );
  });

  it('shows the composer without starters or activity when the server is too old to count them', async () => {
    stubDraftRoute();
    server.use(
      http.get(`${TEST_BASE_URL}${WORK_ITEMS_URL}/:read`, () =>
        HttpResponse.json({ error: 'not_found' }, { status: 404 }),
      ),
    );
    const reads = recordCardReads();
    const { client } = renderDraft();

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await waitFor(() => expect(reads).toHaveLength(3));
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.queryByRole('list', { name: 'Start from the board' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'This week' })).not.toBeInTheDocument();
  });

  it('totals what came in, what agents started and what shipped this week, offers a recap only when something shipped, and narrows to today without fetching again', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 27, 12));
    const daysAgo = (days: number) => new Date(2026, 9, 27 - days, 11);
    stubDraftRoute({
      cards: [
        { createdAt: daysAgo(0).toISOString() },
        { createdAt: daysAgo(3).toISOString() },
        { createdAt: daysAgo(40).toISOString() },
        { ...OLD_CARD, doneAt: daysAgo(2).toISOString() },
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

  it('reads agent runs as a lower bound for a week too busy to fetch whole, yet exact for today, which the fetched runs fully cover', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = new Date(2026, 9, 27, 12).getTime();
    vi.setSystemTime(now);
    stubDraftRoute({ cards: [OLD_CARD] });
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/audit`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('before') ?? 0);
        const events = Array.from({ length: 200 }, (_, index) => {
          const minutesAgo = page * 200 + index;
          return runStarted(`run-${minutesAgo}`, new Date(now - minutesAgo * 60_000));
        });
        return HttpResponse.json({ events, actors: {}, nextCursor: String(page + 1) });
      }),
    );
    const user = userEvent.setup();
    renderDraft();
    const totals = (region: HTMLElement) => within(region).getByRole('button', { name: /shipped/ });

    const week = await screen.findByRole('region', { name: 'This week' });
    await waitFor(() => expect(totals(week)).toHaveAccessibleName('0 came in, 4,000+ agent runs, 0 shipped'));

    await user.click(totals(week));
    await user.click(within(week).getByRole('button', { name: 'This week' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Today' }));

    const today = await screen.findByRole('region', { name: 'Today' });
    await waitFor(() => expect(totals(today)).toHaveAccessibleName('0 came in, 721 agent runs, 0 shipped'));
  });

  it('says nothing happened instead of drawing an empty chart when the period is quiet', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 27, 12));
    stubDraftRoute({ cards: [OLD_CARD] });
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
