import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { GitLabRepository } from '../../../factory/services/gitlab';
import { OnboardingWorkRow } from '../onboarding/OnboardingWorkRow';
import type { OnboardingWorkRowProps } from '../onboarding/OnboardingWorkRow';
import type { GithubRepo } from '../../services/github';

const githubRepository: GithubRepo = {
  id: 99,
  fullName: 'acme/widgets',
  name: 'widgets',
  owner: 'acme',
  defaultBranch: 'main',
  private: false,
  installationId: 7,
  installationStorageId: 'inst-7',
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/widgets',
};

const gitlabProject: GitLabRepository = {
  provider: 'gitlab',
  id: 'gitlab-source',
  externalId: '42',
  fullName: 'acme/platform',
  name: 'platform',
  owner: 'acme',
  defaultBranch: 'main',
  private: true,
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/platform',
};

function renderRow(overrides: Partial<OnboardingWorkRowProps> = {}) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: true, connected: false, reason: 'not_connected' }),
    ),
  );
  return renderWithProviders(
    <OnboardingWorkRow confirmed={false} onChange={() => {}} changeDisabled={false} {...overrides} />,
  );
}

describe('OnboardingWorkRow', () => {
  it('names the codebase hosts among the sources Work can bring in', () => {
    renderRow();

    expect(screen.getByText('GitHub, GitLab, Linear, Jira or incident.io')).toBeInTheDocument();
  });

  it.each([
    ['GitHub', githubRepository],
    ['GitLab', gitlabProject],
  ] as const)('summarizes %s as the source once Work is finished', async (host, repository) => {
    renderRow({ confirmed: true, repository });

    expect(await screen.findByText(host)).toBeInTheDocument();
  });

  it('says nothing was set up once the Work step switched the repository off', async () => {
    renderRow({ confirmed: true, repository: githubRepository, codeHostSync: false });

    expect(await screen.findByText('Set up later')).toBeInTheDocument();
  });
});
