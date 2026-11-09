// @vitest-environment jsdom
import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { McpUiToolInputNotification, McpUiToolResultNotification } from '@modelcontextprotocol/ext-apps';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { McpAppView } from '../../mcp-apps';
import type { McpAppViewProps } from '../../mcp-apps';
import { server } from '../../test/msw-server';
import { renderWithProviders } from '../../test/render';
import { MessageFactory } from '../../ui/MessageFactory';
import { createGenUI, isMcpAppContextText, useGenUIChat } from '../index';
import type { GenUIFallbackProps, GenUIRegistry } from '../index';
import { connectApp } from './connect-app';
import {
  MAP_TOOL,
  mapAppResource,
  MCP_SERVERS_URL,
  mcpServers,
  WEATHER_RESOURCE_URL,
  WEATHER_TOOLS_URL,
  weatherTools,
} from './fixtures/mcp-apps';
import { chunk, finish, sseResponse, STREAM_URL } from './sse';

// Under jsdom the default blob-URL sandbox proxy can't load; the test harness stands in for it.
const SANDBOX_URL = new URL('http://sandbox.test/proxy.html');
const TestMcpAppView = (props: McpAppViewProps) => <McpAppView {...props} sandboxUrl={SANDBOX_URL} />;

afterEach(cleanup);

const catalog = defineCatalog(schema, { components: {}, actions: {} });

function Fallback({ reason, kind }: GenUIFallbackProps) {
  return (
    <p data-testid="fallback" data-kind={kind}>
      {reason}
    </p>
  );
}

const mapUI = (mcpApps = true) =>
  createGenUI({
    catalog,
    components: {},
    fallbacks: { Fallback },
    ...(mcpApps ? { mcpApps: { view: TestMcpAppView } } : {}),
  });

type Chat = ReturnType<typeof useGenUIChat>;
let current: Chat;

function GenUIChat({ genUI, initialMessages }: { genUI: GenUIRegistry<any>; initialMessages?: MastraDBMessage[] }) {
  const chat = useGenUIChat({
    agentId: 'agent-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    genUI,
    initialMessages,
    renderers: {
      Text: part => <span data-testid="text">{part.text}</span>,
      ToolInvocation: part => <p data-testid="tool-card">{part.toolInvocation.toolName}</p>,
    },
  });
  current = chat;
  return (
    <div data-testid="genui-chat">
      {chat.messages.map(message => (
        <MessageFactory key={message.id} message={message} {...chat.genUI.renderers} />
      ))}
    </div>
  );
}

const send = async (message: string) => {
  await act(async () => {
    void current.sendMessage({ message, threadId: 'thread-1' });
  });
};

const mapResult = {
  content: [{ type: 'text', text: 'Map of Rome' }],
  structuredContent: { city: 'Rome', zoom: 3 },
};

/** One streamed response in which the agent runs a tool on the MCP server and gets its result. */
const toolRun = (toolName: string, args: Record<string, unknown>, result: unknown) => [
  chunk('start'),
  chunk('tool-call', { toolCallId: 'call-1', toolName, args }),
  chunk('tool-result', { toolCallId: 'call-1', toolName, args, result }),
  finish('stop'),
];

const answer = (text: string) => [
  chunk('start'),
  chunk('text-start', { id: 't1' }),
  chunk('text-delta', { id: 't1', text }),
  chunk('text-end', { id: 't1' }),
  finish('stop'),
];

interface McpRequests {
  resourceReads: unknown[];
  executions: { toolId: string; body: unknown }[];
}

/** Serves the weather MCP server: its tool list, the map app's HTML, and tool execution. */
function serveWeatherServer({ resource = mapAppResource as unknown, resourceStatus = 200 } = {}): McpRequests {
  const requests: McpRequests = { resourceReads: [], executions: [] };
  server.use(
    http.get(MCP_SERVERS_URL, () => HttpResponse.json(mcpServers)),
    http.get(WEATHER_TOOLS_URL, () => HttpResponse.json(weatherTools)),
    http.post(WEATHER_RESOURCE_URL, async ({ request }) => {
      requests.resourceReads.push(await request.json());
      return HttpResponse.json(resource as Record<string, unknown>, { status: resourceStatus });
    }),
    http.post(`${WEATHER_TOOLS_URL}/:toolId/execute`, async ({ request, params }) => {
      requests.executions.push({ toolId: String(params.toolId), body: await request.json() });
      return HttpResponse.json({ result: { zoomed: true } });
    }),
  );
  return requests;
}

/** Records each agent request body and answers them in order. */
function serveAgent(...responses: object[][]) {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(STREAM_URL, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return sseResponse(responses[bodies.length - 1] ?? answer('ok'));
    }),
  );
  return bodies;
}

const userTurnText = (body: Record<string, unknown> | undefined) => JSON.stringify(body?.messages ?? []);

/** Renders the chat, has the agent show the weather map, and connects a real MCP App to it. */
async function showMap(setupApp?: Parameters<typeof connectApp>[1]) {
  const mcp = serveWeatherServer();
  const bodies = serveAgent(toolRun(MAP_TOOL, { city: 'Rome' }, mapResult));
  const { container } = renderWithProviders(<GenUIChat genUI={mapUI()} />);
  await send('show me the map');
  const app = await connectApp(container, setupApp);
  return { app, mcp, bodies, container };
}

describe('useGenUIChat — MCP Apps', () => {
  describe('when the agent runs a tool that has an MCP App', () => {
    it('renders the app in place of the tool card and hands it the tool input and result', async () => {
      const inputs: McpUiToolInputNotification['params'][] = [];
      const results: McpUiToolResultNotification['params'][] = [];
      const { mcp, container } = await showMap(app => {
        app.addEventListener('toolinput', params => inputs.push(params));
        app.addEventListener('toolresult', params => results.push(params));
      });

      await waitFor(() => expect(results).toHaveLength(1));
      expect(inputs).toEqual([{ arguments: { city: 'Rome' } }]);
      expect(results[0]).toMatchObject(mapResult);
      expect(mcp.resourceReads).toEqual([{ uri: 'ui://weather/map' }]);
      expect(container.querySelector('iframe')).not.toBeNull();
      expect(screen.queryByTestId('tool-card')).toBeNull();
    });
  });

  describe('when the app calls a tool its server lets apps call', () => {
    it('runs the tool on the MCP server and returns its result to the app', async () => {
      const { app, mcp } = await showMap();

      const result = await app.callServerTool({ name: 'zoomMap', arguments: { zoom: 5 } });

      expect(mcp.executions).toEqual([{ toolId: 'zoomMap', body: { data: { zoom: 5 } } }]);
      expect(result.structuredContent).toEqual({ zoomed: true });
    });
  });

  describe('when the app calls a tool its server keeps for the model', () => {
    it('refuses the call without running the tool', async () => {
      const { app, mcp } = await showMap();

      await expect(app.callServerTool({ name: 'deleteStation', arguments: {} })).rejects.toThrow(/deleteStation/);
      expect(mcp.executions).toEqual([]);
    });
  });

  describe('when the app sends a message', () => {
    it('sends it to the agent as a user message', async () => {
      const { app, bodies } = await showMap();

      await act(async () => {
        await app.sendMessage({ role: 'user', content: [{ type: 'text', text: 'Zoom in on Rome' }] });
      });

      await waitFor(() => expect(bodies).toHaveLength(2));
      expect(userTurnText(bodies[1])).toContain('Zoom in on Rome');
    });
  });

  describe('when the app sends a message the agent never receives', () => {
    it('tells the app the message failed', async () => {
      const { app } = await showMap();
      server.use(http.post(STREAM_URL, () => HttpResponse.json({ error: 'down' }, { status: 500 })));

      let result: Awaited<ReturnType<typeof app.sendMessage>> | undefined;
      await act(async () => {
        result = await app.sendMessage({ role: 'user', content: [{ type: 'text', text: 'Zoom in on Rome' }] });
      });

      expect(result?.isError).toBe(true);
    });
  });

  describe('when the app updates the model context before the user sends a message', () => {
    it('attaches the context to that one message as untrusted data, and hides it from the transcript', async () => {
      const { app, bodies } = await showMap();

      await act(async () => {
        await app.updateModelContext({ content: [{ type: 'text', text: 'Viewing Rome at zoom 3' }] });
      });
      await send('what am I looking at?');
      await waitFor(() => expect(bodies).toHaveLength(2));
      await send('thanks');
      await waitFor(() => expect(bodies).toHaveLength(3));

      expect(userTurnText(bodies[1])).toContain('<mcp-app-context trust=\\"untrusted\\">');
      expect(userTurnText(bodies[1])).toContain('Viewing Rome at zoom 3');
      expect(userTurnText(bodies[2])).not.toContain('Viewing Rome at zoom 3');
      const shown = screen.getAllByTestId('text').map(node => node.textContent ?? '');
      expect(shown).toContain('what am I looking at?');
      expect(shown.some(isMcpAppContextText)).toBe(false);
    });
  });

  describe('when the app HTML cannot be loaded', () => {
    it('shows the fallback naming the tool instead of the app', async () => {
      serveWeatherServer({ resource: { error: 'gone' }, resourceStatus: 500 });
      serveAgent(toolRun(MAP_TOOL, { city: 'Rome' }, mapResult));
      const { container } = renderWithProviders(<GenUIChat genUI={mapUI()} />);

      await send('show me the map');

      const fallback = await screen.findByTestId('fallback');
      expect(fallback.dataset.kind).toBe('render-error');
      expect(fallback.textContent).toContain(MAP_TOOL);
      expect(container.querySelector('iframe')).toBeNull();
    });
  });

  describe('when the chat opens on a thread where the agent already showed the app', () => {
    it('renders the app once the MCP tool list arrives', async () => {
      const mcp = serveWeatherServer();
      const initialMessages: MastraDBMessage[] = [
        {
          id: 'm1',
          role: 'assistant',
          createdAt: new Date(0),
          threadId: 'thread-1',
          resourceId: 'resource-1',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call-1',
                  toolName: MAP_TOOL,
                  args: { city: 'Rome' },
                  result: mapResult,
                },
              },
            ],
          },
        },
      ];
      const { container } = renderWithProviders(<GenUIChat genUI={mapUI()} initialMessages={initialMessages} />);

      await connectApp(container);
      expect(mcp.resourceReads).toEqual([{ uri: 'ui://weather/map' }]);
      expect(screen.queryByTestId('tool-card')).toBeNull();
    });
  });

  describe('when the agent runs a tool without an MCP App', () => {
    it('keeps the regular tool card', async () => {
      const mcp = serveWeatherServer();
      serveAgent(toolRun('weather-server_getForecast', { city: 'Rome' }, { temp: 30 }));
      renderWithProviders(<GenUIChat genUI={mapUI()} />);

      await send('forecast?');

      expect((await screen.findByTestId('tool-card')).textContent).toBe('weather-server_getForecast');
      expect(mcp.resourceReads).toEqual([]);
    });
  });

  describe('when the registry does not enable MCP Apps', () => {
    it('never asks the server for MCP tools and keeps the regular tool card', async () => {
      // No MCP handlers: any MCP request fails the test as unhandled.
      serveAgent(toolRun(MAP_TOOL, { city: 'Rome' }, mapResult));
      const { container } = renderWithProviders(<GenUIChat genUI={mapUI(false)} />);

      await send('show me the map');

      expect((await screen.findByTestId('tool-card')).textContent).toBe(MAP_TOOL);
      expect(container.querySelector('iframe')).toBeNull();
    });
  });
});
