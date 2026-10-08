import type { ListWorkspacesResponse, McpServerListResponse } from '@mastra/client-js';
import type { AuthCapabilities } from '@mastra/react/hooks/auth';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StudioRail } from '../studio-rail';
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
      expect(await screen.findByRole('link', { name: 'Resources' })).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Workspaces' })).toBeNull();
      fireEvent.click(await screen.findByRole('button', { name: 'More' }));
      expect(screen.getByRole('menuitem', { name: 'Customize sidebar' })).toBeTruthy();
      expect(screen.queryByRole('menuitem', { name: 'Resources' })).toBeNull();
    });
  });

  describe('when server resources are in use', () => {
    it('shows Resources by default', async () => {
      server.use(mcpServersHandler(oneMcpServer), workspacesHandler(oneWorkspace));
      renderSidebar();
      expect((await screen.findByRole('link', { name: 'Resources' })).getAttribute('href')).toBe('/workspaces');
      expect(screen.queryByRole('link', { name: 'Tools' })).toBeNull();
    });

    it('lets a saved hide choice override the server default', async () => {
      server.use(mcpServersHandler(oneMcpServer));
      const first = renderSidebar();
      await screen.findByRole('link', { name: 'Resources' });
      await choosePlacement('Resources', 'Hide in More menu');
      expect(screen.queryByRole('link', { name: 'Resources' })).toBeNull();
      first.unmount();
      renderSidebar();
      fireEvent.click(await screen.findByRole('button', { name: 'More' }));
      expect(await screen.findByRole('menuitem', { name: 'Resources' })).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Resources' })).toBeNull();
    });
  });

  describe('when Resources is made visible', () => {
    it('remains visible after a remount', async () => {
      const first = renderSidebar();
      await choosePlacement('Resources', 'Always show');
      await screen.findByRole('link', { name: 'Resources' });
      first.unmount();
      renderSidebar();
      expect((await screen.findByRole('link', { name: 'Resources' })).getAttribute('href')).toBe('/workspaces');
    });
  });

  describe('when choosing destination visibility in the mobile navigation', () => {
    it('keeps the same choice in the desktop rail', async () => {
      const mobile = renderSidebar('/resources');
      await choosePlacement('Build', 'Hide in More menu');
      mobile.unmount();
      renderSidebar('/resources', <StudioRail />);
      await screen.findByRole('link', { name: 'Monitor' });
      expect(screen.queryByRole('link', { name: 'Build' })).toBeNull();
      fireEvent.click(await screen.findByRole('button', { name: 'More' }));
      expect(await screen.findByRole('menuitem', { name: 'Build' })).toBeTruthy();
    });
  });
  describe('when legacy area visibility was customized', () => {
    it('preserves renamed areas and keeps Resources visible when either former area was visible', async () => {
      localStorage.setItem(
        'mastra:studio:area-visibility:v1',
        JSON.stringify({
          'more:Agents': 'more',
          'areas:Observe': 'hidden',
          'more:Connections': 'hidden',
          'areas:Workspaces': 'sidebar',
        }),
      );
      renderSidebar('/resources', <StudioRail />);
      await screen.findByRole('link', { name: 'Resources' });
      expect(screen.queryByRole('link', { name: 'Build' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Monitor' })).toBeNull();
      fireEvent.click(await screen.findByRole('button', { name: 'More' }));
      expect(await screen.findByRole('menuitem', { name: 'Build' })).toBeTruthy();
      expect(screen.queryByRole('menuitem', { name: 'Monitor' })).toBeNull();
    });
    it.each([
      ['hidden', 'hidden', false],
      ['hidden', 'more', true],
      ['more', 'hidden', true],
    ])(
      'merges Connections %s and Workspaces %s without restoring a hidden rail entry',
      async (connections, workspaces, inMore) => {
        localStorage.setItem(
          'mastra:studio:area-visibility:v1',
          JSON.stringify({
            'more:Connections': connections,
            'areas:Workspaces': workspaces,
          }),
        );
        renderSidebar('/resources');
        await screen.findByRole('link', { name: 'Build' });
        expect(screen.queryByRole('link', { name: 'Resources' })).toBeNull();
        fireEvent.click(await screen.findByRole('button', { name: 'More' }));
        expect(Boolean(screen.queryByRole('menuitem', { name: 'Resources' }))).toBe(inMore);
      },
    );
    it('preserves canonical choices over conflicting legacy desktop and mobile names', async () => {
      localStorage.setItem(
        'mastra:studio:area-visibility:v1',
        JSON.stringify({
          'areas:Build': 'hidden',
          'more:Agents': 'sidebar',
          'areas:Agents': 'more',
          'more:Monitor': 'sidebar',
          'areas:Observe': 'hidden',
          'more:Resources': 'more',
          'areas:Workspaces': 'sidebar',
        }),
      );
      renderSidebar('/resources');
      await screen.findByRole('link', { name: 'Monitor' });
      expect(screen.queryByRole('link', { name: 'Build' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Resources' })).toBeNull();
      fireEvent.click(await screen.findByRole('button', { name: 'More' }));
      expect(await screen.findByRole('menuitem', { name: 'Resources' })).toBeTruthy();
    });
  });
  describe('when landing on an optional route', () => {
    it('shows the current route without persisting an implicit preference', async () => {
      renderSidebar('/mcps');
      expect((await screen.findByRole('link', { name: 'Resources' })).getAttribute('aria-current')).toBe('page');
      expect(localStorage.getItem('mastra:nav-recent:/mcps')).toBeNull();
      expect(localStorage.getItem('mastra:studio:area-visibility:v2')).toBe('{}');
    });
  });
});
