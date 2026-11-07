// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DataPartRenderer } from '../../messages/renderers/data-part-renderer';
import { CONTROL_POLL_MS, ComputerCard } from '../computer-card';
import { CONNECT_TIMEOUT_MS, requestComputerSession } from '../computer-session';
import { attachedComputerId, deriveComputers } from '../computer-state';
import { ComputerThreadProvider } from '../computer-thread-context';
import type { ComputerThreadScope } from '../computer-thread-context';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

// noVNC is the third-party boundary: a fake RFB records what the card asks of it.
const rfb = vi.hoisted(() => {
  class FakeRFB extends EventTarget {
    static instances: FakeRFB[] = [];
    /** Whether a new client reports `connect` on its own, like a desktop that answers. */
    static autoConnect = true;
    viewOnly = false;
    scaleViewport = false;
    resizeSession = true;
    disconnected = false;
    constructor(
      readonly target: HTMLElement,
      readonly url: string,
      readonly options: { wsProtocols?: string[] } = {},
    ) {
      super();
      FakeRFB.instances.push(this);
      if (FakeRFB.autoConnect) queueMicrotask(() => this.dispatchEvent(new Event('connect')));
    }
    disconnect() {
      this.disconnected = true;
    }
  }
  return { FakeRFB };
});
vi.mock('@novnc/novnc', () => ({ default: rfb.FakeRFB }));
const live = () => rfb.FakeRFB.instances.filter(i => !i.disconnected);

const SESSION_URL = `${TEST_BASE_URL}/api/computers/:computerId/session`;
const CONTROL_URL = `${TEST_BASE_URL}/api/computers/:computerId/control`;
const scope: ComputerThreadScope = { threadId: 'thread-1', resourceId: 'agent-1' };

type Part = Record<string, unknown>;

function message(id: string, parts: Part[]): MastraDBMessage {
  return {
    id,
    role: 'assistant',
    createdAt: new Date(0),
    threadId: scope.threadId,
    resourceId: scope.resourceId,
    content: { format: 2, parts },
  } as unknown as MastraDBMessage;
}

const computerPart = (status: 'attached' | 'released', overrides: Part = {}): Part => ({
  type: 'data-computer',
  data: { computerId: 'c1', threadId: scope.threadId, name: 'Desk', status, persistent: false, ...overrides },
});

// Results as `PlatformComputers` returns them.
const toolResult = (toolName: string, result: unknown, args: unknown = {}): Part => ({
  type: 'tool-invocation',
  toolInvocation: { toolCallId: `call-${toolName}-${Math.random()}`, toolName, state: 'result', args, result },
});
const describeComputer = (status: 'attached' | 'released') => ({
  computer: { id: 'c1', name: 'Desk', template: 'desktop', status, persistent: true },
});
const attachResult = (toolName = 'computer_create'): Part => toolResult(toolName, describeComputer('attached'));
const releaseResult = (): Part => toolResult('computer_release', describeComputer('released'));
const destroyResult = (): Part => toolResult('computer_destroy', { destroyed: 'c1' }, { id: 'c1' });

interface SessionRequest {
  computerId: string;
  body: { threadId: string; resourceId: string; mode: string };
  headers: Headers;
}

let requests: SessionRequest[];

function serveSession(reply: (req: SessionRequest) => Response | Promise<Response> = () => ready()) {
  server.use(
    http.post(SESSION_URL, async ({ request, params }) => {
      const req = {
        computerId: String(params.computerId),
        body: (await request.json()) as SessionRequest['body'],
        headers: request.headers,
      };
      requests.push(req);
      return reply(req);
    }),
  );
}

const ready = (ticket = `t${requests.length}`) =>
  HttpResponse.json({ state: 'ready', socketUrl: `/computer/c1/websockify?ticket=${ticket}` });
const WS_BASE = TEST_BASE_URL.replace('http', 'ws');

/** Renders a thread transcript the way MessageRow does: one DataPartRenderer per data part. */
function renderThread(messages: MastraDBMessage[], threadScope: ComputerThreadScope | null = scope) {
  const tree = (msgs: MastraDBMessage[], s: ComputerThreadScope | null) => (
    <ComputerThreadProvider messages={msgs} scope={s ?? undefined}>
      {msgs.flatMap(m =>
        (m.content.parts as Part[]).map((part, index) => {
          if (String(part.type).startsWith('data-')) {
            return (
              <DataPartRenderer key={`${m.id}-${index}`} part={part as never} messageId={m.id} partIndex={index} />
            );
          }
          // As MessageRow does for attach tool calls.
          const invocation = (part as { toolInvocation?: { toolName: string; result?: unknown } }).toolInvocation;
          const computerId = invocation && attachedComputerId(invocation.toolName, invocation.result);
          return computerId ? (
            <ComputerCard key={`${m.id}-${index}`} messageId={m.id} partIndex={index} computerId={computerId} standIn />
          ) : null;
        }),
      )}
    </ComputerThreadProvider>
  );
  const utils = renderWithProviders(tree(messages, threadScope));
  return { ...utils, rerenderThread: (msgs: MastraDBMessage[], s = threadScope) => utils.rerender(tree(msgs, s)) };
}

interface ControlServer {
  holder: 'agent' | 'human';
  notified: boolean;
  status?: number;
  gets: number;
  posts: { action: string; note?: string; threadId: string; resourceId: string }[];
  headers: Headers[];
  /** When set, a GET answers with the holder it saw on arrival, but only once this resolves. */
  hold?: Promise<void>;
}
let lease: ControlServer;

function serveControl() {
  server.use(
    http.get(CONTROL_URL, async ({ request }) => {
      lease.gets++;
      lease.headers.push(request.headers);
      if (lease.status) return new HttpResponse(null, { status: lease.status });
      const seen = lease.holder;
      await lease.hold;
      return HttpResponse.json({ holder: seen });
    }),
    http.post(CONTROL_URL, async ({ request }) => {
      const body = (await request.json()) as ControlServer['posts'][number];
      lease.posts.push(body);
      lease.headers.push(request.headers);
      if (lease.status) return new HttpResponse(null, { status: lease.status });
      const holder = body.action === 'take' ? 'human' : 'agent';
      const changed = holder !== lease.holder;
      lease.holder = holder;
      return HttpResponse.json({
        holder,
        notified: changed && lease.notified,
        ...(!changed && { reason: 'no-change' }),
      });
    }),
  );
}

const controlPart = (overrides: Part = {}): Part => ({
  type: 'data-computer',
  data: { computerId: 'c1', threadId: scope.threadId, control: 'human', reason: 'log in please', ...overrides },
});
const controlSignal = (kind: 'control-taken' | 'control-returned', computerId = 'c1'): Part => ({
  type: 'data-signal',
  data: {
    type: 'notification',
    tagName: 'notification',
    contents: kind === 'control-taken' ? 'The user took control of the computer' : 'The user handed control back',
    attributes: { computerId, source: 'computer', kind, priority: 'urgent' },
  },
});
const requestHumanResult = (reason = 'log in please'): Part =>
  toolResult('computer_request_human', { computerId: 'c1', reason, control: 'human', message: 'Stop.' }, { reason });

beforeEach(() => {
  requests = [];
  rfb.FakeRFB.instances = [];
  rfb.FakeRFB.autoConnect = true;
  lease = { holder: 'agent', notified: true, gets: 0, posts: [], headers: [] };
  serveControl();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('deriveComputers', () => {
  it('follows attach → release from data parts', () => {
    expect(deriveComputers([message('m1', [computerPart('attached')])]).get('c1')).toMatchObject({
      status: 'attached',
      ownerKey: 'm1:0',
    });
    const released = deriveComputers([
      message('m1', [computerPart('attached')]),
      message('m2', [computerPart('released')]),
    ]);
    expect(released.get('c1')).toMatchObject({ status: 'released', ownerKey: undefined });
  });

  it('falls back to tool results when stored history has no parts', () => {
    expect(deriveComputers([message('m1', [attachResult('computer_attach')])]).get('c1')).toMatchObject({
      status: 'attached',
      persistent: true,
      ownerKey: 'm1:0',
    });
    expect(
      deriveComputers([message('m1', [attachResult()]), message('m2', [releaseResult()])]).get('c1'),
    ).toMatchObject({ status: 'released', ownerKey: undefined });
    expect(
      deriveComputers([message('m1', [attachResult()]), message('m2', [destroyResult()])]).get('c1'),
    ).toMatchObject({ status: 'released', ownerKey: undefined });
    // A fresh attach after release takes ownership again.
    expect(
      deriveComputers([
        message('m1', [attachResult(), releaseResult()]),
        message('m2', [attachResult('computer_attach')]),
      ]).get('c1')?.ownerKey,
    ).toBe('m2:0');
  });

  it('reads tool results stored as JSON strings', () => {
    const stored = (part: Part) => {
      const invocation = (part as { toolInvocation: { result: unknown } }).toolInvocation;
      return { ...part, toolInvocation: { ...invocation, result: JSON.stringify(invocation.result) } } as Part;
    };
    expect(deriveComputers([message('m1', [stored(attachResult())])]).get('c1')).toMatchObject({
      status: 'attached',
      ownerKey: 'm1:0',
    });
    expect(
      deriveComputers([message('m1', [stored(attachResult())]), message('m2', [stored(destroyResult())])]).get('c1')
        ?.status,
    ).toBe('released');
    expect(deriveComputers([message('m1', [toolResult('computer_create', '{not json')])]).size).toBe(0);
    expect(attachedComputerId('computer_create', JSON.stringify(describeComputer('attached')))).toBe('c1');
  });

  it('lets the data part own an attach that also has a result, in either order', () => {
    expect(deriveComputers([message('m1', [attachResult(), computerPart('attached')])]).get('c1')?.ownerKey).toBe(
      'm1:1',
    );
    const afterRelease = deriveComputers([
      message('m1', [computerPart('attached'), attachResult()]),
      message('m2', [computerPart('released')]),
    ]);
    expect(afterRelease.get('c1')?.status).toBe('released');
    // The part keeps ownership when the same attach also produced a result.
    expect(deriveComputers([message('m1', [computerPart('attached'), attachResult()])]).get('c1')?.ownerKey).toBe(
      'm1:0',
    );
  });

  it('tracks the holder from control parts, requests and control signals, last write wins', () => {
    const attached = message('m1', [computerPart('attached')]);
    expect(deriveComputers([attached]).get('c1')?.holder).toBeUndefined();
    const requested = deriveComputers([attached, message('m2', [controlPart()])]).get('c1');
    // A control part never takes ownership of the live viewer.
    expect(requested).toMatchObject({ holder: 'human', reason: 'log in please', ownerKey: 'm1:0', status: 'attached' });
    expect(
      deriveComputers([
        attached,
        message('m2', [controlPart()]),
        message('m3', [controlSignal('control-returned')]),
      ]).get('c1'),
    ).not.toHaveProperty('reason');
    expect(
      deriveComputers([
        attached,
        message('m2', [controlPart()]),
        message('m3', [controlSignal('control-returned')]),
      ]).get('c1'),
    ).toMatchObject({ holder: 'agent', ownerKey: 'm1:0' });
    const alternating = [
      attached,
      message('m2', [controlSignal('control-taken')]),
      message('m3', [controlSignal('control-returned')]),
      message('m4', [controlSignal('control-taken')]),
    ];
    expect(deriveComputers(alternating).get('c1')?.holder).toBe('human');
    expect(
      deriveComputers([...alternating, message('m5', [controlSignal('control-returned')])]).get('c1')?.holder,
    ).toBe('agent');
    // Reloaded history: the request's tool result stands in for its part.
    expect(
      deriveComputers([message('m1', [attachResult()]), message('m2', [requestHumanResult('captcha')])]).get('c1'),
    ).toMatchObject({
      holder: 'human',
      reason: 'captcha',
    });
    // Signals from other sources or for unknown computers change nothing.
    const other = {
      ...controlSignal('control-taken'),
      data: { type: 'notification', attributes: { computerId: 'c1', source: 'github', kind: 'control-taken' } },
    };
    expect(
      deriveComputers([attached, message('m2', [other, controlSignal('control-taken', 'c2')])]).get('c1')?.holder,
    ).toBeUndefined();
    expect(deriveComputers([attached, message('m2', [controlSignal('control-taken', 'c2')])]).has('c2')).toBe(false);
  });

  it('ignores malformed parts and results', () => {
    const computers = deriveComputers([
      message('m1', [
        { type: 'data-computer', data: { computerId: 'c1', status: 'gone' } },
        { type: 'data-computer', data: null },
        { type: 'tool-invocation', toolInvocation: { toolName: 'computer_create', state: 'call' } },
        {
          type: 'tool-invocation',
          toolInvocation: { toolName: 'computer_type', state: 'result', result: { computer: { id: 'x' } } },
        },
      ]),
    ]);
    expect(computers.size).toBe(0);
  });
});

describe('requestComputerSession', () => {
  const base = {
    computerId: 'a b/c',
    threadId: 't',
    resourceId: 'r',
    mode: 'control' as const,
    baseUrl: TEST_BASE_URL,
  };

  it('posts the thread scope and mode with Studio headers, never in the URL', async () => {
    serveSession(() => ready('abc'));
    const result = await requestComputerSession({ ...base, headers: { authorization: 'Bearer secret' } });
    expect(result).toEqual({ state: 'ready', socketUrl: `${WS_BASE}/computer/c1/websockify?ticket=abc` });
    expect(requests[0]).toMatchObject({
      computerId: 'a b/c',
      body: { threadId: 't', resourceId: 'r', mode: 'control' },
    });
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer secret');
  });

  it.each([
    [() => HttpResponse.json({ state: 'forbidden' }, { status: 403 }), 'forbidden'],
    [() => new HttpResponse(null, { status: 404 }), 'unavailable'],
    [() => HttpResponse.json({ state: 'unavailable' }), 'unavailable'],
    [() => HttpResponse.json({ state: 'not-running' }), 'not-running'],
    [() => new HttpResponse(null, { status: 500 }), 'error'],
    [() => HttpResponse.json({ state: 'ready', socketUrl: 'wss://evil.test/x' }), 'error'],
    [() => HttpResponse.json({ state: 'ready', connectUrl: '/computer/c1/connect?ticket=x' }), 'error'],
    [() => HttpResponse.error(), 'error'],
  ])('maps responses to states (%#)', async (reply, state) => {
    serveSession(reply);
    expect((await requestComputerSession(base)).state).toBe(state);
  });
});

describe('ComputerCard', () => {
  it('renders the desktop with the bundled noVNC client over the ticketed socket, view-only while the agent holds it', async () => {
    serveSession();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderThread([message('m1', [computerPart('attached')])]);
    await waitFor(() => expect(live()).toHaveLength(1));
    const [client] = live();
    expect(client.url).toBe(`${WS_BASE}/computer/c1/websockify?ticket=t1`);
    expect(client.options.wsProtocols).toEqual([]);
    expect(client.viewOnly).toBe(true);
    expect(client.scaleViewport).toBe(true);
    expect(client.target).toBe(screen.getByRole('application', { name: 'Computer desktop' }));
    expect(requests[0]?.body).toEqual({ threadId: 'thread-1', resourceId: 'agent-1', mode: 'control' });
    expect(screen.getByText('Agent has control')).toBeTruthy();
    // Nothing served by the sandbox is ever loaded: no iframe, no vnc.html / rfb.js fetch.
    expect(document.querySelector('iframe')).toBeNull();
    await waitFor(() => expect(lease.gets).toBeGreaterThan(0));
    const fetched = fetchSpy.mock.calls.map(([input]) => String(input instanceof Request ? input.url : input));
    expect(
      fetched.filter(u => !u.endsWith('/api/computers/c1/session') && !u.includes('/api/computers/c1/control?')),
    ).toEqual([]);

    act(() => client.dispatchEvent(new Event('connect')));
    expect(screen.queryByText('Starting desktop…')).toBeNull();
  });

  it('Take control and Hand back flip viewOnly on the same connection', async () => {
    serveSession();
    renderThread([message('m1', [computerPart('attached')])]);
    await waitFor(() => expect(live()).toHaveLength(1));
    const client = live()[0];
    expect(client.viewOnly).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Take control' }));
    await waitFor(() => expect(client.viewOnly).toBe(false));
    expect(lease.posts[0]).toEqual({ threadId: 'thread-1', resourceId: 'agent-1', action: 'take' });
    expect(screen.getByText('You have control')).toBeTruthy();

    fireEvent.change(screen.getByRole('textbox', { name: 'Note for the agent' }), { target: { value: 'logged in' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hand back' }));
    await waitFor(() => expect(client.viewOnly).toBe(true));
    expect(lease.posts[1]).toEqual({
      threadId: 'thread-1',
      resourceId: 'agent-1',
      action: 'release',
      note: 'logged in',
    });
    expect(screen.getByText('Agent has control')).toBeTruthy();
    // One session, one connection: holder flips never reconnect.
    expect(requests).toHaveLength(1);
    expect(live()).toEqual([client]);
    expect(rfb.FakeRFB.instances).toHaveLength(1);
  });

  it('follows a lease change made elsewhere through the control poll, without reconnecting', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serveSession();
    renderThread([message('m1', [computerPart('attached')])]);
    await waitFor(() => expect(live()).toHaveLength(1));
    const client = live()[0];
    await waitFor(() => expect(lease.gets).toBe(1));

    lease.holder = 'human';
    await act(() => vi.advanceTimersByTimeAsync(CONTROL_POLL_MS));
    await waitFor(() => expect(client.viewOnly).toBe(false));
    expect(screen.getByRole('button', { name: 'Hand back' })).toBeTruthy();

    lease.holder = 'agent';
    await act(() => vi.advanceTimersByTimeAsync(CONTROL_POLL_MS));
    await waitFor(() => expect(client.viewOnly).toBe(true));
    expect(live()).toEqual([client]);
    expect(requests).toHaveLength(1);
  });

  it('refuses to show a desktop without thread write access, and never retries in watch', async () => {
    serveSession(() => new HttpResponse(null, { status: 403 }));
    renderThread([message('m1', [computerPart('attached')])]);
    expect(await screen.findByText(/need write access to this thread/)).toBeTruthy();
    expect(requests.map(r => r.body.mode)).toEqual(['control']);
    expect(live()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Take control' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hand back' })).toBeNull();
  });

  it('a reconnect while the user holds control starts the new connection interactive', async () => {
    serveSession();
    renderThread([message('m1', [computerPart('attached')])]);
    fireEvent.click(await screen.findByRole('button', { name: 'Take control' }));
    await waitFor(() => expect(live()[0]?.viewOnly).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    await waitFor(() => expect(live()[0]?.url).toContain('ticket=t2'));
    expect(live()[0]?.viewOnly).toBe(false);
  });

  it('drops a poll that started before a take and answered after it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serveSession();
    renderThread([message('m1', [computerPart('attached')])]);
    await waitFor(() => expect(live()).toHaveLength(1));
    const client = live()[0];
    await waitFor(() => expect(lease.gets).toBe(1));

    let answer!: () => void;
    lease.hold = new Promise<void>(r => (answer = r));
    await act(() => vi.advanceTimersByTimeAsync(CONTROL_POLL_MS));
    await waitFor(() => expect(lease.gets).toBe(2));
    fireEvent.click(screen.getByRole('button', { name: 'Take control' }));
    await waitFor(() => expect(client.viewOnly).toBe(false));
    answer();
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(screen.getByText('You have control')).toBeTruthy();
    expect(client.viewOnly).toBe(false);
  });

  it("a thread switch starts view-only: the old thread's control never carries over", async () => {
    serveSession();
    const { rerenderThread } = renderThread([message('m1', [computerPart('attached')])]);
    fireEvent.click(await screen.findByRole('button', { name: 'Take control' }));
    await waitFor(() => expect(live()[0]?.viewOnly).toBe(false));

    lease.hold = new Promise<void>(() => {});
    rerenderThread([message('m1', [computerPart('attached')])], { threadId: 'thread-2', resourceId: scope.resourceId });
    await waitFor(() => expect(requests.some(r => r.body.threadId === 'thread-2')).toBe(true));
    await waitFor(() => expect(live()).toHaveLength(1));
    expect(live()[0].viewOnly).toBe(true);
    expect(screen.getByText('Agent has control')).toBeTruthy();
  });

  it('offers Take control only on a live desktop, but keeps Hand back while the user holds it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    rfb.FakeRFB.autoConnect = false;
    serveSession();
    renderThread([message('m1', [computerPart('attached')])]);
    await waitFor(() => expect(live()).toHaveLength(1));
    expect(screen.queryByRole('button', { name: 'Take control' })).toBeNull();
    act(() => live()[0].dispatchEvent(new Event('connect')));
    fireEvent.click(await screen.findByRole('button', { name: 'Take control' }));
    await screen.findByRole('button', { name: 'Hand back' });
    act(() => live()[0].dispatchEvent(new Event('disconnect')));
    expect(await screen.findByText(/live view disconnected/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hand back' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hand back' }));
    await waitFor(() => expect(lease.holder).toBe('agent'));
    expect(screen.queryByRole('button', { name: 'Take control' })).toBeNull();
  });

  it('drops a take that resolves after the user switched threads', async () => {
    let answer!: () => void;
    const held = new Promise<void>(r => (answer = r));
    serveSession();
    server.use(
      http.post(CONTROL_URL, async () => {
        await held;
        return HttpResponse.json({ holder: 'human', notified: true });
      }),
    );
    const { rerenderThread } = renderThread([message('m1', [computerPart('attached')])]);
    fireEvent.click(await screen.findByRole('button', { name: 'Take control' }));
    lease.hold = new Promise<void>(() => {});
    rerenderThread([message('m1', [computerPart('attached')])], { threadId: 'thread-2', resourceId: scope.resourceId });
    await waitFor(() => expect(requests.some(r => r.body.threadId === 'thread-2')).toBe(true));
    answer();
    await new Promise(r => setTimeout(r, 50));
    expect(screen.getByText('Agent has control')).toBeTruthy();
    expect(live().every(c => c.viewOnly)).toBe(true);
  });

  it("an old thread's pending or failed take never disables or errors the new thread", async () => {
    let answer!: () => void;
    const held = new Promise<void>(r => (answer = r));
    serveSession();
    server.use(
      http.post(CONTROL_URL, async () => {
        await held;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const { rerenderThread } = renderThread([message('m1', [computerPart('attached')])]);
    fireEvent.click(await screen.findByRole('button', { name: 'Take control' }));
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Take control' }) as HTMLButtonElement).disabled).toBe(true),
    );
    rerenderThread([message('m1', [computerPart('attached')])], { threadId: 'thread-2', resourceId: scope.resourceId });
    await waitFor(() => expect(requests.some(r => r.body.threadId === 'thread-2')).toBe(true));
    const take = await screen.findByRole('button', { name: 'Take control' });
    expect((take as HTMLButtonElement).disabled).toBe(false);
    answer();
    await new Promise(r => setTimeout(r, 50));
    expect(screen.queryByText(/Could not change control/)).toBeNull();
    expect((screen.getByRole('button', { name: 'Take control' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('a take that finds the lease already moved does not claim the agent missed it', async () => {
    serveSession();
    renderThread([message('m1', [computerPart('attached')])]);
    const take = await screen.findByRole('button', { name: 'Take control' });
    lease.holder = 'human';
    fireEvent.click(take);
    expect(await screen.findByText('You have control')).toBeTruthy();
    expect(lease.posts).toHaveLength(1);
    expect(screen.queryByText(/agent was not notified/)).toBeNull();
  });

  it('says when the agent was not notified of a hand back', async () => {
    serveSession();
    lease.holder = 'human';
    lease.notified = false;
    renderThread([message('m1', [computerPart('attached')])]);
    fireEvent.click(await screen.findByRole('button', { name: 'Hand back' }));
    expect(await screen.findByText(/agent was not notified/)).toBeTruthy();
  });

  it('reports a failed control change', async () => {
    serveSession();
    renderThread([message('m1', [computerPart('attached')])]);
    await waitFor(() => expect(live()).toHaveLength(1));
    lease.status = 404;
    fireEvent.click(screen.getByRole('button', { name: 'Take control' }));
    expect(await screen.findByText('Could not change control of the computer.')).toBeTruthy();
    expect(live()[0].viewOnly).toBe(true);
  });

  it("shows the agent's request with Hand back, without moving or reconnecting the desktop", async () => {
    serveSession();
    const attached = message('m1', [computerPart('attached')]);
    const { rerenderThread } = renderThread([attached]);
    await waitFor(() => expect(live()).toHaveLength(1));
    const client = live()[0];

    lease.holder = 'human';
    rerenderThread([attached, message('m2', [controlPart()])]);
    const request = screen.getByRole('region', { name: 'Computer control request' });
    expect(request.textContent).toContain('log in please');
    await waitFor(() => expect(client.viewOnly).toBe(false));
    expect(screen.getByText('The agent asked: log in please')).toBeTruthy();
    expect(screen.queryByText('Shown in a later message')).toBeNull();
    expect(live()).toEqual([client]);

    // Hand back from the request prompt reaches the shared state.
    fireEvent.click(within(request).getByRole('button', { name: 'Hand back' }));
    await waitFor(() => expect(client.viewOnly).toBe(true));
    expect(lease.posts).toEqual([{ threadId: 'thread-1', resourceId: 'agent-1', action: 'release' }]);
    expect(within(request).queryByRole('button', { name: 'Hand back' })).toBeNull();
    expect(requests).toHaveLength(1);
  });

  it('reconnects with a fresh ticket and reports a dropped connection', async () => {
    serveSession();
    renderThread([message('m1', [computerPart('attached')])]);
    await waitFor(() => expect(live()).toHaveLength(1));
    act(() => live()[0].dispatchEvent(new Event('disconnect')));
    expect(await screen.findByText(/live view disconnected/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    await waitFor(() => expect(live()[0]?.url).toContain('ticket=t2'));
    expect(live()).toHaveLength(1);
  });

  it('disconnects on unmount', async () => {
    serveSession();
    const { unmount } = renderThread([message('m1', [computerPart('attached')])]);
    await waitFor(() => expect(live()).toHaveLength(1));
    unmount();
    expect(live()).toHaveLength(0);
  });

  it('gives only the latest attachment a live viewer', async () => {
    serveSession();
    renderThread([
      message('m1', [computerPart('attached')]),
      message('m2', [computerPart('released')]),
      message('m3', [computerPart('attached')]),
    ]);
    await waitFor(() => expect(live()).toHaveLength(1));
    expect(screen.getAllByText('Shown in a later message')).toHaveLength(2);
    expect(requests).toHaveLength(1);
  });

  it('shows released computers without requesting a session', async () => {
    serveSession();
    renderThread([message('m1', [computerPart('attached')]), message('m2', [computerPart('released')])]);
    expect(screen.getAllByText('Computer released')).toHaveLength(2);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(requests).toHaveLength(0);
    expect(rfb.FakeRFB.instances).toHaveLength(0);
  });

  it('connects from the attach tool call when a reloaded thread has no data parts', async () => {
    serveSession();
    renderThread([message('m1', [attachResult()])]);
    await waitFor(() => expect(live()).toHaveLength(1));
    expect(requests).toHaveLength(1);
    expect(requests[0]?.body).toEqual({ threadId: 'thread-1', resourceId: 'agent-1', mode: 'control' });
  });

  it('shows one live card when both the tool call and its data part are present', async () => {
    serveSession();
    renderThread([message('m1', [attachResult(), computerPart('attached')])]);
    await waitFor(() => expect(live()).toHaveLength(1));
    expect(screen.queryByText('Shown in a later message')).toBeNull();
    expect(screen.getAllByRole('region', { name: 'Computer Desk' })).toHaveLength(1);
  });

  it('stops connecting a reloaded thread once a release result follows', async () => {
    serveSession();
    renderThread([message('m1', [attachResult()]), message('m2', [releaseResult()])]);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(requests).toHaveLength(0);
    expect(rfb.FakeRFB.instances).toHaveLength(0);
  });

  it('never connects without a thread scope', async () => {
    serveSession();
    renderThread([message('m1', [computerPart('attached')])], null);
    expect(screen.getByText('Desk')).toBeTruthy();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(requests).toHaveLength(0);
  });

  it('requests again with the new thread when the thread changes', async () => {
    serveSession();
    const { rerenderThread } = renderThread([message('m1', [computerPart('attached')])]);
    await waitFor(() => expect(live()).toHaveLength(1));
    rerenderThread([message('m1', [computerPart('attached')])], { threadId: 'thread-2', resourceId: 'agent-1' });
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]?.body.threadId).toBe('thread-2');
    await waitFor(() => expect(live()).toHaveLength(1));
  });

  it.each([
    [
      () => HttpResponse.json({ state: 'forbidden' }, { status: 403 }),
      'You need write access to this thread to view its computer, or the computer is not attached here.',
    ],
    [() => new HttpResponse(null, { status: 404 }), 'Live view is not available on this server.'],
    [() => HttpResponse.json({ state: 'not-running' }), 'The computer is not running yet.'],
  ])('explains a session that cannot open (%#)', async (reply, text) => {
    serveSession(reply);
    renderThread([message('m1', [computerPart('attached')])]);
    expect(await screen.findByText(text)).toBeTruthy();
    expect(rfb.FakeRFB.instances).toHaveLength(0);
  });

  it('polls a not-running computer until it is ready', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let calls = 0;
    serveSession(() => (calls++ === 0 ? HttpResponse.json({ state: 'not-running' }) : ready()));
    renderThread([message('m1', [computerPart('attached')])]);
    await screen.findByText('The computer is not running yet.');
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    await waitFor(() => expect(live()).toHaveLength(1));
  });

  it('times out a desktop that never connects, and not one that does', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    rfb.FakeRFB.autoConnect = false;
    serveSession();
    renderThread([
      message('m1', [computerPart('attached')]),
      message('m2', [computerPart('attached', { computerId: 'c2', name: 'Other' })]),
    ]);
    await waitFor(() => expect(live()).toHaveLength(2));
    act(() => live()[0].dispatchEvent(new Event('connect')));
    act(() => vi.advanceTimersByTime(CONNECT_TIMEOUT_MS));
    expect(screen.getAllByText('The desktop did not connect in time.')).toHaveLength(1);
  });

  it('renders no card for threads without computers', () => {
    serveSession();
    renderThread([message('m1', [{ type: 'data-other', data: {} }])]);
    expect(screen.queryByRole('region')).toBeNull();
    expect(requests).toHaveLength(0);
  });
});
