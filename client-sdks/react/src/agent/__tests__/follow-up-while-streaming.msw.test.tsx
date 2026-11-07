// @vitest-environment jsdom
import type { SendAgentMessageParams } from '@mastra/client-js';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '../../test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../test/render';
import { useChat } from '../hooks';

const encoder = new TextEncoder();

/**
 * Thread-signal routes as a durable agent serves them: an open subscription
 * stream the test writes chunks into, and a send-message route that admits
 * each message into whichever run the test says is active.
 *
 * The chunk order used below was captured from `@mastra/core`'s thread runtime
 * for a follow-up sent while the first step was still streaming text: the
 * follow-up is published as `data-user-message-pending` on the active run, the
 * same text part keeps streaming, then the step-boundary `data-user-message`
 * echo delivers it and the next step answers under a new message id.
 */
const useDurableThread = () => {
  let subscription: ReadableStreamDefaultController<Uint8Array> | undefined;
  const sent: Array<{ contents: unknown; clientMessageId: string; signalId: string }> = [];
  let admitInto = 'run-1';

  server.use(
    http.post(`${TEST_BASE_URL}/api/agents/agent-1/threads/subscribe`, () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          subscription = controller;
        },
      });
      return new HttpResponse(body, { headers: { 'content-type': 'text/event-stream' } });
    }),
    http.post<never, SendAgentMessageParams>(
      `${TEST_BASE_URL}/api/agents/agent-1/send-message`,
      async ({ request }) => {
        const body = await request.json();
        const message = body.message as { contents: unknown; metadata: { clientMessageId: string } };
        const signalId = `signal-${sent.length + 1}`;
        sent.push({ contents: message.contents, clientMessageId: message.metadata.clientMessageId, signalId });
        return HttpResponse.json({ accepted: true, runId: admitInto, signal: { id: signalId } });
      },
    ),
  );

  const emit = async (chunk: Record<string, unknown>) => {
    await act(async () => {
      subscription?.enqueue(encoder.encode(`data: ${JSON.stringify({ from: 'AGENT', ...chunk })}\n\n`));
    });
  };

  const userEcho = (runId: string, index: number, status?: 'pending') => {
    const message = sent[index]!;
    return {
      type: status ? 'data-user-message-pending' : 'data-user-message',
      runId,
      ...(status ? { transient: true } : {}),
      data: {
        id: message.signalId,
        type: 'user',
        contents: message.contents,
        metadata: { clientMessageId: message.clientMessageId, ...(status ? { status } : {}) },
      },
    };
  };

  return {
    emit,
    userEcho,
    admitInto: (runId: string) => {
      admitInto = runId;
    },
    close: () => subscription?.close(),
    ready: () => waitFor(() => expect(subscription).toBeDefined()),
  };
};

const renderChat = () =>
  renderHookWithProviders(() =>
    useChat({ agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1', enableThreadSignals: true }),
  );

const textOf = (message: MastraDBMessage) =>
  message.content.parts
    .filter(part => part.type === 'text')
    .map(part => (part as { text: string }).text)
    .join('');

const textStates = (message: MastraDBMessage) =>
  message.content.parts.filter(part => part.type === 'text').map(part => (part as { state?: string }).state);

/** What the chat shows: one entry per rendered row. */
const rows = (messages: MastraDBMessage[]) => messages.map(message => `${message.role}: ${textOf(message)}`);

let thread: ReturnType<typeof useDurableThread> | undefined;
afterEach(() => {
  thread?.close();
  thread = undefined;
});

// Issue #29163: a follow-up sent with `sendMessage()` while the agent is still
// streaming is delivered into the active run at its next step boundary. Until
// then the rest of the in-flight answer belongs to the same assistant row,
// above the follow-up, exactly as storage records it.
describe('useChat follow-up sent while the answer is still streaming (#29163)', () => {
  const startFirstAnswer = async (chat: ReturnType<typeof renderChat>) => {
    const t = thread!;
    await t.ready();
    await act(async () => {
      await chat.result.current.sendMessage({ message: 'first', threadId: 'thread-1' });
    });
    await t.emit({ type: 'start', runId: 'run-1', payload: { messageId: 'answer-1' } });
    await t.emit(t.userEcho('run-1', 0));
    await t.emit({ type: 'step-start', runId: 'run-1', payload: { messageId: 'answer-1' } });
    await t.emit({ type: 'text-start', runId: 'run-1', payload: { id: 'text-1' } });
    await t.emit({ type: 'text-delta', runId: 'run-1', payload: { id: 'text-1', text: 'partially streamed answer' } });
    expect(rows(chat.result.current.messages)).toEqual(['user: first', 'assistant: partially streamed answer']);
  };

  const sendFollowUp = async (chat: ReturnType<typeof renderChat>) => {
    await act(async () => {
      await chat.result.current.sendMessage({ message: 'follow-up', threadId: 'thread-1' });
    });
  };

  it.each([
    { order: 'after the server shows the follow-up as pending', pendingChunkFirst: true },
    { order: 'before the server shows the follow-up as pending', pendingChunkFirst: false },
  ])('keeps the rest of the answer in one row when it streams $order', async ({ pendingChunkFirst }) => {
    thread = useDurableThread();
    const chat = renderChat();
    await startFirstAnswer(chat);

    await sendFollowUp(chat);
    if (pendingChunkFirst) await thread.emit(thread.userEcho('run-1', 1, 'pending'));
    await thread.emit({ type: 'text-delta', runId: 'run-1', payload: { id: 'text-1', text: ' tail' } });
    if (!pendingChunkFirst) await thread.emit(thread.userEcho('run-1', 1, 'pending'));

    expect(rows(chat.result.current.messages)).toEqual([
      'user: first',
      'assistant: partially streamed answer tail',
      'user: follow-up',
    ]);
    // The follow-up is still shown as not yet delivered.
    expect(chat.result.current.messages[2]!.content.metadata?.status).toBe('pending');

    // Step boundary: the follow-up is delivered and the next step answers it.
    await thread.emit({ type: 'text-end', runId: 'run-1', payload: { id: 'text-1' } });
    await thread.emit(thread.userEcho('run-1', 1));
    await thread.emit({ type: 'step-finish', runId: 'run-1', payload: { messageId: 'answer-2' } });
    await thread.emit({ type: 'step-start', runId: 'run-1', payload: { messageId: 'answer-2' } });
    await thread.emit({ type: 'text-start', runId: 'run-1', payload: { id: 'text-1' } });
    await thread.emit({ type: 'text-delta', runId: 'run-1', payload: { id: 'text-1', text: 'reply to follow-up' } });
    await thread.emit({ type: 'text-end', runId: 'run-1', payload: { id: 'text-1' } });
    await thread.emit({ type: 'step-finish', runId: 'run-1', payload: { messageId: 'answer-2' } });
    await thread.emit({ type: 'finish', runId: 'run-1', payload: { messageId: 'answer-2' } });

    const messages = chat.result.current.messages;
    expect(rows(messages)).toEqual([
      'user: first',
      'assistant: partially streamed answer tail',
      'user: follow-up',
      'assistant: reply to follow-up',
    ]);
    // Every row maps to a stored message: no client-only assistant row is left behind.
    expect(messages.map(message => message.id)).toEqual(['signal-1', 'answer-1', 'signal-2', 'answer-2']);
    expect(messages[2]!.content.metadata?.status).toBeUndefined();
    // The first answer stopped streaming when its step ended.
    expect(textStates(messages[1]!)).toEqual(['done']);
    await waitFor(() => expect(chat.result.current.isRunning).toBe(false));
  });

  it('finishes the answer when the run delivers a user message the chat did not send', async () => {
    thread = useDurableThread();
    const chat = renderChat();
    await startFirstAnswer(chat);
    await sendFollowUp(chat);
    await thread.emit(thread.userEcho('run-1', 1, 'pending'));

    // A message from another client or a server-side signal reaches the run at
    // its step boundary before the follow-up does. Its echo matches no bubble here.
    await thread.emit({
      type: 'data-user-message',
      runId: 'run-1',
      data: { id: 'signal-other', type: 'user', contents: 'from another tab', metadata: {} },
    });

    const answer = chat.result.current.messages.find(message => message.id === 'answer-1')!;
    expect(textOf(answer)).toBe('partially streamed answer');
    expect(textStates(answer)).toEqual(['done']);
    // Rows follow delivery order: the delivered message goes above the still-pending follow-up.
    expect(rows(chat.result.current.messages)).toEqual([
      'user: first',
      'assistant: partially streamed answer',
      'user: from another tab',
      'user: follow-up',
    ]);
    expect(chat.result.current.messages[3]!.content.metadata?.status).toBe('pending');

    await thread.emit(thread.userEcho('run-1', 1));
    expect(rows(chat.result.current.messages)).toEqual([
      'user: first',
      'assistant: partially streamed answer',
      'user: from another tab',
      'user: follow-up',
    ]);
    expect(chat.result.current.messages[3]!.content.metadata?.status).toBeUndefined();
  });

  it('keeps a tool call the answer makes after the follow-up in the same row', async () => {
    thread = useDurableThread();
    const chat = renderChat();
    await startFirstAnswer(chat);

    await sendFollowUp(chat);
    await thread.emit(thread.userEcho('run-1', 1, 'pending'));
    await thread.emit({ type: 'text-end', runId: 'run-1', payload: { id: 'text-1' } });
    await thread.emit({
      type: 'tool-call',
      runId: 'run-1',
      payload: { toolCallId: 'call-1', toolName: 'lookup', args: { q: 'x' } },
    });
    await thread.emit({
      type: 'tool-result',
      runId: 'run-1',
      payload: { toolCallId: 'call-1', toolName: 'lookup', args: { q: 'x' }, result: { ok: true } },
    });

    const messages = chat.result.current.messages;
    expect(messages.map(message => message.role)).toEqual(['user', 'assistant', 'user']);
    expect(messages[1]!.content.parts.map(part => part.type)).toEqual(['text', 'tool-invocation']);
    expect(messages[1]!.content.parts[1]).toMatchObject({
      toolInvocation: { toolCallId: 'call-1', state: 'result', result: { ok: true } },
    });
    expect(textOf(messages[2]!)).toBe('follow-up');
  });

  it('keeps the answer above two follow-ups sent while it streams', async () => {
    thread = useDurableThread();
    const chat = renderChat();
    await startFirstAnswer(chat);

    await sendFollowUp(chat);
    await thread.emit(thread.userEcho('run-1', 1, 'pending'));
    await act(async () => {
      await chat.result.current.sendMessage({ message: 'second follow-up', threadId: 'thread-1' });
    });
    await thread.emit(thread.userEcho('run-1', 2, 'pending'));
    await thread.emit({ type: 'text-delta', runId: 'run-1', payload: { id: 'text-1', text: ' tail' } });
    await thread.emit({ type: 'text-end', runId: 'run-1', payload: { id: 'text-1' } });
    // Both are delivered at the same step boundary.
    await thread.emit(thread.userEcho('run-1', 1));
    await thread.emit(thread.userEcho('run-1', 2));
    await thread.emit({ type: 'step-finish', runId: 'run-1', payload: { messageId: 'answer-2' } });
    await thread.emit({ type: 'step-start', runId: 'run-1', payload: { messageId: 'answer-2' } });
    await thread.emit({ type: 'text-delta', runId: 'run-1', payload: { id: 'text-1', text: 'reply to both' } });

    const messages = chat.result.current.messages;
    expect(rows(messages)).toEqual([
      'user: first',
      'assistant: partially streamed answer tail',
      'user: follow-up',
      'user: second follow-up',
      'assistant: reply to both',
    ]);
    expect(messages.map(message => message.id)).toEqual(['signal-1', 'answer-1', 'signal-2', 'signal-3', 'answer-2']);
    expect(textStates(messages[1]!)).toEqual(['done']);
  });

  it('puts a message the chat did not send above the pending follow-up before any text streamed', async () => {
    thread = useDurableThread();
    const chat = renderChat();
    await thread.ready();
    await act(async () => {
      await chat.result.current.sendMessage({ message: 'first', threadId: 'thread-1' });
    });
    await thread.emit({ type: 'start', runId: 'run-1', payload: { messageId: 'answer-1' } });
    await thread.emit(thread.userEcho('run-1', 0));
    await thread.emit({ type: 'step-start', runId: 'run-1', payload: { messageId: 'answer-1' } });
    await sendFollowUp(chat);
    await thread.emit(thread.userEcho('run-1', 1, 'pending'));

    await thread.emit({
      type: 'data-user-message',
      runId: 'run-1',
      data: { id: 'signal-other', type: 'user', contents: 'from another tab', metadata: {} },
    });

    const ids = chat.result.current.messages.map(message => message.id);
    // No empty assistant row is left behind for the answer that has not streamed yet.
    expect(ids).toEqual(['signal-1', 'signal-other', 'signal-2']);
    expect(ids.indexOf('signal-other')).toBeGreaterThan(-1);
    expect(ids.indexOf('signal-other')).toBeLessThan(ids.indexOf('signal-2'));
    expect(chat.result.current.messages.at(-1)!.content.metadata?.status).toBe('pending');
  });

  it('keeps the answer in its row when the follow-up is sent before any text streamed', async () => {
    thread = useDurableThread();
    const chat = renderChat();
    await thread.ready();
    await act(async () => {
      await chat.result.current.sendMessage({ message: 'first', threadId: 'thread-1' });
    });
    await thread.emit({ type: 'start', runId: 'run-1', payload: { messageId: 'answer-1' } });
    await thread.emit(thread.userEcho('run-1', 0));
    await thread.emit({ type: 'step-start', runId: 'run-1', payload: { messageId: 'answer-1' } });

    await sendFollowUp(chat);
    await thread.emit(thread.userEcho('run-1', 1, 'pending'));
    await thread.emit({ type: 'text-start', runId: 'run-1', payload: { id: 'text-1' } });
    await thread.emit({ type: 'text-delta', runId: 'run-1', payload: { id: 'text-1', text: 'answer' } });
    await thread.emit({ type: 'text-end', runId: 'run-1', payload: { id: 'text-1' } });
    await thread.emit(thread.userEcho('run-1', 1));
    await thread.emit({ type: 'step-finish', runId: 'run-1', payload: { messageId: 'answer-2' } });
    await thread.emit({ type: 'step-start', runId: 'run-1', payload: { messageId: 'answer-2' } });
    await thread.emit({ type: 'text-delta', runId: 'run-1', payload: { id: 'text-1', text: 'reply to follow-up' } });

    expect(chat.result.current.messages.map(message => message.id)).toEqual([
      'signal-1',
      'answer-1',
      'signal-2',
      'answer-2',
    ]);
    expect(rows(chat.result.current.messages)).toEqual([
      'user: first',
      'assistant: answer',
      'user: follow-up',
      'assistant: reply to follow-up',
    ]);
  });

  it('finishes the answer above a follow-up that waits for the next run', async () => {
    thread = useDurableThread();
    const chat = renderChat();
    await startFirstAnswer(chat);

    // The run ends before a step boundary drains the follow-up, so the follow-up starts run-2.
    await sendFollowUp(chat);
    await thread.emit(thread.userEcho('run-1', 1, 'pending'));
    await thread.emit({ type: 'text-delta', runId: 'run-1', payload: { id: 'text-1', text: ' tail' } });
    await thread.emit({ type: 'text-end', runId: 'run-1', payload: { id: 'text-1' } });
    await thread.emit({ type: 'finish', runId: 'run-1', payload: { messageId: 'answer-1' } });
    await thread.emit({ type: 'start', runId: 'run-2', payload: { messageId: 'answer-2' } });
    await thread.emit(thread.userEcho('run-2', 1));
    await thread.emit({ type: 'step-start', runId: 'run-2', payload: { messageId: 'answer-2' } });
    await thread.emit({ type: 'text-delta', runId: 'run-2', payload: { id: 'text-1', text: 'reply to follow-up' } });

    const messages = chat.result.current.messages;
    expect(rows(messages)).toEqual([
      'user: first',
      'assistant: partially streamed answer tail',
      'user: follow-up',
      'assistant: reply to follow-up',
    ]);
    expect(textStates(messages[1]!)).toEqual(['done']);
  });

  it('still answers a message sent after the run finished in a new row below it', async () => {
    thread = useDurableThread();
    const chat = renderChat();
    await startFirstAnswer(chat);
    await thread.emit({ type: 'text-end', runId: 'run-1', payload: { id: 'text-1' } });
    await thread.emit({ type: 'finish', runId: 'run-1', payload: { messageId: 'answer-1' } });
    await waitFor(() => expect(chat.result.current.isRunning).toBe(false));

    // The pending bubble is at the end and its reply has not started yet:
    // run-2's output must open its own row instead of joining run-1's.
    thread.admitInto('run-2');
    await sendFollowUp(chat);
    await thread.emit({ type: 'text-start', runId: 'run-2', payload: { id: 'text-1' } });
    await thread.emit({ type: 'text-delta', runId: 'run-2', payload: { id: 'text-1', text: 'new answer' } });

    expect(rows(chat.result.current.messages)).toEqual([
      'user: first',
      'assistant: partially streamed answer',
      'user: follow-up',
      'assistant: new answer',
    ]);
  });
});
