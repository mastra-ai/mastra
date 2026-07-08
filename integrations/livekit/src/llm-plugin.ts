import { DEFAULT_API_CONNECT_OPTIONS, llm } from '@livekit/agents';
import type { APIConnectOptions } from '@livekit/agents';
import type { Agent as MastraAgent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { createAgentReplyGenerator } from './bridge';
import type {
  MastraVoiceAgentMemory,
  VoiceReplyGenerator,
  VoiceToolCall,
  VoiceTurnCompleteHook,
  VoiceTurnContext,
  VoiceTurnUsage,
} from './bridge';
import { chatContextToMessages, extractNewTurnMessages } from './messages';
import { createRemoteAgentReplyGenerator } from './remote';
import type { RemoteMastraAgentOptions } from './remote';

export type { RemoteMastraAgentOptions } from './remote';

/**
 * Options for {@link MastraLLM}. Provide **exactly one** reply source — `remote` (the headline: a
 * Mastra app on a remote server), `agent` (an in-process Mastra agent), or `generate` (a custom
 * {@link VoiceReplyGenerator}). The `toolFeedback` / `onToolCall` / `onTurnComplete` hooks apply to
 * the `remote` and `agent` sources; a `generate` source owns its own hooks.
 */
export interface MastraLLMOptions {
  /** Remote Mastra server. Provide exactly one of `remote`, `agent`, `generate`. */
  remote?: RemoteMastraAgentOptions;
  /** In-process Mastra agent (reuses `createAgentReplyGenerator`). */
  agent?: MastraAgent;
  /** Custom reply source (escape hatch; owns its own tool-feedback / turn-complete behavior). */
  generate?: VoiceReplyGenerator;

  /**
   * Conversation persistence, resolved by the customer per call (from SIP/caller identity). When set,
   * only messages new since the agent last spoke are sent each turn and Mastra Memory supplies
   * history. When omitted/false, the full LiveKit chat context is sent every turn.
   *
   * NOTE: incompatible with the session's `preemptiveGeneration` option — a speculative turn that
   * completes before being discarded pollutes the thread (D13). Leave preemptive generation off when
   * using `memory`.
   */
  memory?: MastraVoiceAgentMemory | false;
  /** Request context forwarded to generation (tenant, dialed number, ...). */
  requestContext?: RequestContext | Record<string, unknown>;

  /** Speak a short filler while a (server-side) tool runs. Applies to the `remote`/`agent` sources. */
  toolFeedback?: (toolCall: VoiceToolCall) => string | undefined | void;
  /** Notified as each tool-call chunk arrives, mid-stream. Applies to the `remote`/`agent` sources. */
  onToolCall?: (toolCall: VoiceToolCall) => void;
  /** Fired off the audio path after each reply finishes. Applies to the `remote`/`agent` sources. */
  onTurnComplete?: VoiceTurnCompleteHook;
}

function toRequestContext(value: RequestContext | Record<string, unknown> | undefined): RequestContext | undefined {
  if (!value) return undefined;
  if (value instanceof RequestContext) return value;
  return new RequestContext<unknown>(Object.entries(value));
}

function mapUsageToLiveKit(usage: VoiceTurnUsage): llm.CompletionUsage {
  return {
    completionTokens: usage.completionTokens,
    promptTokens: usage.promptTokens,
    promptCachedTokens: usage.promptCachedTokens,
    totalTokens: usage.totalTokens,
  };
}

/**
 * Tool names carried by a `toolCtx`, across @livekit/agents versions: 1.5+ always passes a
 * `ToolContext` class instance (tools behind getters, `Object.keys` sees only private fields),
 * while 1.4 and the object shorthand pass a plain name→tool map.
 */
function livekitToolNames(toolCtx: object): string[] {
  const instance = toolCtx as { flatten?: unknown };
  if (typeof instance.flatten === 'function') {
    return (instance.flatten as () => object[])().map(tool => {
      const { id, name } = tool as { id?: string; name?: string };
      return id ?? name ?? 'unknown';
    });
  }
  return Object.keys(toolCtx);
}

/**
 * A standard LiveKit LLM plugin (`llm.LLM`) backed by a Mastra agent. Drop it into the `llm` slot of a
 * customer-owned `voice.AgentSession` and the Mastra app (agent loop, tools, memory, observability)
 * runs wherever it's deployed — most importantly on a **remote** Mastra server reached over HTTP.
 *
 * Tools are defined and executed **server-side** on the Mastra agent; LiveKit-side `toolCtx` is
 * ignored (with a one-time warning). Tool activity surfaces via `toolFeedback` (spoken) and
 * `onToolCall` / `onTurnComplete` (programmatic). `voice.Agent` instructions do **not** reach the
 * Mastra agent — put instructions on the Mastra agent instead (D11).
 *
 * @example
 * ```ts
 * const session = new voice.AgentSession({
 *   stt: 'deepgram/nova-3',
 *   tts: 'cartesia/sonic-3',
 *   llm: new MastraLLM({
 *     remote: { baseUrl: process.env.MASTRA_URL!, agentId: 'callCenter' },
 *     memory: { thread: callId, resource: callerId },
 *   }),
 * });
 * ```
 */
export class MastraLLM extends llm.LLM {
  readonly #model: string;
  readonly #memory: MastraVoiceAgentMemory | false;
  readonly #requestContext?: RequestContext;
  /** Non-remote sources are built once; remote is built per turn so it can pick up `connOptions.timeoutMs`. */
  readonly #staticGenerator?: VoiceReplyGenerator;
  readonly #remoteOptions?: RemoteMastraAgentOptions & {
    toolFeedback?: MastraLLMOptions['toolFeedback'];
    onToolCall?: MastraLLMOptions['onToolCall'];
    onTurnComplete?: VoiceTurnCompleteHook;
  };
  #warnedToolCtx = false;

  constructor(options: MastraLLMOptions) {
    super();
    const sources = [
      options.remote ? 'remote' : undefined,
      options.agent ? 'agent' : undefined,
      options.generate ? 'generate' : undefined,
    ].filter(Boolean) as string[];
    if (sources.length !== 1) {
      throw new Error(
        `@mastra/livekit: MastraLLM requires exactly one reply source — \`remote\`, \`agent\`, or \`generate\` — ` +
          `but got ${sources.length === 0 ? 'none' : sources.join(' + ')}.`,
      );
    }

    this.#memory = options.memory ?? false;
    this.#requestContext = toRequestContext(options.requestContext);

    if (options.remote) {
      this.#model = options.remote.agentId;
      this.#remoteOptions = {
        ...options.remote,
        toolFeedback: options.toolFeedback,
        onToolCall: options.onToolCall,
        onTurnComplete: options.onTurnComplete,
      };
    } else if (options.agent) {
      this.#model = options.agent.id ?? options.agent.name;
      this.#staticGenerator = createAgentReplyGenerator({
        agent: options.agent,
        toolFeedback: options.toolFeedback,
        onToolCall: options.onToolCall,
        onTurnComplete: options.onTurnComplete,
      });
    } else {
      this.#model = 'mastra-generator';
      this.#staticGenerator = options.generate;
    }
  }

  label(): string {
    return 'mastra.MastraLLM';
  }

  override get model(): string {
    return this.#model;
  }

  override get provider(): string {
    return 'mastra';
  }

  /**
   * Resolves the reply generator for a turn. Non-remote sources are built once; the remote transport
   * is built per turn so its connect + first-token timeout can come from the session's
   * `connOptions.timeoutMs` (D9), with base-class retries owning retry (transport `retries: 0`, D8).
   */
  private resolveGenerator(connOptions: APIConnectOptions): VoiceReplyGenerator {
    if (this.#staticGenerator) return this.#staticGenerator;
    const remote = this.#remoteOptions!;
    return createRemoteAgentReplyGenerator({
      ...remote,
      retries: 0,
      timeoutMs: remote.timeoutMs ?? connOptions.timeoutMs,
    });
  }

  override chat({
    chatCtx,
    toolCtx,
    connOptions = DEFAULT_API_CONNECT_OPTIONS,
  }: {
    chatCtx: llm.ChatContext;
    toolCtx?: llm.ToolContext;
    connOptions?: APIConnectOptions;
    parallelToolCalls?: boolean;
    toolChoice?: llm.ToolChoice;
    extraKwargs?: Record<string, unknown>;
  }): llm.LLMStream {
    // D14: tools run server-side; warn once if the customer wired LiveKit-side tools.
    if (!this.#warnedToolCtx && toolCtx) {
      const ignored = livekitToolNames(toolCtx);
      if (ignored.length > 0) {
        this.#warnedToolCtx = true;
        console.warn(
          `@mastra/livekit: MastraLLM ignores LiveKit-side tools (${ignored.join(', ')}). ` +
            `Tools are defined and executed server-side on the Mastra agent — move them there.`,
        );
      }
    }
    return new MastraLLMStream(this, {
      chatCtx,
      toolCtx,
      connOptions,
      generator: this.resolveGenerator(connOptions),
      memory: this.#memory,
      requestContext: this.#requestContext,
    });
  }

  /** No-op in v1: nothing in the LiveKit session/worker ever calls `prewarm()` automatically. */
  override prewarm(): void {}
}

interface MastraLLMStreamOptions {
  chatCtx: llm.ChatContext;
  toolCtx?: llm.ToolContext;
  connOptions: APIConnectOptions;
  generator: VoiceReplyGenerator;
  memory: MastraVoiceAgentMemory | false;
  requestContext?: RequestContext;
}

/**
 * The `llm.LLMStream` `MastraLLM` returns per turn. `run()` extracts the turn's messages (D3), drives
 * the reply generator, and pushes assistant `ChatChunk`s into `this.queue` (NOT `this.output` — the
 * base class drains queue → output and computes TTFT / duration / usage). Barge-in aborts via
 * `this.abortController` and `run()` returns silently (D5).
 */
class MastraLLMStream extends llm.LLMStream {
  readonly #generator: VoiceReplyGenerator;
  readonly #memory: MastraVoiceAgentMemory | false;
  readonly #requestContext?: RequestContext;

  constructor(mastraLLM: MastraLLM, options: MastraLLMStreamOptions) {
    super(mastraLLM, { chatCtx: options.chatCtx, toolCtx: options.toolCtx, connOptions: options.connOptions });
    this.#generator = options.generator;
    this.#memory = options.memory;
    this.#requestContext = options.requestContext;
  }

  protected async run(): Promise<void> {
    const messages =
      this.#memory === false ? chatContextToMessages(this.chatCtx) : extractNewTurnMessages(this.chatCtx);
    // No new input to answer → close without a request (equivalent to the wrapper returning null).
    if (messages.length === 0) return;

    let usage: VoiceTurnUsage | undefined;
    const turnCtx: VoiceTurnContext = {
      messages,
      chatCtx: this.chatCtx,
      memory: this.#memory,
      requestContext: this.#requestContext,
      onUsage: turnUsage => {
        usage = turnUsage;
      },
    };

    const reply = await this.#generator(turnCtx);
    if (!reply) return;
    if (this.abortController.signal.aborted) {
      await reply.cancel().catch(() => {});
      return;
    }

    // A single provider response id ties all of this turn's chunks together for the base class metrics.
    const id = globalThis.crypto.randomUUID();
    const reader = reply.getReader();
    const onAbort = () => void reader.cancel().catch(() => {});
    this.abortController.signal.addEventListener('abort', onAbort, { once: true });
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (this.abortController.signal.aborted) break;
        if (value) this.queue.put({ id, delta: { role: 'assistant', content: value } });
      }
    } catch (error) {
      // Barge-in tears down the reply stream; that surfaces as a read rejection but is not a failure.
      if (this.abortController.signal.aborted) return;
      throw error;
    } finally {
      this.abortController.signal.removeEventListener('abort', onAbort);
    }
    // Return silently on barge-in — throwing would feed the base class's error/retry machinery.
    if (this.abortController.signal.aborted) return;
    // Final usage-only chunk → the base class reads usage from the last chunk that carries it.
    if (usage) this.queue.put({ id, usage: mapUsageToLiveKit(usage) });
  }
}

export { MastraLLMStream };
