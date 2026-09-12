import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AgentChat } from '../agent-chat';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { BrowserSessionProvider } from '@/domains/agents/context/browser-session-provider';
import { ThreadInputProvider } from '@/domains/conversation';
import { AgentSettingsProvider } from '@/domains/agents/context/agent-context';
import { server } from '@/test/msw-server';

import { emptyMcpServers, memoryDisabled, v2Agent } from '@/lib/ai-ui/__tests__/fixtures/agent';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';

const BASE_URL = 'http://localhost:4111';

const workingMemoryResponse = () =>
  HttpResponse.json({ workingMemory: null, source: 'thread', workingMemoryTemplate: null, threadExists: false });

const baseHandlers = () => [
  http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json(emptyMcpServers)),
  http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
  http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
  http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
  http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryDisabled)),
  http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () => workingMemoryResponse()),
  http.get(`${BASE_URL}/api/memory/observational-memory`, () => HttpResponse.json({ record: null })),
  http.get(`${BASE_URL}/api/agents/providers`, () => HttpResponse.json({ providers: [] })),
  http.get(`${BASE_URL}/api/agents/:agentId/voice/speakers`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/api/agents/:agentId`, () => HttpResponse.json(v2Agent)),
  http.get(`${BASE_URL}/api/editor/builder/settings`, () =>
    HttpResponse.json({ enabled: false, modelPolicy: { active: false } }),
  ),
  http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json({ providers: [] })),
  http.post(
    `${BASE_URL}/api/agents/:agentId/threads/subscribe`,
    () =>
      new HttpResponse(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.close();
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      ),
  ),
];

const Wrapper = ({ children, threadId = 'thread-1' }: { children: ReactNode; threadId?: string }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BrowserSessionProvider agentId="agent-1" threadId={threadId} enabled={false}>
            <WorkingMemoryProvider agentId="agent-1" threadId={threadId} resourceId="agent-1">
              <AgentSettingsProvider>
                <ThreadInputProvider>
                  {children}
                </ThreadInputProvider>
              </AgentSettingsProvider>
            </WorkingMemoryProvider>
          </BrowserSessionProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const userMessage = (text: string): MastraDBMessage => ({
  id: `m-${text}`,
  role: 'user',
  createdAt: new Date(),
  content: { format: 2, parts: [{ type: 'text', text }] },
});

afterEach(() => {
  cleanup();
});

describe('AgentChat Pagination (useAgentMessages)', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it('preserves chronological order across pagination pages without reversing the UI', async () => {
    // We mock listThreadMessages to return two pages.
    // Page 0 (latest messages): [message 2, message 3]
    // Page 1 (older messages): [message 0, message 1]
    const page0 = [userMessage('message 2'), userMessage('message 3')];
    const page1 = [userMessage('message 0'), userMessage('message 1')];

    server.use(
      ...baseHandlers(),
      http.get(`${BASE_URL}/api/memory/threads/:threadId/messages`, ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '0', 10);

        if (page === 0) {
          return HttpResponse.json({ messages: page0, page: 0, hasMore: true });
        } else if (page === 1) {
          return HttpResponse.json({ messages: page1, page: 1, hasMore: false });
        }
        return HttpResponse.json({ messages: [], hasMore: false });
      }),
    );

    render(
      <Wrapper threadId="thread-1">
        <AgentChat
          agentId="agent-1"
          agentName="Helper"
          threadId="thread-1"
          memory={true}
          supportsMemory={true}
          isNewThread={false}
        />
      </Wrapper>
    );

    // Initial load should display page 0
    await waitFor(() => {
      expect(screen.getByText('message 2')).toBeTruthy();
      expect(screen.getByText('message 3')).toBeTruthy();
    });

    // We shouldn't see page 1 yet
    expect(screen.queryByText('message 0')).toBeNull();

    // Trigger loading previous (mock reaching scroll start)
    const viewport = document.querySelector<HTMLElement>('[data-slot="message-scroller-viewport"]');
    expect(viewport).toBeTruthy();

    await act(async () => {
      // Dispatch scroll event on the viewport to trigger `onReachStart` of react-scroll-to-bottom
      if (viewport) {
        Object.defineProperty(viewport, 'scrollTop', { configurable: true, writable: true, value: 0 });
        fireEvent.scroll(viewport);
      }
    });

    // Wait for the new messages to render
    await waitFor(() => {
      expect(screen.getByText('message 0')).toBeTruthy();
      expect(screen.getByText('message 1')).toBeTruthy();
    });

    // Assert chronological ordering in the DOM output
    const allMessageElements = document.querySelectorAll('[data-message-id]');
    const messageTexts = Array.from(allMessageElements).map(
      el => el.getAttribute('data-message-id')?.replace('m-', '')
    );
    
    // Older page should appear BEFORE newer page!
    // And within each page, older message should appear before newer message!
    expect(messageTexts).toEqual(['message 0', 'message 1', 'message 2', 'message 3']);
  });
});
