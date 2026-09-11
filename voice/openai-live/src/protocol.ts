/**
 * OpenAI Live API wire-protocol constants.
 *
 * OpenAI's Live API (`/v1/live/sessions`) is new and its event schema is still
 * stabilizing. Every endpoint, event `type` string, and payload field name used
 * by this provider is centralized here so that, if the published schema differs
 * from what we implement, the correction is a single-file change.
 *
 * Confirmed from OpenAI's "Getting started with GPT-Live" guide and public
 * server integrations (e.g. Twilio's GPT-Live tutorials):
 * - Connect: `wss://api.openai.com/v1/live/sessions` with `Authorization` +
 *   `User-Agent` headers.
 * - Input audio append: `{ type: 'session.input_audio.append', audio: <base64> }`.
 * - Output audio delta: `session.output_audio.delta`.
 * - Output transcript delta: `session.output_transcript.delta`.
 */

/** Live API server WebSocket endpoint. */
export const LIVE_WS_URL = 'wss://api.openai.com/v1/live/sessions';

/** Default Live model id. */
export const DEFAULT_MODEL = 'gpt-live-1';

/** Default speaker/voice. */
export const DEFAULT_VOICE = 'marin';

/**
 * Default `User-Agent`. OpenAI asks Live clients to identify themselves so they
 * can distinguish traffic; consumers should override with their own app name.
 */
export const DEFAULT_USER_AGENT = 'mastra-voice-openai-live';

/**
 * Known Live speaker voices. Not exhaustive/final — treated as best-effort until
 * OpenAI publishes a stable list.
 */
export const VOICES = ['marin', 'cedar'];

/**
 * Every Live event `type` string, both outbound (client → server) and inbound
 * (server → client). Grouped for readability; treat all values as the single
 * correction point for schema drift.
 */
export const LIVE_EVENTS = {
  // Outbound — session lifecycle
  /** Client → server: configure/start the Live session. */
  sessionUpdate: 'session.update',
  /** Client → server: append input audio (base64). */
  inputAudioAppend: 'session.input_audio.append',
  /** Client → server: provide a function/tool call result. */
  functionCallOutput: 'session.function_call_output',
  /** Client → server: ask the model to produce a response. */
  responseCreate: 'response.create',

  // Inbound — session lifecycle
  /** Server → client: the session is configured and ready. */
  sessionReady: 'session.ready',
  /** Server → client: the session was updated. */
  sessionUpdated: 'session.updated',

  // Inbound — audio/transcript output
  /** Server → client: a chunk of output audio (base64). */
  outputAudioDelta: 'session.output_audio.delta',
  /** Server → client: output audio finished. */
  outputAudioDone: 'session.output_audio.done',
  /** Server → client: a chunk of assistant transcript text. */
  outputTranscriptDelta: 'session.output_transcript.delta',
  /** Server → client: assistant transcript finished. */
  outputTranscriptDone: 'session.output_transcript.done',

  // Inbound — tool/function calls + errors
  /** Server → client: the model requested a function/tool call. */
  functionCall: 'session.function_call',
  /** Server → client: an error occurred. */
  error: 'error',
} as const;

/** Payload field names used across Live events. */
export const LIVE_FIELDS = {
  /** Base64 audio payload on input/output audio events. */
  audio: 'audio',
  /** Assistant transcript delta text. */
  delta: 'delta',
  /** Tool/function name on a function-call event. */
  name: 'name',
  /** JSON-encoded arguments on a function-call event. */
  arguments: 'arguments',
  /** Correlation id for a function/tool call. */
  callId: 'call_id',
} as const;
