// @vitest-environment jsdom
import { useBoundProp } from '@json-render/react';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
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
  createGenUIController,
  defineGenUIChatAction,
  defineGenUIComponent,
  defineGenUIToolRenderer,
  GenUIProvider,
  GenUISurfaceOutlet,
  useGenUIChat,
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
  outlet,
}: {
  genUI: GenUIRegistry;
  actions?: Record<string, GenUIChatActionHandler<any>>;
  initialMessages?: MastraDBMessage[];
  outlet?: boolean;
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
      {outlet && (
        <div data-testid="panel">
          <GenUISurfaceOutlet controller={chat.genUI.controller} placement="panel" />
        </div>
      )}
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
              spec: { root: 'card', elements: { card: { type: 'WeatherCard', props: { city: 'Paris', temp: 21 } } } },
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
          operations: [{ op: 'patch', patches: [{ op: 'replace', path: '/elements/card/props/temp', value: 23 }] }],
        }),
        // A replayed event (reconnect) must not apply twice or add a second surface.
        genUIChunk({
          version: 1,
          eventId: 'e2',
          surfaceId: 'weather',
          operations: [{ op: 'patch', patches: [{ op: 'replace', path: '/elements/card/props/temp', value: 99 }] }],
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

  it('shows a surface as failed when the tool that was building it throws', async () => {
    const stream = controllableStream();
    server.use(http.post(STREAM_URL, () => stream.response()));
    renderWithProviders(<GenUIChat genUI={createGenUI({ components: { WeatherCard } })} />);

    await send('Weather in Paris?');
    act(() =>
      stream.push(
        chunk('start'),
        chunk('tool-call', { toolCallId: 'c1', toolName: 'weatherReport', args: { city: 'Paris' } }),
        genUIChunk({
          version: 1,
          eventId: 'e1',
          surfaceId: 'weather',
          operations: [
            {
              op: 'createSurface',
              source: { toolCallId: 'c1' },
              spec: { root: 'card', elements: { card: { type: 'WeatherCard', props: { city: 'Paris', temp: 0 } } } },
            },
          ],
        }),
      ),
    );
    await screen.findByTestId('weather');
    expect(screen.queryByRole('alert')).toBeNull();

    act(() =>
      stream.push(
        chunk('tool-error', { toolCallId: 'c1', toolName: 'weatherReport', error: 'Weather service unavailable' }),
        finish('stop'),
      ),
    );
    stream.close();

    await waitFor(() => expect(current.isRunning).toBe(false));
    expect(current.genUI.controller.getSurfaceStatus('weather')).toBe('failed');
    expect(current.genUI.controller.getSurfaceError('weather')).toBe('Weather service unavailable');
    expect(screen.getByRole('alert').textContent).toContain('Weather service unavailable');
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
                spec: {
                  root: 'root',
                  elements: { root: { type: 'WeatherCard', props: { city: 'Oslo', temp: 'cold' }, children: [] } },
                },
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
                spec: { root: 'x', elements: { x: { type: 'Script', props: { html: '<img onerror=alert(1)>' } } } },
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

  it('refuses a surface tool with no components the model can compose', () => {
    const Custom = defineGenUIComponent({
      schema: z.object({}),
      declarative: false,
      component: () => null,
    });
    expect(() => createGenUI({ surfaceTool: true })).toThrow(/surface tool/);
    expect(() => createGenUI({ components: { Custom }, surfaceTool: true })).toThrow(/surface tool/);
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

  it('treats the nulls strict-mode models send for optional fields as omitted', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        if (bodies.length === 1) {
          return sseResponse([
            chunk('start'),
            chunk('tool-call', { toolCallId: 'c1', toolName: 'ui_Product', args: { name: 'Lamp', tagline: null } }),
            chunk('tool-result', { toolCallId: 'c1', toolName: 'ui_Product', result: { acknowledged: true } }),
            chunk('tool-call', { toolCallId: 'c2', toolName: 'search', args: { query: 'lamps', limit: null } }),
            chunk('tool-result', { toolCallId: 'c2', toolName: 'search', result: { hits: 3 } }),
            chunk('tool-call', { toolCallId: 'c3', toolName: 'ui_Pick', args: { label: 'Colour', hint: null } }),
            finish('tool-calls'),
          ]);
        }
        return sseResponse([finish('stop')]);
      }),
    );
    const Product = defineGenUIComponent({
      schema: z.object({ name: z.string(), tagline: z.string().optional() }),
      tool: true,
      component: ({ props }) => <p data-testid="product">{props.tagline ?? `${props.name} (no tagline)`}</p>,
    });
    const Pick = defineGenUIComponent({
      schema: z.object({ label: z.string(), hint: z.string().optional() }),
      tool: { mode: 'interactive', responseSchema: z.object({ choice: z.string() }) },
      component: ({ props }) => {
        const { canRespond, respond } = useGenUIToolResponse();
        return (
          <button disabled={!canRespond} onClick={() => void respond({ choice: 'oak' })}>
            Pick {props.label}
          </button>
        );
      },
    });
    const search = defineGenUIToolRenderer({
      argsSchema: z.object({ query: z.string(), limit: z.number().optional() }),
      component: ({ args, validationError }) => (
        <p data-testid="search">{validationError ?? `${args?.query} limit=${String(args?.limit)}`}</p>
      ),
    });
    renderWithProviders(<GenUIChat genUI={createGenUI({ components: { Product, Pick }, tools: { search } })} />);
    await send('Show me a lamp');

    expect((await screen.findByTestId('product')).textContent).toBe('Lamp (no tagline)');
    expect((await screen.findByTestId('search')).textContent).toBe('lamps limit=undefined');
    const pick = await screen.findByRole('button', { name: 'Pick Colour' });
    await waitFor(() => expect((pick as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(pick);
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(JSON.stringify(bodies[1])).toContain('"choice":"oak"');
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

  it('an interactive call left unanswered by a reload cannot be answered and does not block the next message', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return sseResponse([
          chunk('text-start', { id: 't1' }),
          chunk('text-delta', { id: 't1', text: 'Which hotel then?' }),
          chunk('text-end', { id: 't1' }),
          finish('stop'),
        ]);
      }),
    );
    let respond: ((value: unknown) => Promise<{ ok: boolean }>) | undefined;
    const ConfirmBooking = defineGenUIComponent({
      description: 'Ask the user to confirm a booking',
      schema: z.object({ hotel: z.string() }),
      tool: { mode: 'interactive', responseSchema: z.object({ confirmed: z.boolean() }) },
      component: ({ props }) => {
        const response = useGenUIToolResponse();
        respond = response.respond;
        return <button disabled={!response.canRespond}>Confirm {props.hotel}</button>;
      },
    });
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
                state: 'call',
                toolCallId: 'c1',
                toolName: 'ui_ConfirmBooking',
                args: { hotel: 'Ritz' },
              },
            },
          ],
        },
      },
    ];
    renderWithProviders(
      <GenUIChat genUI={createGenUI({ components: { ConfirmBooking } })} initialMessages={history} />,
    );

    const button = screen.getByRole('button', { name: 'Confirm Ritz' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(current.isRunning).toBe(false);
    expect((await respond!({ confirmed: true })).ok).toBe(false);
    expect(bodies).toHaveLength(0);

    await send('Actually, not the Ritz');
    expect(await screen.findByText('Which hotel then?')).toBeTruthy();
    expect(bodies).toHaveLength(1);
    expect(JSON.stringify(bodies[0]!.messages)).not.toContain('confirmed');
  });
});

describe('useGenUIChat — surface tool', () => {
  const surfaceArgs = {
    surfaceId: 'weather',
    root: 'card',
    elements: [{ id: 'card', type: 'WeatherCard', props: { city: 'Rome', temp: 30 } }],
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
    // Prop schemas are advertised once, in the input schema, not repeated in the description.
    expect(tool.description).not.toContain('propsSchema');
    expect(JSON.stringify(tool)).toContain('"temp"');
    expect(JSON.stringify(bodies[1]!.messages)).toContain('"ok":true');
    expect(document.querySelector('[data-genui-surface="weather"]')?.getAttribute('data-genui-status')).toBe('ready');
  });

  it('shows a surface element by element while the model is still writing it, without remounting once it completes', async () => {
    weatherMounts = 0;
    const List = defineGenUIComponent({
      description: 'A vertical list',
      schema: z.object({}),
      component: ({ children }) => <div data-testid="list">{children}</div>,
    });
    const args = {
      surfaceId: 'cities',
      elements: [
        { id: 'list', type: 'List', props: {}, children: ['rome', 'oslo'] },
        { id: 'rome', type: 'WeatherCard', props: { city: 'Rome', temp: 30 } },
        { id: 'oslo', type: 'WeatherCard', props: { city: 'Oslo', temp: 4 } },
      ],
      // Models often send the root last, as here.
      root: 'list',
    };
    const text = JSON.stringify(args);
    // Stop in the middle of the last element's type.
    const cut = text.indexOf('Wea', text.indexOf('"id":"oslo"')) + 3;
    const stream = controllableStream();
    let requests = 0;
    server.use(
      http.post(STREAM_URL, () => {
        requests++;
        if (requests === 1) return stream.response();
        return sseResponse([
          chunk('text-start', { id: 't2' }),
          chunk('text-delta', { id: 't2', text: 'Done.' }),
          chunk('text-end', { id: 't2' }),
          finish('stop'),
        ]);
      }),
    );
    renderWithProviders(<GenUIChat genUI={createGenUI({ components: { WeatherCard, List }, surfaceTool: true })} />);
    await send('Weather in Rome and Oslo?');

    act(() =>
      stream.push(
        chunk('start'),
        chunk('tool-call-input-streaming-start', { toolCallId: 'c1', toolName: 'ui_surface' }),
        chunk('tool-call-delta', { toolCallId: 'c1', argsTextDelta: text.slice(0, cut) }),
      ),
    );
    await waitFor(() => expect(screen.getAllByTestId('weather').map(node => node.textContent)).toEqual(['Rome: 30°']));
    const surface = () => document.querySelector('[data-genui-surface="cities"]');
    expect(surface()?.getAttribute('data-genui-status')).toBe('streaming');
    expect(document.querySelector('[data-genui-fallback]')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();

    act(() =>
      stream.push(
        chunk('tool-call-delta', { toolCallId: 'c1', argsTextDelta: text.slice(cut) }),
        chunk('tool-call-input-streaming-end', { toolCallId: 'c1' }),
        chunk('tool-call', { toolCallId: 'c1', toolName: 'ui_surface', args }),
        finish('tool-calls'),
      ),
    );
    stream.close();
    expect(await screen.findByText('Done.')).toBeTruthy();
    expect(screen.getAllByTestId('weather').map(node => node.textContent)).toEqual(['Rome: 30°', 'Oslo: 4°']);
    expect(surface()?.getAttribute('data-genui-status')).toBe('ready');
    expect(weatherMounts).toBe(2);
  });

  type Schema = {
    type?: string;
    properties?: Record<string, Schema>;
    items?: Schema;
    anyOf?: Schema[];
    enum?: unknown[];
  };
  // Strict structured outputs close every object: undeclared keys never reach the browser and
  // every declared key is sent, as null when the model has nothing to say.
  const asStrictModelSends = (schema: Schema, value: unknown): unknown => {
    if (schema.anyOf) {
      const branch =
        schema.anyOf.find(b =>
          Object.entries(b.properties ?? {}).some(
            ([k, p]) => p.enum?.length === 1 && (value as Record<string, unknown>)?.[k] === p.enum[0],
          ),
        ) ??
        schema.anyOf.find(
          b =>
            b.type === 'object' &&
            !!value &&
            typeof value === 'object' &&
            Object.keys(value).every(k => k in (b.properties ?? {})),
        ) ??
        schema.anyOf.find(b => b.type === (Array.isArray(value) ? 'array' : typeof value));
      return branch ? asStrictModelSends(branch, value) : null;
    }
    if (Array.isArray(value)) return value.map(v => asStrictModelSends(schema.items ?? {}, v));
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(schema.properties ?? {}).map(([k, s]) => [
          k,
          record[k] === undefined ? null : asStrictModelSends(s, record[k]),
        ]),
      );
    }
    return value;
  };

  it('a strict-mode model can build a surface from the advertised schema alone', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        if (bodies.length === 1) {
          const tools = bodies[0]!.clientTools as Record<string, { inputSchema: Schema }>;
          const args = asStrictModelSends(tools.ui_surface!.inputSchema, {
            placement: 'inline',
            root: 'card',
            elements: [{ id: 'card', type: 'WeatherCard', props: { city: 'Rome', temp: 30 } }],
          });
          return sseResponse([
            chunk('start'),
            chunk('tool-call', { toolCallId: 'c1', toolName: 'ui_surface', args }),
            finish('tool-calls'),
          ]);
        }
        return sseResponse([finish('stop')]);
      }),
    );
    renderWithProviders(<GenUIChat genUI={createGenUI({ components: { WeatherCard }, surfaceTool: true })} />);
    await send('Weather in Rome?');

    expect((await screen.findByTestId('weather')).textContent).toBe('Rome: 30°');
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(JSON.stringify(bodies[1]!.messages)).toContain('"ok":true');
  });

  // Strict mode closed the open `on` and `state` objects to `{}`, so a model-composed button
  // arrived with `on: null` and did nothing when pressed, and bound props read empty state.
  it('a strict-mode model can bind state and events from the advertised schema alone', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        if (bodies.length === 1) {
          const tools = bodies[0]!.clientTools as Record<string, { inputSchema: Schema }>;
          const args = asStrictModelSends(tools.ui_surface!.inputSchema, {
            root: 'stack',
            state: JSON.stringify({ city: 'Rome' }),
            elements: [
              { id: 'stack', type: 'Stack', props: {}, children: ['card', 'more'] },
              { id: 'card', type: 'WeatherCard', props: { city: { $state: '/city' }, temp: 30 } },
              {
                id: 'more',
                type: 'FollowUp',
                props: { label: 'Paris instead' },
                on: [{ event: 'press', action: 'ask', params: JSON.stringify({ prompt: 'Weather in Paris?' }) }],
              },
            ],
          });
          return sseResponse([
            chunk('start'),
            chunk('tool-call', { toolCallId: 'c1', toolName: 'ui_surface', args }),
            finish('tool-calls'),
          ]);
        }
        return sseResponse([finish('stop')]);
      }),
    );
    const Stack = defineGenUIComponent({
      schema: z.object({}),
      component: ({ children }) => <div>{children}</div>,
    });
    const FollowUp = defineGenUIComponent({
      schema: z.object({ label: z.string() }),
      events: ['press'],
      component: ({ props, emit }) => (
        <button type="button" onClick={() => emit('press')}>
          {props.label}
        </button>
      ),
    });
    const asked: string[] = [];
    function App() {
      const chat = useGenUIChat({
        agentId: 'agent-1',
        threadId: 'thread-1',
        genUI: createGenUI({ components: { Stack, WeatherCard, FollowUp }, surfaceTool: true }),
        actions: {
          ask: {
            schema: z.object({ prompt: z.string() }),
            handle: ({ prompt }: { prompt: string }) => void asked.push(prompt),
          },
        },
      });
      current = chat;
      return (
        <>
          {chat.messages.map(message => (
            <MessageFactory key={message.id} message={message} {...chat.genUI.renderers} />
          ))}
        </>
      );
    }
    renderWithProviders(<App />);
    await send('Weather in Rome?');

    expect((await screen.findByTestId('weather')).textContent).toBe('Rome: 30°');
    await waitFor(() => expect(JSON.stringify(bodies[1]?.messages)).toContain('"ok":true'));
    fireEvent.click(screen.getByRole('button', { name: 'Paris instead' }));
    await waitFor(() => expect(asked).toEqual(['Weather in Paris?']));
  });

  // A model asked for a big layout picked `standalone`; with no outlet for it the surface was
  // accepted with ok:true and shown nowhere.
  it('only lets the model place a surface where the app renders it', async () => {
    const bodies: Record<string, unknown>[] = [];
    const surfaceCall = (toolCallId: string, placement: string, city: string) => [
      chunk('start'),
      chunk('tool-call', {
        toolCallId,
        toolName: 'ui_surface',
        args: {
          surfaceId: `weather-${city}`,
          placement,
          root: 'card',
          elements: [{ id: 'card', type: 'WeatherCard', props: { city, temp: 20 } }],
        },
      }),
      finish('tool-calls'),
    ];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        if (bodies.length === 1) return sseResponse(surfaceCall('c1', 'standalone', 'Oslo'));
        if (bodies.length === 2) return sseResponse(surfaceCall('c2', 'panel', 'Rome'));
        return sseResponse([finish('stop')]);
      }),
    );
    const genUI = createGenUI({ components: { WeatherCard }, surfaceTool: { placements: ['inline', 'panel'] } });
    renderWithProviders(<GenUIChat genUI={genUI} outlet />);
    await send('Weather?');

    const tools = bodies[0]!.clientTools as Record<string, { inputSchema: unknown; description: string }>;
    const createSurface = JSON.stringify(tools.ui_surface!.inputSchema).match(/"placement":\{[^}]*\}/)?.[0];
    expect(createSurface).toContain('["inline","panel"]');
    expect(tools.ui_surface!.description).not.toContain('standalone');

    await waitFor(() => expect(bodies).toHaveLength(3));
    expect(JSON.stringify(bodies[1]!.messages)).toMatch(
      /placement \\"standalone\\" is not available[^"]*inline, panel/,
    );
    expect(JSON.stringify(bodies[2]!.messages)).toContain('"ok":true,"surfaceId":"weather-Rome"');
    expect((await screen.findByTestId('weather')).textContent).toBe('Rome: 20°');
    expect(within(screen.getByTestId('panel')).getByTestId('weather')).toBeTruthy();
    expect(screen.queryByText('Oslo: 20°')).toBeNull();
  });

  it('offers only inline surfaces when the app declares no other placements', async () => {
    const genUI = createGenUI({ components: { WeatherCard }, surfaceTool: true });
    const controller = createGenUIController({ registry: genUI });
    const schema = JSON.stringify((controller.clientTools.ui_surface as { inputSchema: unknown }).inputSchema);
    expect(schema.match(/"placement":\{[^}]*\}/)?.[0]).toContain('"enum":["inline"]');
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
              root: 'n',
              elements: [{ id: 'n', type: 'Script', props: { html: '<b>' } }],
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

  it('a later surface tool call with the same surface id replaces the surface in place on reload', () => {
    const call = (toolCallId: string, args: object) => ({
      type: 'tool-invocation' as const,
      toolInvocation: {
        state: 'result' as const,
        toolCallId,
        toolName: 'ui_surface',
        args,
        result: { ok: true, surfaceId: 'weather' },
      },
    });
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
            call('c1', surfaceArgs),
            call('c2', {
              ...surfaceArgs,
              elements: [{ ...surfaceArgs.elements[0]!, props: { city: 'Rome', temp: 12 } }],
            }),
          ],
        },
      },
    ];
    renderWithProviders(
      <GenUIChat genUI={createGenUI({ components: { WeatherCard }, surfaceTool: true })} initialMessages={history} />,
    );
    expect(screen.getAllByTestId('weather').map(node => node.textContent)).toEqual(['Rome: 12°']);
    expect(document.querySelectorAll('[data-genui-surface="weather"]')).toHaveLength(1);
  });
});

describe('useGenUIChat — actions and context', () => {
  it('a spec-bound action reaches the agent once; edits to bound state send nothing', async () => {
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
            operations: [
              {
                op: 'createSurface',
                spec: {
                  root: 'form',
                  state: { city: '' },
                  elements: {
                    form: {
                      type: 'CityFilter',
                      props: { value: { $bindState: '/city' } },
                      on: { submit: { action: 'applyFilter', params: { city: { $state: '/city' } } } },
                    },
                  },
                },
              },
            ],
          }),
          finish('stop'),
        ]);
      }),
    );
    const CityFilter = defineGenUIComponent({
      schema: z.object({ value: z.string() }),
      events: ['submit'],
      component: ({ props, bindings, emit }) => {
        const [city, setCity] = useBoundProp(props.value, bindings?.value);
        return (
          <form
            onSubmit={event => {
              event.preventDefault();
              emit('submit');
            }}
          >
            <label>
              City
              <input value={city} onChange={event => setCity(event.target.value)} />
            </label>
            <button type="submit">Apply</button>
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
    // An empty city fails the action schema, so nothing is sent.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    });

    fireEvent.change(input, { target: { value: 'Lyon' } });
    expect((input as HTMLInputElement).value).toBe('Lyon');
    expect(bodies).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(JSON.stringify(bodies[1]!.messages)).toContain('Filter by Lyon');
  });

  it('actions and renderers defined inline see the app state of the latest render', async () => {
    server.use(
      http.post(STREAM_URL, () =>
        sseResponse([
          chunk('start'),
          chunk('text-start', { id: 't1' }),
          chunk('text-delta', { id: 't1', text: 'Pick a plan' }),
          chunk('text-end', { id: 't1' }),
          genUIChunk({
            version: 1,
            eventId: 'p1',
            surfaceId: 'plans',
            operations: [
              {
                op: 'createSurface',
                spec: {
                  root: 'pick',
                  elements: { pick: { type: 'PlanPicker', props: {}, on: { press: { action: 'choose' } } } },
                },
              },
            ],
          }),
          finish('stop'),
        ]),
      ),
    );
    const PlanPicker = defineGenUIComponent({
      schema: z.object({}),
      component: ({ emit }) => (
        <button type="button" onClick={() => emit('press')}>
          Choose
        </button>
      ),
    });
    const registry = createGenUI({ components: { PlanPicker } });
    const chosen: string[] = [];
    function App({ currency }: { currency: string }) {
      const chat = useGenUIChat({
        agentId: 'agent-1',
        threadId: 'thread-1',
        genUI: registry,
        actions: { choose: { handle: () => void chosen.push(currency) } },
        renderers: { Text: part => <span>{`${currency}: ${part.text}`}</span> },
      });
      current = chat;
      return (
        <>
          {chat.messages.map(message => (
            <MessageFactory key={message.id} message={message} {...chat.genUI.renderers} />
          ))}
        </>
      );
    }
    const view = renderWithProviders(<App currency="EUR" />);
    await send('show plans');
    expect(await screen.findByText('EUR: Pick a plan')).toBeTruthy();

    view.rerender(<App currency="USD" />);
    expect(await screen.findByText('USD: Pick a plan')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    await waitFor(() => expect(chosen).toEqual(['USD']));
  });

  it('streaming a new answer does not re-render earlier messages', async () => {
    const stream = controllableStream();
    server.use(http.post(STREAM_URL, () => stream.response()));
    const renders: Record<string, number> = {};
    const renderers = {
      Text: (part: { text: string }) => {
        renders[part.text] = (renders[part.text] ?? 0) + 1;
        return <span>{part.text}</span>;
      },
    };
    const history: MastraDBMessage[] = [
      {
        id: 'm1',
        role: 'assistant',
        createdAt: new Date(0),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: { format: 2, parts: [{ type: 'text', text: 'Earlier answer' }] },
      },
    ];
    function App() {
      const chat = useGenUIChat({
        agentId: 'agent-1',
        threadId: 'thread-1',
        genUI: createGenUI({ components: { WeatherCard } }),
        initialMessages: history,
        renderers,
      });
      current = chat;
      return (
        <>
          {chat.messages.map(message => (
            <MessageFactory key={message.id} message={message} {...chat.genUI.renderers} />
          ))}
        </>
      );
    }
    renderWithProviders(<App />);
    expect(screen.getByText('Earlier answer')).toBeTruthy();
    const before = renders['Earlier answer'];

    await send('Tell me more');
    act(() => stream.push(chunk('start'), chunk('text-start', { id: 't1' })));
    for (const word of ['One', ' two', ' three', ' four']) {
      act(() => stream.push(chunk('text-delta', { id: 't1', text: word })));
    }
    expect(await screen.findByText('One two three four')).toBeTruthy();
    act(() => {
      stream.push(chunk('text-end', { id: 't1' }), finish('stop'));
      stream.close();
    });
    await waitFor(() => expect(current.isRunning).toBe(false));

    expect(renders['Earlier answer']).toBe(before);
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
