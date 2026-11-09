// @vitest-environment jsdom
import { defineCatalog } from '@json-render/core';
import { useBoundProp } from '@json-render/react';
import type { BaseComponentProps } from '@json-render/react';
import { schema } from '@json-render/react/schema';
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
import {
  createGenUI,
  defineGenUIToolRenderer,
  GenUIProvider,
  useGenUIChat,
  useGenUIPublishedContext,
  useGenUIToolResponse,
} from '../index';
import type { CreateGenUIOptions, GenUIActionHandlers, GenUIRegistry } from '../index';
import { chunk, controllableStream, finish, sseResponse, STREAM_URL } from './sse';
import { asStrictModelSends } from './strict';
import type { Schema } from './strict';

const weatherCard = {
  description: 'Current weather for a city',
  props: z.object({ city: z.string(), temp: z.number() }),
};

let weatherMounts = 0;
function WeatherCard({ props }: BaseComponentProps<{ city: string; temp: number }>) {
  useEffect(() => {
    weatherMounts++;
  }, []);
  return (
    <p data-testid="weather">
      {props.city}: {props.temp}°
    </p>
  );
}

const weatherCatalog = defineCatalog(schema, { components: { WeatherCard: weatherCard }, actions: {} });
type WeatherOptions = Omit<CreateGenUIOptions<typeof weatherCatalog>, 'catalog' | 'components'>;
const weatherUI = (options: WeatherOptions = {}) =>
  createGenUI({ catalog: weatherCatalog, components: { WeatherCard }, ...options });

type Chat = ReturnType<typeof useGenUIChat>;
let current: Chat;

function GenUIChat({
  genUI,
  actions,
  initialMessages,
}: {
  genUI: GenUIRegistry<any>;
  actions?: GenUIActionHandlers<any>;
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

/** One streamed response in which the model calls the spec tool; the browser then answers it. */
const specCall = (toolCallId: string, args: unknown) => [
  chunk('start'),
  chunk('tool-call', { toolCallId, toolName: 'ui_spec', args }),
  finish('tool-calls'),
];

const specView = (toolCallId: string) => document.querySelector(`[data-genui-spec="${toolCallId}"]`);

const assistantWith = (parts: unknown[]): MastraDBMessage => ({
  id: 'm1',
  role: 'assistant',
  createdAt: new Date(0),
  threadId: 'thread-1',
  resourceId: 'resource-1',
  content: { format: 2, parts: parts as MastraDBMessage['content']['parts'] },
});

const specInvocation = (toolCallId: string, args: object, result?: unknown) => ({
  type: 'tool-invocation' as const,
  toolInvocation:
    result === undefined
      ? { state: 'call' as const, toolCallId, toolName: 'ui_spec', args }
      : { state: 'result' as const, toolCallId, toolName: 'ui_spec', args, result },
});

const weatherSpec = {
  root: 'card',
  elements: [{ id: 'card', type: 'WeatherCard', props: { city: 'Rome', temp: 30 } }],
};

afterEach(() => {
  cleanup();
});

describe('useGenUIChat — opt-in', () => {
  it('a plain useChat next to a GenUI chat sends no GenUI tools and keeps its messages untouched', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return sseResponse([
          chunk('start'),
          chunk('tool-call', {
            toolCallId: `c${bodies.length}`,
            toolName: 'ui_WeatherCard',
            args: { city: 'Oslo', temp: 4 },
          }),
          chunk('tool-result', { toolCallId: `c${bodies.length}`, toolName: 'ui_WeatherCard', result: { ok: true } }),
          finish('stop'),
        ]);
      }),
    );
    let plain!: ReturnType<typeof useChat>;
    function PlainChat() {
      plain = useChat({ agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' });
      return null;
    }
    const registry = weatherUI({ componentTools: { WeatherCard: true }, specTool: true });
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
    expect(Object.keys(bodies[1]!.clientTools as object).sort()).toEqual(['ui_WeatherCard', 'ui_spec', 'ui_spec_edit']);
    // The plain chat still receives the raw tool call exactly as before.
    await waitFor(() =>
      expect(plain.messages.at(-1)?.content.parts).toContainEqual(
        expect.objectContaining({
          type: 'tool-invocation',
          toolInvocation: expect.objectContaining({ toolName: 'ui_WeatherCard' }),
        }),
      ),
    );
  });

  it('refuses a spec tool with no components the model can compose', () => {
    const catalog = defineCatalog(schema, { components: { Custom: { props: z.object({}) } }, actions: {} });
    expect(() => createGenUI({ specTool: true })).toThrow(/spec tool/);
    expect(() =>
      createGenUI({
        catalog,
        components: { Custom: () => null },
        componentTools: { Custom: { declarative: false } },
        specTool: true,
      }),
    ).toThrow(/spec tool/);
  });

  it('refuses a client tool that collides with a GenUI frontend tool', () => {
    function Colliding() {
      useGenUIChat({
        agentId: 'agent-1',
        genUI: weatherUI({ componentTools: { WeatherCard: true } }),
        clientTools: { ui_WeatherCard: { id: 'ui_WeatherCard', description: 'mine' } },
      });
      return null;
    }
    expect(() => renderWithProviders(<Colliding />)).toThrow(/collides with a GenUI frontend tool/);
  });
});

describe('useGenUIChat — tool UI', () => {
  const bookingCatalog = defineCatalog(schema, {
    components: {
      ConfirmBooking: { description: 'Ask the user to confirm a booking', props: z.object({ hotel: z.string() }) },
    },
    actions: {},
  });
  const confirmBookingTool = { mode: 'interactive', responseSchema: z.object({ confirmed: z.boolean() }) } as const;

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
    renderWithProviders(<GenUIChat genUI={weatherUI({ componentTools: { WeatherCard: true } })} />);
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
    const catalog = defineCatalog(schema, {
      components: {
        Product: { props: z.object({ name: z.string(), tagline: z.string().optional() }) },
        Pick: { props: z.object({ label: z.string(), hint: z.string().optional() }) },
      },
      actions: {},
    });
    const search = defineGenUIToolRenderer({
      argsSchema: z.object({ query: z.string(), limit: z.number().optional() }),
      component: ({ args, validationError }) => (
        <p data-testid="search">{validationError ?? `${args?.query} limit=${String(args?.limit)}`}</p>
      ),
    });
    const genUI = createGenUI({
      catalog,
      components: {
        Product: ({ props }) => <p data-testid="product">{props.tagline ?? `${props.name} (no tagline)`}</p>,
        Pick: ({ props }) => {
          const { canRespond, respond } = useGenUIToolResponse();
          return (
            <button disabled={!canRespond} onClick={() => respond({ choice: 'oak' })}>
              Pick {props.label}
            </button>
          );
        },
      },
      componentTools: {
        Product: true,
        Pick: { mode: 'interactive', responseSchema: z.object({ choice: z.string() }) },
      },
      tools: { search },
    });
    renderWithProviders(<GenUIChat genUI={genUI} />);
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
    const genUI = createGenUI({
      catalog: bookingCatalog,
      components: {
        ConfirmBooking: ({ props }) => {
          const { canRespond, respond } = useGenUIToolResponse();
          return (
            <button disabled={!canRespond} onClick={() => respond({ confirmed: true })}>
              Confirm {props.hotel}
            </button>
          );
        },
      },
      componentTools: { ConfirmBooking: confirmBookingTool },
    });
    renderWithProviders(<GenUIChat genUI={genUI} />);
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
    let respond: ((value: unknown) => { ok: boolean }) | undefined;
    const genUI = createGenUI({
      catalog: bookingCatalog,
      components: {
        ConfirmBooking: ({ props }) => {
          const response = useGenUIToolResponse();
          respond = response.respond;
          return <button disabled={!response.canRespond}>Confirm {props.hotel}</button>;
        },
      },
      componentTools: { ConfirmBooking: confirmBookingTool },
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
    renderWithProviders(<GenUIChat genUI={genUI} initialMessages={history} />);

    const button = screen.getByRole('button', { name: 'Confirm Ritz' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(current.isRunning).toBe(false);
    expect(respond!({ confirmed: true }).ok).toBe(false);
    expect(bodies).toHaveLength(0);

    await send('Actually, not the Ritz');
    expect(await screen.findByText('Which hotel then?')).toBeTruthy();
    expect(bodies).toHaveLength(1);
    expect(JSON.stringify(bodies[0]!.messages)).not.toContain('confirmed');
  });
});

describe('useGenUIChat — spec tool', () => {
  it('the model renders an interface through the spec tool and learns it was accepted', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        if (bodies.length === 1) return sseResponse(specCall('c1', weatherSpec));
        return sseResponse([
          chunk('text-start', { id: 't2' }),
          chunk('text-delta', { id: 't2', text: 'Done.' }),
          chunk('text-end', { id: 't2' }),
          finish('stop'),
        ]);
      }),
    );
    renderWithProviders(<GenUIChat genUI={weatherUI({ specTool: true })} />);
    await send('Weather in Rome?');

    expect((await screen.findByTestId('weather')).textContent).toBe('Rome: 30°');
    expect(await screen.findByText('Done.')).toBeTruthy();
    const tool = (bodies[0]!.clientTools as Record<string, { description: string }>).ui_spec!;
    expect(tool.description).toContain('WeatherCard');
    expect(tool.description).toContain('Current weather for a city');
    // Prop schemas are advertised once, in the input schema, not repeated in the description.
    expect(tool.description).not.toContain('propsSchema');
    expect(JSON.stringify(tool)).toContain('"temp"');
    expect(JSON.stringify(bodies[1]!.messages)).toContain('"ok":true');
    expect(specView('c1')?.getAttribute('data-genui-status')).toBe('ready');
  });

  it('shows a spec element by element while the model is still writing it, without remounting once it completes', async () => {
    weatherMounts = 0;
    const catalog = defineCatalog(schema, {
      components: { WeatherCard: weatherCard, List: { description: 'A vertical list', props: z.object({}) } },
      actions: {},
    });
    const genUI = createGenUI({
      catalog,
      components: { WeatherCard, List: ({ children }) => <div data-testid="list">{children}</div> },
      specTool: true,
    });
    const args = {
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
    renderWithProviders(<GenUIChat genUI={genUI} />);
    await send('Weather in Rome and Oslo?');

    act(() =>
      stream.push(
        chunk('start'),
        chunk('tool-call-input-streaming-start', { toolCallId: 'c1', toolName: 'ui_spec' }),
        chunk('tool-call-delta', { toolCallId: 'c1', argsTextDelta: text.slice(0, cut) }),
      ),
    );
    await waitFor(() => expect(screen.getAllByTestId('weather').map(node => node.textContent)).toEqual(['Rome: 30°']));
    expect(specView('c1')?.getAttribute('data-genui-status')).toBe('streaming');
    expect(document.querySelector('[data-genui-fallback]')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();

    act(() =>
      stream.push(
        chunk('tool-call-delta', { toolCallId: 'c1', argsTextDelta: text.slice(cut) }),
        chunk('tool-call-input-streaming-end', { toolCallId: 'c1' }),
        chunk('tool-call', { toolCallId: 'c1', toolName: 'ui_spec', args }),
        finish('tool-calls'),
      ),
    );
    stream.close();
    expect(await screen.findByText('Done.')).toBeTruthy();
    expect(screen.getAllByTestId('weather').map(node => node.textContent)).toEqual(['Rome: 30°', 'Oslo: 4°']);
    expect(specView('c1')?.getAttribute('data-genui-status')).toBe('ready');
    expect(weatherMounts).toBe(2);
  });

  it('keeps what the user typed into bound state while the model is still writing the spec', async () => {
    const catalog = defineCatalog(schema, {
      components: {
        Stack: { props: z.object({}) },
        CityInput: { props: z.object({ value: z.string() }) },
        WeatherCard: weatherCard,
      },
      actions: {},
    });
    function CityInput({ props, bindings }: BaseComponentProps<{ value: string }>) {
      const [city, setCity] = useBoundProp(props.value, bindings?.value);
      return (
        <label>
          City
          <input value={city} onChange={event => setCity(event.target.value)} />
        </label>
      );
    }
    const genUI = createGenUI({
      catalog,
      components: { Stack: ({ children }) => <div>{children}</div>, CityInput, WeatherCard },
      specTool: true,
    });
    const args = {
      state: { city: 'Rome' },
      root: 'stack',
      elements: [
        { id: 'stack', type: 'Stack', props: {}, children: ['input', 'card'] },
        { id: 'input', type: 'CityInput', props: { value: { $bindState: '/city' } } },
        { id: 'card', type: 'WeatherCard', props: { city: { $state: '/city' }, temp: 30 } },
      ],
    };
    const text = JSON.stringify(args);
    const cut = text.indexOf('"id":"card"');
    const stream = controllableStream();
    let requests = 0;
    server.use(
      http.post(STREAM_URL, () => {
        requests++;
        return requests === 1 ? stream.response() : sseResponse([finish('stop')]);
      }),
    );
    renderWithProviders(<GenUIChat genUI={genUI} />);
    await send('Pick a city');

    act(() =>
      stream.push(
        chunk('start'),
        chunk('tool-call-input-streaming-start', { toolCallId: 'c1', toolName: 'ui_spec' }),
        chunk('tool-call-delta', { toolCallId: 'c1', argsTextDelta: text.slice(0, cut) }),
      ),
    );
    const input = (await screen.findByLabelText('City')) as HTMLInputElement;
    expect(input.value).toBe('Rome');
    fireEvent.change(input, { target: { value: 'Lyon' } });

    act(() =>
      stream.push(
        chunk('tool-call-delta', { toolCallId: 'c1', argsTextDelta: text.slice(cut) }),
        chunk('tool-call-input-streaming-end', { toolCallId: 'c1' }),
        chunk('tool-call', { toolCallId: 'c1', toolName: 'ui_spec', args }),
        finish('tool-calls'),
      ),
    );
    stream.close();
    await waitFor(() => expect(specView('c1')?.getAttribute('data-genui-status')).toBe('ready'));
    expect((screen.getByLabelText('City') as HTMLInputElement).value).toBe('Lyon');
    expect(screen.getByTestId('weather').textContent).toBe('Lyon: 30°');
  });

  it('a strict-mode model can build a spec from the advertised schema alone', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        if (bodies.length === 1) {
          const tools = bodies[0]!.clientTools as Record<string, { inputSchema: Schema }>;
          return sseResponse(specCall('c1', asStrictModelSends(tools.ui_spec!.inputSchema, weatherSpec)));
        }
        return sseResponse([finish('stop')]);
      }),
    );
    renderWithProviders(<GenUIChat genUI={weatherUI({ specTool: true })} />);
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
          const args = asStrictModelSends(tools.ui_spec!.inputSchema, {
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
          return sseResponse(specCall('c1', args));
        }
        return sseResponse([finish('stop')]);
      }),
    );
    const catalog = defineCatalog(schema, {
      components: {
        Stack: { props: z.object({}) },
        WeatherCard: weatherCard,
        FollowUp: { props: z.object({ label: z.string() }), events: ['press'] },
      },
      actions: { ask: { params: z.object({ prompt: z.string() }) } },
    });
    const genUI = createGenUI({
      catalog,
      components: {
        Stack: ({ children }) => <div>{children}</div>,
        WeatherCard,
        FollowUp: ({ props, emit }) => (
          <button type="button" onClick={() => emit('press')}>
            {props.label}
          </button>
        ),
      },
      specTool: true,
    });
    const asked: string[] = [];
    const actions: GenUIActionHandlers<typeof catalog> = { ask: ({ prompt }) => void asked.push(prompt) };
    renderWithProviders(<GenUIChat genUI={genUI} actions={actions} />);
    await send('Weather in Rome?');

    expect((await screen.findByTestId('weather')).textContent).toBe('Rome: 30°');
    await waitFor(() => expect(JSON.stringify(bodies[1]?.messages)).toContain('"ok":true'));
    fireEvent.click(screen.getByRole('button', { name: 'Paris instead' }));
    await waitFor(() => expect(asked).toEqual(['Weather in Paris?']));
  });

  it('rejects a spec built from unregistered components, tells the model why, and accepts its retry', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        if (bodies.length === 1) {
          return sseResponse(
            specCall('c1', { root: 'n', elements: [{ id: 'n', type: 'Script', props: { html: '<b>' } }] }),
          );
        }
        if (bodies.length === 2) return sseResponse(specCall('c2', weatherSpec));
        return sseResponse([finish('stop')]);
      }),
    );
    renderWithProviders(<GenUIChat genUI={weatherUI({ specTool: true })} />);
    await send('Do it');

    await waitFor(() => expect(bodies).toHaveLength(3));
    const rejection = JSON.stringify(bodies[1]!.messages);
    expect(rejection).toContain('"ok":false');
    expect(rejection).toContain('unknown component \\"Script\\"');
    expect(JSON.stringify(bodies[2]!.messages)).toContain('"ok":true');
    expect((await screen.findByTestId('weather')).textContent).toBe('Rome: 30°');
    expect(screen.getByText(/could not be displayed: unknown component "Script"/)).toBeTruthy();
    expect(document.querySelector('b')).toBeNull();
  });

  it('rejects invalid props and specs whose elements contain themselves, without rendering them', async () => {
    const bodies: Record<string, unknown>[] = [];
    const catalog = defineCatalog(schema, {
      components: { WeatherCard: weatherCard, Box: { props: z.object({}) } },
      actions: {},
    });
    const genUI = createGenUI({
      catalog,
      components: { WeatherCard, Box: ({ children }) => <div data-testid="box">{children}</div> },
      specTool: true,
    });
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        if (bodies.length === 1) {
          return sseResponse(
            specCall('c1', {
              root: 'card',
              elements: [{ id: 'card', type: 'WeatherCard', props: { city: 'Rome', temp: 'hot' } }],
            }),
          );
        }
        if (bodies.length === 2) {
          return sseResponse(
            specCall('c2', { root: 'a', elements: [{ id: 'a', type: 'Box', props: {}, children: ['a'] }] }),
          );
        }
        return sseResponse([finish('stop')]);
      }),
    );
    renderWithProviders(<GenUIChat genUI={genUI} />);
    await send('Do it');

    await waitFor(() => expect(bodies).toHaveLength(3));
    expect(JSON.stringify(bodies[1]!.messages)).toContain('invalid props for element \\"card\\"');
    expect(JSON.stringify(bodies[2]!.messages)).toContain('element \\"a\\" contains itself');
    expect(await screen.findAllByText(/This interface could not be displayed/)).toHaveLength(2);
    expect(screen.queryByTestId('weather')).toBeNull();
    expect(screen.queryByTestId('box')).toBeNull();
  });

  it('shows a spec whose tool call failed on the server as failed', async () => {
    server.use(
      http.post(STREAM_URL, () =>
        sseResponse([
          chunk('start'),
          chunk('tool-call', { toolCallId: 'c1', toolName: 'ui_spec', args: weatherSpec }),
          chunk('tool-error', { toolCallId: 'c1', toolName: 'ui_spec', error: 'Tool execution failed' }),
          finish('stop'),
        ]),
      ),
    );
    renderWithProviders(<GenUIChat genUI={weatherUI({ specTool: true })} />);
    await send('Weather?');

    await waitFor(() => expect(specView('c1')?.getAttribute('data-genui-status')).toBe('failed'));
    expect(document.querySelector('[data-genui-spec-status="failed"]')).toBeTruthy();
  });

  it('rebuilds each spec tool call from persisted history after a reload, each in its own place', () => {
    const history = [
      assistantWith([
        specInvocation('c1', weatherSpec, { ok: true }),
        { type: 'text', text: 'And later:' },
        specInvocation(
          'c2',
          { ...weatherSpec, elements: [{ ...weatherSpec.elements[0]!, props: { city: 'Rome', temp: 12 } }] },
          { ok: true },
        ),
      ]),
    ];
    renderWithProviders(<GenUIChat genUI={weatherUI({ specTool: true })} initialMessages={history} />);
    expect(screen.getAllByTestId('weather').map(node => node.textContent)).toEqual(['Rome: 30°', 'Rome: 12°']);
    expect(specView('c1')?.getAttribute('data-genui-status')).toBe('ready');
    expect(specView('c2')?.getAttribute('data-genui-status')).toBe('ready');
  });

  it('a new spec arriving does not redraw an earlier one that did not change', async () => {
    let requests = 0;
    server.use(
      http.post(STREAM_URL, () => {
        requests++;
        if (requests === 1) return sseResponse(specCall('c2', weatherSpec));
        return sseResponse([
          chunk('text-start', { id: 't2' }),
          chunk('text-delta', { id: 't2', text: 'Done.' }),
          chunk('text-end', { id: 't2' }),
          finish('stop'),
        ]);
      }),
    );
    // The earlier spec was rejected, so its view draws the app's own fallback, which counts its renders.
    let fallbackRenders = 0;
    const genUI = weatherUI({
      specTool: true,
      fallbacks: {
        Fallback: ({ reason }) => {
          fallbackRenders++;
          return <div role="note">{reason}</div>;
        },
      },
    });
    const renderers = { Text: (part: { text: string }) => <span>{part.text}</span> };
    const history = [assistantWith([specInvocation('c1', weatherSpec, { ok: false, error: 'too wide' })])];
    function App() {
      const chat = useGenUIChat({
        agentId: 'agent-1',
        threadId: 'thread-1',
        genUI,
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
    expect(screen.getByRole('note').textContent).toContain('too wide');
    const before = fallbackRenders;

    await send('Try again');
    expect(await screen.findByText('Done.')).toBeTruthy();
    expect(screen.getByTestId('weather').textContent).toBe('Rome: 30°');
    expect(specView('c2')?.getAttribute('data-genui-status')).toBe('ready');

    expect(fallbackRenders).toBe(before);
  });
});

describe('useGenUIChat — actions and context', () => {
  it('a spec-bound action reaches the agent once; edits to bound state send nothing', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        if (bodies.length > 1) return sseResponse([chunk('start'), finish('stop')]);
        return sseResponse(
          specCall('c1', {
            root: 'form',
            state: { city: '' },
            elements: [
              {
                id: 'form',
                type: 'CityFilter',
                props: { value: { $bindState: '/city' } },
                on: { submit: { action: 'applyFilter', params: { city: { $state: '/city' } } } },
              },
            ],
          }),
        );
      }),
    );
    const catalog = defineCatalog(schema, {
      components: { CityFilter: { props: z.object({ value: z.string() }), events: ['submit'] } },
      actions: { applyFilter: { params: z.object({ city: z.string().min(1) }) } },
    });
    const CityFilter = ({ props, bindings, emit }: BaseComponentProps<{ value: string }>) => {
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
    };
    const actions: GenUIActionHandlers<typeof catalog> = {
      applyFilter: async ({ city }, { chat }) => {
        await chat.sendMessage(`Filter by ${city}`);
      },
    };
    renderWithProviders(
      <GenUIChat genUI={createGenUI({ catalog, components: { CityFilter }, specTool: true })} actions={actions} />,
    );
    await send('show filters');

    const input = await screen.findByLabelText('City');
    await waitFor(() => expect(bodies).toHaveLength(2));
    await waitFor(() => expect(current.isRunning).toBe(false));
    // An empty city fails the action schema, so nothing is sent.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    });

    fireEvent.change(input, { target: { value: 'Lyon' } });
    expect((input as HTMLInputElement).value).toBe('Lyon');
    expect(bodies).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(bodies).toHaveLength(3));
    expect(JSON.stringify(bodies[2]!.messages)).toContain('Filter by Lyon');
  });

  const bookCatalog = defineCatalog(schema, {
    components: { Book: { props: z.object({}), events: ['press'] } },
    actions: { book: { params: z.object({}) } },
  });
  const bookUI = createGenUI({
    catalog: bookCatalog,
    components: {
      Book: ({ emit }) => (
        <button type="button" onClick={() => emit('press')}>
          Book
        </button>
      ),
    },
    specTool: true,
  });
  const bookSpec = { root: 'go', elements: [{ id: 'go', type: 'Book', props: {}, on: { press: { action: 'book' } } }] };

  // A double click on a button whose handler calls the agent sent the same request twice.
  it('runs an action once while a previous run from the same spec is still in flight', async () => {
    let requests = 0;
    server.use(
      http.post(STREAM_URL, () => {
        requests++;
        return sseResponse(requests === 1 ? specCall('b1', bookSpec) : [finish('stop')]);
      }),
    );
    let runs = 0;
    let finishRun!: () => void;
    const actions: GenUIActionHandlers<typeof bookCatalog> = {
      book: () => {
        runs++;
        return new Promise<void>(resolve => (finishRun = resolve));
      },
    };
    renderWithProviders(<GenUIChat genUI={bookUI} actions={actions} />);
    await send('book it');
    const button = await screen.findByRole('button', { name: 'Book' });
    await waitFor(() => expect(specView('b1')?.getAttribute('data-genui-status')).toBe('ready'));
    await waitFor(() => expect(current.isRunning).toBe(false));

    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(runs).toBe(1));
    await act(async () => finishRun());

    fireEvent.click(button);
    await waitFor(() => expect(runs).toBe(2));
  });

  it('ignores actions from a spec the run stopped before it was answered, and says it was interrupted', async () => {
    let runs = 0;
    const history = [assistantWith([specInvocation('b1', bookSpec)])];
    renderWithProviders(<GenUIChat genUI={bookUI} actions={{ book: () => void runs++ }} initialMessages={history} />);

    expect(specView('b1')?.getAttribute('data-genui-status')).toBe('aborted');
    expect(document.querySelector('[data-genui-spec-status="aborted"]')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Book' }));
    });
    expect(runs).toBe(0);
  });

  it('actions and renderers defined inline see the app state of the latest render', async () => {
    let requests = 0;
    server.use(
      http.post(STREAM_URL, () => {
        requests++;
        if (requests > 1) return sseResponse([finish('stop')]);
        return sseResponse([
          chunk('start'),
          chunk('text-start', { id: 't1' }),
          chunk('text-delta', { id: 't1', text: 'Pick a plan' }),
          chunk('text-end', { id: 't1' }),
          chunk('tool-call', {
            toolCallId: 'p1',
            toolName: 'ui_spec',
            args: {
              root: 'pick',
              elements: [{ id: 'pick', type: 'PlanPicker', props: {}, on: { press: { action: 'choose' } } }],
            },
          }),
          finish('tool-calls'),
        ]);
      }),
    );
    const catalog = defineCatalog(schema, {
      components: { PlanPicker: { props: z.object({}), events: ['press'] } },
      actions: { choose: { params: z.object({}) } },
    });
    const registry = createGenUI({
      catalog,
      components: {
        PlanPicker: ({ emit }) => (
          <button type="button" onClick={() => emit('press')}>
            Choose
          </button>
        ),
      },
      specTool: true,
    });
    const chosen: string[] = [];
    function App({ currency }: { currency: string }) {
      const chat = useGenUIChat({
        agentId: 'agent-1',
        threadId: 'thread-1',
        genUI: registry,
        actions: { choose: () => void chosen.push(currency) },
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
    await waitFor(() => expect(specView('p1')?.getAttribute('data-genui-status')).toBe('ready'));

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
        genUI: weatherUI(),
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
