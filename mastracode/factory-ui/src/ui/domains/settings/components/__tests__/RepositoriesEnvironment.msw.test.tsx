import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { FactoryEnvironmentPatch, FactoryEnvironmentPayload } from '../../../workspaces/services/environment';
import { RepositoriesSection } from '../RepositoriesSection';
import { environmentPayload, environmentRepository, FACTORY_ID } from './fixtures/environment';

const ENVIRONMENT_URL = `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/environment`;

function useFactory() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme' }] }),
    ),
  );
}

function useEnvironment(environment: FactoryEnvironmentPayload) {
  server.use(
    http.get(ENVIRONMENT_URL, () => HttpResponse.json({ environment })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            integrationId: 'github',
            installationId: 'inst-1',
            repositories: environment.repositories.map(repository => ({
              id: repository.projectRepositoryId,
              branch: repository.defaultBranch,
              sandboxWorkdir: '/workspace',
              repository: repository.slug
                ? {
                    externalId: repository.repositoryId,
                    slug: repository.slug,
                    defaultBranch: repository.defaultBranch,
                  }
                : null,
            })),
          },
        ],
      }),
    ),
  );
}

function recordPatches(environment: FactoryEnvironmentPayload) {
  const patches: FactoryEnvironmentPatch[] = [];
  server.use(
    http.patch<never, FactoryEnvironmentPatch>(ENVIRONMENT_URL, async ({ request }) => {
      patches.push(await request.json());
      return HttpResponse.json({ environment });
    }),
  );
  return patches;
}

function renderRepositoriesSettings() {
  renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/settings/repositories`]}>
      <Routes>
        <Route path="/factories/:factoryId/settings/repositories" element={<RepositoriesSection />} />
      </Routes>
      <Toaster position="bottom-right" />
    </MemoryRouter>,
  );
}

describe('Repository environment settings', () => {
  it('opens settings from the keyboard and explains pre-cloning without changing the selection', async () => {
    useFactory();
    useEnvironment(environmentPayload());
    const user = userEvent.setup();

    renderRepositoriesSettings();

    const disclosure = await screen.findByRole('button', { name: 'Show settings for acme/web' });
    expect(screen.queryByRole('switch', { name: 'Clone acme/web into every session' })).not.toBeInTheDocument();
    disclosure.focus();
    await user.keyboard('{Enter}');
    const clone = screen.getByRole('switch', { name: 'Clone acme/web into every session' });
    const info = screen.getByRole('button', { name: 'About pre-clone' });
    info.focus();
    expect(await screen.findByRole('tooltip')).toBeVisible();
    expect(clone).toBeChecked();
    await user.click(info);
    expect(clone).toBeChecked();
  });

  it('shows ordered live repositories, their commands and their last build failure', async () => {
    useFactory();
    useEnvironment(
      environmentPayload({
        repositories: [
          environmentRepository({
            projectRepositoryId: 'link-api',
            position: 2,
            lastBuildStatus: 'failed',
            lastBuildError: 'pnpm build exited with 1',
            setupCommand: 'pnpm build',
            inEnvironment: false,
          }),
          environmentRepository({ projectRepositoryId: 'link-web', position: 1, lastBuildStatus: 'configured' }),
          environmentRepository({ projectRepositoryId: 'link-gone', slug: null, position: 3, inEnvironment: false }),
        ],
      }),
    );

    renderRepositoriesSettings();

    await screen.findByRole('button', { name: 'Show settings for acme/link-web' });

    const names = screen.getAllByText(/^acme\//).map(node => node.textContent);
    expect(names).toEqual(['acme/link-web', 'acme/link-api']);
    expect(screen.queryByRole('switch', { name: /Clone .* into every session/ })).not.toBeInTheDocument();
    expect(screen.getByText('Last build failed')).toBeInTheDocument();
    expect(screen.getAllByText('Skipped')).toHaveLength(1);

    const user = userEvent.setup();
    expect(screen.queryByText('pnpm build exited with 1')).not.toBeInTheDocument();
    await user.click(screen.getByText('acme/link-api'));
    expect(screen.getByRole('switch', { name: 'Clone acme/link-api into every session' })).not.toBeChecked();
    expect(screen.getByText('pnpm build exited with 1')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Setup command for acme/link-api' })).toHaveValue('pnpm build');
  });

  it('offers a drag handle per live repository and none for a dead link', async () => {
    useFactory();
    useEnvironment(
      environmentPayload({
        repositories: [
          environmentRepository({ projectRepositoryId: 'link-web', position: 1 }),
          environmentRepository({ projectRepositoryId: 'link-api', position: 2 }),
          environmentRepository({ projectRepositoryId: 'link-gone', slug: null, position: 3 }),
        ],
      }),
    );

    renderRepositoriesSettings();

    expect(await screen.findByLabelText('Drag acme/link-web')).toBeInTheDocument();
    expect(screen.getByLabelText('Drag acme/link-api')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^Drag /)).toHaveLength(2);
  });

  it('removes a dead link whose repository is gone', async () => {
    useFactory();
    let environment = environmentPayload({
      repositories: [
        environmentRepository({ projectRepositoryId: 'link-web', position: 1 }),
        environmentRepository({ projectRepositoryId: 'link-gone', slug: null, position: 2 }),
      ],
    });
    useEnvironment(environment);
    const removals: string[] = [];
    server.use(
      http.get(ENVIRONMENT_URL, () => HttpResponse.json({ environment })),
      http.delete(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/repositories/:id`, ({ params }) => {
        removals.push(String(params.id));
        environment = {
          ...environment,
          repositories: environment.repositories.filter(repository => repository.projectRepositoryId !== params.id),
        };
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();

    renderRepositoriesSettings();

    const deadRow = await screen.findByRole('group', { name: 'Unavailable repository' });
    await user.click(within(deadRow).getByRole('button', { name: 'Remove Unavailable repository' }));

    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Unavailable repository' })).not.toBeInTheDocument(),
    );
    expect(removals).toEqual(['link-gone']);
    expect(screen.getByRole('group', { name: 'acme/link-web' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add repository' })).toHaveFocus());
  });

  it('toggles a repository out of the environment', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    const patches = recordPatches(environment);
    const user = userEvent.setup();

    renderRepositoriesSettings();

    await user.click(await screen.findByRole('button', { name: 'Show settings for acme/api' }));
    await user.click(screen.getByRole('switch', { name: 'Clone acme/api into every session' }));

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ repositories: [{ projectRepositoryId: 'link-api', inEnvironment: false }] });
  });

  it('keeps the controls usable while the environment refreshes after a save', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    const patches = recordPatches(environment);
    let environmentRequests = 0;
    let releaseRefresh!: () => void;
    const refreshPending = new Promise<void>(resolve => {
      releaseRefresh = resolve;
    });
    server.use(
      http.get(ENVIRONMENT_URL, async () => {
        environmentRequests++;
        if (environmentRequests > 1) await refreshPending;
        return HttpResponse.json({ environment });
      }),
    );
    const user = userEvent.setup();

    renderRepositoriesSettings();

    await user.click(await screen.findByRole('button', { name: 'Show settings for acme/api' }));
    await user.click(screen.getByRole('switch', { name: 'Clone acme/api into every session' }));
    await waitFor(() => expect(patches).toHaveLength(1));
    await waitFor(() => expect(environmentRequests).toBe(2));

    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Clone acme/api into every session' })).toBeEnabled(),
    );
    expect(screen.getByRole('button', { name: 'Remove acme/web' })).toBeEnabled();
    releaseRefresh();
  });

  it('saves only the changed setup command without overwriting another repository', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    const patches = recordPatches(environment);
    const user = userEvent.setup();

    renderRepositoriesSettings();

    await user.click(await screen.findByRole('button', { name: 'Show settings for acme/web' }));
    const input = screen.getByRole('textbox', { name: 'Setup command for acme/web' });
    await user.type(input, 'pnpm i{Enter}');

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ repositories: [{ projectRepositoryId: 'link-web', setupCommand: 'pnpm i' }] });
  });

  it('saves teardown without resending setup or another repository', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    const patches = recordPatches(environment);
    const user = userEvent.setup();

    renderRepositoriesSettings();

    await user.click(await screen.findByRole('button', { name: 'Show settings for acme/web' }));
    await user.type(screen.getByRole('textbox', { name: 'Teardown command for acme/web' }), 'make clean{Enter}');

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ repositories: [{ projectRepositoryId: 'link-web', teardownCommand: 'make clean' }] });
  });

  it('surfaces a failed save as a toast and shows the stored value again', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    server.use(http.patch(ENVIRONMENT_URL, () => HttpResponse.json({ error: 'nope' }, { status: 500 })));
    const user = userEvent.setup();

    renderRepositoriesSettings();

    await user.click(await screen.findByRole('button', { name: 'Show settings for acme/api' }));
    await user.click(screen.getByRole('switch', { name: 'Clone acme/api into every session' }));
    expect(await screen.findByText('Failed to save environment (500)')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Clone acme/api into every session' })).toBeChecked();
  });
});
