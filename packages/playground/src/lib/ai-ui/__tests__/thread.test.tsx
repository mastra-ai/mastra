import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { TaskItem } from '@mastra/core/signals';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatProvider } from '../chat/chat-provider';
import { Thread } from '../thread';
import { memoryDisabled, memoryEnabled, v2Agent } from './fixtures/agent';
import { abortedThread, acceptedMessage, noMcpServers } from './fixtures/message-delivery';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { BrowserSessionProvider } from '@/domains/agents/context/browser-session-provider';
import { ThreadInputProvider } from '@/domains/conversation';
import { server } from '@/test/msw-server';

declare global {
  interface Window {
    MASTRA_AGENT_SIGNALS?: string;
  }
}

const BASE_URL = 'http://localhost:4111';

type CapturedBody = Record<string, unknown>;

interface Captured {
  url: string;
  body: CapturedBody;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const captureBody = async (request: Request): Promise<CapturedBody> => {
  const body: unknown = await request.json();
  return isRecord(body) ? body : {};
};

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
  http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json(noMcpServers)),
  http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
  http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
  http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
  http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryDisabled)),
  http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () => workingMemoryResponse()),
  // Drive the real memory hooks; the sidebar consumers aren't rendered here, so empty payloads suffice.
  http.get(`${BASE_URL}/api/memory/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
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
              {children}
            </WorkingMemoryProvider>
          </BrowserSessionProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

interface RenderThreadOptions {
  hasModelList?: boolean;
  threadId?: string;
  suggestedPrompts?: string[];
}

const renderThreadTree = (initialMessages: MastraDBMessage[], options: RenderThreadOptions = {}) => {
  const { hasModelList = true, threadId = 'thread-1', suggestedPrompts } = options;

  return (
    <Wrapper threadId={threadId}>
      <ThreadInputProvider>
        <ChatProvider
          key={threadId}
          agentId="agent-1"
          threadId={threadId}
          initialMessages={initialMessages}
          supportsMemory={true}
          modelVersion="v2"
          settings={{ modelSettings: { chatWithLegacyStream: false } }}
        >
          <Thread
            agentId="agent-1"
            agentName="Helper"
            threadId={threadId}
            suggestedPrompts={suggestedPrompts}
            hasModelList={hasModelList}
          />
        </ChatProvider>
      </ThreadInputProvider>
    </Wrapper>
  );
};

const renderThread = (initialMessages: MastraDBMessage[], options?: RenderThreadOptions) =>
  render(renderThreadTree(initialMessages, options));

const userMessage = (text: string): MastraDBMessage => ({
  id: `m-${text}`,
  role: 'user',
  createdAt: new Date(),
  content: { format: 2, parts: [{ type: 'text', text }] },
});

const userMessageWithFiles = (text: string, filenames: string[]): MastraDBMessage => ({
  id: `m-${text}`,
  role: 'user',
  createdAt: new Date(),
  content: {
    format: 2,
    parts: [
      { type: 'text', text },
      ...filenames.map(filename => ({
        type: 'file' as const,
        filename,
        mimeType: 'application/pdf',
        data: `https://files.example.com/${filename}`,
      })),
    ],
  },
});

const assistantMessage = (text: string, metadata?: MastraDBMessage['content']['metadata']): MastraDBMessage => ({
  id: `a-${text}`,
  role: 'assistant',
  createdAt: new Date(),
  content: { format: 2, parts: [{ type: 'text', text }], metadata },
});

afterEach(() => {
  delete window.MASTRA_AGENT_SIGNALS;
  cleanup();
  vi.restoreAllMocks();
});

describe('Thread', () => {
  beforeEach(() => {
    window.MASTRA_AGENT_SIGNALS = 'false';
    server.resetHandlers();
  });

  describe('when choosing how to send during an active run', () => {
    let emit: (chunk: unknown) => void;
    const requests: string[] = [];
    beforeEach(() => {
      window.MASTRA_AGENT_SIGNALS = 'true';
      requests.length = 0;
      server.use(...baseHandlers());
      server.use(
        http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryEnabled)),
        http.post(
          `${BASE_URL}/api/agents/:agentId/threads/subscribe`,
          () =>
            new HttpResponse(
              new ReadableStream<Uint8Array>({
                start(controller) {
                  emit = chunk => controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
                },
              }),
              { headers: { 'content-type': 'text/event-stream' } },
            ),
        ),
        http.post(`${BASE_URL}/api/agents/:agentId/send-message`, () => {
          requests.push('send');
          emit({ type: 'start', runId: 'first', from: 'AGENT', payload: { messageId: 'answer-first' } });
          return HttpResponse.json(acceptedMessage('first'));
        }),
        http.post(`${BASE_URL}/api/agents/:agentId/queue-message`, () => {
          requests.push('queue');
          return HttpResponse.json(acceptedMessage(`queued-${requests.length}`));
        }),
      );
    });
    const sendText = (text: string) => {
      fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    };
    it('keeps observing queued turns after stopping the active run', async () => {
      const matchMedia = window.matchMedia;
      vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
        ...matchMedia(query),
        matches: query === '(prefers-reduced-motion: reduce)',
      }));
      let abortRequests = 0;
      server.use(
        http.post(`${BASE_URL}/api/agents/:agentId/threads/abort`, () => {
          abortRequests++;
          return HttpResponse.json(abortedThread);
        }),
      );
      renderThread([]);
      await screen.findByRole('button', { name: 'Send', exact: true });
      sendText('FIRST');
      await screen.findByRole('button', { name: 'Queue', exact: true });
      sendText('SECOND');
      await screen.findByText('Queued');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
      await waitFor(() => expect(abortRequests).toBe(1));
      expect(screen.getByText('Queued')).toBeTruthy();
      await act(async () => {
        emit({ type: 'abort', runId: 'first', from: 'AGENT', payload: {} });
        emit({ type: 'start', runId: 'queued-2', from: 'AGENT', payload: { messageId: 'answer-second' } });
        emit({ type: 'text-start', runId: 'queued-2', from: 'AGENT', payload: { id: 'text-second' } });
        emit({
          type: 'text-delta',
          runId: 'queued-2',
          from: 'AGENT',
          payload: { id: 'text-second', text: 'Answer SECOND' },
        });
        emit({ type: 'text-end', runId: 'queued-2', from: 'AGENT', payload: { id: 'text-second' } });
      });
      await waitFor(() => expect(screen.queryByText('Queued')).toBeNull());
      expect(screen.getByText('SECOND', { selector: 'p' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Cancel', exact: true })).toBeTruthy();
      await act(async () => emit({ type: 'finish', runId: 'queued-2', from: 'AGENT', payload: {} }));
      await screen.findByText('Answer SECOND');
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel', exact: true })).toBeNull());
    });
    it.each(['queue', 'steer'] as const)(
      'preserves the %s acceptance response when Stop is clicked while it is pending',
      async delivery => {
        server.use(http.post(`${BASE_URL}/api/agents/:agentId/threads/abort`, () => HttpResponse.json(abortedThread)));
        renderThread([]);
        await screen.findByRole('button', { name: 'Send', exact: true });
        sendText('FIRST');
        await screen.findByRole('button', { name: 'Queue', exact: true });
        if (delivery === 'steer') {
          fireEvent.click(screen.getByRole('button', { name: 'Choose send behavior' }));
          fireEvent.click(await screen.findByRole('menuitemradio', { name: /Steer/ }));
        }
        let release = () => {};
        const responseGate = new Promise<void>(resolve => {
          release = resolve;
        });
        let requestStarted = false;
        let requestAborted = false;
        server.use(
          http.post(
            `${BASE_URL}/api/agents/:agentId/${delivery === 'queue' ? 'queue-message' : 'send-message'}`,
            async ({ request }) => {
              requestStarted = true;
              request.signal.addEventListener('abort', () => {
                requestAborted = true;
              });
              await responseGate;
              return HttpResponse.json(acceptedMessage(delivery === 'queue' ? 'queued-second' : 'first'));
            },
          ),
        );
        sendText('SECOND');
        await waitFor(() => expect(requestStarted).toBe(true));
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
          release();
        });
        expect(requestAborted).toBe(false);
        if (delivery === 'queue') await screen.findByText('Queued');
        await waitFor(() =>
          expect(
            screen
              .getByText('SECOND', { selector: 'p' })
              .closest('[data-message-id]')
              ?.getAttribute('data-message-pending'),
          ).not.toBe('true'),
        );
        expect(screen.queryByText('Not sent')).toBeNull();
        expect(screen.queryByText('Sent to current run')).toBeNull();
      },
    );
    it('keeps each streamed answer with its turn while later messages wait', async () => {
      const { rerender } = renderThread([]);
      await screen.findByRole('button', { name: 'Send', exact: true });
      sendText('FIRST');
      await screen.findByRole('button', { name: 'Queue', exact: true });
      await act(async () => {
        emit({ type: 'text-start', runId: 'first', from: 'AGENT', payload: { id: 'text-first' } });
        emit({ type: 'text-delta', runId: 'first', from: 'AGENT', payload: { id: 'text-first', text: 'Answer' } });
      });
      sendText('SECOND');
      await screen.findByText('Queued');
      sendText('THIRD');
      await waitFor(() => expect(screen.getAllByText('Queued')).toHaveLength(2));
      await act(async () => {
        emit({ type: 'text-delta', runId: 'first', from: 'AGENT', payload: { id: 'text-first', text: ' FIRST' } });
        emit({ type: 'text-end', runId: 'first', from: 'AGENT', payload: { id: 'text-first' } });
        emit({ type: 'finish', runId: 'first', from: 'AGENT', payload: {} });
      });
      const transcript = () =>
        Array.from(document.querySelectorAll('[data-message-id] .mastra-markdown p')).map(node => node.textContent);
      await waitFor(() => expect(transcript()).toEqual(['FIRST', 'Answer FIRST', 'SECOND', 'THIRD']));
      await act(async () => {
        emit({ type: 'start', runId: 'queued-2', from: 'AGENT', payload: { messageId: 'answer-second' } });
        emit({ type: 'text-start', runId: 'queued-2', from: 'AGENT', payload: { id: 'text-second' } });
        emit({ type: 'text-delta', runId: 'queued-2', from: 'AGENT', payload: { id: 'text-second', text: 'Answer' } });
      });
      const savedFirstAnswer = { ...assistantMessage('Answer FIRST'), id: 'answer-first' };
      rerender(renderThreadTree([userMessage('FIRST'), savedFirstAnswer]));
      await act(async () => {
        emit({ type: 'text-delta', runId: 'queued-2', from: 'AGENT', payload: { id: 'text-second', text: ' SECOND' } });
        emit({ type: 'text-end', runId: 'queued-2', from: 'AGENT', payload: { id: 'text-second' } });
        emit({ type: 'finish', runId: 'queued-2', from: 'AGENT', payload: {} });
      });
      await waitFor(() => expect(transcript()).toEqual(['FIRST', 'Answer FIRST', 'SECOND', 'Answer SECOND', 'THIRD']));
      await act(async () => {
        emit({ type: 'start', runId: 'queued-3', from: 'AGENT', payload: { messageId: 'answer-third' } });
        emit({ type: 'text-start', runId: 'queued-3', from: 'AGENT', payload: { id: 'text-third' } });
        emit({
          type: 'text-delta',
          runId: 'queued-3',
          from: 'AGENT',
          payload: { id: 'text-third', text: 'Answer THIRD' },
        });
        emit({ type: 'text-end', runId: 'queued-3', from: 'AGENT', payload: { id: 'text-third' } });
        emit({ type: 'finish', runId: 'queued-3', from: 'AGENT', payload: {} });
      });
      await waitFor(() =>
        expect(transcript()).toEqual(['FIRST', 'Answer FIRST', 'SECOND', 'Answer SECOND', 'THIRD', 'Answer THIRD']),
      );
      expect(screen.queryByText('Queued')).toBeNull();
    });
    it('queues each follow-up and clears only the label for the run that starts', async () => {
      renderThread([]);
      expect(await screen.findByRole('button', { name: 'Send', exact: true })).toBeTruthy();
      sendText('FIRST');
      await screen.findByRole('button', { name: 'Queue', exact: true });
      sendText('SECOND');
      await screen.findByText('Queued');
      sendText('THIRD');
      await waitFor(() => expect(screen.getAllByText('Queued')).toHaveLength(2));
      expect(requests).toEqual(['send', 'queue', 'queue']);
      await act(async () => emit({ type: 'finish', runId: 'first', from: 'AGENT', payload: {} }));
      expect(screen.getAllByText('Queued')).toHaveLength(2);
      await act(async () =>
        emit({ type: 'start', runId: 'queued-2', from: 'AGENT', payload: { messageId: 'answer-second' } }),
      );
      await waitFor(() => expect(screen.getAllByText('Queued')).toHaveLength(1));
    });
    it.each([false, true])(
      'places a queued turn before its response when acceptance arrives late (echo: %s)',
      async echoReceived => {
        renderThread([]);
        await screen.findByRole('button', { name: 'Send', exact: true });
        sendText('FIRST');
        await screen.findByRole('button', { name: 'Queue', exact: true });
        server.use(
          http.post(`${BASE_URL}/api/agents/:agentId/queue-message`, async ({ request }) => {
            const body = await request.json();
            emit({ type: 'finish', runId: 'first', from: 'AGENT', payload: {} });
            emit({ type: 'start', runId: 'already-started', from: 'AGENT', payload: { messageId: 'answer-second' } });
            if (echoReceived)
              emit({
                type: 'data-user-message',
                runId: 'already-started',
                from: 'AGENT',
                data: {
                  type: 'user-message',
                  id: 'server-second',
                  contents: 'SECOND',
                  metadata: body.message.metadata,
                },
              });
            emit({ type: 'text-start', runId: 'already-started', from: 'AGENT', payload: { id: 'text-second' } });
            emit({
              type: 'text-delta',
              runId: 'already-started',
              from: 'AGENT',
              payload: { id: 'text-second', text: 'Answer' },
            });
            emit({
              type: 'step-start',
              runId: 'already-started',
              from: 'AGENT',
              payload: { messageId: 'answer-second' },
            });
            emit({
              type: 'text-delta',
              runId: 'already-started',
              from: 'AGENT',
              payload: { id: 'text-second', text: ' SECOND' },
            });
            emit({ type: 'text-end', runId: 'already-started', from: 'AGENT', payload: { id: 'text-second' } });
            await new Promise(resolve => setTimeout(resolve, 30));
            return HttpResponse.json(acceptedMessage('already-started'));
          }),
        );
        sendText('SECOND');
        await waitFor(() => expect(document.querySelector('[data-message-delivery="sent"]')).toBeTruthy());
        await waitFor(() =>
          expect(
            Array.from(document.querySelectorAll('[data-message-id] .mastra-markdown p')).map(node => node.textContent),
          ).toEqual(['FIRST', 'SECOND', 'Answer SECOND']),
        );
        expect(
          new Set(
            Array.from(document.querySelectorAll('[data-message-id]')).map(node =>
              node.getAttribute('data-message-id'),
            ),
          ).size,
        ).toBe(3);
        expect(screen.queryByText('Queued')).toBeNull();
      },
    );
    it('does not mark a run queued when its start arrives before the acceptance response', async () => {
      server.use(
        http.post(`${BASE_URL}/api/agents/:agentId/queue-message`, async () => {
          emit({ type: 'start', runId: 'already-started', from: 'AGENT', payload: { messageId: 'answer-second' } });
          await new Promise(resolve => setTimeout(resolve, 30));
          return HttpResponse.json(acceptedMessage('already-started'));
        }),
      );
      renderThread([]);
      await screen.findByRole('button', { name: 'Send', exact: true });
      sendText('FIRST');
      await screen.findByRole('button', { name: 'Queue', exact: true });
      sendText('SECOND');
      await waitFor(() => expect(document.querySelector('[data-message-delivery="sent"]')).toBeTruthy());
      expect(screen.queryByText('Queued')).toBeNull();
    });
    it('reports an unsupported queue without falling back to a steering send', async () => {
      server.use(
        http.post(`${BASE_URL}/api/agents/:agentId/queue-message`, () => new HttpResponse(undefined, { status: 501 })),
      );
      renderThread([]);
      await screen.findByRole('button', { name: 'Send', exact: true });
      sendText('FIRST');
      await screen.findByRole('button', { name: 'Queue', exact: true });
      sendText('SECOND');
      await screen.findByText('Not sent');
      expect(requests).toEqual(['send']);
      expect(screen.queryByText('Queued')).toBeNull();
      expect(screen.getByRole('button', { name: 'Queue', exact: true })).toBeTruthy();
    });
    it('accepts rapid identical queued messages without cancelling the earlier request', async () => {
      let calls = 0;
      server.use(
        http.post(`${BASE_URL}/api/agents/:agentId/queue-message`, async () => {
          const runId = `queued-${++calls}`;
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json(acceptedMessage(runId));
        }),
      );
      renderThread([]);
      await screen.findByRole('button', { name: 'Send', exact: true });
      sendText('FIRST');
      await screen.findByRole('button', { name: 'Queue', exact: true });
      sendText('REPEAT');
      await waitFor(() => expect(calls).toBe(1));
      sendText('REPEAT');
      await waitFor(() => expect(screen.getAllByText('Queued')).toHaveLength(2));
      expect(screen.getAllByText('REPEAT', { selector: 'p' })).toHaveLength(2);
      expect(screen.queryByText('Not sent')).toBeNull();
    });
    it('settles a queued item when its run fails before starting', async () => {
      renderThread([]);
      await screen.findByRole('button', { name: 'Send', exact: true });
      sendText('FIRST');
      await screen.findByRole('button', { name: 'Queue', exact: true });
      sendText('SECOND');
      await screen.findByText('Queued');
      await act(async () =>
        emit({ type: 'error', runId: 'queued-2', from: 'AGENT', payload: { error: 'Could not start queued run' } }),
      );
      await screen.findByText('Not sent');
      expect(screen.queryByText('Queued')).toBeNull();
    });
    it('preserves accepted queued messages when earlier history is refreshed', async () => {
      const { rerender } = renderThread([]);
      await screen.findByRole('button', { name: 'Send', exact: true });
      sendText('FIRST');
      await screen.findByRole('button', { name: 'Queue', exact: true });
      sendText('SECOND');
      await screen.findByText('Queued');
      rerender(renderThreadTree([userMessage('FIRST')]));
      expect(await screen.findByText('Queued')).toBeTruthy();
      expect(screen.getByText('SECOND', { selector: 'p' })).toBeTruthy();
    });
    it.each([false, true])(
      'keeps a started queued message through stale history (echo received: %s)',
      async echoReceived => {
        const { rerender } = renderThread([]);
        await screen.findByRole('button', { name: 'Send', exact: true });
        sendText('FIRST');
        await screen.findByRole('button', { name: 'Queue', exact: true });
        sendText('SECOND');
        await screen.findByText('Queued');
        const clientMessageId = screen
          .getByText('SECOND', { selector: 'p' })
          .closest('[data-message-id]')
          ?.getAttribute('data-message-id');
        expect(clientMessageId).toBeTruthy();
        await act(async () => emit({ type: 'finish', runId: 'first', from: 'AGENT', payload: {} }));
        await act(async () =>
          emit({ type: 'start', runId: 'queued-2', from: 'AGENT', payload: { messageId: 'answer-second' } }),
        );
        expect(screen.queryByText('Queued')).toBeNull();
        if (echoReceived) {
          await act(async () =>
            emit({
              type: 'data-user-message',
              runId: 'queued-2',
              from: 'AGENT',
              data: { type: 'user-message', id: 'm-SECOND', metadata: { clientMessageId } },
            }),
          );
        }
        rerender(renderThreadTree([userMessage('FIRST'), assistantMessage('FIRST answered')]));
        expect(screen.getByText('SECOND', { selector: 'p' })).toBeTruthy();
        const savedSecond = userMessage('SECOND');
        savedSecond.content.metadata = { clientMessageId };
        rerender(renderThreadTree([userMessage('FIRST'), assistantMessage('FIRST answered'), savedSecond]));
        expect(screen.getAllByText('SECOND', { selector: 'p' })).toHaveLength(1);
        expect(
          screen.getByText('SECOND', { selector: 'p' }).closest('[data-message-id]')?.getAttribute('data-message-id'),
        ).toBe(savedSecond.id);
        expect(screen.queryByText('Queued')).toBeNull();
      },
    );
    it.each(['finish', 'error', 'abort', 'cancel'])(
      'clears steering feedback for the matching run on %s',
      async type => {
        server.use(http.post(`${BASE_URL}/api/agents/:agentId/threads/abort`, () => HttpResponse.json(abortedThread)));
        renderThread([]);
        await screen.findByRole('button', { name: 'Send', exact: true });
        sendText('FIRST');
        await screen.findByRole('button', { name: 'Queue', exact: true });
        sendText('NEXT TURN');
        await screen.findByText('Queued');
        fireEvent.click(screen.getByRole('button', { name: 'Choose send behavior' }));
        fireEvent.click(await screen.findByRole('menuitemradio', { name: /Steer/ }));
        sendText('CHANGE DIRECTION');
        await screen.findByText('Sent to current run');
        if (type === 'cancel') {
          fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
        } else {
          await act(async () => emit({ type, runId: 'unrelated', from: 'AGENT', payload: {} }));
          expect(screen.getByText('Sent to current run')).toBeTruthy();
          await act(async () => emit({ type, runId: 'first', from: 'AGENT', payload: {} }));
        }
        await waitFor(() => expect(screen.queryByText('Sent to current run')).toBeNull());
        expect(screen.getByText('CHANGE DIRECTION', { selector: 'p' })).toBeTruthy();
        expect(screen.getByText('Queued')).toBeTruthy();
      },
    );
    it('does not restore steering feedback when acceptance arrives after the run finishes', async () => {
      renderThread([]);
      await screen.findByRole('button', { name: 'Send', exact: true });
      sendText('FIRST');
      await screen.findByRole('button', { name: 'Queue', exact: true });
      let releaseResponse = () => {};
      const responseGate = new Promise<void>(resolve => {
        releaseResponse = resolve;
      });
      server.use(
        http.post(`${BASE_URL}/api/agents/:agentId/send-message`, async () => {
          emit({ type: 'finish', runId: 'first', from: 'AGENT', payload: {} });
          await responseGate;
          return HttpResponse.json(acceptedMessage('first'));
        }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Choose send behavior' }));
      fireEvent.click(await screen.findByRole('menuitemradio', { name: /Steer/ }));
      sendText('CHANGE DIRECTION');
      await screen.findByRole('button', { name: 'Send', exact: true });
      releaseResponse();
      await waitFor(() => expect(document.querySelector('[data-message-delivery="sent"]')).toBeTruthy());
      expect(screen.queryByText('Sent to current run')).toBeNull();
      expect(screen.getByText('CHANGE DIRECTION', { selector: 'p' })).toBeTruthy();
    });
    it('steers only after explicit selection and resets to Queue for a later active period', async () => {
      renderThread([]);
      await screen.findByRole('button', { name: 'Send', exact: true });
      sendText('FIRST');
      await screen.findByRole('button', { name: 'Queue', exact: true });
      fireEvent.click(screen.getByRole('button', { name: 'Choose send behavior' }));
      fireEvent.click(await screen.findByRole('menuitemradio', { name: /Steer/ }));
      expect(requests).toEqual(['send']);
      sendText('CHANGE DIRECTION');
      await screen.findByText('Sent to current run');
      expect(requests).toEqual(['send', 'send']);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'keep my draft' } });
      await act(async () => emit({ type: 'finish', runId: 'first', from: 'AGENT', payload: {} }));
      expect(screen.getByRole('button', { name: 'Send', exact: true })).toBeTruthy();
      expect(
        screen.getByRole('textbox').getAttribute('value') ?? screen.getByRole<HTMLTextAreaElement>('textbox').value,
      ).toBe('keep my draft');
      await act(async () =>
        emit({ type: 'start', runId: 'next', from: 'AGENT', payload: { messageId: 'answer-next' } }),
      );
      expect(screen.getByRole('button', { name: 'Queue', exact: true })).toBeTruthy();
    });
  });

  describe('when no suggested prompts are provided for an empty thread', () => {
    it('renders the default welcome state', async () => {
      server.use(...baseHandlers());

      await act(async () => {
        renderThread([]);
      });

      expect(screen.getByText('How can I help you today?')).toBeTruthy();
      expect(screen.getByRole('textbox')).toBeTruthy();
    });
  });

  it('renders existing messages instead of the welcome state', async () => {
    server.use(...baseHandlers());

    await act(async () => {
      renderThread([userMessage('previous question')]);
    });

    expect(screen.getByText('previous question', { selector: 'p' })).toBeTruthy();
    expect(screen.queryByText('How can I help you today?')).toBeFalsy();
  });

  describe('when suggested prompts are provided for an empty thread', () => {
    it('renders each suggested prompt', async () => {
      server.use(...baseHandlers());

      await act(async () => {
        renderThread([], { suggestedPrompts: ['Check the weather', 'Check a stock', 'Build a page'] });
      });

      expect(screen.getByRole('button', { name: 'Check the weather' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Check a stock' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Build a page' })).toBeTruthy();
    });

    it('sends the selected prompt through the agent stream endpoint', async () => {
      const captured: Captured[] = [];
      server.use(
        ...baseHandlers(),
        http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
          captured.push({ url: request.url, body: await captureBody(request) });
          return sseResponse();
        }),
      );

      await act(async () => {
        renderThread([], { suggestedPrompts: ['Check the weather'] });
      });

      fireEvent.click(screen.getByRole('button', { name: 'Check the weather' }));

      await waitFor(() => {
        expect(captured).toHaveLength(1);
      });

      expect(JSON.stringify(captured[0].body.messages ?? [])).toContain('Check the weather');
    });
  });

  describe('when the thread already has messages', () => {
    it('does not render suggested prompts', async () => {
      server.use(...baseHandlers());

      await act(async () => {
        renderThread([userMessage('previous question')], { suggestedPrompts: ['Check the weather'] });
      });

      expect(screen.queryByRole('button', { name: 'Check the weather' })).toBeFalsy();
    });
  });

  describe('when rendering the thread rail', () => {
    it('does not render for the empty welcome state', async () => {
      server.use(...baseHandlers());

      await act(async () => {
        renderThread([]);
      });

      expect(screen.queryByTestId('thread-rail')).toBeFalsy();
    });

    it('renders one tick per user turn with preview labels and the latest turn marked in view', async () => {
      server.use(...baseHandlers());

      await act(async () => {
        renderThread([
          userMessageWithFiles('first question', ['plan.md', 'notes.pdf', 'trace.json']),
          assistantMessage('first answer'),
          userMessage('second question'),
        ]);
      });

      expect(screen.getByRole('navigation', { name: 'Conversation timeline' })).toBeTruthy();
      expect(screen.getAllByRole('button', { name: /Jump to/ })).toHaveLength(2);
      const rail = screen.getByTestId('thread-rail');
      expect(screen.getByTestId('thread-rail-scroll-area')).toBeTruthy();
      expect(screen.getByTestId('thread-message-column').contains(rail)).toBe(false);

      const firstTurn = screen.getByRole('button', { name: 'Jump to first question' });
      const secondTurn = screen.getByRole('button', { name: 'Jump to second question' });

      fireEvent.mouseEnter(firstTurn);

      const previewCurrent = within(screen.getByTestId('thread-rail-preview-current'));
      expect(previewCurrent.getByText('first answer')).toBeTruthy();
      expect(previewCurrent.getByText('plan.md')).toBeTruthy();
      expect(previewCurrent.getByText('notes.pdf')).toBeTruthy();
      expect(previewCurrent.getByText('+1')).toBeTruthy();

      expect(firstTurn.getAttribute('aria-current')).toBeNull();
      expect(firstTurn.getAttribute('data-in-view')).toBeNull();
      expect(secondTurn.getAttribute('aria-current')).toBe('location');
      expect(secondTurn.getAttribute('data-in-view')).toBe('true');
      expect(secondTurn.getAttribute('data-active')).toBe('true');
    });

    it('scrolls to the selected user message', async () => {
      const scrollTo = vi.fn();
      const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
      Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
        configurable: true,
        writable: true,
        value: scrollTo,
      });
      server.use(...baseHandlers());

      try {
        await act(async () => {
          renderThread([
            userMessage('first question'),
            assistantMessage('first answer'),
            userMessage('second question'),
          ]);
        });

        const viewport = document.querySelector<HTMLElement>('[data-slot="message-scroller-viewport"]');
        if (!viewport) throw new Error('missing message scroller viewport');
        Object.defineProperty(viewport, 'scrollTop', { configurable: true, writable: true, value: 20 });
        Object.defineProperty(viewport, 'getBoundingClientRect', {
          configurable: true,
          value: vi.fn(() => ({
            top: 0,
            bottom: 40,
            left: 0,
            right: 100,
            width: 100,
            height: 40,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          })),
        });
        const firstMessage = document.querySelector<HTMLElement>('[data-message-id="m-first question"]');
        if (!firstMessage) throw new Error('missing first message scroller item');
        Object.defineProperty(firstMessage, 'getBoundingClientRect', {
          configurable: true,
          value: vi.fn(() => ({
            top: -20,
            bottom: 20,
            left: 0,
            right: 100,
            width: 100,
            height: 40,
            x: 0,
            y: -20,
            toJSON: () => ({}),
          })),
        });

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Jump to first question' }));
        });

        expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
      } finally {
        if (originalDescriptor) {
          Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalDescriptor);
        } else {
          delete HTMLElement.prototype.scrollTo;
        }
      }
    });

    it('shows a scroll-to-bottom control when the viewport is not at the bottom', async () => {
      const scrollTo = vi.fn();
      const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
      Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
        configurable: true,
        writable: true,
        value: scrollTo,
      });
      server.use(...baseHandlers());

      try {
        await act(async () => {
          renderThread([
            userMessage('first question'),
            assistantMessage('first answer'),
            userMessage('second question'),
          ]);
        });

        const viewport = document.querySelector<HTMLElement>('[data-slot="message-scroller-viewport"]');
        if (!viewport) throw new Error('missing message scroller viewport');

        Object.defineProperty(viewport, 'scrollTop', { configurable: true, writable: true, value: 40 });
        Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 100 });
        Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 320 });

        const scrollToEnd = screen.getByRole('button', { name: 'Scroll to end' });
        expect(scrollToEnd.getAttribute('data-active')).toBe('false');

        await act(async () => {
          fireEvent.scroll(viewport);
        });

        await waitFor(() => {
          expect(scrollToEnd.getAttribute('data-active')).toBe('true');
        });

        await act(async () => {
          fireEvent.click(scrollToEnd);
        });

        expect(scrollTo).toHaveBeenCalledWith({ top: 220, behavior: 'smooth' });
      } finally {
        if (originalDescriptor) {
          Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalDescriptor);
        } else {
          delete HTMLElement.prototype.scrollTo;
        }
      }
    });
  });

  it('shows assistant model attribution when model-list metadata is available', async () => {
    server.use(...baseHandlers());

    await act(async () => {
      renderThread([
        assistantMessage('model-list answer', {
          custom: { modelMetadata: { modelProvider: 'openai', modelId: 'gpt-4o-mini' } },
        }),
      ]);
    });

    expect(screen.getByText('model-list answer')).toBeTruthy();
    expect(screen.getByText('openai/gpt-4o-mini')).toBeTruthy();
  });

  it('hides assistant model attribution outside model-list mode', async () => {
    server.use(...baseHandlers());

    await act(async () => {
      renderThread(
        [
          assistantMessage('single-model answer', {
            custom: { modelMetadata: { modelProvider: 'openai', modelId: 'gpt-4o-mini' } },
          }),
        ],
        { hasModelList: false },
      );
    });

    expect(screen.getByText('single-model answer')).toBeTruthy();
    expect(screen.queryByText('openai/gpt-4o-mini')).toBeFalsy();
  });

  it('sends the composer text through the agent stream endpoint', async () => {
    const captured: Captured[] = [];
    server.use(
      ...baseHandlers(),
      http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
        captured.push({ url: request.url, body: await captureBody(request) });
        return sseResponse();
      }),
    );

    await act(async () => {
      renderThread([]);
    });

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
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
    expect(textarea.value).toBe('');
  });

  it('restores unsent composer drafts when switching threads', async () => {
    server.use(...baseHandlers());

    let rendered: ReturnType<typeof render> | undefined;
    await act(async () => {
      rendered = render(renderThreadTree([], { threadId: 'thread-1' }));
    });

    const firstThreadTextarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
    await act(async () => {
      fireEvent.change(firstThreadTextarea, { target: { value: 'first thread draft' } });
    });
    expect(firstThreadTextarea.value).toBe('first thread draft');

    await act(async () => {
      rendered?.rerender(renderThreadTree([], { threadId: 'thread-2' }));
    });

    const secondThreadTextarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
    expect(secondThreadTextarea.value).toBe('');

    await act(async () => {
      fireEvent.change(secondThreadTextarea, { target: { value: 'second thread draft' } });
    });
    expect(secondThreadTextarea.value).toBe('second thread draft');

    await act(async () => {
      rendered?.rerender(renderThreadTree([], { threadId: 'thread-1' }));
    });

    expect(screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...').value).toBe('first thread draft');

    await act(async () => {
      rendered?.rerender(renderThreadTree([], { threadId: 'thread-2' }));
    });

    expect(screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...').value).toBe('second thread draft');
  });

  it('does not send when the composer is empty', async () => {
    const captured: Captured[] = [];
    server.use(
      ...baseHandlers(),
      http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
        captured.push({ url: request.url, body: await captureBody(request) });
        return sseResponse();
      }),
    );

    await act(async () => {
      renderThread([]);
    });

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter' });
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(captured).toHaveLength(0);
  });

  describe('when Enter is pressed during IME composition', () => {
    it('does not send the partial message', async () => {
      const captured: Captured[] = [];
      server.use(
        ...baseHandlers(),
        http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
          captured.push({ url: request.url, body: await captureBody(request) });
          return sseResponse();
        }),
      );

      await act(async () => {
        renderThread([]);
      });

      const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'composing text' } });
        fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true });
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(captured).toHaveLength(0);
    });
  });

  it('attaches a URL from the popover without sending the chat message', async () => {
    const captured: Captured[] = [];
    server.use(
      ...baseHandlers(),
      http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
        captured.push({ url: request.url, body: await captureBody(request) });
        return sseResponse();
      }),
      http.head(
        'https://files.example.com/pic.png',
        () => new HttpResponse(null, { status: 200, headers: { 'content-type': 'image/png' } }),
      ),
    );

    await act(async () => {
      renderThread([]);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
    });

    const urlInput = await screen.findByLabelText('Public URL');
    await act(async () => {
      fireEvent.change(urlInput, { target: { value: 'https://files.example.com/pic.png' } });
    });

    const composerForm = urlInput.closest<HTMLFormElement>('form');
    if (!composerForm) throw new Error('composer form not found');
    await act(async () => {
      fireEvent.submit(composerForm);
      await new Promise(resolve => setTimeout(resolve, 80));
    });

    // The attachment chip row appears and the popover closes.
    await waitFor(() => {
      expect(screen.getByTestId('composer-attachments')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.queryByLabelText('Public URL')).toBeFalsy();
    });
    // Submitting the popover form must not bubble into the composer form and send a chat message.
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

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
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

const sseChunk = (chunk: unknown) => `data: ${JSON.stringify(chunk)}\n\n`;

const taskSignalChunk = (tasks: TaskItem[], tagName = 'current-task-list') =>
  sseChunk({
    type: 'data-signal',
    data: {
      id: 'tasks',
      type: 'state',
      tagName,
      metadata: { value: { tasks } },
    },
  });

const taskPlanMenu: TaskItem = {
  id: 'task-plan-menu',
  content: 'Plan menu',
  status: 'in_progress',
  activeForm: 'Planning menu',
};

const taskShop: TaskItem = {
  id: 'task-shop',
  content: 'Create shopping list',
  status: 'pending',
  activeForm: 'Creating shopping list',
};

const taskCook: TaskItem = {
  id: 'task-cook',
  content: 'Cook meal',
  status: 'pending',
  activeForm: 'Cooking meal',
};

describe('TaskPanel', () => {
  beforeEach(() => {
    window.MASTRA_AGENT_SIGNALS = 'true';
    server.resetHandlers();
  });

  const renderWithControlledSubscription = async () => {
    let subscribeController: ReadableStreamDefaultController<Uint8Array> | null = null;
    const encoder = new TextEncoder();
    const subscribeStream = () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          subscribeController = controller;
        },
      });

    server.use(...baseHandlers());
    server.use(
      http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryEnabled)),
      http.post(
        `${BASE_URL}/api/agents/:agentId/threads/subscribe`,
        () =>
          new HttpResponse(subscribeStream(), {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
          }),
      ),
      http.post(`${BASE_URL}/api/agents/agent-1/send-message`, () =>
        HttpResponse.json({ accepted: true, runId: 'run-1', signal: { id: 'task-signal-id' } }),
      ),
    );

    await act(async () => {
      renderThread([]);
    });

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'track these tasks' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });
    });

    await waitFor(() => {
      expect(subscribeController).toBeTruthy();
    });

    const pushTasks = async (tasks: TaskItem[], tagName = 'current-task-list') => {
      await act(async () => {
        subscribeController?.enqueue(encoder.encode(taskSignalChunk(tasks, tagName)));
      });
    };

    const close = async () => {
      await act(async () => {
        subscribeController?.close();
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    };

    return { pushTasks, close };
  };

  it('renders task items when a data-signal task snapshot streams in', async () => {
    const { pushTasks, close } = await renderWithControlledSubscription();

    await pushTasks([taskPlanMenu, taskShop, taskCook]);

    expect(await screen.findByTestId('task-panel')).toBeTruthy();
    const progress = screen.getByRole('progressbar', { name: 'Task completion' });
    expect(progress.getAttribute('aria-valuenow')).toBe('0');
    expect(progress.getAttribute('aria-valuemax')).toBe('3');
    expect(screen.getByText('Planning menu')).toBeTruthy();
    expect(screen.getByText('Create shopping list')).toBeTruthy();
    expect(screen.getByText('Cook meal')).toBeTruthy();

    await close();
  });

  it('updates the task list when a task-list-update delta streams in', async () => {
    const { pushTasks, close } = await renderWithControlledSubscription();
    const completedPlan: TaskItem = { ...taskPlanMenu, status: 'completed' };
    const activeShop: TaskItem = { ...taskShop, status: 'in_progress', activeForm: 'Shopping for ingredients' };

    await pushTasks([taskPlanMenu, taskShop]);
    await pushTasks([completedPlan, activeShop], 'task-list-update');

    await waitFor(() => {
      const progress = screen.getByRole('progressbar', { name: 'Task completion' });
      expect(progress.getAttribute('aria-valuenow')).toBe('1');
      expect(progress.getAttribute('aria-valuemax')).toBe('2');
    });
    expect(screen.getByText('Plan menu')).toBeTruthy();
    expect(screen.getByText('Shopping for ingredients')).toBeTruthy();
    expect(screen.queryByText('Planning menu')).toBeFalsy();

    await close();
  });

  it('scrolls the active task into view when task state updates', async () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;

    const { pushTasks, close } = await renderWithControlledSubscription();

    try {
      const activeShop: TaskItem = { ...taskShop, status: 'in_progress', activeForm: 'Shopping for ingredients' };

      await pushTasks([taskPlanMenu, activeShop, taskCook], 'task-list-update');

      await waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
      });
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
      await close();
    }
  });

  it('hides when all tasks are complete', async () => {
    const { pushTasks, close } = await renderWithControlledSubscription();

    await pushTasks([
      { ...taskPlanMenu, status: 'completed' },
      { ...taskShop, status: 'completed' },
    ]);

    await waitFor(() => {
      expect(screen.queryByTestId('task-panel')).toBeFalsy();
    });

    await close();
  });

  it('hides when task_write clears tasks', async () => {
    const { pushTasks, close } = await renderWithControlledSubscription();

    await pushTasks([taskPlanMenu]);
    expect(await screen.findByTestId('task-panel')).toBeTruthy();

    await pushTasks([]);

    await waitFor(() => {
      expect(screen.queryByTestId('task-panel')).toBeFalsy();
    });

    await close();
  });
});

describe('Thread signal-path user-message reconciliation', () => {
  beforeEach(() => {
    window.MASTRA_AGENT_SIGNALS = 'true';
    server.resetHandlers();
  });

  it('keeps the same user-row DOM node when the data-user-message echo swaps the message id', async () => {
    // A subscribe stream we control so we can push the server echo on demand.
    let subscribeController: ReadableStreamDefaultController<Uint8Array> | null = null;
    const encoder = new TextEncoder();
    const subscribeStream = () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          subscribeController = controller;
        },
      });

    let capturedClientMessageId: string | undefined;
    const serverSignalId = 'server-signal-id';

    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
      http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
      http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
      http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () =>
        HttpResponse.json({
          workingMemory: null,
          source: 'thread',
          workingMemoryTemplate: null,
          threadExists: false,
        }),
      ),
      http.get(`${BASE_URL}/api/agents/:agentId/voice/speakers`, () => HttpResponse.json([])),
      http.post(
        `${BASE_URL}/api/agents/:agentId/threads/subscribe`,
        () =>
          new HttpResponse(subscribeStream(), {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
          }),
      ),
      http.post(`${BASE_URL}/api/agents/agent-1/send-message`, async ({ request }) => {
        const body: { message?: { metadata?: { clientMessageId?: string } } } = await request.json();
        capturedClientMessageId = body.message?.metadata?.clientMessageId;
        return HttpResponse.json({ accepted: true, runId: 'run-1', signal: { id: serverSignalId } });
      }),
    );

    await act(async () => {
      renderThread([]);
    });

    // Let the mount-time thread subscription establish.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'echo reconciliation' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });
      await new Promise(resolve => setTimeout(resolve, 80));
    });

    // The optimistic pending bubble is rendered. Capture its DOM node and the
    // client-generated correlation id sent to the server.
    const userRow = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-message-pending="true"]');
      if (!el) throw new Error('pending user row not yet rendered');
      return el;
    });
    expect(capturedClientMessageId).toBeTruthy();
    const optimisticId = userRow.getAttribute('data-message-id');
    expect(optimisticId).toBeTruthy();
    expect(optimisticId).not.toBe(serverSignalId);

    // Push the server echo carrying the same clientMessageId but a new signal id.
    await act(async () => {
      subscribeController?.enqueue(
        encoder.encode(
          sseChunk({
            type: 'data-user-message',
            data: {
              type: 'user-message',
              id: serverSignalId,
              metadata: { clientMessageId: capturedClientMessageId },
            },
          }),
        ),
      );
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // The row must be updated in place (same node instance), not remounted:
    // its data-message-id now reflects the server id and the pending styling is gone.
    await waitFor(() => {
      expect(userRow.getAttribute('data-message-id')).toBe(serverSignalId);
    });
    expect(userRow.isConnected).toBe(true);
    expect(userRow.getAttribute('data-message-pending')).toBeNull();
    // Still exactly one user bubble for this turn (no duplicate from reconciliation).
    expect(screen.getAllByText('echo reconciliation', { selector: 'p' })).toHaveLength(1);

    await act(async () => {
      subscribeController?.close();
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });
});
