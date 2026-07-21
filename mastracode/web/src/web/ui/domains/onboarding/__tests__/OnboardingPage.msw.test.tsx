import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/web-ui/render';
import { OnboardingPage } from '../OnboardingPage';

const rootListing = {
  root: '/projects',
  path: '/projects',
  parent: null,
  entries: [{ name: 'alpha', path: '/projects/alpha' }],
};

function renderOnboarding() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/onboarding', element: <OnboardingPage /> },
      { path: '*', element: <div>Project opened</div> },
    ],
    { initialEntries: ['/onboarding'] },
  );
  renderWithProviders(<RouterProvider router={router} />, client);
  return router;
}

afterEach(() => localStorage.clear());

describe('OnboardingPage', () => {
  it('given onboarding opens, when GitHub configuration is unavailable, then the dashboard step is shown by default', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: false, connected: false, installations: [], reason: 'missing_config' }),
      ),
    );

    renderOnboarding();

    expect(await screen.findByRole('dialog', { name: 'Connect GitHub' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip and setup local project' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Set up a local project' })).not.toBeInTheDocument();
  });

  it('given the dashboard step, when local setup is skipped to, then the local directory step is shown', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: false, connected: false, installations: [], reason: 'missing_config' }),
      ),
      http.get(`${TEST_BASE_URL}/web/fs/list`, () => HttpResponse.json(rootListing)),
    );
    const user = userEvent.setup();
    renderOnboarding();

    await user.click(await screen.findByRole('button', { name: 'Skip and setup local project' }));

    expect(await screen.findByRole('heading', { name: 'Set up a local project' })).toBeInTheDocument();
    expect(await screen.findByText('alpha')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Connect GitHub' })).not.toBeInTheDocument();
  });

  it('given the local step, when a directory is selected, then the created Factory opens at its canonical local URL', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: false, connected: false, installations: [], reason: 'missing_config' }),
      ),
      http.get(`${TEST_BASE_URL}/web/fs/list`, () => HttpResponse.json(rootListing)),
      http.get(`${TEST_BASE_URL}/web/codebase/resolve`, () =>
        HttpResponse.json({
          resourceId: 'resource-alpha',
          name: 'alpha',
          rootPath: '/projects',
          gitBranch: 'main',
        }),
      ),
    );
    const user = userEvent.setup();
    const router = renderOnboarding();

    await user.click(await screen.findByRole('button', { name: 'Skip and setup local project' }));
    await user.click(await screen.findByRole('button', { name: 'Use this folder' }));

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/local\/[^/]+\/new$/));
    const factoryId = router.state.location.pathname.split('/')[2];
    expect(localStorage.getItem('mastracode-active-factory')).toBe(factoryId);
    expect(JSON.parse(localStorage.getItem('mastracode-factories') ?? '[]')).toEqual([
      expect.objectContaining({
        id: factoryId,
        name: 'projects',
        resourceId: 'resource-alpha',
        binding: expect.objectContaining({ kind: 'local', path: '/projects' }),
      }),
    ]);
  });
});
