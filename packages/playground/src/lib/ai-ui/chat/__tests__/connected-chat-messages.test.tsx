import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useChatMessages } from '../chat-context';
import { ChatProvider } from '../chat-provider';
import { ConnectedChatMessages } from '../connected-chat-messages';
import {
  approvalMessage,
  hitlGenerateResponse,
  hitlMcpServers,
  hitlMemoryConfig,
  hitlUser,
} from './fixtures/chat-hitl';
import { workingMemoryFixture } from './fixtures/working-memory';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
afterEach(cleanup);
function History() {
  return <ConnectedChatMessages messages={useChatMessages()} />;
}
function renderHistory(mode: 'stream' | 'generate' | 'network') {
  server.use(
    http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json(hitlMcpServers)),
    http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json(hitlUser)),
    http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json(hitlMemoryConfig)),
    http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () =>
      HttpResponse.json(workingMemoryFixture('')),
    ),
    http.post(
      `${BASE_URL}/api/agents/:agentId/threads/subscribe`,
      () => new HttpResponse('', { headers: { 'content-type': 'text/event-stream' } }),
    ),
  );
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <WorkingMemoryProvider agentId="agent-1" threadId="thread-1" resourceId="agent-1">
            <ChatProvider
              agentId="agent-1"
              initialMessages={[
                {
                  ...approvalMessage,
                  content: { ...approvalMessage.content, metadata: { ...approvalMessage.content.metadata, mode } },
                },
              ]}
              modelVersion="v2"
            >
              <History />
            </ChatProvider>
          </WorkingMemoryProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

describe('ConnectedChatMessages', () => {
  describe.each([
    { label: 'Approve', endpoint: 'approve-tool-call', mode: 'stream' },
    { label: 'Decline', endpoint: 'decline-tool-call', mode: 'stream' },
    { label: 'Approve', endpoint: 'approve-tool-call-generate', mode: 'generate' },
    { label: 'Decline', endpoint: 'decline-tool-call-generate', mode: 'generate' },
    { label: 'Approve', endpoint: 'approve-network-tool-call', mode: 'network' },
    { label: 'Decline', endpoint: 'decline-network-tool-call', mode: 'network' },
  ] as const)('when $label resumes a $mode conversation', ({ label, endpoint, mode }) => {
    it('routes the decision through the real transport', async () => {
      const receive = vi.fn();
      server.use(
        http.post(`${BASE_URL}/api/agents/agent-1/${endpoint}`, async ({ request }) => {
          receive(await request.json());
          return mode === 'generate'
            ? HttpResponse.json(hitlGenerateResponse)
            : new HttpResponse('', { headers: { 'content-type': 'text/event-stream' } });
        }),
      );
      renderHistory(mode);
      fireEvent.click(await screen.findByRole('button', { name: label, exact: true }));
      await waitFor(() =>
        expect(receive).toHaveBeenCalledWith(
          expect.objectContaining(
            mode === 'network' ? { runId: 'approval-run' } : { runId: 'approval-run', toolCallId: 'approval-call' },
          ),
        ),
      );
    });
  });
  describe('when a decision returns a new assistant message', () => {
    it('renders the continuation through the extracted renderer', async () => {
      server.use(
        http.post(`${BASE_URL}/api/agents/agent-1/approve-tool-call-generate`, () =>
          HttpResponse.json(hitlGenerateResponse),
        ),
      );
      renderHistory('generate');
      fireEvent.click(await screen.findByRole('button', { name: 'Approve', exact: true }));
      expect(await screen.findByText('The run continued after your decision.')).toBeTruthy();
    });
  });
});
