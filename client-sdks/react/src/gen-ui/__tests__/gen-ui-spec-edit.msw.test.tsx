// @vitest-environment jsdom
import { defineCatalog } from '@json-render/core';
import type { EditMode } from '@json-render/core';
import { useBoundProp } from '@json-render/react';
import { schema } from '@json-render/react/schema';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { server } from '../../test/msw-server';
import { renderWithProviders } from '../../test/render';
import { MessageFactory } from '../../ui/MessageFactory';
import { createGenUI, useGenUIChat } from '../index';
import type { GenUIRegistry } from '../index';
import { chunk, controllableStream, finish, sseResponse, STREAM_URL } from './sse';
import { asStrictModelSends } from './strict';
import type { Schema } from './strict';

const catalog = defineCatalog(schema, {
  components: {
    Card: { props: z.object({ title: z.string() }) },
    Text: { props: z.object({ text: z.string() }) },
    Toggle: { props: z.object({ label: z.string(), checked: z.boolean() }) },
  },
  actions: {},
});

const genUIWith = (modes?: EditMode[]) =>
  createGenUI({
    catalog,
    components: {
      Card: ({ props, children }) => <section aria-label={props.title}>{children}</section>,
      Text: ({ props }) => <p>{props.text}</p>,
      Toggle: ({ props, bindings }) => {
        const [checked, setChecked] = useBoundProp(props.checked, bindings?.checked);
        return (
          <label>
            <input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />
            {props.label}
          </label>
        );
      },
    },
    specTool: modes ? { edit: { modes } } : true,
  });

let current: ReturnType<typeof useGenUIChat>;

function GenUIChat({
  registry,
  initialMessages,
}: {
  registry: GenUIRegistry<any>;
  initialMessages?: MastraDBMessage[];
}) {
  const chat = useGenUIChat({
    agentId: 'agent-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    genUI: registry,
    initialMessages,
  });
  current = chat;
  return (
    <div>
      {chat.messages.map(message => (
        <MessageFactory key={message.id} message={message} Text={() => null} {...chat.genUI.renderers} />
      ))}
    </div>
  );
}

const send = async (message: string) => {
  await act(async () => {
    void current.sendMessage({ message, threadId: 'thread-1' });
  });
};

const specView = (toolCallId: string) => document.querySelector(`[data-genui-spec="${toolCallId}"]`) as HTMLElement;

const tripSpec = {
  state: { remind: false },
  root: 'card',
  elements: {
    card: { type: 'Card', props: { title: 'Trip' }, children: ['remind'] },
    remind: { type: 'Toggle', props: { label: 'Remind me', checked: { $bindState: '/remind' } } },
  },
};

type Tools = Record<string, { inputSchema: Schema; description: string }>;
type Body = { clientTools: Tools; messages: unknown };

/**
 * The model, one reply per request: request 1 renders `tripSpec`, request 3 (the next user message) edits it,
 * every other request (tool results coming back) ends the turn.
 */
function model(edit: (tools: Tools, bodies: Body[]) => unknown) {
  const bodies: Body[] = [];
  server.use(
    http.post(STREAM_URL, async ({ request }) => {
      bodies.push((await request.json()) as Body);
      if (bodies.length === 1) {
        return sseResponse([
          chunk('start'),
          chunk('tool-call', { toolCallId: 's1', toolName: 'ui_spec', args: tripSpec }),
          finish('tool-calls'),
        ]);
      }
      if (bodies.length === 3) {
        return sseResponse([
          chunk('start'),
          chunk('tool-call', {
            toolCallId: 'e1',
            toolName: 'ui_spec_edit',
            args: edit(bodies[0]!.clientTools, bodies),
          }),
          finish('tool-calls'),
        ]);
      }
      return sseResponse([finish('stop')]);
    }),
  );
  return bodies;
}

/** Render the trip, let the user tick the toggle, then ask for a change. */
async function renderTripThenAskForChange(registry: GenUIRegistry<any>, bodies: Body[]) {
  renderWithProviders(<GenUIChat registry={registry} />);
  await send('plan my trip');
  await waitFor(() => expect(bodies).toHaveLength(2));
  await waitFor(() => expect(current.isRunning).toBe(false));
  fireEvent.click(within(specView('s1')).getByRole('checkbox'));
  await send('add a packing note');
  await waitFor(() => expect(bodies).toHaveLength(4));
  await waitFor(() => expect(current.isRunning).toBe(false));
}

const resultSentBack = (bodies: Body[], index: number) => JSON.stringify(bodies[index]!.messages);

afterEach(() => {
  cleanup();
});

describe('spec edit tool', () => {
  const patch = [
    { op: 'replace', path: '/elements/card/props/title', value: 'Trip to Lisbon' },
    { op: 'add', path: '/elements/note', value: { type: 'Text', props: { text: 'Pack light' } } },
    { op: 'add', path: '/elements/card/children/-', value: 'note' },
  ];

  it('patches an earlier interface into a new one at the edit, keeping what the user set', async () => {
    const bodies = model(() => ({ target: 's1', mode: 'patch', patch }));
    await renderTripThenAskForChange(genUIWith(), bodies);

    // The spec result tells the model which id to edit.
    expect(resultSentBack(bodies, 1)).toContain('"id":"s1"');
    const edited = specView('e1');
    expect(edited.getAttribute('data-genui-status')).toBe('ready');
    expect(within(edited).getByRole('region', { name: 'Trip to Lisbon' })).toBeTruthy();
    expect(within(edited).getByText('Pack light')).toBeTruthy();
    expect((within(edited).getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    // The earlier interface stays as it was.
    expect(within(specView('s1')).getByRole('region', { name: 'Trip' })).toBeTruthy();
    expect(within(specView('s1')).queryByText('Pack light')).toBeNull();
    // The model learns the state its edit started from.
    expect(resultSentBack(bodies, 3)).toContain('"baseState":{"remind":true}');
  });

  it('edits the latest interface when the model names none, with a JSON merge patch', async () => {
    const bodies = model(() => ({
      mode: 'merge',
      merge: { elements: { card: { props: { title: 'Trip to Porto' } }, remind: { props: { label: 'Ping me' } } } },
    }));
    await renderTripThenAskForChange(genUIWith(['merge']), bodies);

    const edited = specView('e1');
    expect(within(edited).getByRole('region', { name: 'Trip to Porto' })).toBeTruthy();
    expect(within(edited).getByText('Ping me')).toBeTruthy();
  });

  it('applies a unified diff against the spec text returned to the model', async () => {
    const bodies = model((_tools, sent) => {
      const result = JSON.stringify(sent[1]!.messages).match(/"spec":"((?:[^"\\]|\\.)*)"/)![1]!;
      const text = JSON.parse(`"${result}"`) as string;
      const lines = text.split('\n');
      const at = lines.findIndex(line => line.includes('"title": "Trip"'));
      const diff = [
        '--- a/spec.json',
        '+++ b/spec.json',
        `@@ -${at},3 +${at},3 @@`,
        ` ${lines[at - 1]}`,
        `-${lines[at]}`,
        `+${lines[at]!.replace('"Trip"', '"Trip to Faro"')}`,
        ` ${lines[at + 1]}`,
      ].join('\n');
      return { target: 's1', mode: 'diff', diff };
    });
    await renderTripThenAskForChange(genUIWith(['diff']), bodies);

    expect(within(specView('e1')).getByRole('region', { name: 'Trip to Faro' })).toBeTruthy();
  });

  it('rejects an edit that breaks the interface and tells the model why', async () => {
    const bodies = model(() => ({
      target: 's1',
      mode: 'patch',
      patch: [
        { op: 'add', path: '/elements/map', value: { type: 'Map', props: {} } },
        { op: 'add', path: '/elements/card/children/-', value: 'map' },
      ],
    }));
    await renderTripThenAskForChange(genUIWith(), bodies);

    expect(resultSentBack(bodies, 3)).toContain('unknown component \\"Map\\"');
    expect(specView('e1')).toBeNull();
    expect(screen.getByText(/could not be displayed/)).toBeTruthy();
    expect(within(specView('s1')).getByRole('region', { name: 'Trip' })).toBeTruthy();
  });

  it('rejects an edit of an interface that does not exist', async () => {
    const bodies = model(() => ({ target: 'nope', mode: 'patch', patch }));
    await renderTripThenAskForChange(genUIWith(), bodies);

    expect(resultSentBack(bodies, 3)).toContain('no interface \\"nope\\" to edit');
  });

  it('a strict-mode model can edit from the advertised schema alone', async () => {
    const bodies = model(tools =>
      asStrictModelSends(tools.ui_spec_edit!.inputSchema, {
        target: 's1',
        mode: 'patch',
        patch: patch.map(({ value, ...op }) => ({ ...op, value: JSON.stringify(value) })),
      }),
    );
    await renderTripThenAskForChange(genUIWith(), bodies);

    const edited = specView('e1');
    expect(edited.getAttribute('data-genui-status')).toBe('ready');
    expect(within(edited).getByRole('region', { name: 'Trip to Lisbon' })).toBeTruthy();
    expect(within(edited).getByText('Pack light')).toBeTruthy();
  });

  it('only advertises the edit modes the app enables', async () => {
    const bodies = model(() => ({ target: 's1', mode: 'patch', patch }));
    renderWithProviders(<GenUIChat registry={genUIWith(['merge'])} />);
    await send('plan my trip');
    await waitFor(() => expect(bodies.length).toBeGreaterThan(0));

    const tool = bodies[0]!.clientTools.ui_spec_edit!;
    expect(Object.keys(tool.inputSchema.properties ?? {})).toEqual(['target', 'mode', 'merge']);
    expect(tool.description).toMatch(/merge patch/i);
    expect(tool.description).not.toMatch(/RFC 6902/);
  });

  it('shows the patch operations that have arrived while the edit streams, from the state it started from', async () => {
    const stream = controllableStream();
    const bodies: Body[] = [];
    let requests = 0;
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push((await request.json()) as Body);
        requests++;
        if (requests === 1) {
          return sseResponse([
            chunk('start'),
            chunk('tool-call', { toolCallId: 's1', toolName: 'ui_spec', args: tripSpec }),
            finish('tool-calls'),
          ]);
        }
        return requests === 3 ? stream.response() : sseResponse([finish('stop')]);
      }),
    );
    renderWithProviders(<GenUIChat registry={genUIWith()} />);
    await send('plan my trip');
    await waitFor(() => expect(current.isRunning).toBe(false));
    await send('rename it');

    const argsText = JSON.stringify({ target: 's1', mode: 'patch', patch });
    act(() =>
      stream.push(
        chunk('start'),
        chunk('tool-call-input-streaming-start', { toolCallId: 'e1', toolName: 'ui_spec_edit' }),
        // The first operation is complete, the second is cut mid-value.
        chunk('tool-call-delta', { toolCallId: 'e1', argsTextDelta: argsText.slice(0, argsText.indexOf('"Pack')) }),
      ),
    );
    await waitFor(() => expect(within(specView('e1')).getByRole('region', { name: 'Trip to Lisbon' })).toBeTruthy());
    expect(specView('e1').getAttribute('aria-busy')).toBe('true');
    expect(within(specView('e1')).queryByText('Pack light')).toBeNull();

    // Changes to the original after the edit began do not leak into it.
    fireEvent.click(within(specView('s1')).getByRole('checkbox'));
    act(() => {
      stream.push(
        chunk('tool-call-delta', { toolCallId: 'e1', argsTextDelta: argsText.slice(argsText.indexOf('"Pack')) }),
        chunk('tool-call', {
          toolCallId: 'e1',
          toolName: 'ui_spec_edit',
          args: { target: 's1', mode: 'patch', patch },
        }),
        finish('tool-calls'),
      );
      stream.close();
    });
    await waitFor(() => expect(bodies).toHaveLength(4));
    expect(resultSentBack(bodies, 3)).toContain('"baseState":{"remind":false}');
    expect((within(specView('e1')).getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    expect((within(specView('s1')).getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });
});

describe('spec edit tool — history', () => {
  const message = (parts: object[]): MastraDBMessage => ({
    id: 'a1',
    role: 'assistant',
    createdAt: new Date(1),
    threadId: 'thread-1',
    resourceId: 'resource-1',
    content: { format: 2, parts: parts as never },
  });
  const invocation = (toolCallId: string, toolName: string, args: object, result: object) => ({
    type: 'tool-invocation',
    toolInvocation: { toolCallId, toolName, args, state: 'result', result },
  });

  it('rebuilds an edited interface after a reload, from the state the edit started from', () => {
    renderWithProviders(
      <GenUIChat
        registry={genUIWith()}
        initialMessages={[
          message([
            invocation('s1', 'ui_spec', tripSpec, { ok: true, id: 's1' }),
            invocation(
              'e1',
              'ui_spec_edit',
              {
                target: 's1',
                mode: 'patch',
                patch: [{ op: 'replace', path: '/elements/card/props/title', value: 'Oslo' }],
              },
              { ok: true, id: 'e1', baseState: { remind: true } },
            ),
          ]),
        ]}
      />,
    );

    const edited = specView('e1');
    expect(within(edited).getByRole('region', { name: 'Oslo' })).toBeTruthy();
    expect((within(edited).getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    expect((within(specView('s1')).getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });
});
