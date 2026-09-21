/**
 * Coverage for the `/onboarding` wizard (`EmptyFactoryState`). Picking a
 * repository creates the Factory and links the repository in two server
 * calls; a retry after the link step fails must reuse the Factory the first
 * attempt already created instead of creating another one.
 */
import { screen } from '@testing-library/react';
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
  describe('given the repository link fails after the Factory was created', () => {
    it('reuses the created Factory when the repository is picked again', async () => {
      sessionStorage.setItem(ONBOARDING_STEP_KEY, 'vcs');
      const creates: unknown[] = [];
      let connectAttempts = 0;
      server.use(
        http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
        http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
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
});
