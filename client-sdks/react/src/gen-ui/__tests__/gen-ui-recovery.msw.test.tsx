// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { server } from '../../test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../test/render';
import { MessageFactory } from '../../ui/MessageFactory';
import type { GenUIChatActionHandler } from '../controller';
import { createGenUI, defineGenUIChatAction, defineGenUIComponent, GenUISurfaceOutlet, useGenUIChat } from '../index';
import type { GenUIRegistry } from '../index';
import { AGENT_URL, chunk, controllableStream, finish, genUIChunk, sseResponse, STREAM_URL } from './sse';

type Chat = ReturnType<typeof useGenUIChat>;
const chats: Record<string, Chat> = {};

function GenUIChat({
  genUI,
  actions,
  initialMessages,
  agentId = 'agent-1',
  outlet = false,
}: {
  genUI: GenUIRegistry;
  actions?: Record<string, GenUIChatActionHandler<any>>;
  initialMessages?: MastraDBMessage[];
  agentId?: string;
  outlet?: boolean;
}) {
  const chat = useGenUIChat({
    agentId,
    resourceId: 'resource-1',
    threadId: 'thread-1',
    genUI,
    actions,
    initialMessages,
  });
  chats[agentId] = chat;
  return (
    <div data-testid={`chat-${agentId}`}>
      <main data-testid="messages">
        {chat.messages.map(message => (
          <MessageFactory
            key={message.id}
            message={message}
            Text={part => <span>{part.text}</span>}
            {...chat.genUI.renderers}
          />
        ))}
      </main>
      {outlet ? (
        <aside data-testid="panel">
          <GenUISurfaceOutlet controller={chat.genUI.controller} empty={<p>No panel</p>} />
        </aside>
      ) : null}
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
const WeatherCard = defineGenUIComponent({
  description: 'Current weather for a city',
  schema: z.object({ city: z.string(), temp: z.number() }),
  component: ({ props }) => {
    useEffect(() => {
      weatherMounts++;
    }, []);
    return (
      <p data-testid="weather">
        {props.city}: {props.temp}°
      </p>
    );
  },
});
const weatherOnly = createGenUI({ components: { WeatherCard } });

const create = (eventId: string, temp = 21, extra: object = {}) => ({
  version: 1,
  eventId,
  surfaceId: 'weather',
  operations: [
    {
      op: 'createSurface',
      ...extra,
      spec: { root: 'card', elements: { card: { type: 'WeatherCard', props: { city: 'Paris', temp } } } },
    },
  ],
});
const setTemp = (eventId: string, temp: number, baseRevision?: number) => ({
  version: 1,
  eventId,
  surfaceId: 'weather',
  ...(baseRevision !== undefined ? { baseRevision } : {}),
  operations: [{ op: 'patch', patches: [{ op: 'replace', path: '/elements/card/props/temp', value: temp }] }],
});
const ready = (eventId: string) => ({
  version: 1,
  eventId,
  surfaceId: 'weather',
  operations: [{ op: 'setStatus', status: 'ready' }],
});

const assistant = (id: string, envelopes: object[], createdAt = 1): MastraDBMessage => ({
  id,
  role: 'assistant',
  createdAt: new Date(createdAt),
  threadId: 'thread-1',
  resourceId: 'resource-1',
  content: { format: 2, parts: envelopes.map(data => ({ type: 'data-gen-ui', data })) as never },
});

const surfaceEl = (id = 'weather') => document.querySelector(`[data-genui-surface="${id}"]`) as HTMLElement | null;

/** What @mastra/core saves as the result of a tool call cut off by a stopped run. */
const CORE_TOOL_ABORT_NOTICE =
  'Tool execution was aborted while running. The tool may still be running and its effects are unknown. Check its status before retrying.';

beforeEach(() => {
  weatherMounts = 0;
});
afterEach(() => {
  cleanup();
});

describe('useGenUIChat — persistence and recovery', () => {
  it('rebuilds a surface from history as the user last saw it, and a new run keeps updating it in place', async () => {
    const history = [assistant('a1', [create('e1'), setTemp('e2', 22, 1), ready('e3')])];
    server.use(
      http.post(STREAM_URL, () => sseResponse([chunk('start'), genUIChunk(setTemp('e4', 25, 3)), finish('stop')])),
    );
    renderWithProviders(<GenUIChat genUI={weatherOnly} initialMessages={history} />);

    expect(screen.getByTestId('weather').textContent).toBe('Paris: 22°');
    expect(surfaceEl()!.getAttribute('data-genui-status')).toBe('ready');

    await send('warmer now?');
    await waitFor(() => expect(screen.getByTestId('weather').textContent).toBe('Paris: 25°'));
    expect(screen.getAllByTestId('weather')).toHaveLength(1);
    expect(weatherMounts).toBe(1);
  });

  it('applies updates in revision order even when they arrive out of order', async () => {
    server.use(
      http.post(STREAM_URL, () =>
        sseResponse([
          chunk('start'),
          genUIChunk(create('e1')),
          genUIChunk(setTemp('e3', 23, 2)),
          genUIChunk(setTemp('e2', 22, 1)),
          genUIChunk(ready('e4')),
          finish('stop'),
        ]),
      ),
    );
    renderWithProviders(<GenUIChat genUI={weatherOnly} />);
    await send('weather');

    await waitFor(() => expect(surfaceEl()?.getAttribute('data-genui-status')).toBe('ready'));
    expect(screen.getByTestId('weather').textContent).toBe('Paris: 23°');
    expect(document.querySelector('[data-genui-fallback]')).toBeNull();
  });

  it('a reconnect that replays events already in history does not apply them twice', async () => {
    // e2 is a relative change in the agent's eyes; applying it twice would be visible.
    const history = [assistant('a1', [create('e1'), setTemp('e2', 22, 1)])];
    server.use(
      http.post(STREAM_URL, () =>
        sseResponse([
          chunk('start'),
          genUIChunk(create('e1', 99)),
          genUIChunk(setTemp('e2', 98, 1)),
          genUIChunk(setTemp('e3', 24, 2)),
          finish('stop'),
        ]),
      ),
    );
    renderWithProviders(<GenUIChat genUI={weatherOnly} initialMessages={history} />);
    await send('resume');

    await waitFor(() => expect(screen.getByTestId('weather').textContent).toBe('Paris: 24°'));
    expect(screen.getAllByTestId('weather')).toHaveLength(1);
    expect(document.querySelector('[data-genui-fallback]')).toBeNull();
  });

  it('stopping a run marks its unfinished surfaces as interrupted, keeping what was shown', async () => {
    const stream = controllableStream();
    server.use(
      http.post(STREAM_URL, () => stream.response()),
      http.post(`${AGENT_URL}/threads/abort`, () => HttpResponse.json({ aborted: true })),
    );
    renderWithProviders(<GenUIChat genUI={weatherOnly} />);
    await send('weather');
    act(() => stream.push(chunk('start'), genUIChunk(create('e1'))));
    await waitFor(() => expect(surfaceEl()?.getAttribute('aria-busy')).toBe('true'));

    await act(async () => {
      await chats['agent-1']!.cancelRun();
    });

    await waitFor(() => expect(surfaceEl()!.getAttribute('data-genui-status')).toBe('aborted'));
    expect(surfaceEl()!.getAttribute('aria-busy')).toBeNull();
    expect(screen.getByTestId('weather').textContent).toBe('Paris: 21°');
    expect(within(surfaceEl()!).getByRole('note').textContent).toMatch(/interrupted/);
  });

  it('a surface the agent never marked ready stops looking busy once the run is over', async () => {
    const stream = controllableStream();
    server.use(http.post(STREAM_URL, () => stream.response()));
    renderWithProviders(<GenUIChat genUI={weatherOnly} />);
    await send('weather');
    act(() => stream.push(chunk('start'), genUIChunk(create('e1'))));
    await waitFor(() => expect(surfaceEl()?.getAttribute('aria-busy')).toBe('true'));

    act(() => {
      stream.push(finish('stop'));
      stream.close();
    });
    await waitFor(() => expect(chats['agent-1']!.isRunning).toBe(false));
    expect(surfaceEl()!.getAttribute('aria-busy')).toBeNull();
    expect(surfaceEl()!.getAttribute('data-genui-status')).toBe('ready');
  });

  it('a surface left unfinished in history is not shown as loading forever', () => {
    renderWithProviders(<GenUIChat genUI={weatherOnly} initialMessages={[assistant('a1', [create('e1')])]} />);
    expect(screen.getByTestId('weather').textContent).toBe('Paris: 21°');
    expect(surfaceEl()!.getAttribute('aria-busy')).toBeNull();
  });

  const toolCall = (toolInvocation: object): MastraDBMessage['content']['parts'][number] =>
    ({
      type: 'tool-invocation',
      toolInvocation: { toolCallId: 'c1', toolName: 'getWeather', args: {}, ...toolInvocation },
    }) as never;
  const linkedSurface = (call: object, metadata?: Record<string, unknown>): MastraDBMessage => {
    const message = assistant('a1', [create('e1', 21, { source: { toolCallId: 'c1' } })]);
    message.content.parts = [toolCall(call), ...message.content.parts];
    if (metadata) message.content.metadata = metadata;
    return message;
  };

  it.each([
    ['the user stopped the run', { state: 'result', result: CORE_TOOL_ABORT_NOTICE }],
    ['the stream ended before the tool returned', { state: 'call' }],
  ])('after a reload, a surface whose tool was cut off shows as interrupted when %s', (_case, call) => {
    renderWithProviders(<GenUIChat genUI={weatherOnly} initialMessages={[linkedSurface(call)]} />);

    expect(surfaceEl()!.getAttribute('data-genui-status')).toBe('aborted');
    expect(screen.getByTestId('weather').textContent).toBe('Paris: 21°');
    expect(within(surfaceEl()!).getByRole('note').textContent).toMatch(/interrupted/);
  });

  it('after a reload, a surface whose tool finished or is waiting for approval is not shown as interrupted', () => {
    const { unmount } = renderWithProviders(
      <GenUIChat genUI={weatherOnly} initialMessages={[linkedSurface({ state: 'result', result: { ok: true } })]} />,
    );
    expect(surfaceEl()!.getAttribute('data-genui-status')).toBe('ready');
    unmount();

    renderWithProviders(
      <GenUIChat
        genUI={weatherOnly}
        initialMessages={[
          linkedSurface(
            { state: 'call' },
            { pendingToolApprovals: { getWeather: { toolCallId: 'c1', toolName: 'getWeather' } } },
          ),
        ]}
      />,
    );
    expect(surfaceEl()!.getAttribute('data-genui-status')).toBe('ready');
  });
});

describe('useGenUIChat — surfaces outside the chat', () => {
  it('a panel surface renders in the outlet, not in the message, and its actions still reach the agent', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return bodies.length === 1
          ? sseResponse([
              chunk('start'),
              genUIChunk({
                version: 1,
                eventId: 'e1',
                surfaceId: 'weather',
                operations: [
                  {
                    op: 'createSurface',
                    placement: 'panel',
                    spec: {
                      root: 'card',
                      elements: {
                        card: {
                          type: 'WeatherCard',
                          props: { city: 'Paris', temp: 21 },
                          on: { press: { action: 'refresh', params: { city: 'Paris' } } },
                        },
                      },
                    },
                  },
                ],
              }),
              finish('stop'),
            ])
          : sseResponse([chunk('start'), finish('stop')]);
      }),
    );
    const Refreshable = defineGenUIComponent({
      schema: z.object({ city: z.string(), temp: z.number() }),
      events: ['press'],
      component: ({ props, emit }) => <button onClick={() => emit('press')}>Refresh {props.city}</button>,
    });
    const refresh = defineGenUIChatAction({
      schema: z.object({ city: z.string() }),
      handle: async ({ city }, { chat }) => {
        await chat.sendMessage(`Refresh ${city}`);
      },
    });
    renderWithProviders(
      <GenUIChat genUI={createGenUI({ components: { WeatherCard: Refreshable } })} actions={{ refresh }} outlet />,
    );
    expect(screen.getByText('No panel')).toBeTruthy();
    await send('weather');

    const panel = screen.getByTestId('panel');
    const button = await within(panel).findByRole('button', { name: 'Refresh Paris' });
    expect(within(screen.getByTestId('messages')).queryByRole('button')).toBeNull();
    await waitFor(() => expect(chats['agent-1']!.isRunning).toBe(false));

    fireEvent.click(button);
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(JSON.stringify(bodies[1]!.messages)).toContain('Refresh Paris');
  });

  it('an out-of-band surface (e.g. a workflow stream) keeps streaming while the chat is idle and survives history rebuilds', async () => {
    renderWithProviders(<GenUIChat genUI={weatherOnly} initialMessages={[assistant('a1', [create('e1')])]} outlet />);
    const controller = chats['agent-1']!.genUI.controller;

    act(() =>
      controller.ingest({
        version: 1,
        eventId: 'wf-1',
        surfaceId: 'deploy',
        operations: [
          {
            op: 'createSurface',
            placement: 'panel',
            spec: { root: 'card', elements: { card: { type: 'WeatherCard', props: { city: 'Deploy', temp: 1 } } } },
          },
        ],
      }),
    );
    const panel = screen.getByTestId('panel');
    expect(within(panel).getByTestId('weather').textContent).toBe('Deploy: 1°');
    expect(surfaceEl('deploy')!.getAttribute('aria-busy')).toBe('true');

    // Editing history (not an append) forces a deterministic rebuild from messages.
    act(() => chats['agent-1']!.setMessages(() => []));
    await waitFor(() => expect(surfaceEl('weather')).toBeNull());
    expect(within(panel).getByTestId('weather').textContent).toBe('Deploy: 1°');
    expect(surfaceEl('deploy')!.getAttribute('aria-busy')).toBe('true');
  });
});

describe('useGenUIChat — capability mismatch', () => {
  const catalogued = createGenUI({ components: { WeatherCard }, catalog: { id: 'acme', version: '2.3.0' } });
  const withCatalog = (eventId: string, surfaceId: string, catalogId: string, catalogVersion: string) => ({
    version: 1,
    eventId,
    surfaceId,
    operations: [
      {
        op: 'createSurface',
        catalogId,
        catalogVersion,
        spec: { root: 'card', elements: { card: { type: 'WeatherCard', props: { city: surfaceId, temp: 1 } } } },
      },
    ],
  });

  it('renders surfaces built for a compatible catalog and falls back for other catalogs or major versions', async () => {
    server.use(
      http.post(STREAM_URL, () =>
        sseResponse([
          chunk('start'),
          genUIChunk(withCatalog('e1', 'minor', 'acme', '2.9.1')),
          genUIChunk(withCatalog('e2', 'major', 'acme', '3.0.0')),
          genUIChunk(withCatalog('e3', 'other', 'globex', '2.3.0')),
          genUIChunk({ version: 2, eventId: 'e4', surfaceId: 'future', operations: [] }),
          finish('stop'),
        ]),
      ),
    );
    renderWithProviders(<GenUIChat genUI={catalogued} />);
    await send('weather');

    await waitFor(() => expect(screen.getAllByTestId('weather')).toHaveLength(1));
    expect(screen.getByTestId('weather').textContent).toBe('minor: 1°');
    const fallbacks = [...document.querySelectorAll('[data-genui-fallback]')].map(node => node.textContent);
    expect(fallbacks).toHaveLength(3);
    expect(fallbacks.filter(text => /different version/.test(text ?? ''))).toHaveLength(2);
  });
});

describe('useGenUIChat — multiple agents', () => {
  it('each chat renders only its own registry, with isolated surfaces and state', async () => {
    const TaskList = defineGenUIComponent({
      schema: z.object({ items: z.array(z.string()) }),
      component: ({ props }) => (
        <ul data-testid="tasks">
          {props.items.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ),
    });
    const taskOnly = createGenUI({ components: { TaskList } });
    const taskSurface = {
      version: 1,
      eventId: 'e1',
      surfaceId: 'shared-id',
      operations: [
        {
          op: 'createSurface',
          source: { agentId: 'agent-2' },
          spec: { root: 'root', elements: { root: { type: 'TaskList', props: { items: ['ship'] } } } },
        },
      ],
    };
    server.use(
      http.post(STREAM_URL, () => sseResponse([chunk('start'), genUIChunk(taskSurface), finish('stop')])),
      http.post(`${TEST_BASE_URL}/api/agents/agent-2/stream`, () =>
        sseResponse([chunk('start'), genUIChunk(taskSurface), finish('stop')]),
      ),
    );
    renderWithProviders(
      <>
        <GenUIChat genUI={weatherOnly} />
        <GenUIChat genUI={taskOnly} agentId="agent-2" />
      </>,
    );
    await send('tasks?', 'agent-1');
    await send('tasks?', 'agent-2');

    const second = screen.getByTestId('chat-agent-2');
    await waitFor(() => expect(within(second).getByTestId('tasks').textContent).toBe('ship'));
    const first = screen.getByTestId('chat-agent-1');
    await waitFor(() => expect(within(first).getByRole('note').textContent).toMatch(/TaskList/));
    expect(within(first).queryByTestId('tasks')).toBeNull();

    expect(chats['agent-2']!.genUI.controller.getState().surfaces['shared-id']!.source).toEqual({ agentId: 'agent-2' });
    chats['agent-1']!.genUI.controller.state.set({ kind: 'surface', id: 'shared-id' }, { picked: 1 });
    expect(chats['agent-2']!.genUI.controller.state.get({ kind: 'surface', id: 'shared-id' }).value).toEqual({});
  });
});
