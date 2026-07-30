import { ReadableStream } from 'node:stream/web';
import { llm, voice } from '@livekit/agents';
import type { Agent as MastraAgent, AgentExecutionOptionsBase } from '@mastra/core/agent';
import type { TracingContext } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { chatContextToMessages, extractNewTurnMessages } from './messages';
import type { VoiceTurnMessage } from './messages';

const DEFAULT_INSTRUCTIONS = 'You are a helpful voice assistant powered by a Mastra agent.';

/** Default spoken text for periodic AI re-disclosure. See {@link MastraVoiceAgentOptions.greetingReminder}. */
export const DEFAULT_DISCLOSURE_REMINDER = "Just a reminder, you're speaking with an AI assistant.";

/**
 * Tracks periodic AI re-disclosure for a single call. `due()` returns the reminder text once
 * `everyMs` has elapsed since the last disclosure (resetting the clock), otherwise `undefined`.
 * Time is injectable so the interval logic is deterministically testable.
 */
export class DisclosureReminder {
  private lastAt: number;
  constructor(
    private readonly everyMs: number,
    private readonly text: string,
    now: number = Date.now(),
  ) {
    this.lastAt = now;
  }
  /** Call once per turn: the reminder text if it's due, else `undefined`. Does not reset the clock —
   * call {@link DisclosureReminder.markDelivered} once the reminder is actually threaded into the
   * outgoing reply, so a reminder that never makes it out isn't silently skipped for a full interval. */
  due(now: number = Date.now()): string | undefined {
    if (now - this.lastAt < this.everyMs) return undefined;
    return this.text;
  }
  /** Resets the clock. Call only once the reminder text from {@link due} was actually emitted. */
  markDelivered(now: number = Date.now()): void {
    this.lastAt = now;
  }
}

/**
 * Wraps `source` in a stream that emits `text` as a single leading chunk (with a trailing space, so
 * TTS pauses before the reply) before piping the rest of `source` through unchanged. Cancelling the
 * wrapper cancels `source` — so barge-in still aborts the underlying generation.
 */
export function prependText(source: ReadableStream<string>, text: string): ReadableStream<string> {
  const prefix = text.endsWith(' ') ? text : `${text} `;
  const reader = source.getReader();
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(prefix);
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

export type MastraStreamOptions = Partial<AgentExecutionOptionsBase<unknown>>;

export interface VoiceToolCall {
  toolCallId: string;
  toolName: string;
  args?: unknown;
}

/**
 * Token usage for one turn, captured from the model's `finish` chunk. Field names mirror LiveKit's
 * `CompletionUsage` so the plugin can forward it into `metrics_collected` without remapping.
 */
export interface VoiceTurnUsage {
  /** Tokens in the prompt (LiveKit `promptTokens`). */
  promptTokens: number;
  /** Tokens in the completion (LiveKit `completionTokens`). */
  completionTokens: number;
  /** Cached prompt tokens (LiveKit `promptCachedTokens`). */
  promptCachedTokens: number;
  /** Total tokens for the turn. */
  totalTokens: number;
}

/**
 * Maps a Mastra `finish` chunk's usage (`payload.output.usage`, AI-SDK `LanguageModelUsage`) to the
 * LiveKit-shaped {@link VoiceTurnUsage}, or `undefined` when the chunk carries no token counts.
 * Handles both the flat V2 usage shape (`inputTokens`/`outputTokens`) and the nested V3 shape
 * (`inputTokens.total`/`outputTokens.total`).
 */
export function mapTurnUsage(usage: unknown): VoiceTurnUsage | undefined {
  if (!usage || typeof usage !== 'object') return undefined;
  const u = usage as Record<string, unknown>;
  // Prefer the flat V2 shape (`inputTokens: number`); fall back to the nested V3 shape
  // (`inputTokens: { total, cacheRead }`).
  const totalOf = (v: unknown): number | undefined => {
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object' && typeof (v as { total?: unknown }).total === 'number') {
      return (v as { total: number }).total;
    }
    return undefined;
  };
  const cacheReadOf = (v: unknown): number | undefined =>
    v && typeof v === 'object' && typeof (v as { cacheRead?: unknown }).cacheRead === 'number'
      ? (v as { cacheRead: number }).cacheRead
      : undefined;

  const promptTokens = totalOf(u.inputTokens) ?? 0;
  const completionTokens = totalOf(u.outputTokens) ?? 0;
  const promptCachedTokens =
    (typeof u.cachedInputTokens === 'number' ? u.cachedInputTokens : cacheReadOf(u.inputTokens)) ?? 0;
  const totalTokens = typeof u.totalTokens === 'number' ? u.totalTokens : promptTokens + completionTokens;
  // Nothing was reported at all → treat as no usage rather than emitting an all-zero chunk.
  if (promptTokens === 0 && completionTokens === 0 && totalTokens === 0 && promptCachedTokens === 0) {
    return undefined;
  }
  return { promptTokens, completionTokens, promptCachedTokens, totalTokens };
}

export interface MastraVoiceAgentMemory {
  thread: string;
  resource?: string;
}

/**
 * Per-turn context handed to a {@link VoiceReplyGenerator}. LiveKit calls `llmNode` once per
 * detected user turn; the bridge builds this context and asks the generator for the reply.
 */
export interface VoiceTurnContext {
  /**
   * The messages to generate a reply from. With Mastra Memory on, only the messages new since
   * the agent last spoke (history comes from the thread); with memory off, the full session.
   *
   * For a workflow / custom generator: pass these straight to a memory-backed `agent.stream(...,
   * { memory })` inside a step so the agent backfills history from the thread (no duplication). A
   * stateless workflow that wants the entire transcript every turn should read `chatCtx` instead
   * (e.g. `chatContextToMessages(chatCtx)`), since there is no thread to backfill from.
   */
  messages: VoiceTurnMessage[];
  /** The raw LiveKit chat context, for generators that want the full transcript or message parts. */
  chatCtx: llm.ChatContext;
  /** Resolved memory mapping for the call, or `false` when memory is disabled. */
  memory: MastraVoiceAgentMemory | false;
  /** Request context forwarded to generation. */
  requestContext?: RequestContext;
  /** Voice-call span context, so each turn's generation nests under the call trace. */
  tracingContext?: TracingContext;
  /**
   * Internal, per-turn side channel for token usage. A generator invokes this once, when the
   * `finish` chunk carries usage, so the caller (e.g. `MastraLLMStream`) can attribute usage to
   * exactly this turn — kept on the context (not on generator options) so overlapping turns from
   * preemptive generation can't misattribute usage. Fire-and-forget; the generator does not await it.
   */
  onUsage?: (usage: VoiceTurnUsage) => void;
}

/**
 * What a turn produced, handed to {@link VoiceTurnCompleteHook} after the reply finishes.
 */
export interface VoiceTurnResult {
  /** The assistant reply text streamed this turn, accumulated from the model's text deltas. */
  text: string;
  /** Tool calls the agent made during the turn, in order. */
  toolCalls: VoiceToolCall[];
  /** True when barge-in cut the turn short before it finished streaming. */
  interrupted: boolean;
  /** Token usage for the turn when the model reported it in its `finish` chunk. */
  usage?: VoiceTurnUsage;
}

/** {@link VoiceTurnContext} plus the reply it produced. Passed to {@link VoiceTurnCompleteHook}. */
export interface VoiceTurnCompleteContext extends VoiceTurnContext {
  /** The reply the agent produced this turn. */
  result: VoiceTurnResult;
}

/**
 * Called once per turn AFTER the reply has finished streaming to text-to-speech — off the audio
 * path. It runs fire-and-forget: the turn does not await it, so post-turn work (memory
 * maintenance, CRM writes, analytics) never delays what the caller hears or the next turn. A
 * thrown error or rejected promise is logged, not propagated. Because the resolved `memory`
 * mapping (`thread`/`resource`) is on the context, this is the place for a truly non-blocking
 * `memory.updateWorkingMemory(...)`. See {@link MastraVoiceAgentOptions.onTurnComplete}.
 */
export type VoiceTurnCompleteHook = (ctx: VoiceTurnCompleteContext) => void | Promise<void>;

/**
 * Produces a stream of text deltas for one conversational turn, or `null` to stay silent.
 * Cancelling the returned stream (LiveKit does this on barge-in) must abort the underlying
 * generation. Built-in implementations: {@link createAgentReplyGenerator} (a Mastra agent) and
 * `createWorkflowReplyGenerator` (a Mastra workflow).
 */
export type VoiceReplyGenerator = (
  ctx: VoiceTurnContext,
) => ReadableStream<string> | null | Promise<ReadableStream<string> | null>;

export interface AgentReplyGeneratorOptions {
  /** The Mastra agent that generates replies. Tools and memory run inside this agent. */
  agent: MastraAgent;
  /** Extra options merged into every `agent.stream()` call (e.g. `tracingContext`). */
  streamOptions?: MastraStreamOptions;
  /** Speak a short phrase while a tool call runs. See {@link MastraVoiceAgentOptions.toolFeedback}. */
  toolFeedback?: (toolCall: VoiceToolCall) => string | undefined | void;
  /** Notified as each tool-call chunk arrives, mid-stream. See {@link MastraVoiceAgentOptions.onToolCall}. */
  onToolCall?: (toolCall: VoiceToolCall) => void;
  /** Fired off the audio path after the reply streams. See {@link MastraVoiceAgentOptions.onTurnComplete}. */
  onTurnComplete?: VoiceTurnCompleteHook;
}

/**
 * A {@link VoiceReplyGenerator} backed by a Mastra agent: runs the agent's full loop (model,
 * tools, memory) and streams its text deltas. On barge-in the returned stream is cancelled,
 * which aborts the in-flight `agent.stream()`.
 */
export function createAgentReplyGenerator(options: AgentReplyGeneratorOptions): VoiceReplyGenerator {
  const { agent, streamOptions, toolFeedback, onToolCall, onTurnComplete } = options;
  return ctx => {
    if (ctx.messages.length === 0) return null;

    const abortController = new AbortController();
    const mergedOptions: MastraStreamOptions = {
      ...streamOptions,
      abortSignal: abortController.signal,
    };
    if (ctx.memory) mergedOptions.memory = ctx.memory;
    if (ctx.requestContext) mergedOptions.requestContext = ctx.requestContext;

    let cancelled = false;
    // Accumulated as the turn streams so the post-turn hook can see what was actually produced.
    let replyText = '';
    const toolCalls: VoiceToolCall[] = [];
    let usage: VoiceTurnUsage | undefined;

    // Fire-and-forget after the reply has streamed: off the audio path (the caller already heard
    // the text), and not awaited, so it never delays the next turn. Errors are logged, not thrown.
    const emitTurnComplete = (interrupted: boolean) => {
      if (!onTurnComplete) return;
      const completeCtx: VoiceTurnCompleteContext = {
        ...ctx,
        result: { text: replyText, toolCalls, interrupted, usage },
      };
      Promise.resolve()
        .then(() => onTurnComplete(completeCtx))
        .catch(error => {
          console.warn('@mastra/livekit: onTurnComplete hook threw', error);
        });
    };

    return new ReadableStream<string>({
      start: async controller => {
        try {
          const result = await agent.stream(ctx.messages, mergedOptions);
          for await (const chunk of result.fullStream) {
            if (cancelled) break;
            if (chunk.type === 'text-delta') {
              if (chunk.payload.text) {
                replyText += chunk.payload.text;
                controller.enqueue(chunk.payload.text);
              }
            } else if (chunk.type === 'tool-call') {
              const toolCall: VoiceToolCall = {
                toolCallId: chunk.payload.toolCallId,
                toolName: chunk.payload.toolName,
                args: chunk.payload.args,
              };
              toolCalls.push(toolCall);
              // Observer hooks are customer code: a throw must not tear down an otherwise healthy
              // reply stream (same isolation as onTurnComplete).
              try {
                onToolCall?.(toolCall);
              } catch (error) {
                console.warn('@mastra/livekit: onToolCall hook threw', error);
              }
              if (toolFeedback) {
                let filler: string | undefined | void;
                try {
                  filler = toolFeedback(toolCall);
                } catch (error) {
                  console.warn('@mastra/livekit: toolFeedback hook threw', error);
                }
                if (filler) controller.enqueue(filler.endsWith(' ') ? filler : `${filler} `);
              }
            } else if (chunk.type === 'finish') {
              // Usage is dropped from the spoken stream but surfaced via the per-turn side channel
              // and on the turn result, so the plugin and onTurnComplete consumers can read it.
              const output = (chunk.payload as { output?: { usage?: unknown } }).output;
              const turnUsage = mapTurnUsage(output?.usage);
              if (turnUsage) {
                usage = turnUsage;
                try {
                  ctx.onUsage?.(turnUsage);
                } catch (error) {
                  console.warn('@mastra/livekit: onUsage hook threw', error);
                }
              }
            } else if (chunk.type === 'error') {
              const error = chunk.payload.error;
              throw error instanceof Error ? error : new Error(String(error));
            }
          }
          if (!cancelled) controller.close();
          // Success, or a clean barge-in break out of the loop: the turn is done either way.
          emitTurnComplete(cancelled);
        } catch (error) {
          // Barge-in cancels the stream and aborts generation; that's not a failure — the turn
          // still completed (interrupted), so the hook still fires for memory reconciliation.
          if (cancelled || abortController.signal.aborted) {
            emitTurnComplete(true);
            return;
          }
          controller.error(error);
        }
      },
      cancel: () => {
        cancelled = true;
        abortController.abort();
      },
    });
  };
}

export interface MastraVoiceAgentOptions {
  /**
   * The Mastra agent that generates replies. Tools and memory run inside this agent. Provide
   * either this or {@link MastraVoiceAgentOptions.generate}.
   */
  agent?: MastraAgent;
  /**
   * A lower-level reply generator (e.g. from `createWorkflowReplyGenerator`). Use instead of
   * `agent` to drive replies with a workflow or any custom generator.
   */
  generate?: VoiceReplyGenerator;
  /**
   * Conversation persistence. When set, only messages new since the agent last spoke are
   * sent each turn and Mastra Memory supplies history. When `false`, the full LiveKit
   * in-session context is sent on every turn instead.
   */
  memory?: MastraVoiceAgentMemory | false;
  /** Request context entries forwarded to generation. */
  requestContext?: RequestContext | Record<string, unknown>;
  /**
   * Called when the Mastra agent starts a tool call mid-reply. Return a short phrase (e.g. "Let
   * me look that up.") to speak it while the tool runs; it also appears in the transcript. Return
   * nothing to stay silent. Applies to the agent generator built here; the workflow generator
   * takes its own equivalent via `createWorkflowReplyGenerator`.
   */
  toolFeedback?: (toolCall: VoiceToolCall) => string | undefined | void;
  /**
   * Called as each tool call starts mid-reply (before the tool result is known), the building block
   * for tool-driven side effects — analytics, agent-initiated hang-up — without waiting for the turn
   * to finish. Runs synchronously on the stream; keep it cheap and non-throwing. Applies to the agent
   * generator built here; the workflow generator surfaces tool calls via `onTurnComplete` instead.
   */
  onToolCall?: (toolCall: VoiceToolCall) => void;
  /**
   * Called once per turn after the reply has finished streaming to text-to-speech. Runs off the
   * audio path and fire-and-forget — the turn does not await it — so post-turn memory
   * maintenance, CRM writes, or analytics never delay the caller or the next turn. The context
   * carries the produced reply ({@link VoiceTurnResult}) and the resolved `memory` mapping, so
   * this is where a truly non-blocking `memory.updateWorkingMemory(...)` belongs. A thrown error
   * or rejected promise is logged, not propagated. Applies to the agent generator built here; the
   * workflow generator takes its own via `createWorkflowReplyGenerator`.
   */
  onTurnComplete?: VoiceTurnCompleteHook;
  /**
   * Periodic AI re-disclosure. When set, once `everyMs` has elapsed since the last disclosure the
   * NEXT turn's reply is prefixed with `text` (spoken at the turn boundary, never mid-turn), so long
   * calls keep re-disclosing the AI status. Applies to the agent and workflow/custom generators. The
   * worker derives this from `configuration.greeting.repeatEvery` / `repeatText`; `text` defaults to
   * {@link DEFAULT_DISCLOSURE_REMINDER}.
   */
  greetingReminder?: { everyMs: number; text?: string };
  /** Extra options merged into every `agent.stream()` call (agent generator only). */
  streamOptions?: MastraStreamOptions;
  /** LiveKit agent instructions. Unused for reply generation (the Mastra agent/workflow applies its own). */
  instructions?: string;
  id?: voice.AgentOptions<unknown>['id'];
  stt?: voice.AgentOptions<unknown>['stt'];
  vad?: voice.AgentOptions<unknown>['vad'];
  tts?: voice.AgentOptions<unknown>['tts'];
  turnHandling?: voice.AgentOptions<unknown>['turnHandling'];
}

function toRequestContext(value: RequestContext | Record<string, unknown> | undefined): RequestContext | undefined {
  if (!value) return undefined;
  if (value instanceof RequestContext) return value;
  return new RequestContext<unknown>(Object.entries(value));
}

/**
 * The session only runs its cascaded reply pipeline when an `llm` instance is present —
 * `llmNode` replaces the inference step, but the gate checks `llm instanceof LLM`. This
 * placeholder satisfies the gate; the Mastra agent/workflow does the actual generation.
 */
class MastraPlaceholderLLM extends llm.LLM {
  label(): string {
    return 'mastra.MastraVoiceAgent';
  }

  override get model(): string {
    return 'mastra-agent';
  }

  override get provider(): string {
    return 'mastra';
  }

  chat(): llm.LLMStream {
    throw new Error(
      '@mastra/livekit: reply generation runs through the Mastra agent via llmNode; the placeholder LLM cannot be used for inference.',
    );
  }
}

/**
 * A LiveKit `voice.Agent` whose replies come from a Mastra agent or workflow.
 *
 * LiveKit keeps ownership of the audio loop (VAD, STT, turn detection, TTS, barge-in) and calls
 * `llmNode` once per detected user turn; the node delegates to a {@link VoiceReplyGenerator}
 * which streams text deltas back. On barge-in LiveKit cancels the returned stream, which aborts
 * the in-flight generation.
 */
export class MastraVoiceAgent extends voice.Agent {
  readonly mastraAgent?: MastraAgent;
  readonly memory: MastraVoiceAgentMemory | false;
  readonly requestContext?: RequestContext;
  readonly streamOptions?: MastraStreamOptions;
  private readonly replyGenerator: VoiceReplyGenerator;
  private readonly reminder?: DisclosureReminder;

  constructor(options: MastraVoiceAgentOptions) {
    if (options.agent && options.generate) {
      throw new Error(
        '@mastra/livekit: MastraVoiceAgent requires `agent` or `generate`, not both — they are mutually exclusive reply sources.',
      );
    }
    super({
      id: options.id,
      instructions: options.instructions ?? DEFAULT_INSTRUCTIONS,
      stt: options.stt,
      vad: options.vad,
      llm: new MastraPlaceholderLLM(),
      tts: options.tts,
      turnHandling: options.turnHandling,
    });
    this.memory = options.memory ?? false;
    this.requestContext = toRequestContext(options.requestContext);
    this.streamOptions = options.streamOptions;
    if (options.greetingReminder) {
      this.reminder = new DisclosureReminder(
        options.greetingReminder.everyMs,
        options.greetingReminder.text?.trim() || DEFAULT_DISCLOSURE_REMINDER,
      );
    }

    if (options.generate) {
      this.replyGenerator = options.generate;
    } else if (options.agent) {
      this.mastraAgent = options.agent;
      this.replyGenerator = createAgentReplyGenerator({
        agent: options.agent,
        streamOptions: options.streamOptions,
        toolFeedback: options.toolFeedback,
        onToolCall: options.onToolCall,
        onTurnComplete: options.onTurnComplete,
      });
    } else {
      throw new Error('@mastra/livekit: MastraVoiceAgent requires `agent` or `generate`.');
    }
  }

  override async llmNode(
    chatCtx: llm.ChatContext,
    _toolCtx: llm.ToolContext,
    _modelSettings: voice.ModelSettings,
  ): Promise<ReadableStream<llm.ChatChunk | string> | null> {
    const messages: VoiceTurnMessage[] =
      this.memory === false ? chatContextToMessages(chatCtx) : extractNewTurnMessages(chatCtx);
    if (messages.length === 0) return null;

    const reply = await this.replyGenerator({
      messages,
      chatCtx,
      memory: this.memory,
      requestContext: this.requestContext,
      tracingContext: this.streamOptions?.tracingContext,
    });
    if (!reply) return null;

    // Periodic AI re-disclosure: when the interval has elapsed, prefix this turn's spoken reply with
    // the reminder. Done at the turn boundary (never mid-turn), riding the same stream so barge-in
    // cancellation still propagates to the underlying generation. The clock only resets once the
    // reminder is actually threaded into the outgoing reply below, not just because it was due.
    // KNOWN LIMIT: "threaded into the reply" is stream-build time, not playout. Under LiveKit's
    // preemptive generation a discarded speculative reply still resets the clock, so the next real
    // turn can miss its reminder — hence the documented repeatEvery/preemptiveGeneration
    // incompatibility. A playout-accurate reset needs a confirmed-turn signal llmNode doesn't have.
    const reminder = this.reminder?.due();
    if (!reminder) return reply;
    this.reminder?.markDelivered();
    return prependText(reply, reminder);
  }
}

export function createMastraVoiceAgent(options: MastraVoiceAgentOptions): MastraVoiceAgent {
  return new MastraVoiceAgent(options);
}
