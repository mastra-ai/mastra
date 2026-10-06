import type { ListWorkspacesResponse, McpServerListResponse } from '@mastra/client-js';
import type { AuthCapabilities } from '@mastra/react/hooks/auth';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { noMcpServers, noWorkspaces, oneMcpServer, oneWorkspace } from './fixtures/nav-more';
import { authHandler, BASE_URL, builderHandler, renderSidebar, systemPackagesHandler } from './render-sidebar';
import { server } from '@/test/msw-server';

const authDisabledCapabilities = {
  enabled: false,
  login: { type: 'credentials' as const },
} satisfies AuthCapabilities;

function mcpServersHandler(response: McpServerListResponse) {
  return http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json(response));
}

function workspacesHandler(response: ListWorkspacesResponse) {
  return http.get(`${BASE_URL}/api/workspaces`, () => HttpResponse.json(response));
}

async function customizeSidebar() {
  fireEvent.click(await screen.findByRole('button', { name: 'More' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Customize sidebar' }));
}

beforeEach(() => {
  window.MASTRA_CLOUD_API_ENDPOINT = '';
  localStorage.clear();
  server.use(
    authHandler(authDisabledCapabilities),
    builderHandler({ enabled: false }),
    systemPackagesHandler(),
    mcpServersHandler(noMcpServers),
    workspacesHandler(noWorkspaces),
  );
});

afterEach(() => {
  server.resetHandlers();
  cleanup();
});

describe('AppSidebar More menu', () => {
  describe('when optional primitives are unused', () => {
    it('keeps them reachable in a menu without inserting navigation rows', async () => {
      renderSidebar();
      const more = await screen.findByRole('button', { name: 'More' });
      const list = more.closest('ul');
      const rows = list?.textContent;
      fireEvent.click(more);
      for (const name of ['Processors', 'MCP Servers', 'Tools', 'Workspaces']) {
        expect(await screen.findByRole('menuitem', { name })).toBeTruthy();
        expect(screen.queryByRole('link', { name })).toBeNull();
      }
      expect(list?.textContent).toBe(rows);
      expect(screen.getByRole('button', { name: 'More' })).toBe(more);
    });
  });

  describe('when server resources are in use', () => {
    it('shows MCP Servers and Workspaces by default', async () => {
      server.use(mcpServersHandler(oneMcpServer), workspacesHandler(oneWorkspace));
      renderSidebar();
      expect((await screen.findByRole('link', { name: 'MCP Servers' })).getAttribute('href')).toBe('/mcps');
      expect((await screen.findByRole('link', { name: 'Workspaces' })).getAttribute('href')).toBe('/workspaces');
      expect(screen.queryByRole('link', { name: 'Tools' })).toBeNull();
    });

    it('lets a saved hide choice override the server default', async () => {
      server.use(mcpServersHandler(oneMcpServer));
      const first = renderSidebar();
      await screen.findByRole('link', { name: 'MCP Servers' });
      await customizeSidebar();
      fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'MCP Servers' }));
      expect(screen.queryByRole('link', { name: 'MCP Servers' })).toBeNull();
      first.unmount();
      renderSidebar();
      await customizeSidebar();
      await waitFor(() =>
        expect(screen.getByRole('menuitemcheckbox', { name: 'MCP Servers' }).getAttribute('aria-checked')).toBe(
          'false',
        ),
      );
      expect(screen.queryByRole('link', { name: 'MCP Servers' })).toBeNull();
    });
  });

  describe('when Tools is made visible', () => {
    it('remains visible after a remount', async () => {
      const first = renderSidebar();
      await customizeSidebar();
      fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Tools' }));
      await screen.findByRole('link', { name: 'Tools' });
      first.unmount();
      renderSidebar();
      expect((await screen.findByRole('link', { name: 'Tools' })).getAttribute('href')).toBe('/tools');
    });
  });

  describe('when landing on an optional route', () => {
    it('shows the current route without persisting an implicit preference', async () => {
      renderSidebar('/processors');
      expect((await screen.findByRole('link', { name: 'Processors' })).getAttribute('aria-current')).toBe('page');
      expect(localStorage.getItem('mastra:nav-recent:/processors')).toBeNull();
      expect(localStorage.getItem('mastra:studio:sidebar-visibility')).toBe('{}');
    });
  });
});
