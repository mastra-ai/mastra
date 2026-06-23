// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useEffect, useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStreamMessages, useStreamRunning, useStreamSend } from '../stream-chat-context';
import { StreamChatProvider } from '../stream-chat-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

type CapturedBody = Record<string, any>;

interface Captured {
  url: string;
  body: CapturedBody;
}

const captureBody = async (request: Request): Promise<CapturedBody> => {
  const body: unknown = await request.json();
  return body && typeof body === 'object' ? (body as CapturedBody) : {};
};

/** Streams a single assistant text delta then a `finish` event and closes. */
const textThenFinishStream = (text: string) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'text-delta', runId: 'run-1', payload: { id: 'text-1', text } })}\n\n`,
        ),
      );
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'finish', payload: {} })}\n\n`));
      controller.close();
    },
  });

/** Closes immediately so useChat completes without producing messages. */
const emptyStream = () =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });

const sseResponse = (stream: ReadableStream<Uint8Array>) =>
  new HttpResponse(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });

// Background queries fired by the real provider stack. Not under test, but must
// be handled so `onUnhandledRequest: 'error'` stays quiet.
const baseHandlers = () => [http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' }))];

const Wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const renderWithProviders = (ui: ReactElement) => render(ui, { wrapper: Wrapper });

const SendOnMount = ({ message, onSent }: { message: string; onSent?: () => void }) => {
  const send = useStreamSend();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    send(message);
    onSent?.();
  }, [message, send, onSent]);
  return null;
};

afterEach(() => {
  delete (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS;
  cleanup();
});

describe('StreamChatProvider', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  describe('when thread signals are not opted out', () => {
    it('subscribes to the thread signal channel by default', async () => {
      const subscribeCalls: string[] = [];
      server.use(
        ...baseHandlers(),
        http.post(`${BASE_URL}/api/agents/a/threads/subscribe`, () => {
          subscribeCalls.push('subscribe');
          return sseResponse(emptyStream());
        }),
        http.post(`${BASE_URL}/api/agents/a/stream`, () => sseResponse(emptyStream())),
      );

      await act(async () => {
        renderWithProviders(
          <StreamChatProvider agentId="a" threadId="t" initialMessages={[]}>
            <SendOnMount message="hello" />
          </StreamChatProvider>,
        );
      });

      await waitFor(() => expect(subscribeCalls.length).toBeGreaterThan(0));
    });
  });

  describe('when thread signals are explicitly opted out', () => {
    it('never opens a thread signal subscription', async () => {
      (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS = 'false';
      const captured: Captured[] = [];
      const subscribeCalls: string[] = [];
      server.use(
        ...baseHandlers(),
        http.post(`${BASE_URL}/api/agents/a/threads/subscribe`, () => {
          subscribeCalls.push('subscribe');
          return sseResponse(emptyStream());
        }),
        http.post(`${BASE_URL}/api/agents/a/stream`, async ({ request }) => {
          captured.push({ url: request.url, body: await captureBody(request) });
          return sseResponse(emptyStream());
        }),
      );

      await act(async () => {
        renderWithProviders(
          <StreamChatProvider agentId="a" threadId="t" initialMessages={[]}>
            <SendOnMount message="hello" />
          </StreamChatProvider>,
        );
      });

      await waitFor(() => expect(captured.length).toBeGreaterThan(0));
      expect(captured.at(-1)!.url).toContain('/stream');
      expect(subscribeCalls).toHaveLength(0);
    });
  });

  describe('when a message is sent', () => {
    it('forwards the threadId and clientTools on the wire', async () => {
      (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS = 'false';
      const captured: Captured[] = [];
      server.use(
        ...baseHandlers(),
        http.post(`${BASE_URL}/api/agents/a/stream`, async ({ request }) => {
          captured.push({ url: request.url, body: await captureBody(request) });
          return sseResponse(emptyStream());
        }),
      );

      const tools = { myTool: { id: 'myTool' } };

      await act(async () => {
        renderWithProviders(
          <StreamChatProvider agentId="a" threadId="thread-xyz" initialMessages={[]} clientTools={tools}>
            <SendOnMount message="hello world" />
          </StreamChatProvider>,
        );
      });

      await waitFor(() => expect(captured.length).toBeGreaterThan(0));
      const body = captured.at(-1)!.body;
      // The thread id is carried on the wire under `memory.thread`.
      expect(body.memory).toMatchObject({ thread: 'thread-xyz' });
      expect(body.clientTools).toMatchObject({ myTool: { id: 'myTool' } });
    });

    it('flattens extraInstructions into modelSettings on the wire', async () => {
      (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS = 'false';
      const captured: Captured[] = [];
      server.use(
        ...baseHandlers(),
        http.post(`${BASE_URL}/api/agents/a/stream`, async ({ request }) => {
          captured.push({ url: request.url, body: await captureBody(request) });
          return sseResponse(emptyStream());
        }),
      );

      await act(async () => {
        renderWithProviders(
          <StreamChatProvider agentId="a" threadId="thread-xyz" initialMessages={[]} extraInstructions="snapshot-text">
            <SendOnMount message="hi" />
          </StreamChatProvider>,
        );
      });

      await waitFor(() => expect(captured.length).toBeGreaterThan(0));
      const body = captured.at(-1)!.body;
      // The React layer flattens `modelSettings.instructions` to top-level `instructions`.
      expect(body.instructions).toBe('snapshot-text');
      expect(body.providerOptions).toEqual({ openai: { reasoningEffort: 'low' } });
    });

    it('omits instructions on the wire when extraInstructions is absent', async () => {
      (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS = 'false';
      const captured: Captured[] = [];
      server.use(
        ...baseHandlers(),
        http.post(`${BASE_URL}/api/agents/a/stream`, async ({ request }) => {
          captured.push({ url: request.url, body: await captureBody(request) });
          return sseResponse(emptyStream());
        }),
      );

      await act(async () => {
        renderWithProviders(
          <StreamChatProvider agentId="a" threadId="thread-xyz" initialMessages={[]}>
            <SendOnMount message="hi" />
          </StreamChatProvider>,
        );
      });

      await waitFor(() => expect(captured.length).toBeGreaterThan(0));
      expect(captured.at(-1)!.body.instructions).toBeUndefined();
    });
  });

  describe('when consumers subscribe to split contexts', () => {
    it('does not re-render running subscribers while only the message list changes', async () => {
      (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS = 'false';
      server.use(
        ...baseHandlers(),
        http.post(`${BASE_URL}/api/agents/a/stream`, () => sseResponse(textThenFinishStream('streamed reply'))),
      );

      const runningRenders = vi.fn();
      const RunningProbe = () => {
        useStreamRunning();
        runningRenders();
        return null;
      };
      const MessagesProbe = () => {
        const messages = useStreamMessages();
        const text = messages
          .flatMap(m => (Array.isArray(m.content?.parts) ? m.content.parts : []))
          .map(p => (p.type === 'text' ? p.text : ''))
          .join('');
        return <div data-testid="assistant-text">{text}</div>;
      };

      let view!: ReturnType<typeof renderWithProviders>;
      await act(async () => {
        view = renderWithProviders(
          <StreamChatProvider agentId="a" threadId="t" initialMessages={[]}>
            <SendOnMount message="hello" />
            <RunningProbe />
            <MessagesProbe />
          </StreamChatProvider>,
        );
      });

      // The assistant reply arrives from the real stream and reaches the
      // messages subscriber.
      await waitFor(() => expect(view.getByTestId('assistant-text').textContent).toContain('streamed reply'));

      // The running subscriber re-renders for the running true->false transition,
      // but NOT once per streamed message part. A small constant is the upper
      // bound for an isolated running subscriber.
      expect(runningRenders.mock.calls.length).toBeLessThanOrEqual(4);
    });
  });

  describe('when initialUserMessage is provided on mount', () => {
    it('dispatches the starter message exactly once', async () => {
      (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS = 'false';
      const captured: Captured[] = [];
      server.use(
        ...baseHandlers(),
        http.post(`${BASE_URL}/api/agents/a/stream`, async ({ request }) => {
          captured.push({ url: request.url, body: await captureBody(request) });
          return sseResponse(emptyStream());
        }),
      );

      await act(async () => {
        renderWithProviders(
          <StreamChatProvider agentId="a" threadId="t" initialMessages={[]} initialUserMessage="kickoff">
            <div />
          </StreamChatProvider>,
        );
      });

      await waitFor(() => expect(captured.length).toBe(1));
      expect(captured[0].body.messages?.at(-1)).toMatchObject({
        role: 'user',
        content: [{ type: 'text', text: 'kickoff' }],
      });
    });
  });
});
