// @vitest-environment jsdom
import type { ChunkType, DataChunkType } from '@mastra/core/stream';
import { MastraReactProvider, useChat } from '@mastra/react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  completedHistory,
  emptyHistory,
  finishChunk,
  liveChunks,
  staleHistory,
  taskHistory,
  savedTasks,
  taskChunk,
} from '@/pages/agents/agent/__tests__/fixtures/thread-recovery';
import { server } from '@/test/msw-server';

const wrapper = ({ children }: { children: ReactNode }) => (
  <MastraReactProvider baseUrl="http://localhost:4111">{children}</MastraReactProvider>
);
const connections: ReadableStreamDefaultController<Uint8Array>[] = [];
const push = (chunk: ChunkType | DataChunkType) =>
  connections[0]?.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
const setup = async () => {
  server.use(
    http.post(
      'http://localhost:4111/api/agents/agent/threads/subscribe',
      () =>
        new HttpResponse(
          new ReadableStream<Uint8Array>({
            start(controller) {
              connections.push(controller);
            },
          }),
          { headers: { 'Content-Type': 'text/event-stream' } },
        ),
    ),
  );
  const hook = renderHook(
    ({ threadId, history }) =>
      useChat({ agentId: 'agent', threadId, initialMessages: history.messages, enableThreadSignals: true }),
    {
      wrapper,
      initialProps: { threadId: 'first', history: emptyHistory },
    },
  );
  await waitFor(() => expect(connections).toHaveLength(1));
  await act(async () => {
    for (const chunk of liveChunks) push(chunk);
  });
  await waitFor(() =>
    expect(hook.result.current.messages[0]?.content.parts).toEqual(
      expect.arrayContaining([expect.objectContaining({ text: 'Live response survives' })]),
    ),
  );
  return hook;
};

afterEach(() => {
  for (const controller of connections.splice(0)) controller.close();
  cleanup();
});

describe('Chat history recovery', () => {
  describe('when the thread changes during a run', () => {
    it('clears the old conversation even if the initial history reference is unchanged', async () => {
      const { result, rerender } = await setup();
      rerender({ threadId: 'second', history: emptyHistory });
      await waitFor(() => expect(result.current.messages).toEqual([]));
      expect(result.current.isRunning).toBe(false);
    });
  });

  describe('when stale history arrives after completion', () => {
    it.each([emptyHistory, staleHistory])('keeps the completed answer over the stale snapshot %#', async history => {
      const { result, rerender } = await setup();
      await act(async () => push(finishChunk));
      await waitFor(() => expect(result.current.isRunning).toBe(false));
      rerender({ threadId: 'first', history: { ...history, messages: [...history.messages] } });
      const response = result.current.messages.find(message => message.id === 'recovery-assistant');
      expect(response?.content.parts).toEqual(
        expect.arrayContaining([expect.objectContaining({ text: 'Live response survives' })]),
      );
    });
  });

  describe('when task history arrives during a live run', () => {
    it('restores saved tasks and clears them on thread change', async () => {
      const { result, rerender } = await setup();
      rerender({ threadId: 'first', history: taskHistory });
      expect(result.current.tasks).toEqual(savedTasks);
      rerender({ threadId: 'second', history: emptyHistory });
      expect(result.current.tasks).toEqual([]);
    });

    it('does not replace newer streamed tasks with saved tasks', async () => {
      const { result, rerender } = await setup();
      rerender({ threadId: 'first', history: taskHistory });
      expect(result.current.tasks).toEqual(savedTasks);
      await act(async () => push(taskChunk));
      await waitFor(() => expect(result.current.tasks).toEqual([]));
      rerender({ threadId: 'first', history: { ...taskHistory, messages: [...taskHistory.messages] } });
      expect(result.current.tasks).toEqual([]);
    });
  });

  describe('when historical messages have not been changed locally', () => {
    it('allows history refreshes to update and remove them without dropping the live response', async () => {
      const { result, rerender } = await setup();
      rerender({ threadId: 'first', history: staleHistory });
      expect(result.current.messages.some(message => message.id === 'earlier-user')).toBe(true);
      rerender({ threadId: 'first', history: completedHistory });
      expect(result.current.messages.map(message => message.id)).toEqual(['recovery-assistant']);
    });
  });

  describe('when the run finishes before persisted history is fetched', () => {
    it('keeps the live response until the new history snapshot arrives', async () => {
      const { result } = await setup();
      await act(async () => push(finishChunk));
      await waitFor(() => expect(result.current.isRunning).toBe(false));
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]?.content.parts).toEqual(
        expect.arrayContaining([expect.objectContaining({ text: 'Live response survives' })]),
      );
    });

    it('reconciles the completed live message with its persisted copy without duplicating it', async () => {
      const { result, rerender } = await setup();
      await act(async () => push(finishChunk));
      await waitFor(() => expect(result.current.isRunning).toBe(false));
      rerender({ threadId: 'first', history: completedHistory });
      await waitFor(() => expect(result.current.messages).toHaveLength(1));
      expect(result.current.messages[0]?.id).toBe('recovery-assistant');
      expect(result.current.messages[0]?.content.parts).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'Live response survives' })]),
      );
    });
  });
});
