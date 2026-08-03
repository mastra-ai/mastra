import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { GithubStatus } from '../../../workspaces/services/github';
import { RepositoriesSection } from '../RepositoriesSection';

const FACTORY_ID = 'factory-1';
const STATUS_URL = `${TEST_BASE_URL}/web/github/status`;

function renderRepositoriesSection() {
  const router = createMemoryRouter(
    [{ path: '/factories/:factoryId/settings/repositories', element: <RepositoriesSection /> }],
    { initialEntries: [`/factories/${FACTORY_ID}/settings/repositories`] },
  );
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('RepositoriesSection GitHub installation health', () => {
  it('shows each broken installation with a reconnect action and clears recovered rows', async () => {
    let broken = true;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
        HttpResponse.json({ connections: [] }),
      ),
      http.get(STATUS_URL, () => {
        const status: GithubStatus = {
          enabled: true,
          sandboxEnabled: true,
          connected: false,
          installations: [],
          brokenInstallations: broken
            ? [
                {
                  installationId: 42,
                  accountLogin: 'acme',
                  accountType: 'Organization',
                  brokenAt: Date.UTC(2026, 7, 3),
                },
              ]
            : [],
        };
        return HttpResponse.json(status);
      }),
      http.get(`${TEST_BASE_URL}/web/github/pat`, () =>
        HttpResponse.json({ configured: false, reviewerConfigured: false }),
      ),
    );

    const { client } = renderRepositoriesSection();

    expect(await screen.findByText('@acme — installation removed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reconnect' })).toBeInTheDocument();

    broken = false;
    await client.invalidateQueries();

    await waitFor(() => expect(screen.queryByText('@acme — installation removed')).not.toBeInTheDocument());
  });
});
