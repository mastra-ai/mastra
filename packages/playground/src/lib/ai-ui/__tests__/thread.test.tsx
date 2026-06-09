// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { server } from '@/test/msw-server';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { BrowserSessionProvider } from '@/domains/agents/context/browser-session-provider';
import { ChatProvider } from '../chat/chat-provider';
import { Thread } from '../thread';

const BASE_URL = 'http://localhost:4111';

interface Captured {
  url: string;
  body: any;
}

const finishStream = () =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'finish', payload: {} })}\n\n`));
      controller.close();
    },
  });

const sseResponse = () =>
  new HttpResponse(finishStream(), { status: 200, headers: { 'content-type': 'text/event-stream' } });

const workingMemoryResponse = () =>
  HttpResponse.json({ workingMemory: null, source: 'thread', workingMemoryTemplate: null, threadExists: false });

const baseHandlers = () => [
  http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
  http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
  http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () => workingMemoryResponse()),
  http.get(`${BASE_URL}/api/agents/:agentId/voice/speakers`, () => HttpResponse.json([])),
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

const Wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BrowserSessionProvider agentId="agent-1" threadId="thread-1" enabled={false}>
            <WorkingMemoryProvider agentId="agent-1" threadId="thread-1" resourceId="agent-1">
              {children}
            </WorkingMemoryProvider>
          </BrowserSessionProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const renderThread = (initialMessages: MastraDBMessage[]) =>
  render(
    <Wrapper>
      <ChatProvider agentId="agent-1" threadId="thread-1" initialMessages={initialMessages}>
        <Thread agentId="agent-1" agentName="Helper" threadId="thread-1" hasModelList />
      </ChatProvider>
    </Wrapper>,
  );

const userMessage = (text: string): MastraDBMessage => ({
  id: `m-${text}`,
  role: 'user',
  createdAt: new Date(),
  content: { format: 2, parts: [{ type: 'text', text }] },
});

afterEach(() => {
  delete (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS;
  cleanup();
});

describe('Thread', () => {
  beforeEach(() => {
    (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS = 'false';
    server.resetHandlers();
  });

  it('shows the empty welcome state when there are no messages', async () => {
    server.use(...baseHandlers());

    await act(async () => {
      renderThread([]);
    });

    expect(screen.getByText('How can I help you today?')).toBeTruthy();
  });

  it('renders existing messages instead of the welcome state', async () => {
    server.use(...baseHandlers());

    await act(async () => {
      renderThread([userMessage('previous question')]);
    });

    expect(screen.getByText('previous question')).toBeTruthy();
    expect(screen.queryByText('How can I help you today?')).toBeFalsy();
  });

  it('sends the composer text through the agent stream endpoint', async () => {
    const captured: Captured[] = [];
    server.use(
      ...baseHandlers(),
      http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
        captured.push({ url: request.url, body: await request.json() });
        return sseResponse();
      }),
    );

    await act(async () => {
      renderThread([]);
    });

    const textarea = screen.getByPlaceholderText('Enter your message...');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'hello from composer' } });
    });

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter' });
      await new Promise(resolve => setTimeout(resolve, 80));
    });

    expect(captured).toHaveLength(1);
    expect(JSON.stringify(captured[0].body.messages ?? [])).toContain('hello from composer');
    // Composer clears after sending.
    expect((textarea as HTMLTextAreaElement).value).toBe('');
  });

  it('does not send when the composer is empty', async () => {
    const captured: Captured[] = [];
    server.use(
      ...baseHandlers(),
      http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
        captured.push({ url: request.url, body: await request.json() });
        return sseResponse();
      }),
    );

    await act(async () => {
      renderThread([]);
    });

    const textarea = screen.getByPlaceholderText('Enter your message...');
    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter' });
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(captured).toHaveLength(0);
  });

  it('shows a cancel control while a run is in flight', async () => {
    let resolveStream: (() => void) | null = null;
    const blockedStream = () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          // Keep the stream open until the test resolves it, so `isRunning` stays true.
          resolveStream = () => controller.close();
        },
      });

    server.use(
      ...baseHandlers(),
      http.post(
        `${BASE_URL}/api/agents/agent-1/stream`,
        () => new HttpResponse(blockedStream(), { status: 200, headers: { 'content-type': 'text/event-stream' } }),
      ),
    );

    await act(async () => {
      renderThread([]);
    });

    const textarea = screen.getByPlaceholderText('Enter your message...');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'long running' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy();
    });

    await act(async () => {
      resolveStream?.();
      await new Promise(resolve => setTimeout(resolve, 50));
    });
  });
});
