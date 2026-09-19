import { describe, it, expect, vi } from 'vitest';
import { AgentControllerSession } from './agent-controller';

describe('session browser client', () => {
  it('uses auth headers and exact thread identity, parses split SSE and cancels', async () => {
    const cancel = vi.fn();
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    const fetch = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(c) {
              stream = c;
            },
            cancel,
          }),
        ),
    );
    const session = new AgentControllerSession(
      { baseUrl: 'https://test.invalid', headers: { Authorization: 'Bearer test-only' }, fetch },
      'code',
      'user:a',
      'thread:t',
      't',
    );
    const events = vi.fn();
    const errors = vi.fn();
    const subscription = await session.browser('launch').subscribe({ onEvent: events, onError: errors });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('sessionThreadId=t');
    expect(url).toContain('incarnation=launch');
    expect(url).not.toContain('Bearer');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer test-only' });
    const encoder = new TextEncoder();
    stream.enqueue(encoder.encode(': heartbeat\r\n\r\ndata: {"type":"sta'));
    stream.enqueue(encoder.encode('te","state":null,"incarnation":"launch"}\r\n\r\n'));
    await vi.waitFor(() => expect(events).toHaveBeenCalledWith({ type: 'state', state: null, incarnation: 'launch' }));
    subscription.unsubscribe();
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
    expect(errors).not.toHaveBeenCalled();
  });

  it('does not retry non-idempotent input on failure', async () => {
    const fetch = vi.fn(async () => new Response('failed', { status: 503 }));
    const session = new AgentControllerSession(
      { baseUrl: 'https://test.invalid', fetch },
      'code',
      'user:a',
      'thread:t',
      't',
    );
    await expect(session.browser('launch').command({ type: 'text', text: 'hello' })).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toContain('/browser/commands?');
  });

  it('requires exact thread binding', () => {
    const session = new AgentControllerSession({ baseUrl: 'https://test.invalid' }, 'code', 'user:a');
    expect(() => session.browser('launch')).toThrow('sessionThreadId');
  });

  it('coalesces pending resize events while preserving text order and completion', async () => {
    const requests: any[] = [];
    const release: Array<() => void> = [];
    const fetch = vi.fn(async (_url: unknown, init: RequestInit) => {
      requests.push(JSON.parse(init.body as string));
      await new Promise<void>(resolve => release.push(resolve));
      return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
    });
    const viewer = new AgentControllerSession(
      { baseUrl: 'https://test.invalid', fetch },
      'code',
      'user:a',
      'thread:t',
      't',
    ).browser('launch');
    const first = viewer.command({ type: 'text', text: 'a' });
    const prefs = { width: 640, height: 480, deviceScaleFactor: 1, locale: 'en-US' };
    let completed = false;
    const resize1 = viewer.command({ type: 'preferences', preferences: prefs }).then(() => {
      completed = true;
    });
    const resize2 = viewer.command({ type: 'preferences', preferences: { ...prefs, width: 900 } });
    const last = viewer.command({ type: 'text', text: 'b' });
    expect(completed).toBe(false);
    await vi.waitFor(() => expect(release).toHaveLength(1));
    release[0]();
    await first;
    await vi.waitFor(() => expect(release).toHaveLength(2));
    expect(requests[1]).toMatchObject({ type: 'preferences', preferences: { width: 900 } });
    expect(completed).toBe(false);
    release[1]();
    await Promise.all([resize1, resize2]);
    await vi.waitFor(() => expect(release).toHaveLength(3));
    release[2]();
    await last;
    expect(requests.map(item => item.type)).toEqual(['text', 'preferences', 'text']);
    viewer.dispose();
  });

  it('cancels in-flight input and rejects queued input when disposed', async () => {
    const fetch = vi.fn(async (_url: unknown, init: RequestInit) => {
      await new Promise<void>((_resolve, reject) =>
        init.signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true }),
      );
      return new Response('{}');
    });
    const viewer = new AgentControllerSession(
      { baseUrl: 'https://test.invalid', fetch },
      'code',
      'user:a',
      'thread:t',
      't',
    ).browser('launch');
    const first = viewer.command({ type: 'text', text: 'a' });
    const second = viewer.command({ type: 'text', text: 'b' });
    const settled = Promise.allSettled([first, second]);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    viewer.dispose();
    expect((await settled).map(item => item.status)).toEqual(['rejected', 'rejected']);
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(viewer.command({ type: 'reload' })).rejects.toThrow('disposed');
  });
});
