// @vitest-environment jsdom
import type { ListMemoryThreadMessagesResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw-server';

/**
 * Regression tests for AgentBadgeWrapper's message-source selection and fetch
 * gating. The data hook (useAgentMessages) is driven through the real
 * @mastra/client-js + React Query stack via MSW — only the heavy presentational
 * leaves (AgentBadge, LoadingBadge) and the pure resolveToChildMessages helper
 * are stubbed as thin seams so we can assert on the props the wrapper computes.
 */

const mockResolveToChildMessages = vi.fn();
const mockAgentBadge = vi.fn(() => null);

vi.mock('../badges/resolve-child-messages', () => ({
  resolveToChildMessages: mockResolveToChildMessages,
}));

vi.mock('../badges/agent-badge', () => ({
  AgentBadge: mockAgentBadge,
}));

vi.mock('../badges/loading-badge', () => ({
  LoadingBadge: () => null,
}));

const BASE_URL = 'http://localhost:4111';

const renderWrapper = async (props: Record<string, unknown>) => {
  const { AgentBadgeWrapper } = await import('../badges/agent-badge-wrapper');
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        {/* @ts-expect-error narrow test props */}
        <AgentBadgeWrapper {...props} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );

  await waitFor(() => expect(mockAgentBadge).toHaveBeenCalled());
};

beforeEach(() => {
  mockResolveToChildMessages.mockReset();
  mockAgentBadge.mockReset();
  mockAgentBadge.mockReturnValue(null);
});

describe('AgentBadgeWrapper', () => {
  describe('when streamed childMessages is empty and a subagent thread exists', () => {
    it('falls back to messages resolved from the fetched thread', async () => {
      const emptyThread: ListMemoryThreadMessagesResponse = { messages: [] };
      server.use(http.get(`${BASE_URL}/api/memory/threads/thread-1/messages`, () => HttpResponse.json(emptyThread)));
      const fallbackMessages = [{ type: 'text', content: 'resolved from thread' }];
      mockResolveToChildMessages.mockReturnValue(fallbackMessages);

      await renderWrapper({
        agentId: 'agent-1',
        result: { childMessages: [], subAgentThreadId: 'thread-1' },
        toolCallId: 'tool-call-1',
        toolName: 'subagent-tool',
        toolApprovalMetadata: undefined,
        isNetwork: false,
      });

      expect(mockResolveToChildMessages).toHaveBeenCalledWith([]);
      expect(mockAgentBadge).toHaveBeenCalledWith(
        expect.objectContaining({
          keepOpenForStreamingChildMessages: true,
          messages: fallbackMessages,
        }),
        undefined,
      );
    }, 15000);
  });

  describe('when there is no result yet', () => {
    it('renders an in-progress badge with no messages and streaming closed', async () => {
      mockResolveToChildMessages.mockReturnValue([]);

      await renderWrapper({
        agentId: 'agent-1',
        result: undefined,
        toolCallId: 'tool-call-1',
        toolName: 'subagent-tool',
        toolApprovalMetadata: undefined,
        isNetwork: false,
      });

      expect(mockResolveToChildMessages).toHaveBeenCalledWith([]);
      expect(mockAgentBadge).toHaveBeenCalledWith(
        expect.objectContaining({
          keepOpenForStreamingChildMessages: false,
          messages: [],
        }),
        undefined,
      );
    });
  });

  describe('when the result carries embedded agent text', () => {
    it('uses the embedded text without fetching a subagent thread', async () => {
      await renderWrapper({
        agentId: 'agent-1',
        result: {
          text: 'remote A2A response',
          subAgentThreadId: 'thread-that-may-not-exist-locally',
          subAgentToolResults: [],
        },
        toolCallId: 'tool-call-1',
        toolName: 'subagent-tool',
        toolApprovalMetadata: undefined,
        isNetwork: false,
      });

      expect(mockResolveToChildMessages).not.toHaveBeenCalled();
      expect(mockAgentBadge).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ type: 'text', content: 'remote A2A response' }],
        }),
        undefined,
      );
    });
  });
});
