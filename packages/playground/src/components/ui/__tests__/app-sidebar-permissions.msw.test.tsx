import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  adminSidebarCapabilities,
  memberSidebarCapabilities,
  rbacDisabledSidebarCapabilities,
  viewerSidebarCapabilities,
} from './fixtures/sidebar-permissions';
import { authHandler, builderHandler, renderSidebar, systemPackagesHandler } from './render-sidebar';
import { server } from '@/test/msw-server';

beforeEach(() => {
  window.MASTRA_CLOUD_API_ENDPOINT = '';
  localStorage.clear();
  server.use(builderHandler({ enabled: false }), systemPackagesHandler());
});
afterEach(cleanup);

describe('AppSidebar permissions', () => {
  describe('when an admin has wildcard permissions', () => {
    it('provides every task area without requiring More', async () => {
      server.use(authHandler(adminSidebarCapabilities));
      renderSidebar();
      for (const name of ['Agents', 'Evaluate', 'Observe', 'Connections', 'Workspaces']) {
        expect(await screen.findByRole('link', { name })).toBeTruthy();
      }
    });
  });
  describe('when a member can read agents and tools and use workflows', () => {
    it('provides Build without exposing unauthorized task areas', async () => {
      server.use(authHandler(memberSidebarCapabilities));
      renderSidebar();
      expect((await screen.findByRole('link', { name: 'Agents' })).getAttribute('href')).toBe('/agents');
      for (const name of ['Evaluate', 'Observe', 'Connections', 'Workspaces']) {
        expect(screen.queryByRole('link', { name })).toBeNull();
      }
    });
  });
  describe('when a viewer can only read agents and workflows', () => {
    it('groups the permitted collections under Build', async () => {
      server.use(authHandler(viewerSidebarCapabilities));
      renderSidebar();
      await screen.findByRole('link', { name: 'Agents' });
      expect(screen.queryByRole('link', { name: 'Tools' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Connections' })).toBeNull();
    });
  });
  describe('when RBAC is disabled for a viewer', () => {
    it('makes all task areas available', async () => {
      server.use(authHandler(rbacDisabledSidebarCapabilities));
      renderSidebar();
      for (const name of ['Agents', 'Evaluate', 'Observe', 'Connections', 'Workspaces']) {
        expect(await screen.findByRole('link', { name })).toBeTruthy();
      }
    });
  });
});
