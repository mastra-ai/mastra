// @vitest-environment jsdom
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

// The agent builder opts into the agent-signals transport
// (`enableThreadSignals: true` + a `threadId`), so a send first subscribes to
// the thread (`POST /threads/subscribe`) and then dispatches a signal
// (`POST /signals`). The user turn + per-call instructions ride on the signal's
// `ifIdle.streamOptions`, NOT on a legacy `stream-until-idle` request body.
const stubThreadSubscription = () =>
  http.post(`${BASE_URL}/api/agents/builder-agent/threads/subscribe`, () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    return new HttpResponse(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  });

describe('StreamChatProvider — modelSettings.instructions on the wire', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  afterEach(() => {
    cleanup();
  });

  it('flattens modelSettings.instructions onto the signal and excludes it from the signal contents', async () => {
    const captured: CapturedRequest = { body: null };

    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
      stubThreadSubscription(),
      http.post(`${BASE_URL}/api/agents/builder-agent/signals`, async ({ request }) => {
        captured.body = await request.json();
        return HttpResponse.json({ accepted: true, runId: 'run-1' });
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

    // Allow the subscription + signal requests to be issued + intercepted.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(captured.body).toBeTruthy();

    const streamOptions = captured.body.ifIdle?.streamOptions;
    expect(streamOptions).toBeTruthy();

    // The React layer flattens `modelSettings.instructions` to a top-level
    // `instructions` field on the signal's stream options
    // (see client-sdks/react/src/agent/hooks.ts).
    expect(streamOptions.instructions).toBe(snapshot);

    // Supplying extraInstructions must NOT drop the rest of modelSettings.
    // maxSteps is sent top-level on the stream options; the remaining settings
    // live under modelSettings (maxTokens is serialized as maxOutputTokens).
    expect(streamOptions.maxSteps).toBe(100);
    expect(streamOptions.modelSettings.maxRetries).toBe(3);
    expect(streamOptions.modelSettings.maxOutputTokens).toBe(5000);
    expect(streamOptions.modelSettings.temperature).toBe(1);

    // Confirm the snapshot is NOT smuggled into the user-facing signal contents.
    const serializedContents = JSON.stringify(captured.body.signal?.contents ?? []);
    expect(serializedContents).not.toContain('Current agent configuration');
    expect(serializedContents).not.toContain('Customer Support Bot');
    expect(serializedContents).toContain('Hello agent');
  });

  it('does not include `instructions` on the signal when extraInstructions is omitted', async () => {
    const captured: CapturedRequest = { body: null };

    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
      stubThreadSubscription(),
      http.post(`${BASE_URL}/api/agents/builder-agent/signals`, async ({ request }) => {
        captured.body = await request.json();
        return HttpResponse.json({ accepted: true, runId: 'run-1' });
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
    expect(captured.body.ifIdle?.streamOptions?.instructions).toBeUndefined();
  });
});
