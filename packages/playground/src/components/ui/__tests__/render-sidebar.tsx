import type { BuilderSettingsResponse } from '@mastra/client-js';
import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';

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

export const BASE_URL = 'http://localhost:4111';

export function authHandler(capabilities: AuthCapabilities, opts?: { gate?: Promise<void> }) {
  return http.get(`${BASE_URL}/api/auth/capabilities`, async () => {
    if (opts?.gate) await opts.gate;
    return HttpResponse.json(capabilities);
  });
}

export function builderHandler(settings: BuilderSettingsResponse) {
  return http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(settings));
}

export function systemPackagesHandler() {
  return http.get(`${BASE_URL}/api/system/packages`, () =>
    HttpResponse.json({ packages: [], cmsEnabled: false, observabilityEnabled: false }),
  );
}

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
  experimentLink: () => '',
} as never;

export function renderSidebar(initialPath = '/agents') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <RoleImpersonationProvider>
          <LinkComponentProvider Link={'a' as never} navigate={() => {}} paths={noopPaths}>
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
