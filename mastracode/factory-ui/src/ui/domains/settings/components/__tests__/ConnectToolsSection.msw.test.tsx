import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { ConnectTools, ConnectToolConnection } from '../../../factory/services/platformConnect';
import { ConnectToolsSection } from '../ConnectToolsSection';

const CONNECT_TOOLS = `${TEST_BASE_URL}/web/integrations/platform/connect-tools`;

function serveConnections(connections: ConnectToolConnection[], toolsSource: ConnectTools['toolsSource'] = 'default') {
  server.use(http.get(CONNECT_TOOLS, () => HttpResponse.json({ projectId: 'proj_1', toolsSource, connections })));
}

function serveOff(body: { reason?: string; message?: string }) {
  server.use(
    http.get(CONNECT_TOOLS, () => HttpResponse.json({ error: 'connect_tools_off', ...body }, { status: 404 })),
  );
}

function signInToOrganization(organizationId: string) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, user: { userId: 'user-1', organizationId } }),
    ),
  );
}

describe('Mastra Connect tools settings', () => {
  it("lists attached connections with account and reconnect status, and links to the project's Connect page", async () => {
    signInToOrganization('org_1');
    serveConnections([
      {
        id: 'conn-slack',
        integrationId: 'slack',
        providerName: 'Slack',
        logoUrl: null,
        accountLabel: 'Acme workspace',
        status: 'needs_reauth',
      },
      {
        id: 'conn-linear',
        integrationId: 'linear',
        providerName: 'Linear',
        logoUrl: null,
        accountLabel: null,
        status: 'active',
      },
    ]);
    renderWithProviders(<ConnectToolsSection />);

    expect(await screen.findByText('Slack')).toBeInTheDocument();
    expect(screen.getByText('Acme workspace')).toBeInTheDocument();
    expect(screen.getByText('Linear')).toBeInTheDocument();
    expect(screen.getAllByText('Needs reconnecting')).toHaveLength(1);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Manage in Mastra Platform' })).toHaveAttribute(
        'href',
        'https://projects.mastra.ai/orgs/org_1/projects/proj_1/settings/connect',
      ),
    );
  });

  it('explains how to attach a connection when the project has none', async () => {
    serveConnections([]);
    renderWithProviders(<ConnectToolsSection />);

    expect(await screen.findByText(/No connections are attached to this Factory's project yet/)).toBeInTheDocument();
    // Signed out of an organization, Platform's `/org/*` route picks the user's current one.
    expect(screen.getByRole('link', { name: 'Manage in Mastra Platform' })).toHaveAttribute(
      'href',
      'https://projects.mastra.ai/org/projects/proj_1/settings/connect',
    );
  });

  // #30579: a Factory that narrows Connect tools in its `tools` option was shown as "off" with no connections.
  it('lists the connections and says session tools are set in code when the Factory sets tools', async () => {
    serveConnections(
      [
        {
          id: 'conn-posthog',
          integrationId: 'posthog',
          providerName: 'PostHog',
          logoUrl: null,
          accountLabel: 'Acme analytics',
          status: 'active',
        },
      ],
      'custom',
    );
    renderWithProviders(<ConnectToolsSection />);

    expect(await screen.findByText('PostHog')).toBeInTheDocument();
    expect(screen.getByText(/This Factory sets its session tools in code/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage in Mastra Platform' })).toBeInTheDocument();
    expect(screen.queryByText(/Mastra Connect tools are off/)).not.toBeInTheDocument();
  });

  it("doesn't mention code when sessions get the default Connect tools", async () => {
    serveConnections([
      {
        id: 'conn-linear',
        integrationId: 'linear',
        providerName: 'Linear',
        logoUrl: null,
        accountLabel: null,
        status: 'active',
      },
    ]);
    renderWithProviders(<ConnectToolsSection />);

    expect(await screen.findByText('Linear')).toBeInTheDocument();
    expect(screen.queryByText(/sets its session tools in code/)).not.toBeInTheDocument();
  });

  it('names the missing Platform credentials when the Factory has none', async () => {
    serveOff({ reason: 'no_credentials' });
    renderWithProviders(<ConnectToolsSection />);

    const notice = await screen.findByText(
      /Mastra Connect tools are off: this Factory has no Mastra Platform credentials/,
    );
    expect(notice).toHaveTextContent('MASTRA_PLATFORM_SECRET_KEY');
    expect(notice).not.toHaveTextContent('MASTRA_PROJECT_ID');
    expect(notice).not.toHaveTextContent('tools option');
  });

  it('names the missing project id when the Factory has credentials but no MASTRA_PROJECT_ID', async () => {
    serveOff({ reason: 'no_project_id' });
    renderWithProviders(<ConnectToolsSection />);

    const notice = await screen.findByText(/this Factory has Platform credentials but no/);
    expect(notice).toHaveTextContent('MASTRA_PROJECT_ID');
    expect(notice).not.toHaveTextContent('MASTRA_PLATFORM_SECRET_KEY');
  });

  it('lists every possible cause when an older Factory gives no reason', async () => {
    serveOff({});
    renderWithProviders(<ConnectToolsSection />);

    expect(await screen.findByText(/sets a custom/)).toHaveTextContent(
      'Mastra Connect tools are off: this Factory sets a custom tools option or is missing Platform credentials or MASTRA_PROJECT_ID.',
    );
  });

  it('offers a retry, not setup guidance, when the Platform refuses the listing', async () => {
    server.use(
      http.get(CONNECT_TOOLS, () =>
        HttpResponse.json({ error: 'platform_forbidden', message: 'forbidden' }, { status: 403 }),
      ),
    );
    renderWithProviders(<ConnectToolsSection />);

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText(/Mastra Connect tools are off/)).not.toBeInTheDocument();
  });
});
