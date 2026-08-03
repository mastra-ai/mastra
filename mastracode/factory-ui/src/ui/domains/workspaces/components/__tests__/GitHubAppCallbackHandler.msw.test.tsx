/**
 * BDD coverage for GitHub App callback notifications in the Factory UI.
 *
 * The callback arrives on the route GitHub redirects back to; this drives the
 * real router search params and toaster, with no component mocks.
 */
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { GitHubAppCallbackHandler } from '../GitHubAppCallbackHandler';

function renderCallback(initialEntry: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/factories/:factoryId/settings/:section',
        element: (
          <>
            <GitHubAppCallbackHandler />
            <div>Source control settings</div>
            <Toaster position="bottom-right" />
          </>
        ),
      },
    ],
    { initialEntries: [initialEntry] },
  );
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

describe('GitHubAppCallbackHandler', () => {
  it('given a GitHub App approval-request callback, when the settings page renders, then it explains the install is pending and cleans callback params', async () => {
    const router = renderCallback(
      '/factories/fp-1/settings/repositories?github_app_requested=true&installation_id=123&setup_action=request&keep=1',
    );

    expect(
      await screen.findByText(
        'GitHub App installation requested. An organization owner needs to approve it before repositories appear here.',
      ),
    ).toBeInTheDocument();

    await waitFor(() => expect(router.state.location.search).toBe('?keep=1'));
  });

  it('given a completed installation callback, confirms that installation before refreshing connection state', async () => {
    let reconnectInstallation: string | null = null;
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/repos`, ({ request }) => {
        reconnectInstallation = request.headers.get('x-mastra-github-reconnect-installation');
        return HttpResponse.json({ repos: [] });
      }),
    );

    const router = renderCallback(
      '/factories/fp-1/settings/repositories?github_app_installed=true&installation_id=123&setup_action=update&keep=1',
    );

    expect(await screen.findByText('GitHub App installed')).toBeInTheDocument();
    await waitFor(() => expect(reconnectInstallation).toBe('123'));
    await waitFor(() => expect(router.state.location.search).toBe('?keep=1'));
  });
});
