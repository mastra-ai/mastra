import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../e2e/ui/msw-server';
import {
  TEST_BASE_URL,
  renderHookWithProviders,
  renderWithProviders,
  waitForMutationsIdle,
} from '../../../../../e2e/ui/render';
import type { IntakeDryRunResponse, IntakeTestResponse } from '../../../../api/types';
import { useIntakeDryRunQuery } from '../../../../hooks/useIntakeDryRun';
import { useIntakeRouteWrites } from '../../../../hooks/useIntakeRoutes';
import { IntakeTesterPanel } from '../IntakeTesterPanel';

const PROJECT = `${TEST_BASE_URL}/web/factory/projects/fp-1`;
const ITEM_ID = '0b9a4c1e-5f2d-4c3a-9e8b-7d6f5a4b3c2d';

const shipped: IntakeTestResponse = {
  item: { title: 'Crash on start', url: 'https://github.com/mastra-ai/mastra/issues/12', kind: 'fetched', id: null },
  placement: { boardKey: 'work', routeId: 'everything', phase: 'intake' },
  reason: null,
  boards: [
    {
      boardKey: 'ship',
      name: 'Ship',
      rules: [
        {
          routeId: 'ship-bugs',
          name: 'Bugs from mastra-ai/ship',
          phase: 'intake',
          outcome: 'no_match',
          failed: [
            { field: 'source.repository', operator: 'equals', value: 'mastra-ai/ship', actual: 'mastra-ai/mastra' },
          ],
        },
        {
          routeId: 'ship-label',
          name: 'Labelled ship',
          phase: 'intake',
          outcome: 'no_match',
          failed: [{ field: 'item.labels', operator: 'contains', value: 'ship', actual: ['bug'] }],
        },
      ],
    },
    {
      boardKey: 'work',
      name: 'Work',
      rules: [
        { routeId: 'everything', name: 'Everything else', phase: 'intake', outcome: 'took' },
        {
          routeId: 'late',
          name: null,
          phase: 'intake',
          outcome: 'lost',
          to: { boardKey: 'work', routeId: 'everything' },
        },
      ],
    },
  ],
  note: null,
  evaluator: 'intake-order',
  current: null,
  moves: [],
};

function serveTest(response: IntakeTestResponse | { status: number; error: string; message: string }) {
  const bodies: unknown[] = [];
  server.use(
    http.post(`${PROJECT}/intake/test`, async ({ request }) => {
      bodies.push(await request.json());
      if ('status' in response) {
        return HttpResponse.json({ error: response.error, message: response.message }, { status: response.status });
      }
      return HttpResponse.json(response);
    }),
  );
  return bodies;
}

describe('IntakeTesterPanel', () => {
  it('tests a pasted URL and shows where it goes and what every rule answered', async () => {
    const bodies = serveTest(shipped);
    const { rerender } = renderWithProviders(<IntakeTesterPanel factoryProjectId="fp-1" />);

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Issue or pull request URL' }),
      ' https://github.com/mastra-ai/mastra/issues/12 ',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Test' }));

    expect(await screen.findByText('Goes to Work › intake')).toBeTruthy();
    expect(bodies).toEqual([{ url: 'https://github.com/mastra-ai/mastra/issues/12' }]);
    const answers = within(screen.getByRole('list', { name: 'What each rule answered' }))
      .getAllByRole('listitem')
      .map(item => item.textContent);
    expect(answers).toEqual([
      'Ship › Bugs from mastra-ai/ship: no, source.repository is mastra-ai/mastra, wanted equals mastra-ai/ship',
      'Ship › Labelled ship: no, item.labels is bug, wanted contains ship',
      'Work › Everything else: yes',
      'Work › Unnamed rule: matched, but Work › Everything else took it first',
    ]);
    expect(screen.getByRole('link', { name: 'Crash on start' }).getAttribute('href')).toBe(
      'https://github.com/mastra-ai/mastra/issues/12',
    );

    // Another project's panel starts empty: this answer was about the first one's rules.
    rerender(<IntakeTesterPanel factoryProjectId="fp-2" />);
    expect(screen.queryByText('Goes to Work › intake')).toBeNull();
    expect((screen.getByRole('textbox', { name: 'Issue or pull request URL' }) as HTMLInputElement).value).toBe('');
  });

  it('tests a recent item as soon as it opens, against unsaved order, and says why nothing takes it', async () => {
    const bodies = serveTest({
      ...shipped,
      item: { title: 'Question', url: null, kind: 'not_routed', id: ITEM_ID },
      placement: null,
      reason: "No board's intake rules match it (checked SHIP).",
      boards: shipped.boards.slice(0, 1),
    });
    renderWithProviders(<IntakeTesterPanel factoryProjectId="fp-1" itemId={ITEM_ID} draft={{ order: ['ship'] }} />);

    expect(await screen.findByText("Not routed. No board's intake rules match it (checked SHIP).")).toBeTruthy();
    expect(bodies).toEqual([{ order: ['ship'], itemId: ITEM_ID }]);
  });

  it('tests the open item again against an edited draft when Test is pressed with no URL', async () => {
    const bodies = serveTest(shipped);
    const { rerender } = renderWithProviders(
      <IntakeTesterPanel factoryProjectId="fp-1" itemId={ITEM_ID} draft={{ order: ['ship', 'work'] }} />,
    );
    expect(await screen.findByText('Goes to Work › intake')).toBeTruthy();
    rerender(<IntakeTesterPanel factoryProjectId="fp-1" itemId={ITEM_ID} draft={{ order: ['work', 'ship'] }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Test' }));

    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toEqual({ order: ['work', 'ship'], itemId: ITEM_ID });
  });

  it("warns when the project doesn't file with intake order, and says what a fetched pull request answer leaves out", async () => {
    serveTest({
      ...shipped,
      evaluator: 'route-list',
      note: "A pull request that closes an issue with a card, or comes from a card's branch, joins that card instead; this test doesn't check for that.",
    });
    renderWithProviders(<IntakeTesterPanel factoryProjectId="fp-1" itemId={ITEM_ID} />);

    expect(
      await screen.findByText(
        'This project still files new issues and pull requests with the old route list, so filing may differ from this answer until it switches to intake order.',
      ),
    ).toBeTruthy();
    expect(screen.getByText(/joins that card instead; this test doesn't check for that\./)).toBeTruthy();
  });

  it("replays a card's recent events through its board's card-move rules and says what each would do", async () => {
    serveTest({
      ...shipped,
      item: { title: 'Crash on start', url: null, kind: 'card', id: ITEM_ID },
      current: { boardKey: 'work', phase: 'intake', routeId: 'everything' },
      moves: [
        {
          decisionId: 'd-2',
          at: '2030-01-02T00:00:00.000Z',
          event: { type: 'work_item.updated', labels: { added: ['ship'], removed: ['bug'] } },
          outcome: 'moves',
          to: { boardKey: 'ship', phase: 'inbox', routeId: 'ship-added' },
          phase: null,
          reason: null,
          rules: [
            { routeId: 'off', name: 'Paused', outcome: 'disabled' },
            {
              routeId: 'docs-added',
              name: 'Docs added',
              outcome: 'no_match',
              failed: [{ field: 'event.labels.added', operator: 'contains', value: 'docs', actual: ['ship'] }],
            },
            { routeId: 'ship-added', name: 'Ship added', outcome: 'took' },
            { routeId: 'any', name: null, outcome: 'lost', to: { boardKey: 'ship', routeId: 'ship-added' } },
            {
              routeId: 'platform',
              name: 'To Platform',
              outcome: 'skipped',
              reason: 'board "platform" is not installed',
            },
            {
              routeId: 'review',
              name: 'Pull requests to Review',
              outcome: 'skipped',
              reason: "the pull request's author is an outsider, and this rule doesn't test pullRequest.trusted",
            },
          ],
        },
        {
          decisionId: 'd-1',
          at: '2030-01-01T00:00:00.000Z',
          event: { type: 'work_item.reopened' },
          outcome: 'ignored',
          to: null,
          phase: null,
          reason: "The card isn't finished, so reopening it doesn't move it.",
          rules: [],
        },
        {
          decisionId: null,
          at: null,
          event: { type: 'pull_request.merged', pullRequestTrusted: true },
          outcome: 'rule_default',
          to: null,
          phase: 'done',
          reason: null,
          rules: [],
        },
        {
          decisionId: 'd-0',
          at: '2029-12-31T00:00:00.000Z',
          event: { type: 'work_item.closed', reason: 'canceled' },
          outcome: 'stays',
          to: null,
          phase: null,
          reason: null,
          rules: [],
        },
      ],
    });
    renderWithProviders(<IntakeTesterPanel factoryProjectId="fp-1" itemId={ITEM_ID} />);

    const moves = await screen.findByRole('list', { name: 'Card moves' });
    expect(screen.getByText("Replays run against the card's current phase and facts.")).toBeTruthy();
    const events = within(moves)
      .getAllByRole('listitem')
      .filter(item => item.parentElement === moves);
    expect(events.map(item => within(item).getByRole('heading').textContent)).toEqual([
      'work_item.updated, labels +ship −bug: moves to Ship › inbox',
      "work_item.reopened: ignored. The card isn't finished, so reopening it doesn't move it.",
      'pull_request.merged: no rule takes it, so the integration moves it to done',
      'work_item.closed (canceled): stays where it is',
    ]);
    const answers = within(within(events[0]).getByRole('list', { name: 'What each card-move rule answered' }))
      .getAllByRole('listitem')
      .map(item => item.textContent);
    expect(answers).toEqual([
      'Paused: off',
      'Docs added: no, event.labels.added is ship, wanted contains docs',
      'Ship added: yes',
      'Unnamed rule: matched, but Ship added took it first',
      'To Platform: skipped, board "platform" is not installed',
      "Pull requests to Review: skipped, the pull request's author is an outsider, and this rule doesn't test “Pull request author trust”",
    ]);
  });

  it("shows the server's refusal for a repository the project hasn't linked", async () => {
    serveTest({
      status: 422,
      error: 'not_linked',
      message: 'That repository is not linked to this project.',
    });
    renderWithProviders(<IntakeTesterPanel factoryProjectId="fp-1" />);

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Issue or pull request URL' }),
      'https://github.com/someone/else/issues/1',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Test' }));

    expect(await screen.findByText('That repository is not linked to this project.')).toBeTruthy();
  });
});

describe('useIntakeDryRunQuery', () => {
  it('runs the saved rules, and runs them again after a rule changes', async () => {
    const dryRun: IntakeDryRunResponse = {
      evaluator: 'intake-order',
      sampled: 0,
      boards: [],
      notRouted: [],
      items: [],
      canEdit: true,
    };
    const bodies: unknown[] = [];
    server.use(
      http.post(`${PROJECT}/intake/dry-run`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(dryRun);
      }),
      http.get(`${PROJECT}/intake-routes`, () => HttpResponse.json({ intakeRoutes: [], canEdit: true })),
      http.post(`${PROJECT}/intake-routes/reorder`, () => HttpResponse.json({ intakeRoutes: [] })),
    );
    const { result, client } = renderHookWithProviders(() => ({
      dryRun: useIntakeDryRunQuery('fp-1'),
      writes: useIntakeRouteWrites('fp-1'),
    }));

    await waitFor(() => expect(result.current.dryRun.data).toEqual(dryRun));
    expect(bodies).toEqual([{}]);
    await act(() => result.current.writes.mutateAsync([{ kind: 'reorder', ids: [] }]));
    await waitFor(() => expect(bodies).toHaveLength(2));
    await waitForMutationsIdle(client);
    expect(result.current.dryRun.data).toEqual(dryRun);
  });
});
