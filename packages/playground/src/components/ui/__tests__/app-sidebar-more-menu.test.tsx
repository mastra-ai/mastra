import type { ListWorkspacesResponse, McpServerListResponse } from '@mastra/client-js';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { noMcpServers, noWorkspaces, oneMcpServer, oneWorkspace } from './fixtures/nav-more';
import { authHandler, BASE_URL, builderHandler, renderSidebar, systemPackagesHandler } from './render-sidebar';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const authDisabledCapabilities = {
  enabled: false,
  login: { type: 'credentials' as const },
} satisfies AuthCapabilities;

function mcpServersHandler(response: McpServerListResponse, opts?: { gate?: Promise<void> }) {
  return http.get(`${BASE_URL}/api/mcp/v0/servers`, async () => {
    if (opts?.gate) await opts.gate;
    return HttpResponse.json(response);
  });
}

function workspacesHandler(response: ListWorkspacesResponse, opts?: { gate?: Promise<void> }) {
  return http.get(`${BASE_URL}/api/workspaces`, async () => {
    if (opts?.gate) await opts.gate;
    return HttpResponse.json(response);
  });
}

function workspacesUnsupportedHandler() {
  return http.get(`${BASE_URL}/api/workspaces`, () =>
    HttpResponse.json({ error: 'Workspaces are not supported' }, { status: 501 }),
  );
}

function baseHandlers() {
  return [authHandler(authDisabledCapabilities), builderHandler({ enabled: false }), systemPackagesHandler()];
}

function seedRecentVisit(url: string, expiresAt: number) {
  localStorage.setItem(`mastra:nav-recent:${url}`, JSON.stringify({ value: true, expiresAt }));
}

const foldedNames = [/^processors$/i, /^mcp servers$/i, /^tools$/i, /^workspaces$/i];

beforeEach(() => {
  (window as unknown as Record<string, unknown>).MASTRA_CLOUD_API_ENDPOINT = '';
  localStorage.clear();
});

afterEach(() => {
  server.resetHandlers();
  cleanup();
});

describe('AppSidebar — More menu', () => {
  describe('when MCP servers and workspaces are still loading', () => {
    it('renders a skeleton instead of the More row', async () => {
      const gate = new Promise<void>(() => {});
      server.use(
        ...baseHandlers(),
        mcpServersHandler(noMcpServers, { gate }),
        workspacesHandler(noWorkspaces, { gate }),
      );

      renderSidebar();

      await screen.findByRole('link', { name: /^agents$/i });
      expect(screen.getByTestId('nav-more-skeleton')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /^more$/i })).toBeNull();
    });

    it('does not render the foldable links yet', async () => {
      const gate = new Promise<void>(() => {});
      server.use(
        ...baseHandlers(),
        mcpServersHandler(noMcpServers, { gate }),
        workspacesHandler(noWorkspaces, { gate }),
      );

      renderSidebar();

      await screen.findByRole('link', { name: /^agents$/i });
      for (const name of foldedNames) {
        expect(screen.queryByRole('link', { name })).toBeNull();
      }
    });
  });

  describe('when there are no MCP servers, no workspaces and no recent visits', () => {
    it('hides the four items behind a collapsed More button', async () => {
      server.use(...baseHandlers(), mcpServersHandler(noMcpServers), workspacesHandler(noWorkspaces));

      renderSidebar();

      const more = await screen.findByRole('button', { name: /^more$/i });
      expect(more.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByTestId('nav-more-skeleton')).toBeNull();
      for (const name of foldedNames) {
        expect(screen.queryByRole('link', { name })).toBeNull();
      }
    });

    it('reveals the four items when More is clicked', async () => {
      server.use(...baseHandlers(), mcpServersHandler(noMcpServers), workspacesHandler(noWorkspaces));

      renderSidebar();

      const more = await screen.findByRole('button', { name: /^more$/i });
      fireEvent.click(more);

      expect(more.getAttribute('aria-expanded')).toBe('true');
      for (const name of foldedNames) {
        expect(screen.getByRole('link', { name })).toBeTruthy();
      }
    });
  });

  describe('when the server has MCP servers', () => {
    it('shows MCP Servers above the fold and keeps the other three under More', async () => {
      server.use(...baseHandlers(), mcpServersHandler(oneMcpServer), workspacesHandler(noWorkspaces));

      renderSidebar();

      const mcpLink = await screen.findByRole('link', { name: /^mcp servers$/i });
      expect(mcpLink.getAttribute('href')).toBe('/mcps');
      expect(screen.getByRole('button', { name: /^more$/i })).toBeTruthy();
      expect(screen.queryByRole('link', { name: /^tools$/i })).toBeNull();
      expect(screen.queryByRole('link', { name: /^processors$/i })).toBeNull();
      expect(screen.queryByRole('link', { name: /^workspaces$/i })).toBeNull();
    });
  });

  describe('when the server has workspaces', () => {
    it('shows Workspaces above the fold', async () => {
      server.use(...baseHandlers(), mcpServersHandler(noMcpServers), workspacesHandler(oneWorkspace));

      renderSidebar();

      const link = await screen.findByRole('link', { name: /^workspaces$/i });
      expect(link.getAttribute('href')).toBe('/workspaces');
      expect(screen.queryByRole('link', { name: /^mcp servers$/i })).toBeNull();
    });
  });

  describe('when the workspaces endpoint returns 501', () => {
    it('keeps Workspaces under More and still resolves without a skeleton', async () => {
      server.use(...baseHandlers(), mcpServersHandler(noMcpServers), workspacesUnsupportedHandler());

      renderSidebar();

      await screen.findByRole('button', { name: /^more$/i });
      expect(screen.queryByTestId('nav-more-skeleton')).toBeNull();
      expect(screen.queryByRole('link', { name: /^workspaces$/i })).toBeNull();
    });
  });

  describe('when Tools was clicked less than 7 days ago', () => {
    it('shows Tools above the fold', async () => {
      seedRecentVisit('/tools', Date.now() + SEVEN_DAYS_MS / 2);
      server.use(...baseHandlers(), mcpServersHandler(noMcpServers), workspacesHandler(noWorkspaces));

      renderSidebar();

      const link = await screen.findByRole('link', { name: /^tools$/i });
      expect(link.getAttribute('href')).toBe('/tools');
      expect(screen.queryByRole('link', { name: /^processors$/i })).toBeNull();
    });
  });

  describe('when Tools was clicked more than 7 days ago', () => {
    it('keeps Tools under More', async () => {
      seedRecentVisit('/tools', Date.now() - 1000);
      server.use(...baseHandlers(), mcpServersHandler(noMcpServers), workspacesHandler(noWorkspaces));

      renderSidebar();

      await screen.findByRole('button', { name: /^more$/i });
      expect(screen.queryByRole('link', { name: /^tools$/i })).toBeNull();
    });
  });

  describe('when every foldable item is promoted', () => {
    it('does not render a More button', async () => {
      seedRecentVisit('/tools', Date.now() + SEVEN_DAYS_MS);
      seedRecentVisit('/processors', Date.now() + SEVEN_DAYS_MS);
      server.use(...baseHandlers(), mcpServersHandler(oneMcpServer), workspacesHandler(oneWorkspace));

      renderSidebar();

      for (const name of foldedNames) {
        await screen.findByRole('link', { name });
      }
      expect(screen.queryByRole('button', { name: /^more$/i })).toBeNull();
    });
  });

  describe('when the current route is /processors', () => {
    it('shows Processors above the fold and stamps a recent visit', async () => {
      server.use(...baseHandlers(), mcpServersHandler(noMcpServers), workspacesHandler(noWorkspaces));

      renderSidebar('/processors');

      const link = await screen.findByRole('link', { name: /^processors$/i });
      await waitFor(() => {
        expect(localStorage.getItem('mastra:nav-recent:/processors')).not.toBeNull();
      });
    });
  });

  describe('when a folded item is clicked', () => {
    it('persists a 7-day expiry entry in localStorage', async () => {
      server.use(...baseHandlers(), mcpServersHandler(noMcpServers), workspacesHandler(noWorkspaces));

      const before = Date.now();
      renderSidebar();

      fireEvent.click(await screen.findByRole('button', { name: /^more$/i }));
      fireEvent.click(screen.getByRole('link', { name: /^tools$/i }));

      const raw = localStorage.getItem('mastra:nav-recent:/tools');
      expect(raw).not.toBeNull();
      const stored: { value: boolean; expiresAt: number } = JSON.parse(raw ?? '{}');
      expect(stored.value).toBe(true);
      expect(stored.expiresAt).toBeGreaterThanOrEqual(before + SEVEN_DAYS_MS);
      expect(stored.expiresAt).toBeLessThanOrEqual(Date.now() + SEVEN_DAYS_MS);
    });
  });
});
