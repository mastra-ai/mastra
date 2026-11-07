// @vitest-environment jsdom
import { defineCatalog } from '@json-render/core';
import type { BaseComponentProps } from '@json-render/react';
import { schema } from '@json-render/react/schema';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { server } from '../../test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../test/render';
import { MessageFactory } from '../../ui/MessageFactory';
import { createGenUI, useGenUIChat } from '../index';
import type { GenUIRegistry } from '../index';
import { AGENT_URL, chunk, controllableStream, finish, sseResponse, STREAM_URL } from './sse';

type Chat = ReturnType<typeof useGenUIChat>;
const chats: Record<string, Chat> = {};

function GenUIChat({
  genUI,
  initialMessages,
  agentId = 'agent-1',
}: {
  genUI: GenUIRegistry<any>;
  initialMessages?: MastraDBMessage[];
  agentId?: string;
}) {
  const chat = useGenUIChat({ agentId, resourceId: 'resource-1', threadId: 'thread-1', genUI, initialMessages });
  chats[agentId] = chat;
  return (
    <div data-testid={`chat-${agentId}`}>
      {chat.messages.map(message => (
        <MessageFactory
          key={message.id}
          message={message}
          Text={part => <span>{part.text}</span>}
          {...chat.genUI.renderers}
        />
      ))}
    </div>
  );
}

const send = async (message: string, agentId = 'agent-1') => {
  await act(async () => {
    // A cancelled run rejects its send with an AbortError, as in plain useChat.
    void chats[agentId]!.sendMessage({ message, threadId: 'thread-1' }).catch(() => {});
  });
};

let weatherMounts = 0;
const weatherProps = z.object({ city: z.string(), temp: z.number() });
function WeatherCard({ props }: BaseComponentProps<z.infer<typeof weatherProps>>) {
  useEffect(() => {
    weatherMounts++;
  }, []);
  return (
    <p data-testid="weather">
      {props.city}: {props.temp}°
    </p>
  );
}
const weatherCatalog = defineCatalog(schema, {
  components: {
    WeatherCard: { description: 'Current weather for a city', props: weatherProps },
    List: { props: z.object({}) },
  },
  actions: {},
});
const weatherUI = createGenUI({
  catalog: weatherCatalog,
  components: { WeatherCard, List: ({ children }) => <div>{children}</div> },
  specTool: true,
});

const twoCities = {
  root: 'list',
  elements: [
    { id: 'list', type: 'List', props: {}, children: ['paris', 'oslo'] },
    { id: 'paris', type: 'WeatherCard', props: { city: 'Paris', temp: 21 } },
    { id: 'oslo', type: 'WeatherCard', props: { city: 'Oslo', temp: 4 } },
  ],
};
const argsText = JSON.stringify(twoCities);
// Up to the middle of the second card, so only Paris can render.
const partialArgs = argsText.slice(0, argsText.indexOf('"id":"oslo"'));

const specView = (toolCallId = 'c1') =>
  document.querySelector(`[data-genui-spec="${toolCallId}"]`) as HTMLElement | null;

const specInvocation = (toolInvocation: object): MastraDBMessage => ({
  id: 'a1',
  role: 'assistant',
  createdAt: new Date(1),
  threadId: 'thread-1',
  resourceId: 'resource-1',
  content: {
    format: 2,
    parts: [
      {
        type: 'tool-invocation',
        toolInvocation: { toolCallId: 'c1', toolName: 'ui_spec', args: twoCities, ...toolInvocation },
      },
    ] as never,
  },
});

/** What @mastra/core saves as the result of a tool call cut off by a stopped run. */
const CORE_TOOL_ABORT_NOTICE =
  'Tool execution was aborted while running. The tool may still be running and its effects are unknown. Check its status before retrying.';

const streamPartialSpec = (stream: ReturnType<typeof controllableStream>) =>
  act(() =>
    stream.push(
      chunk('start'),
      chunk('tool-call-input-streaming-start', { toolCallId: 'c1', toolName: 'ui_spec' }),
      chunk('tool-call-delta', { toolCallId: 'c1', argsTextDelta: partialArgs }),
    ),
  );

beforeEach(() => {
  weatherMounts = 0;
});
afterEach(() => {
  cleanup();
});

describe('useGenUIChat — persistence and recovery', () => {
  it('stopping a run while the model writes a spec marks it interrupted, keeping what was shown', async () => {
    const stream = controllableStream();
    server.use(
      http.post(STREAM_URL, () => stream.response()),
      http.post(`${AGENT_URL}/threads/abort`, () => HttpResponse.json({ aborted: true })),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderWithProviders(<GenUIChat genUI={weatherUI} />);
    await send('weather');
    streamPartialSpec(stream);
    await waitFor(() => expect(specView()?.getAttribute('aria-busy')).toBe('true'));
    expect(screen.getByTestId('weather').textContent).toBe('Paris: 21°');

    await act(async () => {
      await chats['agent-1']!.cancelRun();
    });

    await waitFor(() => expect(specView()!.getAttribute('data-genui-status')).toBe('aborted'));
    expect(specView()!.getAttribute('aria-busy')).toBeNull();
    expect(screen.getByTestId('weather').textContent).toBe('Paris: 21°');
    expect(within(specView()!).getByRole('note').textContent).toMatch(/interrupted/);
    expect(weatherMounts).toBe(1);
    // The element the model never finished is simply absent, not reported as a broken reference.
    expect(warn.mock.calls.flat().join('\n')).not.toMatch(/Missing element/);
    warn.mockRestore();
  });

  it('a spec whose stream ended before the model finished it stops looking busy', async () => {
    const stream = controllableStream();
    server.use(http.post(STREAM_URL, () => stream.response()));
    renderWithProviders(<GenUIChat genUI={weatherUI} />);
    await send('weather');
    streamPartialSpec(stream);
    await waitFor(() => expect(specView()?.getAttribute('aria-busy')).toBe('true'));

    act(() => {
      stream.push(finish('stop'));
      stream.close();
    });
    await waitFor(() => expect(chats['agent-1']!.isRunning).toBe(false));
    expect(specView()!.getAttribute('aria-busy')).toBeNull();
    expect(specView()!.getAttribute('data-genui-status')).toBe('aborted');
    expect(screen.getByTestId('weather').textContent).toBe('Paris: 21°');
  });

  it.each([
    ['the user stopped the run', { state: 'result', result: CORE_TOOL_ABORT_NOTICE }],
    ['the run ended before the spec was answered', { state: 'call' }],
  ])('after a reload, a spec shows as interrupted when %s', (_case, call) => {
    renderWithProviders(<GenUIChat genUI={weatherUI} initialMessages={[specInvocation(call)]} />);

    expect(specView()!.getAttribute('data-genui-status')).toBe('aborted');
    expect(screen.getAllByTestId('weather').map(node => node.textContent)).toEqual(['Paris: 21°', 'Oslo: 4°']);
    expect(within(specView()!).getByRole('note').textContent).toMatch(/interrupted/);
  });

  it('after a reload, an accepted spec renders as ready and a rejected one explains why', () => {
    const { unmount } = renderWithProviders(
      <GenUIChat genUI={weatherUI} initialMessages={[specInvocation({ state: 'result', result: { ok: true } })]} />,
    );
    expect(specView()!.getAttribute('data-genui-status')).toBe('ready');
    expect(screen.getAllByTestId('weather')).toHaveLength(2);
    unmount();

    renderWithProviders(
      <GenUIChat
        genUI={weatherUI}
        initialMessages={[specInvocation({ state: 'result', result: { ok: false, error: 'root is missing' } })]}
      />,
    );
    expect(screen.queryByTestId('weather')).toBeNull();
    expect(screen.getByRole('note').textContent).toMatch(/could not be displayed: root is missing/);
  });
});

describe('useGenUIChat — multiple agents', () => {
  it('each chat renders only the components of its own registry', async () => {
    const taskCatalog = defineCatalog(schema, {
      components: { TaskList: { props: z.object({ items: z.array(z.string()) }) } },
      actions: {},
    });
    const taskUI = createGenUI({
      catalog: taskCatalog,
      components: {
        TaskList: ({ props }) => (
          <ul data-testid="tasks">
            {props.items.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ),
      },
      specTool: true,
    });
    const taskSpec = { root: 'root', elements: [{ id: 'root', type: 'TaskList', props: { items: ['ship'] } }] };
    const answer = () =>
      sseResponse([
        chunk('start'),
        chunk('tool-call', { toolCallId: 'c1', toolName: 'ui_spec', args: taskSpec }),
        finish('stop'),
      ]);
    server.use(http.post(STREAM_URL, answer), http.post(`${TEST_BASE_URL}/api/agents/agent-2/stream`, answer));
    renderWithProviders(
      <>
        <GenUIChat genUI={weatherUI} />
        <GenUIChat genUI={taskUI} agentId="agent-2" />
      </>,
    );
    await send('tasks?', 'agent-1');
    await send('tasks?', 'agent-2');

    const second = screen.getByTestId('chat-agent-2');
    await waitFor(() => expect(within(second).getByTestId('tasks').textContent).toBe('ship'));
    const first = screen.getByTestId('chat-agent-1');
    expect(first.querySelector('[data-genui-fallback]')?.textContent).toMatch(/"TaskList" is not available/);
    expect(within(first).queryByTestId('tasks')).toBeNull();
  });
});
