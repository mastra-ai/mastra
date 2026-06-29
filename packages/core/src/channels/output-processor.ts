import type { Adapter, Thread } from 'chat';

import type { IMastraLogger } from '../logger/logger';
import { parseMemoryRequestContext } from '../memory/types';
import type { ProcessOutputStreamArgs } from '../processors';
import type { AgentChunkType, ChunkType } from '../stream/types';

import type { AgentChannels } from './agent-channels';
import { runStaticDriver } from './chat-driver-static';
import { runStreamingDriver } from './chat-driver-streaming';
import type { PendingApprovalRecord } from './stream-helpers';
import type { TextDisplay, ToolDisplay, ToolDisplayFn } from './types';

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
  /** When the agent's text output is posted. See {@link TextDisplay}. */
  textDisplay: TextDisplay;
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

/**
 * `requestContext` key for per-run channel render overrides.
 *
 * Set this to deviate a single run from the channel's configured render
 * options without changing the channel defaults:
 *
 * - `false` — suppress this run's channel post entirely (the run still
 *   executes; nothing is posted to the channel).
 * - `{ textDisplay?, toolDisplay?, streaming? }` — override individual render
 *   knobs for this run only. Each provided field replaces the base value;
 *   omitted fields keep the channel's configured value.
 *
 * Reach: when set via `ifIdle.streamOptions.requestContext` on a heartbeat,
 * this only rides the idle/wake path (not `ifActive`, not the threadless
 * `agent.generate` path). Pair with `ifActive: 'discard'` to pin a heartbeat
 * to wake-only semantics so the override is a deterministic opt-in.
 */
export const CHAT_CHANNEL_RENDER_OVERRIDE_KEY = 'channel.render';

/**
 * Value shape for {@link CHAT_CHANNEL_RENDER_OVERRIDE_KEY}. `false` suppresses
 * the channel post for the run; an object overrides individual render knobs.
 */
export type ChatChannelRenderOverride =
  | false
  | {
      /** Override when text posts. See {@link TextDisplay}. */
      textDisplay?: TextDisplay;
      /** Override tool display. Coerced through the channel's invariant logic. */
      toolDisplay?: ToolDisplay;
      /** Override streaming. `false` forces the static driver. */
      streaming?: boolean | { updateIntervalMs?: number };
    };

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
 * Per-run overrides: a run may set {@link CHAT_CHANNEL_RENDER_OVERRIDE_KEY}
 * (`'channel.render'`) on `requestContext` to deviate from the channel's
 * configured render options for that run only. `false` suppresses the post
 * entirely; an object `{ textDisplay?, toolDisplay?, streaming? }` overrides
 * individual knobs (routed through the channel's invariant logic). When set via
 * `ifIdle.streamOptions.requestContext` on a heartbeat, the override only rides
 * the idle/wake path — pair with `ifActive: 'discard'` to make it deterministic.
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
      return (state.render as ChatChannelRenderContext | null) ?? undefined;
    }

    // Suppression (cheapest, first): `channel.render === false` drops this run's
    // channel post entirely. Cache `null` so we skip the fast path + fallback on
    // every subsequent chunk and the run passes through untouched.
    const override = requestContext?.get(CHAT_CHANNEL_RENDER_OVERRIDE_KEY) as ChatChannelRenderOverride | undefined;
    if (override === false) {
      state.render = null;
      return undefined;
    }

    const fromRequest = requestContext?.get(CHAT_CHANNEL_RENDER_CONTEXT_KEY) as ChatChannelRenderContext | undefined;
    if (fromRequest) {
      const merged = this.#applyRenderOverride(fromRequest, override);
      state.render = merged;
      return merged;
    }

    const threadId = parseMemoryRequestContext(requestContext)?.thread?.id;
    if (this.#agentChannels && threadId) {
      const rebuilt = await this.#agentChannels.buildRenderContextForThread(threadId);
      const merged = rebuilt ? this.#applyRenderOverride(rebuilt, override) : null;
      // Cache `null` too, so a non-channel thread isn't re-resolved per chunk.
      state.render = merged;
      return merged ?? undefined;
    }

    return undefined;
  }

  /**
   * Merge a per-run `channel.render` override object onto a built render
   * context. Only an object override reaches here — `false` (suppress) is
   * handled in `#resolveRenderContext` before this is called.
   *
   * `toolDisplay` and `streaming` overrides are routed through the channel's own
   * invariant logic (`resolveToolDisplayForOverride` / `normalizeStreamingForOverride`)
   * so streaming-only tool modes can't reach the static driver as invalid modes.
   * When the processor is unbound (no `AgentChannels`, e.g. in standalone tests)
   * those overrides are applied directly — there's no invariant source to defer
   * to, and the driver-selection coercion still guards the static path.
   */
  #applyRenderOverride(
    base: ChatChannelRenderContext,
    override: ChatChannelRenderOverride | undefined,
  ): ChatChannelRenderContext {
    if (!override) return base;

    const next: ChatChannelRenderContext = { ...base };

    if (override.textDisplay !== undefined) {
      next.textDisplay = override.textDisplay;
    }

    if (override.streaming !== undefined) {
      next.streaming = this.#agentChannels
        ? this.#agentChannels.normalizeStreamingForOverride(override.streaming)
        : this.#normalizeStreaming(override.streaming);
    }

    if (override.toolDisplay !== undefined) {
      if (this.#agentChannels) {
        const { resolved, fn } = this.#agentChannels.resolveToolDisplayForOverride(
          base.platform,
          override.toolDisplay,
          next.streaming.enabled,
        );
        next.toolDisplay = resolved;
        next.toolDisplayFn = fn;
      } else {
        next.toolDisplay = typeof override.toolDisplay === 'function' ? 'cards' : override.toolDisplay;
        next.toolDisplayFn = typeof override.toolDisplay === 'function' ? override.toolDisplay : undefined;
      }
    }

    return next;
  }

  /** Local mirror of `AgentChannels.resolveStreaming` for the unbound case. */
  #normalizeStreaming(raw: boolean | { updateIntervalMs?: number }): {
    enabled: boolean;
    options?: { updateIntervalMs?: number };
  } {
    if (raw === false) return { enabled: false };
    if (raw === true) return { enabled: true, options: {} };
    return { enabled: true, options: raw };
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

    // `textDisplay: 'final'` is inherently non-streaming for text — it
    // accumulates and posts once. Route it through the static driver even when
    // `streaming` is enabled (tool display then also renders statically).
    const useStreaming = render.streaming.enabled && render.textDisplay !== 'final';

    const driverPromise = (
      useStreaming
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
            // The static driver only renders `'cards' | 'text' | 'hidden'`. When
            // a streaming adapter is forced static by `textDisplay: 'final'`, its
            // streaming-only tool modes (`'timeline'`/`'grouped'`) have no Plan to
            // render into, so coerce them to `'cards'`.
            toolDisplay:
              render.toolDisplay === 'timeline' || render.toolDisplay === 'grouped'
                ? 'cards'
                : (render.toolDisplay as 'cards' | 'text' | 'hidden'),
            toolDisplayFn: render.toolDisplayFn,
            channelToolNames: render.channelToolNames,
            logger: render.logger,
            onApprovalPosted: render.onApprovalPosted,
            getPendingApproval: render.getPendingApproval,
            takePendingApproval: render.takePendingApproval,
            formatError: render.formatError,
            textDisplay: render.textDisplay,
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
