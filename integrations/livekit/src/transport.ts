import type { RequestContext } from '@mastra/core/request-context';
import type { ChunkType } from '@mastra/core/stream';
import type { MastraVoiceAgentMemory } from './bridge';
import type { VoiceTurnMessage } from './messages';

/**
 * The chunk shape yielded by a transport's reply stream. This is the same chunk type
 * `agent.stream().fullStream` produces, so the in-process transport returns it verbatim
 * and a (future) remote transport only has to serialize/deserialize it — there is no
 * second protocol to keep in sync.
 */
export type MastraAgentChunk = ChunkType;

/** One reply turn handed to a transport. */
export interface VoiceTurn {
  /**
   * Messages new since the agent last spoke (memory mode) or the full LiveKit in-session
   * context (no-memory mode). The bridge decides which based on its `memory` setting.
   */
  messages: VoiceTurnMessage[];
  /** Memory mapping for this session, or `false` when persistence is disabled. */
  memory: MastraVoiceAgentMemory | false;
  requestContext?: RequestContext;
  /** Aborted on barge-in; a transport must stop generating when this fires. */
  abortSignal: AbortSignal;
}

/**
 * The seam between LiveKit's voice loop and the Mastra agent.
 *
 * LiveKit owns the audio pipeline (VAD, STT, turn detection, TTS, barge-in) and the
 * bridge ({@link MastraVoiceAgent}) owns the LiveKit-facing chunk handling; a transport
 * owns only "given a turn, produce a Mastra chunk stream". The default
 * {@link inProcessTransport} runs the agent in the worker process. A remote transport
 * (the agent in a separate service, reached over HTTP) implements the same interface —
 * see the package README for the planned remote variant.
 *
 * `stream` is the only required method. The optional methods cover the memory
 * side-effects the worker performs (thread creation, greeting persistence, instruction
 * resolution); an in-process transport runs them against the local agent, a remote
 * transport either forwards them over the wire or leaves them to the agent service.
 */
export interface VoiceAgentTransport {
  /** Generate a reply for one turn. Yields Mastra agent chunks (text-delta, tool-call, error, finish…). */
  stream(turn: VoiceTurn): Promise<AsyncIterable<MastraAgentChunk>>;

  /** Resolved agent instructions for the LiveKit `voice.Agent` (used for its label only). */
  getInstructions?(args: { requestContext?: RequestContext }): Promise<string | undefined>;

  /** Whether sessions should use memory persistence (mirrors `agent.hasOwnMemory()`). */
  supportsMemory?(): boolean | Promise<boolean>;

  /** Create the per-call thread before the session starts. */
  ensureThread?(args: { memory: MastraVoiceAgentMemory; roomName: string }): Promise<void>;

  /** Persist the spoken greeting as an assistant message for a faithful transcript. */
  persistGreeting?(args: { memory: MastraVoiceAgentMemory; greeting: string }): Promise<void>;
}
