import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import type { AuthCapabilities } from '@mastra/react/hooks/auth';
import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentHeaderCreateAction } from '../agent-header-actions';
import { rbacCapabilities } from '@/domains/agent-builder/hooks/__tests__/fixtures/auth';
import { buildBuilderSettings } from '@/domains/agent-builder/hooks/__tests__/fixtures/builder-settings';
import { paths } from '@/lib/app-routing';
import { Link } from '@/lib/link';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

const authDisabled = { enabled: false } satisfies AuthCapabilities;

const useBuilderSettings = (settings: ReturnType<typeof buildBuilderSettings>) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabled)),
    http.get(`${TEST_BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(settings)),
  );
};

const renderAction = () =>
  renderWithProviders(
    <TooltipProvider>
      {/* Real react-router Link so the C shortcut's synthetic click navigates the MemoryRouter. */}
      <LinkComponentProvider Link={Link} navigate={() => {}} paths={paths}>
        <Routes>
          <Route path="/agents" element={<AgentHeaderCreateAction />} />
          <Route path="/agent-builder/agents/create" element={<div>Create agent page</div>} />
        </Routes>
      </LinkComponentProvider>
    </TooltipProvider>,
    { router: { initialEntries: ['/agents'] } },
  );

afterEach(() => {
  delete window.MASTRA_EXPERIMENTAL_UI;
});

describe('AgentHeaderCreateAction', () => {
  describe('when agent creation is allowed', () => {
    it('shows a New agent link to the create page in the header slot', async () => {
      useBuilderSettings(buildBuilderSettings());
      renderAction();

      const link = await screen.findByRole('link', { name: 'New agent' });
      expect(link.getAttribute('href')).toBe('/agent-builder/agents/create');
    });

    it('navigates to the create page when pressing C', async () => {
      useBuilderSettings(buildBuilderSettings());
      renderAction();

      await screen.findByRole('link', { name: 'New agent' });
      fireEvent.keyDown(window, { key: 'c' });

      expect(await screen.findByText('Create agent page')).not.toBeNull();
    });
  });

  describe('when agent creation is not allowed', () => {
    it('renders nothing', async () => {
      useBuilderSettings(buildBuilderSettings({ enabled: false }));
      const { queryClient } = renderAction();

      await waitForMutationsIdle(queryClient);
      expect(screen.queryByRole('link', { name: 'New agent' })).toBeNull();
    });
  });

  describe('when the builder is disabled and the experimental UI flag is set', () => {
    it('does not expose the retired CMS editor', async () => {
      window.MASTRA_EXPERIMENTAL_UI = 'true';
      useBuilderSettings(buildBuilderSettings({ enabled: false }));
      const { queryClient } = renderAction();

      await waitForMutationsIdle(queryClient);
      expect(screen.queryByRole('link', { name: 'New agent' })).toBeNull();
    });
  });

  describe('when the user can read stored agents but cannot write them', () => {
    it('hides the create action', async () => {
      useBuilderSettings(buildBuilderSettings());
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () =>
          HttpResponse.json(rbacCapabilities(['stored-agents:read'])),
        ),
      );
      const { queryClient } = renderAction();

      await waitForMutationsIdle(queryClient);
      expect(screen.queryByRole('link', { name: 'New agent' })).toBeNull();
    });
  });
});
