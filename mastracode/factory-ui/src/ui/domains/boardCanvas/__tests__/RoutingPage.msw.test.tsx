import { FACTORY_ROUTE_CONTRACTS } from '@mastra/factory/routes/contracts';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders, waitForMutationsIdle } from '../../../../../e2e/ui/render';
import { queryKeys } from '../../../../api/keys';
import type {
  IntakeDecisionInfo,
  IntakeDryRunResponse,
  IntakeNotRoutedResponse,
  IntakeOrderResponse,
  IntakeRouteAgainResponse,
} from '../../../../api/types';
import { createAppRoutes } from '../../../router';
import { stubFactory } from '../../boardConfig/__tests__/fixtures/factory-app';
import { PROJECT_URL, rule, serveRules } from '../../boardRules/__tests__/fixtures/rulesServer';
import { saveBoardView } from '../../factory/services/boardViews';

const ROUTING = '/factories/fp-1/work/intake';
const REROUTE_URL = `${PROJECT_URL}/intake-routes/reroute`;

function renderRouting(path = ROUTING) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  const view = renderWithProviders(
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>,
  );
  return { ...view, router };
}

function order(fields: Partial<IntakeOrderResponse> = {}): IntakeOrderResponse {
  return {
    boards: [
      { boardKey: 'work', name: 'Work' },
      { boardKey: 'release', name: 'Release Preview' },
    ],
    origin: 'explicit',
    evaluator: 'intake-order',
    evaluatorSource: 'project',
    projectEvaluator: 'intake-order',
    comparison: { compared: 0, differing: 0, notRouted: 0 },
    canEdit: true,
    ...fields,
  };
}

/** Serves the intake order and keeps what Save order sends. Call after `serveRules`, whose order it replaces. */
function serveOrder(initial: IntakeOrderResponse) {
  let current = initial;
  const saved: unknown[] = [];
  server.use(
    http.get(`${PROJECT_URL}/intake-order`, () => HttpResponse.json(current)),
    http.put(`${PROJECT_URL}/intake-order`, async ({ request }) => {
      const body = FACTORY_ROUTE_CONTRACTS.intakeOrderUpdate.bodySchema.parse(await request.json());
      saved.push(body);
      const names = new Map(current.boards.map(board => [board.boardKey, board.name]));
      current = {
        ...current,
        origin: 'explicit',
        boards: (body.boardKeys ?? []).map(boardKey => ({ boardKey, name: names.get(boardKey) ?? boardKey })),
      };
      return HttpResponse.json(current);
    }),
  );
  return { saved, set: (next: IntakeOrderResponse) => (current = next) };
}

function serveDryRun(boards: IntakeDryRunResponse['boards'] = []) {
  server.use(
    http.post(`${PROJECT_URL}/intake/dry-run`, () =>
      HttpResponse.json({
        evaluator: 'intake-order',
        sampled: 200,
        boards,
        notRouted: [],
        items: [],
        canEdit: true,
      } satisfies IntakeDryRunResponse),
    ),
  );
}

function serveReroute(preview: { total: number; moves: { fromBoard: string; toBoard: string; count: number }[] }) {
  let current = preview;
  const applied: number[] = [];
  server.use(
    http.get(REROUTE_URL, () => HttpResponse.json(current)),
    http.post(REROUTE_URL, () => {
      applied.push(current.total);
      const moved = current.total;
      current = { total: 0, moves: [] };
      return HttpResponse.json({ moved, skipped: 0 });
    }),
  );
  return applied;
}

function serveNotRouted(pages: IntakeNotRoutedResponse[]) {
  server.use(
    http.get(`${PROJECT_URL}/intake/not-routed`, ({ request }) => {
      const cursor = new URL(request.url).searchParams.get('cursor');
      return HttpResponse.json(cursor ? pages[1] : pages[0]);
    }),
  );
}

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

const boardCards = () => within(screen.getByRole('list', { name: 'Boards in intake order' })).getAllByRole('article');

const boardNames = () => boardCards().map(card => card.getAttribute('aria-label'));

const card = (name: string) => within(screen.getByRole('article', { name }));

/** The page loads lazily: waits for the board's card to show before reading it. */
const findCard = async (name: string) => within(await screen.findByRole('article', { name }));

/** A promise the test settles itself, so a handler can wait on it from before the request arrives. */
function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>(settle => (resolve = settle));
  return { promise, resolve };
}

beforeEach(() => {
  stubFactory();
  serveDryRun();
  serveReroute({ total: 0, moves: [] });
});

describe('Routing page: the intake order', () => {
  it('given rules on two boards, when the page opens, then each board lists its rules for new items in order, with what each filed', async () => {
    const bugs = rule({
      name: 'Bugs',
      when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'bug' }] },
    });
    const everything = rule({ name: 'Everything else' });
    const pulls = rule({ name: 'Pull requests', on: ['pull_request.opened'] });
    const releases = rule({
      name: 'Releases',
      target: { boardKey: 'release', phaseKey: null, joinClosedIssue: false, moveToBoardKey: null },
    });
    serveRules({ rules: [bugs, everything, pulls, releases] });
    serveDryRun([
      {
        boardKey: 'work',
        name: 'Work',
        takes: ['a', 'b', 'c'],
        lostTo: [],
        rules: [
          { routeId: bugs.id, name: 'Bugs', enabled: true, takes: ['a'], lost: [], filed: 12 },
          { routeId: everything.id, name: null, enabled: true, takes: ['b'], lost: [], filed: 30 },
          { routeId: pulls.id, name: null, enabled: true, takes: ['c'], lost: [], filed: 5 },
        ],
      },
      {
        boardKey: 'release',
        name: 'Release Preview',
        takes: [],
        lostTo: [{ boardKey: 'work', keys: ['b'] }],
        rules: [{ routeId: releases.id, name: null, enabled: true, takes: [], lost: [], filed: 4 }],
      },
    ]);
    renderRouting();

    await waitFor(() => expect(boardNames()).toEqual(['Work', 'Release Preview']));
    const work = card('Work');
    expect(work.getByRole('heading', { name: 'Work' })).toBeVisible();
    expect(await work.findByRole('button', { name: /Bugs.*12/ })).toBeVisible();
    expect(work.getByRole('button', { name: /1\/2.*Bugs/ })).toBeVisible();
    expect(work.getByRole('button', { name: /Every new issue.*30/ })).toBeVisible();
    expect(work.getByRole('button', { name: /Every pull request.*5/ })).toBeVisible();
    expect(await work.findByText('Last 200 items')).toBeVisible();
    expect(work.getByText('3 land here, none lost to earlier boards')).toBeVisible();
    expect(work.getByRole('link', { name: 'All rules on Work' })).toHaveAttribute(
      'href',
      '/factories/fp-1/work/config',
    );

    const release = card('Release Preview');
    expect(release.getByRole('link', { name: 'Release Preview' })).toHaveAttribute(
      'href',
      '/factories/fp-1/boards/release/intake',
    );
    expect(release.getByRole('button', { name: /Every new issue.*4/ })).toBeVisible();
    // Release takes no pull request, and nothing comes after it.
    expect(release.getByText('No rules, ends Not routed')).toBeVisible();

    const sources = within(screen.getByRole('region', { name: 'Sources' }));
    expect(within(sources.getByRole('listitem', { name: 'Issue opened' })).getByText('46')).toBeVisible();
    expect(within(sources.getByRole('listitem', { name: 'Pull request opened' })).getByText('5')).toBeVisible();
  });

  it('given a rule an earlier one always beats, when the page opens, then the rule says it is never reached', async () => {
    serveRules({ rules: [rule({ name: 'Everything' }), rule({ name: 'Off rule', enabled: false })] });
    renderRouting();

    expect(
      await (await findCard('Work')).findByText('Never reached: rule 1 above matches every new issue.'),
    ).toBeVisible();
    expect(card('Work').getByText('Off, skipped')).toBeVisible();
  });

  it('when a rule is clicked, then it opens in the side panel through the URL', async () => {
    const bugs = rule({ name: 'Everything' });
    serveRules({ rules: [bugs] });
    const user = userEvent.setup();
    const { router } = renderRouting();

    await user.click(await (await findCard('Work')).findByRole('button', { name: /Every new issue/ }));

    expect(router.state.location.search).toBe(`?rule=${bugs.id}`);
  });

  it('given the open board first, then it cannot be asked earlier', async () => {
    serveRules({ rules: [] });
    serveOrder(order());
    renderRouting();

    await waitFor(() => expect(boardNames()).toEqual(['Work', 'Release Preview']));
    expect(card('Work').getByRole('button', { name: 'Check earlier' })).toBeDisabled();
  });

  it('given another board last, when it is asked earlier by its arrow, then it moves as an unsaved order', async () => {
    serveRules({ rules: [] });
    serveOrder(order());
    const user = userEvent.setup();
    renderRouting();

    await waitFor(() => expect(boardNames()).toEqual(['Work', 'Release Preview']));
    expect(card('Release Preview').getByRole('button', { name: 'Check later' })).toBeDisabled();
    await user.click(card('Release Preview').getByRole('button', { name: 'Check earlier' }));

    expect(boardNames()).toEqual(['Release Preview', 'Work']);
    expect(screen.getByText('Order not saved')).toBeVisible();
  });

  describe('when the open board moves later', () => {
    async function moveWorkLater() {
      serveRules({ rules: [] });
      const { saved } = serveOrder(order());
      const user = userEvent.setup();
      const { client } = renderRouting();
      await waitFor(() => expect(boardNames()).toEqual(['Work', 'Release Preview']));
      await user.click(card('Work').getByRole('button', { name: 'Check later' }));
      return { saved, user, client };
    }

    it('then the reorder shows as not saved yet', async () => {
      await moveWorkLater();

      expect(boardNames()).toEqual(['Release Preview', 'Work']);
      expect(screen.getByText('Not saved yet. The comparison is for the saved order.')).toBeVisible();
      expect(screen.getByText('Order not saved')).toBeVisible();
    });

    it('then Discard puts it back without saving', async () => {
      const { saved, user } = await moveWorkLater();

      await user.click(screen.getByRole('button', { name: 'Discard' }));

      expect(boardNames()).toEqual(['Work', 'Release Preview']);
      expect(saved).toEqual([]);
    });

    it('then Save order saves the new order', async () => {
      const { saved, user, client } = await moveWorkLater();

      await user.click(screen.getByRole('button', { name: 'Save order' }));
      await waitForMutationsIdle(client);

      expect(saved).toEqual([{ boardKeys: ['release', 'work'] }]);
      expect(await screen.findByText('Intake order saved.')).toBeVisible();
      expect(boardNames()).toEqual(['Release Preview', 'Work']);
      expect(screen.queryByRole('button', { name: 'Save order' })).not.toBeInTheDocument();
    });
  });

  describe('when a board is dragged by its handle', () => {
    async function dragWorkDown() {
      serveRules({ rules: [] });
      const { saved } = serveOrder(order());
      // jsdom lays nothing out: each board in the order stands 100px tall, one under the other.
      const layout = vi
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: HTMLElement) {
          const rows = this.parentElement?.matches('[aria-label="Boards in intake order"]')
            ? Array.from(this.parentElement.children)
            : [];
          const top = rows.indexOf(this) * 100;
          return { top, bottom: top + 100, height: 100, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) };
        });
      onTestFinished(() => layout.mockRestore());
      const user = userEvent.setup();
      renderRouting();
      await waitFor(() => expect(boardNames()).toEqual(['Work', 'Release Preview']));
      await user.pointer([
        { keys: '[MouseLeft>]', target: card('Work').getByText('1'), coords: { clientY: 50 } },
        { coords: { clientY: 170 } },
      ]);
      return { saved, user };
    }

    it('then Escape puts it back', async () => {
      const { user } = await dragWorkDown();

      await user.keyboard('{Escape}');
      await user.pointer({ keys: '[/MouseLeft]' });

      expect(boardNames()).toEqual(['Work', 'Release Preview']);
      expect(screen.queryByText('Order not saved')).not.toBeInTheDocument();
    });

    it('then a drop moves it as an unsaved order', async () => {
      const { saved, user } = await dragWorkDown();

      await user.pointer({ keys: '[/MouseLeft]' });

      expect(boardNames()).toEqual(['Release Preview', 'Work']);
      expect(screen.getByText('Order not saved')).toBeVisible();
      expect(saved).toEqual([]);
    });
  });

  it('when another board is moved with Alt+Up from the keyboard, then it is asked earlier as an unsaved order', async () => {
    serveRules({ rules: [] });
    serveOrder(order());
    const user = userEvent.setup();
    renderRouting();

    await waitFor(() => expect(boardNames()).toEqual(['Work', 'Release Preview']));
    card('Release Preview').getByRole('link', { name: 'Release Preview' }).focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');

    expect(boardNames()).toEqual(['Release Preview', 'Work']);
    expect(screen.getByText('Order not saved')).toBeVisible();
  });

  it('when the order is saving, then it holds still, so a later move is never lost to the earlier save', async () => {
    serveRules({ rules: [] });
    const saving = deferred();
    server.use(
      http.get(`${PROJECT_URL}/intake-order`, () => HttpResponse.json(order())),
      http.put(`${PROJECT_URL}/intake-order`, async ({ request }) => {
        const body = FACTORY_ROUTE_CONTRACTS.intakeOrderUpdate.bodySchema.parse(await request.json());
        await saving.promise;
        return HttpResponse.json(
          order({
            boards: (body.boardKeys ?? []).map(boardKey => ({
              boardKey,
              name: boardKey === 'work' ? 'Work' : 'Release Preview',
            })),
          }),
        );
      }),
    );
    const user = userEvent.setup();
    const { client } = renderRouting();

    await waitFor(() => expect(boardNames()).toEqual(['Work', 'Release Preview']));
    await user.click(card('Work').getByRole('button', { name: 'Check later' }));
    await user.click(screen.getByRole('button', { name: 'Save order' }));

    await waitFor(() => expect(card('Work').getByRole('button', { name: 'Check earlier' })).toBeDisabled());
    saving.resolve();
    await waitForMutationsIdle(client);
    expect(boardNames()).toEqual(['Release Preview', 'Work']);
  });

  it('given an unsaved order, when a board is added meanwhile, then the board shows and the stale change is dropped', async () => {
    serveRules({ rules: [] });
    const served = serveOrder(order());
    const user = userEvent.setup();
    const { client } = renderRouting();

    await waitFor(() => expect(boardNames()).toEqual(['Work', 'Release Preview']));
    await user.click(card('Work').getByRole('button', { name: 'Check later' }));
    served.set(order({ boards: [...order().boards, { boardKey: 'docs', name: 'Docs' }] }));
    await client.invalidateQueries({ queryKey: queryKeys.intakeOrder('fp-1') });

    await waitFor(() => expect(boardNames()).toEqual(['Work', 'Release Preview', 'Docs']));
    expect(screen.queryByRole('button', { name: 'Save order' })).not.toBeInTheDocument();
  });

  it('given a member who cannot edit, when the page opens, then the order and rules show without controls to change them', async () => {
    serveRules({ rules: [rule({ name: 'Everything' })], canEdit: false });
    serveOrder(order({ canEdit: false }));
    serveNotRouted([
      { notRouted: [decision({ id: 'd-1', title: 'Crash on start' })], nextCursor: null, canEdit: false },
    ]);
    const user = userEvent.setup();
    renderRouting();

    expect(await (await findCard('Work')).findByRole('button', { name: /Every new issue/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Check later' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rule' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Show items not routed' }));
    expect(await screen.findByRole('button', { name: 'Why?' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Route again' })).not.toBeInTheDocument();
  });

  it('given an order still worked out from the old route list, then the page says so and how many cards it would move', async () => {
    serveRules({ rules: [] });
    serveOrder(
      order({ origin: 'derived', evaluator: 'route-list', comparison: { compared: 50, differing: 4, notRouted: 1 } }),
    );
    renderRouting();

    expect(await screen.findByText('Worked out from the old route list until someone saves an order.')).toBeVisible();
    expect(
      screen.getByText(
        'Of the last 50 cards, 4 would land on another board than with the old route list, 1 of them Not routed.',
      ),
    ).toBeVisible();
    expect(screen.getByText('Intake still files cards by the old route list.')).toBeVisible();
  });

  it('when + Rule is clicked, then a new rule for the open board opens through the URL', async () => {
    serveRules({ rules: [] });
    const user = userEvent.setup();
    const { router } = renderRouting();

    await user.click(await (await findCard('Work')).findByRole('button', { name: 'Rule' }));

    expect(new URLSearchParams(router.state.location.search).get('rule')).toBe('new');
    expect(new URLSearchParams(router.state.location.search).get('board')).toBe('work');
  });

  it('given filters last used on the board, then the Cards tab brings them back', async () => {
    saveBoardView('fp-1', 'work', new URLSearchParams('label=bug&sort=created-newest'));
    onTestFinished(() => localStorage.clear());
    serveRules({ rules: [] });
    renderRouting();

    expect(await screen.findByRole('link', { name: 'Cards' })).toHaveAttribute(
      'href',
      '/factories/fp-1/work?label=bug&sort=created-newest',
    );
  });
});

describe('Routing page: cards rules changed', () => {
  it('given untouched cards that now belong on another board, when Move them is clicked, then they move', async () => {
    serveRules({ rules: [] });
    const applied = serveReroute({ total: 3, moves: [{ fromBoard: 'work', toBoard: 'release', count: 3 }] });
    const user = userEvent.setup();
    renderRouting();

    expect(await screen.findByText('3 untouched cards now belong on Release Preview.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Move them' }));

    expect(await screen.findByText('Moved 3 cards.')).toBeVisible();
    expect(applied).toEqual([3]);
    await waitFor(() =>
      expect(screen.queryByText('3 untouched cards now belong on Release Preview.')).not.toBeInTheDocument(),
    );
  });

  it('when Not now is clicked, then the proposal goes away without moving anything', async () => {
    serveRules({ rules: [] });
    const applied = serveReroute({ total: 1, moves: [{ fromBoard: 'work', toBoard: 'release', count: 1 }] });
    const user = userEvent.setup();
    renderRouting();

    await user.click(await screen.findByRole('button', { name: 'Not now' }));

    expect(screen.queryByText('1 untouched card now belongs on Release Preview.')).not.toBeInTheDocument();
    expect(applied).toEqual([]);
  });
});

describe('Routing page: Not routed', () => {
  describe('when items no board took are listed', () => {
    async function listNotRouted() {
      const first = decision({ id: 'd-1', title: 'Crash on start' });
      const second = decision({ id: 'd-2', title: 'Docs typo', sourceKey: 'github:acme/app#2' });
      const routedAgain: string[] = [];
      serveRules({ rules: [] });
      let remaining = [first, second];
      server.use(
        http.get(`${PROJECT_URL}/intake/not-routed`, ({ request }) => {
          const cursor = new URL(request.url).searchParams.get('cursor');
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
          remaining = remaining.filter(item => item.id !== params.decisionId);
          return HttpResponse.json({
            status: 'queued',
            boardKey: 'work',
            phaseKey: 'intake',
            routeId: 'rule-1',
          } satisfies IntakeRouteAgainResponse);
        }),
      );
      const user = userEvent.setup();
      const { client } = renderRouting(`${ROUTING}#not-routed`);
      const list = within(await screen.findByRole('list', { name: 'Items not routed' }));
      return { list, routedAgain, user, client };
    }

    it('then each links to its source', async () => {
      const { list } = await listNotRouted();

      expect(list.getByRole('link', { name: 'Crash on start' })).toHaveAttribute(
        'href',
        'https://github.com/acme/app/issues/1',
      );
      expect(list.getByText(/acme\/app#1/)).toBeVisible();
    });

    it('then one with no recorded reason says no board’s rules match it', async () => {
      const { list } = await listNotRouted();

      expect(within(list.getAllByRole('listitem')[0]).getByText('No board’s rules match it.')).toBeVisible();
    });

    it('then Load more pages in the older ones until none are left', async () => {
      const { list, user } = await listNotRouted();

      await user.click(screen.getByRole('button', { name: 'Load more' }));

      expect(await list.findByText('Docs typo')).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    });

    it('then Route again queues one and it leaves the list', async () => {
      const { list, routedAgain, user, client } = await listNotRouted();

      const crash = list.getAllByRole('listitem')[0];
      await user.click(within(crash).getByRole('button', { name: 'Route again' }));
      await waitForMutationsIdle(client);

      expect(routedAgain).toEqual(['d-1']);
      expect(await screen.findByText('Filing “Crash on start” on Work.')).toBeVisible();
      await waitFor(() => expect(screen.queryByRole('link', { name: 'Crash on start' })).not.toBeInTheDocument());
    });
  });

  it('given nothing waiting, then it says every new issue and pull request found a board', async () => {
    serveRules({ rules: [] });
    renderRouting();

    expect(
      await within(await screen.findByRole('region', { name: 'Not routed' })).findByText(
        'Every new issue and pull request found a board.',
      ),
    ).toBeVisible();
  });

  it('given the intake order fails to load, then items no board took still list', async () => {
    serveRules({ rules: [] });
    server.use(http.get(`${PROJECT_URL}/intake-order`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    serveNotRouted([
      { notRouted: [decision({ id: 'd-1', title: 'Crash on start' })], nextCursor: null, canEdit: true },
    ]);
    renderRouting(`${ROUTING}#not-routed`);

    expect(await screen.findByText('The intake order didn’t load.')).toBeVisible();
    const list = within(await screen.findByRole('list', { name: 'Items not routed' }));
    expect(list.getByRole('link', { name: 'Crash on start' })).toBeVisible();
  });

  it('given every loaded item routed again but older ones remain, then Load more stays', async () => {
    serveRules({ rules: [] });
    serveNotRouted([{ notRouted: [], nextCursor: 'c-1', canEdit: true }]);
    renderRouting(`${ROUTING}#not-routed`);

    expect(await screen.findByText('More waiting')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Load more' })).toBeVisible();
  });

  it('when routing again fails, then it says why', async () => {
    serveRules({ rules: [] });
    serveNotRouted([
      { notRouted: [decision({ id: 'd-1', title: 'Crash on start' })], nextCursor: null, canEdit: true },
    ]);
    server.use(
      http.post(`${PROJECT_URL}/intake/not-routed/:decisionId/route-again`, () =>
        HttpResponse.json(
          { error: 'intake_not_routed', message: 'No board’s intake rules match it.' },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderRouting(`${ROUTING}#not-routed`);

    await user.click(await screen.findByRole('button', { name: 'Route again' }));
    expect(await screen.findByText('No board’s intake rules match it.')).toBeVisible();
  });

  it('when Why? is clicked, then the tester opens on that item through the URL', async () => {
    serveRules({ rules: [] });
    serveNotRouted([
      { notRouted: [decision({ id: 'd-1', title: 'Crash on start' })], nextCursor: null, canEdit: false },
    ]);
    server.use(http.post(`${PROJECT_URL}/intake/test`, () => HttpResponse.json({ error: 'later' }, { status: 500 })));
    const user = userEvent.setup();
    const { router } = renderRouting();

    await user.click(await screen.findByRole('button', { name: 'Show items not routed' }));
    await user.click(await screen.findByRole('button', { name: 'Why?' }));

    expect(router.state.location.search).toBe('?test=d-1');
  });
});
