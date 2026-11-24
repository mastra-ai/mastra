// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { StreamParams } from '@mastra/client-js';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useEffect, useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { ChatProvider } from '../chat-provider';
import { useChatMessages, useChatRunning, useChatSend } from '@/domains/chat/context/chat-context';
import { MessageRow } from '@/domains/chat/messages/message-row';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const TURN = { timeout: 10_000 };

afterEach(cleanup);

function serveAgent(id: string, reply: string) {
  const model = new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start' as const, warnings: [] },
        { type: 'text-start' as const, id: 't' },
        ...reply.split(/(?= )/).map(delta => ({ type: 'text-delta' as const, id: 't', delta })),
        { type: 'text-end' as const, id: 't' },
        {
          type: 'finish' as const,
          finishReason: 'stop' as const,
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
      rawCall: { rawPrompt: [], rawSettings: {} },
    }),
  });
  const agent = new Agent({
    id,
    name: id,
    instructions: 'Reply.',
    model,
    memory: new Memory({ storage: new InMemoryStore() }),
  });
  const bodies: StreamParams[] = [];
  server.use(
    http.post(`${BASE_URL}/api/agents/${id}/stream`, async ({ request }) => {
      const body = (await request.json()) as StreamParams;
      bodies.push(body);
      const stream = await agent.stream(body.messages, { memory: body.memory });
      const encoder = new TextEncoder();
      const sse = new ReadableStream({
        async start(controller) {
          for await (const chunk of stream.fullStream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      return new HttpResponse(sse, { headers: { 'content-type': 'text/event-stream' } });
    }),
  );
  return bodies;
}

type ChatSend = ReturnType<typeof useChatSend>;

function Messages() {
  const messages = useChatMessages();
  return (
    <>
      {messages.map(message => (
        <MessageRow key={message.id} message={message} />
      ))}
    </>
  );
}

function Chat({ sends }: { sends: Set<ChatSend> }) {
  const send = useChatSend();
  const [keptSend] = useState(() => send);
  const { isRunning } = useChatRunning();
  useEffect(() => {
    sends.add(send);
  }, [send, sends]);
  return (
    <>
      <button disabled={isRunning} onClick={() => void keptSend({ message: 'Hello' })}>
        Ask
      </button>
      <Messages />
    </>
  );
}

function SendsWhenTheAgentChanges({ agentId }: { agentId: string }) {
  const send = useChatSend();
  const [firstAgentId] = useState(agentId);
  useLayoutEffect(() => {
    if (agentId !== firstAgentId) void send({ message: 'Hello' });
  }, [agentId, firstAgentId, send]);
  return <Messages />;
}

function renderChat(agentId: string, content: (agentId: string) => ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const chatWith = (id: string) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ChatProvider agentId={id} threadId="thread-1" supportsMemory={false} requestContext={{ team: id }}>
            {content(id)}
          </ChatProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
  const view = render(chatWith(agentId));
  return { switchTo: (id: string) => view.rerender(chatWith(id)) };
}

const ask = async () => {
  const button = screen.getByRole('button', { name: 'Ask' });
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false), TURN);
  fireEvent.click(button);
};

describe('the send a chat hands out', () => {
  it(
    'stays one function through a streamed reply, and reaches the agent the chat is on now',
    { timeout: 30_000 },
    async () => {
      const support = serveAgent('support', 'Support is on it.');
      const billing = serveAgent('billing', 'Billing is on it.');
      const sends = new Set<ChatSend>();
      const chat = renderChat('support', () => <Chat sends={sends} />);

      await ask();
      await screen.findByText('Support is on it.', undefined, TURN);

      chat.switchTo('billing');
      await ask();
      await screen.findByText('Billing is on it.', undefined, TURN);

      expect(support).toHaveLength(1);
      expect(billing).toHaveLength(1);
      expect(sends.size).toBe(1);
    },
  );

  it(
    'reaches the agent the chat just switched to, with its context, even when sent from a layout effect during the switch',
    { timeout: 30_000 },
    async () => {
      const support = serveAgent('support', 'Support is on it.');
      const billing = serveAgent('billing', 'Billing is on it.');
      const chat = renderChat('support', agentId => <SendsWhenTheAgentChanges agentId={agentId} />);

      chat.switchTo('billing');
      await screen.findByText(/ is on it\.$/, undefined, TURN);

      expect(support).toHaveLength(0);
      expect(billing.map(body => body.requestContext)).toEqual([expect.objectContaining({ team: 'billing' })]);
    },
  );
});
