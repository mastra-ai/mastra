import { cleanup, fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { noMcpServers, noWorkspaces } from './fixtures/nav-more';
import { adminSidebarCapabilities } from './fixtures/sidebar-permissions';
import { authHandler, BASE_URL, builderHandler, renderSidebar, systemPackagesHandler } from './render-sidebar';
import { providersResponse, unauthorizedBody } from '@/pages/connections/__tests__/fixtures/user-connect';
import { server } from '@/test/msw-server';

beforeEach(() => {
  window.MASTRA_CLOUD_API_ENDPOINT = '';
  localStorage.clear();
  server.use(
    authHandler(adminSidebarCapabilities),
    builderHandler({ enabled: false }),
    systemPackagesHandler(),
    http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json(noMcpServers)),
    http.get(`${BASE_URL}/api/workspaces`, () => HttpResponse.json(noWorkspaces)),
  );
});

afterEach(() => cleanup());

describe('AppSidebar connections entry', () => {
  describe('when the connect routes are not mounted', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/connect/providers`, () =>
          HttpResponse.json({ error: { code: 'not_found', message: 'Not found' } }, { status: 404 }),
        ),
      );
    });

    it('excludes Connections from navigation', async () => {
      renderSidebar();

      fireEvent.click(await screen.findByRole('button', { name: 'More' }));
      await screen.findByRole('menuitem', { name: 'Tools' });
      expect(screen.queryByRole('menuitem', { name: 'Connections' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Connections' })).toBeNull();
    });
  });

  describe('when the connect routes are mounted', () => {
    beforeEach(() => {
      server.use(http.get(`${BASE_URL}/connect/providers`, () => HttpResponse.json(providersResponse)));
    });

    it('provides the Connections destination', async () => {
      renderSidebar();

      fireEvent.click(await screen.findByRole('button', { name: 'More' }));
      expect((await screen.findByRole('menuitem', { name: 'Connections' })).getAttribute('href')).toBe('/connections');
    });
  });

  describe('when the mounted routes reject the studio session', () => {
    beforeEach(() => {
      server.use(http.get(`${BASE_URL}/connect/providers`, () => HttpResponse.json(unauthorizedBody, { status: 401 })));
    });

    it('keeps the Connections destination for setup guidance', async () => {
      renderSidebar();

      fireEvent.click(await screen.findByRole('button', { name: 'More' }));
      expect((await screen.findByRole('menuitem', { name: 'Connections' })).getAttribute('href')).toBe('/connections');
    });
  });
});
