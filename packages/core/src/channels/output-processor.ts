import type { Adapter, Thread } from 'chat';

import type { IMastraLogger } from '../logger/logger';
import { parseMemoryRequestContext } from '../memory/types';
import type { ProcessOutputStreamArgs } from '../processors';
import type { AgentChunkType, ChunkType } from '../stream/types';

import type { AgentChannels } from './agent-channels';
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
 * Render context is resolved in two ways, in order:
 *
 * 1. Fast path — `CHAT_CHANNEL_RENDER_CONTEXT_KEY` on `requestContext`, stashed
 *    by `AgentChannels` on inbound platform events (`processChatMessage`,
 *    approve/decline). This is the original webhook path and is unchanged.
 * 2. Fallback — when no render context is on `requestContext` (heartbeat,
 *    Studio, custom UI, user code) but the processor is bound to its owning
 *    `AgentChannels`, it reconstructs the render context from the run's
 *    `threadId` via `agentChannels.buildRenderContextForThread(threadId)`,
 *    which reads the thread's persisted channel coordinates. The `threadId` is
 *    taken from the memory context the framework stashes on `requestContext`
 *    under the `MastraMemory` key.
 *
 * Runs that resolve no render context at all — non-channel threads, or an
 * unbound processor with no `requestContext` key — pass through untouched.
 *
 * @internal
 */
export class ChatChannelOutputProcessor {
  readonly id = 'chat-channel-render';

  /** Need data-* chunks because some drivers (`hidden`/`grouped`) inspect them. */
  readonly processDataParts = true;

  /**
   * The owning `AgentChannels`, bound at construction. Enables the fallback
   * render-context reconstruction for runs without an inbound `requestContext`.
   * Optional so the processor can still be constructed standalone in tests.
   */
  #agentChannels?: AgentChannels;

  constructor(agentChannels?: AgentChannels) {
    this.#agentChannels = agentChannels;
  }

  async processOutputStream({
    part,
    state,
    requestContext,
  }: ProcessOutputStreamArgs): Promise<ChunkType | null | undefined> {
    const render = await this.#resolveRenderContext(state, requestContext);
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
    const isTerminalStepFinish = part.type === 'step-finish' && (part as any).payload?.stepResult?.isContinued !== true;
    if (isTerminalStepFinish || part.type === 'error' || part.type === 'abort') {
      session.queue.close();
      try {
        await session.driverPromise;
      } catch (err) {
        render.logger?.error?.(`[${render.platform}] channel render driver failed`, { error: err });
      }
    }

    return part;
  }

  /**
   * Resolve the render context for this run, built once and cached on `state`.
   *
   * Fast path: the inbound `requestContext` key. Fallback: reconstruct from the
   * run's `threadId` via the bound `AgentChannels`. The `threadId` is read from
   * the memory context the framework stashes on `requestContext` under the
   * `MastraMemory` key (populated on every run that resolves a thread, including
   * heartbeat / signal-wake runs). The resolved value (or `null` for
   * non-channel runs) is cached on `state.render` so we don't reload thread
   * metadata on every chunk.
   */
  async #resolveRenderContext(
    state: Record<string, any>,
    requestContext: ProcessOutputStreamArgs['requestContext'],
  ): Promise<ChatChannelRenderContext | undefined> {
    if (state.render !== undefined) {
      return state.render as ChatChannelRenderContext | undefined;
    }

    const fromRequest = requestContext?.get(CHAT_CHANNEL_RENDER_CONTEXT_KEY) as ChatChannelRenderContext | undefined;
    if (fromRequest) {
      state.render = fromRequest;
      return fromRequest;
    }

    const threadId = parseMemoryRequestContext(requestContext)?.thread?.id;
    if (this.#agentChannels && threadId) {
      const rebuilt = await this.#agentChannels.buildRenderContextForThread(threadId);
      // Cache `null` too, so a non-channel thread isn't re-resolved per chunk.
      state.render = rebuilt ?? null;
      return rebuilt ?? undefined;
    }

    return undefined;
  }

  #openSession(render: ChatChannelRenderContext): RenderSession {
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
    ).catch(err => {
      // Prevent unhandled rejection if the driver fails before a terminal chunk
      // reaches processOutputStream. The error is re-thrown when awaited at cleanup.
      render.logger?.error?.(`[${render.platform}] channel render driver failed early`, { error: err });
      throw err;
    });

    return { queue, driverPromise };
  }
}
