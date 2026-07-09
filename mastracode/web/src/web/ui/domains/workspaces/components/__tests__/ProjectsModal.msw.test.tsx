import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { DirectoryListing } from '../../../../../../shared/api/types';
import type { Project } from '../../index';
import { ProjectsModal, useProjectsQuery } from '../../index';
import { loadProjects, saveProjects } from '../../services/projects';

const FS_URL = `${TEST_BASE_URL}/web/fs/list`;

const alpha: Project = {
  id: 'p-alpha',
  name: 'Alpha',
  path: '/projects/alpha',
  resourceId: 'res-alpha',
  createdAt: 1,
};
const beta: Project = {
  id: 'p-beta',
  name: 'Beta',
  path: '/projects/beta',
  resourceId: 'res-beta',
  createdAt: 2,
};

const rootListing: DirectoryListing = {
  root: '/projects',
  path: '/projects',
  parent: null,
  entries: [{ name: 'gamma', path: '/projects/gamma' }],
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('ProjectsModal', () => {
  describe('when projects exist', () => {
    it('lists each project with its path', () => {
      localStorage.setItem('mastracode-projects', JSON.stringify([alpha, beta]));

      renderWithProviders(
        <ProjectsModal
          projects={[alpha, beta]}
          activeProjectId="p-alpha"
          onSelectProject={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('/projects/alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
      expect(screen.getByText('/projects/beta')).toBeInTheDocument();
    });
  });

  describe('when a project is clicked', () => {
    it('selects it and closes', async () => {
      localStorage.setItem('mastracode-projects', JSON.stringify([alpha, beta]));
      const onSelectProject = vi.fn();
      const onClose = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <ProjectsModal
          projects={[alpha, beta]}
          activeProjectId="p-alpha"
          onSelectProject={onSelectProject}
          onClose={onClose}
        />,
      );

      await user.click(screen.getByText('Beta'));

      expect(onSelectProject).toHaveBeenCalledWith(beta);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('when a project is removed', () => {
    it('refreshes the rendered project list through the projects query', async () => {
      saveProjects([alpha, beta]);
      const user = userEvent.setup();

      function Harness() {
        const { data: projects } = useProjectsQuery();
        return (
          <ProjectsModal projects={projects} activeProjectId="p-alpha" onSelectProject={vi.fn()} onClose={vi.fn()} />
        );
      }

      renderWithProviders(<Harness />);

      await user.click(screen.getByRole('button', { name: 'Remove Beta' }));

      await waitFor(() => expect(screen.queryByText('Beta')).not.toBeInTheDocument());
      expect(loadProjects()).toEqual([alpha]);
    });
  });

  describe('when there are no projects', () => {
    it('opens straight into the directory browser', async () => {
      server.use(http.get(FS_URL, () => HttpResponse.json(rootListing)));

      renderWithProviders(
        <ProjectsModal projects={[]} activeProjectId={null} onSelectProject={vi.fn()} onClose={vi.fn()} />,
      );

      expect(await screen.findByText('gamma')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Use this folder' })).toBeInTheDocument();
    });
  });

  describe('when "Add a project" is clicked', () => {
    it('switches to the directory browser', async () => {
      localStorage.setItem('mastracode-projects', JSON.stringify([alpha]));
      server.use(http.get(FS_URL, () => HttpResponse.json(rootListing)));
      const user = userEvent.setup();

      renderWithProviders(
        <ProjectsModal projects={[alpha]} activeProjectId="p-alpha" onSelectProject={vi.fn()} onClose={vi.fn()} />,
      );

      await user.click(screen.getByRole('button', { name: /Add a project/ }));

      expect(await screen.findByText('gamma')).toBeInTheDocument();
    });
  });

  describe('when Close is clicked', () => {
    it('calls onClose', async () => {
      localStorage.setItem('mastracode-projects', JSON.stringify([alpha]));
      const onClose = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <ProjectsModal projects={[alpha]} activeProjectId="p-alpha" onSelectProject={vi.fn()} onClose={onClose} />,
      );

      await user.click(screen.getByRole('button', { name: 'Close' }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });
  });
});
