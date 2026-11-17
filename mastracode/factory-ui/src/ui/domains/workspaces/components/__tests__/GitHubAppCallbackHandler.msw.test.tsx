/**
 * BDD coverage for GitHub App callback notifications in the Factory UI.
 *
 * The callback arrives on the route GitHub redirects back to; this drives the
 * real router search params and toaster, with no component mocks.
 */
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { OnboardingPage } from '../../../../pages/OnboardingPage';
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

  it('given Platform refused the link with a known reason, when the settings page renders, then it keeps that reason up instead of a generic failure', async () => {
    const router = renderCallback(
      '/factories/fp-1/settings/repositories?github_app_error=github_app_installation_preexisting&keep=1',
    );

    expect(await screen.findByText(/choose Refresh accounts/)).toBeInTheDocument();
    expect(screen.queryByText('GitHub connection failed')).not.toBeInTheDocument();

    await waitFor(() => expect(router.state.location.search).toBe('?keep=1'));
  });

  it('given an unrecognised callback error, when the settings page renders, then it falls back to a generic failure', async () => {
    renderCallback('/factories/fp-1/settings/repositories?github_app_error=something_new');

    expect(await screen.findByText('GitHub connection failed')).toBeInTheDocument();
  });
});

describe('OnboardingPage GitHub callback', () => {
  function renderOnboarding(initialEntry: string) {
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, reason: 'not_connected' }),
      ),
    );
    const router = createMemoryRouter(
      [
        {
          path: '/onboarding',
          element: (
            <>
              <OnboardingPage />
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

  it('given the install callback returns to onboarding with a refusal, when onboarding renders, then it shows the reason in the Codebase section instead of a toast', async () => {
    const router = renderOnboarding('/onboarding?github_app_error=github_app_installation_preexisting');

    const codebase = await screen.findByRole('region', { name: 'Codebase' });
    expect(await within(codebase).findByText(/choose Refresh accounts/)).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(screen.getAllByText(/choose Refresh accounts/)).toHaveLength(1);

    // Dismissing clears the page-owned callback state; the host choices stay so the user can retry.
    await userEvent.click(within(codebase).getByRole('button', { name: 'Dismiss notice' }));
    expect(within(codebase).queryByText(/choose Refresh accounts/)).not.toBeInTheDocument();
    expect(within(codebase).getByRole('button', { name: /Connect GitHub/ })).toBeInTheDocument();
  });

  it('shows an approval request inline on onboarding', async () => {
    const router = renderOnboarding('/onboarding?github_app_requested=true');

    const codebase = await screen.findByRole('region', { name: 'Codebase' });
    expect(await within(codebase).findByText('GitHub App installation requested')).toBeInTheDocument();
    expect(within(codebase).getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(
      screen.queryByText(
        'GitHub App installation requested. An organization owner needs to approve it before repositories appear here.',
      ),
    ).not.toBeInTheDocument();
  });
});
