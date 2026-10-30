/**
 * The board syncs only open cards. Done reads its cards a page at a time from the
 * server, newest first, and shows the server's count for the whole column.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';
import { FACTORY_ID, stubWorkBoard, workItem } from './workBoardStubs';

function card(id: string, title: string, stage: string) {
  const base = workItem(id, title, '2026-08-01T00:00:00.000Z', '2026-08-02T00:00:00.000Z');
  return { ...base, stages: [stage], stageHistory: [{ stage, enteredAt: '2026-08-02T00:00:00.000Z', by: 'user-1' }] };
}

const donePages: Record<string, { workItems: ReturnType<typeof card>[]; nextCursor?: string }> = {
  first: { workItems: [card('done-1', 'Shipped login', 'done')], nextCursor: 'page-2' },
  'page-2': { workItems: [card('done-2', 'Shipped signup', 'done')] },
};

function stubArchive() {
  const archiveReads: { stage: string | null; cursor: string | null }[] = [];
  stubWorkBoard();
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/sync`, () =>
      HttpResponse.json({
        cursor: 'c1',
        reset: true,
        workItems: [card('open-1', 'Still triaging', 'triage')],
        deletedIds: [],
        counts: { total: 41, boards: { work: { triage: 1, done: 40 } } },
        runningSessionIds: [],
        parkedSessionIds: [],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      const stage = params.get('stage');
      const cursor = params.get('cursor');
      archiveReads.push({ stage, cursor });
      if (stage !== 'done') return HttpResponse.json({ workItems: [] });
      return HttpResponse.json(donePages[cursor ?? 'first']);
    }),
  );
  return archiveReads;
}

function renderWorkBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('Done column paging', () => {
  it('reads Done a page at a time and counts the whole column from the server', async () => {
    const archiveReads = stubArchive();
    const { client } = renderWorkBoard();

    const done = await screen.findByTestId('board-column-done');
    await waitFor(() => expect(within(done).getByText('Shipped login')).toBeInTheDocument());
    await waitForMutationsIdle(client);
    expect(within(done).queryByText('Shipped signup')).not.toBeInTheDocument();
    expect(screen.getByText('Still triaging')).toBeInTheDocument();
    expect(within(done).getByText('40')).toBeInTheDocument();
    expect(archiveReads.filter(read => read.stage === 'done')).toEqual([{ stage: 'done', cursor: null }]);

    await userEvent.click(within(done).getByRole('button', { name: 'Load more Done cards' }));
    await waitFor(() => expect(within(done).getByText('Shipped signup')).toBeInTheDocument());
    expect(archiveReads.filter(read => read.stage === 'done')).toEqual([
      { stage: 'done', cursor: null },
      { stage: 'done', cursor: 'page-2' },
    ]);
    expect(within(done).queryByRole('button', { name: 'Load more Done cards' })).not.toBeInTheDocument();
  });
});
