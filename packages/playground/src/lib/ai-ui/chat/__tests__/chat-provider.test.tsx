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
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { PlaygroundModelProvider, usePlaygroundModel } from '@/domains/agents/context/playground-model-context';
import { useToolCall } from '@/services/tool-call-provider';
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

const selectorErrorStream = () =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: 'error',
            runId: 'run-invalid-version',
            payload: {
              error: { code: 'VERSION_NOT_FOUND', message: 'The selected exact version no longer exists.' },
            },
          })}\n\n`,
        ),
      );
      controller.close();
    },
  });

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

const ToolContinuationHarness = ({ action }: { action: 'approve' | 'decline' }) => {
  const send = useChatSend();
  const { cancelRun, isContinuationBlocked: isComposerBlocked } = useChatRunning();
  const { approveToolcall, declineToolcall, isContinuationBlocked } = useToolCall();

  return (
    <>
      <button onClick={() => send({ message: 'Start a pinned run' })}>Start run</button>
      <button onClick={() => void cancelRun()}>Cancel run</button>
      <button
        onClick={() => {
          if (action === 'approve') {
            approveToolcall('tool-call-1');
          } else {
            declineToolcall('tool-call-1');
          }
        }}
      >
        Continue tool
      </button>
      <output aria-label="Continuation actions">{isContinuationBlocked ? 'disabled' : 'enabled'}</output>
      <output aria-label="Composer">{isComposerBlocked ? 'disabled' : 'enabled'}</output>
    </>
  );
};

const ContinuationErrorProbe = () => {
  const messages = useChatMessages();
  const text = messages
    .flatMap(message => message.content.parts)
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n');

  return <output aria-label="Continuation error">{text}</output>;
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

  it('reports a streamed selector envelope while preserving its rendered error', async () => {
    const onRunVersionSelectorError = vi.fn();
    const renderSnapshots: MastraDBMessage[][] = [];
    const MessagesProbe = () => {
      renderSnapshots.push(useChatMessages());
      return null;
    };
    server.use(
      ...baseHandlers([]),
      http.post(
        `${BASE_URL}/api/agents/agent-1/stream`,
        () =>
          new HttpResponse(selectorErrorStream(), {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
          }),
      ),
    );

    render(
      <Wrapper>
        <ChatProvider
          agentId="agent-1"
          threadId="thread-1"
          initialMessages={[]}
          versions={{ self: { versionId: 'removed-version' } }}
          onRunVersionSelectorError={onRunVersionSelectorError}
        >
          <MessagesProbe />
          <SendOnMount text="run the removed version" />
        </ChatProvider>
      </Wrapper>,
    );

    await waitFor(() => expect(onRunVersionSelectorError).toHaveBeenCalledWith('VERSION_NOT_FOUND'));
    expect(onRunVersionSelectorError).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        renderSnapshots
          .at(-1)
          ?.flatMap(message => message.content.parts)
          .some(part => part.type === 'text' && part.text === 'The selected exact version no longer exists.'),
      ).toBe(true),
    );
  });

  describe('when a tool approval continuation conflicts with the pinned run identity', () => {
    it('stops after one request and explains that version policy cannot change', async () => {
      const streamRequests: Captured[] = [];
      const continuationRequests: CapturedBody[] = [];
      const onRunVersionSelectorError = vi.fn();
      const onRunAuthorizationError = vi.fn();
      server.use(
        ...baseHandlers(streamRequests),
        http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
          streamRequests.push({ url: request.url, body: await captureBody(request) });
          return sseResponse();
        }),
        http.post(`${BASE_URL}/api/agents/agent-1/approve-tool-call`, async ({ request }) => {
          continuationRequests.push(await captureBody(request));
          return HttpResponse.json(
            {
              error: {
                code: 'PINNED_VERSION_CONFLICT',
                message: 'The continuation tried to replace its pinned version policy.',
              },
            },
            { status: 409 },
          );
        }),
      );

      const initialMessages: MastraDBMessage[] = [];
      const { rerender } = render(
        <Wrapper>
          <ChatProvider
            agentId="agent-1"
            threadId="thread-1"
            initialMessages={initialMessages}
            versions={{ self: { label: 'candidate' } }}
            onRunVersionSelectorError={onRunVersionSelectorError}
            onRunAuthorizationError={onRunAuthorizationError}
          >
            <ToolContinuationHarness action="approve" />
            <ContinuationErrorProbe />
          </ChatProvider>
        </Wrapper>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Start run' }));
      await waitFor(() => expect(streamRequests).toHaveLength(1));
      fireEvent.click(screen.getByRole('button', { name: 'Continue tool' }));

      await waitFor(() =>
        expect(screen.getByRole('status', { name: 'Continuation error' }).textContent).toContain(
          'This active run cannot change version policy.',
        ),
      );
      expect(continuationRequests).toHaveLength(1);
      expect(continuationRequests[0]).not.toHaveProperty('versions');
      expect(JSON.stringify(continuationRequests[0])).not.toContain('candidate');
      expect(onRunVersionSelectorError).not.toHaveBeenCalled();
      expect(onRunAuthorizationError).not.toHaveBeenCalled();

      expect(screen.getByRole('status', { name: 'Continuation actions' }).textContent).toBe('disabled');
      expect(screen.getByRole('status', { name: 'Composer' }).textContent).toBe('disabled');
      fireEvent.click(screen.getByRole('button', { name: 'Continue tool' }));
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      expect(continuationRequests).toHaveLength(1);

      fireEvent.click(screen.getByRole('button', { name: 'Start run' }));
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      expect(streamRequests).toHaveLength(1);
      expect(screen.getByRole('status', { name: 'Continuation actions' }).textContent).toBe('disabled');
      expect(screen.getByRole('status', { name: 'Composer' }).textContent).toBe('disabled');

      fireEvent.click(screen.getByRole('button', { name: 'Cancel run' }));
      expect(screen.getByRole('status', { name: 'Continuation actions' }).textContent).toBe('enabled');
      expect(screen.getByRole('status', { name: 'Composer' }).textContent).toBe('enabled');

      fireEvent.click(screen.getByRole('button', { name: 'Start run' }));
      await waitFor(() => expect(streamRequests).toHaveLength(2));
      fireEvent.click(screen.getByRole('button', { name: 'Continue tool' }));
      await waitFor(() => expect(continuationRequests).toHaveLength(2));
      await waitFor(() =>
        expect(screen.getByRole('status', { name: 'Continuation actions' }).textContent).toBe('disabled'),
      );

      rerender(
        <Wrapper>
          <ChatProvider
            agentId="agent-1"
            threadId="thread-2"
            initialMessages={initialMessages}
            versions={{ self: { label: 'candidate' } }}
            onRunVersionSelectorError={onRunVersionSelectorError}
            onRunAuthorizationError={onRunAuthorizationError}
          >
            <ToolContinuationHarness action="approve" />
            <ContinuationErrorProbe />
          </ChatProvider>
        </Wrapper>,
      );
      await waitFor(() =>
        expect(screen.getByRole('status', { name: 'Continuation actions' }).textContent).toBe('enabled'),
      );
      expect(screen.getByRole('status', { name: 'Composer' }).textContent).toBe('enabled');
    });
  });

  describe('when authorization is revoked before a tool decline continuation', () => {
    it('refreshes authorization, fails closed, and explains why the continuation stopped', async () => {
      const streamRequests: Captured[] = [];
      const continuationRequests: CapturedBody[] = [];
      const onRunAuthorizationError = vi.fn();
      const initialMessages: MastraDBMessage[] = [];
      server.use(
        ...baseHandlers(streamRequests),
        http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
          streamRequests.push({ url: request.url, body: await captureBody(request) });
          return sseResponse();
        }),
        http.post(`${BASE_URL}/api/agents/agent-1/decline-tool-call`, async ({ request }) => {
          continuationRequests.push(await captureBody(request));
          return HttpResponse.json(
            { error: { code: 'PERMISSION_DENIED', message: 'Execute access was revoked.' } },
            { status: 403 },
          );
        }),
      );

      const { rerender } = render(
        <Wrapper>
          <ChatProvider
            agentId="agent-1"
            threadId="thread-1"
            initialMessages={initialMessages}
            versions={{ self: { label: 'candidate' } }}
            onRunAuthorizationError={onRunAuthorizationError}
          >
            <ToolContinuationHarness action="decline" />
            <ContinuationErrorProbe />
          </ChatProvider>
        </Wrapper>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Start run' }));
      await waitFor(() => expect(streamRequests).toHaveLength(1));
      fireEvent.click(screen.getByRole('button', { name: 'Continue tool' }));

      await waitFor(() => expect(onRunAuthorizationError).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('status', { name: 'Continuation error' }).textContent).toContain(
        'You no longer have permission to continue this run.',
      );
      expect(continuationRequests).toHaveLength(1);
      expect(continuationRequests[0]).not.toHaveProperty('versions');
      expect(JSON.stringify(continuationRequests[0])).not.toContain('candidate');

      rerender(
        <Wrapper>
          <ChatProvider
            agentId="agent-1"
            threadId="thread-1"
            initialMessages={initialMessages}
            versions={{ self: { label: 'candidate' } }}
            canContinueRun={false}
            continuationBlockedReason="You do not have permission to run this agent."
            onRunAuthorizationError={onRunAuthorizationError}
          >
            <ToolContinuationHarness action="decline" />
            <ContinuationErrorProbe />
          </ChatProvider>
        </Wrapper>,
      );
      expect(screen.getByRole('status', { name: 'Continuation actions' }).textContent).toBe('disabled');
      fireEvent.click(screen.getByRole('button', { name: 'Continue tool' }));
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      expect(continuationRequests).toHaveLength(1);
    });
  });

  describe('when authorization is rejected without a refresh callback', () => {
    it('still handles the continuation rejection and renders the permission explanation', async () => {
      const streamRequests: Captured[] = [];
      server.use(
        ...baseHandlers(streamRequests),
        http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
          streamRequests.push({ url: request.url, body: await captureBody(request) });
          return sseResponse();
        }),
        http.post(`${BASE_URL}/api/agents/agent-1/approve-tool-call`, () =>
          HttpResponse.json({ error: { message: 'Execute access was revoked.' } }, { status: 403 }),
        ),
      );

      render(
        <Wrapper>
          <ChatProvider agentId="agent-1" threadId="thread-1" initialMessages={[]}>
            <ToolContinuationHarness action="approve" />
            <ContinuationErrorProbe />
          </ChatProvider>
        </Wrapper>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Start run' }));
      await waitFor(() => expect(streamRequests).toHaveLength(1));
      fireEvent.click(screen.getByRole('button', { name: 'Continue tool' }));

      await waitFor(() =>
        expect(screen.getByRole('status', { name: 'Continuation error' }).textContent).toContain(
          'You no longer have permission to continue this run.',
        ),
      );
    });
  });

  describe('when a tool continuation fails without a stable policy code', () => {
    it('uses the existing generic error treatment without leaving a rejected promise', async () => {
      const streamRequests: Captured[] = [];
      const continuationRequests: CapturedBody[] = [];
      server.use(
        ...baseHandlers(streamRequests),
        http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
          streamRequests.push({ url: request.url, body: await captureBody(request) });
          return sseResponse();
        }),
        http.post(`${BASE_URL}/api/agents/agent-1/approve-tool-call`, async ({ request }) => {
          continuationRequests.push(await captureBody(request));
          return HttpResponse.json(
            { error: { code: 'TOOL_NOT_READY', message: 'The tool is not ready.' } },
            { status: 400 },
          );
        }),
      );

      render(
        <Wrapper>
          <ChatProvider agentId="agent-1" threadId="thread-1" initialMessages={[]}>
            <ToolContinuationHarness action="approve" />
            <ContinuationErrorProbe />
          </ChatProvider>
        </Wrapper>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Start run' }));
      await waitFor(() => expect(streamRequests).toHaveLength(1));
      fireEvent.click(screen.getByRole('button', { name: 'Continue tool' }));

      await waitFor(() =>
        expect(screen.getByRole('status', { name: 'Continuation error' }).textContent).toContain(
          'The tool is not ready.',
        ),
      );
      expect(screen.getByRole('status', { name: 'Continuation actions' }).textContent).toBe('enabled');
      fireEvent.click(screen.getByRole('button', { name: 'Continue tool' }));
      await waitFor(() => expect(continuationRequests).toHaveLength(2));
    });
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

  it('blocks programmatic sends when a new run target is unavailable', async () => {
    const captured: Captured[] = [];
    server.use(
      ...baseHandlers(captured),
      http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
        captured.push({ url: request.url, body: await captureBody(request) });
        return sseResponse();
      }),
    );

    render(
      <Wrapper>
        <ChatProvider agentId="agent-1" threadId="thread-1" initialMessages={[]} canStartRun={false}>
          <SendOnMount text="must not start" />
        </ChatProvider>
      </Wrapper>,
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 25));
    });
    expect(captured).toHaveLength(0);
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
});
