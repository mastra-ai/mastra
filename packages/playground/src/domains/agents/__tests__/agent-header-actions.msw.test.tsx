import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AgentHeaderCreateAction } from '../agent-header-actions';
import type { AuthCapabilities } from '@/domains/auth/types';
import { Link } from '@/lib/link';
import { stubLinkPaths } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

const authDisabled = { enabled: false } satisfies AuthCapabilities;

const useBuilderSettings = (settings: Record<string, unknown>) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabled)),
    http.get(`${TEST_BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(settings)),
  );
};

const renderAction = () =>
  renderWithProviders(
    <TooltipProvider>
      {/* Real react-router Link so the C shortcut's synthetic click navigates the MemoryRouter. */}
      <LinkComponentProvider Link={Link} navigate={() => {}} paths={stubLinkPaths}>
        <Routes>
          <Route path="/agents" element={<AgentHeaderCreateAction />} />
          <Route path="/cms/agents/create" element={<div>Create agent page</div>} />
        </Routes>
      </LinkComponentProvider>
    </TooltipProvider>,
    { router: { initialEntries: ['/agents'] } },
  );

describe('AgentHeaderCreateAction', () => {
  describe('when agent creation is allowed', () => {
    it('shows a New agent link to the create page in the header slot', async () => {
      useBuilderSettings({ enabled: true, features: { agent: {} } });
      renderAction();

      const link = await screen.findByRole('link', { name: 'New agent' });
      expect(link.getAttribute('href')).toBe('/cms/agents/create');
    });

    it('navigates to the create page when pressing C', async () => {
      useBuilderSettings({ enabled: true, features: { agent: {} } });
      renderAction();

      await screen.findByRole('link', { name: 'New agent' });
      fireEvent.keyDown(window, { key: 'c' });

      expect(await screen.findByText('Create agent page')).not.toBeNull();
    });
  });

  describe('when agent creation is not allowed', () => {
    it('renders nothing', async () => {
      useBuilderSettings({ enabled: false });
      const { queryClient } = renderAction();

      await waitForMutationsIdle(queryClient);
      expect(screen.queryByRole('link', { name: 'New agent' })).toBeNull();
    });
  });
});
