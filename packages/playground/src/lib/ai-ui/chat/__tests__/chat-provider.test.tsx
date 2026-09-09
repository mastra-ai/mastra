import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { useMemoryThreadMessages } from '@mastra/playground-ui/domains/memory/hooks/use-memory-thread-messages';
import { useObservationalMemory } from '@mastra/playground-ui/domains/memory/hooks/use-observational-memory';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatMessages, useChatRunning, useChatSend } from '../chat-context';
import { ChatProvider } from '../chat-provider';
import { workingMemoryFixture } from './fixtures/working-memory';
import { WorkingMemoryProvider, useWorkingMemory } from '@/domains/agents/context/agent-working-memory-context';
import { PlaygroundModelProvider, usePlaygroundModel } from '@/domains/agents/context/playground-model-context';
import { useMemoryConfig } from '@/domains/memory/hooks';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const createDeferred = () => {
  let resolve = () => {};
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
};

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

const omObservationWithExtractionStream = () =>
  new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      await new Promise(resolve => setTimeout(resolve, 20));
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: 'data-om-observation-start',
            data: { cycleId: 'cycle-1', operationType: 'observation' },
          })}\n\n`,
        ),
      );
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: 'data-om-observation-end',
            data: {
              cycleId: 'cycle-1',
              operationType: 'observation',
              tokensObserved: 12,
              tokensKept: 4,
              extractedValues: { priority: 'high' },
              extractionFailures: [{ slug: 'status', error: 'missing value' }],
            },
          })}\n\n`,
        ),
      );
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'finish', payload: {} })}\n\n`));
      controller.close();
    },
  });

const omObservationWithExtractionResponse = () =>
  new HttpResponse(omObservationWithExtractionStream(), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });

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

const ModelSelectionHarness = () => {
  const { setModel, setProvider } = usePlaygroundModel();
  const send = useChatSend();

  return (
    <>
      <button onClick={() => setModel('google', 'gemini-2.5-flash')}>Select model</button>
      <button onClick={() => setProvider('openai')}>Change provider</button>
      <button onClick={() => send({ message: 'Use selected model' })}>Send message</button>
    </>
  );
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

  describe('when Studio selects a request-scoped model', () => {
    it('only sends an explicit override without mutating the agent', async () => {
      const captured: Captured[] = [];
      const onMutation = vi.fn();
      server.use(
        ...baseHandlers(captured),
        http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
          captured.push({ url: request.url, body: await captureBody(request) });
          return sseResponse();
        }),
        http.post(`${BASE_URL}/api/agents/agent-1/model`, () => {
          onMutation();
          return HttpResponse.json({ message: 'unexpected mutation' });
        }),
      );

      render(
        <Wrapper>
          <PlaygroundModelProvider defaultProvider="openai" defaultModel="gpt-4o-mini">
            <ChatProvider agentId="agent-1" threadId="thread-1" initialMessages={[]}>
              <ModelSelectionHarness />
            </ChatProvider>
          </PlaygroundModelProvider>
        </Wrapper>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
      await waitFor(() => expect(captured).toHaveLength(1));
      expect(captured[0].body).not.toHaveProperty('model');

      fireEvent.click(screen.getByRole('button', { name: 'Select model' }));
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

      await waitFor(() => expect(captured).toHaveLength(2));
      expect(captured[1].body.model).toBe('google/gemini-2.5-flash');

      fireEvent.click(screen.getByRole('button', { name: 'Change provider' }));
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

      await waitFor(() => expect(captured).toHaveLength(3));
      expect(captured[2].body).not.toHaveProperty('model');
      expect(onMutation).not.toHaveBeenCalled();
    });
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

  it('completes persisted buffering markers on reload when buffer status already has the finished chunk', async () => {
    const renderSnapshots: MastraDBMessage[][] = [];
    const MessagesProbe = () => {
      renderSnapshots.push(useChatMessages());
      return null;
    };

    const initialMessages = [
      {
        id: 'msg-buffering-start',
        role: 'assistant',
        createdAt: new Date('2026-05-29T00:00:00.000Z'),
        threadId: 'thread-1',
        resourceId: 'agent-1',
        content: {
          format: 2,
          parts: [
            {
              type: 'data-om-buffering-start',
              data: {
                cycleId: 'cycle-reload',
                operationType: 'observation',
                recordId: 'record-1',
                threadId: 'thread-1',
              },
            },
          ],
          metadata: {},
        },
      },
    ] satisfies MastraDBMessage[];

    const bufferStatusRequests: string[] = [];
    server.use(
      ...baseHandlers([]),
      http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: { observationalMemory: true } })),
      http.post(`${BASE_URL}/api/memory/observational-memory/buffer-status`, ({ request }) => {
        bufferStatusRequests.push(request.url);
        return HttpResponse.json({
          record: {
            bufferedObservationChunks: [
              {
                cycleId: 'cycle-reload',
                messageTokens: 120,
                tokenCount: 40,
                observations: ['remembered after reload'],
                extractedValues: { priority: 'high' },
              },
            ],
          },
        });
      }),
    );

    await act(async () => {
      render(
        <Wrapper>
          <ChatProvider agentId="agent-1" threadId="thread-1" initialMessages={initialMessages}>
            <MessagesProbe />
          </ChatProvider>
        </Wrapper>,
      );
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    expect(bufferStatusRequests).toHaveLength(1);

    const latestMessages = renderSnapshots.at(-1) ?? [];
    const omPart = latestMessages
      .flatMap(message => (Array.isArray(message.content?.parts) ? message.content.parts : []))
      .find(part => (part as { toolCallId?: string }).toolCallId === 'om-buffering-cycle-reload') as
      | { state?: string; output?: { omData?: Record<string, unknown> } }
      | undefined;

    expect(omPart?.state).toBe('output-available');
    expect(omPart?.output?.omData?.observations).toEqual(['remembered after reload']);
    expect(omPart?.output?.omData?.extractedValues).toEqual({ priority: 'high' });
  });

  it('restores buffered extraction fields on reload when the persisted buffering-end has no extraction payload', async () => {
    const renderSnapshots: MastraDBMessage[][] = [];
    const MessagesProbe = () => {
      renderSnapshots.push(useChatMessages());
      return null;
    };

    const initialMessages = [
      {
        id: 'msg-buffering-terminal',
        role: 'assistant',
        createdAt: new Date('2026-05-29T00:00:00.000Z'),
        threadId: 'thread-1',
        resourceId: 'agent-1',
        content: {
          format: 2,
          parts: [
            {
              type: 'data-om-buffering-start',
              data: {
                cycleId: 'cycle-terminal-reload',
                operationType: 'observation',
                recordId: 'record-1',
                threadId: 'thread-1',
              },
            },
            {
              type: 'data-om-buffering-end',
              data: {
                cycleId: 'cycle-terminal-reload',
                operationType: 'observation',
                observations: ['persisted observation'],
              },
            },
          ],
          metadata: {},
        },
      },
    ] satisfies MastraDBMessage[];

    const bufferStatusRequests: string[] = [];
    server.use(
      ...baseHandlers([]),
      http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: { observationalMemory: true } })),
      http.post(`${BASE_URL}/api/memory/observational-memory/buffer-status`, ({ request }) => {
        bufferStatusRequests.push(request.url);
        return HttpResponse.json({
          record: {
            bufferedObservationChunks: [
              {
                cycleId: 'cycle-terminal-reload',
                messageTokens: 219,
                tokenCount: 81,
                observations: ['persisted observation'],
                extractedValues: { workingMemory: { location: 'Vancouver' } },
              },
            ],
          },
        });
      }),
    );

    await act(async () => {
      render(
        <Wrapper>
          <ChatProvider agentId="agent-1" threadId="thread-1" initialMessages={initialMessages}>
            <MessagesProbe />
          </ChatProvider>
        </Wrapper>,
      );
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    expect(bufferStatusRequests).toHaveLength(1);

    const latestMessages = renderSnapshots.at(-1) ?? [];
    const omData = latestMessages
      .flatMap(message => (Array.isArray(message.content?.parts) ? message.content.parts : []))
      .map(part => (part as { output?: { omData?: unknown } }).output?.omData)
      .find(Boolean) as { extractedValues?: unknown } | undefined;

    expect(omData?.extractedValues).toEqual({ workingMemory: { location: 'Vancouver' } });
  });

  it('keeps streamed OM extraction data on the rendered chat marker while refreshing panel queries', async () => {
    const renderSnapshots: MastraDBMessage[][] = [];
    const MessagesProbe = () => {
      renderSnapshots.push(useChatMessages());
      return null;
    };

    server.use(
      ...baseHandlers([]),
      http.post(`${BASE_URL}/api/agents/agent-1/stream`, () => omObservationWithExtractionResponse()),
    );

    await act(async () => {
      render(
        <Wrapper>
          <ChatProvider agentId="agent-1" threadId="thread-1" initialMessages={[]}>
            <MessagesProbe />
            <SendOnMount text="trigger OM extraction" />
          </ChatProvider>
        </Wrapper>,
      );
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 120));
    });

    const latestMessages = renderSnapshots.at(-1) ?? [];
    const omData = latestMessages
      .flatMap(message => (Array.isArray(message.content?.parts) ? message.content.parts : []))
      .map(part => (part as { output?: { omData?: unknown } }).output?.omData)
      .find(Boolean) as { extractedValues?: unknown; extractionFailures?: unknown } | undefined;

    expect(omData?.extractedValues).toEqual({ priority: 'high' });
    expect(omData?.extractionFailures).toEqual([{ slug: 'status', error: 'missing value' }]);
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

  // Adapted from Jaya Krishna's regression cases in #22270, with independent completion gates.
  it.each(['observation-end', 'buffer-status'])(
    'refreshes working memory after %s without the other completion path',
    async boundary => {
      const emitBoundary = createDeferred();
      const finish = createDeferred();
      let persisted = false;
      let initialWorkingMemoryReads = 0;
      const workingMemoryRequest = vi.fn(() =>
        HttpResponse.json(workingMemoryFixture(persisted ? 'fresh working memory' : 'stale working memory')),
      );
      const bufferRequest = vi.fn(() => {
        persisted = true;
        return HttpResponse.json({ record: null });
      });
      const Probe = () => {
        const { workingMemoryData } = useWorkingMemory();
        const { data } = useMemoryConfig('agent-1');
        return (
          <>
            <div data-testid="wm-value">{workingMemoryData}</div>
            <div data-testid="wm-config">{String(data?.config?.observationalMemory)}</div>
          </>
        );
      };
      server.use(...baseHandlers([]));
      server.use(
        http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: { observationalMemory: true } })),
        http.get(`${BASE_URL}/api/memory/threads/thread-1/working-memory`, workingMemoryRequest),
        http.post(`${BASE_URL}/api/memory/observational-memory/buffer-status`, bufferRequest),
        http.post(
          `${BASE_URL}/api/agents/agent-1/stream`,
          () =>
            new HttpResponse(
              new ReadableStream<Uint8Array>({
                async start(controller) {
                  const encoder = new TextEncoder();
                  await emitBoundary.promise;
                  if (boundary === 'observation-end') {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ type: 'data-om-observation-start', data: { operationType: 'observation' } })}\n\n`,
                      ),
                    );
                    persisted = true;
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ type: 'data-om-observation-end', data: { operationType: 'observation' } })}\n\n`,
                      ),
                    );
                    await finish.promise;
                  }
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'finish', payload: {} })}\n\n`));
                  controller.close();
                },
              }),
              { headers: { 'content-type': 'text/event-stream' } },
            ),
        ),
      );
      render(
        <Wrapper>
          <ChatProvider agentId="agent-1" threadId="thread-1" initialMessages={[]}>
            <Probe />
            <SendOnMount text="update working memory" />
          </ChatProvider>
        </Wrapper>,
      );
      try {
        await screen.findByText('stale working memory');
        await waitFor(() => expect(screen.getByTestId('wm-config').textContent).toBe('true'));
        initialWorkingMemoryReads = workingMemoryRequest.mock.calls.length;
        emitBoundary.resolve();
        await screen.findByText('fresh working memory');
        expect(workingMemoryRequest).toHaveBeenCalledTimes(initialWorkingMemoryReads + 1);
        expect(bufferRequest).toHaveBeenCalledTimes(boundary === 'buffer-status' ? 1 : 0);
      } finally {
        emitBoundary.resolve();
        finish.resolve();
        await waitFor(() => expect(bufferRequest).toHaveBeenCalledTimes(1));
      }
    },
  );

  it('waits for the signals run to finish before refreshing buffered working memory', async () => {
    delete window.MASTRA_AGENT_SIGNALS;
    const accepted = createDeferred();
    const finish = createDeferred();
    const persisted = createDeferred();
    const close = createDeferred();
    let runFinished = false;
    let workingMemory = 'stale working memory';
    const bufferRequest = vi.fn(async () => {
      if (runFinished) await persisted.promise;
      return HttpResponse.json({ record: null });
    });
    const Probe = () => {
      const send = useChatSend();
      const { workingMemoryData } = useWorkingMemory();
      const { data } = useMemoryConfig('agent-1');
      return (
        <>
          <div>{workingMemoryData}</div>
          <button
            disabled={!data?.config?.observationalMemory}
            onClick={async () => {
              await send({ message: 'update working memory' });
              accepted.resolve();
            }}
          >
            Send signals message
          </button>
        </>
      );
    };
    server.use(...baseHandlers([]));
    server.use(
      http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: { observationalMemory: true } })),
      http.get(`${BASE_URL}/api/memory/threads/thread-1/working-memory`, () =>
        HttpResponse.json(workingMemoryFixture(workingMemory)),
      ),
      http.post(`${BASE_URL}/api/memory/observational-memory/buffer-status`, bufferRequest),
      http.post(`${BASE_URL}/api/agents/agent-1/send-message`, () => HttpResponse.json({ accepted: true })),
      http.post(
        `${BASE_URL}/api/agents/agent-1/threads/subscribe`,
        () =>
          new HttpResponse(
            new ReadableStream<Uint8Array>({
              async start(controller) {
                await finish.promise;
                runFinished = true;
                controller.enqueue(
                  new TextEncoder().encode(`data: ${JSON.stringify({ type: 'finish', payload: {} })}\n\n`),
                );
                await close.promise;
                controller.close();
              },
            }),
            { headers: { 'content-type': 'text/event-stream' } },
          ),
      ),
    );
    render(
      <Wrapper>
        <ChatProvider agentId="agent-1" threadId="thread-1" initialMessages={[]}>
          <Probe />
        </ChatProvider>
      </Wrapper>,
    );
    try {
      await screen.findByText('stale working memory');
      const send = screen.getByRole('button', { name: 'Send signals message' });
      await waitFor(() => expect(send.hasAttribute('disabled')).toBe(false));
      fireEvent.click(send);
      await act(async () => {
        await accepted.promise;
      });
      expect(bufferRequest).not.toHaveBeenCalled();
      finish.resolve();
      await waitFor(() => expect(bufferRequest).toHaveBeenCalledTimes(1));
      expect(screen.queryByText('fresh working memory')).toBeNull();
      workingMemory = 'fresh working memory';
      persisted.resolve();
      await screen.findByText('fresh working memory');
      expect(bufferRequest).toHaveBeenCalledTimes(1);
    } finally {
      finish.resolve();
      persisted.resolve();
      close.resolve();
    }
  });

  it.each(['success', 'error', 'before-newer', 'newer-error'])(
    'keeps ownership with the newest working-memory refresh: %s',
    async outcome => {
      const releaseOlder = createDeferred();
      const releaseNewer = createDeferred();
      const newerStarted = createDeferred();
      const olderStarted = createDeferred();
      const olderCompleted = createDeferred();
      const newerCompleted = createDeferred();
      let requests = 0;
      const Probe = () => {
        const { workingMemoryData, isLoading, refetch: refreshWorkingMemory } = useWorkingMemory();
        return (
          <>
            <div data-testid="wm-current">{workingMemoryData}</div>
            <div data-testid="wm-loading">{String(isLoading)}</div>
            <button onClick={() => void refreshWorkingMemory().then(olderCompleted.resolve)}>older refresh</button>
            <button onClick={() => void refreshWorkingMemory().then(newerCompleted.resolve)}>newer refresh</button>
          </>
        );
      };
      server.use(...baseHandlers([]));
      server.use(
        http.get(`${BASE_URL}/api/memory/threads/thread-1/working-memory`, async () => {
          requests++;
          if (requests === 1) return HttpResponse.json(workingMemoryFixture('initial working memory'));
          if (requests === 2) {
            olderStarted.resolve();
            await releaseOlder.promise;
            if (outcome === 'error') return new HttpResponse(undefined, { status: 400 });
            return HttpResponse.json(workingMemoryFixture('older working memory'));
          }
          newerStarted.resolve();
          if (outcome === 'before-newer') await releaseNewer.promise;
          if (outcome === 'newer-error') return new HttpResponse(undefined, { status: 400 });
          return HttpResponse.json(workingMemoryFixture('newer working memory'));
        }),
      );
      render(
        <Wrapper>
          <Probe />
        </Wrapper>,
      );
      await screen.findByText('initial working memory');
      fireEvent.click(screen.getByText('older refresh'));
      await olderStarted.promise;
      fireEvent.click(screen.getByText('newer refresh'));
      await newerStarted.promise;
      if (outcome === 'before-newer') {
        await act(async () => {
          releaseOlder.resolve();
          await olderCompleted.promise;
        });
        expect(screen.getByTestId('wm-loading').textContent).toBe('true');
        expect(screen.queryByText('older working memory')).toBeNull();
        releaseNewer.resolve();
      }
      await act(async () => {
        await newerCompleted.promise;
      });
      const expectedValue = outcome === 'newer-error' ? '' : 'newer working memory';
      expect(screen.getByTestId('wm-current').textContent).toBe(expectedValue);
      await waitFor(() => expect(screen.getByTestId('wm-loading').textContent).toBe('false'));
      await act(async () => {
        releaseOlder.resolve();
        await olderCompleted.promise;
      });
      expect(screen.getByTestId('wm-current').textContent).toBe(expectedValue);
      expect(screen.queryByText('older working memory')).toBeNull();
    },
  );
});
