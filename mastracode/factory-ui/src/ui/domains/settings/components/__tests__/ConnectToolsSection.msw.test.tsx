import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { MASTRA_PROJECTS_URL } from '../../../factory/services/gitlab';
import type { ConnectToolConnection } from '../../../factory/services/platformConnect';
import { ConnectToolsSection } from '../ConnectToolsSection';

const CONNECT_TOOLS = `${TEST_BASE_URL}/web/integrations/platform/connect-tools`;

function serveConnections(connections: ConnectToolConnection[]) {
  server.use(http.get(CONNECT_TOOLS, () => HttpResponse.json({ connections })));
}

describe('Mastra Connect tools settings', () => {
  it('lists attached connections with account and reconnect status, and links to Mastra Platform', async () => {
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
    expect(screen.getByRole('link', { name: 'Manage in Mastra Platform' })).toHaveAttribute(
      'href',
      MASTRA_PROJECTS_URL,
    );
  });

  it('explains how to attach a connection when the project has none', async () => {
    serveConnections([]);
    renderWithProviders(<ConnectToolsSection />);

    expect(await screen.findByText(/No connections are attached to this Factory's project yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage in Mastra Platform' })).toHaveAttribute(
      'href',
      MASTRA_PROJECTS_URL,
    );
  });

  it("says sessions get no Connect tools when this Factory doesn't give them any", async () => {
    server.use(http.get(CONNECT_TOOLS, () => HttpResponse.json({ error: 'connect_tools_off' }, { status: 404 })));
    renderWithProviders(<ConnectToolsSection />);

    expect(await screen.findByText(/Sessions on this Factory don't get Mastra Connect tools/)).toBeInTheDocument();
  });

  it('offers a retry, not setup guidance, when the Platform refuses the listing', async () => {
    server.use(
      http.get(CONNECT_TOOLS, () =>
        HttpResponse.json({ error: 'platform_forbidden', message: 'forbidden' }, { status: 403 }),
      ),
    );
    renderWithProviders(<ConnectToolsSection />);

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText(/Sessions on this Factory don't get Mastra Connect tools/)).not.toBeInTheDocument();
  });
});
