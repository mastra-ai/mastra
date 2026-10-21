/**
 * The Connections section tells a user where to point Claude or ChatGPT at
 * this Factory. Drives the real feature-flag hook through MSW.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '../../../../../api/keys';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { McpClientsSection } from '../McpClientsSection';

function serverFeatures(features: { knowledge: boolean; mcp?: boolean }) {
  server.use(http.get(`${TEST_BASE_URL}/web/config/features`, () => HttpResponse.json(features)));
}

function renderSection(factoryId = 'fp-1') {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${factoryId}/settings/connections`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/settings/connections"
          element={
            <>
              <McpClientsSection />
              <p>Connections loaded</p>
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('McpClientsSection', () => {
  describe('when the server serves MCP', () => {
    it('shows this Factory’s MCP URL with connect steps, and copies it', async () => {
      serverFeatures({ knowledge: false, mcp: true });
      const user = userEvent.setup();

      renderSection();

      const url = `${TEST_BASE_URL}/web/factory/projects/fp-1/mcp`;
      expect(await screen.findByText(url)).toBeInTheDocument();
      expect(screen.getByText('Settings → Connectors → Add custom connector, paste the URL')).toBeInTheDocument();
      expect(screen.getByText('Settings → Connectors → Create, paste the URL, choose OAuth')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Copy MCP URL' }));

      expect(await navigator.clipboard.readText()).toBe(url);
    });
  });

  describe('when the server does not serve MCP', () => {
    it.each([
      { name: 'reports it off', features: { knowledge: true, mcp: false } },
      { name: 'predates the flag', features: { knowledge: true } },
    ])('shows no MCP card when the server $name', async ({ features }) => {
      serverFeatures(features);

      const { client } = renderSection();

      // Wait for the flag to arrive so the card had its chance to render.
      await waitFor(() => expect(client.getQueryData(queryKeys.serverFeatures())).toEqual(features));
      expect(screen.getByText('Connections loaded')).toBeInTheDocument();
      expect(screen.queryByText('MCP clients')).not.toBeInTheDocument();
      expect(screen.queryByText(/\/mcp$/)).not.toBeInTheDocument();
    });
  });
});
