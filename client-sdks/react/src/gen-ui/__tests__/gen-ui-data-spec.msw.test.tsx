// @vitest-environment jsdom
import { defineCatalog, SPEC_DATA_PART_TYPE } from '@json-render/core';
import type { SpecDataPart } from '@json-render/core';
import { useBoundProp } from '@json-render/react';
import { schema } from '@json-render/react/schema';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { useLayoutEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { server } from '../../test/msw-server';
import { renderWithProviders } from '../../test/render';
import { MessageFactory } from '../../ui/MessageFactory';
import type { MessageRenderers } from '../../ui/MessageFactory/types';
import { createGenUI, useGenUIChat } from '../index';
import type { GenUIActionHandlers } from '../index';
import { chunk, controllableStream, finish, sseResponse, STREAM_URL } from './sse';

afterEach(cleanup);

const catalog = defineCatalog(schema, {
  components: {
    Card: { props: z.object({ title: z.string() }) },
    Toggle: { props: z.object({ label: z.string(), checked: z.boolean() }) },
    Button: { props: z.object({ label: z.string() }), events: ['press'] },
  },
  actions: { ask: { params: z.object({ prompt: z.string() }) } },
});

const genUI = createGenUI({
  catalog,
  components: {
    Card: ({ props, children }) => <section aria-label={props.title}>{children}</section>,
    Toggle: ({ props, bindings }) => {
      const [checked, setChecked] = useBoundProp(props.checked, bindings?.checked);
      return (
        <label>
          <input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />
          {props.label}
        </label>
      );
    },
    Button: ({ props, emit }) => <button onClick={() => emit('press')}>{props.label}</button>,
  },
});

let current: ReturnType<typeof useGenUIChat>;

function GenUIChat({
  initialMessages,
  actions,
  renderers,
  onCommit,
}: {
  initialMessages?: MastraDBMessage[];
  actions?: GenUIActionHandlers<typeof catalog>;
  renderers?: MessageRenderers;
  /** Runs after every commit, once the DOM shows the messages it rendered. */
  onCommit?: (messages: MastraDBMessage[]) => void;
}) {
  const chat = useGenUIChat({
    agentId: 'agent-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    genUI,
    initialMessages,
    actions,
    renderers,
  });
  current = chat;
  useLayoutEffect(() => onCommit?.(chat.messages));
  return (
    <div>
      {chat.messages.map(message => (
        <article key={message.id} data-message={message.role}>
          <MessageFactory message={message} Text={part => <p>{part.text}</p>} {...chat.genUI.renderers} />
        </article>
      ))}
    </div>
  );
}

const send = async (message: string) => {
  await act(async () => {
    void current.sendMessage({ message, threadId: 'thread-1' });
  });
};

/** A json-render `data-spec` part as `pipeJsonRender` (or a tool writing to the stream) sends it. */
const specChunk = (data: SpecDataPart) => ({ type: SPEC_DATA_PART_TYPE, runId: 'run-1', from: 'USER', data });
const patchChunk = (patch: Extract<SpecDataPart, { type: 'patch' }>['patch']) => specChunk({ type: 'patch', patch });

const tripPatches = [
  { op: 'add', path: '/root', value: 'card' },
  { op: 'add', path: '/state', value: { remind: false } },
  { op: 'add', path: '/elements/card', value: { type: 'Card', props: { title: 'Trip' }, children: [] } },
  {
    op: 'add',
    path: '/elements/remind',
    value: { type: 'Toggle', props: { label: 'Remind me', checked: { $bindState: '/remind' } } },
  },
  { op: 'add', path: '/elements/card/children/-', value: 'remind' },
  {
    op: 'add',
    path: '/elements/go',
    value: {
      type: 'Button',
      props: { label: 'Book it' },
      on: { press: { action: 'ask', params: { prompt: 'book the trip' } } },
    },
  },
  { op: 'add', path: '/elements/card/children/-', value: 'go' },
] as const;

/** An assistant message from history whose spec was streamed as json-render patches. */
const assistant = (id: string, title: string): MastraDBMessage => ({
  id,
  role: 'assistant',
  createdAt: new Date(1),
  threadId: 'thread-1',
  resourceId: 'resource-1',
  content: {
    format: 2,
    parts: [
      { type: 'text', text: `${title} below.` },
      ...tripPatches.map(patch => ({
        type: SPEC_DATA_PART_TYPE,
        data: {
          type: 'patch',
          patch: patch.path === '/elements/card' ? { ...patch, value: { ...patch.value, props: { title } } } : patch,
        },
      })),
    ] as never,
  },
});

const view = () => document.querySelector('[data-genui-spec]') as HTMLElement;
const views = () => [...document.querySelectorAll('[data-genui-spec]')] as HTMLElement[];

describe('native json-render data parts', () => {
  it('renders a spec streamed as json-render patches next to the text, progressively, where it appears', async () => {
    const stream = controllableStream();
    server.use(http.post(STREAM_URL, () => stream.response()));
    renderWithProviders(<GenUIChat />);
    await send('plan my trip');

    act(() =>
      stream.push(
        chunk('start', { messageId: 'a1' }),
        chunk('text-start', { id: 't1' }),
        chunk('text-delta', { id: 't1', text: 'Here is your trip.' }),
        chunk('text-end', { id: 't1' }),
        ...tripPatches.slice(0, 3).map(patchChunk),
      ),
    );
    await waitFor(() => expect(screen.getByRole('region', { name: 'Trip' })).toBeTruthy());
    expect(view().getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText('Here is your trip.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Book it' })).toBeNull();

    for (const patch of tripPatches.slice(3)) act(() => stream.push(patchChunk(patch)));
    act(() => {
      stream.push(finish('stop'));
      stream.close();
    });
    await waitFor(() => expect(view().getAttribute('data-genui-status')).toBe('ready'));
    // One view per message, however many parts built it.
    expect(views()).toHaveLength(1);
    // Each element once: folding the parts again as they arrive must not re-apply earlier patches.
    expect(within(view()).getAllByRole('checkbox')).toHaveLength(1);
    expect(within(view()).getAllByRole('button', { name: 'Book it' })).toHaveLength(1);
    expect(document.querySelector('[data-genui-fallback]')).toBeNull();
  });

  it('draws a spec in the same commit as the message part that starts it', async () => {
    const stream = controllableStream();
    server.use(http.post(STREAM_URL, () => stream.response()));
    // Every commit where a message holds spec parts but the screen shows no spec for it.
    const blank: string[] = [];
    const onCommit = (messages: MastraDBMessage[]) => {
      for (const message of messages) {
        const hasSpec = message.content.parts.some(part => part.type === SPEC_DATA_PART_TYPE);
        if (hasSpec && !screen.queryByRole('region', { name: 'Trip' })) blank.push(message.id);
      }
    };
    renderWithProviders(<GenUIChat onCommit={onCommit} />);
    await send('plan my trip');

    act(() => stream.push(chunk('start', { messageId: 'a1' }), ...tripPatches.slice(0, 3).map(patchChunk)));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Trip' })).toBeTruthy());
    // Later parts leave the first one, where the view is drawn, unchanged; the view still follows them.
    for (const patch of tripPatches.slice(3)) act(() => stream.push(patchChunk(patch)));
    await waitFor(() => expect(within(view()).getByRole('button', { name: 'Book it' })).toBeTruthy());
    expect(view().getAttribute('aria-busy')).toBe('true');
    act(() => {
      stream.push(finish('stop'));
      stream.close();
    });
    await waitFor(() => expect(view().getAttribute('data-genui-status')).toBe('ready'));

    expect(blank).toEqual([]);
  });

  it('binds state and runs actions from a native spec', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push(await request.json());
        return sseResponse(
          bodies.length === 1
            ? [chunk('start', { messageId: 'a1' }), ...tripPatches.map(patchChunk), finish('stop')]
            : [finish('stop')],
        );
      }),
    );
    const asked: string[] = [];
    const actions: GenUIActionHandlers<typeof catalog> = {
      ask: ({ prompt }, { toolCallId }) => void asked.push(`${toolCallId}: ${prompt}`),
    };
    renderWithProviders(<GenUIChat actions={actions} />);
    await send('plan my trip');
    await waitFor(() => expect(view()?.getAttribute('data-genui-status')).toBe('ready'));

    const toggle = within(view()).getByRole('checkbox') as HTMLInputElement;
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);
    fireEvent.click(within(view()).getByRole('button', { name: 'Book it' }));
    expect(asked).toEqual(['a1: book the trip']);
    // Toggling bound state stays local.
    expect(bodies).toHaveLength(1);
  });

  it('renders a complete flat spec part, and leaves other data parts to the app', async () => {
    server.use(
      http.post(STREAM_URL, () =>
        sseResponse([
          chunk('start', { messageId: 'a1' }),
          { type: 'data-signal', runId: 'run-1', from: 'USER', data: { kind: 'cursor' } },
          specChunk({
            type: 'flat',
            spec: { root: 'card', elements: { card: { type: 'Card', props: { title: 'Flat trip' }, children: [] } } },
          }),
          finish('stop'),
        ]),
      ),
    );
    const seen: string[] = [];
    renderWithProviders(<GenUIChat renderers={{ Data: part => (seen.push(part.type), (<i>app data</i>)) }} />);
    await send('plan my trip');

    await waitFor(() => expect(screen.getByRole('region', { name: 'Flat trip' })).toBeTruthy());
    expect(screen.getByText('app data')).toBeTruthy();
    expect(seen.every(type => type === 'data-signal')).toBe(true);
  });

  it('does not render a native spec built from unknown components', async () => {
    server.use(
      http.post(STREAM_URL, () =>
        sseResponse([
          chunk('start', { messageId: 'a1' }),
          patchChunk({ op: 'add', path: '/root', value: 'map' }),
          patchChunk({ op: 'add', path: '/elements/map', value: { type: 'Map', props: {} } }),
          finish('stop'),
        ]),
      ),
    );
    renderWithProviders(<GenUIChat />);
    await send('show a map');

    await waitFor(() => expect(screen.getByText(/could not be displayed: .*unknown component "Map"/)).toBeTruthy());
    expect(view()).toBeNull();
  });

  it('keeps earlier native specs ready and usable while a newer message streams', async () => {
    const stream = controllableStream();
    server.use(http.post(STREAM_URL, () => stream.response()));
    const asked: string[] = [];
    const actions: GenUIActionHandlers<typeof catalog> = {
      ask: ({ prompt }, { toolCallId }) => void asked.push(`${toolCallId}: ${prompt}`),
    };
    renderWithProviders(<GenUIChat initialMessages={[assistant('a0', 'Lisbon')]} actions={actions} />);
    await send('and Porto?');
    act(() => stream.push(chunk('start', { messageId: 'a1' }), ...tripPatches.slice(0, 3).map(patchChunk)));
    await waitFor(() => expect(views()).toHaveLength(2));

    expect(views().map(element => element.getAttribute('data-genui-status'))).toEqual(['ready', 'streaming']);
    fireEvent.click(within(views()[0]!).getByRole('button', { name: 'Book it' }));
    expect(asked).toEqual(['a0: book the trip']);
    act(() => {
      stream.push(finish('stop'));
      stream.close();
    });
  });

  it('rebuilds native specs from history, one per message', () => {
    renderWithProviders(<GenUIChat initialMessages={[assistant('a1', 'Lisbon'), assistant('a2', 'Porto')]} />);

    expect(views().map(element => element.getAttribute('data-genui-status'))).toEqual(['ready', 'ready']);
    expect(screen.getByRole('region', { name: 'Lisbon' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Porto' })).toBeTruthy();
    // Each message's spec has its own state.
    fireEvent.click(within(views()[0]!).getByRole('checkbox'));
    expect((within(views()[1]!).getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });
});
