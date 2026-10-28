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
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { OnboardingPage } from '../../../../pages/OnboardingPage';
import type { GithubStatus } from '../../services/github';
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

  it('given Platform refused an install the GitHub account already had, when the settings page renders, then it says to reinstall the app', async () => {
    const router = renderCallback(
      '/factories/fp-1/settings/repositories?github_app_error=github_app_installation_preexisting&keep=1',
    );

    expect(
      await screen.findByText(
        'Your GitHub account already had the Mastra GitHub App installed before you clicked Connect GitHub, so this link didn’t connect it. Uninstall the Mastra GitHub App from that GitHub account or organization, then choose Connect GitHub again.',
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
      'github_app_link_already_used',
      'This GitHub link was already used. If you just finished connecting GitHub, you’re all set; otherwise connect GitHub again.',
    ],
    [
      'github_app_user_authorization_required',
      'Mastra Platform needs you to authorize the GitHub App with your GitHub account to link this installation. Connect GitHub again and approve the authorization step.',
    ],
    [
      'github_app_installation_not_owned',
      'Only the owner of this GitHub account, or an owner of the GitHub organization, can link this installation.',
    ],
    [
      'github_app_link_not_started_here',
      'This GitHub link was opened in a different browser, or opened directly instead of from Factory. Go back to Factory and choose Connect GitHub to start it again.',
    ],
    [
      'github_app_connection_mismatch',
      'Your Mastra account is already connected to a different GitHub account. Disconnect that GitHub account in Mastra Platform first, then connect GitHub here again.',
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

  it('given the install landed on a personal GitHub account the platform hides, when the settings page renders, then it explains instead of reporting success', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({
          enabled: true,
          connected: false,
          installations: [],
          reason: 'personal_install_hidden',
          hiddenPersonalInstallReason: 'personal_install_requires_single_member_org',
        } satisfies GithubStatus),
      ),
    );
    renderCallback('/factories/fp-1/settings/repositories?github_app_installed=true&installation_id=123');

    expect(await screen.findByText(/installed on a personal GitHub account/)).toBeInTheDocument();
    expect(screen.queryByText('GitHub App installed')).not.toBeInTheDocument();
  });

  it('given the linker shared their personal GitHub account install, when the factory page returns, then it refetches GitHub status and confirms', async () => {
    let statusRequests = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () => {
        statusRequests += 1;
        return HttpResponse.json({
          enabled: true,
          connected: true,
          installations: [{ installationId: 9, accountLogin: 'ada', accountType: 'User' }],
          reason: 'ready',
        } satisfies GithubStatus);
      }),
    );
    const router = renderCallback(
      '/factories/fp-1/settings/repositories?github_app_share=granted&installation_id=9&keep=1',
    );

    expect(await screen.findByText('GitHub App shared with this factory')).toBeInTheDocument();
    expect(statusRequests).toBeGreaterThan(0);
    await waitFor(() => expect(router.state.location.search).toBe('?keep=1'));
  });

  it('given the linker declined to share, when the factory page returns, then it says nothing was shared', async () => {
    const router = renderCallback('/factories/fp-1/settings/repositories?github_app_share=declined');

    expect(await screen.findByText('The GitHub App was not shared with this factory.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe(''));
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
      await screen.findByText(/Uninstall the Mastra GitHub App from that GitHub account or organization/),
    ).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });
});
