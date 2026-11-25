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

const chunk = (type: string, payload: object = {}, runId = 'run-1') => ({ type, runId, from: 'AGENT', payload });
const stored = (id: string, role: 'user' | 'assistant', text: string): MastraDBMessage => ({
  id,
  role,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  threadId: 'thread-1',
  resourceId: 'resource-1',
  content: { format: 2, parts: [{ type: 'text', text }] },
});
const historyOf = (messages: MastraDBMessage[], activeRunId: string | null = null, hasMore = false) => ({
  type: 'thread-history',
  runId: '',
  from: 'AGENT',
  payload: { messages, hasMore, activeRunId },
});
const ended = (runId: string) => chunk('thread-run-status', { status: 'success' }, runId);
const question = stored('u1', 'user', 'Tell me more');
// What the page opened with: one array, as an app holds it.
const opened = [question];
const texts = (messages: MastraDBMessage[]) =>
  messages.map(m => m.content.parts.map(part => (part.type === 'text' ? part.text : '')).join(''));

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

  // A reply under way when the phone locks: the page saw its first word, then lost the stream.
  async function givenReplyCut(props: Partial<MastraChatProps> = { initialMessages: opened }, seen = ['Half']) {
    const threads = givenThreadStreams();
    const page = followThread(props);
    unmount = page.unmount;
    await threads.followedAgain(1);
    await threads.send(
      0,
      chunk('start', { messageId: 'a1' }),
      chunk('text-start', { id: 't1' }),
      ...seen.map(text => chunk('text-delta', { id: 't1', text })),
    );
    await waitFor(() => expect(texts(page.result.current.messages)).toEqual(['Tell me more', seen.join('')]));
    expect(page.result.current.isRunning).toBe(true);
    threads.breakStream(0);
    await threads.followedAgain(2);
    return { ...threads, page };
  }

  it('shows whole the reply the server finished meanwhile, and no longer as running', async () => {
    const { send, page } = await givenReplyCut();

    await send(1, historyOf([question, stored('a1', 'assistant', 'Half, then whole.')]));

    await waitFor(() => expect(texts(page.result.current.messages)).toEqual(['Tell me more', 'Half, then whole.']));
    expect(page.result.current.isRunning).toBe(false);
  });

  it('goes on with a reply still running and not stored, without writing twice what it had shown', async () => {
    const { send, page } = await givenReplyCut();

    // Not stored yet: the server sends the reply again, from its start.
    await send(
      1,
      historyOf([question], 'run-1'),
      chunk('start', { messageId: 'a1' }),
      chunk('text-start', { id: 't1' }),
      chunk('text-delta', { id: 't1', text: 'Half' }),
      chunk('text-delta', { id: 't1', text: ', then whole.' }),
    );

    await waitFor(() => expect(texts(page.result.current.messages)).toEqual(['Tell me more', 'Half, then whole.']));
    expect(page.result.current.isRunning).toBe(true);
    await send(1, chunk('text-end', { id: 't1' }), ended('run-1'));
    await waitFor(() => expect(page.result.current.isRunning).toBe(false));
  });

  it('goes on with a reply still running and partly stored, from the part the server stored', async () => {
    const { send, page } = await givenReplyCut({ initialMessages: opened }, ['Half', ', th']);

    // Stored up to "Half": the server sends the parts newer than that, without the reply's start, though the page
    // had seen some of them.
    await send(
      1,
      historyOf([question, stored('a1', 'assistant', 'Half')], 'run-1'),
      chunk('text-delta', { id: 't1', text: ', th' }),
      chunk('text-delta', { id: 't1', text: 'en whole.' }),
    );

    await waitFor(() => expect(texts(page.result.current.messages)).toEqual(['Tell me more', 'Half, then whole.']));
    expect(page.result.current.isRunning).toBe(true);
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
