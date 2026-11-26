import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../e2e/ui/render';
import type { IntakeTestResponse } from '../../../../api/types';
import { TestPanel } from '../components/testPanel/TestPanel';

const PROJECT = `${TEST_BASE_URL}/web/factory/projects/fp-1`;
const URL = 'https://github.com/mastra-ai/mastra/issues/12';
const ITEM_ID = '0b9a4c1e-5f2d-4c3a-9e8b-7d6f5a4b3c2d';

const routed: IntakeTestResponse = {
  item: { title: 'Crash on start', url: URL, kind: 'fetched', id: null },
  placement: { boardKey: 'work', routeId: 'everything', phase: 'intake' },
  reason: null,
  boards: [
    {
      boardKey: 'ship',
      name: 'Ship',
      rules: [
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
      rules: [{ routeId: 'everything', name: 'Everything else', phase: 'intake', outcome: 'took' }],
    },
  ],
  note: null,
  evaluator: 'intake-order',
  current: null,
  moves: [],
};

function serveTest(response: IntakeTestResponse | { status: number; message: string }) {
  const bodies: unknown[] = [];
  server.use(
    http.post(`${PROJECT}/intake/test`, async ({ request }) => {
      bodies.push(await request.json());
      if ('status' in response) {
        return HttpResponse.json({ error: 'bad_request', message: response.message }, { status: response.status });
      }
      return HttpResponse.json(response);
    }),
  );
  return bodies;
}

function renderPanel(subject: string, onEditRule = vi.fn()) {
  renderWithProviders(
    <MemoryRouter>
      <TestPanel factoryId="fp-1" boardId="work" subject={subject} onEditRule={onEditRule} onClose={vi.fn()} />
    </MemoryRouter>,
  );
  return onEditRule;
}

describe('TestPanel', () => {
  it('given a URL, then it shows the item, where it lands and the rule that took it', async () => {
    const bodies = serveTest(routed);
    renderPanel(URL);

    expect(await screen.findByText('Goes to Work › intake')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crash on start' })).toHaveAttribute('href', URL);
    expect(screen.getByText('mastra-ai/mastra #12')).toBeInTheDocument();
    expect(bodies).toEqual([{ url: URL }]);
    const work = within(screen.getByRole('listitem', { name: 'Work' }));
    expect(work.getByText('Takes it')).toBeInTheDocument();
    expect(within(work.getByRole('listitem', { name: 'Everything else' })).getByText('yes')).toBeInTheDocument();
    const ship = within(screen.getByRole('listitem', { name: 'Ship' }));
    expect(ship.getByText('no, item.labels is bug, wanted contains ship')).toBeInTheDocument();
    expect(ship.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
  });

  it('given an item id, then it tests that item', async () => {
    const bodies = serveTest(routed);
    renderPanel(ITEM_ID);

    await screen.findByText('Goes to Work › intake');
    expect(bodies).toEqual([{ itemId: ITEM_ID }]);
  });

  it('given the server refuses, then it shows its message and which links it can test', async () => {
    serveTest({ status: 422, message: 'Paste a GitHub or GitLab issue or pull request URL, or pick a recent item.' });
    renderPanel('https://linear.app/acme/issue/ENG-1');

    expect(
      await screen.findByText('Paste a GitHub or GitLab issue or pull request URL, or pick a recent item.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Links from GitHub and GitLab repositories linked to this project/)).toBeInTheDocument();
  });

  it('when the pencil on the matched rule is pressed, then it opens that rule', async () => {
    serveTest(routed);
    const onEditRule = renderPanel(URL);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Everything else' }));
    expect(onEditRule).toHaveBeenCalledWith('everything');
  });

  it('given no board takes it, then it says it is not routed and why', async () => {
    serveTest({
      ...routed,
      placement: null,
      reason: 'No rule matched.',
      boards: [routed.boards[0], { boardKey: 'work', name: 'Work', rules: [] }],
    });
    renderPanel(URL);

    expect(await screen.findByText('Not routed. No rule matched.')).toBeInTheDocument();
    expect(
      within(screen.getByRole('listitem', { name: 'Work' })).getByText('No rule for new items'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Open / })).not.toBeInTheDocument();
  });
});
