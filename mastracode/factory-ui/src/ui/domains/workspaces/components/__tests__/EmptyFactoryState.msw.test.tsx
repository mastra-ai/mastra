import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { GithubRepo, FactoryProjectPayload } from '../../services/github';
import { fetchIntakeConfig } from '../../../factory/services/intake';
import { gitLabProjectRepository } from '../../../factory/services/gitlab';
import type { GitLabProject } from '../../../factory/services/gitlab';
import {
  ONBOARDING_FACTORY_KEY,
  persistOnboardingDraft,
  persistOnboardingFactory,
  persistOnboardingStep,
  readOnboardingDraft,
} from '../../services/onboardingFlow';
import type { OnboardingDraft, OnboardingStep } from '../../services/onboardingFlow';
import { OnboardingPage } from '../../../../pages/OnboardingPage';
import { EmptyFactoryState } from '../EmptyFactoryState';
import { chooseProvider, chooseSubscription } from './fixtures/modelSection';

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
const personalModel = { providerId: 'anthropic', modelId: 'anthropic/claude-fable-5', method: 'api_key' as const };

function renderOnboarding() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<EmptyFactoryState onDismissGithubCallback={() => {}} />} />
        <Route path="/factories/:id" element={<h1>Factory ready</h1>} />
      </Routes>
      <Toaster />
    </MemoryRouter>,
  );
}

function seedOnboarding(step: OnboardingStep, draft?: OnboardingDraft) {
  if (draft) persistOnboardingDraft(draft);
  persistOnboardingStep(step);
}

/** The open section: its card carries the section heading; done and next rows do not. */
async function findActiveSection(name: 'Codebase' | 'Work' | 'Accounts' | 'Model') {
  await screen.findByRole('heading', { name, level: 2 });
  return within(screen.getByRole('region', { name }));
}

function registerSetup(failure?: 'connection' | 'intake' | 'model') {
  const writes: { path: string; body: unknown }[] = [];
  let project: FactoryProjectPayload | undefined;
  let failed = false;
  server.use(
    // A connected personal lane starts on the caller's saved default model, when there is one.
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
      HttpResponse.json({ modelId: null, thinkingLevel: null }),
    ),
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
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: project ? [{ ...project, repositories: [] }] : [] }),
    ),
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
    // A GitLab project is routed to the new Factory on its way in, which is what the board reads.
    http.put(`${TEST_BASE_URL}/web/intake/bindings`, async ({ request }) => {
      writes.push({ path: 'routing', body: await request.json() });
      return HttpResponse.json({ bindings: [] });
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

/**
 * Intake endpoints backed by a config that survives the run, so what setup wrote can be read back
 * the way Settings › Work Intake reads it.
 */
function registerIntake(initial: Record<string, unknown> = {}) {
  const stored: Record<string, unknown> = { ...initial };
  const saved: unknown[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/web/intake/config`, () => HttpResponse.json({ config: stored })),
    http.put(`${TEST_BASE_URL}/web/intake/config`, async ({ request }) => {
      const body = z.record(z.string(), z.unknown()).parse(await request.json());
      saved.push(body);
      Object.assign(stored, body);
      return HttpResponse.json({ config: stored });
    }),
  );
  return { saved, stored };
}

/** Create factory, once the Model section has resolved every required choice. */
async function enabledCreateButton() {
  const button = await screen.findByRole('button', { name: 'Create factory' });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

beforeEach(() => sessionStorage.clear());
afterEach(() => sessionStorage.clear());

describe('Draft Factory onboarding', () => {
  it('reopens a GitLab pick on GitLab after a GitHub install result was shown', async () => {
    seedOnboarding('vcs');
    registerSetup();
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={['/onboarding?github_app_installed=true']}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('radio', { name: 'GitHub' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'GitLab' }));
    await user.click(await screen.findByRole('radio', { name: 'team/backend' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await findActiveSection('Work');

    await user.click(screen.getByRole('button', { name: 'Change codebase' }));
    expect(await screen.findByRole('radio', { name: 'team/backend' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'GitLab' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('lets users change repository, VCS and model, then commits only the confirmed choices', async () => {
    seedOnboarding('vcs');
    const writes = registerSetup();
    const user = userEvent.setup();
    renderOnboarding();
    await user.hover(await screen.findByRole('radio', { name: 'octo/hello' }));
    expect(within(screen.getByLabelText('Codebase preview')).getByText('octo/hello')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'octo/hello' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await findActiveSection('Work');

    await user.click(screen.getByRole('button', { name: 'Change codebase' }));
    expect(await screen.findByRole('radio', { name: 'octo/hello' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'octo/other' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const work = await findActiveSection('Work');
    // The picked repository is a source on its own, so Work offers Continue without any tracker.
    await user.click(await work.findByRole('button', { name: 'Continue' }));

    const modelSection = await findActiveSection('Model');
    const accounts = await findActiveSection('Accounts');
    expect(await accounts.findByRole('radio', { name: 'Company account' })).toBeChecked();
    await chooseProvider(user, 'OpenAI', modelSection);
    expect(await modelSection.findByRole('combobox')).toHaveValue('GPT-5.6 Sol');
    expect(writes).toEqual([]);
    expect(within(screen.getByRole('region', { name: 'Work' })).getByText('GitHub')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change codebase' }));
    await user.click(await screen.findByRole('radio', { name: 'GitLab' }));
    await user.click(await screen.findByRole('radio', { name: 'team/backend' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const reopened = await findActiveSection('Model');
    const codebase = within(screen.getByRole('region', { name: 'Codebase' }));
    expect(codebase.getByText('team/backend')).toBeInTheDocument();
    expect(codebase.getByText('develop')).toBeInTheDocument();

    expect(await reopened.findByRole('combobox')).toHaveValue('GPT-5.6 Sol');
    await chooseProvider(user, 'Anthropic', reopened);
    await reopened.findByRole('combobox');
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
    // A GitLab project only feeds the board once it is routed to the Factory it was picked for.
    expect(writes.find(item => item.path === 'routing')?.body).toEqual({
      integrationId: 'gitlab',
      sourceId: 'gitlab-source',
      factoryProjectId: 'fp-1',
    });
    expect(readOnboardingDraft()).toEqual({});
    expect(sessionStorage.getItem(ONBOARDING_FACTORY_KEY)).toBeNull();
  }, 20_000);

  it('selects the codebase repository on the way in when the Work step switch is on', async () => {
    registerSetup();
    registerIntake();
    seedOnboarding('model', { modelScope: 'factory', repository: repo, workConfirmed: true, model });
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await enabledCreateButton());
    expect(await screen.findByRole('heading', { name: 'Factory ready' })).toBeInTheDocument();
    // Setup selects the linked repository, which is what feeds the board.
    expect((await fetchIntakeConfig(TEST_BASE_URL)).github.sourceIds).toEqual(['octo/hello']);
  });

  it('leaves an already-syncing repository selected when the Work step switch is off', async () => {
    registerSetup();
    // The organization's selection before onboarding already holds the repository this setup links.
    const intake = registerIntake({ github: { enabled: true, sourceIds: ['octo/hello', 'octo/teammate'] } });
    seedOnboarding('model', {
      modelScope: 'factory',
      repository: repo,
      workConfirmed: true,
      codeHostSync: false,
      model,
    });
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await enabledCreateButton());
    expect(await screen.findByRole('heading', { name: 'Factory ready' })).toBeInTheDocument();
    // Switching off only undoes what this setup did, so nothing is written at all: the repository
    // is never selected and another Factory's or another member's selection is left alone.
    expect(intake.saved).toEqual([]);
    expect((await fetchIntakeConfig(TEST_BASE_URL)).github.sourceIds).toEqual(['octo/hello', 'octo/teammate']);
  });

  it('never starts syncing a repository the Work step switch left off', async () => {
    registerSetup();
    // Nothing is selected before onboarding, so "off" must not select the repository either, which
    // leaves the intake config untouched.
    const intake = registerIntake();
    seedOnboarding('model', {
      modelScope: 'factory',
      repository: repo,
      workConfirmed: true,
      codeHostSync: false,
      model,
    });
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await enabledCreateButton());
    expect(await screen.findByRole('heading', { name: 'Factory ready' })).toBeInTheDocument();
    expect(intake.saved).toEqual([]);
    expect((await fetchIntakeConfig(TEST_BASE_URL)).github.sourceIds).toBeNull();
  });

  it.each([
    ['GitHub', 'intake'],
    ['GitLab', 'routing'],
  ] as const)('finishes setup with a warning when the %s issue source cannot be saved', async (host, failing) => {
    const writes = registerSetup();
    server.use(
      http.put(`${TEST_BASE_URL}/web/intake/${failing === 'intake' ? 'config' : 'bindings'}`, async ({ request }) => {
        writes.push({ path: failing, body: await request.json() });
        return HttpResponse.json({ error: 'unavailable' }, { status: 502 });
      }),
    );
    seedOnboarding('model', {
      modelScope: 'factory',
      repository: host === 'GitLab' ? gitLabProjectRepository(gitlabProject)! : repo,
      workConfirmed: true,
      model,
    });
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await enabledCreateButton());
    // The Factory and its link exist by now, so both hosts finish setup and point to Settings.
    expect(await screen.findByRole('heading', { name: 'Factory ready' })).toBeInTheDocument();
    expect(await screen.findByText("Issues won't sync yet")).toBeInTheDocument();
    expect(writes.some(item => item.path === failing)).toBe(true);
  });

  it('restores repository and model choices after a redirect or reload without writing them', async () => {
    const writes = registerSetup();
    seedOnboarding('model', { modelScope: 'factory', repository: otherRepo, workConfirmed: true, model });
    const view = renderOnboarding();
    const modelSection = await findActiveSection('Model');
    expect(await modelSection.findByRole('combobox')).toHaveValue('GPT-5.6 Sol');
    view.unmount();
    persistOnboardingStep('vcs');
    renderOnboarding();
    expect(await screen.findByRole('radio', { name: 'octo/other' })).toBeChecked();
    expect(writes).toEqual([]);
  });

  it('returns to Model after a reopened codebase is finished across a reload', async () => {
    const writes = registerSetup();
    seedOnboarding('vcs', { modelScope: 'factory', repository: repo, workConfirmed: true, model });
    const user = userEvent.setup();
    const view = renderOnboarding();
    await findActiveSection('Codebase');
    view.unmount();
    renderOnboarding();
    await user.click(await screen.findByRole('radio', { name: 'octo/other' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await findActiveSection('Model');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create factory' })).toBeEnabled());
    expect(readOnboardingDraft().repository?.fullName).toBe('octo/other');
    expect(writes).toEqual([]);
  });

  it('reopens a finished section from its summary and returns to Model once it is settled again', async () => {
    const writes = registerSetup();
    seedOnboarding('model', { modelScope: 'factory', repository: repo, workConfirmed: true, model });
    const user = userEvent.setup();
    renderOnboarding();
    const modelSection = await findActiveSection('Model');
    expect(await modelSection.findByRole('combobox')).toHaveValue('GPT-5.6 Sol');

    await user.click(screen.getByRole('button', { name: 'Change work' }));
    await findActiveSection('Work');
    const modelSummary = within(screen.getByRole('region', { name: 'Model' }));
    expect(modelSummary.getByText(model.modelId)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create factory' })).not.toBeInTheDocument();

    await user.click(modelSummary.getByRole('button', { name: 'Change model' }));
    await findActiveSection('Model');
    expect(within(screen.getByRole('region', { name: 'Work' })).getByText('GitHub')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change work' }));
    const work = await findActiveSection('Work');
    await user.click(await work.findByRole('button', { name: 'Continue' }));
    await findActiveSection('Model');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create factory' })).toBeEnabled());
    expect(writes).toEqual([]);
  });

  it('summarizes both models, work then sessions, when company work and personal sessions are set up', async () => {
    registerSetup();
    seedOnboarding('model', {
      modelScope: 'hybrid',
      repository: repo,
      workConfirmed: true,
      model,
      personal: personalModel,
    });
    const user = userEvent.setup();
    renderOnboarding();
    await findActiveSection('Model');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create factory' })).toBeEnabled());

    await user.click(screen.getByRole('button', { name: 'Change work' }));
    await findActiveSection('Work');
    expect(
      within(screen.getByRole('region', { name: 'Model' })).getByText(`${model.modelId} · ${personalModel.modelId}`),
    ).toBeInTheDocument();
  });

  it('says connections could not be checked, not "Set up later", while Linear status is down', async () => {
    registerSetup();
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ error: 'Temporary outage' }, { status: 503 }),
      ),
    );
    seedOnboarding('model', { modelScope: 'factory', repository: repo, workConfirmed: true, model });
    renderOnboarding();

    const work = within(await screen.findByRole('region', { name: 'Work' }));
    expect(await work.findByText("Couldn't check connections")).toBeInTheDocument();
    expect(work.queryByText('Set up later')).not.toBeInTheDocument();
  });

  it('moves keyboard focus to the section that opens instead of dropping it', async () => {
    registerSetup();
    seedOnboarding('model', { modelScope: 'factory', repository: repo, workConfirmed: true, model });
    const user = userEvent.setup();
    renderOnboarding();
    await findActiveSection('Model');
    expect(document.body).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Change work' }));
    expect(await screen.findByRole('heading', { name: 'Work', level: 2 })).toHaveFocus();

    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Accounts', level: 2 })).toHaveFocus();
  });

  it.each(['connection', 'model'] as const)(
    'reuses the pending Factory after a failed final %s save and reload',
    async failure => {
      const writes = registerSetup(failure);
      seedOnboarding('model', { modelScope: 'factory', repository: repo, workConfirmed: true, model });
      const user = userEvent.setup();
      const view = renderOnboarding();
      await user.click(await enabledCreateButton());
      expect(await screen.findByRole('alert')).toHaveTextContent('502');
      expect(sessionStorage.getItem(ONBOARDING_FACTORY_KEY)).toBe('fp-1');
      view.unmount();
      renderOnboarding();
      await user.click(await enabledCreateButton());
      expect(await screen.findByRole('heading', { name: 'Factory ready' })).toBeInTheDocument();
      await waitFor(() => expect(writes.filter(item => item.path === 'create')).toHaveLength(1));
    },
  );

  it.each(['factory', 'user', 'hybrid'] as const)(
    'recreates a pending Factory when a failed setup is retried in %s scope',
    async desiredScope => {
      const writes = registerSetup('model');
      seedOnboarding('model', {
        repository: repo,
        workConfirmed: true,
        modelScope: desiredScope === 'factory' ? 'user' : 'factory',
        model,
        personal: model,
      });
      const user = userEvent.setup();
      const view = renderOnboarding();
      await user.click(await enabledCreateButton());
      expect(await screen.findByRole('alert')).toHaveTextContent('502');
      expect(sessionStorage.getItem(ONBOARDING_FACTORY_KEY)).toBe('fp-1');
      view.unmount();
      persistOnboardingDraft({
        repository: repo,
        workConfirmed: true,
        modelScope: desiredScope,
        model,
        personal: model,
      });
      renderOnboarding();
      await user.click(await enabledCreateButton());
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
    seedOnboarding('model', { modelScope: 'factory', repository: repo, workConfirmed: true, model });
    persistOnboardingFactory('fp-gone');
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await enabledCreateButton());
    expect(await screen.findByRole('heading', { name: 'Factory ready' })).toBeInTheDocument();
    expect(writes.filter(item => item.path === 'create')).toHaveLength(1);
  });

  it.each(['model'] as const)(
    'replaces only its own repository link when the codebase changes after a failed %s save',
    async failure => {
      const writes = registerSetup(failure);
      const links: { id: string; repository: { slug: string; externalId: string; defaultBranch: string } }[] = [];
      server.use(
        http.post(
          `${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections/conn-1/repositories`,
          async ({ request }) => {
            const body = z
              .object({ repository: z.object({ slug: z.string(), externalId: z.string() }) })
              .parse(await request.json());
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
      persistOnboardingDraft({ modelScope: 'factory', repository: repo, workConfirmed: true, model });
      persistOnboardingStep('model');
      const user = userEvent.setup();
      renderOnboarding();
      await user.click(await enabledCreateButton());
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      links.push({
        id: 'link-teammate',
        repository: { slug: 'octo/teammate', externalId: '7', defaultBranch: 'main' },
      });
      await user.click(screen.getByRole('button', { name: 'Change codebase' }));
      await user.click(await screen.findByRole('radio', { name: 'octo/other' }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      await user.click(await enabledCreateButton());

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
      persistOnboardingDraft({ modelScope: 'factory', repository: repo, workConfirmed: true, model });
      persistOnboardingStep('model');
      const user = userEvent.setup();
      const view = renderOnboarding();
      await user.click(await enabledCreateButton());
      expect(await screen.findByRole('alert')).toHaveTextContent('502');

      await user.click(screen.getByRole('button', { name: 'Change codebase' }));
      await user.click(await screen.findByRole('radio', { name: otherRepo.fullName }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      await user.click(await enabledCreateButton());
      expect(await screen.findByRole('alert')).toHaveTextContent('Failed to unlink repository (502)');
      expect([...links.keys()]).toEqual(['link-teammate', 'link-99', 'link-100']);

      view.unmount();
      renderOnboarding();
      await user.click(await screen.findByRole('button', { name: 'Change codebase' }));
      await user.click(await screen.findByRole('radio', { name: finalRepo.fullName }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      await user.click(await enabledCreateButton());
      expect(await screen.findByRole('heading', { name: 'Factory ready' })).toBeInTheDocument();
      expect(writes.filter(item => item.path === 'create')).toHaveLength(1);
      expect([...links.values()].map(item => item.fullName)).toEqual(['octo/teammate', finalRepo.fullName]);
    },
  );

  it('refuses to create a Factory whose model is no longer available', async () => {
    const writes = registerSetup();
    seedOnboarding('model', {
      modelScope: 'factory',
      repository: repo,
      workConfirmed: true,
      model: { ...model, modelId: 'openai/retired-model' },
    });
    renderOnboarding();
    const modelSection = await findActiveSection('Model');
    expect(
      await modelSection.findByText('Your previous model is no longer available. Choose another model.'),
    ).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('button', { name: 'Create factory' })).toBeDisabled();
    expect(writes).toEqual([]);
  });
});

describe('Personal Factory model', () => {
  it('only offers personal accounts to members without a company account', async () => {
    const writes = registerSetup();
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
        HttpResponse.json({
          orgKeyAdmin: false,
          providers: [{ provider: 'anthropic', source: 'stored-user', userCredential: 'api_key' }],
        }),
      ),
    );
    seedOnboarding('model', { repository: repo, workConfirmed: true });
    const user = userEvent.setup();
    renderOnboarding();
    const accounts = await findActiveSection('Accounts');
    const modelSection = await findActiveSection('Model');
    expect(await accounts.findByRole('radio', { name: 'Company account' })).toHaveAttribute('aria-disabled', 'true');
    expect(accounts.getByRole('radio', { name: 'Personal accounts' })).toBeChecked();
    const account = within(modelSection.getByRole('group', { name: 'Your account' }));
    await chooseProvider(user, 'Anthropic', account);
    await account.findByRole('combobox');
    expect(writes).toEqual([]);
    await user.click(await enabledCreateButton());
    await screen.findByRole('heading', { name: 'Factory ready' });
    expect(writes.find(item => item.path === 'create')?.body).toEqual({ name: repo.name, modelScope: 'user' });
    expect(writes.find(item => item.path === 'model')?.body).toEqual({ defaultModelId: 'anthropic/claude-fable-5' });
    expect(writes.find(item => item.path === 'personal-model')?.body).toEqual({
      modelId: 'anthropic/claude-fable-5',
    });
  });

  it('treats a draft without a scope as the company account', async () => {
    const writes = registerSetup();
    seedOnboarding('model', { repository: repo, workConfirmed: true, model });
    renderOnboarding();
    const modelSection = await findActiveSection('Model');
    const accounts = await findActiveSection('Accounts');
    expect(await accounts.findByRole('radio', { name: 'Company account' })).toBeChecked();
    expect(await modelSection.findByRole('combobox')).toHaveValue('GPT-5.6 Sol');
    expect(readOnboardingDraft().repository).toEqual(repo);
    expect(writes).toEqual([]);
  });
});

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
      seedOnboarding('model', { repository: repo, workConfirmed: true });
      const user = userEvent.setup();
      renderOnboarding();
      const accounts = await findActiveSection('Accounts');
      const modelSection = await findActiveSection('Model');
      expect(await accounts.findByRole('radio', { name: 'Company account' })).toBeChecked();
      const hybridScope = accounts.getByRole('radio', { name: 'Company work and personal sessions' });
      const connectWithKey = async (lane: ReturnType<typeof within>, providerName: string) => {
        await chooseProvider(user, providerName, lane);
        const dialog = within(await screen.findByRole('dialog'));
        await user.type(dialog.getByLabelText(`API key for ${providerName}`), 'test-key');
        await user.click(dialog.getByRole('button', { name: 'Save' }));
        await lane.findByRole('combobox');
      };
      // Without a Mastra Gateway each lane starts on an empty provider picker.
      if (scope !== 'user') await connectWithKey(modelSection, 'OpenAI');
      if (scope === 'hybrid') {
        await user.click(hybridScope);
        await connectWithKey(within(modelSection.getByRole('group', { name: 'Your sessions' })), 'Anthropic');
      }
      if (scope === 'user') {
        await user.click(accounts.getByRole('radio', { name: 'Personal accounts' }));
        await connectWithKey(within(await modelSection.findByRole('group', { name: 'Your account' })), 'Anthropic');
      }
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
      await user.click(await enabledCreateButton());
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
    seedOnboarding('model', { repository: repo, workConfirmed: true, modelScope: 'hybrid', model });
    const user = userEvent.setup();
    renderOnboarding();
    const sessions = within(await screen.findByRole('group', { name: 'Your sessions' }));
    await chooseSubscription(user, 'Continue with Anthropic', sessions);
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('Authorization code'), 'demo-code');
    await user.click(dialog.getByRole('button', { name: 'Complete sign in' }));
    await sessions.findByRole('combobox');
    expect(signInStarts).toEqual([{ mode: 'paste-code', scope: 'user' }]);
    await user.click(await enabledCreateButton());
    await screen.findByRole('heading', { name: 'Factory ready' });
    expect(writes.find(item => item.path === 'create')?.body).toEqual({ name: repo.name, modelScope: 'hybrid' });
    expect(writes.find(item => item.path === 'personal-model')?.body).toEqual({ modelId: personalModel.modelId });
  });

  it('requires a personal model in hybrid even when the shared model is ready', async () => {
    const writes = registerSetup();
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
        HttpResponse.json({
          orgKeyAdmin: true,
          providers: [
            { provider: 'openai', source: 'stored-org', orgCredential: 'api_key' },
            { provider: 'anthropic', source: 'stored-org', orgCredential: 'api_key' },
          ],
        }),
      ),
    );
    seedOnboarding('model', { repository: repo, workConfirmed: true, modelScope: 'hybrid', model });
    renderOnboarding();
    const modelSection = await findActiveSection('Model');
    expect(await modelSection.findByRole('combobox')).toHaveValue('GPT-5.6 Sol');
    const sessions = within(modelSection.getByRole('group', { name: 'Your sessions' }));
    expect(await sessions.findByRole('button', { name: 'Choose a provider' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create factory' })).toBeDisabled();
    expect(writes).toEqual([]);
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
    seedOnboarding('model', { repository: repo, workConfirmed: true, modelScope: 'factory', model });
    renderOnboarding();
    const modelSection = await findActiveSection('Model');
    expect(await modelSection.findByText('No models are available for this connection yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create factory' })).toBeDisabled();
    expect(writes).toEqual([]);
  });

  it('asks users to review a connection whose sign-in method changed before confirmation', async () => {
    const writes = registerSetup();
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
        HttpResponse.json({ providers: [{ provider: 'openai', source: 'oauth-org', orgCredential: 'oauth' }] }),
      ),
    );
    seedOnboarding('model', { repository: repo, workConfirmed: true, modelScope: 'factory', model });
    renderOnboarding();
    const modelSection = await findActiveSection('Model');
    expect(
      await modelSection.findByText(
        'Your OpenAI connection changed since you chose it. Connect it again or choose another provider.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create factory' })).toBeDisabled();
    expect(writes).toEqual([]);
  });

  it('starts from the existing personal default when it is available for the selected provider', async () => {
    const writes = registerSetup();
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
    seedOnboarding('model', { repository: repo, workConfirmed: true, modelScope: 'user' });
    const user = userEvent.setup();
    renderOnboarding();
    const account = within(await screen.findByRole('group', { name: 'Your account' }));
    await chooseProvider(user, 'OpenAI', account);
    expect(await account.findByRole('combobox')).toHaveValue('GPT-6.1 Sol');
    await user.click(await enabledCreateButton());
    await screen.findByRole('heading', { name: 'Factory ready' });
    expect(writes.find(item => item.path === 'personal-model')?.body).toEqual({ modelId: 'openai/gpt-6.1-sol' });
  });

  it('waits for the personal default before offering Create, so a fallback never overwrites it', async () => {
    const writes = registerSetup();
    let answerDefault = () => {};
    const defaultAnswered = new Promise<void>(resolve => {
      answerDefault = resolve;
    });
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/default-model`, async () => {
        await defaultAnswered;
        return HttpResponse.json({ modelId: 'openai/gpt-6.1-sol', thinkingLevel: null });
      }),
      http.get(`${TEST_BASE_URL}/web/config/models`, () =>
        HttpResponse.json({
          models: [
            { id: model.modelId, provider: 'openai', modelName: 'gpt-5.6-sol', hasApiKey: true },
            { id: 'openai/gpt-6.1-sol', provider: 'openai', modelName: 'gpt-6.1-sol', hasApiKey: true },
          ],
        }),
      ),
    );
    seedOnboarding('model', { repository: repo, workConfirmed: true, modelScope: 'user' });
    const user = userEvent.setup();
    const { client } = renderOnboarding();
    const account = within(await screen.findByRole('group', { name: 'Your account' }));
    await chooseProvider(user, 'OpenAI', account);
    // Everything but the held default has settled, so a fallback suggestion would have enabled Create by now.
    await waitFor(() => expect(client.isFetching()).toBe(1));
    await act(() => new Promise(resolve => setTimeout(resolve, 50)));
    expect(screen.getByRole('button', { name: 'Create factory' })).toBeDisabled();

    answerDefault();
    expect(await account.findByRole('combobox')).toHaveValue('GPT-6.1 Sol');
    await user.click(await enabledCreateButton());
    await screen.findByRole('heading', { name: 'Factory ready' });
    expect(writes.find(item => item.path === 'personal-model')?.body).toEqual({ modelId: 'openai/gpt-6.1-sol' });
  });

  it('preserves cached choices but never applies unused personal defaults', async () => {
    const writes = registerSetup();
    seedOnboarding('model', {
      repository: repo,
      workConfirmed: true,
      modelScope: 'hybrid',
      model,
      personal: personalModel,
    });
    const user = userEvent.setup();
    const view = renderOnboarding();
    const accounts = await findActiveSection('Accounts');
    await user.click(await accounts.findByRole('radio', { name: 'Company account' }));
    expect(readOnboardingDraft().modelScope).toBe('factory');
    view.unmount();
    renderOnboarding();
    const reloaded = await findActiveSection('Model');
    expect(await reloaded.findByRole('combobox')).toHaveValue('GPT-5.6 Sol');
    expect(readOnboardingDraft().personal).toEqual(personalModel);
    expect(reloaded.queryByRole('group', { name: 'Your sessions' })).not.toBeInTheDocument();
    await user.click(await enabledCreateButton());
    await screen.findByRole('heading', { name: 'Factory ready' });
    expect(writes.some(item => item.path === 'personal-model')).toBe(false);
  });

  it('skips policy selection for local single-user setups', async () => {
    const writes = registerSetup();
    server.use(http.get(`${TEST_BASE_URL}/auth/me`, () => new HttpResponse(null, { status: 404 })));
    seedOnboarding('project-management', { repository: repo });
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    const modelSection = await findActiveSection('Model');
    expect(screen.queryByRole('region', { name: 'Accounts' })).not.toBeInTheDocument();
    expect(modelSection.getByText('Local connection')).toBeInTheDocument();
    await chooseProvider(user, 'OpenAI', modelSection);
    await modelSection.findByRole('combobox');
    await user.click(await enabledCreateButton());
    await screen.findByRole('heading', { name: 'Factory ready' });
    expect(writes.filter(item => item.path === 'personal-model')).toEqual([]);
    expect(writes.find(item => item.path === 'create')?.body).toEqual({ name: repo.name, modelScope: 'factory' });
  });

  it('lets a local setup without an account switch the theme', async () => {
    registerSetup();
    server.use(http.get(`${TEST_BASE_URL}/auth/me`, () => new HttpResponse(null, { status: 404 })));
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'Theme' }));
    expect(await screen.findByRole('menuitemradio', { name: 'System' })).toBeChecked();
    await user.click(screen.getByRole('menuitemradio', { name: 'Dark' }));
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Theme' }));
    expect(await screen.findByRole('menuitemradio', { name: 'Dark' })).toBeChecked();
  });

  it('locks every Change and control while the factory is created', async () => {
    const writes = registerSetup();
    let releaseCreate: () => void = () => {};
    const createReleased = new Promise<void>(resolve => {
      releaseCreate = resolve;
    });
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects`, async ({ request }) => {
        const body = await request.json();
        writes.push({ path: 'create', body });
        await createReleased;
        return HttpResponse.json({ project: { id: 'fp-1', name: 'hello', modelScope: 'factory' } });
      }),
      // The gateway gives the company account a provider-source switch, which the creating fieldset can't lock.
      http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
        HttpResponse.json({
          orgKeyAdmin: true,
          providers: [
            { provider: 'mastra', source: 'none', orgKey: false, connectWithMastraAccount: true },
            { provider: 'openai', source: 'stored-org', orgCredential: 'api_key', userCredential: 'api_key' },
            { provider: 'anthropic', source: 'stored-org', orgCredential: 'api_key', userCredential: 'api_key' },
          ],
        }),
      ),
    );
    seedOnboarding('model', { repository: repo, workConfirmed: true, modelScope: 'factory', model });
    const user = userEvent.setup();
    renderOnboarding();
    await findActiveSection('Model');
    await user.click(await enabledCreateButton());
    expect(await screen.findByRole('button', { name: 'Creating your factory…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Change codebase' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Change work' })).toBeDisabled();
    const accounts = within(screen.getByRole('region', { name: 'Accounts' }));
    expect(accounts.getByRole('radio', { name: 'Company account' })).toHaveAttribute('aria-disabled', 'true');
    const modelSection = within(screen.getByRole('region', { name: 'Model' }));
    await user.click(modelSection.getByRole('radio', { name: 'Mastra Gateway' }));
    expect(modelSection.getByRole('radio', { name: 'Your own provider' })).toBeChecked();
    releaseCreate();
    expect(await screen.findByRole('heading', { name: 'Factory ready' })).toBeInTheDocument();
    expect(writes.filter(item => item.path === 'create')).toEqual([
      { path: 'create', body: { name: repo.name, modelScope: 'factory' } },
    ]);
  });
});
