import type { ListWorkspacesResponse, McpServerListResponse } from '@mastra/client-js';
import type { AuthCapabilities } from '@mastra/react/hooks/auth';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
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

async function choosePlacement(name: string, placement: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'More' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Customize sidebar' }));
  const dialog = await screen.findByRole('dialog', { name: 'Customize sidebar' });
  fireEvent.click(within(dialog).getByRole('combobox', { name: `${name} placement` }));
  const option = await screen.findByRole('option', { name: placement });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
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
  describe('when a task area has no resources yet', () => {
    it('keeps the area discoverable without an extra menu', async () => {
      renderSidebar();
      expect(await screen.findByRole('link', { name: 'Connections' })).toBeTruthy();
      expect(await screen.findByRole('link', { name: 'Workspaces' })).toBeTruthy();
      fireEvent.click(await screen.findByRole('button', { name: 'More' }));
      expect(screen.getByRole('menuitem', { name: 'Customize sidebar' })).toBeTruthy();
      expect(screen.queryByRole('menuitem', { name: 'Connections' })).toBeNull();
    });
  });

  describe('when server resources are in use', () => {
    it('shows Connections and Workspaces by default', async () => {
      server.use(mcpServersHandler(oneMcpServer), workspacesHandler(oneWorkspace));
      renderSidebar();
      expect((await screen.findByRole('link', { name: 'Connections' })).getAttribute('href')).toBe('/mcps');
      expect((await screen.findByRole('link', { name: 'Workspaces' })).getAttribute('href')).toBe('/workspaces');
      expect(screen.queryByRole('link', { name: 'Tools' })).toBeNull();
    });

    it('lets a saved hide choice override the server default', async () => {
      server.use(mcpServersHandler(oneMcpServer));
      const first = renderSidebar();
      await screen.findByRole('link', { name: 'Connections' });
      await choosePlacement('Connections', 'Hide in More menu');
      expect(screen.queryByRole('link', { name: 'Connections' })).toBeNull();
      first.unmount();
      renderSidebar();
      fireEvent.click(await screen.findByRole('button', { name: 'More' }));
      expect(await screen.findByRole('menuitem', { name: 'Connections' })).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Connections' })).toBeNull();
    });
  });

  describe('when Workspaces is made visible', () => {
    it('remains visible after a remount', async () => {
      const first = renderSidebar();
      await choosePlacement('Workspaces', 'Always show');
      await screen.findByRole('link', { name: 'Workspaces' });
      first.unmount();
      renderSidebar();
      expect((await screen.findByRole('link', { name: 'Workspaces' })).getAttribute('href')).toBe('/workspaces');
    });
  });

  describe('when landing on an optional route', () => {
    it('shows the current route without persisting an implicit preference', async () => {
      renderSidebar('/mcps');
      expect((await screen.findByRole('link', { name: 'Connections' })).getAttribute('aria-current')).toBe('page');
      expect(localStorage.getItem('mastra:nav-recent:/mcps')).toBeNull();
      expect(localStorage.getItem('mastra:studio:area-visibility:v1')).toBe('{}');
    });
  });
});
