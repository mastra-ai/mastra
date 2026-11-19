import type { InfrastructureStatusResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import type { AuthCapabilities } from '@mastra/react/hooks/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { InfrastructureOverview } from '../infrastructure-overview';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const signedIn = {
  enabled: true,
  login: { type: 'credentials' as const },
  user: { id: 'user-1', email: 'u@example.com' },
  capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
  access: { roles: ['admin'], permissions: ['infrastructure:read'] },
} satisfies AuthCapabilities;

const signedInWithoutInfrastructureAccess = {
  ...signedIn,
  access: { roles: ['member'], permissions: [] },
} satisfies AuthCapabilities;

const configuredInfrastructure = {
  channels: { providers: [{ id: 'slack', name: 'slack', isConfigured: true, routeCount: 4 }] },
  browser: {
    type: null,
    provider: null,
    env: null,
    registered: false,
    availableProviders: [],
    config: [],
  },
  workspace: {
    type: 'id',
    workspaceId: 'builder-workspace',
    name: 'Builder workspace',
    source: null,
    registered: true,
    hasFilesystem: true,
    hasSandbox: false,
    filesystemProvider: 'local',
    sandboxProvider: null,
    config: [],
  },
  registries: { skillsSh: { enabled: true } },
} satisfies InfrastructureStatusResponse;

function renderOverview(capabilities: AuthCapabilities) {
  server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(capabilities)));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <InfrastructureOverview />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

describe('Agent Builder infrastructure overview', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows an admin the configured channels, registries and workspace', async () => {
    server.use(
      http.get(`${BASE_URL}/api/editor/builder/infrastructure`, () => HttpResponse.json(configuredInfrastructure)),
    );

    renderOverview(signedIn);

    expect(await screen.findByText('Slack')).toBeTruthy();
    expect(screen.getByText('Configured')).toBeTruthy();
    expect(screen.getByText('No browser configured.')).toBeTruthy();
    expect(screen.getByText('Enabled')).toBeTruthy();
    expect(screen.getAllByText('builder-workspace')).toHaveLength(2);
    expect(screen.getByText('Local')).toBeTruthy();
    expect(screen.getByText('Not set')).toBeTruthy();
  });

  it('tells a member without infrastructure access that they cannot view it, without asking the server', async () => {
    let requestedInfrastructure = false;
    server.use(
      http.get(`${BASE_URL}/api/editor/builder/infrastructure`, () => {
        requestedInfrastructure = true;
        return HttpResponse.json(configuredInfrastructure);
      }),
    );

    renderOverview(signedInWithoutInfrastructureAccess);

    expect(await screen.findByText('You do not have permission to view Agent Builder infrastructure.')).toBeTruthy();
    expect(requestedInfrastructure).toBe(false);
  });

  it('says the configuration is unavailable when the server fails', async () => {
    server.use(
      http.get(`${BASE_URL}/api/editor/builder/infrastructure`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );

    renderOverview(signedIn);

    expect(await screen.findByText('Infrastructure configuration unavailable.')).toBeTruthy();
  });
});
