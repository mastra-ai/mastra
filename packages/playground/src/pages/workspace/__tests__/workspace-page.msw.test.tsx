import type { WorkspaceInfoResponse } from '@mastra/client-js';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import type { AuthCapabilities } from '@mastra/react/hooks/auth';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import Workspace from '..';
import { authDisabledCapabilities, rbacCapabilities } from '../../agent-builder/skills/__tests__/fixtures/auth';
import {
  popularSkills,
  rootListing,
  skillsList,
  installedSkills,
  searchResults,
  searchedFile,
  workspaceId,
  workspaceInfo,
  workspaceInfoWithoutSkills,
  workspacesList,
} from './fixtures/workspace-page';
import { WorkspaceShell } from '@/domains/workspace/workspace-shell';
import { StubLink, stubLinkPaths } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const api = `${TEST_BASE_URL}/api/workspaces`;

const useWorkspace = ({ auth, info = workspaceInfo }: { auth: AuthCapabilities; info?: WorkspaceInfoResponse }) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(auth)),
    http.get(api, () => HttpResponse.json(workspacesList)),
    http.get(`${api}/${workspaceId}`, () => HttpResponse.json(info)),
    http.get(`${api}/${workspaceId}/skills`, () => HttpResponse.json(skillsList)),
    http.get(`${api}/${workspaceId}/skills-sh/popular`, () => HttpResponse.json(popularSkills)),
    http.get(`${api}/${workspaceId}/fs/list`, () => HttpResponse.json(rootListing)),
  );
};

const renderPage = () =>
  renderWithProviders(
    <LinkComponentProvider Link={StubLink} navigate={() => {}} paths={stubLinkPaths}>
      <Routes>
        <Route element={<WorkspaceShell />}>
          <Route path="/workspaces/:workspaceId" element={<Workspace />} />
        </Route>
      </Routes>
      <Toaster />
    </LinkComponentProvider>,
    { router: { initialEntries: [`/workspaces/${workspaceId}`] } },
  );

const waitForTree = () => screen.findByText('notes');

describe('Workspace page', () => {
  describe('when searching from the workspace sidebar', () => {
    it('opens the matching file and restores the tree when cleared', async () => {
      useWorkspace({ auth: authDisabledCapabilities });
      server.use(
        http.get(`${api}/${workspaceId}/search`, () => HttpResponse.json(searchResults)),
        http.get(`${api}/${workspaceId}/fs/read`, () => HttpResponse.json(searchedFile)),
      );
      renderPage();
      await waitForTree();
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search workspace' }), { target: { value: 'guide' } });
      fireEvent.click(await screen.findByRole('button', { name: 'guide.md' }));
      expect((await screen.findByTestId('workspace-file-path')).textContent).toBe('guide.md');
      fireEvent.click(screen.getByRole('button', { name: 'Clear search workspace' }));
      expect(await screen.findByRole('tree')).not.toBeNull();
      expect(screen.getByTestId('workspace-file-path').textContent).toBe('guide.md');
    });
  });
  describe('when browsing installed skills', () => {
    it('opens the skill instructions in the file preview', async () => {
      useWorkspace({ auth: authDisabledCapabilities });
      server.use(
        http.get(`${api}/${workspaceId}/skills`, () => HttpResponse.json(installedSkills)),
        http.get(`${api}/${workspaceId}/fs/read`, () =>
          HttpResponse.json({ ...searchedFile, path: 'review/SKILL.md' }),
        ),
      );
      renderPage();
      await waitForTree();
      fireEvent.click(screen.getByRole('tab', { name: /Skills/ }));
      fireEvent.click(await screen.findByRole('button', { name: /review/ }));
      expect((await screen.findByTestId('workspace-file-path')).textContent).toBe('review/SKILL.md');
      expect(screen.queryByRole('button', { name: 'New folder' })).toBeNull();
    });
  });
  describe('when RBAC is disabled', () => {
    it('offers every workspace action', async () => {
      useWorkspace({ auth: authDisabledCapabilities });
      renderPage();
      await waitForTree();

      expect(await screen.findByRole('button', { name: 'New folder' })).not.toBeNull();
      fireEvent.click(screen.getByRole('tab', { name: /Skills/ }));
      expect(screen.getByRole('button', { name: 'Add skill' })).not.toBeNull();
      fireEvent.click(screen.getByRole('tab', { name: 'Files' }));
      expect(screen.getByRole('button', { name: 'Delete notes' })).not.toBeNull();
      expect(screen.getByRole('searchbox', { name: 'Search workspace' })).not.toBeNull();
    });
  });

  describe('when the user can only read workspaces', () => {
    it('hides the write, delete and search actions', async () => {
      useWorkspace({ auth: rbacCapabilities(['workspaces:read']) });
      renderPage();
      await waitForTree();

      await waitFor(() => expect(screen.queryByRole('button', { name: 'New folder' })).toBeNull());
      expect(screen.queryByRole('button', { name: 'Add skill' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Delete notes' })).toBeNull();
      expect(screen.queryByRole('searchbox', { name: 'Search workspace' })).toBeNull();
    });
  });

  describe('when the user can write but not delete', () => {
    it('offers New folder without Delete', async () => {
      useWorkspace({ auth: rbacCapabilities(['workspaces:read', 'workspaces:write']) });
      renderPage();
      await waitForTree();

      expect(await screen.findByRole('button', { name: 'New folder' })).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Delete notes' })).toBeNull();
    });
  });

  describe('when the workspace has no skills capability', () => {
    it('hides the Add skill action', async () => {
      useWorkspace({ auth: authDisabledCapabilities, info: workspaceInfoWithoutSkills });
      renderPage();
      await waitForTree();

      expect(await screen.findByRole('button', { name: 'New folder' })).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Add skill' })).toBeNull();
    });
  });

  describe('when the server forbids deleting a folder', () => {
    it('reports the permission error', async () => {
      useWorkspace({ auth: authDisabledCapabilities });
      server.use(
        http.delete(`${api}/${workspaceId}/fs/delete`, () =>
          HttpResponse.json({ error: 'Forbidden' }, { status: 403 }),
        ),
      );
      renderPage();
      await waitForTree();

      fireEvent.click(await screen.findByRole('button', { name: 'Delete notes' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

      expect(await screen.findByText(/don't have permission to modify this workspace/)).not.toBeNull();
    });
  });
});
