/**
 * A board shows cards: work items read from the server and kept fresh over its stream. The server
 * files new issues and pull requests itself, through the intake rules, so the board never asks a
 * provider for its open issues or pull requests to show the ones with no card yet.
 */
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { recordProviderListRequests } from '../../../e2e/ui/provider-list-requests';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';
import { FACTORY_ID, stubWorkBoard, workItem } from './workBoardStubs';

/**
 * Opens the Work board of a project taking GitHub issues from its repository, holding `cards` in
 * Intake. Records every request for a provider's list, and every lookup of which provider items
 * already have a card.
 */
function openWorkBoard(cards: number) {
  const asked = { providerLists: recordProviderListRequests(), filedLookups: 0 };
  stubWorkBoard();
  server.use(
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: true, sourceIds: ['acme/app'] }, linear: { enabled: false, sourceIds: null } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/work-items`, ({ request }) => {
      if (new URL(request.url).searchParams.has('source')) asked.filedLookups += 1;
      return HttpResponse.json({
        workItems: Array.from({ length: cards }, (_, index) => ({
          ...workItem(`card-${index}`, `Card ${index}`, '2026-08-01T00:00:00.000Z', '2026-08-02T00:00:00.000Z'),
          stages: ['intake'],
          stageHistory: [{ stage: 'intake', enteredAt: '2026-08-02T00:00:00.000Z', by: 'user-1' }],
        })),
      });
    }),
  );
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  const { client } = renderWithProviders(<RouterProvider router={router} />);
  return { asked, client };
}

describe('The Work board of a project taking GitHub issues', () => {
  afterEach(() => vi.restoreAllMocks());

  it('when the board opens, then it shows its cards and asks no provider for a list', async () => {
    const { asked, client } = openWorkBoard(1);

    const intake = await screen.findByTestId('board-column-intake');
    expect(await within(intake).findByText('Card 0')).toBeInTheDocument();
    await waitForMutationsIdle(client);

    expect(screen.getByRole('button', { name: 'Intake, 1' })).toBeInTheDocument();
    expect(asked.providerLists).toEqual([]);
    expect(asked.filedLookups).toBe(0);
  });

  it('given a phase holding fewer cards than it lists at once, then it offers nothing more to load', async () => {
    const { client } = openWorkBoard(3);

    const intake = await screen.findByTestId('board-column-intake');
    expect(await within(intake).findByText('Card 2')).toBeInTheDocument();
    await waitForMutationsIdle(client);

    expect(screen.getByRole('button', { name: 'Intake, 3' })).toBeInTheDocument();
    expect(within(intake).queryByRole('button', { name: /^Load more/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Load more/ })).not.toBeInTheDocument();
  });
});
