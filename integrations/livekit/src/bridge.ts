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
}

/**
 * A {@link VoiceReplyGenerator} backed by a Mastra agent: runs the agent's full loop (model,
 * tools, memory) and streams its text deltas. On barge-in the returned stream is cancelled,
 * which aborts the in-flight `agent.stream()`.
 */
export function createAgentReplyGenerator(options: AgentReplyGeneratorOptions): VoiceReplyGenerator {
  const { agent, streamOptions, toolFeedback } = options;
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
    return new ReadableStream<string>({
      start: async controller => {
        try {
          const result = await agent.stream(ctx.messages, mergedOptions);
          for await (const chunk of result.fullStream) {
            if (cancelled) break;
            if (chunk.type === 'text-delta') {
              if (chunk.payload.text) controller.enqueue(chunk.payload.text);
            } else if (chunk.type === 'tool-call' && toolFeedback) {
              const filler = toolFeedback({
                toolCallId: chunk.payload.toolCallId,
                toolName: chunk.payload.toolName,
                args: chunk.payload.args,
              });
              if (filler) controller.enqueue(filler.endsWith(' ') ? filler : `${filler} `);
            } else if (chunk.type === 'error') {
              const error = chunk.payload.error;
              throw error instanceof Error ? error : new Error(String(error));
            }
          }
          if (!cancelled) controller.close();
        } catch (error) {
          // Barge-in cancels the stream and aborts generation; that's not a failure.
          if (cancelled || abortController.signal.aborted) return;
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
   * Called when the Mastra agent starts a tool call mid-reply (agent generator only). Return a
   * short phrase (e.g. "Let me look that up.") to speak it while the tool runs; it also appears
   * in the transcript. Return nothing to stay silent.
   */
  toolFeedback?: (toolCall: VoiceToolCall) => string | undefined | void;
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
