import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SlackRtmClient } from './slack-rtm-client.js';

// ── Mock WebSocket ──────────────────────────────────────────────────

type MockListener = (event: { data?: string; type?: string }) => void;

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static CLOSING = 2;
  static CONNECTING = 0;

  static instances: MockWebSocket[] = [];
  static lastInstance: MockWebSocket | undefined;

  url: string;
  readyState = MockWebSocket.CONNECTING;
  private listeners = new Map<string, Set<MockListener>>();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    MockWebSocket.lastInstance = this;
    // Simulate async open
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.#emit('open', {});
    }, 0);
  }

  addEventListener(type: string, listener: MockListener): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: MockListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  send(_data: string): void {
    // no-op in mock — tests can inspect calls if needed
  }

  close(_code?: number, _reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    this.#emit('close', {});
  }

  /** Test helper: simulate receiving a message from Slack */
  receive(data: unknown): void {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    this.#emit('message', { data: text });
  }

  /** Test helper: simulate an error event */
  error(): void {
    this.#emit('error', {});
  }

  /** Test helper: simulate a close event */
  closeFromServer(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.#emit('close', {});
  }

  #emit(type: string, event: { data?: string; type?: string }): void {
    const set = this.listeners.get(type);
    if (set) {
      for (const listener of set) listener(event);
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function rtmConnectResponse(url = 'wss://mock.slack.com/websocket/test'): Response {
  return jsonResponse({
    ok: true,
    url,
    self: { id: 'U123', name: 'test' },
    team: { id: 'T123', name: 'Test', domain: 'test' },
  });
}

function createClient(options?: Partial<{ token: string; baseUrl: string; fetch: typeof fetch; pingIntervalMs: number; reconnectBaseMs: number; reconnectMaxMs: number }>) {
  const fetchMock = vi.fn(async () => rtmConnectResponse());
  const client = new SlackRtmClient({
    token: 'xoxp-test',
    fetch: fetchMock as any,
    pingIntervalMs: 1000,
    reconnectBaseMs: 50,
    reconnectMaxMs: 200,
    ...options,
  });
  return { client, fetchMock };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('SlackRtmClient', () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    MockWebSocket.lastInstance = undefined;
    globalThis.WebSocket = MockWebSocket as any;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
  });

  it('calls rtm.connect and opens a WebSocket from the returned URL', async () => {
    const { client, fetchMock } = createClient();

    await client.connect();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://slack.com/api/rtm.connect',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(MockWebSocket.lastInstance?.url).toBe('wss://mock.slack.com/websocket/test');
  });

  it('emits connected lifecycle event after receiving hello', async () => {
    const { client } = createClient();
    const states: string[] = [];
    client.onLifecycle(state => states.push(state));

    await client.connect();
    // Wait for async open + hello
    await vi.waitFor(() => expect(MockWebSocket.lastInstance).toBeDefined());
    MockWebSocket.lastInstance!.receive({ type: 'hello' });

    expect(states).toContain('connecting');
    expect(states).toContain('connected');
    expect(client.connected).toBe(true);
  });

  it('dispatches message events to onMessage handlers', async () => {
    const { client } = createClient();
    const messages: any[] = [];
    client.onMessage(msg => messages.push(msg));

    await client.connect();
    await vi.waitFor(() => expect(MockWebSocket.lastInstance).toBeDefined());
    MockWebSocket.lastInstance!.receive({ type: 'hello' });

    MockWebSocket.lastInstance!.receive({
      type: 'message',
      user: 'U123',
      text: 'hello world',
      ts: '1525215129.000001',
      channel: 'C123',
      channel_type: 'channel',
      event_ts: '1525215129.000001',
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      type: 'message',
      ts: '1525215129.000001',
      channel: 'C123',
      channelType: 'channel',
      user: 'U123',
      text: 'hello world',
    });
  });

  it('closes the WebSocket on disconnect', async () => {
    const { client } = createClient();
    const states: string[] = [];
    client.onLifecycle(state => states.push(state));

    await client.connect();
    await vi.waitFor(() => expect(MockWebSocket.lastInstance).toBeDefined());
    MockWebSocket.lastInstance!.receive({ type: 'hello' });

    const ws = MockWebSocket.lastInstance!;
    const closeSpy = vi.spyOn(ws, 'close');

    client.disconnect();

    expect(closeSpy).toHaveBeenCalled();
    expect(client.connected).toBe(false);
    expect(states).toContain('disconnected');
  });

  it('schedules reconnect with exponential backoff on unexpected close', async () => {
    const { client } = createClient({ reconnectBaseMs: 10, reconnectMaxMs: 50 });
    const states: string[] = [];
    client.onLifecycle(state => states.push(state));

    await client.connect();
    await vi.waitFor(() => expect(MockWebSocket.lastInstance).toBeDefined());
    MockWebSocket.lastInstance!.receive({ type: 'hello' });

    // Simulate server-side close
    MockWebSocket.lastInstance!.closeFromServer();

    // Should transition to reconnecting, then connecting again
    await vi.waitFor(() => expect(states).toContain('reconnecting'));
    await vi.waitFor(() => expect(states.filter(s => s === 'connecting').length).toBeGreaterThanOrEqual(2));
  });

  it('does not reconnect after manual disconnect', async () => {
    const { client } = createClient({ reconnectBaseMs: 10 });
    const states: string[] = [];
    client.onLifecycle(state => states.push(state));

    await client.connect();
    await vi.waitFor(() => expect(MockWebSocket.lastInstance).toBeDefined());
    MockWebSocket.lastInstance!.receive({ type: 'hello' });

    client.disconnect();

    const stateCountBefore = states.length;
    client.disconnect();

    await new Promise(resolve => setTimeout(resolve, 100));

    // No reconnect states should appear after manual disconnect
    const statesAfter = states.slice(stateCountBefore);
    expect(statesAfter).not.toContain('reconnecting');
    expect(statesAfter).not.toContain('connecting');
    expect(client.connected).toBe(false);
  });

  it('handles reconnect_url event for seamless reconnection', async () => {
    const { client } = createClient();

    await client.connect();
    await vi.waitFor(() => expect(MockWebSocket.lastInstance).toBeDefined());
    MockWebSocket.lastInstance!.receive({ type: 'hello' });

    MockWebSocket.lastInstance!.receive({
      type: 'reconnect_url',
      url: 'wss://new.slack.com/websocket/fresh',
    });

    // Trigger a reconnect — should use the reconnect URL instead of calling rtm.connect again
    // The reconnect_url handler stores it; next reconnect uses it
    MockWebSocket.lastInstance!.closeFromServer();

    await vi.waitFor(() => expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2));
    // Second instance should use the reconnect URL
    expect(MockWebSocket.instances[1]!.url).toBe('wss://new.slack.com/websocket/fresh');
  });

  it('throws on rtm.connect API error', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ ok: false, error: 'not_authed' }),
    );
    const client = new SlackRtmClient({
      token: 'xoxp-bad',
      fetch: fetchMock as any,
      reconnectBaseMs: 10,
    });

    await expect(client.connect()).rejects.toThrow('rtm.connect failed: not_authed');
  });
});
