// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentCombobox } from '../../agent-combobox';
import { AgentPage } from '../agent-page';
import type { AgentPageProps } from '../agent-page';
import { agentCatalog, supportAgent } from './fixtures/agent-page';
import { crumbSwitcherTriggerProps } from '@/ds/components/Breadcrumb';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { LinkComponentProvider } from '@/lib/framework';
import { StubLink, stubLinkPaths } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

function ExteriorMount({ children }: { children: ReactNode }) {
  return <aside aria-label="Exterior config">{children}</aside>;
}

function PageWithDock() {
  const [open, setOpen] = useState(true);
  return (
    <AgentPage
      agent={supportAgent}
      overviewHref="/overview"
      config={{
        shortcut: ']',
        dock: { open, toggle: () => setOpen(!open), Mount: ExteriorMount },
        children: onClose => open && <button onClick={onClose}>Close config</button>,
      }}
    />
  );
}

const navigate = vi.fn();
const copy = vi.fn();
function renderPage(props?: Partial<AgentPageProps>, withDock = false) {
  server.use(http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(agentCatalog)));
  return renderWithProviders(
    <LinkComponentProvider Link={StubLink} navigate={navigate} paths={stubLinkPaths}>
      <TooltipProvider>
        {withDock ? (
          <PageWithDock />
        ) : (
          <AgentPage
            agent={supportAgent}
            overviewHref="/overview"
            switcher={
              <AgentCombobox value={supportAgent.id} {...crumbSwitcherTriggerProps} aria-label="Switch agent" />
            }
            {...props}
          />
        )}
      </TooltipProvider>
    </LinkComponentProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('AgentPage', () => {
  describe('when the host supplies an agent catalog', () => {
    it('navigates the overview breadcrumb', async () => {
      const { queryClient } = renderPage();
      const agentsLink = screen.getByRole('link', { name: 'Agents' });
      expect(agentsLink.getAttribute('href')).toBe('/overview');
      await waitForMutationsIdle(queryClient);
    });

    it('searches and switches agents through host navigation', async () => {
      const { queryClient } = renderPage();
      await waitFor(() =>
        expect(screen.getByRole('combobox', { name: 'Switch agent' }).hasAttribute('disabled')).toBe(false),
      );
      fireEvent.click(screen.getByRole('combobox', { name: 'Switch agent' }));
      fireEvent.change(await screen.findByPlaceholderText('Search agents'), { target: { value: 'Echo' } });
      fireEvent.click(await screen.findByRole('option', { name: 'Echo Bot' }));
      expect(navigate).toHaveBeenCalledWith('/agents/echo');
      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when tabs are omitted', () => {
    it('allocates the single grid row to the page content', async () => {
      const { queryClient } = renderPage({ children: <main>Agent conversation</main> });
      const content = screen.getByText('Agent conversation');
      expect(content.parentElement?.classList.contains('grid-rows-[minmax(0,1fr)]')).toBe(true);
      expect(content.parentElement?.children).toHaveLength(1);
      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when tabs are supplied', () => {
    it('exposes real destinations and the current view', async () => {
      const { queryClient } = renderPage({
        tabs: {
          activeTab: 'traces',
          chatHref: '/agents/support/threads/123',
          tracesHref: '/agents/support/traces?threadId=123',
          versionsHref: '/agents/support/editor',
          showObservability: true,
          showPlayground: true,
        },
      });
      expect(screen.getByRole('link', { name: 'Chat' }).getAttribute('href')).toBe('/agents/support/threads/123');
      expect(screen.getByRole('link', { name: 'Traces' }).getAttribute('aria-current')).toBe('page');
      expect(screen.getByRole('link', { name: 'Editor' }).getAttribute('href')).toBe('/agents/support/editor');
      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when capabilities are unavailable', () => {
    it('omits unsupported actions and destinations', async () => {
      const { queryClient } = renderPage({
        tabs: { activeTab: 'chat', chatHref: '/chat', showUnavailableFeatures: false },
      });
      expect(screen.queryByText('Edit')).toBeNull();
      expect(screen.queryByText('Traces')).toBeNull();
      expect(screen.queryByText('Editor')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Copy session URL' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Config' })).toBeNull();
      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when the host supplies a copy action', () => {
    it('invokes the host copy-page action', async () => {
      const { queryClient } = renderPage({ actions: { onShare: copy, shareLabel: 'Copy page URL' } });
      fireEvent.click(screen.getByRole('button', { name: 'Copy page URL' }));
      expect(copy).toHaveBeenCalledOnce();
      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when a desktop dock is supplied', () => {
    it('uses the same visibility for the header toggle and panel close', async () => {
      const { queryClient } = renderPage(undefined, true);
      const toggle = screen.getByRole('button', { name: 'Config' });
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(screen.getByRole('button', { name: 'Close config' }));
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      fireEvent.click(toggle);
      expect(screen.getByRole('button', { name: 'Close config' })).toBeTruthy();
      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when the viewport is mobile', () => {
    it('opens and closes Config in the shared drawer instead of the dock', async () => {
      vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: () => false,
      }));
      const { queryClient } = renderPage(undefined, true);
      fireEvent.click(screen.getByRole('button', { name: 'Config' }));
      expect(await screen.findByRole('dialog', { name: 'Config' })).toBeTruthy();
      expect(screen.queryByRole('complementary', { name: 'Exterior config' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Close config' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Config' })).toBeNull());
      await waitForMutationsIdle(queryClient);
    });
  });
});
