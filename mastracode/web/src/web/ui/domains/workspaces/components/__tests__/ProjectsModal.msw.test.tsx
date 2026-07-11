import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { DirectoryListing } from '../../../../../../shared/api/types';
import {
  OverlayTestProviders,
  useOverlayControllerHandlers,
} from '../../../chat/components/__tests__/overlay-test-utils';
import type { Project } from '../../index';
import { ProjectsModal } from '../../index';
import type { GithubStatus } from '../../services/github';
import { loadProjects, saveProjects } from '../../services/projects';

const FS_URL = `${TEST_BASE_URL}/web/fs/list`;
const STATUS_URL = `${TEST_BASE_URL}/web/github/status`;

const alpha: Project = { id: 'p-alpha', name: 'Alpha', path: '/projects/alpha', resourceId: 'res-alpha', createdAt: 1 };
const beta: Project = { id: 'p-beta', name: 'Beta', path: '/projects/beta', resourceId: 'res-beta', createdAt: 2 };

const githubProject: Project = {
  id: 'p-gh',
  name: 'octo/hello',
  source: 'github',
  githubProjectId: 'ghp_1',
  sandboxWorkdir: '/workspace/hello',
  gitBranch: 'main',
  createdAt: 3,
};

const enabledStatus: GithubStatus = { enabled: true, connected: true, installations: [] };

const rootListing: DirectoryListing = {
  root: '/projects',
  path: '/projects',
  parent: null,
  entries: [{ name: 'gamma', path: '/projects/gamma' }],
};

function renderProjects() {
  return renderWithProviders(
    <OverlayTestProviders>
      <ProjectsModal />
    </OverlayTestProviders>,
  );
}

beforeEach(() => {
  localStorage.clear();
  useOverlayControllerHandlers();
});
afterEach(() => localStorage.clear());

describe('ProjectsModal', () => {
  it('lists saved projects and selects one through the active-project provider', async () => {
    saveProjects([alpha, beta]);
    localStorage.setItem('mastracode-active-project', alpha.id);
    const user = userEvent.setup();
    renderProjects();
    expect(screen.getByText('/projects/alpha')).toBeInTheDocument();
    await user.click(screen.getByText('Beta'));
    await waitFor(() => expect(localStorage.getItem('mastracode-active-project')).toBe(beta.id));
  });

  it('removes a project through the projects query', async () => {
    saveProjects([alpha, beta]);
    const user = userEvent.setup();
    renderProjects();
    await user.click(screen.getByRole('button', { name: 'Remove Beta' }));
    await waitFor(() => expect(screen.queryByText('Beta')).not.toBeInTheDocument());
    expect(loadProjects()).toEqual([alpha]);
  });

  it('opens directly into directory browsing without saved projects', async () => {
    server.use(http.get(FS_URL, () => HttpResponse.json(rootListing)));
    renderProjects();
    expect(await screen.findByText('gamma')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use this folder' })).toBeInTheDocument();
  });

  it('switches from the saved-project list to directory browsing', async () => {
    saveProjects([alpha]);
    server.use(http.get(FS_URL, () => HttpResponse.json(rootListing)));
    const user = userEvent.setup();
    renderProjects();
    await user.click(screen.getByRole('button', { name: /Add a project/ }));
    expect(await screen.findByText('gamma')).toBeInTheDocument();
  });

  describe('GitHub projects', () => {
    it('renders a GitHub project row from its repo name and sandbox workdir (no local path)', () => {
      saveProjects([githubProject]);
      renderProjects();
      expect(screen.getByText(/octo\/hello/)).toBeInTheDocument();
      expect(screen.getByText('/workspace/hello')).toBeInTheDocument();
    });

    it('shows "Open from GitHub" when the feature is enabled', async () => {
      saveProjects([alpha]);
      server.use(http.get(STATUS_URL, () => HttpResponse.json(enabledStatus)));
      renderProjects();
      expect(await screen.findByRole('button', { name: /Open from GitHub/ })).toBeInTheDocument();
    });

    it('hides "Open from GitHub" when the feature is disabled', async () => {
      saveProjects([alpha]);
      server.use(
        http.get(STATUS_URL, () => HttpResponse.json({ enabled: false, connected: false, installations: [] })),
      );
      renderProjects();
      // Wait for the status query to settle before asserting absence.
      expect(await screen.findByRole('button', { name: /Add a project/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Open from GitHub/ })).not.toBeInTheDocument();
    });
  });
});
