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
  workspaceId,
  workspaceInfo,
  workspaceInfoWithoutSkills,
  workspacesList,
} from './fixtures/workspace-page';
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
        <Route path="/workspaces/:workspaceId" element={<Workspace />} />
      </Routes>
      <Toaster />
    </LinkComponentProvider>,
    { router: { initialEntries: [`/workspaces/${workspaceId}`] } },
  );

const waitForTree = () => screen.findByText('notes');

describe('Workspace page', () => {
  describe('when RBAC is disabled', () => {
    it('offers every workspace action', async () => {
      useWorkspace({ auth: authDisabledCapabilities });
      renderPage();
      await waitForTree();

      expect(await screen.findByRole('button', { name: 'New folder' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Add skill' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Delete notes' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Search files and skills' })).not.toBeNull();
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
      expect(screen.queryByRole('button', { name: 'Search files and skills' })).toBeNull();
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
