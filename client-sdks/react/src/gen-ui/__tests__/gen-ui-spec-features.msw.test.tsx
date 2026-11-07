// @vitest-environment jsdom
import { defineCatalog, defineDirective, resolvePropValue } from '@json-render/core';
import { useBoundProp, useFieldValidation } from '@json-render/react';
import { schema } from '@json-render/react/schema';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { server } from '../../test/msw-server';
import { renderWithProviders } from '../../test/render';
import { MessageFactory } from '../../ui/MessageFactory';
import { createGenUI, useGenUIChat } from '../index';
import type { GenUIActionHandlers, GenUIRegistry } from '../index';
import { chunk, finish, sseResponse, STREAM_URL } from './sse';
import { asStrictModelSends } from './strict';
import type { Schema } from './strict';

const catalog = defineCatalog(schema, {
  components: {
    Card: { props: z.object({ title: z.string() }), slots: ['default', 'header', 'footer'] },
    Stack: { props: z.object({}) },
    Text: { props: z.object({ text: z.string() }) },
    Tags: { props: z.object({ labels: z.array(z.string()) }) },
    TaskRow: { props: z.object({ title: z.string(), position: z.number(), done: z.boolean() }) },
    Toggle: { props: z.object({ label: z.string(), checked: z.boolean() }) },
    Button: { props: z.object({ label: z.string() }), events: ['press'] },
  },
  actions: { ask: { params: z.object({ prompt: z.string() }) } },
});

const genUI = createGenUI({
  catalog,
  components: {
    Card: ({ props, children, slots }) => (
      <section aria-label={props.title}>
        <header>{slots?.header}</header>
        {children}
        <footer>{slots?.footer}</footer>
      </section>
    ),
    Stack: ({ children }) => <div>{children}</div>,
    Text: ({ props }) => <p>{props.text}</p>,
    Tags: ({ props }) => <p aria-label="Tags">{props.labels.join(', ')}</p>,
    TaskRow: ({ props, bindings }) => {
      const [done, setDone] = useBoundProp(props.done, bindings?.done);
      return (
        <label>
          <input type="checkbox" checked={done} onChange={event => setDone(event.target.checked)} />
          {`${props.position + 1}. ${props.title}`}
        </label>
      );
    },
    Toggle: ({ props, bindings }) => {
      const [checked, setChecked] = useBoundProp(props.checked, bindings?.checked);
      return (
        <label>
          <input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />
          {props.label}
        </label>
      );
    },
    Button: ({ props, emit }) => (
      <button type="button" onClick={() => emit('press')}>
        {props.label}
      </button>
    ),
  },
  specTool: true,
});

type Chat = ReturnType<typeof useGenUIChat>;
let current: Chat;

function GenUIChat({
  registry,
  actions,
  navigate,
}: {
  registry: GenUIRegistry<any>;
  actions?: GenUIActionHandlers<any>;
  navigate?: (path: string) => void;
}) {
  const chat = useGenUIChat({
    agentId: 'agent-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    genUI: registry,
    actions,
    navigate,
  });
  current = chat;
  return (
    <div>
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

const specView = (toolCallId: string) => document.querySelector(`[data-genui-spec="${toolCallId}"]`);

/** Answer the first request with one spec tool call, built from the tools the browser advertised. */
function modelComposes(build: (tools: Record<string, { inputSchema: Schema; description: string }>) => unknown) {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(STREAM_URL, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      if (bodies.length > 1) return sseResponse([finish('stop')]);
      const args = build(bodies[0]!.clientTools as Record<string, { inputSchema: Schema; description: string }>);
      return sseResponse([
        chunk('start'),
        chunk('tool-call', { toolCallId: 's1', toolName: 'ui_spec', args }),
        finish('tool-calls'),
      ]);
    }),
  );
  return bodies;
}

/** A spec using every json-render element feature, in json-render's own (non-strict) shape. */
const tasksSpec = {
  root: 'card',
  state: {
    owner: 'Ada',
    tasks: [
      { title: 'Pack', done: false },
      { title: 'Book train', done: false },
    ],
    showNote: false,
    choice: 'without the note',
  },
  elements: {
    card: {
      type: 'Card',
      props: { title: { $template: 'Trip of ${/owner}' } },
      children: ['tags', 'list', 'packed', 'note', 'toggle', 'sent'],
      slots: { header: ['heading'], footer: ['go'] },
    },
    heading: {
      type: 'Text',
      props: { text: { $cond: { $state: '/showNote', eq: true }, $then: 'Note shown', $else: 'Note hidden' } },
      children: [],
    },
    tags: { type: 'Tags', props: { labels: ['trip', { $state: '/owner' }] }, children: [] },
    list: { type: 'Stack', props: {}, repeat: { statePath: '/tasks', key: 'title' }, children: ['row'] },
    row: {
      type: 'TaskRow',
      props: { title: { $item: 'title' }, position: { $index: true }, done: { $bindItem: 'done' } },
      children: [],
    },
    packed: { type: 'Text', props: { text: 'Packed!' }, visible: { $state: '/tasks/0/done', eq: true }, children: [] },
    note: { type: 'Text', props: { text: 'Bring your passport' }, visible: { $state: '/showNote' }, children: [] },
    toggle: {
      type: 'Toggle',
      props: { label: 'Show note', checked: { $bindState: '/showNote' } },
      watch: { '/showNote': { action: 'setState', params: { statePath: '/choice', value: 'with the note' } } },
      children: [],
    },
    sent: { type: 'Text', props: { text: 'Sent!' }, visible: { $state: '/sent', eq: true }, children: [] },
    go: {
      type: 'Button',
      props: { label: 'Ask' },
      on: {
        press: {
          action: 'ask',
          params: { prompt: { $state: '/choice' } },
          confirm: { title: 'Ask the agent?', message: 'This sends a message', confirmLabel: 'Send' },
          onSuccess: { set: { '/sent': true } },
        },
      },
      children: [],
    },
  },
};

type Bound = Record<string, unknown>;
const toList = (value: Record<string, Bound | Bound[]> | undefined, key: string) =>
  value &&
  Object.entries(value).flatMap(([name, bindings]) =>
    (Array.isArray(bindings) ? bindings : [bindings]).map(({ params, onSuccess, onError, ...binding }) => ({
      [key]: name,
      ...binding,
      params: params && JSON.stringify(params),
      onSuccess: onSuccess && JSON.stringify(onSuccess),
      onError: onError && JSON.stringify(onError),
    })),
  );

const ownSchemaBranch = ['$state', '$bindState', '$item', '$bindItem', '$index', '$template'];
const strictProp = (value: unknown, top: boolean): unknown => {
  if (Array.isArray(value)) return value.map(item => strictProp(item, false));
  if (!value || typeof value !== 'object') return value;
  const keys = Object.keys(value);
  if (top && keys.length === 1 && ownSchemaBranch.includes(keys[0]!)) return value;
  if (keys.some(key => key.startsWith('$'))) return { $expr: JSON.stringify(value) };
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, strictProp(item, false)]));
};

/**
 * The same spec in the shape a strict structured-output model writes: everything keyed by the model becomes a
 * list, free-form values are JSON strings, and expressions without their own schema branch go in `$expr`.
 */
const strictTasksSpec = {
  root: tasksSpec.root,
  state: JSON.stringify(tasksSpec.state),
  elements: Object.entries(tasksSpec.elements).map(([id, element]) => {
    const { props, slots, visible, on, watch, ...rest } = element as typeof element & {
      slots?: Record<string, string[]>;
      visible?: unknown;
      on?: Record<string, Bound>;
      watch?: Record<string, Bound>;
    };
    return {
      id,
      ...rest,
      props: Object.fromEntries(Object.entries(props).map(([name, value]) => [name, strictProp(value, true)])),
      slots: slots && Object.entries(slots).map(([name, children]) => ({ name, children })),
      visible: visible === undefined ? undefined : JSON.stringify(visible),
      on: toList(on, 'event'),
      watch: toList(watch, 'statePath'),
    };
  }),
};

/** Drive the spec the way a user would and check every json-render feature took effect. */
async function expectEveryFeatureWorks(asked: string[]) {
  const card = await screen.findByRole('region', { name: 'Trip of Ada' });
  await waitFor(() => expect(specView('s1')?.getAttribute('data-genui-status')).toBe('ready'));
  expect(document.querySelector('[data-genui-fallback]')).toBeNull();

  // Expressions resolve inside nested values too.
  expect(screen.getByLabelText('Tags').textContent).toBe('trip, Ada');

  // Slots render in their own place, `$cond` picks a branch.
  expect(card.querySelector('header')?.textContent).toBe('Note hidden');
  expect(card.querySelector('footer')?.textContent).toBe('Ask');

  // `repeat` renders one row per item, reading `$item` and `$index`.
  expect(screen.getByLabelText('1. Pack')).toBeTruthy();
  expect(screen.getByLabelText('2. Book train')).toBeTruthy();

  // `$bindItem` writes back to the item, which `visible` reads.
  expect(screen.queryByText('Packed!')).toBeNull();
  fireEvent.click(screen.getByLabelText('1. Pack'));
  expect(await screen.findByText('Packed!')).toBeTruthy();

  // `$bindState` toggles a visibility condition and the `$cond`; `watch` reacts to the change.
  expect(screen.queryByText('Bring your passport')).toBeNull();
  fireEvent.click(screen.getByLabelText('Show note'));
  expect(await screen.findByText('Bring your passport')).toBeTruthy();
  expect(card.querySelector('header')?.textContent).toBe('Note shown');

  // `confirm` asks first; the action then runs with params read from state, and `onSuccess` updates state.
  fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
  expect(await screen.findByText('Ask the agent?')).toBeTruthy();
  expect(asked).toEqual([]);
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(asked).toEqual(['with the note']));
  expect(await screen.findByText('Sent!')).toBeTruthy();
}

afterEach(() => {
  cleanup();
});

describe('spec tool — json-render features', () => {
  it('renders and runs a spec using every json-render element feature, as json-render writes it', async () => {
    const bodies = modelComposes(() => tasksSpec);
    const asked: string[] = [];
    const actions: GenUIActionHandlers<typeof catalog> = { ask: ({ prompt }) => void asked.push(prompt) };
    renderWithProviders(<GenUIChat registry={genUI} actions={actions} />);
    await send('Plan my trip');

    await expectEveryFeatureWorks(asked);
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(JSON.stringify(bodies[1]!.messages)).toContain('"ok":true');
  });

  // Strict structured outputs only let the model send what the advertised schema declares.
  it('a strict-mode model can use every json-render element feature from the advertised schema alone', async () => {
    const bodies = modelComposes(tools => asStrictModelSends(tools.ui_spec!.inputSchema, strictTasksSpec));
    const asked: string[] = [];
    const actions: GenUIActionHandlers<typeof catalog> = { ask: ({ prompt }) => void asked.push(prompt) };
    renderWithProviders(<GenUIChat registry={genUI} actions={actions} />);
    await send('Plan my trip');

    await expectEveryFeatureWorks(asked);
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(JSON.stringify(bodies[1]!.messages)).toContain('"ok":true');
  });
});

const formCatalog = defineCatalog(schema, {
  components: {
    Stack: { props: z.object({}) },
    Text: { props: z.object({ text: z.string() }) },
    Field: {
      props: z.object({
        label: z.string(),
        value: z.string(),
        checks: z.array(z.object({ type: z.string(), message: z.string() })),
      }),
    },
    Button: { props: z.object({ label: z.string() }), events: ['press'] },
  },
  actions: { book: { params: z.object({ name: z.string() }) } },
});

const shout = defineDirective({
  name: '$shout',
  description: 'Upper-cases a value',
  schema: z.object({ $shout: z.unknown() }),
  resolve: (value, context) => String(resolvePropValue(value.$shout, context)).toUpperCase(),
});

const formGenUI = createGenUI({
  catalog: formCatalog,
  components: {
    Stack: ({ children }) => <div>{children}</div>,
    Text: ({ props }) => <p>{props.text}</p>,
    Field: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp(props.value, bindings?.value);
      const { errors } = useFieldValidation(bindings?.value ?? '', { checks: props.checks });
      return (
        <div>
          <input aria-label={props.label} value={value} onChange={event => setValue(event.target.value)} />
          {errors.map(error => (
            <em key={error}>{error}</em>
          ))}
        </div>
      );
    },
    Button: ({ props, emit }) => (
      <button type="button" onClick={() => emit('press')}>
        {props.label}
      </button>
    ),
  },
  functions: { fullName: ({ first, last }) => `${String(first)} ${String(last)}` },
  validationFunctions: { even: value => Number(value) % 2 === 0 },
  directives: [shout],
  specTool: true,
});

/** A booking form using app-provided `$computed` functions, a custom directive, validation and navigation. */
const bookingSpec = {
  root: 'form',
  state: { first: 'Ada', last: 'Lovelace', guests: '3' },
  elements: {
    form: { type: 'Stack', props: {}, children: ['name', 'loud', 'guests', 'check', 'invalid', 'book'] },
    name: {
      type: 'Text',
      props: {
        text: { $computed: 'fullName', args: { first: { $state: '/first' }, last: { $state: '/last' } } },
      },
      children: [],
    },
    loud: { type: 'Text', props: { text: { $shout: { $state: '/last' } } }, children: [] },
    guests: {
      type: 'Field',
      props: {
        label: 'Guests',
        value: { $bindState: '/guests' },
        checks: [{ type: 'even', message: 'Guests come in pairs' }],
      },
      children: [],
    },
    check: {
      type: 'Button',
      props: { label: 'Check' },
      on: { press: { action: 'validateForm', params: { statePath: '/form' } } },
      children: [],
    },
    invalid: {
      type: 'Text',
      props: { text: 'Fix the form' },
      visible: { $state: '/form/valid', eq: false },
      children: [],
    },
    book: {
      type: 'Button',
      props: { label: 'Book' },
      on: {
        press: {
          action: 'book',
          params: { name: { $state: '/first' } },
          onSuccess: { navigate: '/bookings' },
        },
      },
      children: [],
    },
  },
};

async function expectBookingWorks(booked: string[], visited: string[]) {
  expect(await screen.findByText('Ada Lovelace')).toBeTruthy();
  await waitFor(() => expect(specView('s1')?.getAttribute('data-genui-status')).toBe('ready'));
  expect(document.querySelector('[data-genui-fallback]')).toBeNull();
  expect(screen.getByText('LOVELACE')).toBeTruthy();

  // `validateForm` runs the app's validation function and writes the result to state.
  fireEvent.click(screen.getByRole('button', { name: 'Check' }));
  expect(await screen.findByText('Guests come in pairs')).toBeTruthy();
  expect(screen.getByText('Fix the form')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Guests'), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check' }));
  await waitFor(() => expect(screen.queryByText('Fix the form')).toBeNull());
  expect(screen.queryByText('Guests come in pairs')).toBeNull();

  // `onSuccess.navigate` goes through the app's navigate.
  fireEvent.click(screen.getByRole('button', { name: 'Book' }));
  await waitFor(() => expect(booked).toEqual(['Ada']));
  await waitFor(() => expect(visited).toEqual(['/bookings']));
}

describe('spec tool — app functions, validation, directives and navigation', () => {
  it('tells the model about the app functions and directives it may use', async () => {
    const bodies = modelComposes(() => bookingSpec);
    renderWithProviders(<GenUIChat registry={formGenUI} />);
    await send('Book a table');
    await waitFor(() => expect(bodies.length).toBeGreaterThan(0));

    const description = (bodies[0]!.clientTools as Record<string, { description: string }>).ui_spec!.description;
    expect(description).toContain('fullName');
    expect(description).toContain('$shout');
    expect(description).toContain('Upper-cases a value');
    expect(description).toContain('even');
  });

  it('renders and runs a spec built on app functions, a directive, validation and navigation', async () => {
    const bodies = modelComposes(() => bookingSpec);
    const booked: string[] = [];
    const visited: string[] = [];
    const actions: GenUIActionHandlers<typeof formCatalog> = { book: ({ name }) => void booked.push(name) };
    renderWithProviders(<GenUIChat registry={formGenUI} actions={actions} navigate={path => visited.push(path)} />);
    await send('Book a table');

    await expectBookingWorks(booked, visited);
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(JSON.stringify(bodies[1]!.messages)).toContain('"ok":true');
  });

  it("navigates with the latest render's navigate", async () => {
    modelComposes(() => bookingSpec);
    const visited: string[] = [];
    const actions: GenUIActionHandlers<typeof formCatalog> = { book: () => {} };
    const { rerender } = renderWithProviders(
      <GenUIChat registry={formGenUI} actions={actions} navigate={path => visited.push(`old ${path}`)} />,
    );
    await send('Book a table');
    expect(await screen.findByText('Ada Lovelace')).toBeTruthy();
    await waitFor(() => expect(specView('s1')?.getAttribute('data-genui-status')).toBe('ready'));

    rerender(<GenUIChat registry={formGenUI} actions={actions} navigate={path => visited.push(`new ${path}`)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Book' }));
    await waitFor(() => expect(visited).toEqual(['new /bookings']));
  });

  it('a strict-mode model can use them from the advertised schema alone', async () => {
    const strict = {
      root: bookingSpec.root,
      state: JSON.stringify(bookingSpec.state),
      elements: Object.entries(bookingSpec.elements).map(([id, element]) => {
        const { props, visible, on, ...rest } = element as typeof element & {
          visible?: unknown;
          on?: Record<string, Bound>;
        };
        return {
          id,
          ...rest,
          props: Object.fromEntries(Object.entries(props).map(([name, value]) => [name, strictProp(value, true)])),
          visible: visible === undefined ? undefined : JSON.stringify(visible),
          on: toList(on, 'event'),
        };
      }),
    };
    const bodies = modelComposes(tools => asStrictModelSends(tools.ui_spec!.inputSchema, strict));
    const booked: string[] = [];
    const visited: string[] = [];
    const actions: GenUIActionHandlers<typeof formCatalog> = { book: ({ name }) => void booked.push(name) };
    renderWithProviders(<GenUIChat registry={formGenUI} actions={actions} navigate={path => visited.push(path)} />);
    await send('Book a table');

    await expectBookingWorks(booked, visited);
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(JSON.stringify(bodies[1]!.messages)).toContain('"ok":true');
  });
});
