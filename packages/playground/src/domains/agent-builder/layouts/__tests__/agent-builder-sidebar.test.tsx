import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// jsdom doesn't provide ResizeObserver — stub it for ScrollArea
globalThis.ResizeObserver ??= class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof globalThis.ResizeObserver;

// jsdom also lacks `Element.getAnimations`, which @base-ui's ScrollArea
// viewport calls on a timer. Stub it to an empty list to avoid unhandled errors.
if (typeof Element !== 'undefined' && typeof Element.prototype.getAnimations !== 'function') {
  Element.prototype.getAnimations = function getAnimations() {
    return [] as Animation[];
  };
}
import { AgentBuilderSidebar } from '../agent-builder-sidebar';
import { authDisabledCapabilities, builderSettings } from './fixtures/builder';
import { LinkComponentProvider } from '@/lib/framework';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

// `useBuilderAgentFeatures`, `useBuilderAgentAccess`, `usePermissions`, and
// `useAuthCapabilities` all resolve to two network calls. With auth disabled,
// RBAC is off so every capability check is allowed and the Favorites link
// always renders.
const commonHandlers = () => [
  http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabledCapabilities)),
  http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(builderSettings)),
];

beforeEach(() => {
  server.resetHandlers();
});

const StubLink = ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a {...props}>{children}</a>
);

const noopPaths = {
  agentLink: () => '',
  agentMessageLink: () => '',
  workflowLink: () => '',
  toolLink: () => '',
  scoreLink: () => '',
  scorerLink: () => '',
  toolByAgentLink: () => '',
  toolByWorkflowLink: () => '',
  promptLink: () => '',
  legacyWorkflowLink: () => '',
  policyLink: () => '',
  vNextNetworkLink: () => '',
  agentBuilderLink: () => '',
  mcpServerLink: () => '',
  mcpServerToolLink: () => '',
  workflowRunLink: () => '',
  datasetLink: () => '',
  datasetItemLink: () => '',
  datasetExperimentLink: () => '',
  experimentLink: () => '',
} as never;

function renderSidebar(initialPath: string) {
  server.use(...commonHandlers());

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <LinkComponentProvider Link={StubLink as never} navigate={() => {}} paths={noopPaths}>
            <TooltipProvider>
              <MainSidebarProvider>
                <AgentBuilderSidebar />
              </MainSidebarProvider>
            </TooltipProvider>
          </LinkComponentProvider>
        ),
      },
    ],
    { initialEntries: [initialPath] },
  );

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

describe('AgentBuilderSidebar', () => {
  afterEach(() => {
    cleanup();
  });

  describe('when rendered on the agents route', () => {
    it('renders My agents, Favorites, and Library links pointing at their routes', async () => {
      renderSidebar('/agent-builder/agents');

      const agents = await screen.findByRole('link', { name: /My agents/i });
      const favorites = await screen.findByRole('link', { name: /Favorites/i });
      const library = await screen.findByRole('link', { name: /Library/i });

      expect(agents.getAttribute('href')).toBe('/agent-builder/agents');
      expect(favorites.getAttribute('href')).toBe('/agent-builder/favorite');
      expect(library.getAttribute('href')).toBe('/agent-builder/library');
    });
  });

  describe('when on the library route', () => {
    it('marks only the Library link active', async () => {
      renderSidebar('/agent-builder/library');

      const libraryLink = await screen.findByRole('link', { name: /Library/i });
      expect(libraryLink.className).toMatch(/bg-sidebar-nav-active/);

      const agentsLink = await screen.findByRole('link', { name: /My agents/i });
      expect(agentsLink.className).not.toMatch(/bg-sidebar-nav-active/);
    });
  });

  describe('when on the favorites route', () => {
    it('marks only the Favorites link active', async () => {
      renderSidebar('/agent-builder/favorite');

      const favoritesLink = await screen.findByRole('link', { name: /Favorites/i });
      expect(favoritesLink.className).toMatch(/bg-sidebar-nav-active/);

      const agentsLink = await screen.findByRole('link', { name: /My agents/i });
      expect(agentsLink.className).not.toMatch(/bg-sidebar-nav-active/);

      const libraryLink = await screen.findByRole('link', { name: /Library/i });
      expect(libraryLink.className).not.toMatch(/bg-sidebar-nav-active/);
    });
  });
});
