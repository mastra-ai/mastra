import type { AgentChunkType } from '../stream/types';

import { runStaticDriver } from './chat-driver-static';
import { runStreamingDriver } from './chat-driver-streaming';
import type { ChatChannelRenderContext } from './output-processor';

/**
 * Single-producer / single-consumer async queue shared by the agent-path
 * output processor (`ChatChannelOutputProcessor`) and the harness-path session
 * renderer (`SessionChannelRenderer`). A producer pushes chunks synchronously;
 * the driver consumes them via the async iterable. `close()` ends the
 * iteration after pending items are drained.
 */
export interface ChunkQueue {
  iterable: AsyncIterable<AgentChunkType<any>>;
  push: (chunk: AgentChunkType<any>) => void;
  close: () => void;
}

export function createChunkQueue(): ChunkQueue {
  const buffer: AgentChunkType<any>[] = [];
  const waiters: Array<(result: IteratorResult<AgentChunkType<any>>) => void> = [];
  let closed = false;

  const push = (chunk: AgentChunkType<any>) => {
    if (closed) return;
    const waiter = waiters.shift();
    if (waiter) {
      waiter({ value: chunk, done: false });
    } else {
      buffer.push(chunk);
    }
  };

  const close = () => {
    if (closed) return;
    closed = true;
    while (waiters.length > 0) {
      waiters.shift()!({ value: undefined, done: true });
    }
  };

  const iterable: AsyncIterable<AgentChunkType<any>> = {
    [Symbol.asyncIterator]() {
      return {
        next() {
          if (buffer.length > 0) {
            return Promise.resolve({ value: buffer.shift()!, done: false });
          }
          if (closed) {
            return Promise.resolve({ value: undefined as any, done: true });
          }
          return new Promise<IteratorResult<AgentChunkType<any>>>(resolve => {
            waiters.push(resolve);
          });
        },
        return() {
          close();
          return Promise.resolve({ value: undefined as any, done: true });
        },
      };
    },
  };

  return { iterable, push, close };
}

/**
 * A live render session: a chunk queue plus the promise of the driver that is
 * pumping that queue's iterable to the chat platform. Producers push chunks
 * into `queue`, then `queue.close()` + `await driverPromise` once the run ends.
 */
export interface RenderSession {
  queue: ChunkQueue;
  driverPromise: Promise<void>;
}

/**
 * Open a render session for a `ChatChannelRenderContext`: create a chunk queue,
 * wrap its iterable with the typing-status wrapper, seed any resumed-approval
 * stash entry, and launch the resolved streaming/static driver. Shared verbatim
 * between the agent output processor and the session renderer so the driver and
 * queue primitives stay identical across both paths.
 */
export function openRenderSession(render: ChatChannelRenderContext): RenderSession {
  const queue = createChunkQueue();
  const wrapped = render.wrapStream(queue.iterable);

  // Seed the approval-card stash on resumed runs so the driver can resolve
  // `messageId` for the incoming `tool-result` even though it never saw the
  // pre-suspension `tool-call`.
  if (render.approvalContext) {
    const existing = render.getPendingApproval(render.approvalContext.toolCallId);
    render.onApprovalPosted(render.approvalContext.toolCallId, {
      ...existing,
      messageId: render.approvalContext.messageId,
      displayName: existing?.displayName ?? '',
      argsSummary: existing?.argsSummary ?? '',
      startedAt: existing?.startedAt ?? Date.now(),
    });
  }

  const driverPromise = (
    render.streaming.enabled
      ? runStreamingDriver({
          stream: wrapped,
          chatThread: render.chatThread,
          adapter: render.adapter,
          toolDisplay: render.toolDisplay as 'cards' | 'text' | 'timeline' | 'grouped' | 'hidden',
          toolDisplayFn: render.toolDisplayFn,
          streamingOptions: render.streaming.options,
          channelToolNames: render.channelToolNames,
          logger: render.logger,
          onApprovalPosted: render.onApprovalPosted,
          getPendingApproval: render.getPendingApproval,
          takePendingApproval: render.takePendingApproval,
          typingGate: render.typingGate,
          formatError: render.formatError,
        })
      : runStaticDriver({
          stream: wrapped,
          chatThread: render.chatThread,
          adapter: render.adapter,
          toolDisplay: render.toolDisplay as 'cards' | 'text' | 'hidden',
          toolDisplayFn: render.toolDisplayFn,
          channelToolNames: render.channelToolNames,
          logger: render.logger,
          onApprovalPosted: render.onApprovalPosted,
          getPendingApproval: render.getPendingApproval,
          takePendingApproval: render.takePendingApproval,
          formatError: render.formatError,
        })
  ).catch((err: unknown) => {
    // Prevent unhandled rejection if the driver fails before a terminal chunk
    // reaches the producer. The error is re-thrown when awaited at cleanup.
    render.logger?.error?.(`[${render.platform}] channel render driver failed early`, { error: err });
    throw err;
  });

  return { queue, driverPromise };
}
