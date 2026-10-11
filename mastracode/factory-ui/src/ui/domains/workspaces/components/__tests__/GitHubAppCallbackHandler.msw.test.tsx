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

import { renderWithProviders } from '../../../../../../e2e/ui/render';
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

  it('given Platform refused an install the GitHub account already had, when the settings page renders, then it says to link it from Platform Accounts', async () => {
    const router = renderCallback(
      '/factories/fp-1/settings/repositories?github_app_error=github_app_installation_preexisting&keep=1',
    );

    expect(
      await screen.findByText(
        'Your GitHub account already has the Mastra GitHub App installed, so this link didn’t connect it. In Mastra Platform, go to Accounts and choose Refresh accounts to link it to your organization, then come back here.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('GitHub connection failed')).not.toBeInTheDocument();

    await waitFor(() => expect(router.state.location.search).toBe('?keep=1'));
  });

  it.each([
    ['github_app_sign_in_required', 'Sign in to Mastra Platform in this browser, then connect GitHub again.'],
    [
      'github_app_session_mismatch',
      'This GitHub link was started for a different Mastra account or organization. Connect GitHub again from your own account.',
    ],
    [
      'github_app_person_not_platform_user',
      'This GitHub link was started for an account that isn’t a Mastra account. To link GitHub through Mastra Platform, sign in to Factory with Mastra.',
    ],
    [
      'github_app_installation_not_owned',
      'Only the owner of this GitHub account, or an owner of the GitHub organization, can link this installation.',
    ],
  ])(
    'given Platform refused the link with %s, when the settings page renders, then it shows that reason',
    async (code, message) => {
      renderCallback(`/factories/fp-1/settings/repositories?github_app_error=${code}`);

      expect(await screen.findByText(message)).toBeInTheDocument();
    },
  );

  it('given an unrecognised callback error, when the settings page renders, then it falls back to a generic failure', async () => {
    renderCallback('/factories/fp-1/settings/repositories?github_app_error=something_new');

    expect(await screen.findByText('GitHub connection failed')).toBeInTheDocument();
  });
});

describe('OnboardingPage GitHub callback', () => {
  it('given the install callback returns to onboarding with a refusal, when onboarding renders, then it shows the reason instead of landing silently', async () => {
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
      { initialEntries: ['/onboarding?github_app_error=github_app_installation_preexisting'] },
    );
    renderWithProviders(<RouterProvider router={router} />);

    expect(
      await screen.findByText(/In Mastra Platform, go to Accounts and choose Refresh accounts/),
    ).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });
});
