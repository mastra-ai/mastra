// @vitest-environment jsdom
import { MainSidebarProvider, TooltipProvider } from '@mastra/playground-ui';
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
import { LinkComponentProvider } from '@/lib/framework';

vi.mock('@/domains/agent-builder/hooks/use-builder-agent-features', () => ({
  useBuilderAgentFeatures: () => ({
    tools: true,
    memory: false,
    workflows: false,
    agents: false,
    avatarUpload: false,
    skills: false,
    model: false,
    favorites: false,
    browser: false,
  }),
}));

vi.mock('@/domains/agent-builder/hooks/use-builder-agent-access', () => ({
  useBuilderAgentAccess: () => ({
    hasAccess: true,
    canWrite: true,
    canExecute: true,
    canManageSkills: true,
    canUseFavorites: true,
    denialReason: null,
  }),
}));

vi.mock('@/domains/auth/hooks', () => ({
  useAuthCapabilities: () => ({ data: undefined, isLoading: false }),
}));

// `usePermissions` imports `useAuthCapabilities` directly (not via the barrel),
// so we also mock the direct path. Otherwise the hook hits `useQuery` without a
// `QueryClientProvider` in the sidebar test harness.
vi.mock('@/domains/auth/hooks/use-auth-capabilities', () => ({
  useAuthCapabilities: () => ({ data: undefined, isLoading: false }),
}));

// `usePermissions` also calls `useRoleImpersonation`, which depends on a
// react-query client. Stub it to a permissive default for the sidebar tests.
vi.mock('@/domains/auth/hooks/use-role-impersonation', () => ({
  useRoleImpersonation: () => ({
    impersonatedRole: null,
    impersonatedPermissions: null,
    isImpersonating: false,
    isSwitching: false,
    startImpersonation: async () => {},
    stopImpersonation: () => {},
  }),
}));

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

  return render(<RouterProvider router={router} />);
}

describe('AgentBuilderSidebar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders My agents, Favorites, and Library links', async () => {
    renderSidebar('/agent-builder/agents');

    const agents = await screen.findByRole('link', { name: /My agents/i });
    const favorites = await screen.findByRole('link', { name: /Favorites/i });
    const library = await screen.findByRole('link', { name: /Library/i });

    expect(agents.getAttribute('href')).toBe('/agent-builder/agents');
    expect(favorites.getAttribute('href')).toBe('/agent-builder/favorite');
    expect(library.getAttribute('href')).toBe('/agent-builder/library');
  });

  it('marks the Library link active when on /agent-builder/library', async () => {
    renderSidebar('/agent-builder/library');

    const libraryLink = await screen.findByRole('link', { name: /Library/i });
    expect(libraryLink.className).toMatch(/bg-sidebar-nav-active/);

    const agentsLink = await screen.findByRole('link', { name: /My agents/i });
    expect(agentsLink.className).not.toMatch(/bg-sidebar-nav-active/);
  });

  it('marks the Favorites link active when on /agent-builder/favorite', async () => {
    renderSidebar('/agent-builder/favorite');

    const favoritesLink = await screen.findByRole('link', { name: /Favorites/i });
    expect(favoritesLink.className).toMatch(/bg-sidebar-nav-active/);

    const agentsLink = await screen.findByRole('link', { name: /My agents/i });
    expect(agentsLink.className).not.toMatch(/bg-sidebar-nav-active/);

    const libraryLink = await screen.findByRole('link', { name: /Library/i });
    expect(libraryLink.className).not.toMatch(/bg-sidebar-nav-active/);
  });
});
