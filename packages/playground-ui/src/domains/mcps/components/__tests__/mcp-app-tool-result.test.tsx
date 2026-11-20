// @vitest-environment jsdom
import { http, HttpResponse } from 'msw';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { McpAppHostProvider } from '../../context/mcp-app-host-context';
import type { McpAppHostValue } from '../../context/mcp-app-host-context-value';
import { McpAppToolResult } from '../mcp-app-tool-result';
import { connectApp, sandboxFrame } from './connect-app';
import { dashboardAppInfo, dashboardAppResource } from './fixtures/mcp-app';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const PINS = 'mastra.ai/dashboard-pinned-widgets';
const dashboardApp = { toolName: 'showDashboard', toolCallId: 'call-1', resourceUri: 'ui://dashboard/app' };

beforeAll(() => {
  // jsdom has no blob URLs; the viewer only needs one to point its sandbox iframe at.
  URL.createObjectURL ??= () => 'blob:http://localhost/sandbox-proxy';
});

function serveDashboardApp() {
  server.use(
    http.post(`${TEST_BASE_URL}/api/mcp/observability/resources/read`, () => HttpResponse.json(dashboardAppResource)),
  );
}

type ResultProps = Partial<Parameters<typeof McpAppToolResult>[0]>;

function toolResult(host: McpAppHostValue | undefined, props: ResultProps = {}) {
  const result = (
    <McpAppToolResult
      appInfo={dashboardAppInfo}
      toolCallId="call-1"
      toolResult={{ definition: { rows: [] } }}
      onUpdateModelContext={vi.fn()}
      {...props}
    />
  );
  return host ? <McpAppHostProvider value={host}>{result}</McpAppHostProvider> : result;
}

async function renderToolResult(host: McpAppHostValue | undefined, props: ResultProps = {}) {
  serveDashboardApp();
  const rendered = renderWithProviders(toolResult(host, props));
  const { frame } = await sandboxFrame(rendered.container);
  const app = await connectApp(rendered.container);
  return { ...rendered, app, frame };
}

describe('McpAppToolResult inside an McpAppHostProvider', () => {
  it("sends the host's context for this app instance, and its changes to the running app", async () => {
    const hostContext = vi.fn((): Record<string, unknown> => ({ [PINS]: ['agent-runs'] }));
    const { app, frame, container, rerender } = await renderToolResult({ hostContext });

    expect(hostContext).toHaveBeenCalledWith(dashboardApp);
    expect(app.getHostContext()).toMatchObject({ [PINS]: ['agent-runs'], theme: expect.any(String) });

    const changed = new Promise(resolve => app.addEventListener('hostcontextchanged', resolve));
    rerender(toolResult({ hostContext: () => ({ [PINS]: [] }) }));

    expect(await changed).toEqual({ [PINS]: [] });
    expect(container.querySelector('iframe')).toBe(frame);
  });

  it('hands the host the raw model context with the app it came from, and still gives the chat its text', async () => {
    const onModelContext = vi.fn();
    const onUpdateModelContext = vi.fn();
    const { app } = await renderToolResult({ onModelContext }, { onUpdateModelContext });

    const pinned = [{ widget: { id: 'agent-runs' }, scope: 'project', defaults: {} }];
    await app.updateModelContext({
      content: [{ type: 'text', text: 'Pinned: Agent runs' }],
      structuredContent: { [PINS]: pinned },
    });

    expect(onModelContext).toHaveBeenCalledWith(dashboardApp, {
      content: [{ type: 'text', text: 'Pinned: Agent runs' }],
      structuredContent: { [PINS]: pinned },
    });
    expect(onUpdateModelContext).toHaveBeenLastCalledWith(
      [
        'Context from the "showDashboard" MCP App shown in this conversation:',
        'Pinned: Agent runs',
        JSON.stringify({ [PINS]: pinned }),
      ].join('\n'),
    );
  });

  it('keeps the host out of read-only tool cards', async () => {
    const onModelContext = vi.fn();
    const { app } = await renderToolResult({ onModelContext }, { readOnly: true });

    expect(app.getHostCapabilities()).not.toHaveProperty('updateModelContext');
    expect(onModelContext).not.toHaveBeenCalled();
  });

  it('keeps the host out when the app has no tool call to tell instances apart', async () => {
    const hostContext = vi.fn(() => ({ [PINS]: [] }));
    const { app } = await renderToolResult({ hostContext }, { toolCallId: undefined });

    expect(hostContext).not.toHaveBeenCalled();
    expect(app.getHostContext()).not.toHaveProperty(PINS);
  });
});

describe('McpAppToolResult without an McpAppHostProvider', () => {
  it('sends only the theme and gives the chat model context as text', async () => {
    const onUpdateModelContext = vi.fn();
    const { app } = await renderToolResult(undefined, { onUpdateModelContext });

    expect(Object.keys(app.getHostContext() ?? {})).toEqual(['theme']);
    await app.updateModelContext({ structuredContent: { drilldown: { page: 'traces' } } });
    expect(onUpdateModelContext).toHaveBeenLastCalledWith(
      ['Context from the "showDashboard" MCP App shown in this conversation:', '{"drilldown":{"page":"traces"}}'].join(
        '\n',
      ),
    );
  });
});
