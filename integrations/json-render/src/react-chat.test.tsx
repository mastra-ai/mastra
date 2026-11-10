// @vitest-environment jsdom
import { createStateStore } from '@json-render/core';
import type { Spec } from '@json-render/core';
import {
  JSONUIProvider,
  Renderer,
  buildSpecFromParts,
  defineRegistry,
  useBoundProp,
  useJsonRenderMessage,
} from '@json-render/react';
import type { Components, DataPart } from '@json-render/react';
import type { Agent, MastraDBMessage } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { MastraReactProvider, useChat } from '@mastra/react';
import { MessageFactory } from '@mastra/react/ui';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { catalog, chat, createAgent, modelSaw, modelWriting, specBlock, weatherCard } from './test-utils';
import { JSON_RENDER_STATE } from './index';

const BASE_URL = 'http://localhost:4111';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

/** Answers the chat's requests with the agent itself, the way a Mastra server would. */
function serve(agent: Agent) {
  server.use(
    http.post(`${BASE_URL}/api/agents/ui/stream`, async ({ request }) => {
      const body = (await request.json()) as any;
      const stream = await agent.stream(body.messages, {
        memory: body.memory,
        requestContext: new RequestContext(Object.entries(body.requestContext ?? {})),
      });
      const encoder = new TextEncoder();
      const sse = new ReadableStream({
        async start(controller) {
          for await (const chunk of stream.fullStream)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      return new HttpResponse(sse, { headers: { 'content-type': 'text/event-stream' } });
    }),
  );
}

const components: Components<typeof catalog> = {
  Card: ({ props, children }) => (
    <section>
      <h2>{props.title}</h2>
      {children}
    </section>
  ),
  Text: ({ props }) => <p>{props.text}</p>,
  Toggle: ({ props, bindings }) => {
    const [checked, setChecked] = useBoundProp<boolean>(props.checked, bindings?.checked);
    return (
      <label>
        <input type="checkbox" checked={!!checked} onChange={event => setChecked(event.target.checked)} />
        {props.label}
      </label>
    );
  },
  Button: ({ props, emit }) => <button onClick={() => emit('press')}>{props.label}</button>,
};

type Send = (message: string, state?: Record<string, unknown>) => void;

/** An app's chat: prose through MessageFactory, the interface through json-render's own renderer. */
function Chat({ initialMessages }: { initialMessages?: MastraDBMessage[] }) {
  const { messages, sendMessage } = useChat({ agentId: 'ui', resourceId: 'r1', threadId: 't1', initialMessages });
  const send: Send = (message, state) =>
    void sendMessage({
      message,
      threadId: 't1',
      requestContext: state && new RequestContext([[JSON_RENDER_STATE, state]]),
    });
  return (
    <>
      <button onClick={() => send('Weather in Paris?')}>Send</button>
      {messages.map(message => (
        <MessageFactory
          key={message.id}
          message={message}
          Text={part => <p>{part.text}</p>}
          roles={{
            Assistant: ({ message, children }) => (
              <Reply message={message} send={send}>
                {children}
              </Reply>
            ),
          }}
        />
      ))}
    </>
  );
}

function Reply({ message, send, children }: { message: MastraDBMessage; send: Send; children: ReactNode }) {
  const { spec } = useJsonRenderMessage(message.content.parts as DataPart[]);
  return (
    <article>
      {children}
      {spec && <Interface spec={spec} send={send} />}
    </article>
  );
}

/** The interface keeps its own state; its actions talk to the agent, sending that state along. */
function Interface({ spec, send }: { spec: Spec; send: Send }) {
  const [store] = useState(() => createStateStore(spec.state ?? {}));
  const { registry, handlers } = useMemo(
    () =>
      defineRegistry(catalog, {
        components,
        actions: { ask: async (params, _, state) => send(params!.message, state) },
      }),
    [send],
  );
  return (
    <JSONUIProvider registry={registry} store={store} handlers={handlers(() => undefined, store.getSnapshot)}>
      <Renderer spec={spec} registry={registry} />
    </JSONUIProvider>
  );
}

const renderChat = (initialMessages?: MastraDBMessage[]) =>
  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <Chat initialMessages={initialMessages} />
    </MastraReactProvider>,
  );

describe('a json-render interface in a Mastra React chat', () => {
  it('renders the interface the agent streams', async () => {
    const { model } = modelWriting(`Here is the weather.\n${specBlock(weatherCard)}`);
    serve(createAgent(model).agent);
    renderChat();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send' })));

    expect(await screen.findByRole('heading', { name: 'Paris' })).toBeTruthy();
    expect(screen.getByText('18°C and sunny')).toBeTruthy();
    expect(screen.getByText('Here is the weather.')).toBeTruthy();
    expect(screen.queryByText(/```spec|"op"/)).toBeNull();
  });

  it('renders the interface again from the saved thread after a reload', async () => {
    const { model } = modelWriting(`Here is the weather.\n${specBlock(weatherCard)}`);
    const { messages } = await chat(model, 'Weather in Paris?');

    renderChat(messages);

    expect(await screen.findByRole('heading', { name: 'Paris' })).toBeTruthy();
    expect(screen.getByText('18°C and sunny')).toBeTruthy();
  });

  it('lets the interface ask the agent, showing the model what the user set in it', async () => {
    const picker = {
      root: 'card',
      state: { celsius: false },
      elements: {
        card: { type: 'Card', props: { title: 'Units' }, children: ['celsius', 'ask'] },
        celsius: { type: 'Toggle', props: { label: 'Celsius', checked: { $bindState: '/celsius' } }, children: [] },
        ask: {
          type: 'Button',
          props: { label: 'Ask' },
          on: { press: { action: 'ask', params: { message: 'Which unit did I pick?' } } },
          children: [],
        },
      },
    };
    const { model, prompts } = modelWriting(`Pick one.\n${specBlock(picker)}`, 'You picked Celsius.');
    const { messages, agent } = await chat(model, 'Which units?');
    const savedSpec = buildSpecFromParts(messages.find(message => message.role === 'assistant')!.content.parts as any)!;
    expect(savedSpec).toEqual(picker);
    serve(agent);
    renderChat(messages);

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Celsius' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Ask' })));

    expect(await screen.findByText('You picked Celsius.')).toBeTruthy();
    expect(modelSaw(prompts[1])).toEqual([
      { role: 'user', text: 'Which units?' },
      { role: 'assistant', text: `Pick one.\n${specBlock({ ...picker, state: { celsius: true } })}` },
      { role: 'user', text: 'Which unit did I pick?' },
    ]);
  });
});
