import type { ReviewSummaryResponse } from '@mastra/client-js';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { noMcpServers, noWorkspaces } from './fixtures/nav-more';
import { authHandler, BASE_URL, builderHandler, renderSidebar, systemPackagesHandler } from './render-sidebar';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const authDisabledCapabilities = {
  enabled: false,
  login: { type: 'credentials' as const },
} satisfies AuthCapabilities;

const emptyReviewSummary: ReviewSummaryResponse = { counts: [] };

beforeEach(() => {
  (window as unknown as Record<string, unknown>).MASTRA_CLOUD_API_ENDPOINT = '';
  window.localStorage.clear();
  server.use(
    authHandler(authDisabledCapabilities),
    builderHandler({ enabled: false }),
    systemPackagesHandler(),
    http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json(noMcpServers)),
    http.get(`${BASE_URL}/api/workspaces`, () => HttpResponse.json(noWorkspaces)),
    http.get(`${BASE_URL}/api/experiments/review-summary`, () => HttpResponse.json(emptyReviewSummary)),
  );
});

afterEach(() => {
  server.resetHandlers();
  cleanup();
});

describe('AppSidebar shell', () => {
  describe('when auth is disabled', () => {
    it('renders the sidebar as a labelled aside with header, main nav and footer landmarks', async () => {
      renderSidebar();

      const aside = await screen.findByRole('complementary', { name: 'Sidebar' });
      expect(aside).toBeTruthy();
      const shellHeader = screen.getAllByRole('banner').find(el => within(el).queryByText('Mastra Studio'));
      expect(shellHeader).toBeTruthy();
      expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
      expect(screen.getByRole('contentinfo')).toBeTruthy();
    });

    it('exposes the search trigger with the keyboard shortcut', async () => {
      renderSidebar();

      const trigger = await screen.findByRole('button', { name: 'Search and navigate' });
      expect(trigger.textContent).toMatch(/K$/);
    });
  });

  describe('when the sidebar is collapsed', () => {
    it('marks the command header as collapsed so the search trigger is hidden', async () => {
      renderSidebar();

      const trigger = await screen.findByRole('button', { name: 'Search and navigate' });
      const commandHeader = trigger.closest('header');
      expect(commandHeader?.getAttribute('data-state')).toBe('default');

      fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }));

      await waitFor(() => {
        expect(commandHeader?.getAttribute('data-state')).toBe('collapsed');
      });
    });
  });
});
