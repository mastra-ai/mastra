import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useChatMessages } from '../chat-context';
import { ChatProvider } from '../chat-provider';
import {
  approvalMessage,
  hitlGenerateResponse,
  hitlMcpServers,
  hitlMemoryConfig,
  hitlUser,
} from './fixtures/chat-hitl';
import { workingMemoryFixture } from './fixtures/working-memory';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { MessageRow } from '@/lib/ai-ui/messages/message-row';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

afterEach(cleanup);

function ChatHistory() {
  const messages = useChatMessages();
  return messages.map(message => <MessageRow key={message.id} message={message} />);
}

function renderApproval(mode: 'stream' | 'generate' | 'network' = 'stream') {
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
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={client}>
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
              <ChatHistory />
            </ChatProvider>
          </WorkingMemoryProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

describe('Agent chat HITL', () => {
  describe.each([
    { label: 'Approve', endpoint: 'approve-tool-call', mode: 'stream' },
    { label: 'Decline', endpoint: 'decline-tool-call', mode: 'stream' },
    { label: 'Approve', endpoint: 'approve-tool-call-generate', mode: 'generate' },
    { label: 'Decline', endpoint: 'decline-tool-call-generate', mode: 'generate' },
    { label: 'Approve', endpoint: 'approve-network-tool-call', mode: 'network' },
    { label: 'Decline', endpoint: 'decline-network-tool-call', mode: 'network' },
  ] as const)('when the user selects $label in $mode mode', ({ label, endpoint, mode }) => {
    it('continues the stored run through the real client transport', async () => {
      const receive = vi.fn();
      server.use(
        http.post(`${BASE_URL}/api/agents/agent-1/${endpoint}`, async ({ request }) => {
          receive(await request.json());
          if (mode === 'generate') return HttpResponse.json(hitlGenerateResponse);
          if (mode === 'network') return new HttpResponse('', { headers: { 'content-type': 'text/event-stream' } });
          return new HttpResponse('data: {"type":"finish","runId":"approval-run","from":"AGENT","payload":{}}\n\n', {
            headers: { 'content-type': 'text/event-stream' },
          });
        }),
      );
      renderApproval(mode);
      fireEvent.click(await screen.findByRole('button', { name: label, exact: true }));
      await waitFor(() =>
        expect(receive).toHaveBeenCalledWith(
          expect.objectContaining(
            mode === 'network' ? { runId: 'approval-run' } : { runId: 'approval-run', toolCallId: 'approval-call' },
          ),
        ),
      );
      await waitFor(() =>
        expect(screen.getByRole('button', { name: label, exact: true }).hasAttribute('disabled')).toBe(true),
      );
    });
  });

  describe.each([
    { label: 'Approve', endpoint: 'approve-tool-call-generate' },
    { label: 'Decline', endpoint: 'decline-tool-call-generate' },
  ])('when generation resumes after $label', ({ label, endpoint }) => {
    it('renders the assistant continuation in the conversation', async () => {
      server.use(
        http.post(`${BASE_URL}/api/agents/agent-1/${endpoint}`, () => HttpResponse.json(hitlGenerateResponse)),
      );
      renderApproval('generate');
      fireEvent.click(await screen.findByRole('button', { name: label, exact: true }));
      expect(await screen.findByText('The run continued after your decision.')).toBeTruthy();
    });
  });
});
