import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { RepositoriesSection } from '../RepositoriesSection';

const FACTORY_ID = 'fp-1';
const PRIMARY_PROJECT = 'rhys-group1/factory-validation-rhys-20260916/factory-gitlab-primary';

function renderRepositoriesSettings() {
  renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/settings/repositories`]}>
      <Routes>
        <Route path="/factories/:factoryId/settings/repositories" element={<RepositoriesSection />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Repositories settings', () => {
  it('shows GitLab repository details without unrelated GitHub settings for a GitLab-only Factory', async () => {
    let gitlabProjectReads = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'factory-gitlab-primary' }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
        HttpResponse.json({
          connections: [
            {
              id: 'conn-1',
              integrationId: 'gitlab',
              installationId: 'inst-1',
              repositories: [
                {
                  id: 'repo-1',
                  branch: 'main',
                  sandboxWorkdir: '~/factory-gitlab-primary',
                  repository: { slug: PRIMARY_PROJECT, defaultBranch: 'main' },
                },
              ],
            },
          ],
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({
          enabled: false,
          connected: false,
          installations: [],
          reason: 'missing_config',
          diagnostics: { missingGithubAppEnvVars: ['GITHUB_APP_ID'] },
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({
          enabled: true,
          configured: true,
          mode: 'platform',
          accounts: ['gitlab.com'],
          reauthRequired: false,
          reason: 'ready',
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/projects`, () => {
        gitlabProjectReads += 1;
        return HttpResponse.json({
          projects: [
            {
              id: 'gitlab-project:control',
              name: 'rhys-group1/factory-validation-rhys-20260916/factory-gitlab-control',
              projectId: '20',
              projectPath: 'rhys-group1/factory-validation-rhys-20260916/factory-gitlab-control',
              installationStorageId: 'inst-1',
              accountLabel: 'gitlab.com',
              defaultBranch: 'main',
              sandboxProvider: 'custom',
              sandboxWorkdir: '~/factory-gitlab-control',
            },
          ],
        });
      }),
      http.get(`${TEST_BASE_URL}/web/source-control/projects/repo-1/settings`, () =>
        HttpResponse.json({ setupCommand: null, teardownCommand: null }),
      ),
    );

    renderRepositoriesSettings();

    expect((await screen.findAllByText(PRIMARY_PROJECT)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Default branch: main')).length).toBeGreaterThan(0);
    await waitFor(() => expect(gitlabProjectReads).toBe(1));
    expect(await screen.findByText(/factory-gitlab-control/)).toBeInTheDocument();
    expect(screen.queryByText('GitHub is disabled on the server.')).not.toBeInTheDocument();
    expect(screen.queryByText('GitHub CLI tokens')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage GitLab connection' })).toHaveAttribute(
      'href',
      'https://projects.mastra.ai',
    );
    expect(screen.queryByText('Worker token')).not.toBeInTheDocument();
  });
});
