import type { ListWorkspacesResponse, McpServerListResponse } from '@mastra/client-js';
import type { AuthCapabilities } from '@mastra/react/hooks/auth';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StudioRail } from '../studio-rail';
import { noMcpServers, noWorkspaces } from './fixtures/nav-more';
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
  describe('when no library page is customized', () => {
    it('keeps library pages in More', async () => {
      renderSidebar();
      await screen.findByRole('link', { name: 'Agents' });
      expect(screen.queryByRole('link', { name: 'Tools' })).toBeNull();
      fireEvent.click(await screen.findByRole('button', { name: 'More' }));
      expect(await screen.findByRole('menuitem', { name: 'Tools' })).toBeTruthy();
      expect(screen.getByRole('menuitem', { name: 'Customize sidebar' })).toBeTruthy();
    });
  });

  describe('when a library page is pinned to the sidebar', () => {
    it('remains visible after a remount', async () => {
      const first = renderSidebar();
      await choosePlacement('Tools', 'Always show');
      await screen.findByRole('link', { name: 'Tools' });
      first.unmount();
      renderSidebar();
      expect((await screen.findByRole('link', { name: 'Tools' })).getAttribute('href')).toBe('/tools');
    });
  });

  describe('when choosing destination visibility in the mobile navigation', () => {
    it('keeps the same choice in the desktop rail', async () => {
      const mobile = renderSidebar('/resources');
      await choosePlacement('Agents', 'Hide in More menu');
      mobile.unmount();
      renderSidebar('/resources', <StudioRail />);
      await screen.findByRole('link', { name: 'Logs' });
      expect(screen.queryByRole('link', { name: 'Agents' })).toBeNull();
      fireEvent.click(await screen.findByRole('button', { name: 'More' }));
      expect(await screen.findByRole('menuitem', { name: 'Agents' })).toBeTruthy();
    });
  });
  describe('when legacy area visibility was customized', () => {
    it('carries Build and Monitor choices to the areas that replaced them', async () => {
      localStorage.setItem(
        'mastra:studio:area-visibility:v1',
        JSON.stringify({
          'more:Agents': 'more',
          'areas:Observe': 'hidden',
        }),
      );
      renderSidebar('/resources', <StudioRail />);
      await screen.findByRole('link', { name: 'Chat' });
      for (const name of ['Agents', 'Workflows', 'Logs', 'Traces']) {
        expect(screen.queryByRole('link', { name })).toBeNull();
      }
      fireEvent.click(await screen.findByRole('button', { name: 'More' }));
      expect(await screen.findByRole('menuitem', { name: 'Agents' })).toBeTruthy();
      expect(screen.getByRole('menuitem', { name: 'Workflows' })).toBeTruthy();
      expect(screen.queryByRole('menuitem', { name: 'Logs' })).toBeNull();
      expect(screen.queryByRole('menuitem', { name: 'Traces' })).toBeNull();
    });
    it('preserves canonical choices over conflicting legacy desktop and mobile names', async () => {
      localStorage.setItem(
        'mastra:studio:area-visibility:v1',
        JSON.stringify({
          'areas:Build': 'hidden',
          'more:Agents': 'sidebar',
          'areas:Agents': 'more',
          'more:Monitor': 'sidebar',
          'areas:Observe': 'hidden',
        }),
      );
      renderSidebar('/resources');
      await screen.findByRole('link', { name: 'Logs' });
      expect(screen.queryByRole('link', { name: 'Agents' })).toBeNull();
      fireEvent.click(await screen.findByRole('button', { name: 'More' }));
      await screen.findByRole('menuitem', { name: 'Tools' });
      expect(screen.queryByRole('menuitem', { name: 'Agents' })).toBeNull();
    });
  });
  describe('when landing on an optional route', () => {
    it('shows the current route without persisting an implicit preference', async () => {
      renderSidebar('/mcps');
      expect((await screen.findByRole('link', { name: 'MCP Servers' })).getAttribute('aria-current')).toBe('page');
      expect(localStorage.getItem('mastra:nav-recent:/mcps')).toBeNull();
      expect(localStorage.getItem('mastra:studio:area-visibility:v2')).toBe('{}');
    });
  });
});
