// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { CLIENT_MESSAGE_ID_KEY } from '../../lib/mastra-db';
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

  // Another run took the thread over while the stream was down (a queued follow-up, another device). Its start is
  // stored, so only the history names it.
  const handedOver = historyOf(
    [
      question,
      stored('a1', 'assistant', 'Half, then whole.'),
      stored('u2', 'user', 'And then?'),
      stored('a2', 'assistant', 'Then'),
    ],
    'run-2',
  );

  it.each([
    { retained: true, chunks: [handedOver, ended('run-1')] },
    { retained: false, chunks: [handedOver] },
  ])(
    'follows the run that took over meanwhile until it ends (first run outcome retained: $retained)',
    async ({ chunks }) => {
      const { send, page } = await givenReplyCut();

      await send(1, ...chunks);

      await waitFor(() =>
        expect(texts(page.result.current.messages)).toEqual(['Tell me more', 'Half, then whole.', 'And then?', 'Then']),
      );
      expect(page.result.current.isRunning).toBe(true);
      await send(1, ended('run-2'));
      await waitFor(() => expect(page.result.current.isRunning).toBe(false));
    },
  );

  // The server takes a message sent from the page, or keeps it on its way (the request still in flight).
  const givenSendRoute = ({ inFlight = false } = {}) => {
    server.use(
      http.post(`${TEST_BASE_URL}/api/agents/agent-1/send-message`, async () => {
        if (inFlight) await new Promise(() => {});
        return HttpResponse.json({ accepted: true, runId: 'run-0', signal: { id: 's0' } });
      }),
    );
  };
  const send = (page: { result: { current: ReturnType<typeof useChat> } }, message: string) =>
    act(() => void page.result.current.sendMessage({ message, threadId: 'thread-1' }).catch(() => {}));
  const clientIdOf = (message: MastraDBMessage | undefined) => message?.content.metadata?.[CLIENT_MESSAGE_ID_KEY];

  it('keeps in place a sent message the server confirmed, older than the catch-up history page', async () => {
    givenSendRoute();
    const threads = givenThreadStreams();
    const page = followThread();
    unmount = page.unmount;
    await threads.followedAgain(1);
    await send(page, 'Hello');
    const clientMessageId = page.result.current.messages[0]!.id;
    await threads.send(
      0,
      {
        type: 'data-user-message',
        runId: 'run-0',
        from: 'AGENT',
        data: {
          type: 'user-message',
          id: 's0',
          contents: 'Hello',
          metadata: { [CLIENT_MESSAGE_ID_KEY]: clientMessageId },
        },
      },
      chunk('start', { messageId: 'a0' }, 'run-0'),
      chunk('text-start', { id: 't0' }, 'run-0'),
      chunk('text-delta', { id: 't0', text: 'Hi' }, 'run-0'),
      ended('run-0'),
    );
    await waitFor(() => expect(texts(page.result.current.messages)).toEqual(['Hello', 'Hi']));
    expect(clientIdOf(page.result.current.messages[0])).toBe(clientMessageId);

    threads.breakStream(0);
    await threads.followedAgain(2);
    await threads.send(
      1,
      historyOf([stored('u2', 'user', 'Later'), stored('a2', 'assistant', 'Much later')], null, true),
    );

    await waitFor(() => expect(texts(page.result.current.messages)).toEqual(['Hello', 'Hi', 'Later', 'Much later']));
  });

  it('keeps after the history a message still on its way, once, when the server presents it again', async () => {
    givenSendRoute({ inFlight: true });
    const { send: sendChunks, page } = await givenReplyCut();
    await send(page, 'And then?');
    const clientMessageId = page.result.current.messages.at(-1)!.id;

    await sendChunks(1, historyOf([question, stored('a1', 'assistant', 'Whole.')]));

    await waitFor(() => expect(texts(page.result.current.messages)).toEqual(['Tell me more', 'Whole.', 'And then?']));
    await sendChunks(1, {
      type: 'data-user-message-pending',
      runId: '',
      from: 'AGENT',
      data: {
        id: 's2',
        contents: 'And then?',
        metadata: { status: 'pending', [CLIENT_MESSAGE_ID_KEY]: clientMessageId },
      },
    });
    await waitFor(() => expect(page.result.current.messages.at(-1)?.id).toBe('s2'));
    expect(texts(page.result.current.messages)).toEqual(['Tell me more', 'Whole.', 'And then?']);
  });

  it('swaps a message the server stored meanwhile for its stored copy, keeping the row’s client id', async () => {
    givenSendRoute({ inFlight: true });
    const { send: sendChunks, page } = await givenReplyCut();
    await send(page, 'And then?');
    const clientMessageId = page.result.current.messages.at(-1)!.id;
    const storedSignal: MastraDBMessage = {
      ...stored('s2', 'user', 'And then?'),
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'And then?' }],
        metadata: { signal: { id: 's2', type: 'user', metadata: { [CLIENT_MESSAGE_ID_KEY]: clientMessageId } } },
      },
    };

    await sendChunks(1, historyOf([question, stored('a1', 'assistant', 'Whole.'), storedSignal]));

    await waitFor(() => expect(texts(page.result.current.messages)).toEqual(['Tell me more', 'Whole.', 'And then?']));
    expect(page.result.current.messages.at(-1)?.id).toBe('s2');
    expect(clientIdOf(page.result.current.messages.at(-1))).toBe(clientMessageId);
  });

  it('keeps the first history page of a page that asks for one, and its pagination', async () => {
    const threads = givenThreadStreams();
    const page = followThread({ withInitialHistory: { perPage: 2 } });
    unmount = page.unmount;
    await threads.followedAgain(1);
    await threads.send(0, historyOf([question, stored('a1', 'assistant', 'Half, then whole.')]));
    await waitFor(() => expect(texts(page.result.current.messages)).toEqual(['Tell me more', 'Half, then whole.']));
    expect(page.result.current.initialHistoryPagination).toEqual({ hasMore: false });

    threads.breakStream(0);
    await threads.followedAgain(2);
    await threads.send(
      1,
      historyOf([stored('u2', 'user', 'And then?'), stored('a2', 'assistant', 'Then.')], null, true),
    );

    await waitFor(() =>
      expect(texts(page.result.current.messages)).toEqual(['Tell me more', 'Half, then whole.', 'And then?', 'Then.']),
    );
    // Still the first page's: the page loads older pages from there.
    expect(page.result.current.initialHistoryPagination).toEqual({ hasMore: false });
    expect(threads.streams[1]!.body).toMatchObject({ withInitialHistory: { perPage: 2 } });
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
