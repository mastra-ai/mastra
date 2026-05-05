// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { act, cleanup, render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useEffect, useRef } from 'react';
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

describe('StreamChatProvider — modelSettings.instructions on the wire', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  afterEach(() => {
    cleanup();
  });

  it('flattens modelSettings.instructions into the request body and excludes it from the visible message list', async () => {
    const captured: CapturedRequest = { body: null };

    server.use(
      http.post(`${BASE_URL}/api/agents/builder-agent/stream-until-idle`, async ({ request }) => {
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

    const snapshot = '## Current agent configuration\n- Name: "Customer Support Bot"\n- Tools (1): "Web Search" (web-search)';

    await act(async () => {
      render(
        <MastraReactProvider baseUrl={BASE_URL}>
          <StreamChatProvider
            agentId="builder-agent"
            threadId="thread-test"
            initialMessages={[]}
            extraInstructions={snapshot}
          >
            <Composer message="Hello agent" onSent={() => {}} />
          </StreamChatProvider>
        </MastraReactProvider>,
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
      http.post(`${BASE_URL}/api/agents/builder-agent/stream-until-idle`, async ({ request }) => {
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
        <MastraReactProvider baseUrl={BASE_URL}>
          <StreamChatProvider agentId="builder-agent" threadId="thread-test" initialMessages={[]}>
            <Composer message="Hello agent" onSent={() => {}} />
          </StreamChatProvider>
        </MastraReactProvider>,
      );
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(captured.body).toBeTruthy();
    expect(captured.body.instructions).toBeUndefined();
  });
});
