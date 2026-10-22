import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';

function renderNewPage() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: ['/factories/fp-1/new'] });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

function stubFactoryShell() {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Mastra' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/work-items`, () => HttpResponse.json({ workItems: [] })),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/fp-1/permissions`, () =>
      HttpResponse.json({ categories: {}, tools: {} }),
    ),
  );
}

function stubFactory(project: Record<string, unknown> | null) {
  stubFactoryShell();
  server.use(
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
    expect(screen.getByRole('link', { name: 'Open Models settings' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/models#factory-defaults',
    );
    expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'What do you want to work on?' })).not.toBeInTheDocument();
  });

  it('renders a usable composer while the guard resolves, then swaps in the guard', async () => {
    let releaseProject = () => {};
    const projectGate = new Promise<void>(resolve => {
      releaseProject = resolve;
    });
    stubFactoryShell();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, async () => {
        await projectGate;
        return HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', defaultModelId: null } });
      }),
    );

    renderNewPage();

    expect(await screen.findByRole('heading', { name: 'What do you want to work on?' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Message')).toBeInTheDocument();

    releaseProject();

    expect(
      await screen.findByRole('heading', { name: 'No default model configured for this Factory' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
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

  it('fails open with a visible error when the factory project fetch errors', async () => {
    stubFactory(null);

    renderNewPage();

    expect(await screen.findByLabelText('Message')).toBeInTheDocument();
    expect(await screen.findByText(/Failed to load session configuration/)).toBeInTheDocument();
  });
});

describe('NewPage credential guard', () => {
  it('asks for a personal key when a chat that runs on personal credentials is missing one, since an org key cannot unblock it', async () => {
    stubFactory({ id: 'fp-1', name: 'Mastra', defaultModelId: 'anthropic/claude-sonnet-4-5' });
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
        HttpResponse.json({ providers: [{ provider: 'anthropic', source: 'none', orgKey: false }] }),
      ),
    );

    renderNewPage();

    expect(await screen.findByRole('heading', { name: "You don't have access to Anthropic" })).toBeInTheDocument();
    expect(
      screen.getByText(
        'The Factory default model (anthropic/claude-sonnet-4-5) needs a credential for Anthropic. Add your own key for Anthropic under Personal defaults in Models settings.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/org admin/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Models settings' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/models#personal-defaults',
    );
    expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
  });

  it('asks an org admin for a Factory-defaults key when chats in a Factory-routed Factory are missing a credential', async () => {
    stubFactory({ id: 'fp-1', name: 'Mastra', modelScope: 'factory', defaultModelId: 'anthropic/claude-sonnet-4-5' });
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
        HttpResponse.json({ providers: [{ provider: 'anthropic', source: 'none', orgKey: false }] }),
      ),
    );

    renderNewPage();

    expect(await screen.findByRole('link', { name: 'Open Models settings' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/models#factory-defaults',
    );
    expect(
      screen.getByText(
        'The Factory default model (anthropic/claude-sonnet-4-5) needs a credential for Anthropic. Ask an org admin to add one under Factory defaults in Models settings.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Add your own key/)).not.toBeInTheDocument();
  });

  it('renders the composer when the caller has a shared org credential for the default model provider', async () => {
    stubFactory({ id: 'fp-1', name: 'Mastra', defaultModelId: 'anthropic/claude-sonnet-4-5' });
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
        HttpResponse.json({ providers: [{ provider: 'anthropic', source: 'stored-org', orgKey: true }] }),
      ),
    );

    renderNewPage();

    expect(await screen.findByLabelText('Message')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: "You don't have access to Anthropic" })).not.toBeInTheDocument();
  });

  it('fails open for providers not in the catalog (custom providers manage keys separately)', async () => {
    stubFactory({ id: 'fp-1', name: 'Mastra', defaultModelId: 'my-custom/self-hosted-model' });
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
        HttpResponse.json({ providers: [{ provider: 'anthropic', source: 'none' }] }),
      ),
    );

    renderNewPage();

    expect(await screen.findByLabelText('Message')).toBeInTheDocument();
  });
});
