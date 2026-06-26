import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useStreamSend } from '../stream-chat-context';
import { StreamChatProvider } from '../stream-chat-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

interface CapturedRequest {
  body: any;
}

const Composer = ({ message, onSent }: { message: string; onSent: () => void }) => {
  const send = useStreamSend();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    send(message);
    onSent();
  }, [message, send, onSent]);
  return null;
};

const Providers = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('StreamChatProvider — modelSettings.instructions on the wire', () => {
  beforeEach(() => {
    // These tests model the legacy `stream-until-idle` route. Opt out of thread
    // signals so the hook drives that endpoint instead of the signal path.
    (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS = 'false';
    server.resetHandlers();
  });

  afterEach(() => {
    delete (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS;
    cleanup();
  });

  it('flattens modelSettings.instructions into the request body and excludes it from the visible message list', async () => {
    const captured: CapturedRequest = { body: null };

    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
      http.post(`${BASE_URL}/api/agents/builder-agent/stream`, async ({ request }) => {
        captured.body = await request.json();
        // Minimal "no events" response body — useChat closes out cleanly.
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.close();
          },
        });
        return new HttpResponse(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      }),
    );

    const snapshot =
      '## Current agent configuration\n- Name: "Customer Support Bot"\n- Tools (1): "Web Search" (web-search)';

    await act(async () => {
      render(
        <Providers>
          <StreamChatProvider
            agentId="builder-agent"
            threadId="thread-test"
            initialMessages={[]}
            extraInstructions={snapshot}
          >
            <Composer message="Hello agent" onSent={() => {}} />
          </StreamChatProvider>
        </Providers>,
      );
    });

    // Allow the streamed request to be issued + intercepted.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(captured.body).toBeTruthy();

    // The React layer flattens `modelSettings.instructions` to a top-level
    // `instructions` field on the wire (see client-sdks/react/src/agent/hooks.ts:266).
    expect(captured.body.instructions).toBe(snapshot);

    // Supplying extraInstructions must NOT drop the rest of modelSettings.
    // maxSteps is sent top-level; the remaining settings live under
    // modelSettings (maxTokens is serialized as maxOutputTokens on the wire).
    expect(captured.body.maxSteps).toBe(100);
    expect(captured.body.modelSettings.maxRetries).toBe(3);
    expect(captured.body.modelSettings.maxOutputTokens).toBe(5000);
    expect(captured.body.modelSettings.temperature).toBe(1);
    expect(captured.body.providerOptions).toEqual({ openai: { reasoningEffort: 'low' } });

    // Confirm the snapshot is NOT smuggled into the user-facing messages array.
    const messages = captured.body.messages ?? [];
    const serializedMessages = JSON.stringify(messages);
    expect(serializedMessages).not.toContain('Current agent configuration');
    expect(serializedMessages).not.toContain('Customer Support Bot');
    expect(serializedMessages).toContain('Hello agent');
  });

  it('does not include `instructions` on the wire when extraInstructions is omitted', async () => {
    const captured: CapturedRequest = { body: null };

    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
      http.post(`${BASE_URL}/api/agents/builder-agent/stream`, async ({ request }) => {
        captured.body = await request.json();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.close();
          },
        });
        return new HttpResponse(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      }),
    );

    await act(async () => {
      render(
        <Providers>
          <StreamChatProvider agentId="builder-agent" threadId="thread-test" initialMessages={[]}>
            <Composer message="Hello agent" onSent={() => {}} />
          </StreamChatProvider>
        </Providers>,
      );
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(captured.body).toBeTruthy();
    expect(captured.body.instructions).toBeUndefined();
  });
});
