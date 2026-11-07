// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DataPartRenderer } from '../../messages/renderers/data-part-renderer';
import { ComputerCard } from '../computer-card';
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
            return <DataPartRenderer key={`${m.id}-${index}`} part={part as never} messageId={m.id} partIndex={index} />;
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

beforeEach(() => {
  requests = [];
  rfb.FakeRFB.instances = [];
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
    const released = deriveComputers([message('m1', [computerPart('attached')]), message('m2', [computerPart('released')])]);
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
      deriveComputers([message('m1', [attachResult(), releaseResult()]), message('m2', [attachResult('computer_attach')])]).get('c1')
        ?.ownerKey,
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
      deriveComputers([message('m1', [stored(attachResult())]), message('m2', [stored(destroyResult())])]).get('c1')?.status,
    ).toBe('released');
    expect(deriveComputers([message('m1', [toolResult('computer_create', '{not json')])]).size).toBe(0);
    expect(attachedComputerId('computer_create', JSON.stringify(describeComputer('attached')))).toBe('c1');
  });

  it('lets the data part own an attach that also has a result, in either order', () => {
    expect(deriveComputers([message('m1', [attachResult(), computerPart('attached')])]).get('c1')?.ownerKey).toBe('m1:1');
    const afterRelease = deriveComputers([
      message('m1', [computerPart('attached'), attachResult()]),
      message('m2', [computerPart('released')]),
    ]);
    expect(afterRelease.get('c1')?.status).toBe('released');
    // The part keeps ownership when the same attach also produced a result.
    expect(deriveComputers([message('m1', [computerPart('attached'), attachResult()])]).get('c1')?.ownerKey).toBe('m1:0');
  });

  it('ignores malformed parts and results', () => {
    const computers = deriveComputers([
      message('m1', [
        { type: 'data-computer', data: { computerId: 'c1', status: 'gone' } },
        { type: 'data-computer', data: null },
        { type: 'tool-invocation', toolInvocation: { toolName: 'computer_create', state: 'call' } },
        { type: 'tool-invocation', toolInvocation: { toolName: 'computer_type', state: 'result', result: { computer: { id: 'x' } } } },
      ]),
    ]);
    expect(computers.size).toBe(0);
  });
});

describe('requestComputerSession', () => {
  const base = { computerId: 'a b/c', threadId: 't', resourceId: 'r', mode: 'control' as const, baseUrl: TEST_BASE_URL };

  it('posts the thread scope and mode with Studio headers, never in the URL', async () => {
    serveSession(() => ready('abc'));
    const result = await requestComputerSession({ ...base, headers: { authorization: 'Bearer secret' } });
    expect(result).toEqual({ state: 'ready', socketUrl: `${WS_BASE}/computer/c1/websockify?ticket=abc` });
    expect(requests[0]).toMatchObject({ computerId: 'a b/c', body: { threadId: 't', resourceId: 'r', mode: 'control' } });
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
  it('renders the desktop with the bundled noVNC client over the ticketed socket, view-only in Watch', async () => {
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
    expect(requests[0]?.body).toEqual({ threadId: 'thread-1', resourceId: 'agent-1', mode: 'watch' });
    // Nothing served by the sandbox is ever loaded: no iframe, no vnc.html / rfb.js fetch.
    expect(document.querySelector('iframe')).toBeNull();
    const fetched = fetchSpy.mock.calls.map(([input]) => String(input instanceof Request ? input.url : input));
    expect(fetched.filter(u => !u.endsWith('/api/computers/c1/session'))).toEqual([]);

    act(() => client.dispatchEvent(new Event('connect')));
    expect(screen.queryByText('Starting desktop…')).toBeNull();
  });

  it('mints a control ticket on first Take over, then toggles viewOnly live', async () => {
    serveSession();
    renderThread([message('m1', [computerPart('attached')])]);
    await waitFor(() => expect(live()).toHaveLength(1));

    fireEvent.click(screen.getByRole('radio', { name: 'Take over' }));
    await waitFor(() => expect(live()[0]?.url).toContain('ticket=t2'));
    expect(requests[1]?.body.mode).toBe('control');
    expect(rfb.FakeRFB.instances[0]?.disconnected).toBe(true);
    const control = live()[0];
    expect(control.viewOnly).toBe(false);
    expect(screen.getByText('You are controlling the desktop')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'Watch' }));
    expect(control.viewOnly).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: 'Take over' }));
    expect(control.viewOnly).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(requests).toHaveLength(2);
    expect(live()).toEqual([control]);
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
    expect(requests[0]?.body).toEqual({ threadId: 'thread-1', resourceId: 'agent-1', mode: 'watch' });
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
    [() => HttpResponse.json({ state: 'forbidden' }, { status: 403 }), 'This computer is not attached to this thread.'],
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
    serveSession();
    renderThread([message('m1', [computerPart('attached')]), message('m2', [computerPart('attached', { computerId: 'c2', name: 'Other' })])]);
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

