import type { GetBuiltinMcpServerResponse, McpServerListResponse } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import MCPsPage from '..';
import {
  customPathServer,
  disabledByConfig,
  disabledInProduction,
  missingPackageServer,
  noUserServers,
  oneUserServer,
  openDevServer,
  openEverywhereServer,
  protectedServer,
  protectedUnnamedServer,
} from './fixtures/builtin-mcp-server';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const CARD_NAME = 'Mastra (built-in) MCP server';

const useServers = ({
  builtin,
  registry = noUserServers,
  prefix = '/api',
}: {
  builtin: GetBuiltinMcpServerResponse | 404;
  registry?: McpServerListResponse;
  prefix?: string;
}) => {
  const onDescriptorRequest = vi.fn<(url: string) => void>();
  server.use(
    http.get(`${TEST_BASE_URL}${prefix}/mcp/builtin`, ({ request }) => {
      onDescriptorRequest(request.url);
      return builtin === 404 ? HttpResponse.json({ error: 'Not Found' }, { status: 404 }) : HttpResponse.json(builtin);
    }),
    http.get(`${TEST_BASE_URL}${prefix}/mcp/v0/servers`, () => HttpResponse.json(registry)),
    http.get(`${TEST_BASE_URL}${prefix}/mcp/:serverId/tools`, () => HttpResponse.json({ tools: [] })),
  );
  return { onDescriptorRequest };
};

const renderPage = (options: { apiPrefix?: string } = {}) =>
  renderWithProviders(
    <TestLinkProvider>
      <Routes>
        <Route path="/mcps" element={<MCPsPage />} />
      </Routes>
    </TestLinkProvider>,
    { router: { initialEntries: ['/mcps'] }, ...options },
  );

const findCard = () => screen.findByRole('region', { name: CARD_NAME });

/** The snippet shown for a connect tab, as the user would copy it. */
const snippetFor = async (tab: string) => {
  const card = await findCard();
  fireEvent.click(within(card).getByRole('tab', { name: tab }));
  await waitFor(() => expect(within(card).getByRole('tab', { name: tab }).getAttribute('aria-selected')).toBe('true'));
  return codeIn(card);
};

/** The code shown in the card's code block, without its tab labels. */
const codeIn = (card: HTMLElement) => within(card).getByRole('figure').querySelector('pre')?.textContent ?? '';

describe('MCP servers page — built-in Mastra server', () => {
  describe('when the built-in server is open under mastra dev', () => {
    it('shows the dev-only open badge', async () => {
      useServers({ builtin: openDevServer });
      renderPage();

      expect(await within(await findCard()).findByText('Open in dev only')).not.toBeNull();
    });

    it('shows the endpoint URL from the client base URL and the served path', async () => {
      useServers({ builtin: openDevServer });
      renderPage();

      expect(await within(await findCard()).findByText(`${TEST_BASE_URL}/api/mcp`)).not.toBeNull();
    });

    it('lists the enabled toolsets', async () => {
      useServers({ builtin: openDevServer });
      renderPage();

      const toolsets = within(await findCard()).getByRole('list', { name: 'Toolsets' });
      expect(
        within(toolsets)
          .getAllByRole('listitem')
          .map(item => item.textContent),
      ).toEqual(['Agents', 'Workflows', 'Tools', 'Observability analytics']);
    });

    it('offers a Claude Code command for the endpoint without an auth header', async () => {
      useServers({ builtin: openDevServer });
      renderPage();

      expect(await snippetFor('Claude Code')).toBe(`claude mcp add --transport http mastra ${TEST_BASE_URL}/api/mcp`);
    });

    it('offers Cursor, VS Code and MCP Inspector configs for the endpoint', async () => {
      useServers({ builtin: openDevServer });
      renderPage();

      expect(JSON.parse(await snippetFor('Cursor'))).toEqual({
        mcpServers: { mastra: { url: `${TEST_BASE_URL}/api/mcp` } },
      });
      expect(JSON.parse(await snippetFor('VS Code'))).toEqual({
        servers: { mastra: { type: 'http', url: `${TEST_BASE_URL}/api/mcp` } },
      });
      expect(await snippetFor('MCP Inspector')).toBe(
        `npx @modelcontextprotocol/inspector --cli ${TEST_BASE_URL}/api/mcp --transport http --method tools/list`,
      );
    });

    it('shows the card above the empty registry state', async () => {
      useServers({ builtin: openDevServer });
      renderPage();

      await findCard();
      expect(screen.getByText('No MCP Servers yet')).not.toBeNull();
    });
  });

  describe('when the built-in server is open outside mastra dev', () => {
    it('warns that anyone can connect', async () => {
      useServers({ builtin: openEverywhereServer });
      renderPage();

      expect(await within(await findCard()).findByText('Open to anyone')).not.toBeNull();
    });
  });

  describe('when the built-in server is protected by a named provider', () => {
    it('names the provider in the auth badge', async () => {
      useServers({ builtin: protectedServer });
      renderPage();

      expect(await within(await findCard()).findByText('Protected by clerk')).not.toBeNull();
    });

    it('adds a placeholder bearer header to every snippet', async () => {
      useServers({ builtin: protectedServer });
      renderPage();

      expect(await snippetFor('Claude Code')).toBe(
        `claude mcp add --transport http mastra ${TEST_BASE_URL}/api/mcp --header "Authorization: Bearer <your-token>"`,
      );
      expect(JSON.parse(await snippetFor('Cursor'))).toEqual({
        mcpServers: { mastra: { url: `${TEST_BASE_URL}/api/mcp`, headers: { Authorization: 'Bearer <your-token>' } } },
      });
      expect(JSON.parse(await snippetFor('VS Code'))).toEqual({
        servers: {
          mastra: { type: 'http', url: `${TEST_BASE_URL}/api/mcp`, headers: { Authorization: 'Bearer <your-token>' } },
        },
      });
      expect(await snippetFor('MCP Inspector')).toContain('--header "Authorization: Bearer <your-token>"');
    });

    it('marks a read-only server', async () => {
      useServers({ builtin: protectedServer });
      renderPage();

      const toolsets = within(await findCard()).getByRole('list', { name: 'Toolsets' });
      expect(within(toolsets).getByText('Read-only')).not.toBeNull();
    });
  });

  describe('when the built-in server is protected by an unnamed auth config', () => {
    it('falls back to a generic auth badge', async () => {
      useServers({ builtin: protectedUnnamedServer });
      renderPage();

      expect(await within(await findCard()).findByText('Protected by server auth')).not.toBeNull();
    });
  });

  describe('when the server mounts the built-in server on a custom path behind a custom apiPrefix', () => {
    it('asks for the descriptor under the client apiPrefix', async () => {
      const { onDescriptorRequest } = useServers({ builtin: customPathServer, prefix: '/mastra' });
      renderPage({ apiPrefix: '/mastra' });

      await findCard();
      expect(onDescriptorRequest).toHaveBeenCalledWith(`${TEST_BASE_URL}/mastra/mcp/builtin`);
    });

    it('uses the served path in the endpoint and snippets', async () => {
      useServers({ builtin: customPathServer, prefix: '/mastra' });
      renderPage({ apiPrefix: '/mastra' });

      expect(await within(await findCard()).findByText(`${TEST_BASE_URL}/mastra/tools-mcp`)).not.toBeNull();
      expect(await snippetFor('Claude Code')).toBe(
        `claude mcp add --transport http mastra ${TEST_BASE_URL}/mastra/tools-mcp`,
      );
    });
  });

  describe('when @mastra/mcp is not installed', () => {
    it('shows the install command', async () => {
      useServers({ builtin: missingPackageServer });
      renderPage();

      const card = await findCard();
      expect(within(card).getByText('Not installed')).not.toBeNull();
      expect(codeIn(card)).toBe('npm install @mastra/mcp');
    });

    it('offers no connect snippets', async () => {
      useServers({ builtin: missingPackageServer });
      renderPage();

      expect(within(await findCard()).queryByRole('tab', { name: 'Claude Code' })).toBeNull();
    });
  });

  describe('when the built-in server is disabled in config', () => {
    it('explains that server.mcp.enabled is false', async () => {
      useServers({ builtin: disabledByConfig });
      renderPage();

      const card = await findCard();
      expect(within(card).getByText('Disabled')).not.toBeNull();
      expect(within(card).getByText(/server\.mcp\.enabled is false/)).not.toBeNull();
    });

    it('offers no endpoint or snippets', async () => {
      useServers({ builtin: disabledByConfig });
      renderPage();

      const card = await findCard();
      expect(within(card).queryByRole('figure')).toBeNull();
      expect(within(card).queryByText(/\/api\/mcp/)).toBeNull();
    });
  });

  describe('when the built-in server is off in production because the server has no auth', () => {
    it('explains how to turn it on', async () => {
      useServers({ builtin: disabledInProduction });
      renderPage();

      expect(
        within(await findCard()).getByText(/Configure server\.auth, or set server\.mcp\.enabled to true/),
      ).not.toBeNull();
    });
  });

  describe('when the server predates the descriptor route', () => {
    it('hides the built-in card and still lists registered servers', async () => {
      const { onDescriptorRequest } = useServers({ builtin: 404, registry: oneUserServer });
      renderPage();

      expect(await screen.findByText('Notes MCP')).not.toBeNull();
      await waitFor(() => expect(onDescriptorRequest).toHaveBeenCalled());
      expect(screen.queryByRole('region', { name: CARD_NAME })).toBeNull();
    });
  });

  describe('when the app also registers its own MCP servers', () => {
    it('shows the built-in card alongside the registered servers', async () => {
      useServers({ builtin: openDevServer, registry: oneUserServer });
      renderPage();

      expect(await screen.findByText('Notes MCP')).not.toBeNull();
      expect(await findCard()).not.toBeNull();
    });
  });
});
