import { ReadableStream } from 'node:stream/web';
import { llm, voice } from '@livekit/agents';
import type { AgentExecutionOptionsBase } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { chatContextToMessages, extractNewTurnMessages } from './messages';
import type { VoiceTurnMessage } from './messages';
import type { VoiceAgentTransport } from './transport';

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

export interface MastraVoiceAgentOptions {
  /**
   * The transport that generates replies — the seam between LiveKit and Mastra. Build the
   * default in-process transport with {@link inProcessTransport}, which runs the agent's
   * full loop (model, tools, memory) inside the worker.
   */
  transport: VoiceAgentTransport;
  /**
   * Conversation persistence. When set, only messages new since the agent last spoke are
   * sent each turn and Mastra Memory supplies history. When `false`, the full LiveKit
   * in-session context is sent on every turn instead.
   */
  memory?: MastraVoiceAgentMemory | false;
  /** Request context entries forwarded to the transport for each turn. */
  requestContext?: RequestContext | Record<string, unknown>;
  /**
   * Called when the Mastra agent starts a tool call mid-reply. Return a short phrase
   * (e.g. "Let me look that up.") to speak it while the tool runs; it also appears in
   * the transcript. Return nothing to stay silent.
   */
  toolFeedback?: (toolCall: VoiceToolCall) => string | undefined | void;
  /** LiveKit agent instructions. Unused for reply generation (the Mastra agent applies its own). */
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
 * placeholder satisfies the gate; the Mastra agent does the actual generation.
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
 * A LiveKit `voice.Agent` whose replies come from a Mastra agent.
 *
 * LiveKit keeps ownership of the audio loop (VAD, STT, turn detection, TTS, barge-in)
 * and calls `llmNode` to generate each reply; the node runs the Mastra agent's full
 * loop — model, tools, memory — and streams text deltas back. On barge-in LiveKit
 * cancels the returned stream, which aborts the in-flight Mastra stream.
 */
export class MastraVoiceAgent extends voice.Agent {
  readonly transport: VoiceAgentTransport;
  readonly memory: MastraVoiceAgentMemory | false;
  readonly requestContext?: RequestContext;
  readonly toolFeedback?: (toolCall: VoiceToolCall) => string | undefined | void;

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
    this.transport = options.transport;
    this.memory = options.memory ?? false;
    this.requestContext = toRequestContext(options.requestContext);
    this.toolFeedback = options.toolFeedback;
  }

  override async llmNode(
    chatCtx: llm.ChatContext,
    _toolCtx: llm.ToolContext,
    _modelSettings: voice.ModelSettings,
  ): Promise<ReadableStream<llm.ChatChunk | string> | null> {
    const messages: VoiceTurnMessage[] =
      this.memory === false ? chatContextToMessages(chatCtx) : extractNewTurnMessages(chatCtx);
    if (messages.length === 0) return null;

    const abortController = new AbortController();
    const transport = this.transport;
    const memory = this.memory;
    const requestContext = this.requestContext;
    const toolFeedback = this.toolFeedback;
    let cancelled = false;

    return new ReadableStream<string>({
      start: async controller => {
        try {
          const stream = await transport.stream({
            messages,
            memory,
            requestContext,
            abortSignal: abortController.signal,
          });
          for await (const chunk of stream) {
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
  }
}

export function createMastraVoiceAgent(options: MastraVoiceAgentOptions): MastraVoiceAgent {
  return new MastraVoiceAgent(options);
}
