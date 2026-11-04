// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { useChat } from '../../agent/hooks';
import { server } from '../../test/msw-server';
import { renderWithProviders } from '../../test/render';
import { MessageFactory } from '../../ui/MessageFactory';
import type { GenUIChatActionHandler } from '../controller';
import {
  createGenUI,
  defineGenUIChatAction,
  defineGenUIComponent,
  defineGenUIToolRenderer,
  GenUIProvider,
  useGenUIAction,
  useGenUIChat,
  useGenUILocalState,
  useGenUIPublishedContext,
  useGenUIToolResponse,
} from '../index';
import type { GenUIRegistry } from '../index';
import { chunk, controllableStream, finish, genUIChunk, sseResponse, STREAM_URL } from './sse';

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

type Chat = ReturnType<typeof useGenUIChat>;
let current: Chat;

function GenUIChat({
  genUI,
  actions,
  initialMessages,
}: {
  genUI: GenUIRegistry;
  actions?: Record<string, GenUIChatActionHandler<any>>;
  initialMessages?: MastraDBMessage[];
}) {
  const chat = useGenUIChat({
    agentId: 'agent-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    genUI,
    actions,
    initialMessages,
  });
  current = chat;
  return (
    <div data-testid="genui-chat">
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

const send = async (message: string) => {
  await act(async () => {
    void current.sendMessage({ message, threadId: 'thread-1' });
  });
};

afterEach(() => {
  cleanup();
});

describe('useGenUIChat — declarative surfaces from the native stream', () => {
  it('renders a surface the agent streams as data-gen-ui chunks and updates it without remounting', async () => {
    weatherMounts = 0;
    const stream = controllableStream();
    server.use(http.post(STREAM_URL, () => stream.response()));
    renderWithProviders(<GenUIChat genUI={createGenUI({ components: { WeatherCard } })} />);

    await send('Weather in Paris?');
    act(() =>
      stream.push(
        chunk('start'),
        genUIChunk({
          version: 1,
          eventId: 'e1',
          surfaceId: 'weather',
          operations: [
            {
              op: 'createSurface',
              nodes: [{ id: 'card', component: 'WeatherCard', props: { city: 'Paris', temp: 21 } }],
            },
          ],
        }),
      ),
    );
    expect((await screen.findByTestId('weather')).textContent).toContain('Paris: 21°');

    act(() =>
      stream.push(
        genUIChunk({
          version: 1,
          eventId: 'e2',
          surfaceId: 'weather',
          operations: [{ op: 'updateProps', nodeId: 'card', set: { temp: 23 } }],
        }),
        // A replayed event (reconnect) must not apply twice or add a second surface.
        genUIChunk({
          version: 1,
          eventId: 'e2',
          surfaceId: 'weather',
          operations: [{ op: 'updateProps', nodeId: 'card', set: { temp: 99 } }],
        }),
        chunk('text-start', { id: 't1' }),
        chunk('text-delta', { id: 't1', text: 'Here you go.' }),
        chunk('text-end', { id: 't1' }),
        finish('stop'),
      ),
    );
    stream.close();

    await waitFor(() => expect(screen.getByTestId('weather').textContent).toContain('Paris: 23°'));
    expect(screen.getAllByTestId('weather')).toHaveLength(1);
    expect(screen.getByText('Here you go.')).toBeTruthy();
    expect(weatherMounts).toBe(1);
  });

  it('shows a fallback instead of executing anything for unknown components or invalid props', async () => {
    server.use(
      http.post(STREAM_URL, () =>
        sseResponse([
          chunk('start'),
          genUIChunk({
            version: 1,
            eventId: 'e1',
            surfaceId: 's',
            operations: [
              {
                op: 'createSurface',
                rootId: 'root',
                nodes: [{ id: 'root', component: 'WeatherCard', props: { city: 'Oslo', temp: 'cold' }, children: [] }],
              },
              { op: 'setStatus', status: 'ready' },
            ],
          }),
          genUIChunk({
            version: 1,
            eventId: 'e2',
            surfaceId: 'other',
            operations: [
              {
                op: 'createSurface',
                nodes: [{ id: 'x', component: 'Script', props: { html: '<img onerror=alert(1)>' } }],
              },
              { op: 'setStatus', status: 'ready' },
            ],
          }),
          finish('stop'),
        ]),
      ),
    );
    renderWithProviders(<GenUIChat genUI={createGenUI({ components: { WeatherCard } })} />);
    await send('go');

    expect(await screen.findByText(/"WeatherCard" received invalid data/)).toBeTruthy();
    expect(await screen.findByText(/Script/)).toBeTruthy();
    expect(document.querySelector('img')).toBeNull();
  });
});

describe('useGenUIChat — opt-in', () => {
  it('a plain useChat next to a GenUI chat sends no GenUI tools and keeps its messages untouched', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return sseResponse([
          chunk('start'),
          genUIChunk({
            version: 1,
            eventId: `e${bodies.length}`,
            surfaceId: 's',
            operations: [{ op: 'createSurface' }],
          }),
          finish('stop'),
        ]);
      }),
    );
    let plain!: ReturnType<typeof useChat>;
    function PlainChat() {
      plain = useChat({ agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' });
      return null;
    }
    const registry = createGenUI({ components: { WeatherCard: { ...WeatherCard, tool: true } } });
    renderWithProviders(
      <>
        <PlainChat />
        <GenUIChat genUI={registry} />
      </>,
    );

    await act(async () => {
      await plain.sendMessage({ message: 'plain', threadId: 'thread-1' });
    });
    await send('genui');
    await waitFor(() => expect(bodies).toHaveLength(2));

    expect(bodies[0]!.clientTools).toBeUndefined();
    expect(Object.keys(bodies[1]!.clientTools as object)).toEqual(['ui_WeatherCard']);
    // The plain chat still receives the raw data part exactly as before.
    await waitFor(() =>
      expect(plain.messages.at(-1)?.content.parts).toContainEqual(expect.objectContaining({ type: 'data-gen-ui' })),
    );
  });

  it('refuses a client tool that collides with a GenUI frontend tool', () => {
    function Colliding() {
      useGenUIChat({
        agentId: 'agent-1',
        genUI: createGenUI({ components: { WeatherCard: { ...WeatherCard, tool: true } } }),
        clientTools: { ui_WeatherCard: { id: 'ui_WeatherCard', description: 'mine' } },
      });
      return null;
    }
    expect(() => renderWithProviders(<Colliding />)).toThrow(/collides with a GenUI frontend tool/);
  });
});

describe('useGenUIChat — tool UI', () => {
  it('renders a backend tool with progressively streamed arguments, then its validated output', async () => {
    const stream = controllableStream();
    server.use(http.post(STREAM_URL, () => stream.response()));
    const getWeather = defineGenUIToolRenderer({
      argsSchema: z.object({ city: z.string() }),
      outputSchema: z.object({ temp: z.number() }),
      component: ({ phase, partialArgs, output }) => (
        <div data-testid="tool" data-phase={phase}>
          {String((partialArgs as { city?: string }).city ?? '')}
          {output ? ` → ${output.temp}°` : ''}
        </div>
      ),
    });
    renderWithProviders(<GenUIChat genUI={createGenUI({ tools: { getWeather } })} />);
    await send('weather?');

    act(() =>
      stream.push(
        chunk('start'),
        chunk('tool-call-input-streaming-start', { toolCallId: 'c1', toolName: 'getWeather' }),
        chunk('tool-call-delta', { toolCallId: 'c1', argsTextDelta: '{"city":"Par' }),
      ),
    );
    await waitFor(() => expect(screen.getByTestId('tool').textContent).toContain('Par'));
    expect(screen.getByTestId('tool').getAttribute('data-phase')).toBe('input-streaming');

    act(() =>
      stream.push(
        chunk('tool-call-delta', { toolCallId: 'c1', argsTextDelta: 'is"}' }),
        chunk('tool-call-input-streaming-end', { toolCallId: 'c1' }),
        chunk('tool-call', { toolCallId: 'c1', toolName: 'getWeather', args: { city: 'Paris' } }),
        chunk('tool-result', { toolCallId: 'c1', toolName: 'getWeather', result: { temp: 19 } }),
        finish('stop'),
      ),
    );
    stream.close();
    await waitFor(() => expect(screen.getByTestId('tool').textContent).toContain('Paris → 19°'));
    expect(screen.getByTestId('tool').getAttribute('data-phase')).toBe('output-available');
  });

  it('a display frontend tool renders from its arguments and is acknowledged by the server, not the browser', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return sseResponse([
          chunk('start'),
          chunk('tool-call', { toolCallId: 'c1', toolName: 'ui_WeatherCard', args: { city: 'Oslo', temp: 4 } }),
          chunk('tool-result', { toolCallId: 'c1', toolName: 'ui_WeatherCard', result: { acknowledged: true } }),
          chunk('text-start', { id: 't1' }),
          chunk('text-delta', { id: 't1', text: 'Shown.' }),
          chunk('text-end', { id: 't1' }),
          finish('stop'),
        ]);
      }),
    );
    renderWithProviders(
      <GenUIChat genUI={createGenUI({ components: { WeatherCard: { ...WeatherCard, tool: true } } })} />,
    );
    await send('Weather in Oslo?');

    expect((await screen.findByTestId('weather')).textContent).toBe('Oslo: 4°');
    expect(await screen.findByText('Shown.')).toBeTruthy();
    const tool = (bodies[0]!.clientTools as Record<string, Record<string, unknown>>).ui_WeatherCard!;
    expect(tool.renderOnly).toBe(true);
    expect(tool.inputSchema).toMatchObject({ properties: { city: { type: 'string' }, temp: { type: 'number' } } });
    expect(bodies).toHaveLength(1);
  });

  it('an interactive frontend tool waits for the user and sends their answer back to the agent', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        if (bodies.length === 1) {
          return sseResponse([
            chunk('start'),
            chunk('tool-call', { toolCallId: 'c1', toolName: 'ui_ConfirmBooking', args: { hotel: 'Ritz' } }),
            finish('tool-calls'),
          ]);
        }
        return sseResponse([
          chunk('text-start', { id: 't2' }),
          chunk('text-delta', { id: 't2', text: 'Booked.' }),
          chunk('text-end', { id: 't2' }),
          finish('stop'),
        ]);
      }),
    );
    const ConfirmBooking = defineGenUIComponent({
      description: 'Ask the user to confirm a booking',
      schema: z.object({ hotel: z.string() }),
      tool: { mode: 'interactive', responseSchema: z.object({ confirmed: z.boolean() }) },
      component: ({ props }) => {
        const { canRespond, respond } = useGenUIToolResponse();
        return (
          <button disabled={!canRespond} onClick={() => void respond({ confirmed: true })}>
            Confirm {props.hotel}
          </button>
        );
      },
    });
    renderWithProviders(<GenUIChat genUI={createGenUI({ components: { ConfirmBooking } })} />);
    await send('Book the Ritz');

    const button = await screen.findByRole('button', { name: 'Confirm Ritz' });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    expect(bodies).toHaveLength(1);
    fireEvent.click(button);

    expect(await screen.findByText('Booked.')).toBeTruthy();
    expect(JSON.stringify(bodies[1]!.messages)).toContain('"confirmed":true');
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(true));
  });
});

describe('useGenUIChat — surface tool', () => {
  const surfaceArgs = {
    surfaceId: 'weather',
    operations: [
      { op: 'createSurface', nodes: [{ id: 'card', component: 'WeatherCard', props: { city: 'Rome', temp: 30 } }] },
    ],
  };

  it('the model builds a surface through the surface tool and learns it was applied', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        if (bodies.length === 1) {
          return sseResponse([
            chunk('start'),
            chunk('tool-call', { toolCallId: 'c1', toolName: 'ui_surface', args: surfaceArgs }),
            finish('tool-calls'),
          ]);
        }
        return sseResponse([
          chunk('text-start', { id: 't2' }),
          chunk('text-delta', { id: 't2', text: 'Done.' }),
          chunk('text-end', { id: 't2' }),
          finish('stop'),
        ]);
      }),
    );
    renderWithProviders(<GenUIChat genUI={createGenUI({ components: { WeatherCard }, surfaceTool: true })} />);
    await send('Weather in Rome?');

    expect((await screen.findByTestId('weather')).textContent).toBe('Rome: 30°');
    expect(await screen.findByText('Done.')).toBeTruthy();
    const tool = (bodies[0]!.clientTools as Record<string, { description: string }>).ui_surface!;
    expect(tool.description).toContain('WeatherCard');
    expect(tool.description).toContain('Current weather for a city');
    expect(JSON.stringify(bodies[1]!.messages)).toContain('"ok":true');
    expect(document.querySelector('[data-genui-surface="weather"]')?.getAttribute('data-genui-status')).toBe('ready');
  });

  it('rejects a surface built from unregistered components, tells the model why, and accepts its retry', async () => {
    const bodies: Record<string, unknown>[] = [];
    const surfaceCall = (toolCallId: string, args: unknown) => [
      chunk('start'),
      chunk('tool-call', { toolCallId, toolName: 'ui_surface', args }),
      finish('tool-calls'),
    ];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        if (bodies.length === 1) {
          return sseResponse(
            surfaceCall('c1', {
              surfaceId: 'weather',
              operations: [{ op: 'createSurface', nodes: [{ id: 'n', component: 'Script', props: { html: '<b>' } }] }],
            }),
          );
        }
        // The model retries with the same surface id, as it naturally would.
        if (bodies.length === 2) return sseResponse(surfaceCall('c2', surfaceArgs));
        return sseResponse([finish('stop')]);
      }),
    );
    renderWithProviders(<GenUIChat genUI={createGenUI({ components: { WeatherCard }, surfaceTool: true })} />);
    await send('Do it');

    await waitFor(() => expect(bodies).toHaveLength(3));
    const rejection = JSON.stringify(bodies[1]!.messages);
    expect(rejection).toContain('"ok":false');
    expect(rejection).toContain('unknown component \\"Script\\"');
    expect(JSON.stringify(bodies[2]!.messages)).toContain('"ok":true');
    expect((await screen.findByTestId('weather')).textContent).toBe('Rome: 30°');
    expect(document.querySelectorAll('[data-genui-surface="weather"]')).toHaveLength(1);
    expect(document.querySelector('b')).toBeNull();
  });

  it('rebuilds a surface-tool surface from persisted history after a reload', () => {
    const history: MastraDBMessage[] = [
      {
        id: 'm1',
        role: 'assistant',
        createdAt: new Date(0),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'c1',
                toolName: 'ui_surface',
                args: surfaceArgs,
                result: { ok: true, surfaceId: 'weather' },
              },
            },
          ],
        },
      },
    ];
    renderWithProviders(
      <GenUIChat genUI={createGenUI({ components: { WeatherCard }, surfaceTool: true })} initialMessages={history} />,
    );
    expect(screen.getByTestId('weather').textContent).toBe('Rome: 30°');
  });
});

describe('useGenUIChat — actions and context', () => {
  it('an explicit action reaches the agent once; local state changes send nothing', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        if (bodies.length > 1) return sseResponse([chunk('start'), finish('stop')]);
        return sseResponse([
          chunk('start'),
          genUIChunk({
            version: 1,
            eventId: 'f1',
            surfaceId: 'filters',
            operations: [{ op: 'createSurface', nodes: [{ id: 'form', component: 'CityFilter', props: {} }] }],
          }),
          finish('stop'),
        ]);
      }),
    );
    const CityFilter = defineGenUIComponent({
      schema: z.object({}),
      component: () => {
        const local = useGenUILocalState();
        const apply = useGenUIAction('applyFilter');
        const city = typeof local.value.city === 'string' ? local.value.city : '';
        return (
          <form
            onSubmit={event => {
              event.preventDefault();
              void apply.dispatch({ city });
            }}
          >
            <label>
              City
              <input value={city} onChange={event => local.patch({ city: event.target.value })} />
            </label>
            <button type="submit" disabled={apply.isPending}>
              Apply
            </button>
            <output>{apply.status}</output>
          </form>
        );
      },
    });
    const applyFilter = defineGenUIChatAction({
      schema: z.object({ city: z.string().min(1) }),
      handle: async ({ city }, { chat }) => {
        await chat.sendMessage(`Filter by ${city}`);
      },
    });
    renderWithProviders(<GenUIChat genUI={createGenUI({ components: { CityFilter } })} actions={{ applyFilter }} />);
    await send('show filters');

    const input = await screen.findByLabelText('City');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByText('invalid')).toBeTruthy();

    fireEvent.change(input, { target: { value: 'Lyon' } });
    expect((input as HTMLInputElement).value).toBe('Lyon');
    expect(bodies).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByText('success')).toBeTruthy();
    expect(bodies).toHaveLength(2);
    expect(JSON.stringify(bodies[1]!.messages)).toContain('Filter by Lyon');
  });

  it('published app context travels with the next message only while the publisher is mounted', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return sseResponse([chunk('start'), finish('stop')]);
      }),
    );
    function Publisher({ page }: { page: string }) {
      useGenUIPublishedContext('currentPage', page, { description: 'Page the user is viewing' });
      return null;
    }
    function App({ show }: { show: boolean }) {
      const chat = useGenUIChat({ agentId: 'agent-1', genUI: registry });
      current = chat;
      return show ? (
        <GenUIProvider controller={chat.genUI.controller}>
          <Publisher page="invoices" />
        </GenUIProvider>
      ) : null;
    }
    const registry = createGenUI({});
    const view = renderWithProviders(<App show />);
    await send('hello');
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(JSON.stringify(bodies[0])).toContain('invoices');
    expect(JSON.stringify(bodies[0]!.messages)).not.toContain('invoices');

    view.rerender(<App show={false} />);
    await send('again');
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(JSON.stringify(bodies[1])).not.toContain('invoices');
  });
});
