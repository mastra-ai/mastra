/**
 * OpenAI Live API wire-protocol constants.
 *
 * OpenAI's Live API (`gpt-live-1`, endpoint `/v1/live/sessions`) is new (GA
 * Sep 2026). Its server-side WebSocket carries audio and control events and,
 * per OpenAI's "Getting started with GPT-Live" and "Migrate to GPT-Live"
 * guides, reuses the **Realtime GA event contract** for the audio loop — the
 * same `session.update` / `input_audio_buffer.append` / `response.*` events
 * used by `@mastra/voice-openai-realtime`. The Live-specific differences are the
 * endpoint, the `session.started` readiness event, the `gpt-live-1` model, and
 * the `delegation` session-config block.
 *
 * Confirmed from OpenAI docs:
 * - Endpoint `v1/live/sessions`; server WebSocket transport for server-side
 *   integrations (developers.openai.com/api/docs/guides/live).
 * - Live start event is `session.started` (guide: "Wait for session.started,
 *   then speak").
 * - Realtime GA audio-loop events (input_audio_buffer.append,
 *   response.output_audio.delta, response.output_audio_transcript.delta,
 *   conversation.item.create for function_call_output) — the contract Live
 *   inherits (developers.openai.com/api/docs/guides/realtime-conversations,
 *   realtime-websocket).
 *
 * All event `type` strings and payload field names are centralized here so the
 * schema can be corrected in one place if OpenAI publishes Live-specific
 * deviations from the Realtime contract.
 */

/** Live API server WebSocket endpoint. */
export const LIVE_WS_URL = 'wss://api.openai.com/v1/live/sessions';

/** Default Live model id. */
export const DEFAULT_MODEL = 'gpt-live-1';

/** Default speaker/voice. */
export const DEFAULT_VOICE = 'marin';

/**
 * Default `User-Agent`. OpenAI asks Live clients to identify themselves; consumers
 * should override with their own app name.
 */
export const DEFAULT_USER_AGENT = 'mastra-voice-openai-live';

/**
 * Known Live speaker voices. Best-effort until OpenAI publishes a stable list.
 */
export const VOICES = ['marin', 'cedar'];

/**
 * Live event `type` strings, both outbound (client → server) and inbound
 * (server → client). Values follow the Realtime GA contract except
 * `sessionStarted`, which is the Live-specific readiness event.
 */
export const LIVE_EVENTS = {
  // Outbound — session lifecycle
  /** Client → server: configure the Live session. */
  sessionUpdate: 'session.update',
  /** Client → server: append input audio (base64). */
  inputAudioAppend: 'input_audio_buffer.append',
  /** Client → server: commit the buffered input audio as a turn. */
  inputAudioCommit: 'input_audio_buffer.commit',
  /** Client → server: create a conversation item (e.g. a function_call_output). */
  conversationItemCreate: 'conversation.item.create',
  /** Client → server: ask the model to produce a response. */
  responseCreate: 'response.create',

  // Inbound — session lifecycle
  /** Server → client: the Live session has started and is ready. */
  sessionStarted: 'session.started',
  /** Server → client: the session was updated. */
  sessionUpdated: 'session.updated',

  // Inbound — audio/transcript output
  /** Server → client: a chunk of output audio (base64). */
  outputAudioDelta: 'response.output_audio.delta',
  /** Server → client: output audio finished. */
  outputAudioDone: 'response.output_audio.done',
  /** Server → client: a chunk of assistant transcript text. */
  outputTranscriptDelta: 'response.output_audio_transcript.delta',
  /** Server → client: assistant transcript finished. */
  outputTranscriptDone: 'response.output_audio_transcript.done',

  // Inbound — response/function calls + errors
  /** Server → client: a response finished; may carry function_call output items. */
  responseDone: 'response.done',
  /** Server → client: an error occurred. */
  error: 'error',
} as const;

/** Conversation item types. */
export const LIVE_ITEM_TYPES = {
  functionCallOutput: 'function_call_output',
} as const;

/** Response output item types. */
export const LIVE_OUTPUT_TYPES = {
  functionCall: 'function_call',
} as const;

/** Payload field names used across Live events. */
export const LIVE_FIELDS = {
  /** Base64 audio payload on input/output audio events. */
  audio: 'audio',
  /** Assistant transcript delta text. */
  delta: 'delta',
  /** Tool/function name on a function-call output item. */
  name: 'name',
  /** JSON-encoded arguments on a function-call output item. */
  arguments: 'arguments',
  /** Correlation id for a function/tool call. */
  callId: 'call_id',
} as const;
