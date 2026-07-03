import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStreamMessages } from '../../../contexts/stream-chat-context';
import { StreamChatProvider } from '../../../contexts/stream-chat-provider';
import { MessageList } from '../message-list';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'builder-agent';
const RUN_ID = 'run-approval-1';
const TOOL_CALL_ID = 'call-approval-1';
const TOOL_NAME = 'dangerous-tool';

// Thin connector: feeds the provider's message context into MessageList so the
// real MessageRow approval branch renders against live context state.
const MessageListConnector = () => {
  const messages = useStreamMessages();
  return <MessageList messages={messages} />;
};

const Providers = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

// Assistant message suspended on a tool that requires approval. The runId on the
// metadata entry is what `extractRunIdFromMessages` recovers so a subsequent
// approve/decline can hit the network.
const pendingApprovalMessage = (): MastraDBMessage =>
  ({
    id: 'assistant-pending',
    role: 'assistant',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'call',
            step: 0,
            toolCallId: TOOL_CALL_ID,
            toolName: TOOL_NAME,
            args: { foo: 'bar' },
          },
        },
      ],
      metadata: {
        mode: 'stream',
        requireApprovalMetadata: {
          [TOOL_NAME]: {
            toolCallId: TOOL_CALL_ID,
            toolName: TOOL_NAME,
            args: { foo: 'bar' },
            runId: RUN_ID,
          },
        },
      },
    },
  }) as unknown as MastraDBMessage;

// A normal completed tool message that carries NO approval metadata.
const normalToolMessage = (): MastraDBMessage =>
  ({
    id: 'assistant-normal',
    role: 'assistant',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            step: 0,
            toolCallId: 'call-normal',
            toolName: 'some-other-tool',
            args: {},
            result: { success: true },
          },
        },
      ],
    },
  }) as unknown as MastraDBMessage;

const renderWithMessages = async (initialMessages: MastraDBMessage[]) => {
  await act(async () => {
    render(
      <Providers>
        <StreamChatProvider agentId={AGENT_ID} threadId="thread-test" initialMessages={initialMessages}>
          <MessageListConnector />
        </StreamChatProvider>
      </Providers>,
    );
  });
};

describe('agent-builder MessageRow tool approval', () => {
  beforeEach(() => {
    server.resetHandlers();
    server.use(http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })));
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Approve/Decline buttons for a tool pending approval', async () => {
    await renderWithMessages([pendingApprovalMessage()]);

    expect(await screen.findByTestId('agent-builder-chat-tool-approve')).not.toBeNull();
    expect(screen.getByTestId('agent-builder-chat-tool-decline')).not.toBeNull();
  });

  it('clicking Approve hits the approve-tool-call endpoint with the recovered runId', async () => {
    const onApprove = vi.fn<(body: any) => void>();
    server.use(
      http.post(`${BASE_URL}/api/agents/${AGENT_ID}/approve-tool-call`, async ({ request }) => {
        onApprove(await request.json());
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.close();
          },
        });
        return new HttpResponse(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
      }),
    );

    await renderWithMessages([pendingApprovalMessage()]);

    const approveButton = await screen.findByTestId('agent-builder-chat-tool-approve');

    await act(async () => {
      approveButton.click();
    });

    await waitFor(() => expect(onApprove).toHaveBeenCalledTimes(1));
    expect(onApprove.mock.calls[0][0]).toMatchObject({ runId: RUN_ID, toolCallId: TOOL_CALL_ID });
  });

  it('clicking Decline hits the decline-tool-call endpoint', async () => {
    const onDecline = vi.fn<(body: any) => void>();
    server.use(
      http.post(`${BASE_URL}/api/agents/${AGENT_ID}/decline-tool-call`, async ({ request }) => {
        onDecline(await request.json());
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.close();
          },
        });
        return new HttpResponse(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
      }),
    );

    await renderWithMessages([pendingApprovalMessage()]);

    const declineButton = await screen.findByTestId('agent-builder-chat-tool-decline');

    await act(async () => {
      declineButton.click();
    });

    await waitFor(() => expect(onDecline).toHaveBeenCalledTimes(1));
    expect(onDecline.mock.calls[0][0]).toMatchObject({ runId: RUN_ID, toolCallId: TOOL_CALL_ID });
  });

  it('renders no approval buttons for a normal tool message without approval metadata', async () => {
    await renderWithMessages([normalToolMessage()]);

    // Let any effects settle so we are asserting on the final render.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    expect(screen.queryByTestId('agent-builder-chat-tool-approve')).toBeNull();
    expect(screen.queryByTestId('agent-builder-chat-tool-decline')).toBeNull();
  });
});
