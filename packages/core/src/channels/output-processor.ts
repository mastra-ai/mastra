import type { Adapter, Thread } from 'chat';

import type { IMastraLogger } from '../logger/logger';
import type { ProcessOutputStreamArgs } from '../processors';
import type { AgentChunkType, ChunkType } from '../stream/types';

import { runStaticDriver } from './chat-driver-static';
import { runStreamingDriver } from './chat-driver-streaming';
import type { PendingApprovalRecord } from './stream-helpers';
import type { ToolDisplay, ToolDisplayFn } from './types';

/**
 * Per-run render dependencies stashed onto `requestContext` by
 * `AgentChannels.processChatMessage` (and the slash-command / resume paths
 * once those migrate). The output processor reads this on the first chunk
 * and routes subsequent chunks through the resolved chat-SDK driver.
 *
 * Kept separate from `ChannelContext` (which is part of the public LLM
 * surface) so we don't leak runtime handles into prompts or persisted
 * provider metadata.
 *
 * @internal
 */
export interface ChatChannelRenderContext {
  adapter: Adapter;
  chatThread: Thread;
  platform: string;
  streaming: { enabled: boolean; options?: { updateIntervalMs?: number } };
  toolDisplay: ToolDisplay;
  toolDisplayFn?: ToolDisplayFn;
  channelToolNames: Set<string>;
  logger?: IMastraLogger;
  onApprovalPosted: (toolCallId: string, record: PendingApprovalRecord) => void;
  getPendingApproval: (toolCallId: string) => PendingApprovalRecord | undefined;
  takePendingApproval: (toolCallId: string) => PendingApprovalRecord | undefined;
  wrapStream: (stream: AsyncIterable<AgentChunkType<any>>) => AsyncIterable<AgentChunkType<any>>;
  typingGate: { active: boolean };
  formatError?: (error: Error) => unknown;
  approvalContext?: { toolCallId: string; messageId: string };
}

/** Key the processor reads off `requestContext` to locate its render deps. */
export const CHAT_CHANNEL_RENDER_CONTEXT_KEY = '__mastra_chat_channel_render';

interface ChunkQueue {
  iterable: AsyncIterable<AgentChunkType<any>>;
  push: (chunk: AgentChunkType<any>) => void;
  close: () => void;
}

/**
 * Single-producer / single-consumer async queue. The processor pushes chunks
 * synchronously from `processOutputStream`; the driver consumes them via the
 * async iterable. `close()` ends the iteration after pending items are drained.
 */
function createChunkQueue(): ChunkQueue {
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

interface RenderSession {
  queue: ChunkQueue;
  driverPromise: Promise<void>;
}

/**
 * Output processor that mirrors the agent's stream to the originating chat
 * platform (Slack/Discord/etc.) via the existing streaming/static drivers.
 *
 * On the first chunk of a run, the processor opens a render session: it spins
 * up an async queue, hands the queue's iterable to `runStreamingDriver` (or
 * `runStaticDriver`), and stores the session on the per-run `state` arg.
 * Subsequent chunks push into the queue and return immediately — the driver
 * pumps chunks to the platform in the background, never blocking the agent
 * loop.
 *
 * On `finish` / `error` chunks the queue is closed and the driver promise is
 * awaited so the run doesn't end (and a serverless invocation isn't allowed
 * to freeze) before the last `chat.update` lands.
 *
 * Skips entirely when no `CHAT_CHANNEL_RENDER_CONTEXT_KEY` exists on
 * `requestContext` — runs that didn't come in through the channels path
 * (Studio, direct API, etc.) pass through untouched.
 *
 * @internal
 */
export class ChatChannelOutputProcessor {
  readonly id = 'chat-channel-render';

  /** Need data-* chunks because some drivers (`hidden`/`grouped`) inspect them. */
  readonly processDataParts = true;

  async processOutputStream({
    part,
    state,
    requestContext,
  }: ProcessOutputStreamArgs): Promise<ChunkType | null | undefined> {
    const render = requestContext?.get(CHAT_CHANNEL_RENDER_CONTEXT_KEY) as ChatChannelRenderContext | undefined;
    if (!render) return part;

    let session = state.session as RenderSession | undefined;

    if (!session) {
      session = this.#openSession(render);
      state.session = session;
    }

    session.queue.push(part as AgentChunkType<any>);

    // Agents emit a `finish` chunk per LLM step, plus a `step-finish` per step
    // whose payload carries `isContinued`. Multi-step runs (e.g. tool calls or
    // model-continuation) keep streaming after each per-step `finish`, so we
    // must NOT close on `finish`. Close only on the terminal `step-finish`
    // (`isContinued === false`) or on `error`.
    const isTerminalStepFinish =
      part.type === 'step-finish' && (part as any).payload?.stepResult?.isContinued !== true;
    if (isTerminalStepFinish || part.type === 'error') {
      session.queue.close();
      try {
        await session.driverPromise;
      } catch (err) {
        render.logger?.error?.(`[${render.platform}] channel render driver failed`, { error: err });
      }
    }

    return part;
  }

  #openSession(render: ChatChannelRenderContext): RenderSession {
    const queue = createChunkQueue();
    const wrapped = render.wrapStream(queue.iterable);

    // Seed the approval-card stash on resumed runs so the driver can resolve
    // `messageId` for the incoming `tool-result` even though it never saw the
    // pre-suspension `tool-call`.
    if (render.approvalContext) {
      render.onApprovalPosted(render.approvalContext.toolCallId, {
        messageId: render.approvalContext.messageId,
        displayName: '',
        argsSummary: '',
        startedAt: Date.now(),
      });
    }

    const driverPromise = render.streaming.enabled
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
        });

    return { queue, driverPromise };
  }
}
