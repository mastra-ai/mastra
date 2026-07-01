import { ReadableStream } from 'node:stream/web';
import { llm, voice } from '@livekit/agents';
import type { Agent as MastraAgent, AgentExecutionOptionsBase } from '@mastra/core/agent';
import type { TracingContext } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { chatContextToMessages, extractNewTurnMessages } from './messages';
import type { VoiceTurnMessage } from './messages';

const DEFAULT_INSTRUCTIONS = 'You are a helpful voice assistant powered by a Mastra agent.';

export type MastraStreamOptions = Partial<AgentExecutionOptionsBase<unknown>>;

export interface VoiceToolCall {
  toolCallId: string;
  toolName: string;
  args?: unknown;
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
  /** Fired off the audio path after the reply streams. See {@link MastraVoiceAgentOptions.onTurnComplete}. */
  onTurnComplete?: VoiceTurnCompleteHook;
}

/**
 * A {@link VoiceReplyGenerator} backed by a Mastra agent: runs the agent's full loop (model,
 * tools, memory) and streams its text deltas. On barge-in the returned stream is cancelled,
 * which aborts the in-flight `agent.stream()`.
 */
export function createAgentReplyGenerator(options: AgentReplyGeneratorOptions): VoiceReplyGenerator {
  const { agent, streamOptions, toolFeedback, onTurnComplete } = options;
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

    // Fire-and-forget after the reply has streamed: off the audio path (the caller already heard
    // the text), and not awaited, so it never delays the next turn. Errors are logged, not thrown.
    const emitTurnComplete = (interrupted: boolean) => {
      if (!onTurnComplete) return;
      const completeCtx: VoiceTurnCompleteContext = { ...ctx, result: { text: replyText, toolCalls, interrupted } };
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
              if (toolFeedback) {
                const filler = toolFeedback(toolCall);
                if (filler) controller.enqueue(filler.endsWith(' ') ? filler : `${filler} `);
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
   * Called once per turn after the reply has finished streaming to text-to-speech. Runs off the
   * audio path and fire-and-forget — the turn does not await it — so post-turn memory
   * maintenance, CRM writes, or analytics never delay the caller or the next turn. The context
   * carries the produced reply ({@link VoiceTurnResult}) and the resolved `memory` mapping, so
   * this is where a truly non-blocking `memory.updateWorkingMemory(...)` belongs. A thrown error
   * or rejected promise is logged, not propagated. Applies to the agent generator built here; the
   * workflow generator takes its own via `createWorkflowReplyGenerator`.
   */
  onTurnComplete?: VoiceTurnCompleteHook;
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

    if (options.generate) {
      this.replyGenerator = options.generate;
    } else if (options.agent) {
      this.mastraAgent = options.agent;
      this.replyGenerator = createAgentReplyGenerator({
        agent: options.agent,
        streamOptions: options.streamOptions,
        toolFeedback: options.toolFeedback,
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

    return this.replyGenerator({
      messages,
      chatCtx,
      memory: this.memory,
      requestContext: this.requestContext,
      tracingContext: this.streamOptions?.tracingContext,
    });
  }
}

export function createMastraVoiceAgent(options: MastraVoiceAgentOptions): MastraVoiceAgent {
  return new MastraVoiceAgent(options);
}
