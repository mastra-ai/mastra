import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { WorkspaceNotices } from '../workspace-notices';
import { findSkills, installedSkillsListing, review } from './fixtures/workspace-notices';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const LIST_URL = `${TEST_BASE_URL}/api/workspaces/ws-1/fs/list`;

const serveInstalledSkills = () => {
  const paths: string[] = [];
  server.use(
    http.get(LIST_URL, ({ request }) => {
      paths.push(new URL(request.url).searchParams.get('path') ?? '');
      return HttpResponse.json(installedSkillsListing);
    }),
  );
  return paths;
};

describe('WorkspaceNotices', () => {
  describe('when the workspace is not initialized', () => {
    it('shows the init notice', () => {
      renderWithProviders(<WorkspaceNotices workspaceId="ws-1" showInitWarning />);

      expect(screen.getByText(/to index files from your configured/)).toBeTruthy();
      expect(screen.getByText('workspace.init()')).toBeTruthy();
    });
  });

  describe('when the workspace is ready', () => {
    it('hides the init notice', () => {
      renderWithProviders(<WorkspaceNotices workspaceId="ws-1" showInitWarning={false} />);

      expect(screen.queryByText(/workspace\.init\(\)/)).toBeNull();
    });
  });

  describe('when a skill folder is installed but not discovered', () => {
    it('shows the undiscovered notice with its name', async () => {
      const paths = serveInstalledSkills();

      renderWithProviders(<WorkspaceNotices workspaceId="ws-1" showInitWarning={false} skills={[findSkills]} />);

      expect(await screen.findByText('Skills installed but not discovered')).toBeTruthy();
      expect(screen.getByText(/review/)).toBeTruthy();
      expect(paths).toEqual(['.agents/skills']);
    });
  });

  describe('when all installed skills are discovered', () => {
    it('hides the undiscovered notice', async () => {
      const paths = serveInstalledSkills();

      renderWithProviders(
        <WorkspaceNotices workspaceId="ws-1" showInitWarning={false} skills={[findSkills, review]} />,
      );

      await waitFor(() => expect(paths).toHaveLength(1));
      expect(screen.queryByText('Skills installed but not discovered')).toBeNull();
    });
  });

  describe('when .agents/skills does not exist', () => {
    it('hides the undiscovered notice', async () => {
      let requested = false;
      server.use(
        http.get(LIST_URL, () => {
          requested = true;
          return HttpResponse.json({ error: 'Not found' }, { status: 404 });
        }),
      );

      renderWithProviders(<WorkspaceNotices workspaceId="ws-1" showInitWarning={false} skills={[]} />);

      await waitFor(() => expect(requested).toBe(true));
      expect(screen.queryByText('Skills installed but not discovered')).toBeNull();
    });
  });

  describe('when the skills are still loading', () => {
    it('does not list the installed skills folder', () => {
      const paths = serveInstalledSkills();

      renderWithProviders(<WorkspaceNotices workspaceId="ws-1" showInitWarning={false} />);

      expect(paths).toEqual([]);
      expect(screen.queryByText('Skills installed but not discovered')).toBeNull();
    });
  });
});
