// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '../../test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../test/render';
import { useChat } from '../hooks';

const SUBSCRIBE = `${TEST_BASE_URL}/api/agents/agent-1/threads/subscribe`;
const encoder = new TextEncoder();
const chunk = (type: string, payload: object = {}) => ({ type, runId: 'run-1', from: 'AGENT', payload });

const stored = (id: string, role: 'user' | 'assistant', text: string): MastraDBMessage => ({
  id,
  role,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  threadId: 'thread-1',
  resourceId: 'resource-1',
  content: { format: 2, parts: [{ type: 'text', text }] },
});
const question = stored('u1', 'user', 'Tell me more');
// What the page opened with: one array, as an app holds it.
const opened = [question];
const texts = (messages: MastraDBMessage[]) =>
  messages.map(m => m.content.parts.map(part => (part.type === 'text' ? part.text : '')).join(''));

// The streams the page follows the thread with, in order: the test writes to them, ends or breaks them, and reads what
// the page asked for each.
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
      for (const value of chunks)
        streams[index]!.controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
    });
  };
  return { streams, send };
}

// A reply under way when the phone locks: the page saw its first word, then lost the stream.
async function givenReplyCut() {
  const threads = givenThreadStreams();
  const page = renderHookWithProviders(() =>
    useChat({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      enableThreadSignals: true,
      initialMessages: opened,
    }),
  );
  await waitFor(() => expect(threads.streams).toHaveLength(1));
  await threads.send(
    0,
    chunk('start', { messageId: 'a1' }),
    chunk('text-start', { id: 't1' }),
    chunk('text-delta', { id: 't1', text: 'Half' }),
  );
  await waitFor(() => expect(texts(page.result.current.messages)).toEqual(['Tell me more', 'Half']));
  expect(page.result.current.isRunning).toBe(true);
  act(() => threads.streams[0]!.controller.error(new TypeError('network error')));
  await waitFor(() => expect(threads.streams).toHaveLength(2), { timeout: 3000 });
  return { ...threads, page };
}

describe('useChat once its thread stream broke (a phone locked, the network gone)', () => {
  let unmount: (() => void) | undefined;
  afterEach(() => unmount?.());

  it('follows the thread again, asking for the stored history to catch up', async () => {
    const { streams, page } = await givenReplyCut();
    unmount = page.unmount;

    expect(streams.map(stream => stream.body)).toEqual([
      { resourceId: 'resource-1', threadId: 'thread-1', withRunStatus: true },
      { resourceId: 'resource-1', threadId: 'thread-1', withInitialHistory: true, withRunStatus: true },
    ]);
  });

  it('shows the reply the server finished meanwhile, and stops showing it as running', async () => {
    const { send, page } = await givenReplyCut();
    unmount = page.unmount;

    await send(1, {
      type: 'thread-history',
      runId: '',
      from: 'AGENT',
      payload: {
        messages: [question, stored('a1', 'assistant', 'Half, then whole.')],
        hasMore: false,
        activeRunId: null,
      },
    });

    await waitFor(() => expect(texts(page.result.current.messages)).toEqual(['Tell me more', 'Half, then whole.']));
    expect(page.result.current.isRunning).toBe(false);
  });

  it('goes on with a reply still running, without writing twice what it had shown', async () => {
    const { send, page } = await givenReplyCut();
    unmount = page.unmount;

    // Not stored yet: the server sends the reply's parts again, from its start.
    await send(
      1,
      {
        type: 'thread-history',
        runId: '',
        from: 'AGENT',
        payload: { messages: [question], hasMore: false, activeRunId: 'run-1' },
      },
      chunk('start', { messageId: 'a1' }),
      chunk('text-start', { id: 't1' }),
      chunk('text-delta', { id: 't1', text: 'Half' }),
      chunk('text-delta', { id: 't1', text: ', then whole.' }),
    );
    await waitFor(() => expect(texts(page.result.current.messages)).toEqual(['Tell me more', 'Half, then whole.']));
    expect(page.result.current.isRunning).toBe(true);
    await send(1, chunk('text-end', { id: 't1' }), {
      type: 'thread-run-status',
      runId: 'run-1',
      from: 'AGENT',
      payload: { status: 'success' },
    });

    await waitFor(() => expect(page.result.current.isRunning).toBe(false));
    expect(texts(page.result.current.messages)).toEqual(['Tell me more', 'Half, then whole.']);
  });

  // Another run took the thread over while the stream was down (a queued follow-up, another device). Its `start` is
  // stored, so the server doesn't send it again: only the history names it.
  const handedOver = {
    type: 'thread-history',
    runId: '',
    from: 'AGENT',
    payload: {
      messages: [
        question,
        stored('a1', 'assistant', 'Half, then whole.'),
        stored('u2', 'user', 'And then?'),
        stored('a2', 'assistant', 'Then'),
      ],
      hasMore: false,
      activeRunId: 'run-2',
    },
  };
  const ended = (runId: string) => ({
    type: 'thread-run-status',
    runId,
    from: 'AGENT',
    payload: { status: 'success' },
  });

  it.each([
    { retained: true, chunks: [handedOver, ended('run-1')] },
    { retained: false, chunks: [handedOver] },
  ])(
    'follows the run that took over meanwhile until it ends (first run status retained: $retained)',
    async ({ chunks }) => {
      const { send, page } = await givenReplyCut();
      unmount = page.unmount;

      await send(1, ...chunks);

      await waitFor(() =>
        expect(texts(page.result.current.messages)).toEqual(['Tell me more', 'Half, then whole.', 'And then?', 'Then']),
      );
      expect(page.result.current.isRunning).toBe(true);
      await send(1, ended('run-2'));
      await waitFor(() => expect(page.result.current.isRunning).toBe(false));
    },
  );

  it('follows the thread no more once the page leaves', async () => {
    const threads = givenThreadStreams();
    const page = renderHookWithProviders(() =>
      useChat({ agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1', enableThreadSignals: true }),
    );
    await waitFor(() => expect(threads.streams).toHaveLength(1));
    act(() => threads.streams[0]!.controller.error(new TypeError('network error')));
    await waitFor(() => expect(threads.streams).toHaveLength(2), { timeout: 3000 });

    page.unmount();
    act(() => threads.streams[1]!.controller.error(new TypeError('network error')));
    await new Promise(resolve => setTimeout(resolve, 1_500));

    expect(threads.streams).toHaveLength(2);
  });
});
