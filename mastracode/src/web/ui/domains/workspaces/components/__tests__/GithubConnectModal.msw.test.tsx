import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import { useProjectsQuery } from '../../hooks/useProjects';
import type { GithubRepo, GithubStatus } from '../../services/github';
import { loadProjects, saveProjects } from '../../services/projects';
import type { Project } from '../../services/projects';
import { GithubConnectModal } from '../GithubConnectModal';

const ORIGIN = TEST_BASE_URL;

const connectedStatus: GithubStatus = {
  enabled: true,
  connected: true,
  installations: [{ installationId: 42, accountLogin: 'mastra-ai', accountType: 'Organization' }],
};

const repo: GithubRepo = {
  id: 100,
  fullName: 'mastra-ai/mastra',
  name: 'mastra',
  owner: 'mastra-ai',
  defaultBranch: 'main',
  private: false,
  installationId: 42,
};

const createdProject: Project = {
  id: 'github-project-1',
  name: 'mastra-ai/mastra',
  source: 'github',
  githubProjectId: 'github-project-1',
  sandboxWorkdir: '/sandbox/mastra',
  gitBranch: 'main',
  createdAt: 1,
};

function renderModal(
  onProjectCreated = vi.fn<(project: Project) => void>(),
  client?: Parameters<typeof renderWithProviders>[1],
) {
  return {
    onProjectCreated,
    ...renderWithProviders(
      createElement(GithubConnectModal, {
        status: connectedStatus,
        onProjectCreated,
        onClose: vi.fn(),
      }),
      client,
    ),
  };
}

describe('GithubConnectModal', () => {
  it('loads connected repositories and re-queries when filtering', async () => {
    const requestedQueries: Array<string | null> = [];
    server.use(
      http.get(`${ORIGIN}/api/web/github/repos`, ({ request }) => {
        const url = new URL(request.url);
        requestedQueries.push(url.searchParams.get('q'));
        return HttpResponse.json({ repos: [repo] });
      }),
    );

    renderModal();

    expect(await screen.findByText('mastra-ai/mastra')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('Filter repositories…'), 'mastra');

    await waitFor(() => expect(requestedQueries).toContain('mastra'));
  });

  it('shows the repo loading error state', async () => {
    server.use(
      http.get(`${ORIGIN}/api/web/github/repos`, () => HttpResponse.json({ error: 'unavailable' }, { status: 500 })),
    );

    renderModal();

    expect(await screen.findByText('Failed to list repos (500)')).toBeInTheDocument();
  });

  it('creates a GitHub project, persists it, notifies the caller, and refreshes projects query consumers', async () => {
    saveProjects([]);
    server.use(
      http.get(`${ORIGIN}/api/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
      http.post(`${ORIGIN}/api/web/github/projects`, () => HttpResponse.json({ project: createdProject })),
    );
    const projectsHook = renderHookWithProviders(() => useProjectsQuery());
    const { onProjectCreated } = renderModal(undefined, projectsHook.client);

    await userEvent.click(await screen.findByRole('button', { name: /mastra-ai\/mastra/i }));

    await waitFor(() => expect(loadProjects()).toHaveLength(1));
    expect(loadProjects()[0]).toMatchObject({ id: createdProject.id, source: 'github' });
    expect(onProjectCreated).toHaveBeenCalledWith(expect.objectContaining({ id: createdProject.id }));
    await waitFor(() => expect(projectsHook.result.current.data).toHaveLength(1));
  });

  it('shows create errors and does not persist the repo', async () => {
    saveProjects([]);
    server.use(
      http.get(`${ORIGIN}/api/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
      http.post(`${ORIGIN}/api/web/github/projects`, () => HttpResponse.json({ error: 'failed' }, { status: 500 })),
    );

    renderModal();

    await userEvent.click(await screen.findByRole('button', { name: /mastra-ai\/mastra/i }));

    expect(await screen.findByText('Failed to create project (500)')).toBeInTheDocument();
    expect(loadProjects()).toEqual([]);
  });
});
