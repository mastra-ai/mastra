import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { GithubRepo, FactoryProjectPayload } from '../../services/github';
import type { GitLabProject } from '../../../factory/services/gitlab';
import {
  ONBOARDING_FACTORY_KEY,
  ONBOARDING_DRAFT_KEY,
  ONBOARDING_STEP_KEY,
  persistOnboardingDraft,
  readOnboardingDraft,
} from '../../services/onboardingFlow';
import { EmptyFactoryState } from '../EmptyFactoryState';

const repo: GithubRepo = {
  id: 99,
  fullName: 'octo/hello',
  name: 'hello',
  owner: 'octo',
  defaultBranch: 'main',
  private: false,
  installationId: 7,
  installationStorageId: 'inst-7',
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/hello',
};
const otherRepo: GithubRepo = { ...repo, id: 100, fullName: 'octo/other', name: 'other', defaultBranch: 'develop' };
const thirdRepo: GithubRepo = { ...repo, id: 101, fullName: 'octo/third', name: 'third' };
const gitlabProject: GitLabProject = {
  id: 'gitlab-source',
  name: 'backend',
  projectId: '42',
  projectPath: 'team/backend',
  installationStorageId: 'gitlab-inst',
  defaultBranch: 'develop',
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/backend',
};
const model = { providerId: 'openai', modelId: 'openai/gpt-5.6-sol', method: 'api_key' as const };

function renderOnboarding() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<EmptyFactoryState />} />
        <Route path="/factories/:id" element={<h1>Factory ready</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

function registerSetup(failure?: 'connection' | 'intake' | 'model') {
  const writes: { path: string; body: unknown }[] = [];
  let project: FactoryProjectPayload | undefined;
  let failed = false;
  server.use(
    http.put(`${TEST_BASE_URL}/web/config/default-model`, async ({ request }) => {
      const body = await request.json();
      writes.push({ path: 'personal-model', body });
      return HttpResponse.json({ ok: true });
    }),
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/status`, () =>
      HttpResponse.json({ enabled: true, connected: true, reason: 'ready', installations: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [repo, otherRepo] })),
    http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
      HttpResponse.json({ enabled: true, configured: true, reauthRequired: false }),
    ),
    http.get(`${TEST_BASE_URL}/web/gitlab/projects`, () => HttpResponse.json({ projects: [gitlabProject] })),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, reason: 'missing_config' }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
      HttpResponse.json({
        orgKeyAdmin: true,
        providers: [
          { provider: 'openai', source: 'stored-org', orgCredential: 'api_key' },
          { provider: 'anthropic', source: 'stored-org', orgCredential: 'api_key' },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/models`, () =>
      HttpResponse.json({
        models: [
          { id: model.modelId, provider: 'openai', modelName: 'gpt-5.6-sol', hasApiKey: true },
          { id: 'anthropic/claude-fable-5', provider: 'anthropic', modelName: 'claude-fable-5', hasApiKey: true },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: project ? [project] : [] })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
      project ? HttpResponse.json({ project }) : HttpResponse.json({ error: 'not_found' }, { status: 404 }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
      HttpResponse.json({ connections: [] }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects`, async ({ request }) => {
      const body = await request.json();
      writes.push({ path: 'create', body });
      const input = z.object({ modelScope: z.enum(['factory', 'user', 'hybrid']).optional() }).parse(body);
      project = { id: 'fp-1', name: 'hello', modelScope: input.modelScope ?? 'hybrid' };
      return HttpResponse.json({ project });
    }),
    http.delete(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () => {
      writes.push({ path: 'delete', body: { id: 'fp-1' } });
      project = undefined;
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(`${TEST_BASE_URL}/web/gitlab/projects/registration`, async ({ request }) => {
      writes.push({ path: 'registration', body: await request.json() });
      return HttpResponse.json({ project: gitlabProject });
    }),
    http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, async ({ request }) => {
      writes.push({ path: 'connection', body: await request.json() });
      if (failure === 'connection' && !failed) {
        failed = true;
        return HttpResponse.json({ error: 'unavailable' }, { status: 502 });
      }
      return HttpResponse.json({ connection: { id: 'conn-1' } });
    }),
    http.post(
      `${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections/conn-1/repositories`,
      async ({ request }) => {
        writes.push({ path: 'repository', body: await request.json() });
        return HttpResponse.json({
          projectRepository: {
            id: 'link-1',
            branch: 'main',
            sandboxWorkdir: '/workspace/hello',
            repository: { slug: 'octo/hello', externalId: '99', defaultBranch: 'main' },
          },
        });
      },
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () => HttpResponse.json({ config: {} })),
    http.put(`${TEST_BASE_URL}/web/intake/config`, async ({ request }) => {
      const body = await request.json();
      writes.push({ path: 'intake', body });
      if (failure === 'intake' && !failed) {
        failed = true;
        return HttpResponse.json({ error: 'unavailable' }, { status: 502 });
      }
      return HttpResponse.json({ config: body });
    }),
    http.patch(`${TEST_BASE_URL}/web/factory/projects/fp-1`, async ({ request }) => {
      writes.push({ path: 'model', body: await request.json() });
      if (failure === 'model' && !failed) {
        failed = true;
        return HttpResponse.json({ error: 'unavailable' }, { status: 502 });
      }
      return HttpResponse.json({ project });
    }),
    http.post(`${TEST_BASE_URL}/web/config/om/provider-defaults`, async ({ request }) => {
      writes.push({ path: 'om', body: await request.json() });
      return HttpResponse.json({ error: 'Removed endpoint' }, { status: 404 });
    }),
  );
  return writes;
}

beforeEach(() => sessionStorage.clear());
afterEach(() => sessionStorage.clear());

describe('Draft Factory onboarding', () => {
  it('lets users change repository, VCS and model, then commits only the reviewed choices', async () => {
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'vcs');
    const writes = registerSetup();
    const user = userEvent.setup();
    renderOnboarding();
    await user.hover(await screen.findByRole('radio', { name: 'octo/hello' }));
    expect(within(screen.getByLabelText('Codebase preview')).getByText('octo/hello')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'octo/hello' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Go back to previous step' }));
    expect(await screen.findByRole('radio', { name: 'octo/hello' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'octo/other' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }));
    await user.click(await screen.findByRole('button', { name: 'OpenAI' }));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Review setup' }));
    expect(await screen.findByRole('heading', { name: 'Ready to create.' })).toBeInTheDocument();
    expect(writes).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Edit codebase' }));
    expect(await screen.findByRole('radio', { name: 'octo/other' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Change provider' }));
    await user.click(screen.getByRole('button', { name: 'Continue with GitLab' }));
    await user.click(await screen.findByRole('radio', { name: 'team/backend' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const review = within(await screen.findByRole('region', { name: 'Review factory setup' }));
    expect(review.getByText('team/backend')).toBeInTheDocument();
    expect(review.getByText('GitLab · develop')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit model' }));
    expect(await screen.findByRole('combobox')).toHaveTextContent('GPT-5.6 Sol');
    await user.click(screen.getByRole('button', { name: 'Change provider' }));
    await user.click(await screen.findByRole('button', { name: 'Anthropic' }));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(writes).toEqual([]);
    expect(readOnboardingDraft().model?.providerId).toBe('anthropic');
    await user.click(screen.getByRole('button', { name: 'Create factory' }));
    expect(await screen.findByRole('heading', { name: 'Factory ready' })).toBeInTheDocument();
    expect(writes.filter(item => item.path === 'create')).toEqual([{ path: 'create', body: { name: 'backend' } }]);
    expect(writes.find(item => item.path === 'registration')?.body).toEqual({ sourceId: 'gitlab-source' });
    expect(writes.find(item => item.path === 'connection')?.body).toEqual({
      installationId: 'gitlab-inst',
      integrationId: 'gitlab',
    });
    expect(writes.find(item => item.path === 'repository')?.body).toMatchObject({
      repository: { externalId: '42', slug: 'team/backend' },
      branch: 'develop',
    });
    expect(writes.find(item => item.path === 'model')?.body).toEqual({ defaultModelId: 'anthropic/claude-fable-5' });
    expect(readOnboardingDraft()).toEqual({});
    expect(sessionStorage.getItem(ONBOARDING_FACTORY_KEY)).toBeNull();
  }, 20_000);

  it('restores repository and model choices after a redirect or reload without writing them', async () => {
    const writes = registerSetup();
    persistOnboardingDraft({ repository: otherRepo, model });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'model-provider');
    const view = renderOnboarding();
    expect(await screen.findByRole('combobox')).toHaveTextContent('GPT-5.6 Sol');
    view.unmount();
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'vcs');
    renderOnboarding();
    expect(await screen.findByRole('radio', { name: 'octo/other' })).toBeChecked();
    expect(writes).toEqual([]);
  });

  it('returns directly to review after reloading an edited step', async () => {
    const writes = registerSetup();
    persistOnboardingDraft({ repository: repo, model });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');
    const user = userEvent.setup();
    const view = renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'Edit codebase' }));
    view.unmount();
    renderOnboarding();
    await user.click(await screen.findByRole('radio', { name: 'octo/other' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Ready to create.' })).toBeInTheDocument();
    expect(readOnboardingDraft().repository?.fullName).toBe('octo/other');
    expect(writes).toEqual([]);
  });

  it.each(['connection', 'model'] as const)(
    'reuses the pending Factory after a failed final %s save and reload',
    async failure => {
      const writes = registerSetup(failure);
      persistOnboardingDraft({ repository: repo, model });
      sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');
      const user = userEvent.setup();
      const view = renderOnboarding();
      await user.click(await screen.findByRole('button', { name: 'Create factory' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('502');
      expect(sessionStorage.getItem(ONBOARDING_FACTORY_KEY)).toBe('fp-1');
      view.unmount();
      renderOnboarding();
      await user.click(await screen.findByRole('button', { name: 'Create factory' }));
      expect(await screen.findByRole('heading', { name: 'Factory ready' })).toBeInTheDocument();
      await waitFor(() => expect(writes.filter(item => item.path === 'create')).toHaveLength(1));
    },
  );

  it.each(['user', 'hybrid'] as const)(
    'recreates a pending Factory when a failed setup is retried in %s scope',
    async desiredScope => {
      const writes = registerSetup('model');
      persistOnboardingDraft({
        repository: repo,
        ...(desiredScope === 'user' ? { model } : { personal: model }),
      });
      sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');
      const user = userEvent.setup();
      const view = renderOnboarding();
      await user.click(await screen.findByRole('button', { name: 'Create factory' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('502');
      expect(sessionStorage.getItem(ONBOARDING_FACTORY_KEY)).toBe('fp-1');
      view.unmount();
      persistOnboardingDraft({
        repository: repo,
        ...(desiredScope === 'user' ? { personal: model } : { model }),
      });
      renderOnboarding();
      await user.click(await screen.findByRole('button', { name: 'Create factory' }));
      expect(await screen.findByRole('heading', { name: 'Factory ready' })).toBeInTheDocument();
      expect(writes.filter(item => item.path === 'delete')).toEqual([{ path: 'delete', body: { id: 'fp-1' } }]);
      expect(writes.filter(item => item.path === 'create')).toEqual([
        { path: 'create', body: { name: 'hello', ...(desiredScope === 'hybrid' ? { modelScope: 'user' } : {}) } },
        { path: 'create', body: { name: 'hello', ...(desiredScope === 'user' ? { modelScope: 'user' } : {}) } },
      ]);
      expect(
        writes
          .filter(item => item.path === 'model')
          .every(item => !z.object({ modelScope: z.unknown().optional() }).parse(item.body).modelScope),
      ).toBe(true);
    },
  );

  it('creates a new Factory when the pending one is no longer accessible', async () => {
    const writes = registerSetup();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-gone`, () =>
        HttpResponse.json({ error: 'forbidden' }, { status: 403 }),
      ),
    );
    persistOnboardingDraft({ repository: repo, model });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');
    sessionStorage.setItem(ONBOARDING_FACTORY_KEY, 'fp-gone');
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'Create factory' }));
    expect(await screen.findByRole('heading', { name: 'Factory ready' })).toBeInTheDocument();
    expect(writes.filter(item => item.path === 'create')).toHaveLength(1);
  });

  it.each(['intake', 'model'] as const)(
    'replaces only its own repository link when the codebase changes after a failed %s save',
    async failure => {
      const writes = registerSetup(failure);
      const links: { id: string; repository: { slug: string; externalId: string; defaultBranch: string } }[] = [];
      server.use(
        http.post(
          `${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections/conn-1/repositories`,
          async ({ request }) => {
            const body = (await request.json()) as { repository: { slug: string; externalId: string } };
            const link = {
              id: `link-${body.repository.externalId}`,
              repository: { ...body.repository, defaultBranch: 'main' },
            };
            if (!links.some(existing => existing.id === link.id)) links.push(link);
            return HttpResponse.json({ projectRepository: { ...link, branch: 'main', sandboxWorkdir: '/workspace' } });
          },
        ),
        http.delete(`${TEST_BASE_URL}/web/factory/projects/fp-1/repositories/:linkId`, ({ params }) => {
          writes.push({ path: 'unlink', body: params.linkId });
          links.splice(
            links.findIndex(link => link.id === params.linkId),
            1,
          );
          return HttpResponse.json({ ok: true });
        }),
      );
      persistOnboardingDraft({ repository: repo, model });
      sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');
      const user = userEvent.setup();
      renderOnboarding();
      await user.click(await screen.findByRole('button', { name: 'Create factory' }));
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      links.push({
        id: 'link-teammate',
        repository: { slug: 'octo/teammate', externalId: '7', defaultBranch: 'main' },
      });
      await user.click(screen.getByRole('button', { name: 'Edit codebase' }));
      await user.click(await screen.findByRole('radio', { name: 'octo/other' }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      await user.click(await screen.findByRole('button', { name: 'Create factory' }));

      expect(await screen.findByRole('heading', { name: 'Factory ready' })).toBeInTheDocument();
      expect(writes.filter(item => item.path === 'create')).toHaveLength(1);
      expect(writes.filter(item => item.path === 'unlink')).toEqual([{ path: 'unlink', body: 'link-99' }]);
      expect(writes.filter(item => item.path === 'model').map(item => item.body)).toContainEqual({ name: 'other' });
      expect(links.map(link => link.repository.slug)).toEqual(['octo/teammate', 'octo/other']);
    },
  );

  it.each([thirdRepo, repo])(
    'removes superseded links after a failed cleanup, reload, and change to $fullName',
    async finalRepo => {
      const writes = registerSetup('model');
      const repositories = [repo, otherRepo, thirdRepo];
      const teammateRepo: GithubRepo = { ...repo, id: 7, name: 'teammate', fullName: 'octo/teammate' };
      const links = new Map<string, GithubRepo>([['link-teammate', teammateRepo]]);
      let cleanupFailed = false;
      server.use(
        http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: repositories })),
        http.post(
          `${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections/conn-1/repositories`,
          async ({ request }) => {
            const body = z.object({ repository: z.object({ externalId: z.string() }) }).parse(await request.json());
            const selected = repositories.find(item => String(item.id) === body.repository.externalId);
            if (!selected) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
            const id = `link-${selected.id}`;
            links.set(id, selected);
            return HttpResponse.json({
              projectRepository: {
                id,
                branch: selected.defaultBranch,
                sandboxWorkdir: selected.sandboxWorkdir,
                repository: {
                  slug: selected.fullName,
                  externalId: String(selected.id),
                  defaultBranch: selected.defaultBranch,
                },
              },
            });
          },
        ),
        http.delete(`${TEST_BASE_URL}/web/factory/projects/fp-1/repositories/:linkId`, ({ params }) => {
          writes.push({ path: 'unlink', body: params.linkId });
          if (!cleanupFailed) {
            cleanupFailed = true;
            return HttpResponse.json({ error: 'unavailable' }, { status: 502 });
          }
          links.delete(String(params.linkId));
          return HttpResponse.json({ ok: true });
        }),
      );
      persistOnboardingDraft({ repository: repo, model });
      sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');
      const user = userEvent.setup();
      const view = renderOnboarding();
      await user.click(await screen.findByRole('button', { name: 'Create factory' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('502');

      await user.click(screen.getByRole('button', { name: 'Edit codebase' }));
      await user.click(await screen.findByRole('radio', { name: otherRepo.fullName }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      await user.click(await screen.findByRole('button', { name: 'Create factory' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Failed to unlink repository (502)');
      expect([...links.keys()]).toEqual(['link-teammate', 'link-99', 'link-100']);

      view.unmount();
      renderOnboarding();
      await user.click(await screen.findByRole('button', { name: 'Edit codebase' }));
      await user.click(await screen.findByRole('radio', { name: finalRepo.fullName }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      await user.click(await screen.findByRole('button', { name: 'Create factory' }));
      expect(await screen.findByRole('heading', { name: 'Factory ready' })).toBeInTheDocument();
      expect(writes.filter(item => item.path === 'create')).toHaveLength(1);
      expect([...links.values()].map(item => item.fullName)).toEqual(['octo/teammate', finalRepo.fullName]);
    },
  );

  it('refuses to create a Factory whose model is no longer available', async () => {
    const writes = registerSetup();
    persistOnboardingDraft({ repository: repo, model: { ...model, modelId: 'openai/retired-model' } });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'Create factory' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('openai/retired-model is no longer available');
    expect(writes).toEqual([]);
  });
});

describe('Personal Factory model', () => {
  it('requires a personal model when shared access is no longer available while editing review', async () => {
    const writes = registerSetup();
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
        HttpResponse.json({
          orgKeyAdmin: false,
          providers: [{ provider: 'anthropic', source: 'stored-user', userCredential: 'api_key' }],
        }),
      ),
    );
    persistOnboardingDraft({ repository: repo, model });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(screen.getByRole('button', { name: 'Edit model' }));
    await user.click(await screen.findByRole('button', { name: 'Continue with personal access' }));
    expect(screen.getByRole('heading', { name: 'Choose your model.' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create factory' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review setup' })).not.toBeInTheDocument();
    expect(writes).toEqual([]);
    await user.click(await screen.findByRole('button', { name: 'Anthropic' }));
    await user.click(await screen.findByRole('button', { name: 'Review setup' }));
    expect(
      within(screen.getByRole('region', { name: 'Review factory setup' })).getByText('anthropic/claude-fable-5'),
    ).toBeInTheDocument();
  });

  it('confirms a personal Factory model for members without shared access', async () => {
    const writes = registerSetup();
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
        HttpResponse.json({
          orgKeyAdmin: false,
          providers: [{ provider: 'anthropic', source: 'stored-user', userCredential: 'api_key' }],
        }),
      ),
    );
    persistOnboardingDraft({
      repository: repo,
    });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'model-provider');
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'Continue with personal access' }));
    expect(await screen.findByRole('heading', { name: 'Choose your model.' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Anthropic' }));
    await user.click(await screen.findByRole('button', { name: 'Review setup' }));
    expect(writes).toEqual([]);
    const review = within(screen.getByRole('region', { name: 'Review factory setup' }));
    expect(review.getByText('anthropic/claude-fable-5')).toBeInTheDocument();
    expect(review.getByText('API key · Factory + your default')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create factory' }));
    await screen.findByRole('heading', { name: 'Factory ready' });
    // Without an organization model, Factory runs couldn't run in hybrid scope, so the Factory stays on personal credentials.
    expect(writes.find(item => item.path === 'create')?.body).toEqual({ name: repo.name, modelScope: 'user' });
    expect(writes.find(item => item.path === 'model')?.body).toEqual({ defaultModelId: 'anthropic/claude-fable-5' });
    expect(writes.find(item => item.path === 'personal-model')?.body).toEqual({
      modelId: 'anthropic/claude-fable-5',
    });
  });

  it('does not create a Factory from an old review draft without a model', async () => {
    const writes = registerSetup();
    persistOnboardingDraft({ repository: repo });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(screen.getByRole('button', { name: 'Create factory' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a model before creating your factory.');
    expect(writes).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Edit model' }));
    expect(await screen.findByRole('heading', { name: 'Choose your model.' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review setup' })).not.toBeInTheDocument();
  });
});
