// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://studio.example.com"}
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { browserStreamTicketResponse } from '../../utils/__tests__/fixtures/browser-stream-ticket';
import { useBrowserStream } from '../use-browser-stream';
import { StudioConfigContext } from '@/domains/configuration/context/studio-config-state';
import { server } from '@/test/msw-server';

const BASE_URL = 'https://studio.example.com';
const TICKET_URL = `${BASE_URL}/api/agents/support-bot/browser/stream-ticket`;

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
  }
}

const createWrapper =
  (headers: Record<string, string>) =>
  ({ children }: { children: React.ReactNode }) => (
    <StudioConfigContext.Provider value={{ baseUrl: BASE_URL, headers, isLoading: false, setConfig: () => {} }}>
      {children}
    </StudioConfigContext.Provider>
  );

describe('useBrowserStream', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
    server.use(http.post(TICKET_URL, () => HttpResponse.json(browserStreamTicketResponse)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('when studio authenticates every request with an Authorization header', () => {
    it('connects with the issued ticket instead of the reusable token', async () => {
      const { result } = renderHook(() => useBrowserStream({ agentId: 'support-bot', threadId: 'thread-1' }), {
        wrapper: createWrapper({ Authorization: 'Bearer abc123' }),
      });

      act(() => result.current.connect());

      await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
      expect(FakeWebSocket.instances[0].url).toBe(
        `wss://studio.example.com/browser/support-bot/stream?threadId=thread-1&ticket=${browserStreamTicketResponse.ticket}`,
      );
      expect(FakeWebSocket.instances[0].url).not.toContain('abc123');
    });

    it('never places the reusable token in the socket URL', async () => {
      server.use(http.post(TICKET_URL, () => new HttpResponse(null, { status: 401 })));

      const { result } = renderHook(() => useBrowserStream({ agentId: 'support-bot', threadId: 'thread-1' }), {
        wrapper: createWrapper({ Authorization: 'Bearer abc123' }),
      });

      act(() => result.current.connect());

      await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
      expect(FakeWebSocket.instances[0].url).toBe(
        'wss://studio.example.com/browser/support-bot/stream?threadId=thread-1',
      );
    });
  });

  describe('when studio authenticates with a session cookie', () => {
    it('opens the stream with the issued ticket', async () => {
      const { result } = renderHook(() => useBrowserStream({ agentId: 'support-bot', threadId: 'thread-1' }), {
        wrapper: createWrapper({}),
      });

      act(() => result.current.connect());

      await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
      expect(FakeWebSocket.instances[0].url).toBe(
        `wss://studio.example.com/browser/support-bot/stream?threadId=thread-1&ticket=${browserStreamTicketResponse.ticket}`,
      );
    });

    it('opens the stream without a ticket when the route is unavailable', async () => {
      server.use(http.post(TICKET_URL, () => new HttpResponse(null, { status: 404 })));

      const { result } = renderHook(() => useBrowserStream({ agentId: 'support-bot', threadId: 'thread-1' }), {
        wrapper: createWrapper({}),
      });

      act(() => result.current.connect());

      await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
      expect(FakeWebSocket.instances[0].url).toBe(
        'wss://studio.example.com/browser/support-bot/stream?threadId=thread-1',
      );
    });
  });

  describe('when the socket reconnects', () => {
    it('mints a fresh ticket for each attempt', async () => {
      let issued = 0;
      server.use(
        http.post(TICKET_URL, () => {
          issued += 1;
          return HttpResponse.json({ ...browserStreamTicketResponse, ticket: `ticket-${issued}` });
        }),
      );

      const { result } = renderHook(() => useBrowserStream({ agentId: 'support-bot', threadId: 'thread-1' }), {
        wrapper: createWrapper({}),
      });

      act(() => result.current.connect());
      await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));

      act(() => result.current.connect());
      await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));

      expect(FakeWebSocket.instances.map(ws => ws.url)).toEqual([
        'wss://studio.example.com/browser/support-bot/stream?threadId=thread-1&ticket=ticket-1',
        'wss://studio.example.com/browser/support-bot/stream?threadId=thread-1&ticket=ticket-2',
      ]);
    });
  });
});
