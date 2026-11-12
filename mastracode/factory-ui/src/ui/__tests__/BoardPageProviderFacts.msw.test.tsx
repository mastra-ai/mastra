import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { listedRepository } from '../../../e2e/ui/factory-projects';
import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';
import { nativeFactsCard, providerFactsCard } from './fixtures/providerFactsCard';
import { stubWorkBoard } from './workBoardStubs';

describe('native card facts', () => {
  describe('when a label filter matches a persisted native card', () => {
    it.each(['board', 'list'])('keeps its label visible in the filtered %s', async layout => {
      stubWorkBoard();
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/work-items`, () =>
          HttpResponse.json({
            workItems: [
              nativeFactsCard,
              {
                ...providerFactsCard,
                metadata: { labels: ['docs'] },
                workItem: { ...providerFactsCard.workItem, labels: [] },
              },
            ],
          }),
        ),
      );
      const router = createMemoryRouter(createAppRoutes(), {
        initialEntries: [`/factories/fp-1/work?layout=${layout}&label=docs`],
      });
      renderWithProviders(<RouterProvider router={router} />);

      const card = await screen.findByTestId('work-item-card');
      expect(card).toHaveTextContent('Write the guide');
      expect(within(card).getByText('docs')).toBeVisible();
      expect(screen.queryByText('Repair source facts')).not.toBeInTheDocument();
    });
  });
});

it.each(['board', 'list'])(
  'shows source facts in %s and details without provider lookups beyond routine intake browsing',
  async layout => {
    const projectUrl = `${TEST_BASE_URL}/web/factory/projects/fp-1`;
    const providerRequests: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({
          projects: [
            {
              id: 'fp-1',
              name: 'Acme Factory',
              repositories: [listedRepository('repo-1', 'acme/app', { branch: 'main', sandboxWorkdir: '/repo' })],
            },
          ],
        }),
      ),
      http.get(`${projectUrl}/work-items`, () => HttpResponse.json({ workItems: [providerFactsCard] })),
      http.get(`${projectUrl}/sessions`, () => HttpResponse.json({ sessions: [] })),
      http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
        HttpResponse.json({ config: { github: { enabled: false }, linear: { enabled: false } } }),
      ),
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ enabled: false, connected: false, workspace: null }),
      ),
      http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
      http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/permissions`, () =>
        HttpResponse.json({ categories: {}, tools: {} }),
      ),
      // Routine intake browsing can fail; card facts must not trigger a detail lookup to recover.
      http.get(`${TEST_BASE_URL}/web/github/projects/:id/issues`, () =>
        HttpResponse.json({ error: 'Provider unavailable' }, { status: 503 }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/projects/:id/prs`, () =>
        HttpResponse.json({ error: 'Provider unavailable' }, { status: 503 }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/projects/*`, ({ request }) => {
        providerRequests.push(request.url);
        return HttpResponse.json({ error: 'Provider unavailable' }, { status: 503 });
      }),
    );
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/fp-1/work?layout=${layout}`] });
    const user = userEvent.setup();
    renderWithProviders(<RouterProvider router={router} />);

    const card = await screen.findByTestId('work-item-card');
    expect(card).toHaveTextContent('Repair source facts');
    expect(card).toHaveTextContent('acme/app#73');
    expect(card).toHaveTextContent('reporter');
    expect(within(card).getByLabelText('Source state: closed')).toBeVisible();
    expect(within(card).getByText('customer-visible')).toBeVisible();
    expect(card).not.toHaveTextContent('stale-author');
    expect(card).not.toHaveTextContent('stale-label');

    await user.click(within(card).getByRole('button', { name: 'Details for Repair source facts' }));
    const details = await screen.findByRole('dialog', { name: 'Repair source facts' });
    // The details show the reporter twice: in the source facts and as the card's latest activity.
    const sourceFacts = within(details)
      .getAllByText('reporter')
      .map(reporter => reporter.closest('[data-slot="metadata"]'))
      .filter(Boolean);
    expect(sourceFacts).toHaveLength(1);
    expect(sourceFacts[0]).toHaveTextContent('acme/app#73');
    expect(within(details).getByLabelText('Source state: closed')).toBeVisible();
    expect(within(details).getByText('customer-visible')).toBeVisible();
    expect(within(details).getByRole('link', { name: /^Open in GitHub/ })).toHaveAttribute(
      'href',
      providerFactsCard.workItem.url,
    );
    expect(providerRequests, JSON.stringify(providerRequests)).toEqual([]);
  },
);
