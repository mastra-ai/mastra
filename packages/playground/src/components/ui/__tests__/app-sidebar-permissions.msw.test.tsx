import { cleanup, fireEvent, screen } from '@testing-library/react';
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
      for (const name of ['Chat', 'Agents', 'Workflows', 'Traces', 'Evaluate', 'Logs']) {
        expect(await screen.findByRole('link', { name })).toBeTruthy();
      }
    });
  });
  describe('when a member can read agents and tools and use workflows', () => {
    it('provides their products without exposing unauthorized task areas', async () => {
      server.use(authHandler(memberSidebarCapabilities));
      renderSidebar();
      expect((await screen.findByRole('link', { name: 'Agents' })).getAttribute('href')).toBe('/agents');
      expect(screen.getByRole('link', { name: 'Workflows' }).getAttribute('href')).toBe('/workflows');
      for (const name of ['Traces', 'Evaluate', 'Logs']) {
        expect(screen.queryByRole('link', { name })).toBeNull();
      }
      fireEvent.click(screen.getByRole('button', { name: 'More' }));
      expect((await screen.findByRole('menuitem', { name: 'Tools' })).getAttribute('href')).toBe('/tools');
    });
  });
  describe('when a viewer can only read agents and workflows', () => {
    it('offers agents and workflows without library pages', async () => {
      server.use(authHandler(viewerSidebarCapabilities));
      renderSidebar();
      await screen.findByRole('link', { name: 'Agents' });
      expect(screen.getByRole('link', { name: 'Workflows' })).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Tools' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'More' }));
      await screen.findByRole('menuitem', { name: 'Customize sidebar' });
      expect(screen.queryByRole('menuitem', { name: 'Tools' })).toBeNull();
    });
  });
  describe('when RBAC is disabled for a viewer', () => {
    it('makes all task areas available', async () => {
      server.use(authHandler(rbacDisabledSidebarCapabilities));
      renderSidebar();
      for (const name of ['Chat', 'Agents', 'Workflows', 'Traces', 'Evaluate', 'Logs']) {
        expect(await screen.findByRole('link', { name })).toBeTruthy();
      }
    });
  });
});
