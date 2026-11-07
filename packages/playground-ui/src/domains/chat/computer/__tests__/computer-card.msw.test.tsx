// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DataPartRenderer } from '../../messages/renderers/data-part-renderer';
import { IFRAME_LOAD_TIMEOUT_MS, requestComputerSession } from '../computer-session';
import { deriveComputers } from '../computer-state';
import { ComputerThreadProvider } from '../computer-thread-context';
import type { ComputerThreadScope } from '../computer-thread-context';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

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

const attachResult = (toolName = 'computer_create'): Part => ({
  type: 'tool-invocation',
  toolInvocation: {
    toolCallId: `call-${toolName}`,
    toolName,
    state: 'result',
    args: {},
    result: { computer: { id: 'c1', name: 'Desk', template: 'desktop', status: 'running', persistent: true } },
  },
});

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
  HttpResponse.json({ state: 'ready', connectUrl: `/computer/c1/connect?ticket=${ticket}` });

/** Renders a thread transcript the way MessageRow does: one DataPartRenderer per data part. */
function renderThread(messages: MastraDBMessage[], threadScope: ComputerThreadScope | null = scope) {
  const tree = (msgs: MastraDBMessage[], s: ComputerThreadScope | null) => (
    <ComputerThreadProvider messages={msgs} scope={s ?? undefined}>
      {msgs.flatMap(m =>
        (m.content.parts as Part[]).map((part, index) =>
          String(part.type).startsWith('data-') ? (
            <DataPartRenderer key={`${m.id}-${index}`} part={part as never} messageId={m.id} partIndex={index} />
          ) : null,
        ),
      )}
    </ComputerThreadProvider>
  );
  const utils = renderWithProviders(tree(messages, threadScope));
  return { ...utils, rerenderThread: (msgs: MastraDBMessage[], s = threadScope) => utils.rerender(tree(msgs, s)) };
}

beforeEach(() => {
  requests = [];
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

  it('uses create/attach results only to mark a computer attached', () => {
    expect(deriveComputers([message('m1', [attachResult('computer_attach')])]).get('c1')).toMatchObject({
      status: 'attached',
      persistent: true,
    });
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
    expect(result).toEqual({ state: 'ready', connectUrl: `${TEST_BASE_URL}/computer/c1/connect?ticket=abc` });
    expect(requests[0]).toMatchObject({ computerId: 'a b/c', body: { threadId: 't', resourceId: 'r', mode: 'control' } });
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer secret');
  });

  it.each([
    [() => HttpResponse.json({ state: 'forbidden' }, { status: 403 }), 'forbidden'],
    [() => new HttpResponse(null, { status: 404 }), 'unavailable'],
    [() => HttpResponse.json({ state: 'unavailable' }), 'unavailable'],
    [() => HttpResponse.json({ state: 'not-running' }), 'not-running'],
    [() => new HttpResponse(null, { status: 500 }), 'error'],
    [() => HttpResponse.json({ state: 'ready', connectUrl: 'https://evil.test/x' }), 'error'],
    [() => HttpResponse.error(), 'error'],
  ])('maps responses to states (%#)', async (reply, state) => {
    serveSession(reply);
    expect((await requestComputerSession(base)).state).toBe(state);
  });
});

describe('ComputerCard', () => {
  it('connects the owning card in Watch mode and reconnects in control on Take over', async () => {
    serveSession();
    renderThread([message('m1', [computerPart('attached')])]);
    const frame = await screen.findByTitle('Computer desktop');
    expect(frame.getAttribute('src')).toBe(`${TEST_BASE_URL}/computer/c1/connect?ticket=t1`);
    expect(requests[0]?.body).toEqual({ threadId: 'thread-1', resourceId: 'agent-1', mode: 'watch' });

    fireEvent.click(screen.getByRole('radio', { name: 'Take over' }));
    await waitFor(() => expect(screen.getByTitle('Computer desktop').getAttribute('src')).toContain('ticket=t2'));
    expect(requests[1]?.body.mode).toBe('control');
    expect(screen.getByText('You are controlling the desktop')).toBeTruthy();
  });

  it('gives only the latest attachment a live viewer', async () => {
    serveSession();
    renderThread([
      message('m1', [computerPart('attached')]),
      message('m2', [computerPart('released')]),
      message('m3', [computerPart('attached')]),
    ]);
    expect(await screen.findAllByTitle('Computer desktop')).toHaveLength(1);
    expect(screen.getAllByText('Shown in a later message')).toHaveLength(2);
    expect(requests).toHaveLength(1);
  });

  it('shows released computers without requesting a session', async () => {
    serveSession();
    renderThread([message('m1', [computerPart('attached')]), message('m2', [computerPart('released')])]);
    expect(screen.getAllByText('Computer released')).toHaveLength(2);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(requests).toHaveLength(0);
    expect(screen.queryByTitle('Computer desktop')).toBeNull();
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
    await screen.findByTitle('Computer desktop');
    rerenderThread([message('m1', [computerPart('attached')])], { threadId: 'thread-2', resourceId: 'agent-1' });
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]?.body.threadId).toBe('thread-2');
  });

  it.each([
    [() => HttpResponse.json({ state: 'forbidden' }, { status: 403 }), 'This computer is not attached to this thread.'],
    [() => new HttpResponse(null, { status: 404 }), 'Live view is not available on this server.'],
    [() => HttpResponse.json({ state: 'not-running' }), 'The computer is not running yet.'],
  ])('explains a session that cannot open (%#)', async (reply, text) => {
    serveSession(reply);
    renderThread([message('m1', [computerPart('attached')])]);
    expect(await screen.findByText(text)).toBeTruthy();
    expect(screen.queryByTitle('Computer desktop')).toBeNull();
  });

  it('accepts status messages only from its own frame and server origin', async () => {
    serveSession();
    renderThread([message('m1', [computerPart('attached')])]);
    const frame = (await screen.findByTitle('Computer desktop')) as HTMLIFrameElement;
    const post = (data: unknown, origin: string, source: MessageEventSource | null) =>
      act(() => window.dispatchEvent(new MessageEvent('message', { data, origin, source })));

    post({ type: 'mastra-computer-status', code: 429 }, 'http://evil.test', frame.contentWindow);
    post({ type: 'mastra-computer-status', code: 429 }, TEST_BASE_URL, window);
    post({ type: 'mastra-computer-status', code: 999 }, TEST_BASE_URL, frame.contentWindow);
    expect(screen.queryByText(/Too many viewers/)).toBeNull();

    post({ type: 'mastra-computer-status', code: 429 }, TEST_BASE_URL, frame.contentWindow);
    expect(screen.getByText(/Too many viewers/)).toBeTruthy();
    post({ type: 'mastra-computer-status', code: 401 }, TEST_BASE_URL, frame.contentWindow);
    expect(screen.getByText(/no longer authorized/)).toBeTruthy();
  });

  it('times out a frame that never loads', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serveSession();
    renderThread([message('m1', [computerPart('attached')])]);
    await screen.findByTitle('Computer desktop');
    expect(screen.getByText('Starting desktop…')).toBeTruthy();
    act(() => vi.advanceTimersByTime(IFRAME_LOAD_TIMEOUT_MS));
    expect(screen.getByText('The desktop did not load in time.')).toBeTruthy();
  });

  it('clears the load timer once the frame loads', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serveSession();
    renderThread([message('m1', [computerPart('attached')])]);
    const frame = await screen.findByTitle('Computer desktop');
    fireEvent.load(frame);
    expect(screen.queryByText('Starting desktop…')).toBeNull();
    act(() => vi.advanceTimersByTime(IFRAME_LOAD_TIMEOUT_MS));
    expect(screen.queryByText('The desktop did not load in time.')).toBeNull();
  });

  it('opens a tab synchronously and navigates it after the session is minted', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    serveSession(async () => {
      if (requests.length > 1) await gate;
      return ready();
    });
    const tab = { opener: {} as unknown, close: vi.fn(), location: { replace: vi.fn() } };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    renderThread([message('m1', [computerPart('attached')])]);
    await screen.findByTitle('Computer desktop');

    fireEvent.click(screen.getByRole('button', { name: 'Open in tab' }));
    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(tab.opener).toBeNull();
    expect(tab.location.replace).not.toHaveBeenCalled();
    release();
    await waitFor(() => expect(tab.location.replace).toHaveBeenCalledWith(`${TEST_BASE_URL}/computer/c1/connect?ticket=t2`));
    expect(requests[1]?.body.mode).toBe('watch');
  });

  it('closes the tab when the session cannot be minted', async () => {
    serveSession(() => (requests.length > 1 ? HttpResponse.json({}, { status: 403 }) : ready()));
    const tab = { opener: {}, close: vi.fn(), location: { replace: vi.fn() } };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    renderThread([message('m1', [computerPart('attached')])]);
    await screen.findByTitle('Computer desktop');
    fireEvent.click(screen.getByRole('button', { name: 'Open in tab' }));
    await waitFor(() => expect(tab.close).toHaveBeenCalled());
    expect(tab.location.replace).not.toHaveBeenCalled();
    expect(screen.getByText('This computer is not attached to this thread.')).toBeTruthy();
  });

  it('renders no card for threads without computers', () => {
    serveSession();
    renderThread([message('m1', [{ type: 'data-other', data: {} }])]);
    expect(screen.queryByRole('region')).toBeNull();
    expect(requests).toHaveLength(0);
  });
});

