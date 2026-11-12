/**
 * Work reads the records with no card yet from the server, in the same shape for every
 * provider. Opening it asks no provider for a list, and a record whose card the board already
 * shows is not offered a second time while the two reads disagree.
 */
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, onTestFinished } from 'vitest';

import { listedRepository } from '../../../e2e/ui/factory-projects';
import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import type { IntakeCandidateInfo } from '../../api/types';
import { createAppRoutes } from '../router';
import { githubIssueRecord, intakeCandidatesHandler } from './fixtures/intakeCandidates';
import { FACTORY_ID, REPO_ID, workItem } from './workBoardStubs';

/** Every route that lists a provider's open issues or pull requests. */
const PROVIDER_LIST = /^\/web\/(github|gitlab|linear|jira|incidentio|intake)\/(.*\/)?(issues|prs|items)$/;

/** The paths the page asked for. */
function recordRequests() {
  const paths: string[] = [];
  const listener = ({ request }: { request: Request }) => {
    paths.push(new URL(request.url).pathname);
  };
  server.events.on('request:start', listener);
  onTestFinished(() => server.events.removeListener('request:start', listener));
  return paths;
}

/** Stubs Work with GitHub intake on, the cards the server holds and the records it has no card for. */
function stubWork(cards: unknown[], records: IntakeCandidateInfo[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          {
            id: FACTORY_ID,
            name: 'Acme Factory',
            repositories: [listedRepository(REPO_ID, 'acme/app', { branch: 'main', sandboxWorkdir: '/repo' })],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: cards }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
      HttpResponse.json({ decisions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: true, sourceIds: ['acme/app'] }, linear: { enabled: false, sourceIds: null } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    intakeCandidatesHandler(TEST_BASE_URL, records),
  );
}

function renderWork() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('Opening Work with records that have no card yet', () => {
  it('lists them without asking any provider for its issues or pull requests', async () => {
    const paths = recordRequests();
    stubWork([], [githubIssueRecord(7, { title: 'Fix login' })]);
    const { client } = renderWork();

    const intake = await screen.findByTestId('board-column-intake');
    expect(await within(intake).findByText('Fix login')).toBeInTheDocument();
    await waitForMutationsIdle(client);

    expect(paths.filter(path => path.endsWith('/intake/candidates'))).not.toEqual([]);
    expect(paths.filter(path => PROVIDER_LIST.test(path))).toEqual([]);
  });

  it('shows a record once, as its card, when the list still holds it after the card was filed', async () => {
    const record = githubIssueRecord(7, { title: 'Fix login' });
    const card = {
      ...workItem('card-7', 'Fix login', '2026-08-01T00:00:00.000Z', '2026-08-02T00:00:00.000Z'),
      externalSource: record.externalSource,
    };
    stubWork([card], [record, githubIssueRecord(8, { title: 'Fix signup' })]);
    const { client } = renderWork();

    const intake = await screen.findByTestId('board-column-intake');
    expect(await within(intake).findByText('Fix signup')).toBeInTheDocument();
    await waitForMutationsIdle(client);

    expect(screen.getAllByText('Fix login')).toHaveLength(1);
    expect(within(screen.getByTestId('work-item-card')).getByText('Fix login')).toBeInTheDocument();
    expect(screen.getAllByTestId('candidate-card')).toHaveLength(1);
  });
});
