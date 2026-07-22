/**
 * BDD coverage for GitHub App callback notifications in the Factory UI.
 *
 * The callback arrives on the route GitHub redirects back to; this drives the
 * real router search params and toaster, with no component mocks.
 */
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import { GitHubAppCallbackHandler } from '../../../workspaces/components/GitHubAppCallbackHandler';

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
      '/factories/fp-1/settings/source-control?github_app_requested=true&installation_id=123&setup_action=request&keep=1',
    );

    expect(
      await screen.findByText(
        'GitHub App installation requested. An organization owner needs to approve it before repositories appear here.',
      ),
    ).toBeInTheDocument();

    await waitFor(() => expect(router.state.location.search).toBe('?keep=1'));
  });
});
