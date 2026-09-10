// @vitest-environment jsdom
import { ChunkFrom, type ChunkType, type DataChunkType } from '@mastra/core/stream';
import { MastraReactProvider, useChat } from '@mastra/react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  completedHistory,
  approvalHistory,
  approvalMetadataHistory,
  approvalChunk,
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
  describe.each(['pendingToolApprovals', 'requireApprovalMetadata', 'suspendedTools'] as const)(
    'when history contains %s',
    key => {
      it.each([false, true])('restores only unresolved approvals (resolved=%s)', async resolved => {
        const { result, rerender } = await setup();
        rerender({ threadId: 'first', history: approvalMetadataHistory(key, resolved) });
        expect(result.current.isAwaitingToolApproval).toBe(!resolved);
        const message = result.current.messages.find(message => message.id === 'approval-fixture');
        if (resolved) {
          expect(message?.content.metadata?.[key]).toBeUndefined();
          expect(message?.content.metadata?.requireApprovalMetadata).toBeUndefined();
        } else {
          expect(message?.content.metadata?.[key]).toBeDefined();
        }
      });
    },
  );

  describe('when approval history races with live run state', () => {
    it('hydrates same-run approvals before their live event arrives', async () => {
      const { result, rerender } = await setup();
      const history = approvalHistory();
      rerender({ threadId: 'first', history });
      expect(result.current.isAwaitingToolApproval).toBe(true);
      rerender({ threadId: 'first', history });
      expect(result.current.isAwaitingToolApproval).toBe(true);
    });

    it('does not replace a live pending approval with empty history', async () => {
      const { result, rerender } = await setup();
      await act(async () => push(approvalChunk));
      await waitFor(() => expect(result.current.isAwaitingToolApproval).toBe(true));
      rerender({ threadId: 'first', history: { messages: [] } });
      expect(result.current.isAwaitingToolApproval).toBe(true);
    });

    it('preserves approval waiting when a suspended transport closes without a finish chunk', async () => {
      const { result, rerender } = await setup();
      await act(async () => push(approvalChunk));
      await waitFor(() => expect(result.current.isAwaitingToolApproval).toBe(true));
      await act(async () => connections.shift()?.close());
      rerender({ threadId: 'first', history: { messages: [] } });
      expect(result.current.isAwaitingToolApproval).toBe(true);
    });

    it('does not restore stale pending approvals after the run finishes', async () => {
      const { result, rerender } = await setup();
      await act(async () => push(finishChunk));
      await waitFor(() => expect(result.current.isRunning).toBe(false));
      rerender({ threadId: 'first', history: approvalHistory() });
      expect(result.current.isAwaitingToolApproval).toBe(false);
    });

    it('keeps parallel approvals independent and does not resurrect accepted decisions', async () => {
      const { result, rerender } = await setup();
      const requests: unknown[] = [];
      server.use(
        http.post('http://localhost:4111/api/agents/agent/send-tool-approval', async ({ request }) => {
          requests.push(await request.json());
          return HttpResponse.json({ accepted: true, runId: 'recovery-run' });
        }),
      );
      await act(async () => push(approvalChunk));
      await waitFor(() => expect(result.current.isAwaitingToolApproval).toBe(true));
      const history = {
        messages: [...approvalHistory().messages, ...approvalHistory('recovery-run', 'second-tool').messages],
      };
      rerender({ threadId: 'first', history });
      await act(async () => result.current.approveToolCall('approval-tool'));
      expect(result.current.isAwaitingToolApproval).toBe(true);
      rerender({ threadId: 'first', history: { messages: [...history.messages] } });
      await act(async () => result.current.declineToolCall('second-tool'));
      expect(result.current.isAwaitingToolApproval).toBe(false);
      rerender({ threadId: 'first', history: { messages: [...history.messages] } });
      expect(result.current.isAwaitingToolApproval).toBe(false);
      await act(async () => push({ type: 'start', runId: 'recovery-run', from: ChunkFrom.AGENT, payload: {} }));
      await waitFor(() => expect(result.current.isRunning).toBe(true));
      rerender({ threadId: 'first', history: { messages: [...history.messages] } });
      expect(result.current.isAwaitingToolApproval).toBe(false);
      expect(requests).toEqual([
        expect.objectContaining({ toolCallId: 'approval-tool', approved: true }),
        expect.objectContaining({ toolCallId: 'second-tool', approved: false }),
      ]);
    });

    it('hydrates a new run after a previous run has finished', async () => {
      const { result, rerender } = await setup();
      await act(async () => push(finishChunk));
      await waitFor(() => expect(result.current.isRunning).toBe(false));
      await act(async () => push({ type: 'start', runId: 'next-run', from: ChunkFrom.AGENT, payload: {} }));
      await waitFor(() => expect(result.current.isRunning).toBe(true));
      rerender({ threadId: 'first', history: approvalHistory('next-run') });
      expect(result.current.isAwaitingToolApproval).toBe(true);
    });

    it('resets live approval authority when changing threads', async () => {
      const { result, rerender } = await setup();
      await act(async () => push(finishChunk));
      await waitFor(() => expect(result.current.isRunning).toBe(false));
      rerender({ threadId: 'second', history: approvalHistory('other-run') });
      expect(result.current.isAwaitingToolApproval).toBe(true);
    });

    it.each([false, true])('hydrates only active-run approvals from mixed history (reverse=%s)', async reverse => {
      const { result, rerender } = await setup();
      server.use(
        http.post('http://localhost:4111/api/agents/agent/send-tool-approval', () =>
          HttpResponse.json({ accepted: true, runId: 'recovery-run' }),
        ),
      );
      const messages = [...approvalHistory('older-run', 'old-tool').messages, ...approvalHistory().messages];
      rerender({ threadId: 'first', history: { messages: reverse ? messages.reverse() : messages } });
      expect(result.current.isAwaitingToolApproval).toBe(true);
      await act(async () => result.current.approveToolCall('approval-tool'));
      expect(result.current.isAwaitingToolApproval).toBe(false);
    });

    it('ignores approvals belonging to an older run while a new run streams', async () => {
      const { result, rerender } = await setup();
      rerender({ threadId: 'first', history: approvalHistory('older-run') });
      expect(result.current.isAwaitingToolApproval).toBe(false);
    });
  });
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
