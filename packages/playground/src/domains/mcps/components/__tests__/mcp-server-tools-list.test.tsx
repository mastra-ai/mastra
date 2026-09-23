import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { McpServerToolsList } from '../mcp-server-tools-list';
import { legacyServer, toolList } from './fixtures/mcp-servers';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const renderList = () => {
  server.use(http.get(`${TEST_BASE_URL}/api/mcp/:serverId/tools`, () => HttpResponse.json(toolList)));
  return renderWithProviders(
    <TooltipProvider>
      <TestLinkProvider>
        <McpServerToolsList server={legacyServer} />
      </TestLinkProvider>
    </TooltipProvider>,
  );
};

describe('McpServerToolsList', () => {
  describe('when the server exposes tools', () => {
    it('links each row to its tool page', async () => {
      renderList();

      const echoLink = await screen.findByRole('link', { name: /echo/ });
      expect(echoLink.getAttribute('href')).toBe('/mcps/legacy/tools/echo');
      expect(screen.getByRole('link', { name: /weather-dashboard/ }).getAttribute('href')).toBe(
        '/mcps/legacy/tools/weather-dashboard',
      );
      expect(screen.getByRole('link', { name: /research-agent/ }).getAttribute('href')).toBe(
        '/mcps/legacy/tools/research-agent',
      );
    });

    it('marks MCP App tools with an App badge', async () => {
      renderList();

      const appRow = await screen.findByRole('link', { name: /weather-dashboard/ });
      expect(within(appRow).getByText('App')).not.toBeNull();
      expect(within(screen.getByRole('link', { name: /echo/ })).queryByText('App')).toBeNull();
    });

    it('shows each tool type as a labelled icon', async () => {
      renderList();

      const agentRow = await screen.findByRole('link', { name: /research-agent/ });
      expect(within(agentRow).getByLabelText('agent')).not.toBeNull();
      expect(within(screen.getByRole('link', { name: /echo/ })).getByLabelText('tool')).not.toBeNull();
    });
  });

  describe('when the user searches', () => {
    it('keeps only the matching tools', async () => {
      renderList();
      await screen.findByRole('link', { name: /echo/ });

      fireEvent.change(screen.getByRole('textbox', { name: 'Filter tools' }), { target: { value: 'weather' } });

      await waitFor(() => expect(screen.queryByRole('link', { name: /echo/ })).toBeNull());
      expect(screen.getByRole('link', { name: /weather-dashboard/ })).not.toBeNull();
    });

    it('shows a no-match message when nothing matches', async () => {
      renderList();
      await screen.findByRole('link', { name: /echo/ });

      fireEvent.change(screen.getByRole('textbox', { name: 'Filter tools' }), { target: { value: 'zzz' } });

      expect(await screen.findByText('No tools match your search')).not.toBeNull();
    });
  });
});
