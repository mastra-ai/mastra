// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { TraceMessagesPanel } from '../trace-messages-panel';
import { panelTraceSpans } from './fixtures/trace-span-panel';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

describe('TraceMessagesPanel', () => {
  it('when rendered, then the reconstructed turn shows inside the messages panel', async () => {
    server.use(http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [] })));
    const { queryClient } = renderWithProviders(
      <TestLinkProvider>
        <TraceMessagesPanel spans={panelTraceSpans.spans} />
      </TestLinkProvider>,
    );

    const message = await screen.findByText('No rain is expected.');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(screen.getByTestId('messages-panel').contains(message)).toBe(true);
  });
});
