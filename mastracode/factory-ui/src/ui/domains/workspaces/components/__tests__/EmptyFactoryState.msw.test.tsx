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
          { provider: 'openai', source: 'stored-org', orgCredential: 'api_key', userCredential: 'api_key' },
          { provider: 'anthropic', source: 'stored-org', orgCredential: 'api_key', userCredential: 'api_key' },
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
    await user.click(await screen.findByRole('radio', { name: 'Company account' }));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'OpenAI' }));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
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
    expect(await screen.findByRole('combobox')).toHaveValue('GPT-5.6 Sol');
    await user.click(screen.getByRole('button', { name: 'Change provider' }));
    await user.click(await screen.findByRole('button', { name: 'Anthropic' }));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(writes).toEqual([]);
    expect(readOnboardingDraft().model?.providerId).toBe('anthropic');
    await user.click(screen.getByRole('button', { name: 'Create factory' }));
    expect(await screen.findByRole('heading', { name: 'Factory ready' })).toBeInTheDocument();
    expect(writes.filter(item => item.path === 'create')).toEqual([
      { path: 'create', body: { name: 'backend', modelScope: 'factory' } },
    ]);
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
    persistOnboardingDraft({ modelScope: 'factory', repository: otherRepo, model });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'model-provider');
    const view = renderOnboarding();
    expect(await screen.findByRole('combobox')).toHaveValue('GPT-5.6 Sol');
    view.unmount();
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'vcs');
    renderOnboarding();
    expect(await screen.findByRole('radio', { name: 'octo/other' })).toBeChecked();
    expect(writes).toEqual([]);
  });

  it('returns directly to review after reloading an edited step', async () => {
    const writes = registerSetup();
    persistOnboardingDraft({ modelScope: 'factory', repository: repo, model });
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
      persistOnboardingDraft({ modelScope: 'factory', repository: repo, model });
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

  it.each(['factory', 'user', 'hybrid'] as const)(
    'recreates a pending Factory when a failed setup is retried in %s scope',
    async desiredScope => {
      const writes = registerSetup('model');
      persistOnboardingDraft({
        repository: repo,
        modelScope: desiredScope === 'factory' ? 'user' : 'factory',
        model,
        personal: model,
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
        modelScope: desiredScope,
        model,
        personal: model,
      });
      renderOnboarding();
      await user.click(await screen.findByRole('button', { name: 'Create factory' }));
      expect(await screen.findByRole('heading', { name: 'Factory ready' })).toBeInTheDocument();
      expect(writes.filter(item => item.path === 'delete')).toEqual([{ path: 'delete', body: { id: 'fp-1' } }]);
      expect(writes.filter(item => item.path === 'create')).toEqual([
        { path: 'create', body: { name: 'hello', modelScope: desiredScope === 'factory' ? 'user' : 'factory' } },
        { path: 'create', body: { name: 'hello', modelScope: desiredScope } },
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
    persistOnboardingDraft({ modelScope: 'factory', repository: repo, model });
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
      persistOnboardingDraft({ modelScope: 'factory', repository: repo, model });
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
      persistOnboardingDraft({ modelScope: 'factory', repository: repo, model });
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
    persistOnboardingDraft({
      modelScope: 'factory',
      repository: repo,
      model: { ...model, modelId: 'openai/retired-model' },
    });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'Create factory' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('openai/retired-model is no longer available');
    expect(writes).toEqual([]);
  });
});

describe('Personal Factory model', () => {
  function registerMemberWithoutCompanyAccount() {
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
        HttpResponse.json({
          orgKeyAdmin: false,
          providers: [{ provider: 'anthropic', source: 'stored-user', userCredential: 'api_key' }],
        }),
      ),
    );
  }

  it('sends members back to setup when shared access is no longer available while editing review', async () => {
    const writes = registerSetup();
    registerMemberWithoutCompanyAccount();
    persistOnboardingDraft({ modelScope: 'factory', repository: repo, model });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'Edit model' }));
    await user.click(await screen.findByRole('button', { name: 'Change setup' }));
    expect(await screen.findByRole('heading', { name: 'Choose your setup.' })).toBeInTheDocument();
    expect(readOnboardingDraft().modelScope).toBe('factory');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Choose your model.' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create factory' })).not.toBeInTheDocument();
    expect(writes).toEqual([]);
    await user.click(await screen.findByRole('button', { name: 'Anthropic' }));
    await user.click(await screen.findByRole('button', { name: 'Review setup' }));
    const review = within(screen.getByRole('region', { name: 'Review factory setup' }));
    expect(review.getByText('Personal accounts')).toBeInTheDocument();
    expect(review.getByText('anthropic/claude-fable-5')).toBeInTheDocument();
  });

  it('only offers personal accounts to members without shared access', async () => {
    const writes = registerSetup();
    registerMemberWithoutCompanyAccount();
    persistOnboardingDraft({ repository: repo });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'model-setup');
    const user = userEvent.setup();
    renderOnboarding();
    expect(await screen.findByRole('radio', { name: 'Company account' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('radio', { name: 'Personal accounts' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Company work · personal sessions' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Anthropic' }));
    await user.click(await screen.findByRole('button', { name: 'Review setup' }));
    expect(writes).toEqual([]);
    const review = within(screen.getByRole('region', { name: 'Review factory setup' }));
    expect(review.getByText('API key · your default for work and sessions')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create factory' }));
    await screen.findByRole('heading', { name: 'Factory ready' });
    expect(writes.find(item => item.path === 'create')?.body).toEqual({ name: repo.name, modelScope: 'user' });
    expect(writes.find(item => item.path === 'model')?.body).toEqual({ defaultModelId: 'anthropic/claude-fable-5' });
    expect(writes.find(item => item.path === 'personal-model')?.body).toEqual({
      modelId: 'anthropic/claude-fable-5',
    });
  });

  it('asks legacy drafts to choose a setup while retaining their repository and model', async () => {
    const writes = registerSetup();
    persistOnboardingDraft({ repository: repo, model });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');
    const user = userEvent.setup();
    renderOnboarding();
    expect(await screen.findByRole('heading', { name: 'Choose your setup.' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create factory' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('combobox')).toHaveValue('GPT-5.6 Sol');
    expect(readOnboardingDraft().repository).toEqual(repo);
    expect(writes).toEqual([]);
  });
});

const personalModel = { providerId: 'anthropic', modelId: 'anthropic/claude-fable-5', method: 'api_key' as const };

describe('Account presets', () => {
  it.each(['factory', 'user', 'hybrid'] as const)(
    'connects and saves only the accounts and models required by %s',
    async scope => {
      const writes = registerSetup();
      const credentials: Record<string, { orgCredential?: 'api_key'; userCredential?: 'api_key' }> = {
        openai: {},
        anthropic: {},
      };
      const savedKeys: { provider: string; scope: string }[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            orgKeyAdmin: true,
            providers: Object.entries(credentials).map(([provider, credential]) => ({
              provider,
              envVar: `${provider.toUpperCase()}_API_KEY`,
              source: credential.orgCredential ? 'stored-org' : credential.userCredential ? 'stored-user' : 'none',
              ...credential,
            })),
          }),
        ),
        http.put(`${TEST_BASE_URL}/web/config/providers/:provider/key`, async ({ params, request }) => {
          const provider = z.enum(['openai', 'anthropic']).parse(params.provider);
          const body = z.object({ scope: z.enum(['org', 'user']) }).parse(await request.json());
          savedKeys.push({ provider, scope: body.scope });
          credentials[provider] = {
            ...credentials[provider],
            [body.scope === 'org' ? 'orgCredential' : 'userCredential']: 'api_key',
          };
          return HttpResponse.json({ ok: true });
        }),
      );
      persistOnboardingDraft({ repository: repo });
      sessionStorage.setItem(ONBOARDING_STEP_KEY, 'model-setup');
      const user = userEvent.setup();
      renderOnboarding();
      expect(await screen.findByRole('radio', { name: 'Company work · personal sessions' })).toBeChecked();
      if (scope === 'user') await user.click(await screen.findByRole('radio', { name: 'Personal accounts' }));
      if (scope === 'factory') await user.click(await screen.findByRole('radio', { name: 'Company account' }));
      await user.click(await screen.findByRole('button', { name: 'Continue' }));
      const connectWithKey = async (providerName: string) => {
        await user.click(await screen.findByRole('button', { name: providerName }));
        const dialog = within(await screen.findByRole('dialog'));
        await user.type(dialog.getByLabelText(`API key for ${providerName}`), 'test-key');
        await user.click(dialog.getByRole('button', { name: 'Save' }));
        await screen.findByRole('combobox');
      };
      if (scope !== 'user') {
        await connectWithKey('OpenAI');
        await user.click(await screen.findByRole('button', { name: 'Continue' }));
      }
      if (scope !== 'factory') {
        await connectWithKey('Anthropic');
        await user.click(await screen.findByRole('button', { name: 'Review setup' }));
      }
      await screen.findByRole('region', { name: 'Review factory setup' });
      expect(savedKeys).toEqual(
        {
          factory: [{ provider: 'openai', scope: 'org' }],
          user: [{ provider: 'anthropic', scope: 'user' }],
          hybrid: [
            { provider: 'openai', scope: 'org' },
            { provider: 'anthropic', scope: 'user' },
          ],
        }[scope],
      );
      expect(writes).toEqual([]);
      await user.click(screen.getByRole('button', { name: 'Create factory' }));
      await screen.findByRole('heading', { name: 'Factory ready' });
      expect(writes.find(item => item.path === 'create')?.body).toEqual({ name: repo.name, modelScope: scope });
      expect(writes.find(item => item.path === 'model')?.body).toEqual({
        defaultModelId: scope === 'user' ? personalModel.modelId : model.modelId,
      });
      expect(writes.filter(item => item.path === 'personal-model')).toEqual(
        scope === 'factory' ? [] : [{ path: 'personal-model', body: { modelId: personalModel.modelId } }],
      );
    },
  );

  it('creates a hybrid Factory whose personal account was connected through provider sign-in', async () => {
    const writes = registerSetup();
    let signedIn = false;
    const signInStarts: unknown[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
        HttpResponse.json({
          orgKeyAdmin: true,
          providers: [
            { provider: 'openai', source: 'stored-org', orgCredential: 'api_key' },
            {
              provider: 'anthropic',
              envVar: 'ANTHROPIC_API_KEY',
              oauth: { supported: true, modes: ['paste-code'] },
              ...(signedIn ? { source: 'oauth', userCredential: 'oauth' } : { source: 'none' }),
            },
          ],
        }),
      ),
      http.post(`${TEST_BASE_URL}/web/config/providers/anthropic/oauth/start`, async ({ request }) => {
        signInStarts.push(await request.json());
        return HttpResponse.json({
          sessionId: 'sign-in-1',
          kind: 'paste-code',
          url: 'https://example.com/authorize',
          instructions: 'Paste code',
          expiresAt: Date.now() + 600_000,
        });
      }),
      http.post(`${TEST_BASE_URL}/web/config/providers/anthropic/oauth/complete`, () => {
        signedIn = true;
        return HttpResponse.json({ status: 'complete' });
      }),
    );
    persistOnboardingDraft({ repository: repo, modelScope: 'hybrid', model });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'personal-provider');
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await screen.findByRole('tab', { name: 'Provider sign-in' }));
    await user.click(screen.getByRole('button', { name: 'Continue with Anthropic' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('Authorization code'), 'demo-code');
    await user.click(dialog.getByRole('button', { name: 'Complete sign in' }));
    await user.click(await screen.findByRole('button', { name: 'Review setup' }));
    expect(signInStarts).toEqual([{ mode: 'paste-code', scope: 'user' }]);
    expect(readOnboardingDraft().personal).toEqual({
      providerId: 'anthropic',
      method: 'oauth',
      modelId: personalModel.modelId,
    });
    await user.click(await screen.findByRole('button', { name: 'Create factory' }));
    await screen.findByRole('heading', { name: 'Factory ready' });
    expect(writes.find(item => item.path === 'create')?.body).toEqual({ name: repo.name, modelScope: 'hybrid' });
    expect(writes.find(item => item.path === 'personal-model')?.body).toEqual({ modelId: personalModel.modelId });
  });

  it('requires a personal model in hybrid even when the shared model is ready', async () => {
    const writes = registerSetup();
    persistOnboardingDraft({ repository: repo, modelScope: 'hybrid', model });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');
    const user = userEvent.setup();
    renderOnboarding();
    expect(await screen.findByRole('button', { name: 'Create factory' })).toBeDisabled();
    expect(writes).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Edit personal model' }));
    expect(screen.queryByRole('button', { name: 'Review setup' })).not.toBeInTheDocument();
  });

  it('revalidates each account without falling back to the other catalog', async () => {
    const writes = registerSetup();
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/models`, ({ request }) =>
        HttpResponse.json({
          models:
            new URL(request.url).searchParams.get('scope') === 'org'
              ? []
              : [{ id: model.modelId, provider: 'openai', modelName: 'gpt-5.6-sol', hasApiKey: true }],
        }),
      ),
    );
    persistOnboardingDraft({ repository: repo, modelScope: 'factory', model });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'Create factory' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no longer available for the company account');
    expect(writes).toEqual([]);
  });

  it('asks users to review a connection whose sign-in method changed before confirmation', async () => {
    const writes = registerSetup();
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
        HttpResponse.json({ providers: [{ provider: 'openai', source: 'oauth-org', orgCredential: 'oauth' }] }),
      ),
    );
    persistOnboardingDraft({ repository: repo, modelScope: 'factory', model });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'Create factory' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('connection for the company account has changed');
    expect(writes).toEqual([]);
  });

  it('starts from the existing personal default when it is available for the selected provider', async () => {
    registerSetup();
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
        HttpResponse.json({ modelId: 'openai/gpt-6.1-sol', thinkingLevel: null }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/models`, () =>
        HttpResponse.json({
          models: [
            { id: model.modelId, provider: 'openai', modelName: 'gpt-5.6-sol', hasApiKey: true },
            { id: 'openai/gpt-6.1-sol', provider: 'openai', modelName: 'gpt-6.1-sol', hasApiKey: true },
          ],
        }),
      ),
    );
    persistOnboardingDraft({ repository: repo, modelScope: 'user' });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'personal-provider');
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'OpenAI' }));
    await user.click(await screen.findByRole('button', { name: 'Review setup' }));
    expect(readOnboardingDraft().personal?.modelId).toBe('openai/gpt-6.1-sol');
  });

  it('preserves cached choices but never applies unused personal defaults', async () => {
    const writes = registerSetup();
    persistOnboardingDraft({ repository: repo, modelScope: 'hybrid', model, personal: personalModel });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');
    const user = userEvent.setup();
    const view = renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'Edit setup' }));
    await user.click(await screen.findByRole('radio', { name: 'Company account' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    view.unmount();
    renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(readOnboardingDraft().personal).toEqual(personalModel);
    expect(screen.queryByRole('button', { name: 'Edit personal model' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Create factory' }));
    await screen.findByRole('heading', { name: 'Factory ready' });
    expect(writes.some(item => item.path === 'personal-model')).toBe(false);
  });

  it('returns to review when the setup edit keeps the same accounts', async () => {
    const writes = registerSetup();
    persistOnboardingDraft({ repository: repo, modelScope: 'hybrid', model, personal: personalModel });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'Edit setup' }));
    await user.click(await screen.findByRole('radio', { name: 'Company account' }));
    await user.click(screen.getByRole('radio', { name: 'Company work · personal sessions' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Ready to create.' })).toBeInTheDocument();
    expect(readOnboardingDraft()).toMatchObject({ modelScope: 'hybrid', model, personal: personalModel });
    expect(writes).toEqual([]);
  });

  it('skips policy selection for local single-user setups', async () => {
    const writes = registerSetup();
    server.use(http.get(`${TEST_BASE_URL}/auth/me`, () => new HttpResponse(null, { status: 404 })));
    persistOnboardingDraft({ repository: repo });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'project-management');
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }));
    await user.click(await screen.findByRole('button', { name: 'OpenAI' }));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('button', { name: 'Edit setup' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Create factory' }));
    await screen.findByRole('heading', { name: 'Factory ready' });
    expect(writes.filter(item => item.path === 'personal-model')).toEqual([]);
    expect(writes.find(item => item.path === 'create')?.body).toEqual({ name: repo.name, modelScope: 'factory' });
  });
});
