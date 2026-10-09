import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { GithubRepo, FactoryProjectPayload } from '../../services/github';
import type { GitLabProject } from '../../../factory/services/gitlab';
import {
  ONBOARDING_FACTORY_KEY,
  ONBOARDING_STEP_KEY,
  persistOnboardingDraft,
  readOnboardingDraft,
} from '../../services/onboardingFlow';
import { EmptyFactoryState } from '../EmptyFactoryState';
import type { SaveModelSetupPreset } from '../../services/modelSetupPreset';

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

const savePreset: SaveModelSetupPreset = async (factoryId, preset) => {
  const response = await fetch(`${TEST_BASE_URL}/preview/factories/${factoryId}/model-setup`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preset),
  });
  if (!response.ok) throw new Error('Unable to save preset');
};

function renderOnboarding(withPresets = false) {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route
          path="/onboarding"
          element={<EmptyFactoryState onSaveModelPreset={withPresets ? savePreset : undefined} />}
        />
        <Route path="/factories/:id" element={<h1>Factory ready</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

function registerSetup(failure?: 'connection' | 'model') {
  const writes: { path: string; body: unknown }[] = [];
  let project: FactoryProjectPayload | undefined;
  let failed = false;
  server.use(
    http.put(`${TEST_BASE_URL}/preview/factories/:id/model-setup`, async ({ request }) => {
      writes.push({ path: 'preset', body: await request.json() });
      return HttpResponse.json({ ok: true });
    }),
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
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
      HttpResponse.json({ connections: [] }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects`, async ({ request }) => {
      const body = await request.json();
      writes.push({ path: 'create', body });
      project = { id: 'fp-1', name: 'hello' };
      return HttpResponse.json({ project });
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
    expect(await screen.findByRole('combobox')).toHaveTextContent(model.modelId);
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
  });

  it('restores repository and model choices after a redirect or reload without writing them', async () => {
    const writes = registerSetup();
    persistOnboardingDraft({ repository: otherRepo, model });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'model-provider');
    const view = renderOnboarding();
    expect(await screen.findByRole('combobox')).toHaveTextContent(model.modelId);
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
});

describe('Model setup presets', () => {
  it('asks for a company model, skips personal setup, and saves only after review', async () => {
    const writes = registerSetup();
    persistOnboardingDraft({ repository: repo });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'model-preset');
    const user = userEvent.setup();
    renderOnboarding(true);
    expect(screen.getByRole('radio', { name: 'Company account' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'OpenAI' }));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    const review = within(await screen.findByRole('region', { name: 'Review factory setup' }));
    expect(review.getByText('Company account')).toBeInTheDocument();
    expect(review.queryByRole('button', { name: 'Edit access' })).not.toBeInTheDocument();
    expect(writes).toEqual([]);
    await user.click(review.getByRole('button', { name: 'Create factory' }));
    await screen.findByRole('heading', { name: 'Factory ready' });
    expect(writes.find(item => item.path === 'preset')?.body).toEqual({ kind: 'company', allowPersonal: false });
    expect(writes.some(item => item.path === 'om')).toBe(false);
    expect(writes.find(item => item.path === 'model')?.body).toEqual({ defaultModelId: model.modelId });
    expect(writes.some(item => item.path === 'personal-model')).toBe(false);
  });

  it('switches from company review to individual setup, restores the draft, and saves no stale shared model', async () => {
    const writes = registerSetup();
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
        HttpResponse.json({
          orgKeyAdmin: true,
          providers: [
            { provider: 'openai', source: 'stored-org', orgCredential: 'api_key', userCredential: 'api_key' },
          ],
        }),
      ),
    );
    persistOnboardingDraft({ repository: repo, model, preset: { kind: 'company', allowPersonal: false } });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');
    const user = userEvent.setup();
    const view = renderOnboarding(true);
    await user.click(await screen.findByRole('button', { name: 'Edit setup' }));
    await user.click(screen.getByRole('radio', { name: 'Everyone brings their own' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Choose your model.' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip for now' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review setup' })).not.toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Personal sessions provider')).queryByText('Organization access'),
    ).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'OpenAI' }));
    expect(await screen.findByText('Your default model')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review setup' }));
    expect(writes).toEqual([]);
    view.unmount();
    renderOnboarding(true);
    const review = within(await screen.findByRole('region', { name: 'Review factory setup' }));
    expect(review.getByText('Everyone brings their own')).toBeInTheDocument();
    expect(review.queryByRole('button', { name: 'Edit model' })).not.toBeInTheDocument();
    expect(readOnboardingDraft().model).toEqual(model);
    await user.click(review.getByRole('button', { name: 'Create factory' }));
    await screen.findByRole('heading', { name: 'Factory ready' });
    expect(writes.find(item => item.path === 'personal-model')?.body).toEqual({ modelId: model.modelId });
    expect(writes.find(item => item.path === 'preset')?.body).toEqual({ kind: 'individual' });
    expect(writes.some(item => item.path === 'model' || item.path === 'om')).toBe(false);
  });

  it('offers optional personal setup for a company preset and preserves both defaults', async () => {
    const writes = registerSetup();
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
        HttpResponse.json({
          orgKeyAdmin: true,
          providers: [
            { provider: 'openai', source: 'stored-org', orgCredential: 'api_key' },
            { provider: 'anthropic', source: 'stored-user', userCredential: 'api_key' },
          ],
        }),
      ),
    );
    persistOnboardingDraft({ repository: repo, model });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'model-preset');
    const user = userEvent.setup();
    renderOnboarding(true);
    await user.click(screen.getByRole('switch', { name: 'Allow personal connections' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('button', { name: 'Skip for now' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Anthropic' }));
    await user.click(await screen.findByRole('button', { name: 'Review setup' }));
    expect(writes).toEqual([]);
    const review = within(await screen.findByRole('region', { name: 'Review factory setup' }));
    expect(review.getByText(model.modelId)).toBeInTheDocument();
    expect(review.getByText('anthropic/claude-fable-5')).toBeInTheDocument();
    await user.click(review.getByRole('button', { name: 'Create factory' }));
    await screen.findByRole('heading', { name: 'Factory ready' });
    expect(writes.find(item => item.path === 'model')?.body).toEqual({ defaultModelId: model.modelId });
    expect(writes.find(item => item.path === 'personal-model')?.body).toEqual({ modelId: 'anthropic/claude-fable-5' });
    expect(writes.find(item => item.path === 'preset')?.body).toEqual({ kind: 'company', allowPersonal: true });
  });

  it('does not silently apply prototype presets on a deployment without policy support', async () => {
    const writes = registerSetup();
    persistOnboardingDraft({ repository: repo, model, preset: { kind: 'company', allowPersonal: false } });
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'Create factory' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Model setup presets are not available on this deployment.',
    );
    expect(writes).toEqual([]);
  });
});
