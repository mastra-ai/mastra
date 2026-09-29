/**
 * Coverage for the `/onboarding` wizard (`EmptyFactoryState`). Picking a
 * repository creates the Factory and links the repository in two server
 * calls; a retry after the link step fails must reuse the Factory the first
 * attempt already created instead of creating another one.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { GithubRepo, GithubStatus } from '../../services/github';
import { ONBOARDING_FACTORY_KEY, ONBOARDING_STEP_KEY } from '../../services/onboardingFlow';
import { EmptyFactoryState } from '../EmptyFactoryState';

const connectedGithub: GithubStatus = {
  enabled: true,
  connected: true,
  installations: [{ installationId: 7, accountLogin: 'octo', accountType: 'User' }],
  reason: 'ready',
};

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

function renderOnboarding() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/onboarding']}>
      <EmptyFactoryState />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

describe('EmptyFactoryState', () => {
  describe('given organization provider setup completes', () => {
    it('advances to optional personal providers and finishes only after Continue', async () => {
      sessionStorage.setItem(ONBOARDING_STEP_KEY, 'model-provider');
      sessionStorage.setItem(ONBOARDING_FACTORY_KEY, 'fp-1');
      server.use(
        http.get(`${TEST_BASE_URL}/auth/me`, () =>
          HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
        ),
        http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
          HttpResponse.json({ projects: [{ id: 'fp-1', name: 'hello' }] }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            providers: [{ provider: 'openai', source: 'stored-org', orgCredential: 'api_key', orgKey: true }],
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/models`, () =>
          HttpResponse.json({
            models: [{ id: 'openai/gpt-5.6-sol', provider: 'openai', modelName: 'gpt-5.6-sol', hasApiKey: true }],
          }),
        ),
        http.patch(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
          HttpResponse.json({ project: { id: 'fp-1', name: 'hello', defaultModelId: 'openai/gpt-5.6-sol' } }),
        ),
        http.post(`${TEST_BASE_URL}/web/config/om/provider-defaults`, () =>
          HttpResponse.json({ ok: true, config: {} }),
        ),
      );
      const user = userEvent.setup();

      renderOnboarding();

      await user.click(await screen.findByRole('button', { name: 'OpenAI' }));
      await user.click(await screen.findByRole('button', { name: 'Finish setup' }));

      expect(await screen.findByRole('heading', { name: 'Connect your personal providers.' })).toBeInTheDocument();
      expect(sessionStorage.getItem(ONBOARDING_STEP_KEY)).toBe('personal-provider');
      expect(sessionStorage.getItem(ONBOARDING_FACTORY_KEY)).toBe('fp-1');

      await user.click(screen.getByRole('button', { name: 'Continue' }));

      await waitFor(() => expect(sessionStorage.getItem(ONBOARDING_STEP_KEY)).toBeNull());
      expect(sessionStorage.getItem(ONBOARDING_FACTORY_KEY)).toBeNull();
    });
  });

  describe('given the repository link fails after the Factory was created', () => {
    it('reuses the created Factory when the repository is picked again', async () => {
      sessionStorage.setItem(ONBOARDING_STEP_KEY, 'vcs');
      const creates: unknown[] = [];
      let connectAttempts = 0;
      server.use(
        http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
        http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
        http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
          HttpResponse.json({ enabled: false, configured: false, reauthRequired: false, reason: 'missing_config' }),
        ),
        http.post(`${TEST_BASE_URL}/web/factory/projects`, async ({ request }) => {
          creates.push(await request.json());
          return HttpResponse.json({ project: { id: 'fp-1', name: 'hello' } });
        }),
        http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () => {
          connectAttempts += 1;
          if (connectAttempts === 1) {
            return HttpResponse.json({ error: 'GitHub installation is unavailable' }, { status: 502 });
          }
          return HttpResponse.json({ connection: { id: 'conn-1' } }, { status: 201 });
        }),
        http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections/conn-1/repositories`, () =>
          HttpResponse.json({
            projectRepository: {
              id: 'ghp-1',
              branch: 'main',
              sandboxWorkdir: '/workspace/hello',
              repository: { slug: 'octo/hello', defaultBranch: 'main' },
            },
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/intake/config`, () => HttpResponse.json({ config: {} })),
        http.put(`${TEST_BASE_URL}/web/intake/config`, async ({ request }) =>
          HttpResponse.json({ config: await request.json() }),
        ),
        http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
          HttpResponse.json({ enabled: true, connected: false, reason: 'not_connected' }),
        ),
      );
      const user = userEvent.setup();

      renderOnboarding();

      // The codebase step offers a provider choice before listing repositories.
      await user.click(await screen.findByRole('button', { name: /Connect GitHub/ }));
      await user.click(await screen.findByRole('button', { name: /octo\/hello/ }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Failed to connect GitHub installation (502)');
      expect(creates).toEqual([{ name: 'hello' }]);
      expect(sessionStorage.getItem(ONBOARDING_FACTORY_KEY)).toBe('fp-1');

      await user.click(screen.getByRole('button', { name: /octo\/hello/ }));

      expect(await screen.findByRole('heading', { name: 'Connect the work behind the code.' })).toBeInTheDocument();
      expect(creates).toEqual([{ name: 'hello' }]);
      expect(connectAttempts).toBe(2);
      expect(sessionStorage.getItem(ONBOARDING_FACTORY_KEY)).toBe('fp-1');
    });
  });

  describe('once a Factory has been created for the picked repository', () => {
    it('drops the back-to-vcs affordance so a second pick cannot orphan the first Factory', async () => {
      sessionStorage.setItem(ONBOARDING_STEP_KEY, 'vcs');
      server.use(
        http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
        http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
        http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
          HttpResponse.json({ enabled: false, configured: false, reauthRequired: false, reason: 'missing_config' }),
        ),
        http.post(`${TEST_BASE_URL}/web/factory/projects`, () =>
          HttpResponse.json({ project: { id: 'fp-1', name: 'hello' } }),
        ),
        http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
          HttpResponse.json({ connection: { id: 'conn-1' } }, { status: 201 }),
        ),
        http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections/conn-1/repositories`, () =>
          HttpResponse.json({
            projectRepository: {
              id: 'ghp-1',
              branch: 'main',
              sandboxWorkdir: '/workspace/hello',
              repository: { slug: 'octo/hello', defaultBranch: 'main' },
            },
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/intake/config`, () => HttpResponse.json({ config: {} })),
        http.put(`${TEST_BASE_URL}/web/intake/config`, async ({ request }) =>
          HttpResponse.json({ config: await request.json() }),
        ),
        http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
          HttpResponse.json({ enabled: true, connected: false, reason: 'not_connected' }),
        ),
      );
      const user = userEvent.setup();

      renderOnboarding();

      await user.click(await screen.findByRole('button', { name: /Connect GitHub/ }));
      await user.click(await screen.findByRole('button', { name: /octo\/hello/ }));

      // Landed on project-management with a persisted Factory. Back would
      // orphan `fp-1` if it let the user land on `vcs` and pick a new repo,
      // so the button is not offered.
      expect(await screen.findByRole('heading', { name: 'Connect the work behind the code.' })).toBeInTheDocument();
      expect(sessionStorage.getItem(ONBOARDING_FACTORY_KEY)).toBe('fp-1');
      expect(screen.queryByRole('button', { name: /Go back to previous step/ })).not.toBeInTheDocument();
    });
  });
});
