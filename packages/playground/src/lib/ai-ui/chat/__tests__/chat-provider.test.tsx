import { useObservationalMemory, useMemoryThreadMessages } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useChatRunning, useChatSend } from '../chat-context';
import { ChatProvider } from '../chat-provider';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

type CapturedBody = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

interface Captured {
  url: string;
  body: CapturedBody;
}

const captureBody = async (request: Request): Promise<CapturedBody> => {
  const body: unknown = await request.json();
  return isRecord(body) ? body : {};
};

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

/**
 * Streams an OM `data-om-observation-end` event then a `finish` event, so the
 * provider runs its OM-end refresh path (which must invalidate the memory
 * timeline panel queries) before the stream closes cleanly.
 */
const omObservationEndStream = () =>
  new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      // Let the panel's initial mount fetches settle before emitting the OM
      // event, so the subsequent refetch is observable as a distinct increment.
      await new Promise(resolve => setTimeout(resolve, 120));
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'data-om-observation-end', data: { operationType: 'observation' } })}\n\n`,
        ),
      );
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'finish', payload: {} })}\n\n`));
      controller.close();
    },
  });

const omObservationEndResponse = () =>
  new HttpResponse(omObservationEndStream(), { status: 200, headers: { 'content-type': 'text/event-stream' } });

const workingMemoryResponse = () =>
  HttpResponse.json({ workingMemory: null, source: 'thread', workingMemoryTemplate: null, threadExists: false });

// Background queries fired by the real provider stack (memory config, working
// memory, thread-signal subscribe). They're not under test here but must be
// handled so `onUnhandledRequest: 'error'` stays quiet.
const baseHandlers = (_captured: Captured[]) => [
  http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
  http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
  http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () => workingMemoryResponse()),
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

/**
 * Subscribes to the memory timeline panel's React Query keys (the playground-ui
 * hooks) so the test can observe whether OM stream events trigger a refetch.
 */
const PanelQueriesConsumer = ({ agentId, threadId }: { agentId: string; threadId: string }) => {
  useObservationalMemory(agentId, threadId);
  useMemoryThreadMessages(threadId);
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
        captured.push({ url: request.url, body: await captureBody(request) });
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
    const modelSettings = captured[0].body.modelSettings;
    expect(isRecord(modelSettings) ? modelSettings.temperature : undefined).toBe(0.4);
    const serialized = JSON.stringify(captured[0].body.messages ?? []);
    expect(serialized).toContain('Hello agent');
  });

  it('sets the agentVersionId on the request context', async () => {
    const captured: Captured[] = [];
    server.use(
      ...baseHandlers(captured),
      http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
        captured.push({ url: request.url, body: await captureBody(request) });
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
            threadMetadata={{ mastra: { agentVersionId: 'v-42' } }}
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
    const ctx = captured[0].body.requestContext;
    expect(isRecord(ctx) ? ctx.agentVersionId : undefined).toBe('v-42');
    expect(isRecord(ctx) ? ctx.tenant : undefined).toBe('acme');

    const memory = captured[0].body.memory;
    const memoryThread = isRecord(memory) ? memory.thread : undefined;
    expect(isRecord(memoryThread) ? memoryThread.id : undefined).toBe('thread-1');
    const metadata = isRecord(memoryThread) ? memoryThread.metadata : undefined;
    const mastra = isRecord(metadata) ? metadata.mastra : undefined;
    expect(isRecord(mastra) ? mastra.agentVersionId : undefined).toBe('v-42');
  });

  it('routes to the generate endpoint when chatWithGenerate is set', async () => {
    const captured: Captured[] = [];
    server.use(
      ...baseHandlers(captured),
      http.post(`${BASE_URL}/api/agents/agent-1/generate`, async ({ request }) => {
        captured.push({ url: request.url, body: await captureBody(request) });
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

  it.each([
    ['generate', { chatWithGenerate: true }],
    ['network', { chatWithNetwork: true }],
  ] as const)(
    'disables mid-stream sends for %s transport even when thread signals are enabled',
    async (_mode, modelSettings) => {
      delete (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS;
      server.use(...baseHandlers([]));

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
              settings={{ modelSettings }}
            >
              <Probe />
            </ChatProvider>
          </Wrapper>,
        );
      });

      expect(canSendValues.at(-1)).toBe(false);
    },
  );

  it('enables thread signals when supported and not opted out', async () => {
    delete (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS;
    const captured: Captured[] = [];
    server.use(
      ...baseHandlers(captured),
      http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
        captured.push({ url: request.url, body: await captureBody(request) });
        return sseResponse();
      }),
      // Signal-mode route fallback so an unhandled request never fails the test.
      http.post(`${BASE_URL}/api/agents/agent-1/stream/signal`, async ({ request }) => {
        captured.push({ url: request.url, body: await captureBody(request) });
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
          <ChatProvider agentId="agent-1" threadId="thread-1" initialMessages={[]} modelVersion="v2" supportsMemory>
            <Probe />
          </ChatProvider>
        </Wrapper>,
      );
    });

    // With a supported model + thread signals enabled + a threadId, the composer
    // may send while streaming.
    expect(canSendValues.at(-1)).toBe(true);
  });

  it('refetches the memory timeline panel queries (scoped to the thread) on an OM observation-end event', async () => {
    // Count requests to the panel's endpoints. The panel reads playground-ui
    // hooks keyed under ['memory', ...]; a streamed OM observation-end must
    // invalidate exactly those keys so the panel refetches.
    const omRequests: string[] = [];
    const messageRequests: string[] = [];

    server.use(
      ...baseHandlers([]),
      http.get(`${BASE_URL}/api/memory/observational-memory`, ({ request }) => {
        omRequests.push(request.url);
        return HttpResponse.json({ record: null });
      }),
      http.get(`${BASE_URL}/api/memory/threads/thread-1/messages`, ({ request }) => {
        messageRequests.push(request.url);
        return HttpResponse.json({ messages: [], uiMessages: [] });
      }),
      http.post(`${BASE_URL}/api/agents/agent-1/stream`, () => omObservationEndResponse()),
    );

    await act(async () => {
      render(
        <Wrapper>
          <ChatProvider agentId="agent-1" threadId="thread-1" initialMessages={[]}>
            <PanelQueriesConsumer agentId="agent-1" threadId="thread-1" />
            <SendOnMount text="trigger OM" />
          </ChatProvider>
        </Wrapper>,
      );
    });

    // Initial mount fetches each panel query once (the stream delays its OM
    // event by ~120ms, so these have settled by now).
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 80));
    });
    const omAfterMount = omRequests.length;
    const messagesAfterMount = messageRequests.length;
    expect(omAfterMount).toBeGreaterThanOrEqual(1);
    expect(messagesAfterMount).toBeGreaterThanOrEqual(1);

    // After the OM observation-end event, the panel queries must refetch.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });
    expect(omRequests.length).toBeGreaterThan(omAfterMount);
    expect(messageRequests.length).toBeGreaterThan(messagesAfterMount);

    // The refetch stays scoped to the active thread.
    expect(messageRequests.every(url => url.includes('/threads/thread-1/messages'))).toBe(true);
  });

  it('refetches the memory timeline panel queries when the chat stream finishes (OM disabled)', async () => {
    // Even without observational memory, the panel's thread messages and OM/status
    // queries must refetch when a plain chat stream finishes, so the panel never
    // shows stale data after a completion.
    const omRequests: string[] = [];
    const messageRequests: string[] = [];

    server.use(
      ...baseHandlers([]),
      http.get(`${BASE_URL}/api/memory/observational-memory`, ({ request }) => {
        omRequests.push(request.url);
        return HttpResponse.json({ record: null });
      }),
      http.get(`${BASE_URL}/api/memory/threads/thread-1/messages`, ({ request }) => {
        messageRequests.push(request.url);
        return HttpResponse.json({ messages: [], uiMessages: [] });
      }),
      // A plain finish stream — no OM events at all.
      http.post(`${BASE_URL}/api/agents/agent-1/stream`, () => sseResponse()),
    );

    await act(async () => {
      render(
        <Wrapper>
          <ChatProvider agentId="agent-1" threadId="thread-1" initialMessages={[]}>
            <PanelQueriesConsumer agentId="agent-1" threadId="thread-1" />
            <SendOnMount text="just finish" />
          </ChatProvider>
        </Wrapper>,
      );
    });

    // Wait for mount fetches and the stream to finish + the finish-path refetch.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 250));
    });

    // The finish-path refresh must have refetched the panel queries more than once.
    expect(omRequests.length).toBeGreaterThan(1);
    expect(messageRequests.length).toBeGreaterThan(1);
    expect(messageRequests.every(url => url.includes('/threads/thread-1/messages'))).toBe(true);
  });
});
