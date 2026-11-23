// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { StreamParams } from '@mastra/client-js';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { JSON_RENDER_STATE, JsonRenderProcessor } from '@mastra/json-render';
import { studioCatalog } from '@mastra/json-render/studio';
import { Memory } from '@mastra/memory';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { ChatProvider } from '@/domains/agents/chat/chat-provider';
import { useChatMessages, useChatSend } from '@/domains/chat/context/chat-context';
import { MessageRow } from '@/domains/chat/messages/message-row';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
// Each turn runs a real agent, which takes a while when the whole suite shares the machine.
const TURN = { timeout: 10_000 };
const AGENT_ID = 'gen-ui';

afterEach(cleanup);

/** What Studio posts to the stream endpoint; the request context arrives as a plain object. */
type StreamBody = Omit<StreamParams, 'requestContext'> & { requestContext?: Record<string, unknown> };

type FormSpec = {
  root: string;
  state: Record<string, unknown>;
  elements: Record<string, { type: string; props: Record<string, unknown>; children: string[]; on?: unknown }>;
};

const signupForm: FormSpec = {
  root: 'card',
  state: { email: '' },
  elements: {
    card: { type: 'Card', props: { title: 'Join the beta' }, children: ['email', 'join'] },
    email: { type: 'Input', props: { label: 'Email', value: { $bindState: '/email' }, type: 'email' }, children: [] },
    join: {
      type: 'Button',
      props: { label: 'Join' },
      on: { press: { action: 'sendMessage', params: { message: 'Sign me up' } } },
      children: [],
    },
  },
};

const teamForm: FormSpec = {
  root: 'team-card',
  state: { team: 'core' },
  elements: {
    'team-card': { type: 'Card', props: { title: 'Pick a team' }, children: ['team', 'save'] },
    team: { type: 'Input', props: { label: 'Team', value: { $bindState: '/team' } }, children: [] },
    save: {
      type: 'Button',
      props: { label: 'Save team' },
      on: { press: { action: 'sendMessage', params: { message: 'Save it' } } },
      children: [],
    },
  },
};

/** The ```spec block the catalog's prompt asks the model to write. */
function specBlock(spec: FormSpec) {
  const lines = [
    { op: 'add', path: '/root', value: spec.root },
    { op: 'add', path: '/state', value: spec.state },
    ...Object.entries(spec.elements).map(([key, element]) => ({ op: 'add', path: `/elements/${key}`, value: element })),
  ];
  return ['```spec', ...lines.map(line => JSON.stringify(line)), '```'].join('\n');
}

/** A model that writes each reply in turn, in small deltas, and remembers what it was shown. */
function modelWriting(...replies: string[]) {
  const prompts: unknown[] = [];
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      const reply = replies[prompts.length - 1] ?? 'Done';
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'text-start' as const, id: 't' },
          ...(reply.match(/[\s\S]{1,7}/g) ?? []).map(delta => ({ type: 'text-delta' as const, id: 't', delta })),
          { type: 'text-end' as const, id: 't' },
          {
            type: 'finish' as const,
            finishReason: 'stop' as const,
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          },
        ]),
        rawCall: { rawPrompt: [], rawSettings: {} },
      };
    },
  });
  return { model, prompts };
}

/** Serves a real agent composing with `studioCatalog`; returns the bodies Studio posted to it. */
function serveAgent(model: MockLanguageModelV2) {
  const processor = new JsonRenderProcessor({ catalog: studioCatalog });
  const agent = new Agent({
    id: AGENT_ID,
    name: AGENT_ID,
    instructions: studioCatalog.prompt({ mode: 'inline', editModes: ['patch'] }),
    model,
    memory: new Memory({ storage: new InMemoryStore() }),
    inputProcessors: [processor],
    outputProcessors: [processor],
  });
  const bodies: StreamBody[] = [];
  server.use(
    http.post(`${BASE_URL}/api/agents/${AGENT_ID}/stream`, async ({ request }) => {
      const body = (await request.json()) as StreamBody;
      bodies.push(body);
      const stream = await agent.stream(body.messages, {
        memory: body.memory,
        requestContext: new RequestContext(Object.entries(body.requestContext ?? {})),
      });
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

function Transcript() {
  const messages = useChatMessages();
  const send = useChatSend();
  return (
    <>
      <button onClick={() => void send({ message: 'I want to join the beta' })}>Ask</button>
      {messages.map(message => (
        <MessageRow key={message.id} message={message} />
      ))}
    </>
  );
}

function renderChat() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ChatProvider agentId={AGENT_ID} threadId="thread-1" supportsMemory={false}>
            <Transcript />
          </ChatProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

/** The conversation a model call was given, without the system prompt, each message reduced to its text. */
function modelSaw(prompt: unknown) {
  return (prompt as { role: string; content: string | { type: string; text?: string }[] }[])
    .filter(message => message.role !== 'system')
    .map(message =>
      typeof message.content === 'string'
        ? message.content
        : message.content
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join(''),
    );
}

describe('an interface an agent composes in Studio chat', () => {
  it(
    'is drawn with Studio components, and sends what the user entered back to the agent',
    { timeout: 30_000 },
    async () => {
      const { model, prompts } = modelWriting(`Here you go.\n${specBlock(signupForm)}`, 'You are on the list.');
      const bodies = serveAgent(model);
      renderChat();

      fireEvent.click(screen.getByRole('button', { name: 'Ask' }));

      await screen.findByRole('textbox', { name: 'Email' }, TURN);
      expect(screen.getByText('Join the beta')).toBeTruthy();
      expect(screen.queryByText(/```spec/)).toBeNull();

      // Controls stay disabled until the reply has streamed and been drawn in full.
      await waitFor(
        () => expect(screen.getByRole('button', { name: 'Join' }).hasAttribute('disabled')).toBe(false),
        TURN,
      );

      fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'ada@example.com' } });
      fireEvent.click(screen.getByRole('button', { name: 'Join' }));

      await screen.findByText('You are on the list.', undefined, TURN);
      expect(bodies).toHaveLength(2);
      expect(bodies[1]?.requestContext?.[JSON_RENDER_STATE]).toEqual({ email: 'ada@example.com' });
      // The processor shows the model its interface as the user left it.
      expect(modelSaw(prompts[1]).join('\n')).toContain('ada@example.com');
    },
  );

  it(
    'only lets the latest interface answer, since the agent applies the state it gets to that one',
    { timeout: 45_000 },
    async () => {
      const { model } = modelWriting(
        `Here you go.\n${specBlock(signupForm)}`,
        `Now this.\n${specBlock(teamForm)}`,
        'Saved.',
      );
      const bodies = serveAgent(model);
      renderChat();

      fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
      const enabled = (name: string) =>
        waitFor(() => expect(screen.getByRole('button', { name }).hasAttribute('disabled')).toBe(false), TURN);
      await enabled('Join');
      fireEvent.click(screen.getByRole('button', { name: 'Join' }));

      await enabled('Save team');
      // The signup form is now an earlier interface: it is shown, but can no longer answer.
      expect(screen.getByRole('button', { name: 'Join' }).hasAttribute('disabled')).toBe(true);
      expect(screen.getByRole('textbox', { name: 'Email' }).hasAttribute('disabled')).toBe(true);

      fireEvent.change(screen.getByRole('textbox', { name: 'Team' }), { target: { value: 'platform' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save team' }));

      await screen.findByText('Saved.', undefined, TURN);
      expect(bodies).toHaveLength(3);
      expect(bodies[2]?.requestContext?.[JSON_RENDER_STATE]).toEqual({ team: 'platform' });
    },
  );

  it('is read-only where nothing can answer it, e.g. a message read back in a trace', async () => {
    const message: MastraDBMessage = {
      id: 'msg-1',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [{ type: 'data-spec', data: { type: 'flat', spec: signupForm } }] as MastraDBMessage['content']['parts'],
      },
    };
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <MessageRow message={message} readOnly />
          </MemoryRouter>
        </QueryClientProvider>
      </MastraReactProvider>,
    );

    expect(await screen.findByText('Join the beta')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Join' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Email' }).hasAttribute('disabled')).toBe(true);
  });
});
