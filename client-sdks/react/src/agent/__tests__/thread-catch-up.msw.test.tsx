// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '../../test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../test/render';
import type { MastraChatProps } from '../hooks';
import { useChat } from '../hooks';

const SUBSCRIBE = `${TEST_BASE_URL}/api/agents/agent-1/threads/subscribe`;
const encoder = new TextEncoder();

// The streams the page follows the thread with, in order: the test writes to them, breaks them, and reads what the
// page asked for each.
function givenThreadStreams() {
  const streams: Array<{ body: unknown; controller: ReadableStreamDefaultController<Uint8Array> }> = [];
  server.use(
    http.post(SUBSCRIBE, async ({ request }) => {
      const body = await request.json();
      return new HttpResponse(
        new ReadableStream<Uint8Array>({ start: controller => void streams.push({ body, controller }) }),
        { headers: { 'content-type': 'text/event-stream' } },
      );
    }),
  );
  const send = async (index: number, ...chunks: unknown[]) => {
    await act(async () => {
      for (const chunk of chunks) {
        streams[index]!.controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
    });
  };
  // A locked phone or a lost network: the page reads an error, not an end.
  const breakStream = (index: number) => act(() => streams[index]!.controller.error(new TypeError('network error')));
  const followedAgain = (count: number) => waitFor(() => expect(streams).toHaveLength(count), { timeout: 3000 });
  return { streams, send, breakStream, followedAgain };
}

const followThread = (props: Partial<MastraChatProps> = {}) =>
  renderHookWithProviders(() =>
    useChat({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      enableThreadSignals: true,
      ...props,
    }),
  );

describe('useChat once its thread stream broke (a phone locked, the network gone)', () => {
  let unmount: (() => void) | undefined;
  afterEach(() => unmount?.());

  it('follows the thread again, asking for the stored history to catch up', async () => {
    const threads = givenThreadStreams();
    const page = followThread();
    unmount = page.unmount;
    await threads.followedAgain(1);

    threads.breakStream(0);

    await threads.followedAgain(2);
    expect(threads.streams.map(stream => stream.body)).toEqual([
      { resourceId: 'resource-1', threadId: 'thread-1', withRunStatus: true },
      { resourceId: 'resource-1', threadId: 'thread-1', withInitialHistory: true, withRunStatus: true },
    ]);
  });

  it('follows the thread no more once the page leaves, though it followed it again before', async () => {
    const threads = givenThreadStreams();
    const page = followThread();
    await threads.followedAgain(1);
    threads.breakStream(0);
    await threads.followedAgain(2);

    page.unmount();
    threads.breakStream(1);
    await new Promise(resolve => setTimeout(resolve, 1_500));

    expect(threads.streams).toHaveLength(2);
  });
});
