// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://studio.example.com"}
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BrowserSessionProvider } from '../browser-session-provider';
import { liveBrowserSession } from './fixtures/browser-session';
import { StudioConfigContext } from '@/domains/configuration/context/studio-config-state';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

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

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send() {}

  close() {
    this.readyState = FakeWebSocket.CLOSED;
  }
}

const Wrapper = ({ headers, children }: { headers: Record<string, string>; children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <StudioConfigContext.Provider value={{ baseUrl: BASE_URL, headers, isLoading: false, setConfig: () => {} }}>
      <MastraReactProvider baseUrl={BASE_URL} headers={headers}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <BrowserSessionProvider agentId="support-bot" threadId="thread-1">
              {children}
            </BrowserSessionProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </MastraReactProvider>
    </StudioConfigContext.Provider>
  );
};

describe('BrowserSessionProvider', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
    server.use(
      http.get(`${BASE_URL}/api/agents/:agentId/browser/session`, () => HttpResponse.json(liveBrowserSession)),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('when studio authenticates every request with an Authorization header', () => {
    it('presents that token as the apiKey query parameter on the stream socket', async () => {
      server.use(
        http.get(`${BASE_URL}/api/agents/:agentId/browser/session`, ({ request }) =>
          request.headers.has('authorization')
            ? HttpResponse.json(liveBrowserSession)
            : new HttpResponse(null, { status: 401 }),
        ),
      );

      render(<Wrapper headers={{ Authorization: 'Bearer abc123' }}>{null}</Wrapper>);

      await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
      expect(FakeWebSocket.instances[0].url).toBe(
        'wss://studio.example.com/browser/support-bot/stream?threadId=thread-1&apiKey=abc123',
      );
    });
  });

  describe('when studio authenticates with a session cookie', () => {
    it('opens the stream without a token', async () => {
      render(<Wrapper headers={{}}>{null}</Wrapper>);

      await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
      expect(FakeWebSocket.instances[0].url).toBe(
        'wss://studio.example.com/browser/support-bot/stream?threadId=thread-1',
      );
    });
  });
});
