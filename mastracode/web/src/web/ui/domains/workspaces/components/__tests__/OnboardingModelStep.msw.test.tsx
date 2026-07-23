/**
 * BDD coverage for the model step inside the `/onboarding` wizard
 * (`EmptyFactoryState`): picking a repository lands on the model step, a
 * stored `model` step resumes with its pending factory, and a stored `model`
 * step without a pending factory rewinds to the VCS step (the factory is
 * created at repo pick, so there is nothing to attach a model to).
 */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { GithubStatus } from '../../services/github';
import { ONBOARDING_FACTORY_KEY, ONBOARDING_STEP_KEY, ONBOARDING_UPDATED_AT_KEY } from '../../services/onboardingFlow';
import { EmptyFactoryState } from '../EmptyFactoryState';

const connectedGithub: GithubStatus = {
  enabled: true,
  connected: true,
  installations: [{ installationId: 7, accountLogin: 'octo', accountType: 'User' }],
  reason: 'ready',
};

const repo = {
  id: 99,
  fullName: 'octo/hello',
  name: 'hello',
  owner: 'octo',
  defaultBranch: 'main',
  private: false,
  installationId: 7,
  installationStorageId: 'inst-7',
  repositoryStorageId: 'repo-99',
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/hello',
};

function renderOnboarding() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/onboarding']}>
      <EmptyFactoryState />
    </MemoryRouter>,
  );
}

/** Stub the model step's data endpoints (factory project + provider catalog). */
function stubModelStepEndpoints() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
      HttpResponse.json({ project: { id: 'fp-1', name: 'hello', defaultModelId: null } }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
      HttpResponse.json({
        providers: [{ provider: 'anthropic', source: 'stored', oauth: { supported: true, modes: ['paste-code'] } }],
      }),
    ),
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

describe('Onboarding model step', () => {
  it('advances from repository selection to the model step after the repo is linked', async () => {
    let projectCreated = false;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: projectCreated ? [{ id: 'fp-1', name: 'hello' }] : [] }),
      ),
      http.post(`${TEST_BASE_URL}/web/factory/projects`, () => {
        projectCreated = true;
        return HttpResponse.json({ project: { id: 'fp-1', name: 'hello' } });
      }),
      http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
        HttpResponse.json({ connection: { id: 'conn-1' } }),
      ),
      http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections/conn-1/repositories`, () =>
        HttpResponse.json({
          projectRepository: {
            id: 'ghp_1',
            branch: 'main',
            sandboxWorkdir: '/workspace/hello',
            repository: { slug: 'octo/hello', defaultBranch: 'main' },
          },
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
    );
    stubModelStepEndpoints();
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'vcs');
    sessionStorage.setItem(ONBOARDING_UPDATED_AT_KEY, String(Date.now()));
    const user = userEvent.setup();

    renderOnboarding();

    await user.click(await screen.findByRole('button', { name: /octo\/hello/ }));

    expect(await screen.findByRole('heading', { name: 'Connect your LLM.' })).toBeInTheDocument();
    // Persisted so an OAuth round-trip (or refresh) resumes on the model step.
    expect(sessionStorage.getItem(ONBOARDING_STEP_KEY)).toBe('model');
    expect(sessionStorage.getItem(ONBOARDING_FACTORY_KEY)).toBe('fp-1');
  });

  it('resumes a stored model step when the pending factory still exists', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: 'fp-1', name: 'hello' }] }),
      ),
    );
    stubModelStepEndpoints();
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'model');
    sessionStorage.setItem(ONBOARDING_FACTORY_KEY, 'fp-1');
    sessionStorage.setItem(ONBOARDING_UPDATED_AT_KEY, String(Date.now()));

    renderOnboarding();

    expect(await screen.findByRole('heading', { name: 'Connect your LLM.' })).toBeInTheDocument();
    // The step body mounts once the pending factory is restored from the list.
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('rewinds a stored model step to the VCS step when no pending factory is stored', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })),
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
    );
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'model');
    sessionStorage.setItem(ONBOARDING_UPDATED_AT_KEY, String(Date.now()));

    renderOnboarding();

    expect(await screen.findByRole('heading', { name: 'Choose your codebase.' })).toBeInTheDocument();
  });
});
