import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { releaseBoard, workBoardInfo } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type {
  IntakeTestResponse,
  BoardCatalogResponse,
  IntakeDecisionInfo,
  IntakeNotRoutedResponse,
  IntakeOrderResponse,
  IntakeRouteAgainResponse,
} from '../../../../../api/types';
import { NewCardsHere } from '../../../boardConfig/components/NewCardsHere';
import { FACTORY_ID, PROJECT_URL, rule, serveRules } from '../../../boardRules/__tests__/fixtures/rulesServer';
import { IntakeOrderSection } from '../IntakeOrderSection';
import { NotRoutedSection } from '../NotRoutedSection';

function order(fields: Partial<IntakeOrderResponse> = {}): IntakeOrderResponse {
  return {
    boards: [
      { boardKey: 'work', name: 'Work' },
      { boardKey: 'release', name: 'Release Preview' },
    ],
    origin: 'explicit',
    evaluator: 'intake-order',
    comparison: { compared: 0, differing: 0, notRouted: 0 },
    canEdit: true,
    ...fields,
  };
}

function serveOrder(initial: IntakeOrderResponse) {
  let current = initial;
  const saved: unknown[] = [];
  server.use(
    http.get(`${PROJECT_URL}/intake-order`, () => HttpResponse.json(current)),
    http.put(`${PROJECT_URL}/intake-order`, async ({ request }) => {
      const body = (await request.json()) as { boardKeys: string[] };
      saved.push(body);
      const names = new Map(current.boards.map(board => [board.boardKey, board.name]));
      current = {
        ...current,
        origin: 'explicit',
        boards: body.boardKeys.map(boardKey => ({ boardKey, name: names.get(boardKey) ?? boardKey })),
      };
      return HttpResponse.json(current);
    }),
  );
  return saved;
}

const boardNames = () =>
  within(screen.getByRole('list', { name: 'Intake order' }))
    .getAllByRole('listitem')
    .map(item => within(item).getByText(/^(Work|Release Preview)$/).textContent);

function decision(fields: Partial<IntakeDecisionInfo> & Pick<IntakeDecisionInfo, 'id' | 'title'>): IntakeDecisionInfo {
  return {
    outcome: 'not_routed',
    evaluator: 'intake-order',
    boardKey: null,
    routeId: null,
    reason: null,
    sourceKey: 'github:acme/app#1',
    url: 'https://github.com/acme/app/issues/1',
    decidedAt: '2026-11-15T10:00:00.000Z',
    ...fields,
  };
}

describe('Intake order', () => {
  it("lists the boards in the order intake checks them, with each board's rules for new items", async () => {
    serveRules({
      rules: [
        rule({
          name: 'Bugs',
          when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'bug' }] },
        }),
        rule({ name: 'Everything else' }),
        rule({ name: 'Pull requests', on: ['pull_request.opened'] }),
        rule({ name: 'Releases', target: { boardKey: 'release', phaseKey: null, joinClosedIssue: false } }),
      ],
    });
    serveOrder(order());
    renderWithProviders(
      <MemoryRouter>
        <IntakeOrderSection factoryId={FACTORY_ID} />
      </MemoryRouter>,
    );

    const list = within(await screen.findByRole('list', { name: 'Intake order' }));
    const [work, release] = list.getAllByRole('listitem');
    expect(work).toBeDefined();
    expect(within(work).getByText('Work')).toBeVisible();
    expect(await within(work).findByText('3 rules')).toBeVisible();
    expect(within(work).getByText('Ends in catch-all')).toBeVisible();
    expect(within(work).getByRole('link', { name: 'Edit rules' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/work/rules`,
    );
    expect(within(release).getByText('1 rule')).toBeVisible();
    // Release takes every new issue but no pull request, so it doesn't end in a catch-all.
    expect(within(release).queryByText('Ends in catch-all')).not.toBeInTheDocument();
  });

  it('shows a reorder before saving it, and puts it back on Discard', async () => {
    serveRules({ rules: [] });
    const saved = serveOrder(order());
    const user = userEvent.setup();
    const { client } = renderWithProviders(
      <MemoryRouter>
        <IntakeOrderSection factoryId={FACTORY_ID} />
      </MemoryRouter>,
    );

    await screen.findByRole('list', { name: 'Intake order' });
    const release = () => within(screen.getAllByRole('listitem')[1]);
    await user.click(release().getByRole('button', { name: 'Check earlier' }));
    expect(boardNames()).toEqual(['Release Preview', 'Work']);
    expect(screen.getByText('Not saved yet. The comparison is for the saved order.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(boardNames()).toEqual(['Work', 'Release Preview']);
    expect(saved).toEqual([]);

    await user.click(release().getByRole('button', { name: 'Check earlier' }));
    await user.click(screen.getByRole('button', { name: 'Save order' }));
    await waitForMutationsIdle(client);
    expect(saved).toEqual([{ boardKeys: ['release', 'work'] }]);
    expect(boardNames()).toEqual(['Release Preview', 'Work']);
    expect(screen.queryByRole('button', { name: 'Save order' })).not.toBeInTheDocument();
  });

  it('says an order is still worked out from the old route list, and how many recent cards it would file elsewhere', async () => {
    serveRules({ rules: [] });
    serveOrder(
      order({
        origin: 'derived',
        evaluator: 'route-list',
        comparison: { compared: 50, differing: 4, notRouted: 1 },
      }),
    );
    renderWithProviders(
      <MemoryRouter>
        <IntakeOrderSection factoryId={FACTORY_ID} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Worked out from the old route list until someone saves an order.')).toBeVisible();
    expect(
      screen.getByText(
        'Of the last 50 cards, 4 would land on another board than with the old route list, 1 of them Not routed.',
      ),
    ).toBeVisible();
    expect(screen.getByText('Intake still files cards by the old route list.')).toBeVisible();
  });

  it('shows a member the order without controls to change it', async () => {
    serveRules({ rules: [], canEdit: false });
    serveOrder(order({ canEdit: false }));
    renderWithProviders(
      <MemoryRouter>
        <IntakeOrderSection factoryId={FACTORY_ID} />
      </MemoryRouter>,
    );

    await screen.findByRole('list', { name: 'Intake order' });
    expect(screen.queryByRole('button', { name: 'Check earlier' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Edit rules' })).toHaveLength(2);
  });
});

describe('Not routed', () => {
  it('pages through items no board took and routes one again', async () => {
    const first = decision({ id: 'd-1', title: 'Crash on start', reason: 'No board’s rules match it.' });
    const second = decision({ id: 'd-2', title: 'Docs typo', sourceKey: 'github:acme/app#2' });
    const routedAgain: string[] = [];
    server.use(
      http.get(`${PROJECT_URL}/boards`, () =>
        HttpResponse.json({ boards: [workBoardInfo, releaseBoard] } satisfies BoardCatalogResponse),
      ),
      http.get(`${PROJECT_URL}/intake/not-routed`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        const remaining = [first, second].filter(item => !routedAgain.includes(item.id));
        return HttpResponse.json(
          (cursor
            ? { notRouted: remaining.filter(item => item.id === 'd-2'), nextCursor: null, canEdit: true }
            : {
                notRouted: remaining.filter(item => item.id === 'd-1'),
                nextCursor: 'c-1',
                canEdit: true,
              }) satisfies IntakeNotRoutedResponse,
        );
      }),
      http.post(`${PROJECT_URL}/intake/not-routed/:decisionId/route-again`, ({ params }) => {
        routedAgain.push(String(params.decisionId));
        return HttpResponse.json({
          status: 'queued',
          boardKey: 'work',
          phaseKey: 'intake',
          routeId: 'rule-1',
        } satisfies IntakeRouteAgainResponse);
      }),
    );
    const user = userEvent.setup();
    const { client } = renderWithProviders(
      <>
        <NotRoutedSection factoryId={FACTORY_ID} />
        <Toaster />
      </>,
    );

    const list = within(await screen.findByRole('list', { name: 'Not routed' }));
    expect(list.getByRole('link', { name: 'Crash on start' })).toHaveAttribute(
      'href',
      'https://github.com/acme/app/issues/1',
    );
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await list.findByText('Docs typo')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();

    const crash = list.getAllByRole('listitem')[0];
    await user.click(within(crash).getByRole('button', { name: 'Route again' }));
    await waitForMutationsIdle(client);
    expect(routedAgain).toEqual(['d-1']);
    expect(await screen.findByText('Filing “Crash on start” on Work.')).toBeVisible();
    await waitFor(() => expect(screen.queryByText('Crash on start')).not.toBeInTheDocument());
  });

  it('says when every new item found a board', async () => {
    renderWithProviders(
      <>
        <NotRoutedSection factoryId={FACTORY_ID} />
        <Toaster />
      </>,
    );

    expect(await screen.findByText('Every new item found a board.')).toBeVisible();
  });

  it('shows why an item could not be routed again', async () => {
    server.use(
      http.get(`${PROJECT_URL}/intake/not-routed`, () =>
        HttpResponse.json({
          notRouted: [decision({ id: 'd-1', title: 'Crash on start' })],
          nextCursor: null,
          canEdit: true,
        } satisfies IntakeNotRoutedResponse),
      ),
      http.post(`${PROJECT_URL}/intake/not-routed/:decisionId/route-again`, () =>
        HttpResponse.json(
          { error: 'intake_not_routed', message: 'No board’s intake rules match it.' },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <NotRoutedSection factoryId={FACTORY_ID} />
        <Toaster />
      </>,
    );

    await user.click(await screen.findByRole('button', { name: 'Route again' }));
    expect(await screen.findByText('No board’s intake rules match it.')).toBeVisible();
  });

  it('opens the tester on an item no board took, showing what each rule answered', async () => {
    const tested: unknown[] = [];
    server.use(
      http.get(`${PROJECT_URL}/intake/not-routed`, () =>
        HttpResponse.json({
          notRouted: [decision({ id: 'd-1', title: 'Crash on start' })],
          nextCursor: null,
          canEdit: false,
        } satisfies IntakeNotRoutedResponse),
      ),
      http.post(`${PROJECT_URL}/intake/test`, async ({ request }) => {
        tested.push(await request.json());
        return HttpResponse.json({
          item: { title: 'Crash on start', url: null, kind: 'not_routed', id: 'd-1' },
          placement: null,
          reason: 'No board’s rules match it.',
          boards: [
            {
              boardKey: 'work',
              name: 'Work',
              rules: [
                {
                  routeId: 'bugs',
                  name: 'Bugs go to Triage',
                  phase: 'triage',
                  outcome: 'no_match',
                  failed: [{ field: 'item.labels', operator: 'contains', value: 'bug', actual: [] }],
                },
              ],
            },
          ],
          current: null,
          moves: [],
        } satisfies IntakeTestResponse);
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<NotRoutedSection factoryId={FACTORY_ID} />);

    await user.click(await screen.findByRole('button', { name: 'Why?' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Test intake' }));
    expect(await dialog.findByText('Not routed. No board’s rules match it.')).toBeVisible();
    expect(dialog.getByRole('list', { name: 'What each rule answered' })).toHaveTextContent('Work › Bugs go to Triage');
    expect(tested).toEqual([{ itemId: 'd-1' }]);
  });
});

describe('Board settings summary', () => {
  it("counts the board's reachable rules for new items and where intake checks it", async () => {
    serveRules({
      rules: [
        rule({
          name: 'Bugs',
          when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'bug' }] },
        }),
        rule({ name: 'Off', enabled: false }),
        rule({ name: 'Everything else' }),
        rule({ name: 'Never reached' }),
        rule({ name: 'Closed', on: ['work_item.closed'] }),
      ],
      order: ['release', 'work'],
    });
    renderWithProviders(
      <MemoryRouter>
        <NewCardsHere factoryId={FACTORY_ID} board={workBoardInfo} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('2 rules for new items')).toBeVisible();
    expect(screen.getByText('Checked 2nd')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Edit rules' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/work/rules`,
    );
  });
});
