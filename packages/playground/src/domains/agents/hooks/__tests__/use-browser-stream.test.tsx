// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://studio.example.com"}
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useBrowserStream } from '../use-browser-stream';
import { StudioConfigContext } from '@/domains/configuration/context/studio-config-state';

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
    <StudioConfigContext.Provider
      value={{ baseUrl: 'https://studio.example.com', headers, isLoading: false, setConfig: () => {} }}
    >
      {children}
    </StudioConfigContext.Provider>
  );

describe('useBrowserStream', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('when studio authenticates every request with an Authorization header', () => {
    it('presents that token as the apiKey query parameter', () => {
      const { result } = renderHook(() => useBrowserStream({ agentId: 'support-bot', threadId: 'thread-1' }), {
        wrapper: createWrapper({ Authorization: 'Bearer abc123' }),
      });

      act(() => result.current.connect());

      expect(FakeWebSocket.instances.map(ws => ws.url)).toEqual([
        'wss://studio.example.com/browser/support-bot/stream?threadId=thread-1&apiKey=abc123',
      ]);
    });
  });

  describe('when studio authenticates with a session cookie', () => {
    it('opens the stream without a token', () => {
      const { result } = renderHook(() => useBrowserStream({ agentId: 'support-bot', threadId: 'thread-1' }), {
        wrapper: createWrapper({}),
      });

      act(() => result.current.connect());

      expect(FakeWebSocket.instances.map(ws => ws.url)).toEqual([
        'wss://studio.example.com/browser/support-bot/stream?threadId=thread-1',
      ]);
    });
  });
});
