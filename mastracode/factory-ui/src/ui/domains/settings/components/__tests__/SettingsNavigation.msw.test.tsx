import { SidebarProvider } from '@mastra/playground-ui/components/Sidebar';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';

import { SettingsNavigation } from '../SettingsNavigation';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { ServerFeatures } from '../../../../../hooks/useServerFeatures';

const STORAGE_KEY = 'settings-navigation-test';

function renderNavigation() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1/settings/preferences']}>
      <SidebarProvider storageKey={STORAGE_KEY} mobileBreakpoint={0}>
        <Routes>
          <Route path="/factories/:factoryId/settings/:section" element={<SettingsNavigation />} />
        </Routes>
      </SidebarProvider>
    </MemoryRouter>,
  );
}

afterEach(() => window.localStorage.removeItem(STORAGE_KEY));

function serveFeatures(features: ServerFeatures) {
  server.use(http.get(`${TEST_BASE_URL}/web/config/features`, () => HttpResponse.json(features)));
}

const linksIn = (group: string) =>
  within(screen.getByRole('region', { name: group }))
    .getAllByRole('link')
    .map(link => link.textContent);

describe('SettingsNavigation', () => {
  it('links to My account settings', () => {
    renderNavigation();

    expect(screen.getByRole('link', { name: 'My account' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/account',
    );
  });

  it('groups destinations by topic: account, agent, Factory', () => {
    renderNavigation();

    expect(linksIn('Account')).toEqual(['My account', 'Preferences', 'Connections']);
    expect(linksIn('Agent')).toEqual(['Models', 'Memory', 'Skills', 'Behavior']);
    expect(linksIn('Factory')).toEqual(['Repositories', 'Work Intake', 'Manage Factory']);
    expect(screen.getByRole('link', { name: 'Models' })).toHaveAttribute('href', '/factories/fp-1/settings/models');
    expect(screen.getByRole('link', { name: 'Memory' })).toHaveAttribute('href', '/factories/fp-1/settings/memory');
  });

  it('lists MCP Servers right after Connections when the server supports them', async () => {
    serveFeatures({ knowledge: false, mcpServers: true });
    renderNavigation();

    expect(await screen.findByRole('link', { name: 'MCP Servers' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/mcp-servers',
    );
    expect(linksIn('Account')).toEqual(['My account', 'Preferences', 'Connections', 'MCP Servers']);
  });

  it('finds MCP Servers by what they connect with', async () => {
    serveFeatures({ knowledge: false, mcpServers: true });
    const user = userEvent.setup();
    renderNavigation();
    await screen.findByRole('link', { name: 'MCP Servers' });

    await user.type(screen.getByRole('searchbox', { name: 'Search settings' }), 'oauth');

    expect(linksIn('Account')).toEqual(['MCP Servers']);
  });

  it('hides MCP Servers when the server has them turned off', async () => {
    serveFeatures({ knowledge: false, mcpServers: false });
    const user = userEvent.setup();
    const { client } = renderNavigation();
    await waitForMutationsIdle(client);

    await user.type(screen.getByRole('searchbox', { name: 'Search settings' }), 'mcp');

    expect(screen.getByRole('link', { name: 'Connections' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'MCP Servers' })).not.toBeInTheDocument();
  });

  it('keeps legacy terms searchable while showing the clearer destination label', async () => {
    const user = userEvent.setup();
    renderNavigation();

    await user.type(screen.getByRole('searchbox', { name: 'Search settings' }), 'source control');

    expect(screen.getByRole('link', { name: 'Repositories' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Work Intake' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Account' })).not.toBeInTheDocument();
  });

  it('finds Environment under Manage Factory and navigates to its canonical destination', async () => {
    const user = userEvent.setup();
    renderNavigation();

    await user.type(screen.getByRole('searchbox', { name: 'Search settings' }), 'environment');

    const manageFactory = screen.getByRole('link', { name: 'Manage Factory' });
    expect(screen.queryByRole('link', { name: 'Environment' })).not.toBeInTheDocument();
    await user.click(manageFactory);
    expect(manageFactory).toHaveAttribute('aria-current', 'page');
  });

  it.each([
    { query: 'default model', destination: 'Models' },
    { query: 'your models', destination: 'Models' },
    { query: 'factory models', destination: 'Models' },
    { query: 'personal memory', destination: 'Memory' },
    { query: 'factory memory', destination: 'Memory' },
    { query: 'your memory', destination: 'Memory' },
    { query: 'shared memory', destination: 'Memory' },
  ])('finds $destination by the former page name "$query"', async ({ query, destination }) => {
    const user = userEvent.setup();
    renderNavigation();

    await user.type(screen.getByRole('searchbox', { name: 'Search settings' }), query);

    expect(screen.getByRole('link', { name: destination })).toBeInTheDocument();
  });
});
