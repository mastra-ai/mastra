// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStreamMessages } from '../../../contexts/stream-chat-context';
import { StreamChatProvider } from '../../../contexts/stream-chat-provider';
import { MessageList } from '../message-list';
import { MessageRow } from '../messages';
import { parseStreamErrorText } from '../parse-stream-error';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'builder-agent';

const MessageListConnector = () => {
  const messages = useStreamMessages();
  return <MessageList messages={messages} />;
};

const FormWrapper = ({ children }: { children: ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: { name: '', description: '', instructions: '' },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

const Providers = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <FormWrapper>{children}</FormWrapper>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const userMessage = (text: string): MastraDBMessage =>
  ({
    id: 'user-1',
    role: 'user',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
    },
  }) as unknown as MastraDBMessage;

const errorMessage = (text: string): MastraDBMessage =>
  ({
    id: 'error-1',
    role: 'assistant',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
      metadata: { status: 'error' },
    },
  }) as unknown as MastraDBMessage;

const openAIServerErrorPayload = JSON.stringify({
  message:
    '{"type":"error","error":{"type":"server_error","code":"server_error","message":"The server had an error while processing your request. Sorry about that! You can retry your request. Please include the request ID req_abc123 in your email."}}',
  name: 'AI_APICallError',
});

const hasThreadContext = (body: unknown, threadId: string): boolean => {
  if (!body || typeof body !== 'object') return false;
  if ('threadId' in body && body.threadId === threadId) return true;
  if (!('memory' in body)) return false;
  const { memory } = body;
  return !!memory && typeof memory === 'object' && 'thread' in memory && memory.thread === threadId;
};

describe('parseStreamErrorText', () => {
  it('returns a fallback summary for empty input', () => {
    expect(parseStreamErrorText('   ')).toEqual({
      summary: 'Something went wrong while building the agent.',
    });
  });

  it('extracts the nested OpenAI provider error message and strips the request-id tail', () => {
    const parsed = parseStreamErrorText(openAIServerErrorPayload);
    expect(parsed.summary).toBe(
      'The server had an error while processing your request. Sorry about that! You can retry your request.',
    );
    expect(parsed.details).toBe(openAIServerErrorPayload);
  });

  it('falls back to the first line for non-JSON error text', () => {
    const parsed = parseStreamErrorText('Network connection lost.\nMore details here.');
    expect(parsed.summary).toBe('Network connection lost.');
    expect(parsed.details).toBe('Network connection lost.\nMore details here.');
  });

  it('truncates very long single-line summaries', () => {
    const long = 'x'.repeat(300);
    const parsed = parseStreamErrorText(long);
    expect(parsed.summary.length).toBe(201); // 200 chars + ellipsis
    expect(parsed.summary.endsWith('…')).toBe(true);
  });
});

describe('MessageRow error rendering', () => {
  beforeEach(() => {
    server.resetHandlers();
    server.use(http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })));
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the friendly ErrorMessage when metadata.status === "error" (no raw JSON in the bubble)', () => {
    render(
      <Providers>
        <MessageRow message={errorMessage(openAIServerErrorPayload)} />
      </Providers>,
    );

    const errorCard = screen.getByTestId('agent-builder-chat-error');
    expect(errorCard).not.toBeNull();
    expect(errorCard.textContent).toContain('Something went wrong while building the agent.');
    // The visible summary echoes the parsed, sanitized provider message — not the
    // raw JSON envelope (which is hidden behind the Details toggle).
    const summary = screen.getByTestId('agent-builder-chat-error-summary');
    const expected = parseStreamErrorText(openAIServerErrorPayload).summary;
    expect(summary.textContent).toContain(expected);
    expect(summary.textContent).not.toContain('AI_APICallError');
    expect(summary.textContent).not.toContain('req_abc123');
  });

  it('renders no "Try again" affordance when no user message exists in the thread', () => {
    render(
      <Providers>
        <MessageRow message={errorMessage('plain failure')} />
      </Providers>,
    );

    expect(screen.queryByTestId('agent-builder-chat-error-retry')).toBeNull();
  });
});

describe('MessageRow error retry against StreamChatProvider', () => {
  beforeEach(() => {
    server.resetHandlers();
    server.use(http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })));
  });

  afterEach(() => {
    cleanup();
  });

  it('"Try again" resubmits the most recent user prompt against the same thread', async () => {
    const onSend = vi.fn<(body: unknown) => void>();
    server.use(
      http.post(`${BASE_URL}/api/agents/${AGENT_ID}/threads/subscribe`, () => {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.close();
          },
        });
        return new HttpResponse(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
      }),
      http.post(`${BASE_URL}/api/agents/${AGENT_ID}/send-message`, async ({ request }) => {
        onSend(await request.json());
        return HttpResponse.json({ accepted: true, runId: 'retry-run' });
      }),
    );

    const initialMessages: MastraDBMessage[] = [
      userMessage('build me a standup bot'),
      errorMessage(openAIServerErrorPayload),
    ];

    await act(async () => {
      render(
        <MastraReactProvider baseUrl={BASE_URL}>
          <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <FormWrapper>
              <StreamChatProvider agentId={AGENT_ID} threadId="thread-1" initialMessages={initialMessages}>
                <MessageListConnector />
              </StreamChatProvider>
            </FormWrapper>
          </QueryClientProvider>
        </MastraReactProvider>,
      );
    });

    const retryButton = await screen.findByTestId('agent-builder-chat-error-retry');

    await act(async () => {
      retryButton.click();
    });

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    const body = onSend.mock.calls[0][0];
    expect(hasThreadContext(body, 'thread-1')).toBe(true);
    // The exact wire shape comes from @mastra/client-js; just assert that the
    // last user prompt is present somewhere in the request body so we know the
    // retry callback resolved to the right message.
    expect(JSON.stringify(body)).toContain('build me a standup bot');
  });
});
