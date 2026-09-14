import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { MCPToolPanel } from '../MCPToolPanel';
import { authDisabled, echoTool } from './fixtures/mcp-servers';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

const TOOL_URL = `${TEST_BASE_URL}/api/mcp/modern/tools/echo`;

const renderPanel = () => renderWithProviders(<MCPToolPanel serverId="modern" toolId="echo" />);

const useBaseHandlers = () => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabled)),
    http.get(TOOL_URL, () => HttpResponse.json(echoTool)),
  );
};

describe('MCPToolPanel execution results', () => {
  it('renders the completed output of an ordinary tool', async () => {
    useBaseHandlers();
    const onExecute = vi.fn<() => void>();
    server.use(
      http.post(`${TOOL_URL}/execute`, () => {
        onExecute();
        return HttpResponse.json({ result: { echoed: 'hello' } });
      }),
    );
    const { container, queryClient } = renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(onExecute).toHaveBeenCalledTimes(1));
    // The result editor tokenises JSON, so assert on the rendered text as a whole.
    await waitFor(() => expect(container.textContent).toMatch(/"echoed":\s*"hello"/));
    await waitForMutationsIdle(queryClient);
  });

  it('shows an unsupported-interaction result when the tool needs native MCP input rounds', async () => {
    useBaseHandlers();
    server.use(
      http.post(`${TOOL_URL}/execute`, () =>
        HttpResponse.json({ error: 'Native MCP interaction requires an MCP protocol client' }, { status: 422 }),
      ),
    );
    const { container, queryClient } = renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(container.textContent).toMatch(/"unsupported":\s*"native-interaction"/));
    expect(container.textContent).toContain('cannot run from Studio');
    await waitForMutationsIdle(queryClient);
  });

  it('shows other execution failures instead of an empty result', async () => {
    useBaseHandlers();
    server.use(http.post(`${TOOL_URL}/execute`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    const { container, queryClient } = renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(container.textContent).toContain('HTTP error! status: 500'));
    expect(container.textContent).not.toContain('native-interaction');
    await waitForMutationsIdle(queryClient);
  });
});
