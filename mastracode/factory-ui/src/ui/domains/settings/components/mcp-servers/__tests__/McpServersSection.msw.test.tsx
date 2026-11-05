import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/ui/render';
import type {
  CreateMcpServerRequest,
  McpOAuthStartResponse,
  McpServerInfo,
  McpServerResponse,
  McpServersResponse,
  SelectMcpServerToolsRequest,
  UpdateMcpServerRequest,
} from '../../../../../../api/types';
import type { ServerFeatures } from '../../../../../../hooks/useServerFeatures';
import { goToMcpServerSignIn } from '../../../services/mcpServers';
import type * as McpServersServices from '../../../services/mcpServers';
import { McpServersSection } from '../McpServersSection';
import { CRM_ID, crmServer, DOCS_ID, docsServer } from './fixtures/mcpServers';

// jsdom's `window.location.assign` is unforgeable, so only the navigation helper is stubbed.
vi.mock('../../../services/mcpServers', async importOriginal => ({
  ...(await importOriginal<typeof McpServersServices>()),
  goToMcpServerSignIn: vi.fn(),
}));

afterEach(() => vi.mocked(goToMcpServerSignIn).mockClear());

const API = `${TEST_BASE_URL}/web/config/mcp-servers`;
const AUTHORIZATION_URL = 'https://auth.example.com/authorize?client_id=factory-client&state=signed';
const DISCOVERED_TOOLS: McpServerInfo['tools'] = [
  { name: 'lookup', exposedName: 'search_lookup', description: 'Look something up.', selected: true, isNew: false },
];

type Call = { method: string; path: string; body?: unknown };

/**
 * A stateful stand-in for the Factory's MCP server routes: mutations change
 * what the next list returns, like the real ones.
 */
// Deliberately not the UI's API origin: the Factory reports the redirect URI its callback is served on.
const REDIRECT_URI = 'https://factory.example.com/auth/mcp-servers/callback';

function mockMcpServersApi({
  servers: initial = [docsServer, crmServer],
  canManage = true,
  metadataDocument = true,
}: { servers?: McpServerInfo[]; canManage?: boolean; metadataDocument?: boolean } = {}) {
  let servers = initial.map(record => structuredClone(record));
  const calls: Call[] = [];
  const features: ServerFeatures = { knowledge: false, mcpServers: true };
  const find = (id: string | readonly string[] | undefined) => servers.find(record => record.id === id);
  const replace = (next: McpServerInfo) => {
    servers = servers.map(record => (record.id === next.id ? next : record));
    return next;
  };
  const record = (method: string, path: string, body?: unknown) =>
    calls.push({ method, path, ...(body === undefined ? {} : { body }) });

  server.use(
    http.get(`${TEST_BASE_URL}/web/config/features`, () => HttpResponse.json(features)),
    http.get(API, () => {
      record('GET', '');
      return HttpResponse.json<McpServersResponse>({
        servers,
        canManage,
        oauth: { metadataDocument, redirectUri: REDIRECT_URI },
      });
    }),
    http.post<never, CreateMcpServerRequest>(API, async ({ request }) => {
      const body = await request.json();
      record('POST', '', body);
      const created: McpServerInfo = {
        id: `33333333-3333-4333-8333-33333333333${servers.length}`,
        name: body.name,
        slug: body.name.toLowerCase(),
        url: body.url,
        authType: body.authType,
        headerNames: body.headers?.map(header => header.name) ?? [],
        ...(body.authType === 'oauth'
          ? {
              oauth: {
                clientId: body.oauth?.clientId ?? null,
                hasClientSecret: Boolean(body.oauth?.clientSecret),
                scopes: body.oauth?.scopes ?? [],
                connected: false,
              },
            }
          : {}),
        status: 'unknown',
        lastError: null,
        discoveredAt: null,
        tools: [],
      };
      servers = [...servers, created];
      return HttpResponse.json<McpServerResponse>({ server: created }, { status: 201 });
    }),
    http.patch<{ id: string }, UpdateMcpServerRequest>(`${API}/:id`, async ({ params, request }) => {
      const body = await request.json();
      record('PATCH', `/${params.id}`, body);
      const current = find(params.id)!;
      const credentialsChanged = body.headers !== undefined || (body.url !== undefined && body.url !== current.url);
      return HttpResponse.json<McpServerResponse>({
        server: replace({
          ...current,
          ...(body.name ? { name: body.name } : {}),
          ...(body.url ? { url: body.url } : {}),
          ...(body.headers ? { headerNames: body.headers.map(header => header.name) } : {}),
          ...(credentialsChanged ? { status: 'unknown' as const, tools: [], discoveredAt: null } : {}),
        }),
      });
    }),
    http.delete(`${API}/:id`, ({ params }) => {
      record('DELETE', `/${params.id}`);
      servers = servers.filter(item => item.id !== params.id);
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${API}/:id/discover`, ({ params }) => {
      record('POST', `/${params.id}/discover`);
      const current = find(params.id)!;
      return HttpResponse.json<McpServerResponse>({
        server: replace({
          ...current,
          status: 'connected',
          discoveredAt: '2026-11-05T09:00:00.000Z',
          tools: current.tools.length > 0 ? current.tools : DISCOVERED_TOOLS,
        }),
      });
    }),
    http.put<{ id: string }, SelectMcpServerToolsRequest>(`${API}/:id/tools`, async ({ params, request }) => {
      const body = await request.json();
      record('PUT', `/${params.id}/tools`, body);
      const current = find(params.id)!;
      return HttpResponse.json<McpServerResponse>({
        server: replace({
          ...current,
          tools: current.tools.map(tool => ({ ...tool, selected: body.selected.includes(tool.name), isNew: false })),
        }),
      });
    }),
    http.post(`${API}/:id/oauth/start`, async ({ params, request }) => {
      record('POST', `/${params.id}/oauth/start`, await request.json());
      return HttpResponse.json<McpOAuthStartResponse>({ authorizationUrl: AUTHORIZATION_URL });
    }),
  );
  return { calls, mutations: () => calls.filter(call => call.method !== 'GET') };
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderSection(entry = '/factories/fp-1/settings/mcp-servers') {
  return renderWithProviders(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/factories/:factoryId/settings/:section"
          element={
            <>
              <McpServersSection />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const row = (name: string) => screen.findByRole('listitem', { name });

describe('McpServersSection', () => {
  describe('for an organization admin', () => {
    it("lists the organization's servers with their status, authentication, and tools", async () => {
      mockMcpServersApi();
      renderSection();

      const docs = await row('Docs');
      expect(screen.getByText('Org-wide')).toBeInTheDocument();
      expect(within(docs).getByText('Connected')).toBeInTheDocument();
      expect(within(docs).getByText('https://docs.example.com/mcp')).toBeInTheDocument();
      expect(within(docs).getByText('Headers: Authorization')).toBeInTheDocument();
      expect(within(docs).getByText('1 of 2 tools')).toBeInTheDocument();
      expect(within(docs).getByText('1 new tool')).toBeInTheDocument();
      expect(within(docs).getByRole('button', { name: 'Refresh tools' })).toBeInTheDocument();

      const crm = await row('CRM');
      expect(within(crm).getByText('Needs sign-in')).toBeInTheDocument();
      expect(within(crm).getByText('OAuth, not signed in')).toBeInTheDocument();
      expect(within(crm).getByText('Sign in to connect this server.')).toBeInTheDocument();
      expect(within(crm).getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add server' })).toBeInTheDocument();
    });

    it('adds a bearer-token server, connects it, and never shows the token again', async () => {
      const api = mockMcpServersApi({ servers: [] });
      const user = userEvent.setup();
      renderSection();

      expect(await screen.findByText(/No MCP servers yet/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Behavior' })).toHaveAttribute(
        'href',
        '/factories/fp-1/settings/behavior',
      );
      await user.click(screen.getByRole('button', { name: 'Add server' }));
      await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Search');
      await user.type(screen.getByRole('textbox', { name: 'Server URL' }), 'https://search.example.com/mcp');
      await user.click(screen.getByRole('radio', { name: 'Bearer token' }));
      await user.type(screen.getByLabelText('Token'), 'sk-live-5e3f');
      await user.click(screen.getByRole('button', { name: 'Add and connect' }));

      const search = await row('Search');
      await waitFor(() => expect(within(search).getByText('Connected')).toBeInTheDocument());
      expect(within(search).getByText('1 of 1 tools')).toBeInTheDocument();
      expect(api.mutations()).toEqual([
        {
          method: 'POST',
          path: '',
          body: {
            name: 'Search',
            url: 'https://search.example.com/mcp',
            authType: 'headers',
            headers: [{ name: 'Authorization', value: 'Bearer sk-live-5e3f' }],
          },
        },
        { method: 'POST', path: '/33333333-3333-4333-8333-333333333330/discover' },
      ]);
      await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument());
      expect(document.body.textContent).not.toContain('sk-live-5e3f');
      expect(screen.queryByDisplayValue('sk-live-5e3f')).not.toBeInTheDocument();
    });

    it("keeps the form out of the drawer's swipe-to-dismiss so a mouse can pick the authentication", async () => {
      mockMcpServersApi({ servers: [] });
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole('button', { name: 'Add server' }));

      // Outside Base UI's `data-drawer-content` region, a pointerdown on a radio starts a drawer
      // swipe and captures the pointer, so in a browser the click never selects it. jsdom has no
      // pointer capture, so the click itself can't show the failure; the region can.
      const authentication = screen.getByRole('radiogroup', { name: 'Authentication' });
      expect(authentication.closest('[data-drawer-content]')).not.toBeNull();
    });

    it('adds custom headers and an OAuth server, starting its sign-in', async () => {
      const api = mockMcpServersApi({ servers: [] });
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole('button', { name: 'Add server' }));
      await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Tickets');
      await user.type(screen.getByRole('textbox', { name: 'Server URL' }), 'https://tickets.example.com/mcp');
      await user.click(screen.getByRole('radio', { name: 'Custom headers' }));
      await user.type(screen.getByRole('textbox', { name: 'Header 1 name' }), 'X-Api-Key');
      await user.type(screen.getByLabelText('Header 1 value'), 'key-1');
      await user.click(screen.getByRole('button', { name: 'Add header' }));
      await user.type(screen.getByRole('textbox', { name: 'Header 2 name' }), 'X-Team');
      await user.type(screen.getByLabelText('Header 2 value'), 'platform');
      await user.click(screen.getByRole('button', { name: 'Add and connect' }));
      await row('Tickets');

      await user.click(screen.getByRole('button', { name: 'Add server' }));
      await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Identity');
      await user.type(screen.getByRole('textbox', { name: 'Server URL' }), 'https://id.example.com/mcp');
      await user.click(screen.getByRole('radio', { name: 'OAuth' }));
      await user.type(screen.getByRole('textbox', { name: 'Client ID' }), 'factory-proof');
      await user.type(screen.getByRole('textbox', { name: 'Scopes' }), 'mcp:read mcp:write');
      await user.click(screen.getByRole('button', { name: 'Add and sign in' }));

      await waitFor(() => expect(goToMcpServerSignIn).toHaveBeenCalledWith(AUTHORIZATION_URL));
      expect(api.mutations()).toEqual([
        {
          method: 'POST',
          path: '',
          body: {
            name: 'Tickets',
            url: 'https://tickets.example.com/mcp',
            authType: 'headers',
            headers: [
              { name: 'X-Api-Key', value: 'key-1' },
              { name: 'X-Team', value: 'platform' },
            ],
          },
        },
        { method: 'POST', path: '/33333333-3333-4333-8333-333333333330/discover' },
        {
          method: 'POST',
          path: '',
          body: {
            name: 'Identity',
            url: 'https://id.example.com/mcp',
            authType: 'oauth',
            oauth: { clientId: 'factory-proof', scopes: ['mcp:read', 'mcp:write'] },
          },
        },
        {
          method: 'POST',
          path: '/33333333-3333-4333-8333-333333333331/oauth/start',
          body: { factoryProjectId: 'fp-1' },
        },
      ]);
    });

    it('asks for a client ID when the Factory cannot identify itself to the authorization server', async () => {
      const api = mockMcpServersApi({ servers: [], metadataDocument: false });
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole('button', { name: 'Add server' }));
      await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Identity');
      await user.type(screen.getByRole('textbox', { name: 'Server URL' }), 'https://id.example.com/mcp');
      await user.click(screen.getByRole('radio', { name: 'OAuth' }));
      expect(screen.getByText(/register it with the authorization server/)).toBeInTheDocument();
      expect(screen.getByText(REDIRECT_URI)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Add and sign in' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "Enter the client ID registered with the server's authorization server.",
      );
      expect(api.mutations()).toEqual([]);
    });

    it("shows the server's reason when a save is refused", async () => {
      mockMcpServersApi({ servers: [] });
      server.use(
        http.post(API, () =>
          HttpResponse.json(
            { error: 'invalid_mcp_server', message: 'MCP server URLs must use https.', field: 'url' },
            { status: 400 },
          ),
        ),
      );
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole('button', { name: 'Add server' }));
      await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Plain');
      await user.type(screen.getByRole('textbox', { name: 'Server URL' }), 'http://plain.example.com/mcp');
      await user.click(screen.getByRole('button', { name: 'Add and connect' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('MCP server URLs must use https.');
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Plain');
    });

    it('edits a server without resending its saved headers', async () => {
      const api = mockMcpServersApi();
      const user = userEvent.setup();
      renderSection();

      await user.click(within(await row('Docs')).getByRole('button', { name: 'Edit' }));
      const token = screen.getByLabelText('Token');
      expect(token).toHaveValue('');
      expect(token).toHaveAttribute('placeholder', 'Saved. Enter a new token to replace it');
      await user.clear(screen.getByRole('textbox', { name: 'Name' }));
      await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Docs v2');
      // Renaming doesn't rename the tools sessions already know.
      expect(screen.getByText(/keep the names they were given when it was added/)).toHaveTextContent(
        'like docs_search.',
      );
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await row('Docs v2')).toBeInTheDocument();
      expect(api.mutations()).toEqual([{ method: 'PATCH', path: `/${DOCS_ID}`, body: { name: 'Docs v2' } }]);
    });

    it('replaces the token when the admin enters a new one, then reconnects', async () => {
      const api = mockMcpServersApi();
      const user = userEvent.setup();
      renderSection();

      await user.click(within(await row('Docs')).getByRole('button', { name: 'Edit' }));
      await user.type(screen.getByLabelText('Token'), 'rotated-token');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() =>
        expect(api.mutations()).toEqual([
          {
            method: 'PATCH',
            path: `/${DOCS_ID}`,
            body: { headers: [{ name: 'Authorization', value: 'Bearer rotated-token' }] },
          },
          { method: 'POST', path: `/${DOCS_ID}/discover` },
        ]),
      );
    });

    it('replaces custom headers only when asked', async () => {
      const api = mockMcpServersApi({ servers: [{ ...docsServer, headerNames: ['X-Api-Key', 'X-Team'] }] });
      const user = userEvent.setup();
      renderSection();

      await user.click(within(await row('Docs')).getByRole('button', { name: 'Edit' }));
      const saved = screen.getByRole('list', { name: 'Saved headers' });
      expect(within(saved).getByText('X-Api-Key')).toBeInTheDocument();
      expect(within(saved).getByText('X-Team')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Replace headers' }));
      expect(screen.getByRole('textbox', { name: 'Header 1 name' })).toHaveValue('X-Api-Key');
      await user.type(screen.getByLabelText('Header 1 value'), 'key-2');
      await user.click(screen.getByRole('button', { name: 'Remove header 2' }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() =>
        expect(api.mutations()[0]).toEqual({
          method: 'PATCH',
          path: `/${DOCS_ID}`,
          body: { headers: [{ name: 'X-Api-Key', value: 'key-2' }] },
        }),
      );
    });

    it('warns that moving a server to another address removes its saved credentials', async () => {
      mockMcpServersApi();
      const user = userEvent.setup();
      renderSection();

      await user.click(within(await row('Docs')).getByRole('button', { name: 'Edit' }));
      const url = screen.getByRole('textbox', { name: 'Server URL' });
      await user.clear(url);
      await user.type(url, 'https://docs.example.com/v2/mcp');
      expect(screen.queryByText(/Changing the server address/)).not.toBeInTheDocument();
      await user.clear(url);
      await user.type(url, 'https://docs.example.org/mcp');
      expect(
        screen.getByText('Changing the server address removes its saved token and tools. Enter the token again.'),
      ).toBeInTheDocument();
      // New credentials of another kind have nothing saved to re-enter.
      await user.click(screen.getByRole('radio', { name: 'Custom headers' }));
      expect(screen.getByText('Changing the server address removes its tools.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await user.click(within(await row('CRM')).getByRole('button', { name: 'Edit' }));
      const crmUrl = await screen.findByRole('textbox', { name: 'Server URL' });
      await user.clear(crmUrl);
      await user.type(crmUrl, 'https://crm.example.org/mcp');
      expect(
        screen.getByText(
          'Changing the server address signs it out and removes its client secret and tools. Enter the client secret again, then sign in after saving.',
        ),
      ).toBeInTheDocument();
    });

    it('asks for the token or headers again when a server moves to another address', async () => {
      const api = mockMcpServersApi();
      const user = userEvent.setup();
      renderSection();

      await user.click(within(await row('Docs')).getByRole('button', { name: 'Edit' }));
      const url = screen.getByRole('textbox', { name: 'Server URL' });
      await user.clear(url);
      await user.type(url, 'https://docs.example.org/mcp');
      expect(screen.getByLabelText('Token')).toHaveAttribute('placeholder', 'Paste the token');
      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByText('Enter the token.')).toBeInTheDocument();
      expect(api.mutations()).toEqual([]);

      await user.type(screen.getByLabelText('Token'), 'moved-token');
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() =>
        expect(api.mutations()[0]).toEqual({
          method: 'PATCH',
          path: `/${DOCS_ID}`,
          body: {
            url: 'https://docs.example.org/mcp',
            headers: [{ name: 'Authorization', value: 'Bearer moved-token' }],
          },
        }),
      );
    });

    it('asks for custom header values again, keeping their names, when a server moves to another address', async () => {
      const api = mockMcpServersApi({ servers: [{ ...docsServer, headerNames: ['X-Api-Key', 'X-Team'] }] });
      const user = userEvent.setup();
      renderSection();

      await user.click(within(await row('Docs')).getByRole('button', { name: 'Edit' }));
      const url = screen.getByRole('textbox', { name: 'Server URL' });
      await user.clear(url);
      await user.type(url, 'https://docs.example.org/mcp');
      expect(screen.queryByRole('list', { name: 'Saved headers' })).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Header 1 name' })).toHaveValue('X-Api-Key');
      expect(screen.getByRole('textbox', { name: 'Header 2 name' })).toHaveValue('X-Team');
      await user.type(screen.getByLabelText('Header 1 value'), 'key-2');
      await user.type(screen.getByLabelText('Header 2 value'), 'team-2');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() =>
        expect(api.mutations()[0]).toEqual({
          method: 'PATCH',
          path: `/${DOCS_ID}`,
          body: {
            url: 'https://docs.example.org/mcp',
            headers: [
              { name: 'X-Api-Key', value: 'key-2' },
              { name: 'X-Team', value: 'team-2' },
            ],
          },
        }),
      );
    });

    it('warns that changing the URL of an OAuth server signs it out', async () => {
      mockMcpServersApi();
      const user = userEvent.setup();
      renderSection();

      await user.click(within(await row('CRM')).getByRole('button', { name: 'Edit' }));
      const url = screen.getByRole('textbox', { name: 'Server URL' });
      expect(screen.queryByText(/signs it out/)).not.toBeInTheDocument();
      await user.clear(url);
      await user.type(url, 'https://crm.example.com/v2/mcp');
      expect(screen.getByText('Changing the server URL signs it out. Sign in again after saving.')).toBeInTheDocument();
      expect(screen.queryByText(/removes its saved credentials/)).not.toBeInTheDocument();
    });

    it('removes a server only after the admin confirms', async () => {
      const api = mockMcpServersApi();
      const user = userEvent.setup();
      renderSection();

      await user.click(within(await row('Docs')).getByRole('button', { name: 'Remove' }));
      let dialog = await screen.findByRole('alertdialog', { name: 'Remove Docs?' });
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(api.mutations()).toEqual([]);

      await user.click(within(await row('Docs')).getByRole('button', { name: 'Remove' }));
      dialog = await screen.findByRole('alertdialog', { name: 'Remove Docs?' });
      await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

      await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Docs' })).not.toBeInTheDocument());
      expect(api.mutations()).toEqual([{ method: 'DELETE', path: `/${DOCS_ID}` }]);
      expect(screen.getByRole('listitem', { name: 'CRM' })).toBeInTheDocument();
    });

    it('chooses which tools sessions get', async () => {
      const api = mockMcpServersApi();
      const user = userEvent.setup();
      renderSection();

      const docs = await row('Docs');
      await user.click(within(docs).getByRole('button', { name: 'Choose tools' }));
      const tools = within(docs).getByRole('list', { name: 'Docs tools' });
      expect(within(tools).getByRole('checkbox', { name: 'Search docs' })).toBeChecked();
      expect(within(tools).getByRole('checkbox', { name: 'add' })).not.toBeChecked();
      expect(within(tools).getByText('docs_add')).toBeInTheDocument();
      expect(within(tools).getByText('New')).toBeInTheDocument();
      expect(within(tools).getByText('Read-only')).toBeInTheDocument();

      await user.click(within(tools).getByRole('checkbox', { name: 'add' }));
      await user.click(within(docs).getByRole('button', { name: 'Save selection' }));

      await waitFor(() => expect(within(docs).getByText('2 of 2 tools')).toBeInTheDocument());
      expect(api.mutations()).toEqual([
        { method: 'PUT', path: `/${DOCS_ID}/tools`, body: { selected: ['search', 'add'] } },
      ]);
      expect(within(docs).queryByText('1 new tool')).not.toBeInTheDocument();
      // Nothing left to save until the selection changes again.
      expect(within(docs).getByRole('button', { name: 'Save selection' })).toBeDisabled();
    });

    it('lets the admin keep a new tool off, so it stops being shown as new', async () => {
      const api = mockMcpServersApi();
      const user = userEvent.setup();
      renderSection();

      const docs = await row('Docs');
      expect(within(docs).getByText('1 new tool')).toBeInTheDocument();
      await user.click(within(docs).getByRole('button', { name: 'Choose tools' }));
      await user.click(within(docs).getByRole('button', { name: 'Save selection' }));

      await waitFor(() => expect(within(docs).queryByText('1 new tool')).not.toBeInTheDocument());
      expect(api.mutations()).toEqual([{ method: 'PUT', path: `/${DOCS_ID}/tools`, body: { selected: ['search'] } }]);
      expect(within(docs).getByText('1 of 2 tools')).toBeInTheDocument();
    });

    it("sends the admin to the server's sign-in page, returning to this Factory", async () => {
      const api = mockMcpServersApi();
      const user = userEvent.setup();
      renderSection();

      await user.click(within(await row('CRM')).getByRole('button', { name: 'Sign in' }));

      await waitFor(() => expect(goToMcpServerSignIn).toHaveBeenCalledWith(AUTHORIZATION_URL));
      expect(api.mutations()).toEqual([
        { method: 'POST', path: `/${CRM_ID}/oauth/start`, body: { factoryProjectId: 'fp-1' } },
      ]);
      expect(within(await row('CRM')).getByRole('button', { name: 'Sign in' })).toBeDisabled();
    });

    it('offers to sign in again when the server refused the saved sign-in', async () => {
      const refused: McpServerInfo = {
        ...crmServer,
        oauth: { ...crmServer.oauth!, connected: true },
        lastError: 'Sign in to connect this server.',
      };
      const api = mockMcpServersApi({ servers: [refused] });
      const user = userEvent.setup();
      renderSection();

      const crm = await row('CRM');
      expect(within(crm).getByText('OAuth, not signed in')).toBeInTheDocument();
      expect(within(crm).queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
      await user.click(within(crm).getByRole('button', { name: 'Sign in' }));

      await waitFor(() => expect(goToMcpServerSignIn).toHaveBeenCalledWith(AUTHORIZATION_URL));
      expect(api.mutations()).toEqual([
        { method: 'POST', path: `/${CRM_ID}/oauth/start`, body: { factoryProjectId: 'fp-1' } },
      ]);
    });

    it("reports a failed connection on that server's row", async () => {
      mockMcpServersApi();
      server.use(
        http.post(`${API}/:id/discover`, () =>
          HttpResponse.json(
            { error: 'mcp_server_changed', message: 'The server changed while connecting. Connect again.' },
            { status: 409 },
          ),
        ),
      );
      const user = userEvent.setup();
      renderSection();

      const docs = await row('Docs');
      await user.click(within(docs).getByRole('button', { name: 'Refresh tools' }));

      expect(await within(docs).findByRole('alert')).toHaveTextContent(
        'The server changed while connecting. Connect again.',
      );
      expect(within(await row('CRM')).queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('for an organization member', () => {
    it('shows the servers and their tools read-only', async () => {
      const api = mockMcpServersApi({ canManage: false });
      const user = userEvent.setup();
      renderSection();

      const docs = await row('Docs');
      expect(screen.getByText('Only organization admins can manage MCP servers.')).toBeInTheDocument();
      expect(within(docs).getByText('Connected')).toBeInTheDocument();
      for (const name of ['Add server', 'Edit', 'Remove', 'Refresh tools', 'Sign in', 'Sign out', 'Save selection']) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
      }

      await user.click(within(docs).getByRole('button', { name: 'View tools' }));
      for (const checkbox of within(docs).getAllByRole('checkbox'))
        expect(checkbox).toHaveAttribute('aria-disabled', 'true');
      expect(within(docs).queryByRole('button', { name: 'Select all' })).not.toBeInTheDocument();
      expect(api.mutations()).toEqual([]);
    });
  });

  describe('when the OAuth callback returns the admin here', () => {
    it('confirms the sign-in and clears the outcome from the address', async () => {
      mockMcpServersApi({
        servers: [{ ...crmServer, status: 'connected', oauth: { ...crmServer.oauth!, connected: true } }],
      });
      renderSection(`/factories/fp-1/settings/mcp-servers?mcpServer=${CRM_ID}&oauth=connected`);

      expect(await screen.findByText('CRM is connected. Choose which of its tools sessions get.')).toBeInTheDocument();
      expect(screen.getByText('Signed in')).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByTestId('location')).toHaveTextContent(/^\/factories\/fp-1\/settings\/mcp-servers$/),
      );
      expect(within(await row('CRM')).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    });

    it('explains why a sign-in failed', async () => {
      mockMcpServersApi();
      renderSection(`/factories/fp-1/settings/mcp-servers?mcpServer=${CRM_ID}&oauth=error&reason=denied`);

      expect(await screen.findByText("Couldn't sign in")).toBeInTheDocument();
      expect(screen.getByText("Access was denied on the server's sign-in page.")).toBeInTheDocument();
    });
  });

  describe('when the servers cannot be listed', () => {
    it("shows the server's message with a retry", async () => {
      mockMcpServersApi();
      let failures = 1;
      server.use(
        http.get(API, () =>
          failures-- > 0
            ? HttpResponse.json(
                { error: 'mcp_servers_failed', message: 'The MCP server request failed.' },
                { status: 500 },
              )
            : HttpResponse.json<McpServersResponse>({
                servers: [docsServer],
                canManage: true,
                oauth: { metadataDocument: true, redirectUri: REDIRECT_URI },
              }),
        ),
      );
      const user = userEvent.setup();
      renderSection();

      expect(await screen.findByText('The MCP server request failed.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Retry' }));
      expect(await row('Docs')).toBeInTheDocument();
    });

    it('asks a signed-out visitor to sign in', async () => {
      mockMcpServersApi();
      server.use(http.get(API, () => HttpResponse.json({ error: 'unauthorized' }, { status: 401 })));
      renderSection();

      expect(await screen.findByText("Sign in to see your organization's MCP servers.")).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add server' })).not.toBeInTheDocument();
    });
  });

  it('says MCP servers are unavailable when the server has them turned off', async () => {
    const api = mockMcpServersApi();
    const features: ServerFeatures = { knowledge: false, mcpServers: false };
    server.use(http.get(`${TEST_BASE_URL}/web/config/features`, () => HttpResponse.json(features)));
    renderSection();

    expect(await screen.findByText('MCP servers are not available on this server.')).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });
});
