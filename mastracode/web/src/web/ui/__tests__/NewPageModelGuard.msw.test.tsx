/**
 * BDD coverage for the NewPage default-model guard: starting a chat requires
 * the active Factory to have a saved `defaultModelId`. Without one the
 * composer is replaced by an empty state pointing at Model settings; with one
 * (or when the project fetch fails — fail open) the composer renders.
 */
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import { createAppRoutes } from '../router';

function renderNewPage() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: ['/factories/fp-1/new'] });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

function stubFactory(project: Record<string, unknown> | null) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Mastra' }] }),
    ),
    project
      ? http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () => HttpResponse.json({ project }))
      : http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
          HttpResponse.json({ error: 'boom' }, { status: 500 }),
        ),
  );
}

describe('NewPage default-model guard', () => {
  it('replaces the composer with an empty state linking to Model settings when no default model is set', async () => {
    stubFactory({ id: 'fp-1', name: 'Mastra', defaultModelId: null });

    renderNewPage();

    expect(
      await screen.findByRole('heading', { name: 'No default model configured for this Factory' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Model settings' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/model',
    );
    expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'What do you want to work on?' })).not.toBeInTheDocument();
  });

  it('shows a spinner while the guard resolves instead of flashing the draft heading', async () => {
    let releaseProject!: () => void;
    const projectGate = new Promise<void>(resolve => {
      releaseProject = resolve;
    });
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Mastra' }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, async () => {
        await projectGate;
        return HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', defaultModelId: null } });
      }),
    );

    renderNewPage();

    expect(await screen.findByLabelText('Loading Factory')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'What do you want to work on?' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'No default model configured for this Factory' }),
    ).not.toBeInTheDocument();

    releaseProject();

    expect(
      await screen.findByRole('heading', { name: 'No default model configured for this Factory' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading Factory')).not.toBeInTheDocument();
  });

  it('renders the composer when the Factory has a default model', async () => {
    stubFactory({ id: 'fp-1', name: 'Mastra', defaultModelId: 'anthropic/claude-sonnet-4-5' });

    renderNewPage();

    expect(await screen.findByLabelText('Message')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'No default model configured for this Factory' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What do you want to work on?' })).toBeInTheDocument();
  });

  it('fails open: the composer renders when the factory project fetch errors', async () => {
    stubFactory(null);

    renderNewPage();

    expect(await screen.findByLabelText('Message')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'No default model configured for this Factory' }),
      ).not.toBeInTheDocument(),
    );
  });
});
