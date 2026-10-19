import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { McpToolDrawerBody } from '../mcp-tool-drawer-body';
import { authDisabled, echoTool } from './fixtures/mcp-servers';
import { ToolDrawer } from '@/domains/tools/components/tool-drawer/tool-drawer';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

const TOOL_URL = `${TEST_BASE_URL}/api/mcp/v2/tools/echo`;

// The drawer reads the open tool from `?tool=`, as the MCP server page does.
const renderPanel = () =>
  renderWithProviders(
    <ToolDrawer>
      <McpToolDrawerBody serverId="v2" />
    </ToolDrawer>,
    {
      router: { initialEntries: ['/mcps/v2?tool=echo'] },
    },
  );

/** Execution lives on the Playground tab, apart from the Overview the drawer opens on. */
const runTool = async () => {
  fireEvent.click(await screen.findByRole('tab', { name: 'Playground' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Run' }));
};

const useBaseHandlers = () => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabled)),
    http.get(TOOL_URL, () => HttpResponse.json(echoTool)),
  );
};

describe('MCP tool drawer execution results', () => {
  it('renders the completed output of an ordinary tool', async () => {
    useBaseHandlers();
    const onExecute = vi.fn<() => void>();
    server.use(
      http.post(`${TOOL_URL}/execute`, () => {
        onExecute();
        return HttpResponse.json({ result: { echoed: 'hello' } });
      }),
    );
    const { queryClient } = renderPanel();

    await runTool();

    await waitFor(() => expect(onExecute).toHaveBeenCalledTimes(1));
    // The response is highlighted token by token, so assert on the rendered text as a whole.
    await waitFor(() => expect(document.body.textContent).toMatch(/"echoed":\s*"hello"/));
    await waitForMutationsIdle(queryClient);
  });

  it('reports a suspended tool truthfully instead of pretending it finished', async () => {
    useBaseHandlers();
    server.use(
      http.post(`${TOOL_URL}/execute`, () =>
        HttpResponse.json({
          status: 'suspended',
          suspendPayload: { phase: 'confirm' },
          resumeSchema: { type: 'object', properties: { ok: { type: 'boolean' } } },
        }),
      ),
    );
    const { queryClient } = renderPanel();

    await runTool();

    // Studio cannot answer the input request, so it explains that instead of presenting the payload as output.
    await waitFor(() => expect(screen.getByText(/asked for more input, which Studio cannot provide/)).not.toBeNull());
    // The suspend payload stays visible in the result panel.
    expect(document.body.textContent).toMatch(/"phase":\s*"confirm"/);
    await waitForMutationsIdle(queryClient);
  });

  it('shows other execution failures instead of an empty result', async () => {
    useBaseHandlers();
    server.use(http.post(`${TOOL_URL}/execute`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    const { queryClient } = renderPanel();

    await runTool();

    await waitFor(() => expect(document.body.textContent).toContain('HTTP error! status: 500'));
    await waitForMutationsIdle(queryClient);
  });
});
