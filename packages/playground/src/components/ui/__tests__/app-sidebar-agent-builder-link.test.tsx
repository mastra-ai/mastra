import type { BuilderSettingsResponse } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui';
import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
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

import { AppSidebar } from '../app-sidebar';
import { RoleImpersonationProvider } from '@/domains/auth/context/role-impersonation-context';
import type { AuthCapabilities } from '@/domains/auth/types';
import { LinkComponentProvider } from '@/lib/framework';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const unauthenticatedCapabilities = {
  enabled: true,
  login: { type: 'credentials' as const },
} satisfies AuthCapabilities;

const authDisabledCapabilities = {
  enabled: false,
  login: { type: 'credentials' as const },
} satisfies AuthCapabilities;

const authenticatedNoRbacCapabilities = {
  enabled: true,
  login: { type: 'credentials' as const },
  user: { id: 'user-1', email: 'u@example.com' },
  capabilities: { user: true, session: true, sso: false, rbac: false, acl: false },
  access: null,
} satisfies AuthCapabilities;

const authenticatedAdminCapabilities = {
  enabled: true,
  login: { type: 'credentials' as const },
  user: { id: 'admin-1', email: 'admin@example.com' },
  capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
  access: { roles: ['admin'], permissions: ['stored-agents:read', 'stored-agents:write'] },
  availableRoles: [
    { id: 'admin', name: 'Admin' },
    { id: 'member', name: 'Member' },
  ],
} satisfies AuthCapabilities;

const authenticatedMemberCapabilities = {
  enabled: true,
  login: { type: 'credentials' as const },
  user: { id: 'member-1', email: 'member@example.com' },
  capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
  access: { roles: ['member'], permissions: ['stored-agents:read'] },
} satisfies AuthCapabilities;

const builderFullySetUp: BuilderSettingsResponse = {
  enabled: true,
  features: { agent: {} },
};

const builderDisabled: BuilderSettingsResponse = {
  enabled: false,
};

const builderEnabledWithoutAgent: BuilderSettingsResponse = {
  enabled: true,
  features: {},
};

function authHandler(capabilities: AuthCapabilities, opts?: { gate?: Promise<void> }) {
  return http.get(`${BASE_URL}/api/auth/capabilities`, async () => {
    if (opts?.gate) await opts.gate;
    return HttpResponse.json(capabilities);
  });
}

function builderHandler(settings: BuilderSettingsResponse) {
  return http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(settings));
}

function systemPackagesHandler() {
  return http.get(`${BASE_URL}/api/system/packages`, () =>
    HttpResponse.json({ packages: [], cmsEnabled: false, observabilityEnabled: false }),
  );
}

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

function renderSidebar(initialPath = '/agents') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <RoleImpersonationProvider>
          <LinkComponentProvider Link={StubLink as never} navigate={() => {}} paths={noopPaths}>
            <MemoryRouter initialEntries={[initialPath]}>
              <TooltipProvider>
                <MainSidebarProvider>
                  <AppSidebar />
                </MainSidebarProvider>
              </TooltipProvider>
            </MemoryRouter>
          </LinkComponentProvider>
        </RoleImpersonationProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

beforeEach(() => {
  // ensure MASTRA_CLOUD_API_ENDPOINT isn't set — keeps useMastraPlatform off so
  // mainNav items aren't filtered out unexpectedly.
  (window as unknown as Record<string, unknown>).MASTRA_CLOUD_API_ENDPOINT = '';
});

afterEach(() => {
  server.resetHandlers();
  cleanup();
});

describe('AppSidebar — Agent Builder admin link', () => {
  it('does not render the Agent Builder link for unauthenticated users', async () => {
    server.use(authHandler(unauthenticatedCapabilities), builderHandler(builderFullySetUp), systemPackagesHandler());

    renderSidebar();

    // Wait until the auth query has resolved so the conditional has run.
    await waitFor(() => {
      // capabilities query result is consumed; if AuthStatus had rendered a login
      // button or the link were going to appear, the conditional would have fired.
      expect(screen.queryByRole('link', { name: /agent builder/i })).toBeNull();
    });
  });

  it('renders the Agent Builder link when RBAC is off and the builder is enabled', async () => {
    server.use(
      authHandler(authenticatedNoRbacCapabilities),
      builderHandler(builderFullySetUp),
      systemPackagesHandler(),
    );

    renderSidebar();

    const link = await screen.findByRole('link', { name: /agent builder/i });
    expect(link.getAttribute('href')).toBe('/agent-builder');
  });

  it('renders the Agent Builder link for admin users when RBAC is on and the builder is enabled', async () => {
    server.use(authHandler(authenticatedAdminCapabilities), builderHandler(builderFullySetUp), systemPackagesHandler());

    renderSidebar();

    const link = await screen.findByRole('link', { name: /agent builder/i });
    expect(link.getAttribute('href')).toBe('/agent-builder');
  });

  it('renders the Agent Builder link for users with a wildcard permission under RBAC', async () => {
    const wildcardCapabilities = {
      enabled: true,
      login: { type: 'credentials' as const },
      user: { id: 'wildcard-1', email: 'wildcard@example.com' },
      capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
      access: { roles: ['superuser'], permissions: ['*'] },
    } satisfies AuthCapabilities;

    server.use(authHandler(wildcardCapabilities), builderHandler(builderFullySetUp), systemPackagesHandler());

    renderSidebar();

    const link = await screen.findByRole('link', { name: /agent builder/i });
    expect(link.getAttribute('href')).toBe('/agent-builder');
  });

  it('renders the Agent Builder link for users with stored-agents:* under RBAC', async () => {
    const resourceWildcardCapabilities = {
      enabled: true,
      login: { type: 'credentials' as const },
      user: { id: 'agents-admin-1', email: 'agents-admin@example.com' },
      capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
      access: { roles: ['agents-admin'], permissions: ['stored-agents:*'] },
    } satisfies AuthCapabilities;

    server.use(authHandler(resourceWildcardCapabilities), builderHandler(builderFullySetUp), systemPackagesHandler());

    renderSidebar();

    const link = await screen.findByRole('link', { name: /agent builder/i });
    expect(link.getAttribute('href')).toBe('/agent-builder');
  });

  it('renders the Agent Builder link for member users with stored-agents:read under RBAC', async () => {
    // Members can reach the agent-builder view page, so the sidebar shortcut
    // must follow the same rule as `AgentBuilderRootLayout` and show for any
    // user whose permissions clear `canAccessAgentBuilder`.
    server.use(
      authHandler(authenticatedMemberCapabilities),
      builderHandler(builderFullySetUp),
      systemPackagesHandler(),
    );

    renderSidebar();

    const link = await screen.findByRole('link', { name: /agent builder/i });
    expect(link.getAttribute('href')).toBe('/agent-builder');
  });

  it('does not render the Agent Builder link for users without stored-agents permissions under RBAC', async () => {
    const noAgentPermsCapabilities = {
      enabled: true,
      login: { type: 'credentials' as const },
      user: { id: 'viewer-1', email: 'viewer@example.com' },
      capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
      access: { roles: ['viewer'], permissions: ['workflows:read'] },
    } satisfies AuthCapabilities;

    server.use(authHandler(noAgentPermsCapabilities), builderHandler(builderFullySetUp), systemPackagesHandler());

    renderSidebar();

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /agent builder/i })).toBeNull();
    });
  });

  it('does not render the Agent Builder link when the builder is disabled', async () => {
    server.use(authHandler(authenticatedAdminCapabilities), builderHandler(builderDisabled), systemPackagesHandler());

    renderSidebar();

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /agent builder/i })).toBeNull();
    });
  });

  it('does not render the Agent Builder link when the agent feature is missing', async () => {
    server.use(
      authHandler(authenticatedAdminCapabilities),
      builderHandler(builderEnabledWithoutAgent),
      systemPackagesHandler(),
    );

    renderSidebar();

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /agent builder/i })).toBeNull();
    });
  });

  it('renders the Agent Builder link when auth is disabled and the builder is enabled', async () => {
    // With auth disabled there is a single local user with full access, so the
    // sidebar shortcut should appear as long as the builder is configured.
    server.use(authHandler(authDisabledCapabilities), builderHandler(builderFullySetUp), systemPackagesHandler());

    renderSidebar();

    const link = await screen.findByRole('link', { name: /agent builder/i });
    expect(link.getAttribute('href')).toBe('/agent-builder');
  });
});

describe('AppSidebar — RBAC link gating while permission data loads', () => {
  const wildcardCapabilities = {
    enabled: true,
    login: { type: 'credentials' as const },
    user: { id: 'superuser-1', email: 'superuser@example.com' },
    capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
    access: { roles: ['superuser'], permissions: ['*'] },
  } satisfies AuthCapabilities;

  it('hides permission-gated links until the user permissions finish loading, then reveals them', async () => {
    // Gate the capabilities response so the permissions query stays in its
    // loading state. While loading, no permission-gated link should render —
    // being permissive here would briefly leak unauthorized routes. Permission
    // patterns are loaded once by RoutePermissionsGate before the sidebar
    // renders, so the sidebar's only loading signal is the user's permissions.
    let resolveCapabilities: () => void = () => {};
    const capabilitiesGate = new Promise<void>(resolve => {
      resolveCapabilities = resolve;
    });

    server.use(
      authHandler(wildcardCapabilities, { gate: capabilitiesGate }),
      builderHandler(builderDisabled),
      systemPackagesHandler(),
    );

    renderSidebar();

    // The Agents link requires `agents:read`; the wildcard user clears it, but
    // it must stay hidden while the user's permissions are still loading.
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /agents/i })).toBeNull();
    });

    resolveCapabilities();

    // Once permissions resolve, the gated link is allowed to appear.
    const agentsLink = await screen.findByRole('link', { name: /agents/i });
    expect(agentsLink.getAttribute('href')).toBe('/agents');
  });

  it('shows permission-gated links the user is allowed once permissions are loaded', async () => {
    server.use(authHandler(wildcardCapabilities), builderHandler(builderDisabled), systemPackagesHandler());

    renderSidebar();

    const agentsLink = await screen.findByRole('link', { name: /agents/i });
    expect(agentsLink.getAttribute('href')).toBe('/agents');
  });
});
