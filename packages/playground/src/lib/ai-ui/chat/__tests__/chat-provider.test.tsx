// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { server } from '@/test/msw-server';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { ChatProvider } from '../chat-provider';
import { useChatRunning, useChatSend } from '../chat-context';

const BASE_URL = 'http://localhost:4111';

interface Captured {
  url: string;
  body: any;
}

/** Streams a single `finish` SSE event then closes, so useChat completes cleanly. */
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

// Background queries fired by the real provider stack (memory config, working
// memory, thread-signal subscribe). They're not under test here but must be
// handled so `onUnhandledRequest: 'error'` stays quiet.
const baseHandlers = (_captured: Captured[]) => [
  http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
  http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
  http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () => workingMemoryResponse()),
  http.post(`${BASE_URL}/api/agents/:agentId/threads/subscribe`, () =>
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
          <WorkingMemoryProvider agentId="agent-1" threadId="thread-1" resourceId="agent-1">
            {children}
          </WorkingMemoryProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const SendOnMount = ({ text }: { text: string }) => {
  const send = useChatSend();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    send({ message: text });
  }, [send, text]);
  return null;
};

afterEach(() => {
  delete (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS;
  cleanup();
});

describe('ChatProvider', () => {
  beforeEach(() => {
    // Default tests target the legacy stream-until-idle route, not signals.
    (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS = 'false';
    server.resetHandlers();
  });

  it('streams via the agent stream endpoint and forwards the modelSettings', async () => {
    const captured: Captured[] = [];
    server.use(
      ...baseHandlers(captured),
      http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
        captured.push({ url: request.url, body: await request.json() });
        return sseResponse();
      }),
    );

    await act(async () => {
      render(
        <Wrapper>
          <ChatProvider
            agentId="agent-1"
            threadId="thread-1"
            initialMessages={[]}
            settings={{ modelSettings: { maxSteps: 7, temperature: 0.4 } }}
          >
            <SendOnMount text="Hello agent" />
          </ChatProvider>
        </Wrapper>,
      );
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 80));
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].body.maxSteps).toBe(7);
    expect(captured[0].body.modelSettings.temperature).toBe(0.4);
    const serialized = JSON.stringify(captured[0].body.messages ?? []);
    expect(serialized).toContain('Hello agent');
  });

  it('sets the agentVersionId on the request context', async () => {
    const captured: Captured[] = [];
    server.use(
      ...baseHandlers(captured),
      http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
        captured.push({ url: request.url, body: await request.json() });
        return sseResponse();
      }),
    );

    await act(async () => {
      render(
        <Wrapper>
          <ChatProvider
            agentId="agent-1"
            threadId="thread-1"
            initialMessages={[]}
            agentVersionId="v-42"
            requestContext={{ tenant: 'acme' }}
          >
            <SendOnMount text="hi" />
          </ChatProvider>
        </Wrapper>,
      );
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 80));
    });

    expect(captured).toHaveLength(1);
    const ctx = captured[0].body.requestContext ?? {};
    expect(ctx.agentVersionId).toBe('v-42');
    expect(ctx.tenant).toBe('acme');
  });

  it('routes to the generate endpoint when chatWithGenerate is set', async () => {
    const captured: Captured[] = [];
    server.use(
      ...baseHandlers(captured),
      http.post(`${BASE_URL}/api/agents/agent-1/generate`, async ({ request }) => {
        captured.push({ url: request.url, body: await request.json() });
        return HttpResponse.json({ text: 'ok', response: { messages: [] } });
      }),
    );

    await act(async () => {
      render(
        <Wrapper>
          <ChatProvider
            agentId="agent-1"
            threadId="thread-1"
            initialMessages={[]}
            settings={{ modelSettings: { chatWithGenerate: true } }}
          >
            <SendOnMount text="generate please" />
          </ChatProvider>
        </Wrapper>,
      );
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 80));
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].url).toContain('/generate');
  });

  it('exposes a stable send handle and a cancelRun function', async () => {
    const seen: { canSend: boolean; hasCancel: boolean } = { canSend: false, hasCancel: false };
    const Probe = () => {
      const { cancelRun } = useChatRunning();
      const send = useChatSend();
      seen.canSend = typeof send === 'function';
      seen.hasCancel = typeof cancelRun === 'function';
      return null;
    };

    server.use(...baseHandlers([]));

    await act(async () => {
      render(
        <Wrapper>
          <ChatProvider agentId="agent-1" threadId="thread-1" initialMessages={[]}>
            <Probe />
          </ChatProvider>
        </Wrapper>,
      );
    });

    expect(seen.canSend).toBe(true);
    expect(seen.hasCancel).toBe(true);
  });

  it('enables thread signals when supported and not opted out', async () => {
    delete (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS;
    const captured: Captured[] = [];
    server.use(
      ...baseHandlers(captured),
      http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
        captured.push({ url: request.url, body: await request.json() });
        return sseResponse();
      }),
      // Signal-mode route fallback so an unhandled request never fails the test.
      http.post(`${BASE_URL}/api/agents/agent-1/stream/signal`, async ({ request }) => {
        captured.push({ url: request.url, body: await request.json() });
        return sseResponse();
      }),
    );

    const canSendValues: boolean[] = [];
    const Probe = () => {
      const { canSendWhileStreaming } = useChatRunning();
      canSendValues.push(canSendWhileStreaming);
      return null;
    };

    await act(async () => {
      render(
        <Wrapper>
          <ChatProvider
            agentId="agent-1"
            threadId="thread-1"
            initialMessages={[]}
            modelVersion="v2"
            supportsMemory
          >
            <Probe />
          </ChatProvider>
        </Wrapper>,
      );
    });

    // With a supported model + thread signals enabled + a threadId, the composer
    // may send while streaming.
    expect(canSendValues.at(-1)).toBe(true);
  });
});
