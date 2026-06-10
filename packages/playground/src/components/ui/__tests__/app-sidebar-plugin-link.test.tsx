// @vitest-environment jsdom
import type { BuilderSettingsResponse } from '@mastra/client-js';
import { MainSidebarProvider, TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// jsdom doesn't provide ResizeObserver, which ScrollArea expects.
globalThis.ResizeObserver ??= class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof globalThis.ResizeObserver;

if (typeof Element !== 'undefined' && typeof Element.prototype.getAnimations !== 'function') {
  Element.prototype.getAnimations = function getAnimations() {
    return [] as Animation[];
  };
}

import { AppSidebar } from '../app-sidebar';
import { RoleImpersonationProvider } from '@/domains/auth/context/role-impersonation-context';
import type { AuthCapabilities } from '@/domains/auth/types';
import { LinkComponentProvider } from '@/lib/framework';
import { registerStudioPlugin, resetStudioPluginsForTests } from '@/plugins';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const authDisabledCapabilities = {
  enabled: false,
  login: { type: 'credentials' as const },
} satisfies AuthCapabilities;

const builderDisabled: BuilderSettingsResponse = {
  enabled: false,
};

function authHandler(capabilities: AuthCapabilities) {
  return http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(capabilities));
}

function builderHandler(settings: BuilderSettingsResponse) {
  return http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(settings));
}

function systemPackagesHandler() {
  return http.get(`${BASE_URL}/api/system/packages`, () =>
    HttpResponse.json({ packages: [], cmsEnabled: false, observabilityEnabled: false }),
  );
}

function CounterIcon() {
  return <svg aria-hidden="true" />;
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
  (window as unknown as Record<string, unknown>).MASTRA_CLOUD_API_ENDPOINT = '';
});

afterEach(() => {
  server.resetHandlers();
  resetStudioPluginsForTests();
  cleanup();
});

describe('AppSidebar — Studio plugin links', () => {
  it('renders registered plugin nav items in the sidebar', async () => {
    registerStudioPlugin({
      id: 'counter',
      name: 'Counter tools',
      navItems: [{ name: 'Counter', url: '/counter', Icon: CounterIcon }],
    });

    server.use(authHandler(authDisabledCapabilities), builderHandler(builderDisabled), systemPackagesHandler());

    renderSidebar();

    const link = await screen.findByRole('link', { name: /counter/i });
    expect(link.getAttribute('href')).toBe('/counter');
  });
});
