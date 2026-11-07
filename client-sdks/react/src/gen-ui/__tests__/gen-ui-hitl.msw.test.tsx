// @vitest-environment jsdom
import { defineCatalog } from '@json-render/core';
import { useBoundProp } from '@json-render/react';
import { schema } from '@json-render/react/schema';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { server } from '../../test/msw-server';
import { renderWithProviders } from '../../test/render';
import { MessageFactory } from '../../ui/MessageFactory';
import { createGenUI, defineGenUIToolRenderer, useGenUIChat, useGenUISurfaceState } from '../index';
import type { GenUIActionHandlers, GenUIRegistry } from '../index';
import { AGENT_URL, chunk, controllableStream, finish, genUIChunk, sseResponse, STREAM_URL } from './sse';

type Chat = ReturnType<typeof useGenUIChat>;
let current: Chat;

function GenUIChat({
  genUI,
  actions,
  initialMessages,
  threadId = 'thread-1',
}: {
  genUI: GenUIRegistry<any>;
  actions?: GenUIActionHandlers<any>;
  initialMessages?: MastraDBMessage[];
  threadId?: string;
}) {
  const chat = useGenUIChat({
    agentId: 'agent-1',
    resourceId: 'resource-1',
    threadId,
    genUI,
    actions,
    initialMessages,
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

const json = async (request: Request) => (await request.json()) as Record<string, unknown>;

/** A backend tool renderer with the approval controls a real app would show. */
const deleteFiles = defineGenUIToolRenderer({
  argsSchema: z.object({ paths: z.array(z.string()) }),
  outputSchema: z.object({ deleted: z.number() }),
  component: ({ phase, args, output, approval }) => (
    <section data-testid="delete" data-phase={phase}>
      <p>Delete {args?.paths.join(', ')}</p>
      {output ? <p>Deleted {output.deleted}</p> : null}
      {approval ? (
        <>
          {approval.kind === 'suspended' ? (
            <p>Asks: {String((approval.suspendPayload as { ask: string }).ask)}</p>
          ) : null}
          <button disabled={approval.status === 'pending'} onClick={() => void approval.approve()}>
            Approve
          </button>
          <button
            disabled={approval.status === 'pending'}
            onClick={() => void approval.approve({ keepBackup: true }).catch(() => {})}
          >
            Approve with backup
          </button>
          <button disabled={approval.status === 'pending'} onClick={() => void approval.decline()}>
            Decline
          </button>
          {approval.error ? <p role="alert">{approval.error}</p> : null}
        </>
      ) : null}
    </section>
  ),
});

const approvalStream = () =>
  sseResponse([
    chunk('start'),
    chunk('tool-call', { toolCallId: 'c1', toolName: 'deleteFiles', args: { paths: ['a.txt', 'b.txt'] } }),
    chunk('tool-call-approval', { toolCallId: 'c1', toolName: 'deleteFiles', args: { paths: ['a.txt', 'b.txt'] } }),
    finish('suspended'),
  ]);

afterEach(() => {
  cleanup();
});

describe('useGenUIChat — human in the loop', () => {
  it('a backend tool awaiting approval shows its arguments, and approving resumes the run once', async () => {
    const approvals: Record<string, unknown>[] = [];
    let declines = 0;
    const resumed = controllableStream();
    server.use(
      http.post(STREAM_URL, () => approvalStream()),
      http.post(`${AGENT_URL}/decline-tool-call`, () => {
        declines++;
        return sseResponse([finish('stop')]);
      }),
      http.post(`${AGENT_URL}/approve-tool-call`, async ({ request }) => {
        approvals.push(await json(request));
        return resumed.response();
      }),
    );
    renderWithProviders(<GenUIChat genUI={createGenUI({ tools: { deleteFiles } })} />);
    await send('clean up');

    const tool = await screen.findByTestId('delete');
    await waitFor(() => expect(tool.getAttribute('data-phase')).toBe('awaiting-approval'));
    expect(tool.textContent).toContain('Delete a.txt, b.txt');

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement).disabled).toBe(true),
    );
    // A second decision while the first is in flight (double click, or a component calling approve twice) must not POST again.
    await act(async () => {
      void current.genUI.controller.getToolApproval('c1')!.approve();
      void current.genUI.controller.getToolApproval('c1')!.decline();
    });

    act(() =>
      resumed.push(
        chunk('tool-result', { toolCallId: 'c1', toolName: 'deleteFiles', result: { deleted: 2 } }),
        finish('stop'),
      ),
    );
    resumed.close();

    await waitFor(() => expect(screen.getByTestId('delete').getAttribute('data-phase')).toBe('output-available'));
    expect(screen.getByTestId('delete').textContent).toContain('Deleted 2');
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(approvals).toHaveLength(1);
    expect(declines).toBe(0);
    expect(approvals[0]).toMatchObject({ toolCallId: 'c1' });
    expect(approvals[0]!.resumeData).toBeUndefined();
  });

  it('declining sends a decline and renders the denial', async () => {
    const declines: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, () => approvalStream()),
      http.post(`${AGENT_URL}/decline-tool-call`, async ({ request }) => {
        declines.push(await json(request));
        return sseResponse([
          chunk('tool-output-denied', {
            toolCallId: 'c1',
            toolName: 'deleteFiles',
            args: { paths: ['a.txt', 'b.txt'] },
            approval: { id: 'approval-1', approved: false },
          }),
          finish('stop'),
        ]);
      }),
    );
    renderWithProviders(<GenUIChat genUI={createGenUI({ tools: { deleteFiles } })} />);
    await send('clean up');

    fireEvent.click(await screen.findByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(screen.getByTestId('delete').getAttribute('data-phase')).toBe('output-denied'));
    expect(screen.queryByRole('button', { name: 'Decline' })).toBeNull();
    expect(declines).toHaveLength(1);
    expect(declines[0]).toMatchObject({ toolCallId: 'c1' });
  });

  it('a failed approval surfaces the error and can be retried', async () => {
    let attempts = 0;
    server.use(
      http.post(STREAM_URL, () => approvalStream()),
      http.post(`${AGENT_URL}/approve-tool-call`, () => {
        attempts++;
        // 4xx is terminal for the client (5xx would be retried transparently).
        if (attempts === 1) return HttpResponse.json({ error: 'run lock busy' }, { status: 409 });
        return sseResponse([
          chunk('tool-result', { toolCallId: 'c1', toolName: 'deleteFiles', result: { deleted: 2 } }),
          finish('stop'),
        ]);
      }),
    );
    renderWithProviders(<GenUIChat genUI={createGenUI({ tools: { deleteFiles } })} />);
    await send('clean up');

    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/409|busy/);
    expect(screen.getByTestId('delete').getAttribute('data-phase')).toBe('awaiting-approval');
    const retry = screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement;
    expect(retry.disabled).toBe(false);

    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByTestId('delete').textContent).toContain('Deleted 2'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(attempts).toBe(2);
  });

  it('a suspended tool shows what it asks for and resumes with the user-provided data', async () => {
    const resumes: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, () =>
        sseResponse([
          chunk('start'),
          chunk('tool-call', { toolCallId: 'c1', toolName: 'deleteFiles', args: { paths: ['a.txt'] } }),
          chunk('tool-call-suspended', {
            toolCallId: 'c1',
            toolName: 'deleteFiles',
            args: { paths: ['a.txt'] },
            suspendPayload: { ask: 'Keep a backup?' },
          }),
          finish('suspended'),
        ]),
      ),
      http.post(`${AGENT_URL}/resume-stream`, async ({ request }) => {
        resumes.push(await json(request));
        return sseResponse([
          chunk('tool-result', { toolCallId: 'c1', toolName: 'deleteFiles', result: { deleted: 1 } }),
          finish('stop'),
        ]);
      }),
    );
    renderWithProviders(<GenUIChat genUI={createGenUI({ tools: { deleteFiles } })} />);
    await send('clean up');

    expect(await screen.findByText('Asks: Keep a backup?')).toBeTruthy();
    expect(screen.getByTestId('delete').getAttribute('data-phase')).toBe('suspended');
    fireEvent.click(screen.getByRole('button', { name: 'Approve with backup' }));

    await waitFor(() => expect(screen.getByTestId('delete').textContent).toContain('Deleted 1'));
    expect(resumes).toHaveLength(1);
    expect(resumes[0]).toMatchObject({ toolCallId: 'c1', resumeData: { keepBackup: true } });
  });

  it('a suspension restored from history can still be resumed against its original run', async () => {
    const resumes: Record<string, unknown>[] = [];
    server.use(
      http.post(`${AGENT_URL}/resume-stream`, async ({ request }) => {
        resumes.push(await json(request));
        return sseResponse([
          chunk('tool-result', { toolCallId: 'c1', toolName: 'deleteFiles', result: { deleted: 1 } }),
          finish('stop'),
        ]);
      }),
    );
    const history: MastraDBMessage[] = [
      {
        id: 'u1',
        role: 'user',
        createdAt: new Date(0),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: { format: 2, parts: [{ type: 'text', text: 'clean up' }] },
      },
      {
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
              toolInvocation: { state: 'call', toolCallId: 'c1', toolName: 'deleteFiles', args: { paths: ['a.txt'] } },
            },
          ],
          metadata: {
            mode: 'stream',
            suspendedTools: {
              deleteFiles: {
                toolCallId: 'c1',
                toolName: 'deleteFiles',
                args: { paths: ['a.txt'] },
                suspendPayload: { ask: 'Keep a backup?' },
                runId: 'run-from-history',
              },
            },
          },
        },
      },
    ];
    renderWithProviders(<GenUIChat genUI={createGenUI({ tools: { deleteFiles } })} initialMessages={history} />);

    expect(await screen.findByText('Asks: Keep a backup?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve with backup' }));
    await waitFor(() => expect(screen.getByTestId('delete').textContent).toContain('Deleted 1'));
    expect(resumes[0]).toMatchObject({ runId: 'run-from-history', toolCallId: 'c1', resumeData: { keepBackup: true } });
  });
});

describe('useGenUIChat — surface state', () => {
  const counter = { type: 'Counter', props: { count: { $bindState: '/count' } } };
  const surface = (eventId: string, surfaceId: string, element: object, state?: object) =>
    genUIChunk({
      version: 1,
      eventId,
      surfaceId,
      operations: [
        { op: 'createSurface', spec: { root: 'root', elements: { root: element }, ...(state ? { state } : {}) } },
      ],
    });

  it('user edits of agent state stay local, win over agent updates, and conflicts are reported, not overwritten', async () => {
    const stream = controllableStream();
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, async ({ request }) => {
        bodies.push(await json(request));
        return bodies.length === 1 ? stream.response() : sseResponse([chunk('start'), finish('stop')]);
      }),
    );
    const filters = z.object({ region: z.string(), limit: z.number() });
    const catalog = defineCatalog(schema, {
      components: { ReportFilters: { props: filters, events: ['apply'] } },
      actions: { apply: { params: filters } },
    });
    const genUI = createGenUI({
      catalog,
      components: {
        ReportFilters: ({ props, bindings, emit }) => {
          const [region, setRegion] = useBoundProp(props.region, bindings?.region);
          const surfaceState = useGenUISurfaceState();
          return (
            <div>
              <label>
                Region
                <input value={region} onChange={event => setRegion(event.target.value)} />
              </label>
              <output data-testid="limit">{String(props.limit)}</output>
              <output data-testid="conflicts">{surfaceState.conflicts.join(',')}</output>
              <button onClick={() => surfaceState.keepLocal('/region')}>Keep mine</button>
              <button onClick={() => surfaceState.discard('/region')}>Use agent value</button>
              <button onClick={() => emit('apply')}>Apply</button>
            </div>
          );
        },
      },
    });
    const actions: GenUIActionHandlers<typeof catalog> = {
      apply: async (params, { chat }) => {
        await chat.sendMessage(`Apply ${JSON.stringify(params)}`);
      },
    };
    renderWithProviders(<GenUIChat genUI={genUI} actions={actions} />);
    await send('show report filters');
    act(() =>
      stream.push(
        chunk('start'),
        surface(
          'e1',
          'filters',
          {
            type: 'ReportFilters',
            props: { region: { $bindState: '/region' }, limit: { $state: '/limit' } },
            on: { apply: { action: 'apply', params: { region: { $state: '/region' }, limit: { $state: '/limit' } } } },
          },
          { region: 'EU', limit: 10 },
        ),
      ),
    );

    const input = (await screen.findByLabelText('Region')) as HTMLInputElement;
    expect(input.value).toBe('EU');
    fireEvent.change(input, { target: { value: 'US' } });
    expect(input.value).toBe('US');

    // The agent changes the edited path and an unedited one in the same update.
    act(() =>
      stream.push(
        genUIChunk({
          version: 1,
          eventId: 'e2',
          surfaceId: 'filters',
          operations: [
            {
              op: 'patch',
              patches: [
                { op: 'replace', path: '/state/region', value: 'APAC' },
                { op: 'replace', path: '/state/limit', value: 50 },
              ],
            },
          ],
        }),
      ),
    );
    await waitFor(() => expect(screen.getByTestId('limit').textContent).toBe('50'));
    expect(input.value).toBe('US');
    expect(screen.getByTestId('conflicts').textContent).toBe('/region');

    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));
    expect(screen.getByTestId('conflicts').textContent).toBe('');
    expect(input.value).toBe('US');
    expect(bodies).toHaveLength(1);

    act(() => {
      stream.push(finish('stop'));
      stream.close();
    });
    await waitFor(() => expect(current.isRunning).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(JSON.stringify(bodies[1]!.messages)).toContain('Apply {\\"region\\":\\"US\\",\\"limit\\":50}');

    fireEvent.click(screen.getByRole('button', { name: 'Use agent value' }));
    expect(input.value).toBe('APAC');
  });

  it('each surface keeps its own state, and edits reset when the thread changes', async () => {
    server.use(
      http.post(STREAM_URL, () =>
        sseResponse([
          chunk('start'),
          surface('e1', 'left', counter, { count: 0 }),
          surface('e2', 'right', counter, { count: 0 }),
          finish('stop'),
        ]),
      ),
    );
    const catalog = defineCatalog(schema, {
      components: { Counter: { props: z.object({ count: z.number() }) } },
      actions: {},
    });
    const registry = createGenUI({
      catalog,
      components: {
        Counter: ({ props, bindings }) => {
          const [count, setCount] = useBoundProp(props.count, bindings?.count);
          return (
            <div data-testid="counter">
              <button onClick={() => setCount((count ?? 0) + 1)}>+1</button>
              <span>count {count}</span>
            </div>
          );
        },
      },
    });
    const view = renderWithProviders(<GenUIChat genUI={registry} />);
    await send('two counters');

    await waitFor(() => expect(screen.getAllByTestId('counter')).toHaveLength(2));
    const [left, right] = screen.getAllByRole('button', { name: '+1' });
    fireEvent.click(left!);
    fireEvent.click(left!);
    fireEvent.click(right!);
    const texts = () => screen.getAllByTestId('counter').map(node => node.textContent);
    expect(texts()).toEqual(['+1count 2', '+1count 1']);

    // Same controller, new thread: no state from the previous conversation leaks in.
    view.rerender(<GenUIChat genUI={registry} threadId="thread-2" />);
    await waitFor(() => expect(current.genUI.controller.edits.get('left')).toEqual({}));
    expect(current.genUI.controller.edits.get('right')).toEqual({});
  });
});
