import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { ConnectToolsSettings } from '../../../../../api/types';
import type { PlatformProviderConnection } from '../../../factory/services/platformConnect';
import { ConnectToolsSection } from '../ConnectToolsSection';
import { adminToolSettings, toolCatalog, toolConnections } from './fixtures/connectTools';

const authCalls: Array<{ integrationId: string; options: Record<string, unknown> }> = [];
vi.mock('@nangohq/frontend', () => {
  class Nango {
    auth(integrationId: string, options: Record<string, unknown>) {
      authCalls.push({ integrationId, options });
      return Promise.resolve({ connectionId: 'vendor-connection', providerConfigKey: integrationId });
    }
  }
  class AuthError extends Error {
    type = 'unknown';
  }
  return { default: Nango, AuthError };
});

const PLATFORM = `${TEST_BASE_URL}/web/integrations/platform`;
const CONNECT_TOOLS = `${TEST_BASE_URL}/web/config/connect-tools`;

function serveTools(settings: ConnectToolsSettings, connections: PlatformProviderConnection[]) {
  server.use(
    http.get(CONNECT_TOOLS, () => HttpResponse.json(settings)),
    http.get(`${PLATFORM}/catalog`, () => HttpResponse.json({ providers: toolCatalog })),
    http.get(`${PLATFORM}/connections`, () => HttpResponse.json({ connections })),
  );
}

beforeEach(() => {
  authCalls.length = 0;
});

describe('Mastra Connect tools settings', () => {
  it('saves the full provider list on toggle and rolls the switch back when the save fails', async () => {
    serveTools(adminToolSettings, toolConnections);
    const puts: unknown[] = [];
    let failNext = false;
    server.use(
      http.put(CONNECT_TOOLS, async ({ request }) => {
        const body = await request.json();
        puts.push(body);
        if (failNext) return HttpResponse.json({ error: 'storage_unavailable' }, { status: 500 });
        return HttpResponse.json({ ...adminToolSettings, enabledProviders: ['linear', 'slack'] });
      }),
    );
    renderWithProviders(<ConnectToolsSection />);

    const slack = await screen.findByRole('switch', { name: /Slack/ });
    const linear = screen.getByRole('switch', { name: /Linear/ });
    expect(slack).not.toBeChecked();
    expect(linear).toBeChecked();

    await userEvent.click(slack);
    await waitFor(() => expect(puts).toEqual([{ enabledProviders: ['linear', 'slack'] }]));
    expect(slack).toBeChecked();

    failNext = true;
    await userEvent.click(linear);
    await waitFor(() => expect(puts).toHaveLength(2));
    expect(puts[1]).toEqual({ enabledProviders: ['slack'] });
    await waitFor(() => expect(linear).toBeChecked());
    expect(slack).toBeChecked();
  });

  it('shows enabled providers to non-admins without letting them change it', async () => {
    serveTools({ ...adminToolSettings, canEdit: false }, toolConnections);
    renderWithProviders(<ConnectToolsSection />);

    const linear = await screen.findByRole('switch', { name: /Linear/ });
    expect(linear).toBeChecked();
    expect(linear).toBeDisabled();
    expect(screen.getByRole('switch', { name: /Slack/ })).toBeDisabled();
  });

  it('passes an MCP server URL to Nango as a flow param and lists the new provider switched off', async () => {
    const connections = [...toolConnections];
    serveTools(adminToolSettings, connections);
    server.use(
      http.post(`${PLATFORM}/notion-mcp/connect-session`, () => {
        connections.push({
          id: 'notion-acme',
          integrationId: 'notion-mcp',
          status: 'active',
          accountLabel: 'Acme Notion',
        });
        return HttpResponse.json(
          {
            connectionId: 'notion-acme',
            integrationId: 'notion-mcp',
            connectUrl: 'https://example.com/consent',
            sessionToken: 'session-token',
            expiresAt: '2099-01-01T00:00:00.000Z',
          },
          { status: 201 },
        );
      }),
    );
    renderWithProviders(<ConnectToolsSection />);

    await userEvent.click(await screen.findByRole('button', { name: 'Add provider' }));
    await userEvent.click(screen.getByRole('button', { name: 'Connect Notion MCP' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Notion MCP Server URL'), 'https://mcp.acme.dev');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Connect' }));

    expect(await screen.findByText('Acme Notion')).toBeInTheDocument();
    expect(authCalls).toEqual([
      {
        integrationId: 'notion-mcp',
        options: { params: { serverUrl: 'https://mcp.acme.dev' }, detectClosedAuthWindow: true },
      },
    ]);
    expect(screen.getByRole('switch', { name: /Notion MCP/ })).not.toBeChecked();
  });
});
